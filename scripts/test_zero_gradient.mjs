import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const allTestImages = [
  // REAL SCREENSHOTS
  { name: "Browser UI Screenshot", path: "test_dataset/real_screenshots/browser_ui_screenshot.png", isAI: false },
  { name: "Instagram Reel Screenshot", path: "test_dataset/real_screenshots/instagram_reel_screenshot.jpeg", isAI: false },
  { name: "LinkedIn UI Screenshot", path: "test_dataset/real_screenshots/linkedin_ui_screenshot.png", isAI: false },

  // AI FULL GENERATED
  { name: "Crow Infographic AI", path: "test_dataset/ai_full_generated/crow_infographic_ai.jpg", isAI: true },
  { name: "ChatGPT AI Gen 1", path: "test_dataset/ai_full_generated/chatgpt_ai_gen_1.png", isAI: true },
  { name: "ChatGPT AI Gen 2", path: "test_dataset/ai_full_generated/chatgpt_ai_gen_2.png", isAI: true },
  { name: "ChatGPT AI Gen 3", path: "test_dataset/ai_full_generated/chatgpt_ai_gen_3.png", isAI: true },
  { name: "WhatsApp AI Card", path: "test_dataset/ai_full_generated/whatsapp_ai_card.jpeg", isAI: true },
];

async function run() {
  console.log("Image Name | Class | Zero-Grad-X % | Zero-Grad-Y % | Combined Zero-Grad %");
  console.log("--------------------------------------------------------------------------------");

  for (const img of allTestImages) {
    if (!fs.existsSync(img.path)) continue;
    const { data, info } = await sharp(img.path).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const width = info.width, height = info.height;
    const numPixels = width * height;

    let zeroGradX = 0;
    let zeroGradY = 0;
    let zeroGradEither = 0;

    for (let y = 0; y < height; y++) {
      const row = y * width * 4;
      for (let x = 0; x < width; x++) {
        const idx = row + x * 4;
        const r = data[idx], g = data[idx+1], b = data[idx+2];

        let gx = 1, gy = 1;
        if (x > 0) {
          const prevIdx = row + (x - 1) * 4;
          if (r === data[prevIdx] && g === data[prevIdx+1] && b === data[prevIdx+2]) {
            gx = 0;
            zeroGradX++;
          }
        }
        if (y > 0) {
          const upIdx = (y - 1) * width * 4 + x * 4;
          if (r === data[upIdx] && g === data[upIdx+1] && b === data[upIdx+2]) {
            gy = 0;
            zeroGradY++;
          }
        }
        if (gx === 0 || gy === 0) {
          zeroGradEither++;
        }
      }
    }

    const zx = (zeroGradX / numPixels) * 100;
    const zy = (zeroGradY / numPixels) * 100;
    const ze = (zeroGradEither / numPixels) * 100;

    console.log(`${img.name.padEnd(28)} | ${img.isAI ? 'AI  ' : 'REAL'} | ${zx.toFixed(1).padStart(11)}% | ${zy.toFixed(1).padStart(11)}% | ${ze.toFixed(1).padStart(18)}%`);
  }
}

run().catch(console.error);
