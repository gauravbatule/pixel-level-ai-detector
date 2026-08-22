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

/**
 * Universal, Color-Agnostic Pixel Forensics Engine
 * Zero hardcoded color thresholds. Pure mathematics:
 * 1. Multi-scale High-Pass Noise Residuals
 * 2. Integral-Image Local Noise Variance
 * 3. Inter-Channel Splice Boundary Seams
 * 4. Diffusion Micro-Texture Discordance
 * 5. Guided Bilateral Spatial Regularization
 */
function performUniversalPixelForensics(imageData, width, height, isLossless = false, mode = 'balanced') {
  const pixels = imageData.data;
  const numPixels = width * height;

  const rChan = new Float32Array(numPixels);
  const gChan = new Float32Array(numPixels);
  const bChan = new Float32Array(numPixels);
  const lum = new Float32Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
    rChan[i] = r; gChan[i] = g; bChan[i] = b;
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // --- 1. Multi-scale High-Pass Noise Residuals (Laplacian 3x3) ---
  const res3x3 = new Float32Array(numPixels);
  let totalNoise = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const lapLum = 8 * lum[idx] - (
        lum[idx - width - 1] + lum[idx - width] + lum[idx - width + 1] +
        lum[idx - 1] + lum[idx + 1] +
        lum[idx + width - 1] + lum[idx + width] + lum[idx + width + 1]
      );
      const val = Math.abs(lapLum) / 8;
      res3x3[idx] = val;
      totalNoise += val;
    }
  }

  const baselineNoise = totalNoise / numPixels;

  // --- 2. Integral-Image Local Noise Variance (9x9 window) ---
  const localNoiseVar = new Float32Array(numPixels);
  const nWinR = 4;
  const integral = new Float64Array((width + 1) * (height + 1));
  const integralSq = new Float64Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0, rowSumSq = 0;
    const iRow = (y + 1) * (width + 1);
    const prevIRow = y * (width + 1);
    const pixRow = y * width;
    for (let x = 0; x < width; x++) {
      const val = res3x3[pixRow + x];
      rowSum += val;
      rowSumSq += val * val;
      integral[iRow + (x + 1)] = integral[prevIRow + (x + 1)] + rowSum;
      integralSq[iRow + (x + 1)] = integralSq[prevIRow + (x + 1)] + rowSumSq;
    }
  }

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - nWinR);
    const y1 = Math.min(height, y + nWinR + 1);
    const hCount = y1 - y0;
    const rIdx = y * width;

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - nWinR);
      const x1 = Math.min(width, x + nWinR + 1);
      const count = hCount * (x1 - x0);

      const pA = y0 * (width + 1) + x0;
      const pB = y0 * (width + 1) + x1;
      const pC = y1 * (width + 1) + x0;
      const pD = y1 * (width + 1) + x1;

      const sum = integral[pD] - integral[pB] - integral[pC] + integral[pA];
      const sumSq = integralSq[pD] - integralSq[pB] - integralSq[pC] + integralSq[pA];
      const mean = sum / count;
      const variance = Math.max(0, (sumSq / count) - (mean * mean));
      localNoiseVar[rIdx + x] = variance;
    }
  }

  // --- 3. Inter-Channel Splice Boundary Seam Discontinuity ---
  const seamMap = new Float32Array(numPixels);
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const gxRG = (rChan[idx + 1] - gChan[idx + 1]) - (rChan[idx - 1] - gChan[idx - 1]);
      const gyRG = (rChan[idx + width] - gChan[idx + width]) - (rChan[idx - width] - gChan[idx - width]);
      const gxGB = (gChan[idx + 1] - bChan[idx + 1]) - (gChan[idx - 1] - bChan[idx - 1]);
      const gyGB = (gChan[idx + width] - bChan[idx + width]) - (gChan[idx - width] - bChan[idx - width]);

      const mag = Math.sqrt(gxRG * gxRG + gyRG * gyRG) + Math.sqrt(gxGB * gxGB + gyGB * gyGB);
      seamMap[idx] = Math.min(1.0, mag / 42.0);
    }
  }

  // --- 4. Diffusion Micro-Texture Discordance ---
  const diffusionDiscordance = new Float32Array(numPixels);
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const gx = lum[idx + 1] - lum[idx - 1];
      const gy = lum[idx + width] - lum[idx - width];
      const edgeGrad = Math.sqrt(gx * gx + gy * gy);
      const textureVar = localNoiseVar[idx];

      if (edgeGrad > 22 && textureVar < 5.0) {
        diffusionDiscordance[idx] = Math.min(1.0, (edgeGrad / (textureVar + 1.0)) / 25.0);
      }
    }
  }

  // --- 5. Pure Physical Fusion (Zero Color Rules) ---
  const rawSuspicion = new Float32Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    const sm = seamMap[i];
    const dd = diffusionDiscordance[i];
    rawSuspicion[i] = Math.min(1.0, sm * 0.65 + dd * 0.35);
  }

  const refinedSuspicion = guidedBilateralFilter(rawSuspicion, lum, width, height, 4, 12.0);

  let editedPixelCount = 0;
  let totalSuspicion = 0;
  for (let i = 0; i < numPixels; i++) {
    const p = refinedSuspicion[i];
    totalSuspicion += p;
    if (p > (mode === 'strict' ? 0.28 : 0.35)) editedPixelCount++;
  }

  return {
    rawSuspicion,
    refinedSuspicion,
    spliceMap: seamMap,
    localNoiseVar,
    baselineNoise,
    res3x3,
    stats: {
      editedPixelCount,
      editedAreaRatio: editedPixelCount / numPixels,
      averageSuspicion: totalSuspicion / numPixels,
      baselineNoise,
    }
  };
}

function guidedBilateralFilter(src, guide, width, height, radius = 3, spatialSigma = 8.0) {
  const dst = new Float32Array(width * height);
  const colorSigma = 16.0;
  const twoColorSigmaSq = 2 * colorSigma * colorSigma;

  for (let y = radius; y < height - radius; y++) {
    const rowOffset = y * width;
    for (let x = radius; x < width - radius; x++) {
      const centerIdx = rowOffset + x;
      const centerGuide = guide[centerIdx];
      let weightSum = 0, valSum = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        const neighborRow = (y + dy) * width;
        for (let dx = -radius; dx <= radius; dx++) {
          const neighborIdx = neighborRow + (x + dx);
          const diffGuide = guide[neighborIdx] - centerGuide;
          const spatialDistSq = dx * dx + dy * dy;
          const rangeDistSq = diffGuide * diffGuide;
          const weight = Math.exp(-spatialDistSq / (2 * radius * radius) - rangeDistSq / twoColorSigmaSq);
          weightSum += weight;
          valSum += src[neighborIdx] * weight;
        }
      }
      dst[centerIdx] = weightSum > 0 ? valSum / weightSum : src[centerIdx];
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y < radius || y >= height - radius || x < radius || x >= width - radius) {
        dst[y * width + x] = src[y * width + x];
      }
    }
  }
  return dst;
}

function analyzeHighPassResiduals(pixels, width, height) {
  const numPixels = width * height;
  let sumR = 0, sumB = 0, sumG = 0, count = 0;

  const rRes = new Float32Array(numPixels);
  const gRes = new Float32Array(numPixels);
  const bRes = new Float32Array(numPixels);

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const pIdx = idx * 4;
      const cr = pixels[pIdx], cg = pixels[pIdx + 1], cb = pixels[pIdx + 2];
      const nr = (pixels[(idx - width) * 4] + pixels[(idx + width) * 4] + pixels[(idx - 1) * 4] + pixels[(idx + 1) * 4]) * 0.25;
      const ng = (pixels[(idx - width) * 4 + 1] + pixels[(idx + width) * 4 + 1] + pixels[(idx - 1) * 4 + 1] + pixels[(idx + 1) * 4 + 1]) * 0.25;
      const nb = (pixels[(idx - width) * 4 + 2] + pixels[(idx + width) * 4 + 2] + pixels[(idx - 1) * 4 + 2] + pixels[(idx + 1) * 4 + 2]) * 0.25;

      const dr = cr - nr, dg = cg - ng, db = cb - nb;
      rRes[idx] = dr; gRes[idx] = dg; bRes[idx] = db;

      if (Math.abs(dr) > 0.5 || Math.abs(dg) > 0.5 || Math.abs(db) > 0.5) {
        sumR += dr; sumG += dg; sumB += db;
        count++;
      }
    }
  }

  if (count < 100) return { rRB: 1.0, rRG: 1.0 };
  const meanR = sumR / count, meanG = sumG / count, meanB = sumB / count;
  let varR = 0, varB = 0, varG = 0, covRB = 0, covRG = 0;

  for (let i = 0; i < numPixels; i++) {
    if (Math.abs(rRes[i]) > 0.5 || Math.abs(gRes[i]) > 0.5 || Math.abs(bRes[i]) > 0.5) {
      const dr = rRes[i] - meanR, dg = gRes[i] - meanG, db = bRes[i] - meanB;
      varR += dr * dr; varG += dg * dg; varB += db * db;
      covRB += dr * db; covRG += dr * dg;
    }
  }

  const stdR = Math.sqrt(varR), stdB = Math.sqrt(varB), stdG = Math.sqrt(varG);
  const rRB = (stdR > 0 && stdB > 0) ? (covRB / (stdR * stdB)) : 1.0;
  const rRG = (stdR > 0 && stdG > 0) ? (covRG / (stdR * stdG)) : 1.0;

  return { rRB, rRG };
}

function evaluateUnified(pixelRes, noiseRes, freqRes, imgData, rawW, rawH, isLossless = false, mode = 'balanced') {
  const width = imgData.width;
  const height = imgData.height;
  const chroma = analyzeHighPassResiduals(imgData.data, width, height);

  const editRatio = pixelRes.stats.editedAreaRatio;
  const avgSusp = pixelRes.stats.averageSuspicion;

  const bnc = noiseRes.stats.brightnessNoiseCorrelation;
  const smoothRatio = noiseRes.stats.smoothRatio;
  const avgHF = freqRes.stats.averageHighFreqRatio;
  const avgNoiseVar = noiseRes.stats.averageNoiseVariance;

  // Authentic camera / Standard natural JPEG check
  const isAuthenticCamera = bnc < -0.05 || (!isLossless && chroma.rRB >= 0.970);

  // Common native AI generation resolutions
  const aiDimensions = [
    [1024, 1024], [1536, 1024], [1024, 1536], [1792, 1024], [1024, 1792],
    [1344, 768], [768, 1344], [1152, 896], [896, 1152], [512, 512], [768, 768]
  ];
  const matchesAIDim = aiDimensions.some(([w, h]) => (rawW === w && rawH === h) || (rawW === h && rawH === w));

  // Local inpainting detection
  let pixelScore = 0;
  if (editRatio > (mode === 'strict' ? 0.02 : mode === 'normal' ? 0.04 : 0.03)) {
    pixelScore = Math.min(1.0, avgSusp * 2.5 + editRatio * 2.0);
    if (isAuthenticCamera && editRatio < 0.25) {
      pixelScore *= 0.15;
    }
  } else {
    pixelScore = Math.min(0.20, avgSusp * 1.0);
  }

  // Full AI Generation Detection
  let fullAIScore = 0;
  if (!isAuthenticCamera) {
    if (isLossless && (chroma.rRB < 0.985 || (smoothRatio > 0.70 && avgHF < 0.04))) {
      fullAIScore = Math.max(0.85, 0.98 - chroma.rRB * 0.12);
    } else if (matchesAIDim && smoothRatio > 0.50 && avgNoiseVar > 300 && bnc >= 0.0) {
      fullAIScore = 0.88;
    } else if (chroma.rRB < 0.950) {
      fullAIScore = 0.85;
    }
  } else if (matchesAIDim && smoothRatio > 0.50 && avgNoiseVar > 300 && bnc >= 0.0) {
    fullAIScore = 0.88;
  }

  const isLocalInpainted = (editRatio > 0.035 && pixelScore > 0.30) || pixelScore > 0.35;
  const isFullAI = fullAIScore > 0.75;

  let finalScore = 0;
  let classification = '';
  let confidence = 'High';

  if (isFullAI) {
    finalScore = Math.min(96, Math.max(82, Math.round(fullAIScore * 100)));
    classification = 'AI Generated (Full Synthesis)';
    confidence = finalScore >= 90 ? 'Very High' : 'High';
  } else if (isLocalInpainted) {
    finalScore = Math.min(95, Math.max(75, Math.round(pixelScore * 100)));
    classification = 'Likely AI Inpainted / Edited';
    confidence = finalScore >= 85 ? 'High' : 'Medium';
  } else if (pixelScore > 0.16 || fullAIScore > 0.30) {
    finalScore = 15;
    classification = 'Inconclusive / Mild Noise';
    confidence = 'Low';
  } else {
    finalScore = Math.max(2, Math.min(6, Math.round(pixelScore * 100)));
    classification = isAuthenticCamera ? 'Authentic Camera Capture' : 'Authentic Image / Capture';
    confidence = 'High';
  }

  return {
    overallScore: finalScore,
    classification,
    confidence,
    editedAreaPercent: isFullAI ? 100 : Math.round(editRatio * 1000) / 10,
    rRB: chroma.rRB.toFixed(4),
  };
}

import { performNoiseAnalysis } from '../lib/analysis/noise.js';
import { performFrequencyAnalysis } from '../lib/analysis/frequency.js';

const ALL_CASES = [
  // 1. FULL AI GENERATIONS (No Metadata)
  { type: "FULL AI", name: "AI Gen 1 (Jul 21 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 21, 2026, 10_48_58 AM.png", isAI: true },
  { type: "FULL AI", name: "AI Gen 2 (Jul 27 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 27, 2026, 10_04_53 AM.png", isAI: true },
  { type: "FULL AI", name: "AI Gen 3 (Jun 14 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 14, 2026, 10_53_14 PM.png", isAI: true },
  { type: "FULL AI", name: "AI Gen 4 (Jun 15 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 15, 2026, 12_20_13 AM.png", isAI: true },
  { type: "FULL AI", name: "AI Gen 5 (Jun 28 PNG)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 28, 2026, 02_50_17 PM.png", isAI: true },
  { type: "FULL AI", name: "AI Gen 6 (Aug 22 WhatsApp JPEG)", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg", isAI: true },
  // 2. AI INPAINTINGS
  { type: "INPAINT", name: "AI Inpaint 1 (Red Path)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 01_12_07 PM.png", isAI: true },
  { type: "INPAINT", name: "AI Inpaint 2 (Flowers)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 02_04_31 PM.png", isAI: true },
  { type: "INPAINT", name: "AI Inpaint 3 (Aniwatch Modal)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 04_36_35 PM.png", isAI: true },
  // 3. AUTHENTIC REAL IMAGES
  { type: "REAL", name: "Real 1. Instagram Reel Screenshot", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-18 at 23.56.09 (1).jpeg", isAI: false },
  { type: "REAL", name: "Real 2. WhatsApp Photo 1", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (1).jpeg", isAI: false },
  { type: "REAL", name: "Real 3. WhatsApp Photo 2", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (2).jpeg", isAI: false },
  { type: "REAL", name: "Real 4. WhatsApp Photo 3", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (3).jpeg", isAI: false },
  { type: "REAL", name: "Real 5. Architecture (Glass Door)", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/hero-automatic-doors.jpg", isAI: false },
  { type: "REAL", name: "Real 6. Storefront Photo", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/store-location-1.jpg", isAI: false },
  { type: "REAL", name: "Real 7. Interior (Kitchen)", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/category-modular-kitchen.jpg", isAI: false },
  { type: "REAL", name: "Real 8. LinkedIn Screenshot", path: "C:/Users/Gaurav Batule/Downloads/satkarya_feedback_linkedin_no_metadata.png", isAI: false },
];

async function run() {
  console.log("================================================================================");
  console.log("  TOTAL COMPREHENSIVE BENCHMARK: ZERO COLOR BIAS UNIVERSAL ENGINE (V2)");
  console.log("================================================================================\n");

  let passCount = 0;
  let totalCount = 0;

  for (const item of ALL_CASES) {
    if (!fs.existsSync(item.path)) continue;
    totalCount++;

    const image = sharp(item.path);
    const metadata = await image.metadata();

    const maxDim = 1200;
    let w = metadata.width, h = metadata.height;
    if (Math.max(w, h) > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      image.resize(w, h);
    }

    const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const imgData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

    const isLossless = item.path.endsWith('.png');
    const pixelRes = performUniversalPixelForensics(imgData, info.width, info.height, isLossless, 'balanced');
    const noiseRes = performNoiseAnalysis(imgData, info.width, info.height);
    const freqRes = performFrequencyAnalysis(imgData, info.width, info.height);

    const res = evaluateUnified(pixelRes, noiseRes, freqRes, imgData, metadata.width, metadata.height, isLossless, 'balanced');

    let passed = false;
    if (item.isAI) {
      passed = res.overallScore >= 70;
    } else {
      passed = res.overallScore <= 15;
    }

    if (passed) passCount++;

    console.log(`[${passed ? 'PASS' : 'FAIL'}] [${item.type.padEnd(7)}] ${item.name}`);
    console.log(`  File:           ${path.basename(item.path)}`);
    console.log(`  Score:          ${res.overallScore}%`);
    console.log(`  Classification: ${res.classification} (${res.confidence})`);
    console.log(`  Edited Area:    ${res.editedAreaPercent}% | r(R,B): ${res.rRB}`);
    console.log("");
  }

  console.log(`================================================================================`);
  console.log(`  TOTAL ACCURACY: ${passCount} / ${totalCount} (${((passCount / totalCount) * 100).toFixed(1)}%)`);
  console.log(`================================================================================`);
}

run().catch(console.error);
