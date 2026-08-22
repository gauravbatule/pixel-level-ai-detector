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

const targetPath = "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg";

async function analyzePatches() {
  const image = sharp(targetPath);
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
  const pixels = new Uint8ClampedArray(data);

  // Divide into 32x32 tiles and compute local noise variance, high-frequency energy, and gradient density
  const tileSize = 32;
  const tilesX = Math.floor(w / tileSize);
  const tilesY = Math.floor(h / tileSize);

  const tileStats = [];

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      let sumLap = 0, sumLapSq = 0, count = 0;
      let sumGrad = 0;

      for (let dy = 1; dy < tileSize - 1; dy++) {
        const y = ty * tileSize + dy;
        const row = y * w;
        for (let dx = 1; dx < tileSize - 1; dx++) {
          const x = tx * tileSize + dx;
          const idx = (row + x) * 4;

          const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
          const lumT = 0.299 * pixels[(idx - w * 4)] + 0.587 * pixels[(idx - w * 4) + 1] + 0.114 * pixels[(idx - w * 4) + 2];
          const lumB = 0.299 * pixels[(idx + w * 4)] + 0.587 * pixels[(idx + w * 4) + 1] + 0.114 * pixels[(idx + w * 4) + 2];
          const lumL = 0.299 * pixels[(idx - 4)] + 0.587 * pixels[(idx - 4) + 1] + 0.114 * pixels[(idx - 4) + 2];
          const lumR = 0.299 * pixels[(idx + 4)] + 0.587 * pixels[(idx + 4) + 1] + 0.114 * pixels[(idx + 4) + 2];

          const lap = Math.abs(4 * lum - (lumT + lumB + lumL + lumR));
          const gx = Math.abs(lumR - lumL);
          const gy = Math.abs(lumB - lumT);

          sumLap += lap;
          sumLapSq += lap * lap;
          sumGrad += Math.sqrt(gx * gx + gy * gy);
          count++;
        }
      }

      const meanLap = sumLap / count;
      const varLap = Math.max(0, (sumLapSq / count) - (meanLap * meanLap));
      const meanGrad = sumGrad / count;

      tileStats.push({
        tx, ty,
        x: tx * tileSize,
        y: ty * tileSize,
        varLap,
        meanLap,
        meanGrad,
      });
    }
  }

  // Sort by highest texture/noise variance
  tileStats.sort((a, b) => b.varLap - a.varLap);

  console.log("Top 10 highest-noise / highest-texture tiles (Potential Real Photo Patch):");
  for (let i = 0; i < 10; i++) {
    const t = tileStats[i];
    console.log(`  Tile at (${t.x}, ${t.y}): varLap=${t.varLap.toFixed(2)}, meanLap=${t.meanLap.toFixed(2)}, meanGrad=${t.meanGrad.toFixed(2)}`);
  }

  console.log("\nBottom 10 lowest-noise / smoothest tiles (AI Generated Background):");
  for (let i = tileStats.length - 10; i < tileStats.length; i++) {
    const t = tileStats[i];
    console.log(`  Tile at (${t.x}, ${t.y}): varLap=${t.varLap.toFixed(2)}, meanLap=${t.meanLap.toFixed(2)}, meanGrad=${t.meanGrad.toFixed(2)}`);
  }
}

analyzePatches().catch(console.error);
