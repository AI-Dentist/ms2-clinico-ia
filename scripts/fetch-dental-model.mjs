#!/usr/bin/env node
/**
 * Downloads the liodon-ai/dental-panoramic-detector ONNX model (best.onnx) from
 * Hugging Face into models/dental-panoramic/. Computes SHA-256 on first download
 * and stores it as best.onnx.sha256. Subsequent runs verify the stored hash.
 *
 * Usage:
 *   node scripts/fetch-dental-model.mjs
 *
 * Environment:
 *   DENTAL_MODEL_URL   Override the download URL (optional).
 *
 * License: CC-BY-NC-4.0 — non-commercial use only. Attribution required.
 * Model card: https://huggingface.co/liodon-ai/dental-panoramic-detector
 */

import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MODEL_DIR = path.join(REPO_ROOT, 'models', 'dental-panoramic');
const MODEL_PATH = path.join(MODEL_DIR, 'best.onnx');
const HASH_PATH = path.join(MODEL_DIR, 'best.onnx.sha256');
const DEFAULT_URL =
  process.env.DENTAL_MODEL_URL ??
  'https://huggingface.co/liodon-ai/dental-panoramic-detector/resolve/main/best.onnx';

function computeHash(filePath) {
  const data = readFileSync(filePath);
  return createHash('sha256').update(data).digest('hex');
}

async function fetchModel() {
  if (!existsSync(MODEL_DIR)) {
    mkdirSync(MODEL_DIR, { recursive: true });
    console.log(`Created directory: ${MODEL_DIR}`);
  }

  if (existsSync(MODEL_PATH)) {
    if (existsSync(HASH_PATH)) {
      const actual = computeHash(MODEL_PATH);
      const stored = readFileSync(HASH_PATH, 'utf8').trim();
      if (actual === stored) {
        console.log(`Model already present and verified.`);
        console.log(`  Path: ${MODEL_PATH}`);
        console.log(`  SHA-256: ${actual}`);
        return;
      }
      console.warn(`Hash mismatch — expected ${stored}, got ${actual}. Re-downloading…`);
    } else {
      const hash = computeHash(MODEL_PATH);
      writeFileSync(HASH_PATH, hash, 'utf8');
      console.log(`Model present but hash file missing — pinned SHA-256: ${hash}`);
      return;
    }
  }

  console.log(`Downloading model from:\n  ${DEFAULT_URL}`);
  const response = await fetch(DEFAULT_URL, {
    headers: { 'User-Agent': 'ms2-clinico-ia/fetch-dental-model (portfolio, non-commercial)' },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} — ${DEFAULT_URL}`);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const mb = (Number(contentLength) / 1024 / 1024).toFixed(1);
    console.log(`  Size: ${mb} MB`);
  }

  const fileStream = createWriteStream(MODEL_PATH);
  await pipeline(response.body, fileStream);

  const hash = computeHash(MODEL_PATH);
  writeFileSync(HASH_PATH, hash, 'utf8');

  console.log(`Model downloaded successfully.`);
  console.log(`  Path:    ${MODEL_PATH}`);
  console.log(`  SHA-256: ${hash}`);
  console.log(`\nAdd the hash to your CI if you want reproducible builds:`);
  console.log(`  ${hash}  models/dental-panoramic/best.onnx`);
}

fetchModel().catch((err) => {
  console.error(`\nFetch failed: ${err.message}`);
  process.exit(1);
});
