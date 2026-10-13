const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

console.log('======================================================');
console.log('  ETHIOHIGHHUB - FULL-STACK DEV SERVERS');
console.log('======================================================');
console.log('🚀 Launching Backend API (port 5000)...');
console.log('🚀 Launching Frontend App (port 5173)...\n');

const backend = spawn('npm', ['--prefix', 'backend', 'run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

const frontend = spawn('npm', ['--prefix', 'frontend', 'run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

let isShuttingDown = false;
function handleExit() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n🛑 Shutting down development servers...');
  try {
    backend.kill('SIGINT');
  } catch (e) {}
  try {
    frontend.kill('SIGINT');
  } catch (e) {}
  process.exit();
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

backend.on('close', (code) => {
  if (!isShuttingDown && code !== 0) {
    console.log(`Backend process exited with code ${code}`);
  }
});

frontend.on('close', (code) => {
  if (!isShuttingDown && code !== 0) {
    console.log(`Frontend process exited with code ${code}`);
  }
});
