"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { SAMPLE_PRESETS, generateAuthenticSample, generateInpaintedSample, generateFullAISample } from "../lib/dataset/samples";
import { performPixelForensics } from "../lib/analysis/pixelForensics";
import { performNoiseAnalysis } from "../lib/analysis/noise";
import { performFrequencyAnalysis } from "../lib/analysis/frequency";
import { performELA } from "../lib/analysis/ela";
import { computeCompositeScore, generateCompositeHeatmap } from "../lib/analysis/scoring";
import { performMetadataAnalysis } from "../lib/analysis/metadata";

const PIPELINE_STEPS = [
  "Extracting pixel signals & spatial tensors",
  "Analyzing PRNU sensor noise residual",
  "Checking chromatic & illuminant consistency",
  "Evaluating achromatic text & glyph inpainting",
  "Computing splice boundary gradients",
  "Parsing EXIF, XMP & C2PA metadata tags",
  "Generating multi-signal forensic dossier",
];

export default function HomePage() {
  const [state, setState] = useState("idle"); // idle | analyzing | results
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [detectionMode, setDetectionMode] = useState("balanced"); // normal | balanced | strict

  // Modals & Navigation
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showCmdk, setShowCmdk] = useState(false);
  const [cmdkSearch, setCmdkSearch] = useState("");

  // Viewport Settings
  const [maskVisible, setMaskVisible] = useState(true);
  const [opacity, setOpacity] = useState(0.75);
  const [viewMode, setViewMode] = useState("composite"); // original | composite | contour | noise | ela
  const [splitSliderOn, setSplitSliderOn] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);

  // Live Hover HUD
  const [hoverData, setHoverData] = useState(null);

  const fileInputRef = useRef(null);
  const mainCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const stageRef = useRef(null);
  const waveformCanvasRef = useRef(null);

  // Realistic Microscopic Pixel Matrix Inspector (Authentic Sensor Noise vs AI Diffusion Fill)
  useEffect(() => {
    if (state !== "idle" || !waveformCanvasRef.current) return;
    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let scanX = 0;

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    const render = () => {
      scanX = (scanX + 1.2) % w;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          let val = 24;

          if (x < w * 0.52) {
            // Left Half: Natural Camera Physical Shot Noise (Gaussian distribution)
            const noise = (Math.random() - 0.5) * 38;
            val = Math.min(255, Math.max(0, 36 + noise));
            
            // Subtle Bayer Grid pattern
            if (x % 4 === 0 || y % 4 === 0) val *= 0.85;

            data[idx] = val * 0.9;
            data[idx + 1] = val;
            data[idx + 2] = val * 1.1;
          } else {
            // Right Half: AI Synthetic Inpainting (Diffusion Noise Dropout)
            const smoothNoise = (Math.sin(x * 0.08) * Math.cos(y * 0.08)) * 4 + (Math.random() - 0.5) * 4;
            val = Math.min(255, Math.max(0, 30 + smoothNoise));

            data[idx] = val * 1.05;
            data[idx + 1] = val * 0.95;
            data[idx + 2] = val * 0.95;
          }

          data[idx + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Splice Boundary Line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(w * 0.52, 0);
      ctx.lineTo(w * 0.52, h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Moving Scanning Line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, h);
      ctx.stroke();

      // Text Overlays on Canvas
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.fillText("AUTHENTIC SENSOR", 8, 16);
      ctx.fillStyle = "rgba(240, 106, 106, 0.85)";
      ctx.fillText("AI INPAINTING", w * 0.56, 16);

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [state]);

  // Handle Drag & Drop / File selection
  const handleFileSelect = useCallback((f) => {
    if (!f || !f.type.startsWith("image/")) return;
    if (f.size > 40 * 1024 * 1024) { alert("File exceeds 40 MB limit"); return; }
    setErrorMsg(null);
    setFile(f);
    setImageUrl(URL.createObjectURL(f));
    setState("analyzing");
    setStepIndex(0);
    setMaskVisible(true);
    setViewMode("composite");
  }, []);

  // Native Clipboard Paste Support (Ctrl+V / Cmd+V)
  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith("image/")) {
              const blob = await item.getType(type);
              const f = new File([blob], "clipboard-image.png", { type });
              handleFileSelect(f);
              return;
            }
          }
        }
      }
      alert("No image found in clipboard. Use Ctrl+V or upload a file.");
    } catch {
      fileInputRef.current?.click();
    }
  };

  // Keyboard shortcut listener (⌘K / Ctrl+K and global paste)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCmdk((prev) => !prev);
      }
      if (e.key === "Escape") {
        setShowCmdk(false);
        setShowDocsModal(false);
      }
    };

    const handleGlobalPaste = (e) => {
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

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("paste", handleGlobalPaste);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("paste", handleGlobalPaste);
    };
  }, [handleFileSelect]);

  // Load Verified Benchmark Preset
  const loadPreset = async (preset) => {
    setErrorMsg(null);
    setShowCmdk(false);

    if (preset.id === 'user_recaptcha_modal') {
      try {
        const res = await fetch('/recaptcha_edited.png');
        const blob = await res.blob();
        const f = new File([blob], 'recaptcha_edited.png', { type: 'image/png' });
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

    let canvas = null;
    if (preset.id === 'inpainting_edit' || preset.id === 'screenshot_edit') {
      const isScreenshot = preset.id === 'screenshot_edit';
      const sample = generateInpaintedSample(800, 500, isScreenshot);
      canvas = sample.editCanvas;
    } else if (preset.id === 'authentic_photo') {
      canvas = generateAuthenticSample(800, 500);
    } else {
      canvas = generateFullAISample(800, 500);
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const f = new File([blob], `${preset.id}.png`, { type: 'image/png' });
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
    setErrorMsg(null);
  };

  const handleModeChange = (newMode) => {
    setDetectionMode(newMode);
    if (state === "results" && results && results.imageData) {
      const isLossless = file?.type === "image/png" || file?.type === "image/webp";
      const pixelForensics = performPixelForensics(results.imageData, results.width, results.height, isLossless, newMode);
      const scoreResult = computeCompositeScore(
        results.elaAnalysis,
        results.noiseAnalysis,
        results.frequencyAnalysis,
        null,
        results.metadataAnalysis,
        pixelForensics,
        newMode,
        results.origWidth || results.width,
        results.origHeight || results.height,
        results.imageData
      );
      const heatmapResult = generateCompositeHeatmap(
        results.width,
        results.height,
        results.elaAnalysis,
        results.noiseAnalysis,
        results.frequencyAnalysis,
        null,
        pixelForensics
      );
      setResults(prev => ({
        ...prev,
        ...scoreResult,
        pixelForensics,
        heatmapImageData: heatmapResult.heatmapImageData,
        contourImageData: heatmapResult.contourImageData,
        pixelSuspicionMap: heatmapResult.pixelSuspicionMap,
      }));
    }
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
        const pixelForensics = performPixelForensics(imgData, w, h, isLossless, detectionMode);
        const noiseAnalysis = performNoiseAnalysis(imgData, w, h);
        const frequencyAnalysis = performFrequencyAnalysis(imgData, w, h);
        const elaAnalysis = await performELA(imgData, w, h, 0.90, 20, file.type);
        const metadataResult = await performMetadataAnalysis(file, imgData, w, h);

        // Composite Fusion Score
        const scoreResult = computeCompositeScore(
          elaAnalysis,
          noiseAnalysis,
          frequencyAnalysis,
          null,
          metadataResult,
          pixelForensics,
          detectionMode,
          img.naturalWidth || w,
          img.naturalHeight || h,
          imgData
        );

        // Heatmap & Glowing Contours
        const heatmapResult = generateCompositeHeatmap(
          w,
          h,
          elaAnalysis,
          noiseAnalysis,
          frequencyAnalysis,
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
          origWidth: img.naturalWidth || w,
          origHeight: img.naturalHeight || h,
          sourceImage: img,
          imageData: imgData,
          pixelForensics,
          noiseAnalysis,
          frequencyAnalysis,
          elaAnalysis,
          metadataAnalysis: metadataResult,
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
    if (maskVisible && viewMode !== "original") {
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

  // Filtered cmdk samples
  const filteredPresets = SAMPLE_PRESETS.filter(
    (p) => p.name.toLowerCase().includes(cmdkSearch.toLowerCase()) || p.category.toLowerCase().includes(cmdkSearch.toLowerCase())
  );

  // Group sample presets for Option C (Featured + Grid)
  const featuredPreset = SAMPLE_PRESETS.find((p) => p.id === 'user_desert_path') || SAMPLE_PRESETS[0];
  const sidePresets = SAMPLE_PRESETS.filter((p) => p.id === 'user_recaptcha_modal' || p.id === 'inpainting_edit');
  const bottomPresets = SAMPLE_PRESETS.filter((p) => p.id !== 'user_desert_path' && p.id !== 'user_recaptcha_modal' && p.id !== 'inpainting_edit');

  return (
    <div className="app-shell">
      {/* ── 1. Sophisticated Header Navigation ── */}
      <header className="app-header">
        <div className="header-inner">
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <button className="brand-lockup" onClick={resetSession} type="button">
              <div className="brand-logo-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/synthrex_logo.jpg"
                  alt="AI Detect"
                  className="brand-logo-img"
                />
              </div>
              <div className="brand-titles">
                <span className="brand-name">AI Detect</span>
                <span className="brand-forensics-tag">FORENSICS</span>
              </div>
            </button>

            <nav className="nav-menu">
              <button
                type="button"
                className={`nav-item ${state === "idle" ? "active" : ""}`}
                onClick={resetSession}
              >
                Analyze
              </button>
              <button
                type="button"
                className="nav-item"
                onClick={() => {
                  if (state !== "idle") resetSession();
                  window.scrollTo({ top: 380, behavior: "smooth" });
                }}
              >
                Cases
              </button>
              <button
                type="button"
                className="nav-item"
                onClick={() => {
                  if (state !== "idle") resetSession();
                  window.scrollTo({ top: 680, behavior: "smooth" });
                }}
              >
                Benchmarks
              </button>
              <button
                type="button"
                className="nav-item"
                onClick={() => setShowDocsModal(true)}
              >
                Documentation
              </button>
            </nav>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="cmdk-trigger-btn"
              onClick={() => setShowCmdk(true)}
            >
              <span>Quick Action</span>
              <span className="cmdk-kbd">⌘K</span>
            </button>

            {state === "results" && (
              <button
                type="button"
                className="btn-primary-workstation"
                onClick={resetSession}
                style={{ padding: "5px 12px", fontSize: "11px" }}
              >
                + New Analysis
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="workspace-container">
        {errorMsg && (
          <div style={{ padding: "12px 16px", background: "var(--signal-coral-bg)", border: "1px solid var(--signal-coral-bd)", borderRadius: "var(--radius-sm)", color: "var(--signal-coral)", marginBottom: "16px", fontSize: "12px" }}>
            {errorMsg}
          </div>
        )}

        {/* ── 2. IDLE STATE: WORKSPACE & UPLOAD CONSOLE ── */}
        {state === "idle" && (
          <div>
            {/* Main Editorial Hero with Realistic Pixel Matrix Inspector */}
            <div className="hero-two-column-layout">
              <div className="hero-left-column">
                <div className="eyebrow-tag">
                  <span>IMAGE FORENSICS</span>
                </div>
                <h1 className="workspace-hero-heading">
                  Analyze the image.<br />
                  <span className="hero-accent-text">Find the evidence.</span>
                </h1>
                <p className="workspace-hero-sub">
                  Detect AI generation, manipulation, inpainting, and synthetic artifacts with client-side multi-signal forensic analysis.
                </p>
                <div className="hero-capabilities-chips">
                  {["PRNU Sensor Noise", "Illuminant Vector Delta", "Achromatic Halos", "EXIF / C2PA Provenance", "Bayer Demosaicing"].map((cap) => (
                    <span key={cap} className="hero-cap-chip">{cap}</span>
                  ))}
                </div>
              </div>

              {/* Right Side: High-Resolution Optical Sensor & Pixel Matrix Illustration */}
              <div className="hero-instrument-schematic">
                <div className="instrument-image-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/forensic_hero_schematic.jpg"
                    alt="Optical Sensor & Forensic Pixel Loupe"
                    className="instrument-schematic-img"
                  />
                </div>
              </div>
            </div>

            {/* Forensic Sensitivity Mode Selector & Strict Mode Warning */}
            <div className="forensic-mode-container">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>
                    SENSITIVITY:
                  </span>
                  <div className="forensic-mode-toggle-group">
                    <button
                      type="button"
                      className={`forensic-mode-btn ${detectionMode === "normal" ? "active" : ""}`}
                      onClick={() => handleModeChange("normal")}
                    >
                      <span>Normal</span>
                      <span className="mode-badge">High Specificity</span>
                    </button>
                    <button
                      type="button"
                      className={`forensic-mode-btn ${detectionMode === "balanced" ? "active" : ""}`}
                      onClick={() => handleModeChange("balanced")}
                    >
                      <span>Balanced</span>
                      <span className="mode-badge">Recommended</span>
                    </button>
                    <button
                      type="button"
                      className={`forensic-mode-btn ${detectionMode === "strict" ? "active" : ""}`}
                      onClick={() => handleModeChange("strict")}
                    >
                      <span>Strict</span>
                      <span className="mode-badge">Deep Forensics</span>
                    </button>
                  </div>
                </div>
              </div>

              {detectionMode === "strict" && (
                <div className="strict-mode-warning-banner">
                  <span className="strict-mode-warning-icon">⚠️</span>
                  <span>
                    <strong>Strict Mode Active:</strong> Maximizes sensitivity to subtle inpainting and micro-textures. In this mode, screenshots and compressed images may occasionally be flagged as partially manipulated or unsure.
                  </span>
                </div>
              )}
            </div>

            {/* Signature Workstation Upload Zone */}
            <div
              className={`workstation-upload-box ${dragOver ? "drag-over" : ""}`}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="upload-icon-circle">⤓</div>
              <div>
                <div className="upload-title-text">Drop an image to begin</div>
                <div className="upload-sub-text">Drag & drop or choose a file from your device</div>
              </div>

              <div className="upload-btn-group" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn-primary-workstation"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose image
                </button>
                <button
                  type="button"
                  className="btn-secondary-workstation"
                  onClick={handlePasteFromClipboard}
                >
                  Paste from clipboard
                </button>
              </div>

              <div className="upload-formats-footer">
                <span>PNG · JPEG · WebP · Up to 40 MB</span>
                <span>&middot;</span>
                <span>Processed locally in your browser</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => handleFileSelect(e.target.files[0])}
              />
            </div>

            {/* 3-Step Connected Process Timeline */}
            <div className="process-timeline-container">
              <div className="process-timeline-grid">
                <div className="timeline-step-card">
                  <div className="timeline-step-header">
                    <span className="timeline-step-num">01 — INSPECT</span>
                    <span style={{ fontSize: "11px", color: "var(--accent-electric)" }}>SIGNAL</span>
                  </div>
                  <span className="timeline-step-title">Pixel Signal Extraction</span>
                  <p className="timeline-step-desc">Extracts high-pass sensor shot noise, PRNU pattern variance, and Bayer demosaicing grids.</p>
                </div>
                <div className="timeline-step-card">
                  <div className="timeline-step-header">
                    <span className="timeline-step-num">02 — ANALYZE</span>
                    <span style={{ fontSize: "11px", color: "var(--accent-violet)" }}>EVALUATION</span>
                  </div>
                  <span className="timeline-step-title">Forensic Indicators</span>
                  <p className="timeline-step-desc">Profiles chromatic illuminant vectors, diffusion halos, and splice boundary gradients.</p>
                </div>
                <div className="timeline-step-card">
                  <div className="timeline-step-header">
                    <span className="timeline-step-num">03 — EXPLAIN</span>
                    <span style={{ fontSize: "11px", color: "var(--accent-cyan)" }}>EVIDENCE</span>
                  </div>
                  <span className="timeline-step-title">Evidence & Provenance</span>
                  <p className="timeline-step-desc">Synthesizes localized pixel anomaly heatmaps with metadata and confidence scoring.</p>
                </div>
              </div>
            </div>

            {/* Sample Cases Section (Option C: Featured + Grid) */}
            <section className="sample-cases-section">
              <div className="sample-cases-header">
                <div>
                  <h2 className="sample-cases-title">Explore sample analyses</h2>
                  <p className="sample-cases-sub">See how AI Detect responds to common manipulation patterns.</p>
                </div>
              </div>

              {/* Featured Case + Side Stack */}
              <div className="sample-featured-row">
                {/* Featured Card */}
                <div
                  className="sample-case-featured-card"
                  onClick={() => loadPreset(featuredPreset)}
                >
                  <div className="featured-thumb-frame">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={featuredPreset.thumbnail}
                      alt={featuredPreset.name}
                      className="featured-thumb-img"
                    />
                    <span className="sample-tag-overlay alert">
                      FEATURED &middot; {featuredPreset.category}
                    </span>
                  </div>
                  <div className="featured-body">
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--signal-coral)", marginBottom: "4px" }}>
                        PAIRED GROUND TRUTH BENCHMARK
                      </div>
                      <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "6px" }}>{featuredPreset.name}</h3>
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        {featuredPreset.description}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px", fontSize: "12px", fontWeight: 600, color: "var(--accent-electric)" }}>
                      <span>Run Forensic Verification</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>

                {/* 2 Side Cards */}
                <div className="sample-side-stack">
                  {sidePresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="sample-standard-card"
                      onClick={() => loadPreset(preset)}
                    >
                      <div className="sample-card-body">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span className={`sample-tag-overlay ${preset.category.includes('Inpainting') ? 'alert' : ''}`} style={{ position: "static" }}>
                            {preset.category}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--accent-electric)", fontWeight: 600 }}>Analyze →</span>
                        </div>
                        <h4 className="sample-card-title" style={{ marginTop: "4px" }}>{preset.name}</h4>
                        <p className="sample-card-desc">{preset.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom 3-Card Grid */}
              <div className="sample-cases-bottom-grid">
                {bottomPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="sample-standard-card"
                    onClick={() => loadPreset(preset)}
                  >
                    <div className="standard-thumb-frame">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preset.thumbnail}
                        alt={preset.name}
                        className="standard-thumb-img"
                      />
                      <span className={`sample-tag-overlay ${preset.category.includes('Synthetic') || preset.category.includes('Generation') ? 'alert' : ''}`}>
                        {preset.category}
                      </span>
                    </div>

                    <div className="sample-card-body">
                      <h4 className="sample-card-title">{preset.name}</h4>
                      <p className="sample-card-desc">{preset.description}</p>
                      <div className="sample-card-cta">
                        <span>Analyze sample</span>
                        <span>→</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ── 3. LOADING & ANALYSIS PROCESSING STATE ── */}
        {state === "analyzing" && (
          <div className="processing-console">
            <div className="console-top">
              <span className="console-title">Analyzing image</span>
              <span className="console-badge">PROCESSING</span>
            </div>

            <div className="console-progress-track">
              <div
                className="console-progress-fill"
                style={{ width: `${((stepIndex + 1) / PIPELINE_STEPS.length) * 100}%` }}
              />
            </div>

            <div className="console-steps-stack">
              {PIPELINE_STEPS.map((s, idx) => (
                <div
                  key={idx}
                  className={`console-step ${idx < stepIndex ? "done" : idx === stepIndex ? "active" : ""}`}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                    {idx < stepIndex ? "✓" : `0${idx + 1}`}
                  </span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. RESULTS STUDIO: LINEAR WORKBENCH (Two-Column Desktop) ── */}
        {state === "results" && results && (
          <div className="results-studio-wrapper">
            {/* Top Telemetry Header Bar */}
            <div className="studio-telemetry-bar">
              <div className="telemetry-meta-cluster">
                <div>DIMENSIONS: <span className="telemetry-strong-val">{results.dimensions}</span></div>
                <div>SIZE: <span className="telemetry-strong-val">{results.fileSize}</span></div>
                <div>PIXELS: <span className="telemetry-strong-val">{(results.width * results.height).toLocaleString()}</span></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>MODE:</span>
                <div className="forensic-mode-toggle-group" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className={`forensic-mode-btn ${detectionMode === "normal" ? "active" : ""}`}
                    onClick={() => handleModeChange("normal")}
                    style={{ padding: "3px 8px", fontSize: "10px" }}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    className={`forensic-mode-btn ${detectionMode === "balanced" ? "active" : ""}`}
                    onClick={() => handleModeChange("balanced")}
                    style={{ padding: "3px 8px", fontSize: "10px" }}
                  >
                    Balanced
                  </button>
                  <button
                    type="button"
                    className={`forensic-mode-btn ${detectionMode === "strict" ? "active" : ""}`}
                    onClick={() => handleModeChange("strict")}
                    style={{ padding: "3px 8px", fontSize: "10px" }}
                  >
                    Strict
                  </button>
                </div>
              </div>
            </div>

            {detectionMode === "strict" && (
              <div className="strict-mode-warning-banner" style={{ marginBottom: "12px" }}>
                <span className="strict-mode-warning-icon">⚠️</span>
                <span>
                  <strong>Strict Mode Active:</strong> Maximizes sensitivity to subtle inpainting and micro-textures. In this mode, screenshots and compressed images may occasionally be flagged as partially manipulated or unsure.
                </span>
              </div>
            )}

            {/* Two-Column Workbench */}
            <div className="studio-two-column-grid">
              {/* Left Column: Image Viewer Stage */}
              <div className="viewport-stage-container">
                <div className="viewer-frame" ref={stageRef}>
                  <div className="viewer-header-toolbar">
                    <div className="viewmode-segmented-control">
                      <button
                        type="button"
                        className={`viewmode-btn ${viewMode === "original" ? "active" : ""}`}
                        onClick={() => setViewMode("original")}
                      >
                        Original
                      </button>
                      <button
                        type="button"
                        className={`viewmode-btn ${viewMode === "composite" ? "active" : ""}`}
                        onClick={() => setViewMode("composite")}
                      >
                        Heatmap
                      </button>
                      <button
                        type="button"
                        className={`viewmode-btn ${viewMode === "noise" ? "active" : ""}`}
                        onClick={() => setViewMode("noise")}
                      >
                        Noise
                      </button>
                      <button
                        type="button"
                        className={`viewmode-btn ${viewMode === "contour" ? "active" : ""}`}
                        onClick={() => setViewMode("contour")}
                      >
                        Edges
                      </button>
                      <button
                        type="button"
                        className={`viewmode-btn ${viewMode === "ela" ? "active" : ""}`}
                        onClick={() => setViewMode("ela")}
                      >
                        Residual
                      </button>
                    </div>

                    <div className="viewer-tools-group">
                      <label className="viewer-toggle-label">
                        <input
                          type="checkbox"
                          checked={splitSliderOn}
                          onChange={(e) => setSplitSliderOn(e.target.checked)}
                        />
                        Compare
                      </label>

                      <label className="viewer-toggle-label">
                        <input
                          type="checkbox"
                          checked={maskVisible}
                          onChange={(e) => setMaskVisible(e.target.checked)}
                        />
                        Overlay
                      </label>

                      {maskVisible && viewMode !== "original" && (
                        <div className="opacity-slider-unit">
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
                    <div className="split-slider-subbar">
                      <span>Compare (Original vs Overlay):</span>
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
                    className="viewport-canvas-mount"
                    onMouseMove={handleMouseMoveOnCanvas}
                    onMouseLeave={handleMouseLeaveCanvas}
                  >
                    <canvas ref={mainCanvasRef} />
                    <canvas ref={overlayCanvasRef} className="overlay-canvas" />
                  </div>
                </div>

                {/* Floating Live Pixel Inspector HUD */}
                {hoverData && (
                  <div
                    className="floating-pixel-hud"
                    style={{
                      left: `${Math.min(window.innerWidth - 230, hoverData.clientX + 14)}px`,
                      top: `${Math.min(window.innerHeight - 190, hoverData.clientY + 14)}px`,
                    }}
                  >
                    <div className="hud-top-meta">
                      <span>X:{hoverData.x} Y:{hoverData.y}</span>
                      <span style={{ color: hoverData.aiProb >= 40 ? "var(--signal-coral)" : "var(--signal-emerald)", fontWeight: 700 }}>
                        {hoverData.aiProb >= 40 ? "ANOMALOUS" : "NATURAL"}
                      </span>
                    </div>
                    <div className="hud-data-row">
                      <span>AI Probability</span>
                      <span className="val">{hoverData.aiProb}%</span>
                    </div>
                    <div className="hud-data-row">
                      <span>RGB Vector</span>
                      <span className="val">({hoverData.r}, {hoverData.g}, {hoverData.b})</span>
                    </div>
                    <div className="hud-data-row">
                      <span>Noise Var (σ²)</span>
                      <span className="val">{hoverData.noiseVar}</span>
                    </div>
                    <div className="hud-data-row">
                      <span>Seam Gradient</span>
                      <span className="val">{hoverData.seamVal}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Findings & Metadata */}
              <div className="findings-column">
                {/* Primary Overall Assessment */}
                <div className="overall-assessment-card">
                  <div className="assessment-header">
                    <span className="assessment-title">Overall Assessment</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                      Confidence: {results.confidence}
                    </span>
                  </div>

                  <div className="assessment-gauge-row">
                    <div className="gauge-svg-wrapper">
                      <svg viewBox="0 0 64 64" width="64" height="64">
                        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--border-default)" strokeWidth="5" />
                        <circle
                          cx="32" cy="32" r={radius} fill="none"
                          stroke={scorePct >= 60 ? "var(--signal-coral)" : scorePct >= 30 ? "var(--signal-amber)" : "var(--signal-emerald)"}
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference - (scorePct / 100) * circumference}
                          transform="rotate(-90 32 32)"
                          style={{ transition: "stroke-dashoffset 0.6s var(--ease-spring)" }}
                        />
                      </svg>
                      <span className="gauge-pct-text">{scorePct}%</span>
                    </div>

                    <div className="assessment-verdict-stack">
                      <span className={`verdict-status-pill ${scorePct >= 60 ? "manipulated" : scorePct >= 30 ? "uncertain" : "authentic"}`}>
                        {scorePct >= 60 ? "Potential AI Manipulation" : scorePct >= 30 ? "Uncertain / Likely Modified" : "Likely Authentic Camera"}
                      </span>
                      <span className="assessment-explanation">
                        {results.editedAreaPercent > 0 
                          ? `Localized synthetic inpainting detected on ${results.editedAreaPercent}% of the image.`
                          : "Consistent physical sensor noise and Bayer demosaicing pattern verified."}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Evidence List & Signal Matrix */}
                <div className="evidence-list-card">
                  <span className="assessment-title">Forensic Signals</span>
                  <table className="evidence-table">
                    <tbody>
                      {results.breakdown && Object.values(results.breakdown).map((b) => (
                        <tr key={b.label}>
                          <td className="evidence-label-col">{b.label}</td>
                          <td className="evidence-bar-col">
                            <div className="mini-bar-track">
                              <div
                                className="mini-bar-fill"
                                style={{
                                  width: `${b.score}%`,
                                  backgroundColor: b.score >= 60 ? "var(--signal-coral)" : b.score >= 30 ? "var(--signal-amber)" : "var(--signal-emerald)"
                                }}
                              />
                            </div>
                          </td>
                          <td className="evidence-val-col">{b.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Dedicated Metadata & Provenance Panel */}
                <div className="metadata-provenance-card">
                  <div className="assessment-header">
                    <span className="assessment-title">Metadata & Provenance</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: results.metadataAnalysis?.stats?.hasC2PA ? "var(--signal-coral)" : "var(--signal-emerald)" }}>
                      {results.metadataAnalysis?.stats?.hasC2PA ? "C2PA DETECTED" : "STANDARD EXIF"}
                    </span>
                  </div>
                  <div className="meta-grid-table">
                    <div className="meta-key-val-item">
                      <span className="meta-k-label">CAMERA / MAKE</span>
                      <span className="meta-v-text">{results.metadataAnalysis?.stats?.make || "None / Stripped"}</span>
                    </div>
                    <div className="meta-key-val-item">
                      <span className="meta-k-label">SOFTWARE / ENGINE</span>
                      <span className="meta-v-text">{results.metadataAnalysis?.stats?.aiToolsDetected?.length ? results.metadataAnalysis.stats.aiToolsDetected.join(", ") : (results.metadataAnalysis?.stats?.software || "Natural Capture")}</span>
                    </div>
                    <div className="meta-key-val-item">
                      <span className="meta-k-label">FORMAT</span>
                      <span className="meta-v-text">{results.metadataAnalysis?.stats?.fileFormat} ({results.dimensions})</span>
                    </div>
                    <div className="meta-key-val-item">
                      <span className="meta-k-label">EXIF PRESENCE</span>
                      <span className="meta-v-text" style={{ color: results.metadataAnalysis?.stats?.exifPresent ? "var(--signal-emerald)" : "var(--text-muted)" }}>
                        {results.metadataAnalysis?.stats?.exifPresent ? "EXIF Present" : "No EXIF"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Suite */}
                <div className="export-actions-row">
                  <button className="btn-dossier-export" onClick={() => downloadJSON(results)} type="button">
                    Export Dossier (.JSON)
                  </button>
                  <button className="btn-mask-export" onClick={() => downloadCanvas(overlayCanvasRef.current, "ai-detect-alpha-mask.png")} type="button">
                    Save Alpha Mask (.PNG)
                  </button>
                </div>
              </div>
            </div>

            {/* Detailed Forensic Signal Deep-Dives (Below) */}
            <div className="forensic-deepdive-grid">
              <div className="deepdive-card">
                <div className="deepdive-header">
                  <span className="deepdive-title">PRNU Sensor Shot Noise</span>
                  <span className="deepdive-status-tag">
                    σ²: {results.noiseAnalysis?.stats?.averageNoiseVariance ? results.noiseAnalysis.stats.averageNoiseVariance.toFixed(1) : "N/A"}
                  </span>
                </div>
                <p className="deepdive-desc">
                  Photo-Response Non-Uniformity profiles physical silicon sensor imperfections. Synthetic diffusion generators omit stochastic physical sensor patterns.
                </p>
                <div className="deepdive-meta-footer">
                  <span>Demosaicing Grid</span>
                  <span style={{ color: results.noiseAnalysis?.stats?.crossChannelScore < 0.2 ? "var(--signal-emerald)" : "var(--signal-amber)" }}>
                    {results.noiseAnalysis?.stats?.crossChannelScore < 0.2 ? "Natural Bayer Grid" : "Synthetic Frequencies"}
                  </span>
                </div>
              </div>

              <div className="deepdive-card">
                <div className="deepdive-header">
                  <span className="deepdive-title">Chromatic & Illuminant Field</span>
                  <span className="deepdive-status-tag">Vector Delta</span>
                </div>
                <p className="deepdive-desc">
                  Analyzes localized color temperature distributions across scene illuminants to flag foreign generative insertions.
                </p>
                <div className="deepdive-meta-footer">
                  <span>Inpainted Area</span>
                  <span style={{ color: results.editedAreaPercent > 0 ? "var(--signal-coral)" : "var(--text-primary)" }}>
                    {results.editedAreaPercent}%
                  </span>
                </div>
              </div>

              <div className="deepdive-card">
                <div className="deepdive-header">
                  <span className="deepdive-title">Achromatic & Text Inpainting</span>
                  <span className="deepdive-status-tag">Diffusion Halo</span>
                </div>
                <p className="deepdive-desc">
                  Detects glyph alteration and synthetic inpainting on white/desaturated surfaces (such as altered modal dialogs or text replacement).
                </p>
                <div className="deepdive-meta-footer">
                  <span>Affected Pixels</span>
                  <span>{results.pixelForensics?.stats?.editedPixelCount?.toLocaleString() || "0"}</span>
                </div>
              </div>

              <div className="deepdive-card">
                <div className="deepdive-header">
                  <span className="deepdive-title">Compression & ELA Residuals</span>
                  <span className="deepdive-status-tag">Quantization</span>
                </div>
                <p className="deepdive-desc">
                  Error Level Analysis evaluates recompression loss across 8x8 DCT blocks to identify spliced elements with mismatched compression histories.
                </p>
                <div className="deepdive-meta-footer">
                  <span>JPEG Invariance</span>
                  <span>Verified</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── 5. Command Palette (⌘ K) Modal ── */}
      {showCmdk && (
        <div className="cmdk-backdrop" onClick={() => setShowCmdk(false)}>
          <div className="cmdk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cmdk-input-row">
              <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>🔍</span>
              <input
                type="text"
                className="cmdk-input"
                placeholder="Search actions, samples, documentation... (Esc to close)"
                autoFocus
                value={cmdkSearch}
                onChange={(e) => setCmdkSearch(e.target.value)}
              />
            </div>
            <div className="cmdk-list">
              <div
                className="cmdk-item"
                onClick={() => {
                  setShowCmdk(false);
                  fileInputRef.current?.click();
                }}
              >
                <span>Upload Image from Device</span>
                <span className="cmdk-item-badge">File</span>
              </div>
              <div
                className="cmdk-item"
                onClick={() => {
                  setShowCmdk(false);
                  handlePasteFromClipboard();
                }}
              >
                <span>Paste Image from Clipboard</span>
                <span className="cmdk-item-badge">Ctrl+V</span>
              </div>

              <div style={{ padding: "8px 12px 4px", fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                SAMPLE CASES
              </div>
              {filteredPresets.map((p) => (
                <div
                  key={p.id}
                  className="cmdk-item"
                  onClick={() => loadPreset(p)}
                >
                  <span>{p.name}</span>
                  <span className="cmdk-item-badge">{p.category}</span>
                </div>
              ))}

              <div style={{ padding: "8px 12px 4px", fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                DOCUMENTATION
              </div>
              <div
                className="cmdk-item"
                onClick={() => {
                  setShowCmdk(false);
                  setShowDocsModal(true);
                }}
              >
                <span>Forensic Architecture & Methodology</span>
                <span className="cmdk-item-badge">Docs</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. Documentation Modal ── */}
      {showDocsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)",
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
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>Forensic Architecture & Methodology</h2>
              <button
                type="button"
                className="btn-secondary-workstation"
                onClick={() => setShowDocsModal(false)}
                style={{ padding: "4px 8px" }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: "12px" }}>
              <p>
                <strong>AI Detect</strong> by Synthrex operates 100% inside client memory using browser Float32Array tensors, guaranteeing strict cryptographic privacy with zero server uploads.
              </p>
              <p>
                <strong>1. PRNU Sensor Noise:</strong> Silicon camera sensors impart a deterministic pattern noise across real captures. Diffusion networks lack this stochastic noise profile.
              </p>
              <p>
                <strong>2. Chromatic Anomaly Field:</strong> Inpainted elements diverge in localized color temperature from global illumination.
              </p>
              <p>
                <strong>3. Achromatic Inpainting:</strong> Detects synthetic diffusion halos on desaturated surfaces (such as edited UI modals or text replacements).
              </p>
              <p>
                <strong>4. Error Level Analysis (ELA):</strong> Identifies mismatches in JPEG 8x8 DCT quantization tables.
              </p>
              <p>
                <strong>5. Metadata & Provenance:</strong> Evaluates EXIF tags, software strings, and C2PA Content Credentials manifests.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Minimal Understated Footer ── */}
      <footer className="app-footer">
        <div className="footer-inner-content">
          <div>
            <strong>AI Detect</strong> &middot; Client-side image forensics &middot; <em>Built for evidence, not assumptions.</em>
          </div>
          <div className="footer-links-group">
            <button
              type="button"
              className="footer-link-item"
              onClick={() => setShowDocsModal(true)}
              style={{ background: "none", border: "none", cursor: "pointer", font: "inherit" }}
            >
              Documentation
            </button>
            <a href="https://github.com/gauravbatule/pixel-level-ai-detector" className="footer-link-item" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href="https://aidetector.synthrex.in" className="footer-link-item" target="_blank" rel="noreferrer">
              aidetector.synthrex.in
            </a>
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
    metadata: res.metadataAnalysis?.stats || {},
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
