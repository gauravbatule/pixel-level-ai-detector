import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ALL_IMAGES = [
  // Full AI
  { type: "AI", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 21, 2026, 10_48_58 AM.png" },
  { type: "AI", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jul 27, 2026, 10_04_53 AM.png" },
  { type: "AI", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 14, 2026, 10_53_14 PM.png" },
  { type: "AI", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 15, 2026, 12_20_13 AM.png" },
  { type: "AI", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Jun 28, 2026, 02_50_17 PM.png" },
  // AI Inpaints
  { type: "AI-INP", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 01_12_07 PM.png" },
  { type: "AI-INP", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 02_04_31 PM.png" },
  { type: "AI-INP", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 04_36_35 PM.png" },
  // Real Images
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-18 at 23.56.09 (1).jpeg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (1).jpeg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (2).jpeg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (3).jpeg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/hero-automatic-doors.jpg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/store-location-1.jpg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/category-modular-kitchen.jpg" },
  { type: "REAL", path: "C:/Users/Gaurav Batule/Downloads/satkarya_feedback_linkedin_no_metadata.png" },
];

function analyzeHighPassResiduals(pixels, width, height) {
  const numPixels = width * height;
  const rRes = new Float32Array(numPixels);
  const gRes = new Float32Array(numPixels);
  const bRes = new Float32Array(numPixels);

  // Simple 3x3 high-pass Laplacian filter on each channel
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const pIdx = idx * 4;

      // Center
      const cr = pixels[pIdx], cg = pixels[pIdx + 1], cb = pixels[pIdx + 2];
      
      // 4-neighbor average
      const nr = (pixels[(idx - width) * 4] + pixels[(idx + width) * 4] + pixels[(idx - 1) * 4] + pixels[(idx + 1) * 4]) / 4;
      const ng = (pixels[(idx - width) * 4 + 1] + pixels[(idx + width) * 4 + 1] + pixels[(idx - 1) * 4 + 1] + pixels[(idx + 1) * 4 + 1]) / 4;
      const nb = (pixels[(idx - width) * 4 + 2] + pixels[(idx + width) * 4 + 2] + pixels[(idx - 1) * 4 + 2] + pixels[(idx + 1) * 4 + 2]) / 4;

      rRes[idx] = cr - nr;
      gRes[idx] = cg - ng;
      bRes[idx] = cb - nb;
    }
  }

  // Calculate Pearson correlation r(R_res, B_res) and r(R_res, G_res)
  let sumR = 0, sumG = 0, sumB = 0;
  let count = 0;

  for (let i = 0; i < numPixels; i++) {
    if (Math.abs(rRes[i]) > 0.5 || Math.abs(gRes[i]) > 0.5 || Math.abs(bRes[i]) > 0.5) {
      sumR += rRes[i];
      sumG += gRes[i];
      sumB += bRes[i];
      count++;
    }
  }

  if (count < 100) return { rRB: 0, rRG: 0, kurtosis: 0 };

  const meanR = sumR / count;
  const meanG = sumG / count;
  const meanB = sumB / count;

  let varR = 0, varG = 0, varB = 0;
  let covRB = 0, covRG = 0;
  let m4 = 0;

  for (let i = 0; i < numPixels; i++) {
    if (Math.abs(rRes[i]) > 0.5 || Math.abs(gRes[i]) > 0.5 || Math.abs(bRes[i]) > 0.5) {
      const dr = rRes[i] - meanR;
      const dg = gRes[i] - meanG;
      const db = bRes[i] - meanB;

      varR += dr * dr;
      varG += dg * dg;
      varB += db * db;
      covRB += dr * db;
      covRG += dr * dg;

      const lumRes = 0.299 * dr + 0.587 * dg + 0.114 * db;
      m4 += lumRes * lumRes * lumRes * lumRes;
    }
  }

  const stdR = Math.sqrt(varR);
  const stdG = Math.sqrt(varG);
  const stdB = Math.sqrt(varB);

  const rRB = (stdR > 0 && stdB > 0) ? (covRB / (stdR * stdB)) : 0;
  const rRG = (stdR > 0 && stdG > 0) ? (covRG / (stdR * stdG)) : 0;

  const lumVar = (0.299 * varR + 0.587 * varG + 0.114 * varB) / count;
  const kurtosis = lumVar > 0 ? (m4 / count) / (lumVar * lumVar) : 0;

  return { rRB, rRG, kurtosis };
}

async function run() {
  console.log("Type   | Image Name             | r(R, B) | r(R, G) | Kurtosis (Peakiness)");
  console.log("-------------------------------------------------------------------------");

  for (const item of ALL_IMAGES) {
    if (!fs.existsSync(item.path)) continue;
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
    const res = analyzeHighPassResiduals(data, info.width, info.height);

    const name = path.basename(item.path).substring(0, 22).padEnd(22);
    console.log(
      `${item.type.padEnd(6)} | ${name} | ` +
      `${res.rRB.toFixed(4).padStart(7)} | ` +
      `${res.rRG.toFixed(4).padStart(7)} | ` +
      `${res.kurtosis.toFixed(2).padStart(8)}`
    );
  }
}

run().catch(console.error);
