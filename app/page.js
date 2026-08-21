"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { SAMPLE_PRESETS, generateAuthenticSample, generateInpaintedSample, generateFullAISample } from "../lib/dataset/samples";
import { performPixelForensics } from "../lib/analysis/pixelForensics";
import { performNoiseAnalysis } from "../lib/analysis/noise";
import { performELA } from "../lib/analysis/ela";
import { computeCompositeScore, generateCompositeHeatmap } from "../lib/analysis/scoring";
import { performMetadataAnalysis } from "../lib/analysis/metadata";

const PIPELINE_STEPS = [
  "Spatial Tensor Initialization",
  "PRNU Sensor Shot Noise Extraction",
  "Chromatic & Illuminant Field Vector Discrepancy",
  "Achromatic & White Surface Glyph Inpainting Analysis",
  "Splice Boundary & Edge Gradient Discontinuity",
  "Error Level Analysis (JPEG Quantization Residuals)",
  "Edge-Guided Bilateral Contour Snapping",
  "Bento Telemetry & Pixel Mask Generation",
];

export default function HomePage() {
  const [state, setState] = useState("idle"); // idle | analyzing | results
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Viewport Settings
  const [maskVisible, setMaskVisible] = useState(true);
  const [opacity, setOpacity] = useState(0.75);
  const [viewMode, setViewMode] = useState("composite"); // composite | contour | noise | ela
  const [splitSliderOn, setSplitSliderOn] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);

  // Live Hover HUD
  const [hoverData, setHoverData] = useState(null);
  const [activePreset, setActivePreset] = useState(null);

  const fileInputRef = useRef(null);
  const mainCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const stageRef = useRef(null);

  // Handle Drag & Drop / File selection
  const handleFileSelect = useCallback((f) => {
    if (!f || !f.type.startsWith("image/")) return;
    if (f.size > 40 * 1024 * 1024) { alert("File exceeds 40 MB limit"); return; }
    setActivePreset(null);
    setErrorMsg(null);
    setFile(f);
    setImageUrl(URL.createObjectURL(f));
    setState("analyzing");
    setStepIndex(0);
    setMaskVisible(true);
    setViewMode("composite");
  }, []);

  // Load Verified Benchmark Presets
  const loadPreset = async (preset) => {
    setErrorMsg(null);
    if (preset.id === 'user_recaptcha_modal') {
      try {
        const res = await fetch('/recaptcha_edited.png');
        const blob = await res.blob();
        const f = new File([blob], 'recaptcha_edited.png', { type: 'image/png' });
        setActivePreset(preset);
        setFile(f);
        setImageUrl('/recaptcha_edited.png');
        setState("analyzing");
        setStepIndex(0);
        setMaskVisible(true);
        setViewMode("composite");
      } catch (err) {
        console.error(err);
      }
      return;
    }

    if (preset.id === 'user_desert_path') {
      try {
        const res = await fetch('/sand_path_road_red.png');
        const blob = await res.blob();
        const f = new File([blob], 'sand_path_road_red.png', { type: 'image/png' });
        setActivePreset(preset);
        setFile(f);
        setImageUrl('/sand_path_road_red.png');
        setState("analyzing");
        setStepIndex(0);
        setMaskVisible(true);
        setViewMode("composite");
      } catch (err) {
        console.error(err);
      }
      return;
    }

    let canvas, meta = null;
    if (preset.id === 'inpainting_edit' || preset.id === 'screenshot_edit') {
      const isScreenshot = preset.id === 'screenshot_edit';
      const sample = generateInpaintedSample(800, 500, isScreenshot);
      canvas = sample.editCanvas;
      meta = sample.metadata;
    } else if (preset.id === 'authentic_photo') {
      canvas = generateAuthenticSample(800, 500);
      meta = { type: 'authentic', title: 'Authentic Photo Control' };
    } else {
      canvas = generateFullAISample(800, 500);
      meta = { type: 'full_ai', title: '100% Synthetic Diffusion' };
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const f = new File([blob], `${preset.id}.png`, { type: 'image/png' });
      setActivePreset(preset);
      setFile(f);
      setImageUrl(canvas.toDataURL('image/png'));
      setState("analyzing");
      setStepIndex(0);
      setMaskVisible(true);
      setViewMode("composite");
    }, 'image/png');
  };

  const resetSession = () => {
    setState("idle");
    setFile(null);
    setImageUrl(null);
    setResults(null);
    setHoverData(null);
    setActivePreset(null);
    setErrorMsg(null);
  };

  // Pipeline Execution
  useEffect(() => {
    if (state !== "analyzing" || !file || !imageUrl) return;

    let isCancelled = false;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep < PIPELINE_STEPS.length - 1) {
        setStepIndex(currentStep);
      }
    }, 180);

    (async () => {
      try {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error("Image failed to load in browser memory"));
        });

        if (isCancelled) return;

        const maxDimension = 1920;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        let scale = 1.0;
        if (Math.max(w, h) > maxDimension) {
          scale = maxDimension / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        const procCanvas = document.createElement("canvas");
        procCanvas.width = w;
        procCanvas.height = h;
        const pctx = procCanvas.getContext("2d", { willReadFrequently: true });
        pctx.drawImage(img, 0, 0, w, h);
        const imgData = pctx.getImageData(0, 0, w, h);

        const isLossless = file.type === "image/png" || file.type === "image/webp";

        // Multi-Spectral Forensic Modules
        const pixelForensics = performPixelForensics(imgData, w, h, isLossless);
        const noiseAnalysis = performNoiseAnalysis(imgData, w, h);
        const elaAnalysis = await performELA(imgData, w, h, 0.90, 20, file.type);
        const metadataResult = await performMetadataAnalysis(file, imgData, w, h);

        // Composite Fusion Score
        const scoreResult = computeCompositeScore(
          elaAnalysis,
          noiseAnalysis,
          null,
          null,
          metadataResult,
          pixelForensics
        );

        // Heatmap & Glowing Contours
        const heatmapResult = generateCompositeHeatmap(
          w,
          h,
          elaAnalysis,
          noiseAnalysis,
          null,
          null,
          pixelForensics
        );

        if (isCancelled) return;

        clearInterval(timer);
        setStepIndex(PIPELINE_STEPS.length - 1);

        setResults({
          ...scoreResult,
          width: w,
          height: h,
          sourceImage: img,
          imageData: imgData,
          pixelForensics,
          noiseAnalysis,
          elaAnalysis,
          heatmapImageData: heatmapResult.heatmapImageData,
          contourImageData: heatmapResult.contourImageData,
          pixelSuspicionMap: heatmapResult.pixelSuspicionMap,
          fileSize: (file.size / (1024 * 1024)).toFixed(2) + " MB",
          dimensions: `${w} × ${h}`,
        });

        setState("results");
      } catch (err) {
        if (!isCancelled) {
          clearInterval(timer);
          setErrorMsg(err.message);
          setState("idle");
        }
      }
    })();

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [state, file, imageUrl]);

  // Viewport Canvas Render
  useEffect(() => {
    if (!results || state !== "results") return;
    const mc = mainCanvasRef.current;
    const oc = overlayCanvasRef.current;
    if (!mc || !oc) return;

    const w = results.width;
    const h = results.height;

    mc.width = w;
    mc.height = h;
    oc.width = w;
    oc.height = h;

    const mctx = mc.getContext("2d");
    const octx = oc.getContext("2d");

    mctx.clearRect(0, 0, w, h);
    octx.clearRect(0, 0, w, h);

    // 1. Draw Base Source Image
    mctx.drawImage(results.sourceImage, 0, 0, w, h);

    // 2. Render Overlay Layer based on ViewMode
    if (maskVisible) {
      const overlayImgData = octx.createImageData(w, h);
      const targetPixels = overlayImgData.data;

      if (viewMode === "composite") {
        const heatData = results.heatmapImageData.data;
        for (let i = 0; i < w * h; i++) {
          const idx = i * 4;
          targetPixels[idx] = heatData[idx];
          targetPixels[idx + 1] = heatData[idx + 1];
          targetPixels[idx + 2] = heatData[idx + 2];
          targetPixels[idx + 3] = Math.round(heatData[idx + 3] * opacity);
        }
      } else if (viewMode === "contour") {
        const contourData = results.contourImageData.data;
        for (let i = 0; i < w * h; i++) {
          const idx = i * 4;
          targetPixels[idx] = contourData[idx];
          targetPixels[idx + 1] = contourData[idx + 1];
          targetPixels[idx + 2] = contourData[idx + 2];
          targetPixels[idx + 3] = Math.round(contourData[idx + 3] * opacity);
        }
      } else if (viewMode === "noise") {
        const res3x3 = results.pixelForensics?.res3x3;
        for (let i = 0; i < w * h; i++) {
          const idx = i * 4;
          const v = Math.min(255, Math.round((res3x3 ? res3x3[i] : 0) * 8));
          targetPixels[idx] = v;
          targetPixels[idx + 1] = v;
          targetPixels[idx + 2] = v;
          targetPixels[idx + 3] = Math.round(255 * opacity);
        }
      } else if (viewMode === "ela") {
        const elaCanvas = results.elaAnalysis?.elaCanvas;
        if (elaCanvas) {
          const elaCtx = elaCanvas.getContext("2d");
          const elaData = elaCtx.getImageData(0, 0, w, h).data;
          for (let i = 0; i < w * h; i++) {
            const idx = i * 4;
            targetPixels[idx] = elaData[idx];
            targetPixels[idx + 1] = elaData[idx + 1];
            targetPixels[idx + 2] = elaData[idx + 2];
            targetPixels[idx + 3] = Math.round(255 * opacity);
          }
        }
      }

      // Split Slider Mask Clipping
      if (splitSliderOn) {
        const splitX = Math.round((sliderPos / 100) * w);
        for (let y = 0; y < h; y++) {
          for (let x = splitX; x < w; x++) {
            targetPixels[(y * w + x) * 4 + 3] = 0;
          }
        }
      }

      octx.putImageData(overlayImgData, 0, 0);
    }
  }, [results, state, maskVisible, opacity, viewMode, splitSliderOn, sliderPos]);

  // Live Hover HUD Inspector
  const handleMouseMoveOnCanvas = (e) => {
    if (!results || !mainCanvasRef.current) return;
    const canvas = mainCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = results.width / rect.width;
    const scaleY = results.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    if (x < 0 || x >= results.width || y < 0 || y >= results.height) {
      setHoverData(null);
      return;
    }

    const idx = y * results.width + x;
    const pixIdx = idx * 4;
    const r = results.imageData.data[pixIdx];
    const g = results.imageData.data[pixIdx + 1];
    const b = results.imageData.data[pixIdx + 2];

    const aiProb = results.pixelSuspicionMap ? Math.round(results.pixelSuspicionMap[idx] * 100) : 0;
    const noiseVar = results.pixelForensics?.localNoiseVar ? results.pixelForensics.localNoiseVar[idx].toFixed(2) : "0.00";
    const seamVal = results.pixelForensics?.spliceMap ? Math.round(results.pixelForensics.spliceMap[idx] * 100) : 0;

    setHoverData({
      x,
      y,
      r,
      g,
      b,
      aiProb,
      noiseVar,
      seamVal,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const handleMouseLeaveCanvas = () => setHoverData(null);

  const scorePct = results?.overallScore || 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="shell">
      {/* ── High-End Navigation Bar ── */}
      <header className="nav-header">
        <div className="nav-inner">
          <button className="brand" onClick={resetSession} type="button">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/synthrex_logo.jpg"
              alt="AI Detect Logo"
              className="brand-logo-img"
              width={34}
              height={34}
            />
            <div className="brand-text">
              <div className="brand-title-wrap">
                <span className="brand-title">AI Detect</span>
                <span className="brand-badge">PRO v2.5</span>
              </div>
              <span className="brand-sub">SYNTHREX FORENSICS SUITE</span>
            </div>
          </button>

          <div className="nav-telemetry">
            <div className="domain-pill">
              <span>aidetector.synthrex.in</span>
            </div>
            <div className="status-indicator">
              <span className="status-dot" />
              <span>Core Ready</span>
            </div>
            {state === "results" && (
              <button className="btn-ghost" onClick={resetSession} type="button">
                + New Analysis
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="main-container">
        {errorMsg && (
          <div style={{ padding: "14px", background: "rgba(244, 63, 94, 0.12)", border: "1px solid var(--signal-ai-bd)", borderRadius: "8px", color: "var(--signal-ai)", margin: "20px 0", fontSize: "13px" }}>
            {errorMsg}
          </div>
        )}

        {/* ── 1. IDLE STATE ── */}
        {state === "idle" && (
          <div className="idle-hero">
            <div className="hero-header">
              <div className="hero-pill-badge">
                <span>✦ MULTI-SPECTRAL SENSOR FORENSICS & INPAINTING LOCALIZATION</span>
              </div>
              <h1 className="hero-heading">
                Pixel-Level <span className="hero-heading-gradient">AI & Synthetic Media</span> Detection
              </h1>
              <p className="hero-subtitle">
                Advanced spatial noise residual extraction, chromatic illuminant vector profiling, and high-precision splice boundary gradients to detect AI inpaintings, generative fills, and deepfakes.
              </p>
            </div>

            {/* Luxury Dropzone */}
            <div
              className={`swiss-dropzone ${dragOver ? "active" : ""}`}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="drop-icon-box">⚡</div>
              <p className="drop-headline">Drop an image or screenshot for forensic inspection</p>
              <p className="drop-meta">Supports UHD JPEG, PNG Screenshots, WebP &middot; 100% In-Browser Cryptographic Privacy</p>
              <button type="button" className="drop-cta-btn">Select Image File</button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => handleFileSelect(e.target.files[0])}
              />
            </div>

            {/* Curated Diagnostic Presets */}
            <div className="bento-section">
              <div className="section-label-header">
                <span className="section-label">Verified Diagnostic Presets</span>
              </div>
              <div className="bento-sample-grid">
                {SAMPLE_PRESETS.map((preset) => (
                  <div key={preset.id} className="bento-card" onClick={() => loadPreset(preset)}>
                    <div className="bento-card-header">
                      <span className={`bento-tag ${preset.id.startsWith('user_') ? 'tag-user' : ''}`}>
                        {preset.tag}
                      </span>
                      <span className="bento-arrow">↗</span>
                    </div>
                    <h3 className="bento-name">{preset.name}</h3>
                    <p className="bento-desc">{preset.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Capability Bar */}
            <div className="capability-bar">
              {[
                "PRNU High-Pass Shot Noise",
                "Achromatic Text Inpainting Anomaly",
                "Color Vector Inconsistency",
                "Splice Boundary Discontinuity",
                "Edge-Guided Bilateral Contours",
                "Error Level Analysis (ELA)",
                "Screenshot & Resample Invariance",
              ].map((cap) => (
                <span key={cap} className="cap-chip">{cap}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── 2. ANALYZING SCANNER VIEW ── */}
        {state === "analyzing" && (
          <div className="scan-container">
            <div className="scan-card">
              <div className="scan-header">
                <span className="scan-title">Executing Multi-Spectral Forensic Matrix</span>
                <span className="scan-pulse">ANALYZING</span>
              </div>

              <div className="scan-progress-track">
                <div
                  className="scan-progress-fill"
                  style={{ width: `${((stepIndex + 1) / PIPELINE_STEPS.length) * 100}%` }}
                />
              </div>

              <div className="scan-pipeline-steps">
                {PIPELINE_STEPS.map((s, idx) => (
                  <div
                    key={idx}
                    className={`pipeline-step ${idx < stepIndex ? "completed" : idx === stepIndex ? "active" : ""}`}
                  >
                    <div className="step-indicator">
                      {idx < stepIndex ? "✓" : idx + 1}
                    </div>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 3. RESULTS BENTO DASHBOARD ── */}
        {state === "results" && results && (
          <div className="results-dashboard">
            {/* Top Telemetry Strip */}
            <div className="telemetry-strip">
              <div className="telemetry-items">
                <div>DIMENSIONS: <span className="telemetry-val">{results.dimensions}</span></div>
                <div>PAYLOAD: <span className="telemetry-val">{results.fileSize}</span></div>
                <div>PIXELS: <span className="telemetry-val">{(results.width * results.height).toLocaleString()}</span></div>
              </div>
              <div className="telemetry-items">
                <div>CORE: <span className="telemetry-val" style={{ color: "var(--brand-cyan)" }}>CLIENT FORENSICS V2.5</span></div>
                <div>HOST: <span className="telemetry-val">aidetector.synthrex.in</span></div>
              </div>
            </div>

            {/* Viewport Control Bar */}
            <div className="viewport-controls-bar">
              <div className="mode-pills">
                <button
                  type="button"
                  className={`mode-pill ${viewMode === "composite" ? "active" : ""}`}
                  onClick={() => setViewMode("composite")}
                >
                  Composite Heatmap
                </button>
                <button
                  type="button"
                  className={`mode-pill ${viewMode === "contour" ? "active" : ""}`}
                  onClick={() => setViewMode("contour")}
                >
                  Pixel Contours
                </button>
                <button
                  type="button"
                  className={`mode-pill ${viewMode === "noise" ? "active" : ""}`}
                  onClick={() => setViewMode("noise")}
                >
                  PRNU Residuals
                </button>
                <button
                  type="button"
                  className={`mode-pill ${viewMode === "ela" ? "active" : ""}`}
                  onClick={() => setViewMode("ela")}
                >
                  High-Res ELA
                </button>
              </div>

              <div className="viewport-toggles">
                <label className="swiss-switch">
                  <input
                    type="checkbox"
                    checked={splitSliderOn}
                    onChange={(e) => setSplitSliderOn(e.target.checked)}
                  />
                  <span className="switch-track"><span className="switch-thumb" /></span>
                  Split Slider
                </label>

                <label className="swiss-switch">
                  <input
                    type="checkbox"
                    checked={maskVisible}
                    onChange={(e) => setMaskVisible(e.target.checked)}
                  />
                  <span className="switch-track"><span className="switch-thumb" /></span>
                  Diagnostic Mask
                </label>

                {maskVisible && (
                  <div className="opacity-slider-wrap">
                    <span>Opacity</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={opacity}
                      onChange={(e) => setOpacity(+e.target.value)}
                    />
                    <span>{Math.round(opacity * 100)}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Hairline Comparison Slider */}
            {splitSliderOn && (
              <div className="split-slider-hairline">
                <span>Drag to compare Original Photo (Right) vs AI Detection Mask (Left):</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPos}
                  onChange={(e) => setSliderPos(+e.target.value)}
                  className="split-slider-input"
                />
                <span>{sliderPos}%</span>
              </div>
            )}

            {/* Visualizer Canvas Viewport */}
            <div className="visualizer-viewport" ref={stageRef}>
              <div
                className="canvas-stage"
                onMouseMove={handleMouseMoveOnCanvas}
                onMouseLeave={handleMouseLeaveCanvas}
              >
                <canvas ref={mainCanvasRef} />
                <canvas ref={overlayCanvasRef} className="overlay-canvas" />
              </div>
            </div>

            {/* Live Hover Pixel Inspector HUD */}
            {hoverData && (
              <div
                className="inspector-hud"
                style={{
                  left: `${Math.min(window.innerWidth - 250, hoverData.clientX + 16)}px`,
                  top: `${Math.min(window.innerHeight - 200, hoverData.clientY + 16)}px`,
                }}
              >
                <div className="hud-top">
                  <span className="hud-coords">X:{hoverData.x} Y:{hoverData.y}</span>
                  <span className={`hud-pill ${hoverData.aiProb >= 40 ? "ai" : "auth"}`}>
                    {hoverData.aiProb >= 40 ? "AI ANOMALY" : "AUTHENTIC"}
                  </span>
                </div>
                <div className="hud-data">
                  <div className="hud-metric-row">
                    <span>AI Probability</span>
                    <span className="val" style={{ color: hoverData.aiProb >= 40 ? "var(--signal-ai)" : "var(--signal-auth)" }}>
                      {hoverData.aiProb}%
                    </span>
                  </div>
                  <div className="hud-metric-row">
                    <span>RGB Vector</span>
                    <span className="val">({hoverData.r}, {hoverData.g}, {hoverData.b})</span>
                  </div>
                  <div className="hud-metric-row">
                    <span>Noise Var (σ²)</span>
                    <span className="val">{hoverData.noiseVar}</span>
                  </div>
                  <div className="hud-metric-row">
                    <span>Seam Gradient</span>
                    <span className="val">{hoverData.seamVal}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Bento Telemetry Studio ── */}
            <div className="bento-telemetry-grid">
              {/* Cell 1: Overall Verdict */}
              <div className="bento-cell cell-verdict">
                <div className="section-label-header">
                  <span className="section-label">Forensic Verdict</span>
                </div>
                <div className="verdict-gauge-wrap">
                  <div className="gauge-svg-box">
                    <svg viewBox="0 0 88 88" width="88" height="88">
                      <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                      <circle
                        cx="44" cy="44" r={radius} fill="none"
                        stroke={scorePct >= 60 ? "var(--signal-ai)" : scorePct >= 30 ? "var(--signal-warn)" : "var(--signal-auth)"}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - (scorePct / 100) * circumference}
                        transform="rotate(-90 44 44)"
                        style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)" }}
                      />
                    </svg>
                    <span className="gauge-number">{scorePct}%</span>
                  </div>

                  <div className="verdict-content">
                    <span className={`verdict-badge ${scorePct >= 60 ? "v-red" : scorePct >= 30 ? "v-amber" : "v-green"}`}>
                      {scorePct >= 60 ? "AI Inpainted / Altered" : scorePct >= 30 ? "Likely AI-Modified" : "Likely Authentic Camera"}
                    </span>
                    <span className="verdict-meta">Confidence Index: {results.confidence}</span>
                    {results.editedAreaPercent > 0 && (
                      <span className="area-callout">
                        Detected Inpainting Area: <strong>{results.editedAreaPercent}%</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Cell 2: Multi-Spectral Signal Breakdown */}
              <div className="bento-cell cell-breakdown">
                <div className="section-label-header">
                  <span className="section-label">Multi-Spectral Signal Matrix</span>
                </div>
                <div className="signal-rows">
                  {results.breakdown && Object.values(results.breakdown).map((b) => (
                    <div className="signal-row" key={b.label}>
                      <span className="signal-name">{b.label}</span>
                      <div className="signal-track">
                        <div
                          className={`signal-fill ${b.score >= 60 ? "f-red" : b.score >= 30 ? "f-amber" : "f-green"}`}
                          style={{ width: `${b.score}%` }}
                        />
                      </div>
                      <span className="signal-val">{b.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cell 3: Quantitative Geometry */}
              <div className="bento-cell cell-metrics">
                <div className="section-label-header">
                  <span className="section-label">Spatial Geometry</span>
                </div>
                <div className="geometry-grid">
                  <div className="geom-stat">
                    <span className="geom-lbl">Inpainted Area</span>
                    <span className="geom-val" style={{ color: "var(--signal-ai)" }}>{results.editedAreaPercent}%</span>
                  </div>
                  <div className="geom-stat">
                    <span className="geom-lbl">Affected Pixels</span>
                    <span className="geom-val">{results.pixelForensics?.stats?.editedPixelCount?.toLocaleString() || "0"}</span>
                  </div>
                  <div className="geom-stat">
                    <span className="geom-lbl">Sensor Noise (σ²)</span>
                    <span className="geom-val">{results.noiseAnalysis?.stats?.averageNoiseVariance ? results.noiseAnalysis.stats.averageNoiseVariance.toFixed(1) : "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Cell 4: Action Suite */}
              <div className="bento-cell cell-actions">
                <div className="section-label-header">
                  <span className="section-label">Export Suite</span>
                </div>
                <div className="action-stack">
                  <button className="swiss-btn btn-accent" onClick={() => downloadJSON(results)} type="button">
                    ↓ Export JSON Dossier
                  </button>
                  <button className="swiss-btn" onClick={() => downloadCanvas(overlayCanvasRef.current, "ai-detect-alpha-mask.png")} type="button">
                    ↓ Save Binary Alpha Mask
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Synthrex Footer ── */}
      <footer className="synthrex-footer">
        <div>
          <strong>AI Detect</strong> by Synthrex Technologies &middot; Enterprise Pixel Forensics
        </div>
        <div>
          Hosted at <a href="https://aidetector.synthrex.in" className="footer-domain-link" target="_blank" rel="noreferrer">aidetector.synthrex.in</a> &middot; Client-Side Spatial Matrix
        </div>
      </footer>
    </div>
  );
}

function downloadJSON(res) {
  const dossier = {
    system: "AI Detect — Synthrex Forensics Engine v2.5",
    domain: "aidetector.synthrex.in",
    timestamp: new Date().toISOString(),
    overallScore: res.overallScore,
    classification: res.classification,
    confidence: res.confidence,
    editedAreaPercent: res.editedAreaPercent,
    dimensions: res.dimensions,
    fileSize: res.fileSize,
    breakdown: res.breakdown,
  };
  const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: "application/json" });
  triggerDownload(URL.createObjectURL(blob), "ai-detect-forensic-dossier.json");
}

function downloadCanvas(canvas, filename) {
  if (!canvas) return;
  triggerDownload(canvas.toDataURL("image/png"), filename);
}

function triggerDownload(url, filename) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
}
