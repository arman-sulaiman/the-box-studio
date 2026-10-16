/**
 * The BOX Studio v10.1 Gemini background-removal request diagnostic.
 * Put this file next to package.json and run:
 *   node --env-file-if-exists=.env gemini-diagnostic.mjs "C:/path/to/person.jpg"
 * The image is sent to Google explicitly for this test. The API key and
 * image bytes are never printed or saved by this script.
 */
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const filename = process.argv[2];

function safe(value) {
  let result = String(value ?? '');
  if (key) result = result.split(key).join('[REDACTED KEY]');
  return result.slice(0, 2000);
}

if (!key) {
  console.error('ERROR: GEMINI_API_KEY is missing from the loaded .env.');
  process.exit(1);
}
if (!filename) {
  console.error('Usage: node --env-file-if-exists=.env gemini-diagnostic.mjs "C:/Photos/person.jpg"');
  process.exit(1);
}

try {
  const bytes = await sharp(await readFile(filename), {limitInputPixels: 12000000})
    .rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  console.log('Gemini diagnostic (background-removal request)');
  console.log('Model:', model);
  console.log('API key loaded:', true);
  console.log('Test image:', 'loaded and converted to PNG; not printed or saved');
  console.log('Sending the test image to Google...');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    signal: AbortSignal.timeout(90000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: 'image/png', data: bytes.toString('base64') } },
        { text: 'Segment the main person, including hair and clothing. Return a JSON array only. Each entry must contain box_2d: [ymin,xmin,ymax,xmax] normalized to 0-1000, mask: a base64 PNG probability mask for that box (white foreground, black background), and label. Exclude the background. Do not return code, polygons or prose.' },
      ] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 16000,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  console.log('HTTP status:', response.status);
  if (!response.ok) {
    console.log('Google error status:', safe(data.error?.status || '(not provided)'));
    console.log('Google error message:', safe(data.error?.message || '(not provided)'));
    if (Array.isArray(data.error?.details)) {
      const types = data.error.details.map(d => d['@type'] || d.reason).filter(Boolean);
      if (types.length) console.log('Error detail types:', safe(types.join('; ')));
    }
    process.exitCode = 1;
  } else {
    console.log('POST request:', 'accepted');
    const candidate = data.candidates?.[0];
    console.log('Finish reason:', safe(candidate?.finishReason || '(not provided)'));
    const resultText = candidate?.content?.parts?.map(p => p.text || '').join('') || '';
    try {
      const masks = JSON.parse(resultText.replace(/^```(?:json)?\s*|\s*```$/g, ''));
      console.log('Parsed JSON:', true);
      console.log('Top-level type:', Array.isArray(masks) ? 'array' : typeof masks);
      const first = Array.isArray(masks) ? masks[0] : masks?.boxes?.[0];
      if (first) {
        console.log('First mask type:', Array.isArray(first.mask) ? 'polygon/list (NOT compatible with current PNG-mask parser)' : typeof first.mask);
        if (typeof first.mask === 'string') console.log('First mask length:', first.mask.length, '(not printed)');
      }
    } catch {
      console.log('Parsed JSON:', false);
      console.log('Response text length:', resultText.length, '(not printed)');
    }
  }
} catch (error) {
  console.log('Diagnostic error:', safe(error?.message));
  process.exitCode = 1;
}
