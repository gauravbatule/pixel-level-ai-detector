/**
 * Direct Forensic Analysis on User's Desert Path Pair
 */

import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log(' USER IMAGE PAIR VERIFICATION: DESERT SAND PATH vs RED ROAD     ');
console.log('================================================================\n');

const origPath = path.resolve('public/sand_path_original.jpg');
const editPath = path.resolve('public/sand_path_road_red.png');

const origExists = fs.existsSync(origPath);
const editExists = fs.existsSync(editPath);

console.log(`Original Image (Pictures): ${origExists ? '✓ Found (' + fs.statSync(origPath).size + ' bytes)' : '✗ Missing'}`);
console.log(`Edited Image (Downloads):  ${editExists ? '✓ Found (' + fs.statSync(editPath).size + ' bytes)' : '✗ Missing'}\n`);

console.log('Pair loaded and ready for browser pixel-level forensics at:');
console.log('-> http://localhost:3000');
console.log('Click on the "Your Desert Road Edit" preset button to run full pixel-level detection.\n');
console.log('================================================================');
