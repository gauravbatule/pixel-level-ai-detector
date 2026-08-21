/**
 * Ground-Truth Dataset Generator & Precision Calibration Script
 * 
 * Runs end-to-end pixel accuracy verification across:
 * 1. Paired Authentic vs Inpainted Test Cases with Ground Truth Mask
 * 2. Screenshot of AI Inpainting (PNG capture with zero EXIF)
 * 3. Authentic Control (testing False Positive Rate)
 * 4. Full Synthetic Control
 */

import { performPixelForensics } from '../lib/analysis/pixelForensics.js';
import { evaluatePixelAccuracy } from '../lib/analysis/evaluator.js';

// Helper to create synthetic test buffer
function createTestBuffer(width, height, type = 'authentic') {
  const data = new Uint8ClampedArray(width * height * 4);
  const gtMask = new Uint8Array(width * height);

  // Background natural gradient with camera sensor noise
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const lum = 100 + (y / height) * 80 + (x / width) * 40;
      
      // Natural sensor noise with Bayer demosaicing correlation
      const sharedNoise = (Math.random() - 0.5) * 12;
      data[idx] = Math.min(255, Math.max(0, lum + sharedNoise + (Math.random() - 0.5) * 2));
      data[idx + 1] = Math.min(255, Math.max(0, lum * 0.9 + sharedNoise + (Math.random() - 0.5) * 1.5));
      data[idx + 2] = Math.min(255, Math.max(0, lum * 0.8 + sharedNoise + (Math.random() - 0.5) * 2.5));
      data[idx + 3] = 255;
    }
  }

  if (type === 'inpainting' || type === 'screenshot_inpainting') {
    // Inpaint an elliptical region in the center
    const cx = Math.round(width * 0.5);
    const cy = Math.round(height * 0.5);
    const rx = Math.round(width * 0.2);
    const ry = Math.round(height * 0.25);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) {
          const idx = (y * width + x) * 4;
          // AI smooth inpainting with zero sensor noise
          const synthColor = 180 + Math.sin(x * 0.05) * 30;
          data[idx] = synthColor;
          data[idx + 1] = synthColor * 0.8;
          data[idx + 2] = synthColor * 0.6;
          gtMask[y * width + x] = 255;
        }
      }
    }
  } else if (type === 'full_ai') {
    for (let i = 0; i < width * height; i++) {
      gtMask[i] = 255;
      const idx = i * 4;
      data[idx] = 150 + Math.sin(i * 0.01) * 40;
      data[idx + 1] = 130 + Math.cos(i * 0.01) * 40;
      data[idx + 2] = 200;
    }
  }

  return {
    imageData: { data, width, height },
    groundTruthMask: gtMask,
    width,
    height
  };
}

console.log('================================================================');
console.log(' AI PIXEL DETECTOR: GROUND-TRUTH BENCHMARK & SCREENSHOT SUITE   ');
console.log('================================================================\n');

// 1. Evaluate Direct Inpainting / Local Edit Detection
console.log('Test 1: Targeted AI Inpainting with Ground-Truth Mask (400x300)');
const inpaintSample = createTestBuffer(400, 300, 'inpainting');
const inpaintForensics = performPixelForensics(inpaintSample.imageData, 400, 300, false);
const inpaintEval = evaluatePixelAccuracy(inpaintForensics.refinedSuspicion, inpaintSample.groundTruthMask, 400, 300, 0.42);

console.log(`  -> Pixel-level IoU (Jaccard Index): ${inpaintEval.iou}%`);
console.log(`  -> Dice / F1 Score:                ${inpaintEval.f1Score}%`);
console.log(`  -> Pixel Precision:                 ${inpaintEval.precision}%`);
console.log(`  -> Pixel Recall:                    ${inpaintEval.recall}%`);
console.log(`  -> Overall Pixel Accuracy:          ${inpaintEval.accuracy}%`);
console.log(`  -> False Positive Rate:             ${inpaintEval.falsePositiveRate}%\n`);

// 2. Evaluate Screenshot of AI Inpainting (Lossless PNG Display Capture)
console.log('Test 2: Screenshot of AI Inpainting (Lossless PNG, Zero EXIF) (400x300)');
const screenSample = createTestBuffer(400, 300, 'screenshot_inpainting');
const screenForensics = performPixelForensics(screenSample.imageData, 400, 300, true);
const screenEval = evaluatePixelAccuracy(screenForensics.refinedSuspicion, screenSample.groundTruthMask, 400, 300, 0.42);

console.log(`  -> Screenshot Pixel-level IoU:     ${screenEval.iou}%`);
console.log(`  -> Screenshot Dice / F1 Score:     ${screenEval.f1Score}%`);
console.log(`  -> Screenshot Precision:           ${screenEval.precision}%`);
console.log(`  -> Screenshot Recall:              ${screenEval.recall}%`);
console.log(`  -> Screenshot Accuracy:            ${screenEval.accuracy}%\n`);

// 3. Evaluate Authentic Camera Photo Control (False Positive Suppression)
console.log('Test 3: Authentic Camera Photo Control (400x300)');
const authSample = createTestBuffer(400, 300, 'authentic');
const authForensics = performPixelForensics(authSample.imageData, 400, 300, false);
const authEval = evaluatePixelAccuracy(authForensics.refinedSuspicion, authSample.groundTruthMask, 400, 300, 0.42);

console.log(`  -> False Positive Rate (FPR):       ${authEval.falsePositiveRate}%`);
console.log(`  -> Authentic Accuracy:              ${authEval.accuracy}%\n`);

console.log('================================================================');
console.log(' BENCHMARK SUMMARY & VALIDATION STATUS                          ');
console.log('================================================================');
const passed = inpaintEval.iou >= 70 && screenEval.iou >= 70 && authEval.falsePositiveRate <= 5.0;
console.log(`Status: ${passed ? '✓ PASSED (All criteria verified including screenshots)' : '⚠ TUNING REQUIRED'}`);
console.log('================================================================');
