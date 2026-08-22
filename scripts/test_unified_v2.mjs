import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

globalThis.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

import { performPixelForensics } from '../lib/analysis/pixelForensics.js';
import { performNoiseAnalysis } from '../lib/analysis/noise.js';
import { performFrequencyAnalysis } from '../lib/analysis/frequency.js';

function computeCompositeScoreFull(elaResult, noiseResult, frequencyResult, cloneResult, metadataResult, pixelResult, mode = 'balanced') {
  const isLossless = elaResult?.stats?.isLosslessSource ?? false;

  // --- 1. Local Inpainting Pixel Forensics ---
  let pixelScore = 0;
  let editRatio = 0;
  let avgSusp = 0;
  const hasModal = pixelResult?.stats?.hasModalInpaint ?? false;

  if (pixelResult) {
    const s = pixelResult.stats;
    editRatio = s.editedAreaRatio;
    avgSusp = s.averageSuspicion;
    if (editRatio > (mode === 'strict' ? 0.02 : mode === 'normal' ? 0.04 : 0.03)) {
      pixelScore = Math.min(1.0, avgSusp * 2.5 + editRatio * 2.0);
      if (hasModal) pixelScore = Math.max(pixelScore, 0.75);
    } else {
      pixelScore = Math.min(0.20, avgSusp * 1.0);
    }
  }

  // --- 2. Global AI Synthesis Fingerprints ---
  let globalAIScore = 0;
  const bnc = noiseResult?.stats?.brightnessNoiseCorrelation ?? 0;
  const smoothRatio = noiseResult?.stats?.smoothRatio ?? 0;
  const crossCorr = noiseResult?.stats?.crossChannelScore ?? 0;
  const avgHF = frequencyResult?.stats?.averageHighFreqRatio ?? 0.2;
  const avgNoiseVar = noiseResult?.stats?.averageNoiseVariance ?? 0;

  // Camera check: authentic camera sensor noise produces physical Poisson shot noise (BNC < -0.08)
  const isCameraCapture = bnc < -0.08;

  // Digital screenshot / UI graphic check: flat UI colors or digital text
  // In screenshots, high smoothRatio is caused by UI solid rectangles, NOT AI diffusion!
  // Diffusion AI images have natural-looking scenes (varied colors) that are unnaturally smooth!
  const isNaturalScene = avgNoiseVar > 50;

  // Diffusion Metrics:
  // 1. High frequency deficiency in natural scenes
  const freqDeficiency = avgHF < 0.005 ? 1.0 : avgHF < 0.04 ? 0.85 : avgHF < 0.08 ? 0.60 : avgHF < 0.12 ? 0.20 : 0;
  
  // 2. High smooth ratio in complex scenes
  const smoothSignal = smoothRatio > 0.70 ? 0.90 : smoothRatio > 0.55 ? 0.60 : smoothRatio > 0.40 ? 0.25 : 0;

  // 3. Absence of camera photon shot noise
  const noShotNoise = bnc >= 0.0 ? 0.85 : bnc >= -0.05 ? 0.50 : 0;

  // 4. Correlated latent RGB noise
  const crossSignal = crossCorr >= 0.20 ? 0.85 : crossCorr >= 0.10 ? 0.50 : 0;

  // Combined Global AI Generation Confidence
  // Only trigger full AI synthesis for natural scenes without authentic camera photon noise
  if (!isCameraCapture && isNaturalScene) {
    const globalSignals = [freqDeficiency, smoothSignal, noShotNoise, crossSignal].filter(s => s > 0.5).length;
    if (globalSignals >= 3) {
      globalAIScore = Math.min(0.95, freqDeficiency * 0.40 + smoothSignal * 0.30 + noShotNoise * 0.20 + crossSignal * 0.10);
    } else if (globalSignals === 2 && (freqDeficiency > 0.7 || smoothSignal > 0.7)) {
      globalAIScore = Math.min(0.80, (freqDeficiency + smoothSignal + noShotNoise) / 3);
    }
  }

  // If authentic camera shot noise is present, suppress mild localized false positives
  if (isCameraCapture && editRatio < 0.12 && !hasModal) {
    pixelScore *= 0.20;
  }

  const isLocalInpainted = (editRatio > (mode === 'strict' ? 0.02 : 0.035) && pixelScore > 0.30) || pixelScore > 0.35;
  const isFullyAIGenerated = globalAIScore > 0.55;

  let finalScore = 0;
  let classification = '';
  let confidence = 'High';

  const metaScore = metadataResult ? metadataResult.stats.suspicionScore : 0;
  const hasDirectAI = metaScore > 0.6;

  if (hasDirectAI) {
    finalScore = Math.max(88, Math.round(metaScore * 100));
    classification = 'AI Generated (C2PA / Provenance)';
    confidence = 'High';
  } else if (isFullyAIGenerated) {
    finalScore = Math.min(96, Math.max(82, Math.round(globalAIScore * 100)));
    classification = 'AI Generated (Full Synthesis)';
    confidence = finalScore >= 90 ? 'Very High' : 'High';
  } else if (isLocalInpainted) {
    finalScore = Math.min(95, Math.max(75, Math.round(pixelScore * 100)));
    classification = 'Likely AI Inpainted / Edited';
    confidence = finalScore >= 85 ? 'High' : 'Medium';
  } else if (pixelScore > 0.16 || globalAIScore > 0.30) {
    finalScore = mode === 'strict' ? 24 : 15;
    classification = mode === 'strict' ? 'Unsure / Possible Edit (Strict)' : 'Inconclusive / Mild Noise';
    confidence = 'Low';
  } else {
    finalScore = Math.max(2, Math.min(6, Math.round(Math.max(pixelScore, globalAIScore) * 100)));
    classification = isCameraCapture ? 'Authentic Camera Capture' : 'Authentic Image / Capture';
    confidence = 'High';
  }

  const breakdown = {
    pixel: { score: Math.round(pixelScore * 100), label: 'Pixel Forensics & Inpainting' },
    noise: { score: Math.round(noiseResult ? (smoothRatio * 0.5 + Math.max(0, bnc) * 0.5) * 100 : 0), label: 'Noise Consistency' },
    frequency: { score: Math.round(freqDeficiency * 100), label: 'Frequency Spectral Analysis' },
    metadata: { score: Math.round(metaScore * 100), label: 'Provenance & C2PA' },
  };

  return {
    overallScore: finalScore,
    classification,
    confidence,
    breakdown,
    rawScore: finalScore,
    isEdited: isLocalInpainted || isFullyAIGenerated,
    editedAreaPercent: isFullyAIGenerated ? 100 : Math.round(editRatio * 1000) / 10,
  };
}

const ALL_CASES = [
  // 1. Fully AI Generated Images (No Metadata)
  {
    category: "FULL AI GENERATION",
    name: "AI Gen 1 (Jul 21)",
    path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 21, 2026, 10_48_58 AM.png",
    isAI: true
  },
  {
    category: "FULL AI GENERATION",
    name: "AI Gen 2 (Jul 27)",
    path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 27, 2026, 10_04_53 AM.png",
    isAI: true
  },
  {
    category: "FULL AI GENERATION",
    name: "AI Gen 3 (Jun 14)",
    path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 14, 2026, 10_53_14 PM.png",
    isAI: true
  },
  {
    category: "FULL AI GENERATION",
    name: "AI Gen 4 (Jun 15)",
    path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 15, 2026, 12_20_13 AM.png",
    isAI: true
  },
  {
    category: "FULL AI GENERATION",
    name: "AI Gen 5 (Jun 28)",
    path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 28, 2026, 02_50_17 PM.png",
    isAI: true
  },
  // 2. AI Inpainted Images
  {
    category: "AI INPAINTING",
    name: "AI Inpaint 1 (Red Desert Road)",
    path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 01_12_07 PM.png",
    isAI: true
  },
  {
    category: "AI INPAINTING",
    name: "AI Inpaint 2 (Desert + Flowers)",
    path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 02_04_31 PM.png",
    isAI: true
  },
  {
    category: "AI INPAINTING",
    name: "AI Inpaint 3 (Aniwatch Modal)",
    path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 04_36_35 PM.png",
    isAI: true
  },
  // 3. Authentic Non-AI Real Images
  {
    category: "REAL / NON-AI",
    name: "Real 1. Instagram Reel Screenshot",
    path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-18 at 23.56.09 (1).jpeg",
    isAI: false
  },
  {
    category: "REAL / NON-AI",
    name: "Real 2. WhatsApp Photo 1",
    path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (1).jpeg",
    isAI: false
  },
  {
    category: "REAL / NON-AI",
    name: "Real 3. WhatsApp Photo 2",
    path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (2).jpeg",
    isAI: false
  },
  {
    category: "REAL / NON-AI",
    name: "Real 4. WhatsApp Photo 3",
    path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (3).jpeg",
    isAI: false
  },
  {
    category: "REAL / NON-AI",
    name: "Real 5. Architecture Photo (Glass Door)",
    path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/hero-automatic-doors.jpg",
    isAI: false
  },
  {
    category: "REAL / NON-AI",
    name: "Real 6. Storefront Photo",
    path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/store-location-1.jpg",
    isAI: false
  },
  {
    category: "REAL / NON-AI",
    name: "Real 7. Interior Photo (Kitchen)",
    path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/category-modular-kitchen.jpg",
    isAI: false
  },
  {
    category: "REAL / NON-AI",
    name: "Real 8. LinkedIn Screenshot",
    path: "C:/Users/Gaurav Batule/Downloads/satkarya_feedback_linkedin_no_metadata.png",
    isAI: false
  }
];

async function runBenchmark() {
  console.log("================================================================================");
  console.log("  FULL BENCHMARK: 16 COMPREHENSIVE TEST CASES (FULL AI + INPAINTS + REAL)");
  console.log("================================================================================\n");

  let passCount = 0;
  let totalCount = 0;

  for (const item of ALL_CASES) {
    if (!fs.existsSync(item.path)) continue;
    totalCount++;

    const image = sharp(item.path);
    const metadata = await image.metadata();

    const maxDim = 1200;
    let w = metadata.width;
    let h = metadata.height;
    if (Math.max(w, h) > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      image.resize(w, h);
    }

    const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

    const isLossless = item.path.endsWith('.png');
    const pixelRes = performPixelForensics(imgData, info.width, info.height, isLossless, 'balanced');
    const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
    const freqRes = performFrequencyAnalysis(imgData, info.width, info.height);
    const scoreRes = computeCompositeScoreFull(null, noiseRes, freqRes, null, null, pixelRes, 'balanced');

    let passed = false;
    if (item.isAI) {
      passed = scoreRes.overallScore >= 70;
    } else {
      passed = scoreRes.overallScore <= 10;
    }

    if (passed) passCount++;

    console.log(`[${passed ? 'PASS' : 'FAIL'}] [${item.category}] ${item.name}`);
    console.log(`  File:           ${path.basename(item.path)}`);
    console.log(`  Score:          ${scoreRes.overallScore}%`);
    console.log(`  Classification: ${scoreRes.classification} (${scoreRes.confidence})`);
    console.log(`  Edited Area:    ${scoreRes.editedAreaPercent}%`);
    console.log("");
  }

  console.log(`================================================================================`);
  console.log(`  TOTAL ACCURACY: ${passCount} / ${totalCount} (${((passCount / totalCount) * 100).toFixed(1)}%)`);
  console.log(`================================================================================`);
}

runBenchmark().catch(console.error);
