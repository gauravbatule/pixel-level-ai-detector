import fs from 'fs';
import path from 'path';
import https from 'https';

const dirs = [
  'test_dataset/real_photos',
  'test_dataset/real_screenshots',
  'test_dataset/ai_full_generated',
  'test_dataset/ai_inpainted'
];

for (const d of dirs) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// Download function
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

const realPhotoUrls = [
  { name: "portrait_real.jpg", url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1024&q=80" },
  { name: "landscape_nature_real.jpg", url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1024&q=80" },
  { name: "street_urban_real.jpg", url: "https://images.unsplash.com/photo-1477959858617-67f30bc75b82?w=1024&q=80" },
  { name: "wildlife_bird_real.jpg", url: "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=1024&q=80" },
  { name: "food_real.jpg", url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1024&q=80" },
  { name: "macro_flower_real.jpg", url: "https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?w=1024&q=80" }
];

async function setup() {
  console.log("Downloading real photos dataset...");
  for (const item of realPhotoUrls) {
    const target = path.join('test_dataset/real_photos', item.name);
    try {
      console.log(`  Downloading ${item.name}...`);
      await downloadFile(item.url, target);
    } catch (e) {
      console.error(`  Failed ${item.name}:`, e.message);
    }
  }

  // Copy existing real screenshots and AI images into test_dataset
  console.log("\nOrganizing existing local benchmark samples into test_dataset/...");
  
  // Real screenshots
  const userScreenshot = "C:/Users/Gaurav Batule/.gemini/antigravity/brain/d01aa755-7a0f-416c-b273-8ef496152c7d/.user_uploaded/media_1787425703724.png";
  const reelScreenshot = "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-18 at 23.56.09 (1).jpeg";
  const linkedinScreenshot = "C:/Users/Gaurav Batule/Downloads/satkarya_feedback_linkedin_no_metadata.png";

  if (fs.existsSync(userScreenshot)) fs.copyFileSync(userScreenshot, "test_dataset/real_screenshots/browser_ui_screenshot.png");
  if (fs.existsSync(reelScreenshot)) fs.copyFileSync(reelScreenshot, "test_dataset/real_screenshots/instagram_reel_screenshot.jpeg");
  if (fs.existsSync(linkedinScreenshot)) fs.copyFileSync(linkedinScreenshot, "test_dataset/real_screenshots/linkedin_ui_screenshot.png");

  // Real photos from downloads
  const wa1 = "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (1).jpeg";
  const wa2 = "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (2).jpeg";
  const wa3 = "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-19 at 16.36.30 (3).jpeg";
  const glass = "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/hero-automatic-doors.jpg";
  const store = "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/store-location-1.jpg";
  const kitchen = "C:/Users/Gaurav Batule/Downloads/Navratna-Enterprises-Vercel (1)/assets/images/category-modular-kitchen.jpg";

  if (fs.existsSync(wa1)) fs.copyFileSync(wa1, "test_dataset/real_photos/whatsapp_camera_1.jpeg");
  if (fs.existsSync(wa2)) fs.copyFileSync(wa2, "test_dataset/real_photos/whatsapp_camera_2.jpeg");
  if (fs.existsSync(wa3)) fs.copyFileSync(wa3, "test_dataset/real_photos/whatsapp_camera_3.jpeg");
  if (fs.existsSync(glass)) fs.copyFileSync(glass, "test_dataset/real_photos/real_architecture_doors.jpg");
  if (fs.existsSync(store)) fs.copyFileSync(store, "test_dataset/real_photos/real_storefront.jpg");
  if (fs.existsSync(kitchen)) fs.copyFileSync(kitchen, "test_dataset/real_photos/real_modular_kitchen.jpg");

  // AI Full Generated
  const crow = "C:/Users/Gaurav Batule/.gemini/antigravity/brain/d01aa755-7a0f-416c-b273-8ef496152c7d/.user_uploaded/media_1787424162222.jpg";
  const newAI1 = "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_39 AM.png";
  const newAI2 = "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_36 AM.png";
  const newAI3 = "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 23, 2026, 12_04_30 AM.png";
  const waAI = "C:/Users/Gaurav Batule/Downloads/WhatsApp Image 2026-08-22 at 23.41.56.jpeg";

  if (fs.existsSync(crow)) fs.copyFileSync(crow, "test_dataset/ai_full_generated/crow_infographic_ai.jpg");
  if (fs.existsSync(newAI1)) fs.copyFileSync(newAI1, "test_dataset/ai_full_generated/chatgpt_ai_gen_1.png");
  if (fs.existsSync(newAI2)) fs.copyFileSync(newAI2, "test_dataset/ai_full_generated/chatgpt_ai_gen_2.png");
  if (fs.existsSync(newAI3)) fs.copyFileSync(newAI3, "test_dataset/ai_full_generated/chatgpt_ai_gen_3.png");
  if (fs.existsSync(waAI)) fs.copyFileSync(waAI, "test_dataset/ai_full_generated/whatsapp_ai_card.jpeg");

  // AI Inpainted
  const inpaint1 = "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 01_12_07 PM.png";
  const inpaint2 = "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 02_04_31 PM.png";
  const inpaint3 = "C:/Users/Gaurav Batule/Downloads/ChatGPT Image Aug 21, 2026, 04_36_35 PM.png";

  if (fs.existsSync(inpaint1)) fs.copyFileSync(inpaint1, "test_dataset/ai_inpainted/inpaint_red_path.png");
  if (fs.existsSync(inpaint2)) fs.copyFileSync(inpaint2, "test_dataset/ai_inpainted/inpaint_flowers.png");
  if (fs.existsSync(inpaint3)) fs.copyFileSync(inpaint3, "test_dataset/ai_inpainted/inpaint_modal.png");

  console.log("Dataset preparation complete!");
}

setup().catch(console.error);
