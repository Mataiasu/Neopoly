const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
}

walk(ROOT);
files.sort();

if (!files.length) {
  throw new Error('No JavaScript files found.');
}

const failures = [];
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], {
      cwd: ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (error) {
    failures.push({
      file: path.relative(ROOT, file),
      output: String(error.stderr || error.stdout || error.message || error).trim(),
    });
  }
}

console.log(`NeoPoly JS syntax self-test: ${files.length} file(s) checked.`);

if (failures.length) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure.file}\n${failure.output}`);
  }
  process.exit(1);
}

console.log('PASS');
