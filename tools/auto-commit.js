const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');
const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const runOnce = args.has('--once');
const untilArg = rawArgs.find((arg) => arg.startsWith('--until='));
const autoPush = !args.has('--no-push') && !['0', 'false', 'no'].includes(String(process.env.AUTO_PUSH || 'true').toLowerCase());
const intervalMinutes = Math.max(1, Number(process.env.AUTO_COMMIT_INTERVAL_MINUTES || 20));
const intervalMs = intervalMinutes * 60 * 1000;
const untilValue = String(untilArg ? untilArg.split('=').slice(1).join('=') : (process.env.AUTO_COMMIT_UNTIL || '')).trim();

function parseUntilTime(value) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(value || '').trim());
  if (!match) return null;
  const now = new Date();
  const target = new Date(now);
  target.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return {
    label: `${String(match[1]).padStart(2, '0')}:${match[2]}`,
    time: target.getTime(),
  };
}

const stopAt = parseUntilTime(untilValue);

function shouldStopWatcher() {
  return !!(stopAt && Date.now() >= stopAt.time);
}

function nowLabel() {
  return new Date().toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function runGit(commandArgs) {
  return execFileSync('git', commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function hasGitLock() {
  return fs.existsSync(path.join(repoRoot, '.git', 'index.lock'));
}

function getStatusLines() {
  const raw = runGit(['status', '--porcelain']);
  return raw ? raw.split(/\r?\n/).filter(Boolean) : [];
}

function getBranchName() {
  return runGit(['branch', '--show-current']) || 'main';
}

function getFirstRemote() {
  const raw = runGit(['remote']);
  const remotes = raw ? raw.split(/\r?\n/).filter(Boolean) : [];
  return remotes[0] || '';
}

function buildCommitMessage() {
  if (process.env.COMMIT_MESSAGE) return String(process.env.COMMIT_MESSAGE).trim();
  if (process.env.COMMIT_TITLE) return String(process.env.COMMIT_TITLE).trim();
  return 'feat: sortie de la maj majeure NeoPoly';
}

function tick() {
  try {
    if (shouldStopWatcher()) {
      console.log(`[${nowLabel()}] Stop time reached (${stopAt.label}), auto-commit watcher stopped.`);
      if (typeof process !== 'undefined' && typeof process.exit === 'function') process.exit(0);
      return;
    }
    if (hasGitLock()) {
      console.log(`[${nowLabel()}] Git busy, auto-commit skipped.`);
      return;
    }

    const changes = getStatusLines();
    if (!changes.length) {
      console.log(`[${nowLabel()}] No changes detected.`);
      return;
    }

    console.log(`[${nowLabel()}] ${changes.length} change(s) detected. Auto-commit in progress...`);
    runGit(['add', '-A']);

    const message = buildCommitMessage();
    try {
      runGit(['commit', '-m', message]);
    } catch (error) {
      const stderr = String(error && error.stderr || '');
      if (/nothing to commit/i.test(stderr)) {
        console.log(`[${nowLabel()}] Nothing to commit after staging.`);
        return;
      }
      throw error;
    }

    console.log(`[${nowLabel()}] Commit created: ${message}`);

    if (autoPush) {
      const remote = getFirstRemote();
      if (remote) {
        const branch = getBranchName();
        runGit(['push', remote, branch]);
        console.log(`[${nowLabel()}] Pushed to ${remote}/${branch}.`);
      } else {
        console.log(`[${nowLabel()}] No remote found, push skipped.`);
      }
    }
  } catch (error) {
    const details = String((error && (error.stderr || error.message)) || error || 'unknown_error').trim();
    console.error(`[${nowLabel()}] Auto-commit failed: ${details}`);
  }
}

console.log(`[${nowLabel()}] Auto-commit watcher active every ${intervalMinutes} minute(s)${autoPush ? ' with auto-push' : ''}${stopAt ? ` until ${stopAt.label}` : ''}.`);
tick();
if (!runOnce) {
  const timer = setInterval(() => {
    if (shouldStopWatcher()) {
      console.log(`[${nowLabel()}] Stop time reached (${stopAt.label}), auto-commit watcher stopped.`);
      clearInterval(timer);
      return;
    }
    tick();
  }, intervalMs);
}
