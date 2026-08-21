import sharp from 'sharp';
import fs from 'fs';

const imgPath = "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 02_04_31 PM.png";

async function inspect() {
  const image = sharp(imgPath);
  const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const numPixels = w * h;

  const rChan = new Float32Array(numPixels);
  const gChan = new Float32Array(numPixels);
  const bChan = new Float32Array(numPixels);
  const lum = new Float32Array(numPixels);
  const satArr = new Float32Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    rChan[i] = r; gChan[i] = g; bChan[i] = b;
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
    satArr[i] = maxC > 0 ? (maxC - minC) / maxC : 0;
  }

  let redCount = 0;
  let purpleCount = 0;
  let yellowCount = 0;
  let plantFoliageCount = 0;

  for (let i = 0; i < numPixels; i++) {
    const r = rChan[i], g = gChan[i], b = bChan[i], sat = satArr[i], l = lum[i];

    // Red Road
    const redDom = Math.max(0, r - (g + b) * 0.65);
    if (redDom > 35 && sat > 0.40) redCount++;

    // Purple / Magenta Flowers
    if (r > 60 && b > 50 && g < Math.min(r, b) * 0.75 && (r + b) > 130 && sat > 0.32) {
      purpleCount++;
    }

    // Yellow / Amber Flowers
    if (r > 130 && g > 110 && b < g * 0.58 && sat > 0.42) {
      yellowCount++;
    }

    // Green Foliage / Olive Stems & Plant Bushes (G is high relative to R, B is depressed)
    if (g > 35 && g > r * 0.88 && b < g * 0.80 && sat > 0.22 && l < 180) {
      plantFoliageCount++;
    }
  }

  console.log("DETECTION BREAKDOWN:");
  console.log(`- Red Sand / Path:      ${redCount} px (${(redCount / numPixels * 100).toFixed(2)}%)`);
  console.log(`- Purple/Pink Flowers:  ${purpleCount} px (${(purpleCount / numPixels * 100).toFixed(2)}%)`);
  console.log(`- Yellow/Gold Flowers:  ${yellowCount} px (${(yellowCount / numPixels * 100).toFixed(2)}%)`);
  console.log(`- Green Plant Foliage:  ${plantFoliageCount} px (${(plantFoliageCount / numPixels * 100).toFixed(2)}%)`);
  console.log(`Total Inpainted Area:   ${redCount + purpleCount + yellowCount + plantFoliageCount} px (${((redCount + purpleCount + yellowCount + plantFoliageCount) / numPixels * 100).toFixed(2)}%)`);
}

inspect().catch(console.error);
