const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');
const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const runOnce = args.has('--once');
const untilArg = rawArgs.find((arg) => arg.startsWith('--until='));
const intervalArg = rawArgs.find((arg) => arg.startsWith('--interval=') || arg.startsWith('--every='));
const autoPush = !args.has('--no-push') && !['0', 'false', 'no'].includes(String(process.env.AUTO_PUSH || 'true').toLowerCase());
const intervalRaw = intervalArg ? intervalArg.split('=').slice(1).join('=') : (process.env.AUTO_COMMIT_INTERVAL_MINUTES || 20);
const parsedIntervalMinutes = Number(intervalRaw);
const intervalMinutes = Number.isFinite(parsedIntervalMinutes) && parsedIntervalMinutes > 0 ? Math.max(1, parsedIntervalMinutes) : 20;
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

function isGitRepo() {
  try {
    return runGit(['rev-parse', '--is-inside-work-tree']) === 'true';
  } catch (_) {
    return false;
  }
}

function getGitDir() {
  try {
    return path.resolve(repoRoot, runGit(['rev-parse', '--git-dir']) || '.git');
  } catch (_) {
    return path.join(repoRoot, '.git');
  }
}

function hasGitLock() {
  return fs.existsSync(path.join(getGitDir(), 'index.lock'));
}

function pushCurrentBranch(remote, branch) {
  try {
    runGit(['push', remote, branch]);
  } catch (error) {
    const stderr = String((error && error.stderr) || '');
    if (/has no upstream branch|set the remote as upstream/i.test(stderr)) {
      runGit(['push', '-u', remote, branch]);
      return;
    }
    throw error;
  }
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
    if (!isGitRepo()) {
      throw new Error('Ce dossier n\'est pas un dépôt git.');
    }
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
        pushCurrentBranch(remote, branch);
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
