#!/usr/bin/env node
/**
 * Downloads the liodon-ai/dental-panoramic-detector ONNX model (best.onnx) from
 * Hugging Face into models/dental-panoramic/. Validates file against pinned SHA-256.
 *
 * Usage:
 *   node scripts/fetch-dental-model.mjs
 *
 * Environment:
 *   DENTAL_MODEL_URL      Override download URL (requires DENTAL_MODEL_SHA256).
 *   DENTAL_MODEL_SHA256   Override expected SHA-256 hash.
 *
 * License: CC-BY-NC-4.0 — non-commercial use only. Attribution required.
 * Model card: https://huggingface.co/liodon-ai/dental-panoramic-detector
 */

import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MODEL_DIR = path.join(REPO_ROOT, 'models', 'dental-panoramic');
const MODEL_PATH = path.join(MODEL_DIR, 'best.onnx');
const HASH_PATH = path.join(MODEL_DIR, 'best.onnx.sha256');

export const PINNED_SHA256 =
  '4cee38b54203634d895ed30a8910f5d7c4cefe22b18f9116b5561d9dd6e83a71';

if (process.env.DENTAL_MODEL_URL && !process.env.DENTAL_MODEL_SHA256) {
  console.error(
    'Error: DENTAL_MODEL_URL override requires DENTAL_MODEL_SHA256 to be set.',
  );
  process.exit(1);
}

const EXPECTED_SHA256 = (
  process.env.DENTAL_MODEL_SHA256 ?? PINNED_SHA256
).toLowerCase().trim();

const DOWNLOAD_URL =
  process.env.DENTAL_MODEL_URL ??
  'https://huggingface.co/liodon-ai/dental-panoramic-detector/resolve/main/best.onnx';

function computeHash(filePath) {
  const data = readFileSync(filePath);
  return createHash('sha256').update(data).digest('hex').toLowerCase();
}

async function fetchModel() {
  if (!existsSync(MODEL_DIR)) {
    mkdirSync(MODEL_DIR, { recursive: true });
    console.log(`Created directory: ${MODEL_DIR}`);
  }

  if (existsSync(MODEL_PATH)) {
    const actual = computeHash(MODEL_PATH);
    if (actual === EXPECTED_SHA256) {
      console.log(`Model already present and verified against authorized SHA-256.`);
      console.log(`  Path: ${MODEL_PATH}`);
      console.log(`  SHA-256: ${actual}`);
      writeFileSync(HASH_PATH, EXPECTED_SHA256 + '\n', 'utf8');
      return;
    }
    console.warn(
      `Hash mismatch for existing model file — expected ${EXPECTED_SHA256}, got ${actual}. Deleting untrusted file and re-downloading…`,
    );
    try {
      unlinkSync(MODEL_PATH);
    } catch {}
    if (existsSync(HASH_PATH)) {
      try {
        unlinkSync(HASH_PATH);
      } catch {}
    }
  }

  console.log(`Downloading model from:\n  ${DOWNLOAD_URL}`);
  const response = await fetch(DOWNLOAD_URL, {
    headers: { 'User-Agent': 'ms2-clinico-ia/fetch-dental-model (portfolio, non-commercial)' },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} — ${DOWNLOAD_URL}`);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const mb = (Number(contentLength) / 1024 / 1024).toFixed(1);
    console.log(`  Size: ${mb} MB`);
  }

  const fileStream = createWriteStream(MODEL_PATH);
  await pipeline(response.body, fileStream);

  const downloadedHash = computeHash(MODEL_PATH);
  if (downloadedHash !== EXPECTED_SHA256) {
    try {
      unlinkSync(MODEL_PATH);
    } catch {}
    if (existsSync(HASH_PATH)) {
      try {
        unlinkSync(HASH_PATH);
      } catch {}
    }
    console.error(
      `Download verification failed: SHA-256 mismatch!\n  Expected: ${EXPECTED_SHA256}\n  Got:      ${downloadedHash}\nDeleted untrusted file.`,
    );
    process.exit(1);
  }

  writeFileSync(HASH_PATH, EXPECTED_SHA256 + '\n', 'utf8');

  console.log(`Model downloaded and verified successfully.`);
  console.log(`  Path:    ${MODEL_PATH}`);
  console.log(`  SHA-256: ${downloadedHash}`);
}

fetchModel().catch((err) => {
  console.error(`\nFetch failed: ${err.message}`);
  process.exit(1);
});
