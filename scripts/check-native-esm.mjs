#!/usr/bin/env node
/**
 * Smoke check for Node.js native ESM startup compatibility.
 *
 * Verifies that compiled production modules can be imported directly by Node's
 * native ESM loader without encountering CommonJS interop SyntaxErrors (e.g.
 * named export mismatches from mongoose).
 *
 * Prerequisites:
 *   Build artifacts must exist in ./dist (run `pnpm run build` or `nest build` first).
 *
 * Invariants:
 *   - No NestJS application bootstrap.
 *   - No database connections (MongoDB/PostgreSQL).
 *   - No network requests or external dependencies.
 *   - No private .env variables required.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

const adapterPath = path.join(
  distDir,
  'modules/consultas-odontologicas/infrastructure/persistence/mongo/unit-of-work-cierre-consulta.adapter.js',
);

const appModulePath = path.join(distDir, 'app.module.js');

// 1. Check build prerequisite
if (!fs.existsSync(distDir)) {
  console.error(
    `[check-native-esm] ERROR: Build directory not found at '${distDir}'.`,
  );
  console.error(
    `[check-native-esm] Prerequisite: Run 'pnpm run build' before executing this check.`,
  );
  process.exit(1);
}

if (!fs.existsSync(adapterPath)) {
  console.error(
    `[check-native-esm] ERROR: Compiled adapter not found at '${adapterPath}'.`,
  );
  console.error(
    `[check-native-esm] Prerequisite: Run 'pnpm run build' before executing this check.`,
  );
  process.exit(1);
}

if (!fs.existsSync(appModulePath)) {
  console.error(
    `[check-native-esm] ERROR: Compiled app.module not found at '${appModulePath}'.`,
  );
  console.error(
    `[check-native-esm] Prerequisite: Run 'pnpm run build' before executing this check.`,
  );
  process.exit(1);
}

try {
  // 2. Perform native dynamic ESM import of the Unit of Work adapter
  const adapterUrl = pathToFileURL(adapterPath).href;
  const adapterMod = await import(adapterUrl);

  if (typeof adapterMod.MongoUnitOfWorkCierreConsultaAdapter !== 'function') {
    throw new Error(
      `Export 'MongoUnitOfWorkCierreConsultaAdapter' is not a class/function in ${adapterPath}`,
    );
  }

  // 3. Perform native dynamic ESM import of AppModule (checks module graph imports)
  const appModuleUrl = pathToFileURL(appModulePath).href;
  const appMod = await import(appModuleUrl);

  if (typeof appMod.AppModule !== 'function') {
    throw new Error(
      `Export 'AppModule' is not a class/function in ${appModulePath}`,
    );
  }

  console.log('[check-native-esm] PASS: Native Node ESM dynamic import succeeded.');
  console.log('  - MongoUnitOfWorkCierreConsultaAdapter: OK');
  console.log('  - AppModule: OK');
  console.log('  - App bootstrap / DB / .env required: NONE');
  process.exit(0);
} catch (err) {
  console.error('[check-native-esm] FAILED: Native Node ESM import error:');
  console.error(err);
  process.exit(1);
}
