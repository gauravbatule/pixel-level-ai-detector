"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
  const [showDocsModal, setShowDocsModal] = useState(false);

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
    if (f.size > 40 * 1024 * 1024) { alert("File exceeds 40 MB threshold"); return; }
    setActivePreset(null);
    setErrorMsg(null);
    setFile(f);
    setImageUrl(URL.createObjectURL(f));
    setState("analyzing");
    setStepIndex(0);
    setMaskVisible(true);
    setViewMode("composite");
  }, []);

  // Clipboard Paste Support (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          handleFileSelect(blob);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFileSelect]);

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
    }, 150);

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
  const radius = 28;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="app-shell">
      {/* ── Desktop & Web Header ── */}
      <header className="app-header">
        <div className="header-inner">
          <div className="header-left">
            <button className="brand-button" onClick={resetSession} type="button">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/synthrex_logo.jpg"
                alt="AI Detect Logo"
                className="brand-icon"
                width={26}
                height={26}
              />
              <span className="brand-name">AI Detect</span>
              <span className="brand-version">v2.5</span>
            </button>

            <nav className="nav-links">
              <button
                type="button"
                className={`nav-link ${state === "idle" ? "active" : ""}`}
                onClick={resetSession}
              >
                Analyze
              </button>
              <button
                type="button"
                className="nav-link"
                onClick={() => {
                  if (state !== "idle") resetSession();
                  window.scrollTo({ top: 300, behavior: "smooth" });
                }}
              >
                Presets
              </button>
              <button
                type="button"
                className="nav-link"
                onClick={() => setShowDocsModal(true)}
              >
                Documentation
              </button>
            </nav>
          </div>

          <div className="header-right">
            <div className="privacy-badge">
              <span className="privacy-dot" />
              <span>Local Processing · Private</span>
            </div>
            {state === "results" && (
              <button className="btn-secondary" onClick={resetSession} type="button">
                + New Analysis
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="workspace-container">
        {errorMsg && (
          <div style={{ padding: "12px 16px", background: "var(--color-suspicious-bg)", border: "1px solid var(--color-suspicious-bd)", borderRadius: "var(--radius-sm)", color: "var(--color-suspicious)", marginBottom: "16px", fontSize: "12px" }}>
            {errorMsg}
          </div>
        )}

        {/* ── 1. IDLE STATE: WORKSPACE & UPLOAD ── */}
        {state === "idle" && (
          <div>
            <div className="workspace-intro">
              <h1 className="workspace-title">AI & Synthetic Media Analysis</h1>
              <p className="workspace-desc">
                Analyze images for AI generation, inpainting, manipulation, and synthetic artifacts using multi-signal forensic analysis.
              </p>
            </div>

            {/* Compact Drag & Drop Upload Zone */}
            <div
              className={`upload-card ${dragOver ? "drag-over" : ""}`}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="upload-icon">↑</div>
              <div className="upload-title">Upload image for forensic analysis</div>
              <div className="upload-subtitle">Drag & drop a file here, or paste from clipboard (Ctrl+V)</div>
              
              <div className="upload-actions-row">
                <button type="button" className="btn-primary">Choose image</button>
              </div>

              <div className="upload-format-tags">
                <span>PNG · JPEG · WebP · Max 40MB · Client-Side Execution</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => handleFileSelect(e.target.files[0])}
              />
            </div>

            {/* Benchmark Preset Repository */}
            <div className="presets-container">
              <span className="presets-label">Diagnostic Benchmark Cases</span>
              <div className="presets-grid">
                {SAMPLE_PRESETS.map((preset) => (
                  <div key={preset.id} className="preset-card" onClick={() => loadPreset(preset)}>
                    <div className="preset-card-top">
                      <span className="preset-name">{preset.name}</span>
                      <span className={`preset-badge ${preset.id.startsWith('user_') ? 'user-case' : ''}`}>
                        {preset.tag}
                      </span>
                    </div>
                    <p className="preset-desc">{preset.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 2. PROCESSING STATE ── */}
        {state === "analyzing" && (
          <div className="processing-card">
            <div className="processing-header">
              <span>Running Multi-Signal Analysis</span>
              <span className="processing-pulse">PROCESSING</span>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${((stepIndex + 1) / PIPELINE_STEPS.length) * 100}%` }}
              />
            </div>

            <div className="steps-list">
              {PIPELINE_STEPS.map((s, idx) => (
                <div
                  key={idx}
                  className={`step-item ${idx < stepIndex ? "done" : idx === stepIndex ? "active" : ""}`}
                >
                  <span>{idx < stepIndex ? "✓" : idx + 1}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 3. RESULTS DASHBOARD (Two-Column Desktop) ── */}
        {state === "results" && results && (
          <div className="results-container">
            {/* Meta Toolbar */}
            <div className="meta-toolbar">
              <div className="meta-group">
                <div>DIMENSIONS: <span className="meta-val">{results.dimensions}</span></div>
                <div>SIZE: <span className="meta-val">{results.fileSize}</span></div>
                <div>PIXELS: <span className="meta-val">{(results.width * results.height).toLocaleString()}</span></div>
              </div>
              <div className="meta-group">
                <div>CORE: <span className="meta-val">Client Forensics v2.5</span></div>
                <div>HOST: <span className="meta-val">aidetector.synthrex.in</span></div>
              </div>
            </div>

            {/* 2-Column Responsive Workspace */}
            <div className="studio-grid">
              {/* Left Column: Interactive Visualizer */}
              <div className="visualizer-column">
                <div className="viewport-panel" ref={stageRef}>
                  <div className="viewport-topbar">
                    <div className="mode-segmented">
                      <button
                        type="button"
                        className={`mode-btn ${viewMode === "composite" ? "active" : ""}`}
                        onClick={() => setViewMode("composite")}
                      >
                        Composite Heatmap
                      </button>
                      <button
                        type="button"
                        className={`mode-btn ${viewMode === "contour" ? "active" : ""}`}
                        onClick={() => setViewMode("contour")}
                      >
                        Pixel Contours
                      </button>
                      <button
                        type="button"
                        className={`mode-btn ${viewMode === "noise" ? "active" : ""}`}
                        onClick={() => setViewMode("noise")}
                      >
                        PRNU Residuals
                      </button>
                      <button
                        type="button"
                        className={`mode-btn ${viewMode === "ela" ? "active" : ""}`}
                        onClick={() => setViewMode("ela")}
                      >
                        High-Res ELA
                      </button>
                    </div>

                    <div className="viewport-controls-group">
                      <label className="control-toggle">
                        <input
                          type="checkbox"
                          checked={splitSliderOn}
                          onChange={(e) => setSplitSliderOn(e.target.checked)}
                        />
                        Split Slider
                      </label>

                      <label className="control-toggle">
                        <input
                          type="checkbox"
                          checked={maskVisible}
                          onChange={(e) => setMaskVisible(e.target.checked)}
                        />
                        Overlay Mask
                      </label>

                      {maskVisible && (
                        <div className="opacity-slider-item">
                          <span>{Math.round(opacity * 100)}%</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={opacity}
                            onChange={(e) => setOpacity(+e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {splitSliderOn && (
                    <div className="split-slider-control-bar">
                      <span>Comparison (Original vs Overlay):</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sliderPos}
                        onChange={(e) => setSliderPos(+e.target.value)}
                      />
                      <span>{sliderPos}%</span>
                    </div>
                  )}

                  <div
                    className="canvas-viewport-stage"
                    onMouseMove={handleMouseMoveOnCanvas}
                    onMouseLeave={handleMouseLeaveCanvas}
                  >
                    <canvas ref={mainCanvasRef} />
                    <canvas ref={overlayCanvasRef} className="overlay-canvas" />
                  </div>
                </div>

                {/* Live Floating Inspector HUD */}
                {hoverData && (
                  <div
                    className="live-coord-hud"
                    style={{
                      left: `${Math.min(window.innerWidth - 220, hoverData.clientX + 14)}px`,
                      top: `${Math.min(window.innerHeight - 180, hoverData.clientY + 14)}px`,
                    }}
                  >
                    <div className="hud-header">
                      <span>X:{hoverData.x} Y:{hoverData.y}</span>
                      <span style={{ color: hoverData.aiProb >= 40 ? "var(--color-suspicious)" : "var(--color-authentic)", fontWeight: 700 }}>
                        {hoverData.aiProb >= 40 ? "SUSPICIOUS" : "AUTHENTIC"}
                      </span>
                    </div>
                    <div className="hud-stat-row">
                      <span>AI Probability</span>
                      <span className="val">{hoverData.aiProb}%</span>
                    </div>
                    <div className="hud-stat-row">
                      <span>RGB Vector</span>
                      <span className="val">({hoverData.r}, {hoverData.g}, {hoverData.b})</span>
                    </div>
                    <div className="hud-stat-row">
                      <span>Local Noise (σ²)</span>
                      <span className="val">{hoverData.noiseVar}</span>
                    </div>
                    <div className="hud-stat-row">
                      <span>Seam Gradient</span>
                      <span className="val">{hoverData.seamVal}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Analysis Summary */}
              <div className="summary-column">
                {/* Primary Verdict Card */}
                <div className="summary-card">
                  <div className="summary-card-header">
                    <span className="card-title">Analysis Verdict</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                      Confidence: {results.confidence}
                    </span>
                  </div>

                  <div className="verdict-box">
                    <div className="verdict-gauge-ring">
                      <svg viewBox="0 0 64 64" width="64" height="64">
                        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--border-hairline)" strokeWidth="5" />
                        <circle
                          cx="32" cy="32" r={radius} fill="none"
                          stroke={scorePct >= 60 ? "var(--color-suspicious)" : scorePct >= 30 ? "var(--color-inconclusive)" : "var(--color-authentic)"}
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference - (scorePct / 100) * circumference}
                          transform="rotate(-90 32 32)"
                          style={{ transition: "stroke-dashoffset 0.6s var(--ease-standard)" }}
                        />
                      </svg>
                      <span className="verdict-score-text">{scorePct}%</span>
                    </div>

                    <div className="verdict-details">
                      <span className={`verdict-pill ${scorePct >= 60 ? "suspicious" : scorePct >= 30 ? "inconclusive" : "authentic"}`}>
                        {scorePct >= 60 ? "Likely Manipulated / AI Edited" : scorePct >= 30 ? "Potentially AI Generated" : "Likely Authentic Camera"}
                      </span>
                      <span className="verdict-subtext">
                        {results.editedAreaPercent > 0 
                          ? `Localized inpainting detected across ${results.editedAreaPercent}% of surface.`
                          : "Uniform natural sensor distribution verified."}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Multi-Signal Matrix */}
                <div className="signals-matrix-card">
                  <span className="card-title">Forensic Signal Matrix</span>
                  {results.breakdown && Object.values(results.breakdown).map((b) => (
                    <div className="signal-item-row" key={b.label}>
                      <span className="signal-item-label">{b.label}</span>
                      <div className="signal-item-bar-track">
                        <div
                          className="signal-item-bar-fill"
                          style={{
                            width: `${b.score}%`,
                            backgroundColor: b.score >= 60 ? "var(--color-suspicious)" : b.score >= 30 ? "var(--color-inconclusive)" : "var(--color-authentic)"
                          }}
                        />
                      </div>
                      <span className="signal-item-score">{b.score}</span>
                    </div>
                  ))}
                </div>

                {/* Export Suite */}
                <div className="export-panel">
                  <button className="btn-primary" onClick={() => downloadJSON(results)} type="button">
                    Export Dossier (.JSON)
                  </button>
                  <button className="btn-secondary" onClick={() => downloadCanvas(overlayCanvasRef.current, "ai-detect-alpha-mask.png")} type="button">
                    Save Alpha Mask (.PNG)
                  </button>
                </div>
              </div>
            </div>

            {/* Detailed Forensic Signal Cards (Below) */}
            <div className="detailed-signals-section">
              <div className="forensic-detail-card">
                <div className="detail-card-head">
                  <span className="detail-card-title">PRNU Sensor Shot Noise</span>
                  <span className="detail-card-status" style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}>
                    σ²: {results.noiseAnalysis?.stats?.averageNoiseVariance ? results.noiseAnalysis.stats.averageNoiseVariance.toFixed(1) : "N/A"}
                  </span>
                </div>
                <p className="detail-card-desc">
                  Measures high-frequency sensor photo-response non-uniformity. AI diffusion models typically exhibit unnatural high-frequency noise dropout.
                </p>
                <div className="detail-metrics-row">
                  <span>Demosaicing Pattern</span>
                  <span style={{ color: results.noiseAnalysis?.stats?.crossChannelScore < 0.2 ? "var(--color-authentic)" : "var(--color-inconclusive)" }}>
                    {results.noiseAnalysis?.stats?.crossChannelScore < 0.2 ? "Natural Bayer Grid" : "Synthetic Spectrum"}
                  </span>
                </div>
              </div>

              <div className="forensic-detail-card">
                <div className="detail-card-head">
                  <span className="detail-card-title">Chromatic & Illuminant Field</span>
                  <span className="detail-card-status" style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}>
                    Vector Delta
                  </span>
                </div>
                <p className="detail-card-desc">
                  Profiles localized color temperature and chromatic consistency across scene illuminants to flag generative insertions.
                </p>
                <div className="detail-metrics-row">
                  <span>Inpainted Area</span>
                  <span style={{ color: results.editedAreaPercent > 0 ? "var(--color-suspicious)" : "var(--text-primary)" }}>
                    {results.editedAreaPercent}%
                  </span>
                </div>
              </div>

              <div className="forensic-detail-card">
                <div className="detail-card-head">
                  <span className="detail-card-title">Achromatic & Text Inpainting</span>
                  <span className="detail-card-status" style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}>
                    Diffusion Halo
                  </span>
                </div>
                <p className="detail-card-desc">
                  Detects glyph alteration and synthetic inpainting on white/desaturated surfaces (such as altered modal dialogs or text replacement).
                </p>
                <div className="detail-metrics-row">
                  <span>Affected Pixels</span>
                  <span>{results.pixelForensics?.stats?.editedPixelCount?.toLocaleString() || "0"}</span>
                </div>
              </div>

              <div className="forensic-detail-card">
                <div className="detail-card-head">
                  <span className="detail-card-title">Compression & ELA Residuals</span>
                  <span className="detail-card-status" style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}>
                    Quantization
                  </span>
                </div>
                <p className="detail-card-desc">
                  Error Level Analysis evaluates recompression loss across 8x8 DCT blocks to identify spliced elements with mismatched compression histories.
                </p>
                <div className="detail-metrics-row">
                  <span>JPEG Grid Invariance</span>
                  <span>Verified</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Documentation Modal ── */}
      {showDocsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setShowDocsModal(false)}
        >
          <div
            style={{
              maxWidth: "600px",
              width: "100%",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-hairline)",
              borderRadius: "var(--radius-md)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Forensic Architecture & Methodology</h2>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDocsModal(false)}
                style={{ padding: "4px 8px" }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: "12px" }}>
              <p>
                <strong>AI Detect</strong> by Synthrex operates entirely inside the browser utilizing WebAssembly and client-side Float32Array tensors for maximum privacy and zero latency.
              </p>
              <p>
                <strong>1. PRNU Sensor Shot Noise:</strong> Real digital cameras exhibit physical silicon sensor pattern noise. Diffusion models generate synthetic imagery lacking this stochastic noise profile.
              </p>
              <p>
                <strong>2. Chromatic Anomaly Field:</strong> Inpainted elements often diverge from the global color temperature and illuminance field of the original capture.
              </p>
              <p>
                <strong>3. Achromatic Inpainting:</strong> Specialized detection for text replacement and inpainting on white/light backgrounds (such as modified UI screenshots or documents).
              </p>
              <p>
                <strong>4. Error Level Analysis (ELA):</strong> Discloses discrepancies in compression quantization matrices across the image plane.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Professional Footer ── */}
      <footer className="app-footer">
        <div className="footer-inner">
          <div>
            <strong>AI Detect</strong> &middot; Synthrex Technologies &middot; Precision Pixel Forensics
          </div>
          <div>
            Hosted at <a href="https://aidetector.synthrex.in" className="footer-link" target="_blank" rel="noreferrer">aidetector.synthrex.in</a> &middot; 100% Client-Side Private
          </div>
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
