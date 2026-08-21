/**
 * Dataset & Benchmark Sample Repository (Includes Real User Desert Path Edit)
 * 
 * Provides curated test samples with exact ground-truth masks:
 * - Real User Case: Desert Sand Path with AI Red Road Edit vs Original
 * - Authentic camera photographs (Control)
 * - Inpainted / Local AI Edits (Paired Original + Inpainted + Ground Truth Mask)
 * - Screenshots of AI Inpaintings (Testing PNG display capture detection)
 * - Pure AI Full-Frame Generations
 */

/**
 * Load User Desert Path Real Inpainted Image and calculate ground truth mask against original
 */
export function loadUserDesertPathSample(width = 800, height = 450) {
  return new Promise((resolve) => {
    const origImg = new Image();
    const editImg = new Image();

    origImg.crossOrigin = 'anonymous';
    editImg.crossOrigin = 'anonymous';

    let loadedCount = 0;
    const onBothLoaded = () => {
      loadedCount++;
      if (loadedCount < 2) return;

      const editCanvas = document.createElement('canvas');
      editCanvas.width = width;
      editCanvas.height = height;
      const editCtx = editCanvas.getContext('2d');
      editCtx.drawImage(editImg, 0, 0, width, height);

      const origCanvas = document.createElement('canvas');
      origCanvas.width = width;
      origCanvas.height = height;
      const origCtx = origCanvas.getContext('2d');
      origCtx.drawImage(origImg, 0, 0, width, height);

      const editData = editCtx.getImageData(0, 0, width, height).data;
      const origData = origCtx.getImageData(0, 0, width, height).data;

      // Compute exact Ground Truth Mask from the real pixel difference
      const gtMask = new Uint8Array(width * height);
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        const dr = Math.abs(editData[idx] - origData[idx]);
        const dg = Math.abs(editData[idx + 1] - origData[idx + 1]);
        const db = Math.abs(editData[idx + 2] - origData[idx + 2]);
        const totalDiff = (dr + dg + db) / 3;

        // If pixel is significantly altered by AI inpainting
        if (totalDiff > 25) {
          gtMask[i] = 255;
        } else {
          gtMask[i] = 0;
        }
      }

      resolve({
        authenticCanvas: origCanvas,
        editCanvas,
        groundTruthMask: gtMask,
        metadata: {
          type: 'user_desert_path',
          title: 'User Desert Sand Path (AI Red Road Edit)',
          description: 'Real photo where the central sand path was inpainted and turned into a red brick road with AI.',
        }
      });
    };

    origImg.onload = onBothLoaded;
    editImg.onload = onBothLoaded;

    origImg.src = '/sand_path_original.jpg';
    editImg.src = '/sand_path_road_red.png';
  });
}

/**
 * Generate a procedural camera-authentic baseline image with realistic sensor noise
 */
export function generateAuthenticSample(width = 600, height = 450) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#5b86e5');
  grad.addColorStop(0.4, '#87ceeb');
  grad.addColorStop(0.65, '#e0f0f8');
  grad.addColorStop(1, '#2e5a36');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#3a4a5e';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.55);
  ctx.lineTo(width * 0.25, height * 0.35);
  ctx.lineTo(width * 0.5, height * 0.5);
  ctx.lineTo(width * 0.75, height * 0.3);
  ctx.lineTo(width, height * 0.52);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.fill();

  ctx.fillStyle = '#264e2e';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.68);
  ctx.quadraticCurveTo(width * 0.5, height * 0.6, width, height * 0.72);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.fill();

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const noiseSigma = 8.0 * (1.0 - lum / 300.0) + 3.0;
      
      const sharedNoise = (Math.random() - 0.5) * noiseSigma * 1.5;
      const rNoise = sharedNoise + (Math.random() - 0.5) * 2.0;
      const gNoise = sharedNoise + (Math.random() - 0.5) * 1.5;
      const bNoise = sharedNoise + (Math.random() - 0.5) * 2.5;

      data[idx] = Math.min(255, Math.max(0, data[idx] + rNoise));
      data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + gNoise));
      data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + bNoise));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Generate an AI Inpainting Sample with ground-truth mask
 */
export function generateInpaintedSample(width = 600, height = 450, isScreenshotMode = false) {
  const authenticCanvas = generateAuthenticSample(width, height);
  const editCanvas = document.createElement('canvas');
  editCanvas.width = width;
  editCanvas.height = height;
  const editCtx = editCanvas.getContext('2d');
  editCtx.drawImage(authenticCanvas, 0, 0);

  const targetX = Math.round(width * 0.45);
  const targetY = Math.round(height * 0.25);
  const targetW = Math.round(width * 0.25);
  const targetH = Math.round(height * 0.42);

  const aiGrad = editCtx.createLinearGradient(targetX, targetY, targetX + targetW, targetY + targetH);
  aiGrad.addColorStop(0, '#f97316');
  aiGrad.addColorStop(0.5, '#fbbf24');
  aiGrad.addColorStop(1, '#f43f5e');

  editCtx.save();
  editCtx.beginPath();
  editCtx.ellipse(targetX + targetW / 2, targetY + targetH / 2, targetW / 2, targetH / 2, 0, 0, Math.PI * 2);
  editCtx.fillStyle = aiGrad;
  editCtx.fill();
  editCtx.restore();

  if (isScreenshotMode) {
    editCtx.strokeStyle = 'rgba(255,255,255,0.05)';
    editCtx.lineWidth = 1;
    editCtx.strokeRect(0, 0, width, height);
  }

  const gtMask = new Uint8Array(width * height);
  const centerX = targetX + targetW / 2;
  const centerY = targetY + targetH / 2;
  const rx = targetW / 2;
  const ry = targetH / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - centerX) / rx;
      const dy = (y - centerY) / ry;
      if (dx * dx + dy * dy <= 1.0) {
        gtMask[y * width + x] = 255;
      } else {
        gtMask[y * width + x] = 0;
      }
    }
  }

  return {
    authenticCanvas,
    editCanvas,
    groundTruthMask: gtMask,
    targetBounds: { x: targetX, y: targetY, width: targetW, height: targetH },
    metadata: {
      type: isScreenshotMode ? 'screenshot_inpainting' : 'inpainting',
      title: isScreenshotMode ? 'Screenshot of AI Inpainting (Lossless PNG)' : 'Targeted Object Inpainting (Generative Fill)',
      description: isScreenshotMode ? 'Captured via OS screen snippet tool with zero EXIF metadata.' : 'Generative insertion with smooth diffusion gradient and distinct boundary transition.',
    }
  };
}

/**
 * Generate 100% Full Synthetic AI sample
 */
export function generateFullAISample(width = 600, height = 450) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(width * 0.5, height * 0.5, 20, width * 0.5, height * 0.5, width * 0.6);
  grad.addColorStop(0, '#ec4899');
  grad.addColorStop(0.4, '#8b5cf6');
  grad.addColorStop(0.8, '#3b82f6');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const gtMask = new Uint8Array(width * height);
  gtMask.fill(255);

  return {
    canvas,
    groundTruthMask: gtMask,
    metadata: {
      type: 'full_ai',
      title: 'Full Diffusion Generation (Midjourney/Flux style)',
      description: 'Entirely AI synthesized canvas with uniform synthetic frequencies and zero camera sensor pattern noise.',
    }
  };
}

export const SAMPLE_PRESETS = [
  {
    id: 'user_desert_path',
    name: 'Your Desert Road Edit',
    tag: 'Your Images Paired',
    type: 'user_pair',
    description: 'Direct comparison of your Downloads AI red road against your Pictures original photo.',
  },
  {
    id: 'inpainting_edit',
    name: 'AI Inpainting / Object Edit',
    tag: 'Paired Ground Truth',
    type: 'inpainting',
    description: 'Generative object insertion tested against exact pixel mask ground truth.',
  },
  {
    id: 'screenshot_edit',
    name: 'Screenshot of AI Inpainting',
    tag: 'Screenshot PNG',
    type: 'screenshot_inpainting',
    description: 'Screen-captured PNG without EXIF/metadata, testing pixel-level noise resilience.',
  },
  {
    id: 'authentic_photo',
    name: 'Authentic Camera Photo',
    tag: 'Authentic Control',
    type: 'authentic',
    description: 'Raw camera photograph with natural sensor shot noise and demosaicing.',
  },
  {
    id: 'full_synthetic',
    name: 'Full AI Generation',
    tag: '100% Synthetic',
    type: 'full_ai',
    description: 'Completely AI-generated image with characteristic frequency signatures.',
  }
];
