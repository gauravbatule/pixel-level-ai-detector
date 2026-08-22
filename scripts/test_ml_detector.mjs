import { pipeline, env, RawImage } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';

env.allowRemoteModels = true;
env.useBrowserCache = false;
env.useCustomCache = false;

const testCases = [
  { name: "Crow Infographic (100% AI)", path: "C:/Users/Gaurav Batule/.gemini/antigravity/brain/d01aa755-7a0f-416c-b273-8ef496152c7d/.user_uploaded/media_1787424162222.jpg", isAI: true },
  { name: "WhatsApp AI Card (Aug 22)", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg", isAI: true },
  { name: "ChatGPT Image Aug 23 (1)", path: "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_39 AM.png", isAI: true },
  { name: "Real Photo 1 (WhatsApp)", path: "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (1).jpeg", isAI: false },
  { name: "Real Architecture (Glass Door)", path: "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/hero-automatic-doors.jpg", isAI: false }
];

async function runTest() {
  console.log("Loading AI Image Detection Vision Transformer Model...");
  const classifier = await pipeline('image-classification', 'umm-maybe/AI-image-detector');

  console.log("Model loaded successfully! Running inference on benchmark images...\n");

  for (const c of testCases) {
    if (!fs.existsSync(c.path)) continue;
    try {
      const raw = await RawImage.read(c.path);
      const output = await classifier(raw);
      console.log(`[${c.isAI ? 'AI EXPECTED' : 'REAL EXPECTED'}] ${c.name}`);
      console.log(`  File:   ${path.basename(c.path)}`);
      console.log(`  Output:`, output);
      console.log("");
    } catch (err) {
      console.error(`Error on ${c.name}:`, err.message);
    }
  }
}

runTest().catch(console.error);
