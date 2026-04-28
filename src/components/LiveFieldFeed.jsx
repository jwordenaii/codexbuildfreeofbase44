/**
 * LiveFieldFeed — TensorFlow.js on-device lot measurement.
 *
 * Captures a camera frame on the user's device, runs a lightweight
 * TF.js object-detection model in the browser, and estimates pavement
 * area without uploading the image to the backend.
 *
 * For production:
 *   - Replace the stub with a custom-trained TF.js SavedModel loaded via
 *     tf.loadGraphModel('/models/pavement_seg/model.json')
 *   - The model should output a segmentation mask covering the pavement area
 *   - Post-process the mask to compute area in pixels → real-world sqft using
 *     a known reference scale (e.g. a painted parking space = 8.5 × 18 ft)
 *
 * Alternatively, the "Upload & Measure" button sends the captured frame to
 * POST /api/v1/ai/vision-measure for server-side PyTorch inference.
 */

import { useRef, useState, useCallback } from 'react'

const ASPECT_RATIO = 16 / 9
const VIDEO_WIDTH = 640
const VIDEO_HEIGHT = Math.round(VIDEO_WIDTH / ASPECT_RATIO)

export default function LiveFieldFeed({ siteId = null }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [cameraOn, setCameraOn] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [captureResult, setCaptureResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [error, setError] = useState(null)

  // ── Start camera ────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
        audio: false,
      })
      videoRef.current.srcObject = stream
      streamRef.current = stream
      await videoRef.current.play()
      setCameraOn(true)
    } catch (err) {
      setError(`Camera access denied: ${err.message}`)
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
    setCaptureResult(null)
    setUploadResult(null)
  }, [])

  // ── Capture frame + run TF.js stub ─────────────────────────────────────────
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    setCapturing(true)
    setCaptureResult(null)
    setUploadResult(null)

    try {
      const ctx = canvasRef.current.getContext('2d')
      canvasRef.current.width = VIDEO_WIDTH
      canvasRef.current.height = VIDEO_HEIGHT
      ctx.drawImage(videoRef.current, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)

      // ── TF.js client-side inference (stub) ──────────────────────────────────
      // In production, replace this block with:
      //   const tf = await import('@tensorflow/tfjs')
      //   const model = await tf.loadGraphModel('/models/pavement_seg/model.json')
      //   const imageTensor = tf.browser.fromPixels(canvasRef.current)
      //   const normalized = imageTensor.div(255.0).expandDims(0)
      //   const output = model.predict(normalized)
      //   const mask = await output.squeeze().array()
      //   // Count non-zero pixels → multiply by pixel area → convert to sqft
      await new Promise((r) => setTimeout(r, 600)) // Simulate model latency

      const stubResult = {
        engine: 'tfjs_stub',
        lot_detected: true,
        area_sqft: 4_820,
        confidence: 0.87,
        note: 'TF.js model not loaded — set up /models/pavement_seg/ for real inference.',
      }
      setCaptureResult(stubResult)
    } catch (err) {
      setError(`Analysis failed: ${err.message}`)
    } finally {
      setCapturing(false)
    }
  }, [])

  // ── Upload to server for PyTorch inference ──────────────────────────────────
  const uploadToServer = useCallback(async () => {
    if (!canvasRef.current) return
    setUploading(true)
    setUploadResult(null)

    try {
      const blob = await new Promise((resolve) =>
        canvasRef.current.toBlob(resolve, 'image/jpeg', 0.85)
      )
      const form = new FormData()
      form.append('file', blob, 'field_capture.jpg')
      if (siteId) form.append('site_id', String(siteId))

      const BASE = import.meta.env.VITE_API_BASE_URL || ''
      const res = await fetch(`${BASE}/api/v1/ai/vision-measure`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(30_000),
      })
      const data = await res.json()
      setUploadResult(data)
    } catch (err) {
      setError(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }, [siteId])

  const result = uploadResult || captureResult

  return (
    <div className="flex flex-col gap-4">
      {/* Camera viewport */}
      <div
        className="relative bg-black rounded-xl overflow-hidden"
        style={{ aspectRatio: `${ASPECT_RATIO}` }}
      >
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${cameraOn ? '' : 'hidden'}`}
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/40">
            <span className="text-5xl">📷</span>
            <p className="text-sm text-center max-w-xs">
              Point your camera at a pavement surface to measure lot area in real-time.
            </p>
          </div>
        )}

        {/* Camera overlay — crosshair + corner guides */}
        {cameraOn && (
          <div className="absolute inset-4 border-2 border-brand-amber/50 rounded-lg pointer-events-none">
            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-brand-amber rounded-tl" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-brand-amber rounded-tr" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-brand-amber rounded-bl" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-brand-amber rounded-br" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 border border-brand-amber/70 rounded-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        {!cameraOn ? (
          <button onClick={startCamera} className="btn-primary flex items-center gap-2">
            <span>📷</span> Start Camera
          </button>
        ) : (
          <>
            <button
              onClick={captureAndAnalyze}
              disabled={capturing}
              className="bg-brand-amber text-brand-navy font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40 hover:bg-brand-amber/80 transition-colors flex items-center gap-2"
            >
              <span>📐</span> {capturing ? 'Analysing…' : 'Measure (On-Device)'}
            </button>
            <button
              onClick={uploadToServer}
              disabled={uploading}
              className="bg-white/10 text-white font-bold px-4 py-2 rounded-lg text-sm border border-white/20 disabled:opacity-40 hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <span>☁️</span> {uploading ? 'Uploading…' : 'Measure (PyTorch)'}
            </button>
            <button
              onClick={stopCamera}
              className="text-white/50 hover:text-white px-4 py-2 text-sm transition-colors"
            >
              Stop Camera
            </button>
          </>
        )}
      </div>

      {/* Result panel */}
      {result && (
        <div className="bg-brand-navy/70 border border-brand-amber/30 rounded-xl p-4 space-y-3">
          <h3 className="text-brand-amber font-bold text-sm uppercase tracking-wide">
            📐 Measurement Result
            <span className="ml-2 text-white/30 normal-case text-xs font-normal">
              engine: {result.engine}
            </span>
          </h3>
          {result.status === 'queued' ? (
            <p className="text-white/70 text-sm">
              {result.message} Job ID: <code className="text-brand-amber">{result.job_id}</code>
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-white/80 text-sm">
              <div>
                <div className="text-xs text-white/40 mb-0.5">Area</div>
                <div className="font-bold text-white">
                  {result.area_sqft ? result.area_sqft.toLocaleString() + ' sqft' : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-white/40 mb-0.5">Confidence</div>
                <div className="font-bold text-white">
                  {result.confidence ? Math.round(result.confidence * 100) + '%' : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-white/40 mb-0.5">Detected</div>
                <div
                  className={`font-bold ${result.lot_detected ? 'text-green-400' : 'text-red-400'}`}
                >
                  {result.lot_detected ? 'Yes' : 'No'}
                </div>
              </div>
            </div>
          )}
          {result.note && <p className="text-xs text-white/40 italic">{result.note}</p>}
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <p className="text-xs text-white/30">
        On-device analysis uses TF.js (no data leaves your device). &ldquo;Measure (PyTorch)&rdquo;
        uploads the frame to the backend for higher-accuracy inference via the Cloud Run model.
      </p>
    </div>
  )
}
