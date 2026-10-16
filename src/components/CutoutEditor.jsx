import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { Dialog } from './AccountUI.jsx'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const PROVIDER_NAMES = {
  local: 'Local AI',
  gemini: 'Gemini',
  bria: 'BRIA',
}

const PROVIDER_DESCRIPTIONS = {
  local: 'Processed on this server. No per-image API fee.',
  gemini:
    'Sends your image to Google Gemini. Provider quotas and charges may apply.',
  bria:
    'Sends your image to BRIA. Your BRIA account quota and charges apply.',
}

function pngBytes(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const padding = base64.endsWith('==')
    ? 2
    : base64.endsWith('=')
      ? 1
      : 0

  return Math.floor((base64.length * 3) / 4) - padding
}

export default function CutoutEditor({ src, onClose, onApply }) {
  const canvasRef = useRef(null)
  const originalRef = useRef(null)
  const originalCanvasRef = useRef(null)
  const undoRef = useRef(null)
  const drawingRef = useRef(null)
  const busyRef = useRef(false)
  const sourceVersionRef = useRef(0)

  const [providers, setProviders] = useState({})
  const [provider, setProvider] = useState('local')
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState('')
  const [statusRefresh, setStatusRefresh] = useState(0)

  const [mode, setMode] = useState('sample')
  const [brush, setBrush] = useState(45)
  const [tolerance, setTolerance] = useState(45)
  const [color, setColor] = useState('#ffffff')
  const [ready, setReady] = useState(false)
  const [working, setWorking] = useState(false)
  const [operation, setOperation] = useState('')
  const [canUndo, setCanUndo] = useState(false)
  const [note, setNote] = useState('Loading your image…')

  // Only status flags are received here. API keys stay on the server.
  useEffect(() => {
    let cancelled = false

    setStatusLoading(true)
    setStatusError('')

    api('/api/ai/status')
      .then(result => {
        if (cancelled) return

        const available = {
          local: Boolean(result.local),
          gemini: Boolean(result.gemini),
          bria: Boolean(result.bria),
        }

        setProviders(available)

        setProvider(current => {
          if (available[current]) return current

          return (
            ['local', 'bria', 'gemini'].find(key => available[key]) ||
            current
          )
        })
      })
      .catch(error => {
        if (cancelled) return

        setProviders({})
        setStatusError(
          error.message || 'Could not check AI provider availability.'
        )
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [statusRefresh])

  // Load a fresh original whenever the source changes.
  useEffect(() => {
    let cancelled = false
    const version = ++sourceVersionRef.current
    const image = new Image()

    drawingRef.current = null
    undoRef.current = null
    originalRef.current = null
    originalCanvasRef.current = null
    busyRef.current = false

    setReady(false)
    setWorking(false)
    setOperation('')
    setCanUndo(false)
    setNote('Loading your image…')

    image.onload = () => {
      if (cancelled || version !== sourceVersionRef.current) return

      try {
        const canvas = canvasRef.current
        if (!canvas) return

        const scale = Math.min(
          1,
          2400 / Math.max(image.naturalWidth, image.naturalHeight)
        )

        canvas.width = Math.max(
          1,
          Math.round(image.naturalWidth * scale)
        )
        canvas.height = Math.max(
          1,
          Math.round(image.naturalHeight * scale)
        )

        const context = canvas.getContext('2d', {
          willReadFrequently: true,
        })

        if (!context) throw new Error('Canvas editing is unavailable.')

        context.clearRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)

        originalRef.current = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        )

        const originalCanvas = document.createElement('canvas')
        originalCanvas.width = canvas.width
        originalCanvas.height = canvas.height

        originalCanvas
          .getContext('2d')
          .putImageData(originalRef.current, 0, 0)

        originalCanvasRef.current = originalCanvas

        setReady(true)
        setNote(
          scale < 1
            ? 'Image resized to a maximum 2400 px for editing. Choose AI removal or sample a plain background.'
            : 'Choose AI removal or click a plain background area to sample its color.'
        )
      } catch {
        setNote('Could not load this image for editing. Upload a PNG, JPG or WebP.')
      }
    }

    image.onerror = () => {
      if (!cancelled) {
        setNote('Could not load the image. Close this editor and upload it again.')
      }
    }

    if (src) {
      image.src = src
    } else {
      setNote('Upload an image before opening the cutout editor.')
    }

    return () => {
      cancelled = true
      sourceVersionRef.current++
      image.onload = null
      image.onerror = null
    }
  }, [src])

  function context() {
    return canvasRef.current?.getContext('2d', {
      willReadFrequently: true,
    })
  }

  function saveUndo() {
    const canvas = canvasRef.current

    undoRef.current = context().getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    )

    setCanUndo(true)
  }

  function startOperation(name) {
    if (!ready || busyRef.current) return false

    busyRef.current = true
    drawingRef.current = null

    setWorking(true)
    setOperation(name)
    return true
  }

  function finishOperation(version) {
    if (version !== sourceVersionRef.current) return

    busyRef.current = false
    setWorking(false)
    setOperation('')
  }

  function point(event) {
    const canvas = canvasRef.current
    const bounds = canvas.getBoundingClientRect()

    return [
      Math.max(
        0,
        Math.min(
          canvas.width - 1,
          ((event.clientX - bounds.left) * canvas.width) / bounds.width
        )
      ),
      Math.max(
        0,
        Math.min(
          canvas.height - 1,
          ((event.clientY - bounds.top) * canvas.height) / bounds.height
        )
      ),
    ]
  }

  function paint(event) {
    const stroke = drawingRef.current

    if (
      !stroke ||
      stroke.pointerId !== event.pointerId ||
      busyRef.current ||
      !ready
    ) {
      return
    }

    const canvas = canvasRef.current
    const ctx = context()
    const [x, y] = point(event)
    const radius = (brush * canvas.width) / 700

    // Interpolate between pointer positions to avoid gaps in brush strokes.
    const distance = Math.hypot(x - stroke.x, y - stroke.y)
    const steps = Math.max(
      1,
      Math.ceil(distance / Math.max(1, radius / 2))
    )

    ctx.save()
    ctx.beginPath()

    for (let i = 0; i <= steps; i++) {
      const px = stroke.x + ((x - stroke.x) * i) / steps
      const py = stroke.y + ((y - stroke.y) * i) / steps

      ctx.moveTo(px + radius, py)
      ctx.arc(px, py, radius, 0, Math.PI * 2)
    }

    ctx.clip()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (stroke.mode === 'restore') {
      ctx.drawImage(originalCanvasRef.current, 0, 0)
    }

    ctx.restore()

    stroke.x = x
    stroke.y = y
  }

  function pointerDown(event) {
    if (!ready || busyRef.current || drawingRef.current) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    event.preventDefault()

    const [x, y] = point(event)

    if (mode === 'sample') {
      const pixel = context().getImageData(
        Math.floor(x),
        Math.floor(y),
        1,
        1
      ).data

      if (pixel[3] === 0) {
        setNote('This pixel is transparent. Sample a visible background area.')
        return
      }

      const sampled =
        '#' +
        Array.from(pixel)
          .slice(0, 3)
          .map(value => value.toString(16).padStart(2, '0'))
          .join('')

      setColor(sampled)
      setNote(`Sampled ${sampled}. Click Remove solid background to apply.`)
      return
    }

    saveUndo()

    drawingRef.current = {
      pointerId: event.pointerId,
      x,
      y,
      mode,
    }

    canvasRef.current.setPointerCapture(event.pointerId)
    paint(event)
  }

  function pointerEnd(event) {
    if (drawingRef.current?.pointerId !== event.pointerId) return

    drawingRef.current = null

    const canvas = canvasRef.current

    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
  }

  async function removeSolidBackground() {
    if (!startOperation('solid')) return

    const version = sourceVersionRef.current
    setNote('Removing the edge-connected background…')

    try {
      // Allow the busy state to appear before pixel processing begins.
      await new Promise(resolve => setTimeout(resolve, 20))

      if (version !== sourceVersionRef.current) return

      const canvas = canvasRef.current
      const ctx = context()
      const width = canvas.width
      const height = canvas.height

      saveUndo()

      const image = ctx.getImageData(0, 0, width, height)
      const pixels = image.data
      const rgb = [1, 3, 5].map(index =>
        parseInt(color.slice(index, index + 2), 16)
      )

      const seen = new Uint8Array(width * height)
      const queue = new Uint32Array(width * height)

      let head = 0
      let tail = 0

      const distance = index =>
        Math.hypot(
          pixels[index * 4] - rgb[0],
          pixels[index * 4 + 1] - rgb[1],
          pixels[index * 4 + 2] - rgb[2]
        )

      const add = index => {
        if (index < 0 || index >= width * height || seen[index]) return

        seen[index] = 1

        if (
          pixels[index * 4 + 3] === 0 ||
          distance(index) < tolerance + 25
        ) {
          queue[tail++] = index
        }
      }

      for (let x = 0; x < width; x++) {
        add(x)
        add((height - 1) * width + x)
      }

      for (let y = 0; y < height; y++) {
        add(y * width)
        add(y * width + width - 1)
      }

      while (head < tail) {
        const index = queue[head++]
        const fade = Math.min(
          1,
          Math.max(0, (distance(index) - tolerance) / 25)
        )

        pixels[index * 4 + 3] = Math.round(
          pixels[index * 4 + 3] * fade
        )

        if (index % width > 0) add(index - 1)
        if (index % width < width - 1) add(index + 1)
        add(index - width)
        add(index + width)

        if (head % 100000 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0))
          if (version !== sourceVersionRef.current) return
        }
      }

      ctx.putImageData(image, 0, 0)
      setNote('Background removed. Use Erase / Restore to refine the edges.')
    } catch (error) {
      if (version === sourceVersionRef.current) {
        setNote(error.message || 'Manual removal failed. Try another image.')
      }
    } finally {
      finishOperation(version)
    }
  }

  async function removeWithAI() {
    if (!providers[provider] || statusLoading || statusError) return
    if (!startOperation('ai')) return

    const version = sourceVersionRef.current
    const selectedProvider = provider

    setNote(
      `${PROVIDER_NAMES[selectedProvider]} is processing the original image…`
    )

    try {
      const image = originalCanvasRef.current.toDataURL('image/png')

      if (pngBytes(image) > MAX_IMAGE_BYTES) {
        throw new Error(
          'The working PNG exceeds 8 MB. Upload a smaller source image.'
        )
      }

      saveUndo()

      const result = await api('/api/ai/remove-background', {
        method: 'POST',
        body: {
          provider: selectedProvider,
          image,
        },
      })

      if (version !== sourceVersionRef.current) return

      if (
        typeof result.image !== 'string' ||
        !result.image.startsWith('data:image/png;base64,')
      ) {
        throw new Error('The server did not return a PNG image.')
      }

      const output = new Image()
      output.src = result.image
      await output.decode()

      if (version !== sourceVersionRef.current) return

      const canvas = canvasRef.current
      const ctx = context()

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(output, 0, 0, canvas.width, canvas.height)

      setNote(
        'AI cutout ready. Refine with Erase / Restore, then apply the transparent PNG.'
      )
    } catch (error) {
      if (version === sourceVersionRef.current) {
        setNote(error.message || 'AI removal failed. Please try again.')
      }
    } finally {
      finishOperation(version)
    }
  }

  function undoLastEdit() {
    if (!ready || busyRef.current || !undoRef.current) return

    context().putImageData(undoRef.current, 0, 0)
    undoRef.current = null

    setCanUndo(false)
    setNote('Last edit undone.')
  }

  function resetImage() {
    if (!ready || busyRef.current || !originalRef.current) return

    saveUndo()
    context().putImageData(originalRef.current, 0, 0)
    setNote('Original image restored.')
  }

  function applyImage() {
    if (!ready || busyRef.current) return

    try {
      const png = canvasRef.current.toDataURL('image/png')

      if (pngBytes(png) > MAX_IMAGE_BYTES) {
        setNote('The PNG exceeds 8 MB. Use a smaller source image.')
        return
      }

      onApply(png)
    } catch {
      setNote('Could not prepare the PNG. Try uploading the image again.')
    }
  }

  const disabled = !ready || working

  return (
    <Dialog
      title="Transparent cutout studio"
      subtitle="AI background removal with manual edge refinement. Sign in to use AI."
      onClose={() => {
        if (!busyRef.current) onClose()
      }}
    >
      <div className="ai-strip" aria-busy={working}>
        <div>
          <b>✦ AI background removal</b>
          <small>{PROVIDER_DESCRIPTIONS[provider]}</small>
        </div>

        <select
          aria-label="AI provider"
          value={provider}
          disabled={working || statusLoading}
          onChange={event => setProvider(event.target.value)}
        >
          {Object.entries(PROVIDER_NAMES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
              {' · '}
              {statusLoading
                ? 'Checking…'
                : statusError
                  ? 'Status unavailable'
                  : providers[key]
                    ? key === 'local'
                      ? 'Installed'
                      : 'Configured'
                    : 'Setup needed'}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="primary"
          disabled={
            disabled ||
            statusLoading ||
            Boolean(statusError) ||
            !providers[provider]
          }
          onClick={removeWithAI}
        >
          {operation === 'ai' ? 'Processing…' : 'Remove with AI'}
        </button>
      </div>

      {statusError && (
        <div role="alert" className="helper">
          <p>{statusError}</p>
          <button
            type="button"
            className="secondary"
            disabled={working || statusLoading}
            onClick={() => setStatusRefresh(value => value + 1)}
          >
            Retry provider check
          </button>
        </div>
      )}

      <details className="ai-help">
        <summary>AI setup & privacy</summary>

        <p>
          Sign in before using AI. Local AI runs on this server.
          Selecting Gemini sends the image to Google; selecting BRIA
          sends it to BRIA. Provider quota and charges may apply.
        </p>

        <p>
          For Local AI, run <code>npm run ai:setup</code>, then{' '}
          <code>npm run ai:check</code>. For Gemini, set{' '}
          <code>GEMINI_API_KEY</code>. For BRIA, set{' '}
          <code>BRIA_API_TOKEN</code>. Keys belong only in the server{' '}
          <code>.env</code>. Restart the server after changing settings.
        </p>

        <p>
          Installed / Configured indicates setup status, not a successful
          processing test. AI removal starts from the original uploaded
          image and replaces current manual edits. Undo last edit can
          restore the previous result.
        </p>
      </details>

      <div className="cutout-tools">
        <select
          aria-label="Cutout tool"
          value={mode}
          disabled={disabled}
          onChange={event => setMode(event.target.value)}
        >
          <option value="sample">Sample background color</option>
          <option value="erase">Erase brush</option>
          <option value="restore">Restore brush</option>
        </select>

        <label>
          Brush
          <input
            aria-label="Brush size"
            type="range"
            min="3"
            max="100"
            value={brush}
            disabled={disabled}
            onChange={event => setBrush(Number(event.target.value))}
          />
        </label>

        <label>
          Background color
          <input
            aria-label="Background color"
            type="color"
            value={color}
            disabled={disabled}
            onChange={event => setColor(event.target.value)}
          />
        </label>

        <label>
          Color tolerance
          <input
            aria-label="Color tolerance"
            type="range"
            min="5"
            max="180"
            value={tolerance}
            disabled={disabled}
            onChange={event => setTolerance(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="cutout-canvas">
        <canvas
          ref={canvasRef}
          aria-label="Image cutout editing canvas"
          style={{
            pointerEvents: disabled ? 'none' : 'auto',
            touchAction: 'none',
            cursor: mode === 'sample' ? 'crosshair' : 'cell',
          }}
          onPointerDown={pointerDown}
          onPointerMove={paint}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
          onLostPointerCapture={() => {
            drawingRef.current = null
          }}
        />
      </div>

      <p className="helper" role="status" aria-live="polite">
        {note}
      </p>

      <div className="cutout-actions">
        <button
          type="button"
          className="secondary"
          disabled={disabled}
          onClick={removeSolidBackground}
        >
          {operation === 'solid'
            ? 'Removing…'
            : 'Remove solid background'}
        </button>

        <button
          type="button"
          className="secondary"
          disabled={disabled || !canUndo}
          onClick={undoLastEdit}
        >
          Undo last edit
        </button>

        <button
          type="button"
          className="secondary"
          disabled={disabled}
          onClick={resetImage}
        >
          Reset
        </button>

        <button
          type="button"
          className="primary"
          disabled={disabled}
          onClick={applyImage}
        >
          Apply transparent PNG
        </button>
      </div>
    </Dialog>
  )
}