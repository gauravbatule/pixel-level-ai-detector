/**
 * Pixel-Level Evaluation & Ground-Truth Verification Engine
 * 
 * Computes scientific forensic evaluation metrics:
 * - Intersection-over-Union (IoU / Jaccard Index)
 * - Dice / F1 Score
 * - Pixel-Level Precision & Recall
 * - False Positive Rate (FPR) on authentic regions
 */

/**
 * Evaluate detection accuracy against ground truth binary mask
 * @param {Float32Array|Uint8Array|Uint8ClampedArray} predictedScores Array of floats [0..1] or binary values
 * @param {Uint8Array|Uint8ClampedArray} groundTruthMask Array where > 128 indicates AI modified pixel
 * @param {number} width 
 * @param {number} height 
 * @param {number} threshold Detection decision threshold (default 0.5)
 * @returns {Object} Evaluation metrics and comparison statistics
 */
export function evaluatePixelAccuracy(predictedScores, groundTruthMask, width, height, threshold = 0.5) {
  const totalPixels = width * height;
  let tp = 0; // True Positive: Predicted AI & Actually AI
  let fp = 0; // False Positive: Predicted AI & Actually Authentic
  let tn = 0; // True Negative: Predicted Authentic & Actually Authentic
  let fn = 0; // False Negative: Predicted Authentic & Actually AI

  let gtPositiveCount = 0;
  let predPositiveCount = 0;

  for (let i = 0; i < totalPixels; i++) {
    const isActualAI = groundTruthMask[i] > 128;
    const isPredAI = predictedScores[i] >= threshold;

    if (isActualAI) gtPositiveCount++;
    if (isPredAI) predPositiveCount++;

    if (isActualAI && isPredAI) tp++;
    else if (!isActualAI && isPredAI) fp++;
    else if (!isActualAI && !isPredAI) tn++;
    else if (isActualAI && !isPredAI) fn++;
  }

  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 1.0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 1.0;
  const f1Score = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const intersection = tp;
  const union = tp + fp + fn;
  const iou = union > 0 ? intersection / union : (gtPositiveCount === 0 && predPositiveCount === 0 ? 1.0 : 0);
  const accuracy = (tp + tn) / totalPixels;
  const falsePositiveRate = (fp + tn) > 0 ? fp / (fp + tn) : 0;

  return {
    iou: Math.round(iou * 1000) / 10, // e.g. 84.5%
    f1Score: Math.round(f1Score * 1000) / 10,
    precision: Math.round(precision * 1000) / 10,
    recall: Math.round(recall * 1000) / 10,
    accuracy: Math.round(accuracy * 1000) / 10,
    falsePositiveRate: Math.round(falsePositiveRate * 1000) / 10,
    tp, fp, tn, fn,
    groundTruthPixels: gtPositiveCount,
    predictedEditedPixels: predPositiveCount,
    totalPixels,
  };
}

/**
 * Generate a visual comparison overlay (Green = TP, Red = FP, Blue = FN)
 */
export function generateEvaluationHeatmap(predictedScores, groundTruthMask, width, height, threshold = 0.5) {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const isActualAI = groundTruthMask[i] > 128;
    const isPredAI = predictedScores[i] >= threshold;

    if (isActualAI && isPredAI) {
      // True Positive: Correctly detected AI (Bright Red/Amber)
      pixels[idx] = 239;
      pixels[idx + 1] = 68;
      pixels[idx + 2] = 68;
      pixels[idx + 3] = 180;
    } else if (!isActualAI && isPredAI) {
      // False Positive: Mistakenly flagged authentic (Magenta/Purple)
      pixels[idx] = 217;
      pixels[idx + 1] = 70;
      pixels[idx + 2] = 239;
      pixels[idx + 3] = 160;
    } else if (isActualAI && !isPredAI) {
      // False Negative: Missed AI edit (Cyan/Blue outline)
      pixels[idx] = 59;
      pixels[idx + 1] = 130;
      pixels[idx + 2] = 246;
      pixels[idx + 3] = 160;
    } else {
      // True Negative: Correct authentic pixel (Transparent / subtle green tint)
      pixels[idx] = 34;
      pixels[idx + 1] = 197;
      pixels[idx + 2] = 94;
      pixels[idx + 3] = 15;
    }
  }

  return new ImageData(pixels, width, height);
}
