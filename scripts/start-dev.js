import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Configuración explícita de entorno local de desarrollo
process.env.NODE_ENV = 'development';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const nestCliPath = resolve(__dirname, '../node_modules/@nestjs/cli/bin/nest.js');

const child = spawn(process.execPath, [nestCliPath, 'start', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (code !== null) {
    process.exit(code);
  } else if (signal) {
    process.kill(process.pid, signal);
  }
});
