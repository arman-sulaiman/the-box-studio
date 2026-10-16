import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fail } from './security.mjs';

const MAX_PIXELS = 12_000_000;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_PROVIDER_BYTES = 24 * 1024 * 1024;

let active = 0;

const localPython = () =>
  process.env.AI_PYTHON ||
  path.resolve(
    process.platform === 'win32'
      ? '.ai-venv/Scripts/python.exe'
      : '.ai-venv/bin/python'
  );

const currentGeminiModel = () =>
  process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export function aiStatus() {
  return {
    local: existsSync(localPython()),
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    bria: Boolean(process.env.BRIA_API_TOKEN?.trim()),
    model: currentGeminiModel(),
  };
}

// Shared bounded response reader.
async function readLimited(response, limit, message) {
  if (!response.body) {
    fail(502, 'The AI provider returned an empty response.');
  }

  const declaredSize = Number(response.headers.get('content-length'));

  if (Number.isFinite(declaredSize) && declaredSize > limit) {
    await response.body.cancel();
    fail(413, message);
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of response.body) {
    size += chunk.length;

    if (size > limit) {
      fail(413, message);
    }

    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function readProviderJson(response, provider, limit = 1024 * 1024) {
  const bytes = await readLimited(
    response,
    limit,
    `${provider} returned a response that is too large.`
  );

  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(502, `${provider} returned invalid JSON.`);
  }
}

// Gemini is prompted to describe a polygon.
// This is approximate segmentation, not a dedicated hair-matting model.
const segmentationSchema = {
  type: 'OBJECT',
  properties: {
    boxes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          box_2d: {
            type: 'ARRAY',
            items: { type: 'INTEGER' },
          },
          mask: {
            type: 'ARRAY',
            items: {
              type: 'ARRAY',
              items: { type: 'INTEGER' },
            },
          },
          label: { type: 'STRING' },
        },
        required: ['box_2d', 'mask', 'label'],
      },
    },
  },
  required: ['boxes'],
};

export async function geminiMasks(bytes, fetcher = fetch) {
  const model = currentGeminiModel();

  const generationConfig = {
    responseMimeType: 'application/json',
    responseSchema: segmentationSchema,
    maxOutputTokens: 16000,
  };

  if (model.startsWith('gemini-3')) {
    generationConfig.thinkingConfig = { thinkingLevel: 'low' };
  } else if (model.startsWith('gemini-2.5-flash')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const response = await fetcher(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(90000),
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'Segment ONLY the main foreground person, including hair, ' +
                  'ears, neck, body and clothing. Exclude the background. ' +
                  'Return a JSON object with one boxes entry: ' +
                  'box_2d=[ymin,xmin,ymax,xmax], normalized 0-1000 for the full image; ' +
                  'mask=[[x,y],...] describing the foreground contour, with each ' +
                  'coordinate normalized 0-1000 relative to that bounding box; ' +
                  'label="person". Follow the visible silhouette. ' +
                  'Do not return prose or a base64 PNG.',
              },
              {
                inline_data: {
                  mime_type: 'image/png',
                  data: bytes.toString('base64'),
                },
              },
            ],
          },
        ],
        generationConfig,
      }),
    }
  );

  if (!response.ok) {
    if (response.status === 429) {
      fail(429, 'Gemini quota reached. Try Local AI or wait.');
    }

    if (response.status === 401 || response.status === 403) {
      fail(502, 'Gemini access denied. Check the private API key and permissions.');
    }

    if (response.status === 404) {
      fail(502, 'The configured Gemini model is unavailable. Check GEMINI_MODEL.');
    }

    if (response.status === 400) {
      fail(502, 'Gemini rejected the request. Check model support and settings.');
    }

    fail(502, `Gemini request failed (HTTP ${response.status}).`);
  }

  const body = await readProviderJson(response, 'Gemini', 12_000_000);

  const text = (body.candidates?.[0]?.content?.parts || [])
    .filter(part => !part.thought)
    .map(part => part.text || '')
    .join('');

  let parsed;

  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');

    parsed = JSON.parse(cleaned);
  } catch {
    fail(502, 'Gemini did not return valid segmentation JSON. Try another provider.');
  }

  const masks = Array.isArray(parsed) ? parsed : parsed?.boxes;

  if (!Array.isArray(masks) || masks.length < 1 || masks.length > 10) {
    fail(502, 'No usable person mask returned. Try another provider.');
  }

  return masks;
}

function maskBox(item, width, height) {
  const box = item?.box_2d;

  if (
    !Array.isArray(box) ||
    box.length !== 4 ||
    !box.every(value => Number.isFinite(value) && value >= 0 && value <= 1000) ||
    box[2] <= box[0] ||
    box[3] <= box[1]
  ) {
    fail(502, 'Invalid AI mask bounds.');
  }

  const y = Math.floor((box[0] / 1000) * height);
  const x = Math.floor((box[1] / 1000) * width);

  const h = Math.max(
    1,
    Math.min(height - y, Math.ceil(((box[2] - box[0]) / 1000) * height))
  );

  const w = Math.max(
    1,
    Math.min(width - x, Math.ceil(((box[3] - box[1]) / 1000) * width))
  );

  return { x, y, w, h };
}

export async function applyMasks(bytes, masks) {
  if (!Array.isArray(masks) || masks.length < 1 || masks.length > 10) {
    fail(502, 'Invalid AI masks.');
  }

  const { data: rgba, info } = await sharp(bytes, {
    limitInputPixels: MAX_PIXELS,
  })
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const alpha = Buffer.alloc(width * height);
  const polygons = [];

  for (const item of masks) {
    const { x, y, w, h } = maskBox(item, width, height);

    if (Array.isArray(item.mask)) {
      if (item.mask.length < 3 || item.mask.length > 5000) {
        fail(502, 'Invalid AI polygon contour.');
      }

      const points = item.mask.map(point => {
        if (
          !Array.isArray(point) ||
          point.length !== 2 ||
          !point.every(value =>
            Number.isFinite(value) && value >= 0 && value <= 1000
          )
        ) {
          fail(502, 'Invalid AI polygon coordinate.');
        }

        const px = x + (point[0] / 1000) * w;
        const py = y + (point[1] / 1000) * h;

        return `${px.toFixed(2)},${py.toFixed(2)}`;
      });

      polygons.push(`<polygon points="${points.join(' ')}" fill="white"/>`);
    } else if (typeof item.mask === 'string') {
      // Compatibility with PNG probability masks.
      const value = item.mask.replace(/^data:image\/png;base64,/i, '');

      if (
        value.length > 8_000_000 ||
        !/^[A-Za-z0-9+/=\s]+$/.test(value)
      ) {
        fail(502, 'Invalid AI mask data.');
      }

      const mask = Buffer.from(value, 'base64');
      const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

      if (!mask.subarray(0, 8).equals(signature)) {
        fail(502, 'AI returned a non-PNG mask.');
      }

      const pixels = await sharp(mask, { limitInputPixels: MAX_PIXELS })
        .resize(w, h)
        .removeAlpha()
        .greyscale()
        .raw()
        .toBuffer();

      for (let yy = 0; yy < h; yy++) {
        for (let xx = 0; xx < w; xx++) {
          const index = (y + yy) * width + x + xx;
          alpha[index] = Math.max(alpha[index], pixels[yy * w + xx]);
        }
      }
    } else {
      fail(502, 'Invalid AI mask data.');
    }
  }

  if (polygons.length) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `width="${width}" height="${height}" ` +
      `viewBox="0 0 ${width} ${height}">` +
      polygons.join('') +
      '</svg>';

    const polygonAlpha = await sharp(Buffer.from(svg), {
      limitInputPixels: MAX_PIXELS,
    })
      .ensureAlpha()
      .extractChannel('alpha')
      .raw()
      .toBuffer();

    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = Math.max(alpha[i], polygonAlpha[i]);
    }
  }

  for (let i = 0; i < alpha.length; i++) {
    rgba[i * 4 + 3] = Math.round((rgba[i * 4 + 3] * alpha[i]) / 255);
  }

  return sharp(rgba, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();
}

function localRemove(bytes) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      localPython(),
      [path.resolve('server/remove-background.py')],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, OMP_NUM_THREADS: '2' },
        windowsHide: true,
      }
    );

    const chunks = [];
    let size = 0;
    let settled = false;

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (error) reject(error);
      else resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('Local AI timed out. Try a smaller image.'));
    }, 120000);

    child.on('error', () => {
      finish(new Error('Local AI could not start. Check AI_PYTHON and installation.'));
    });

    child.stdout.on('data', chunk => {
      if (settled) return;

      size += chunk.length;

      if (size > MAX_PROVIDER_BYTES) {
        child.kill();
        finish(new Error('Local AI returned an image that is too large.'));
        return;
      }

      chunks.push(chunk);
    });

    // Consume stderr without exposing provider internals or image data.
    child.stderr.on('data', () => {});

    child.on('close', code => {
      if (code !== 0) {
        finish(new Error('Local AI failed. Check its packages and model cache.'));
      } else {
        finish(null, Buffer.concat(chunks));
      }
    });

    child.stdin.on('error', () => {});
    child.stdin.end(bytes);
  });
}

export async function briaRemove(bytes, fetcher = fetch) {
  const response = await fetcher(
    'https://engine.prod.bria-api.com/v2/image/edit/remove_background',
    {
      method: 'POST',
      signal: AbortSignal.timeout(120000),
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        api_token: process.env.BRIA_API_TOKEN,
      },
      body: JSON.stringify({
        image: bytes.toString('base64'),
        sync: true,
        preserve_alpha: true,
      }),
    }
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      fail(502, 'BRIA access denied. Check BRIA_API_TOKEN and API permissions.');
    }

    if (response.status === 429) {
      fail(429, 'BRIA rate limit reached. Wait before trying again.');
    }

    fail(
      502,
      `BRIA request failed (HTTP ${response.status}). Check account quota and access.`
    );
  }

  const body = await readProviderJson(response, 'BRIA');
  let url;

  try {
    url = new URL(body.result?.image_url);
  } catch {
    fail(502, 'BRIA did not return a finished image URL.');
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    fail(502, 'BRIA returned an invalid image URL.');
  }

  // This URL comes from BRIA, not from the browser.
  // Never forward the API token when downloading the result.
  const result = await fetcher(url, {
    signal: AbortSignal.timeout(60000),
    redirect: 'error',
  });

  if (!result.ok) {
    fail(502, 'Could not download the BRIA result.');
  }

  const output = await readLimited(
    result,
    MAX_PROVIDER_BYTES,
    'BRIA returned an image that is too large.'
  );

  const metadata = await sharp(output, {
    limitInputPixels: MAX_PIXELS,
  }).metadata();

  if (!metadata.hasAlpha) {
    fail(502, 'BRIA returned an image without an alpha channel.');
  }

  return sharp(output, {
    limitInputPixels: MAX_PIXELS,
  }).png().toBuffer();
}

export async function removeBackground(input) {
  if (!input || typeof input !== 'object') {
    fail(400, 'Invalid background-removal request.');
  }

  if (active >= 2) {
    fail(429, 'AI is busy. Please try again shortly.');
  }

  const provider = input.provider;

  if (!['local', 'gemini', 'bria'].includes(provider)) {
    fail(400, 'Choose Local AI, Gemini or BRIA.');
  }

  if (!aiStatus()[provider]) {
    const messages = {
      local: 'Local AI is not installed. Run npm run ai:setup.',
      gemini: 'Gemini is not configured. Set GEMINI_API_KEY.',
      bria: 'BRIA is not configured. Set BRIA_API_TOKEN.',
    };

    fail(503, messages[provider]);
  }

  const image = typeof input.image === 'string' ? input.image : '';

  if (image.length > 12_000_000) {
    fail(413, 'Choose an image smaller than 8 MB.');
  }

  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);

  if (!match) {
    fail(400, 'Choose an uploaded PNG, JPG or WebP image.');
  }

  const source = Buffer.from(match[2], 'base64');

  if (!source.length || source.length > MAX_INPUT_BYTES) {
    fail(413, 'Choose an image smaller than 8 MB.');
  }

  active++;

  try {
    let bytes;

    try {
      bytes = await sharp(source, { limitInputPixels: MAX_PIXELS })
        .rotate()
        .resize({
          width: 2400,
          height: 2400,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();
    } catch {
      fail(400, 'Could not read this image. Use a valid image below 12 megapixels.');
    }

    let output;

    if (provider === 'local') {
      output = await localRemove(bytes);
    } else if (provider === 'bria') {
      output = await briaRemove(bytes);
    } else {
      output = await applyMasks(bytes, await geminiMasks(bytes));
    }

    const metadata = await sharp(output, {
      limitInputPixels: MAX_PIXELS,
    }).metadata();

    if (metadata.format !== 'png' || !metadata.hasAlpha) {
      fail(502, 'The provider did not return a PNG with an alpha channel.');
    }

    if (output.length > MAX_OUTPUT_BYTES) {
      fail(413, 'The transparent PNG is too large. Use a smaller source photo.');
    }

    return {
      image: `data:image/png;base64,${output.toString('base64')}`,
      provider,
    };
  } catch (error) {
    if (error?.status) throw error;

    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      fail(504, 'AI processing timed out. Try again with a smaller image.');
    }

    if (provider === 'local' && error?.message?.startsWith('Local AI')) {
      fail(502, error.message);
    }

    fail(
      502,
      `${provider === 'bria' ? 'BRIA' : provider === 'gemini' ? 'Gemini' : 'Local AI'} processing failed. Check connectivity or try another provider.`
    );
  } finally {
    active--;
  }
}