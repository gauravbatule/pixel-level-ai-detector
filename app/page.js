"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { performELA } from "../lib/analysis/ela";
import { performNoiseAnalysis } from "../lib/analysis/noise";
import { performFrequencyAnalysis } from "../lib/analysis/frequency";
import { performCloneDetection } from "../lib/analysis/clone";
import { performMetadataAnalysis } from "../lib/analysis/metadata";
import { computeCompositeScore, generateCompositeHeatmap } from "../lib/analysis/scoring";

const STEPS = [
  "Error Level Analysis",
  "Noise Patterns",
  "Frequency Domain",
  "Clone Detection",
  "Metadata Scan",
  "Scoring",
];

export default function HomePage() {
  const [state, setState] = useState("idle");
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState(0);
  const [results, setResults] = useState(null);
  const [maskOn, setMaskOn] = useState(true);
  const [opacity, setOpacity] = useState(0.55);

  const inputRef = useRef(null);
  const mainRef = useRef(null);
  const overlayRef = useRef(null);

  const onFile = useCallback((f) => {
    if (!f || !f.type.startsWith("image/")) return;
    if (f.size > 20 * 1024 * 1024) { alert("Max 20 MB"); return; }
    setFile(f);
    setImageUrl(URL.createObjectURL(f));
    setState("analyzing");
    setStep(0);
    setMaskOn(true);
  }, []);

  const reset = () => {
    setState("idle"); setFile(null); setImageUrl(null);
    setResults(null); setStep(0); setMaskOn(true); setOpacity(0.55);
  };

  // Pipeline
  useEffect(() => {
    if (state !== "analyzing" || !imageUrl) return;
    let stop = false;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((r) => { img.onload = r; });
      let w = img.width, h = img.height;
      if (Math.max(w, h) > 1200) {
        const s = 1200 / Math.max(w, h);
        w = Math.round(w * s); h = Math.round(h * s);
      }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const cx = c.getContext("2d");
      cx.drawImage(img, 0, 0, w, h);
      const data = cx.getImageData(0, 0, w, h);
      if (stop) return;

      setStep(0); await wait(120);
      const ela = await performELA(data, w, h, 0.9, 20, file?.type);
      if (stop) return;

      setStep(1); await wait(60);
      const noise = performNoiseAnalysis(data, w, h);
      if (stop) return;

      setStep(2); await wait(60);
      const freq = performFrequencyAnalysis(data, w, h);
      if (stop) return;

      setStep(3); await wait(60);
      const clone = performCloneDetection(data, w, h);
      if (stop) return;

      setStep(4); await wait(60);
      const meta = await performMetadataAnalysis(file, data, w, h);
      if (stop) return;

      setStep(5); await wait(120);
      const score = computeCompositeScore(ela, noise, freq, clone, meta);
      const heatmap = generateCompositeHeatmap(w, h, ela, noise, freq, clone);
      if (stop) return;

      setResults({ width: w, height: h, imageData: data, ela, noise, freq, clone, meta, score, heatmap });
      setState("results");
    })();
    return () => { stop = true; };
  }, [state, imageUrl, file]);

  // Canvas draw
  useEffect(() => {
    if (!results) return;
    const mc = mainRef.current, oc = overlayRef.current;
    if (!mc || !oc) return;
    const { width: w, height: h } = results;
    mc.width = w; mc.height = h;
    oc.width = w; oc.height = h;
    mc.getContext("2d").putImageData(results.imageData, 0, 0);
    const ctx = oc.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    if (maskOn && results.heatmap) {
      const tmp = document.createElement("canvas");
      tmp.width = w; tmp.height = h;
      tmp.getContext("2d").putImageData(results.heatmap, 0, 0);
      ctx.globalAlpha = opacity;
      ctx.drawImage(tmp, 0, 0);
      ctx.globalAlpha = 1;
    }
  }, [results, maskOn, opacity]);

  const sc = results?.score;
  const pct = sc?.overallScore ?? 0;
  const circ = 2 * Math.PI * 40;

  return (
    <div className="shell">
      {/* Nav */}
      <nav className="nav">
        <button className="nav-logo" onClick={reset} type="button">
          AI Pixel Detector
        </button>
        <div className="nav-r">
          {state === "results" && (
            <button className="nav-btn" onClick={reset} type="button">New Analysis</button>
          )}
          <span className="nav-tag">Runs locally</span>
        </div>
      </nav>

      <main className="main">
        {/* ── IDLE ── */}
        {state === "idle" && (
          <div className="idle">
            <h1 className="title">Detect AI-edited pixels in any image</h1>
            <p className="desc">
              Upload a photo. Regions edited with AI are marked in
              <span className="cr"> red</span>, authentic areas in
              <span className="cg"> green</span>.
            </p>

            <div
              className={`drop ${dragOver ? "drop-on" : ""}`}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files[0]); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => inputRef.current?.click()}
            >
              <span className="drop-plus">+</span>
              <span className="drop-txt">Drop image here or click to browse</span>
              <span className="drop-sub">JPEG, PNG, WebP &middot; Max 20 MB</span>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files[0])} />
            </div>

            <div className="engines">
              {["Error Level", "Noise Analysis", "Frequency Domain", "Clone Detection", "Metadata + C2PA"].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── ANALYZING ── */}
        {state === "analyzing" && (
          <div className="scanning">
            <div className="scan-box">
              <p className="scan-title">Analyzing image...</p>
              <div className="scan-bar"><div className="scan-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
              <div className="scan-steps">
                {STEPS.map((s, i) => (
                  <div key={i} className={`scan-step ${i < step ? "done" : i === step ? "now" : ""}`}>
                    <span className="scan-num">{i < step ? "✓" : i + 1}</span>
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {state === "results" && results && (
          <div className="result">
            {/* Score row */}
            <div className={`score-row ${pct >= 65 ? "sr-red" : pct >= 35 ? "sr-amber" : "sr-green"}`}>
              <div className="ring-box">
                <svg viewBox="0 0 92 92" width="92" height="92">
                  <circle cx="46" cy="46" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                  <circle cx="46" cy="46" r="40" fill="none"
                    stroke={pct >= 65 ? "#ef4444" : pct >= 35 ? "#f59e0b" : "#22c55e"}
                    strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
                    transform="rotate(-90 46 46)" className="ring-arc" />
                </svg>
                <span className="ring-num">{pct}<small>%</small></span>
              </div>

              <div className="score-label">
                <span className={`verdict ${pct >= 65 ? "vr" : pct >= 35 ? "va" : "vg"}`}>
                  {pct >= 65 ? "Edited with AI" : pct >= 35 ? "Possibly AI-Modified" : "Likely Authentic"}
                </span>
                <span className="conf">Confidence: {sc.confidence}</span>
                {results.meta?.stats.aiToolsDetected?.length > 0 && (
                  <span className="tools-found">Detected: {results.meta.stats.aiToolsDetected.join(", ")}</span>
                )}
                {results.meta?.stats.hasC2PA && (
                  <span className="c2pa-found">C2PA provenance data found</span>
                )}
              </div>

              <div className="bars">
                {Object.values(sc.breakdown).map((b) => (
                  <div className="brow" key={b.label}>
                    <span className="blbl">{b.label}</span>
                    <div className="btrack"><div className={`bfill ${b.score >= 65 ? "bf-r" : b.score >= 35 ? "bf-a" : "bf-g"}`} style={{ width: `${b.score}%` }} /></div>
                    <span className="bval">{b.score}</span>
                  </div>
                ))}
              </div>

              <div className="score-btns">
                <button className="sbtn" onClick={() => exportJSON(results)} type="button">Export JSON</button>
                <button className="sbtn" onClick={() => saveOverlay(overlayRef.current)} type="button">Save Overlay</button>
              </div>
            </div>

            {/* Controls */}
            <div className="controls">
              <span className="leg"><span className="swatch sr" /> AI-Edited</span>
              <span className="leg"><span className="swatch sg" /> Authentic</span>

              <label className="tog">
                <input type="checkbox" checked={maskOn} onChange={(e) => setMaskOn(e.target.checked)} />
                <span className="tog-sw"><span className="tog-dot" /></span>
                AI Mask
              </label>

              {maskOn && (
                <span className="opa">
                  <input type="range" min="0" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(+e.target.value)} />
                  <span className="opa-v">{Math.round(opacity * 100)}%</span>
                </span>
              )}
            </div>

            {/* Image */}
            <div className="viewer">
              <div className="cv-wrap">
                <canvas ref={mainRef} />
                <canvas ref={overlayRef} className="cv-over" />
              </div>
            </div>

            {/* Metadata */}
            {results.meta?.findings?.length > 0 && (
              <details className="meta-card">
                <summary className="meta-sum">Metadata findings</summary>
                <div className="meta-info">
                  <span>{results.meta.stats.fileFormat}</span>
                  <span>{results.meta.stats.dimensions}</span>
                  <span>{(results.meta.stats.fileSize / 1024).toFixed(0)} KB</span>
                  <span>EXIF: {results.meta.stats.exifPresent ? "Yes" : "No"}</span>
                </div>
                <div className="meta-list">
                  {results.meta.findings.map((f, i) => (
                    <div key={i} className={`mf mf-${f.type}`}>{f.message}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </main>

      <footer className="foot">
        All analysis runs in your browser. No images are uploaded anywhere.
      </footer>
    </div>
  );
}

function exportJSON(r) {
  const d = {
    timestamp: new Date().toISOString(),
    score: r.score.overallScore,
    classification: r.score.classification,
    confidence: r.score.confidence,
    breakdown: r.score.breakdown,
    dimensions: `${r.width}x${r.height}`,
    metadata: r.meta?.stats,
  };
  const b = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
  dl(URL.createObjectURL(b), "ai-pixel-report.json");
}

function saveOverlay(c) {
  if (!c) return;
  dl(c.toDataURL("image/png"), "ai-pixel-overlay.png");
}

function dl(href, name) {
  const a = document.createElement("a");
  a.href = href; a.download = name; a.click();
  if (href.startsWith("blob:")) URL.revokeObjectURL(href);
}
