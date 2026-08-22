import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const targetDir = 'test_dataset/real_photos_expanded';
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Status ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          const stat = fs.statSync(dest);
          if (stat.size < 1000) {
            fs.unlinkSync(dest);
            reject(new Error(`File too small: ${stat.size} bytes`));
          } else {
            resolve(stat.size);
          }
        });
      });
    });
    req.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      fs.unlink(dest, () => {});
      reject(new Error('Timeout'));
    });
  });
}

const realImages = [
  { name: "real_nature_mountain.jpg", url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1024&q=80" },
  { name: "real_portrait_man.jpg", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1024&q=80" },
  { name: "real_portrait_woman.jpg", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1024&q=80" },
  { name: "real_dog_animal.jpg", url: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=1024&q=80" },
  { name: "real_cat_animal.jpg", url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=1024&q=80" },
  { name: "real_car_vehicle.jpg", url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1024&q=80" },
  { name: "real_coffee_table.jpg", url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1024&q=80" },
  { name: "real_architecture_city.jpg", url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1024&q=80" },
  { name: "real_beach_ocean.jpg", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1024&q=80" },
  { name: "real_forest_trees.jpg", url: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1024&q=80" },
  { name: "real_books_library.jpg", url: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1024&q=80" },
  { name: "real_night_city_lights.jpg", url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1024&q=80" }
];

async function main() {
  console.log("Downloading expanded real dataset (12 high-res diverse categories)...");
  let success = 0;
  for (const item of realImages) {
    const dest = path.join(targetDir, item.name);
    try {
      const bytes = await download(item.url, dest);
      console.log(`  ? ${item.name} (${Math.round(bytes/1024)} KB)`);
      success++;
    } catch (e) {
      console.log(`  ? ${item.name}: ${e.message}`);
    }
  }
  console.log(`Downloaded ${success}/${realImages.length} real images.`);
}

main().catch(console.error);
