import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Write temporary image to disk
    const tmpDir = os.tmpdir();
    const ext = file.name ? path.extname(file.name) || '.png' : '.png';
    const tmpFile = path.join(tmpDir, `ai_detect_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
    fs.writeFileSync(tmpFile, buffer);

    const scriptPath = path.resolve('scripts/detect.py');

    // Run Python detection engine
    const resultJson = await new Promise((resolve, reject) => {
      const proc = spawn('py', [scriptPath, tmpFile]);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        // Clean up temp file
        try { fs.unlinkSync(tmpFile); } catch (e) {}

        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        } else {
          try {
            const parsed = JSON.parse(stdout.trim());
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Failed to parse Python output: ${e.message}\nOutput was: ${stdout}`));
          }
        }
      });
    });

    return NextResponse.json(resultJson);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
