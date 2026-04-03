const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');
const rawArgs = process.argv.slice(2);
const flagArgs = new Set(rawArgs.filter(arg => arg.startsWith('--')));
const messageArg = rawArgs.filter(arg => !arg.startsWith('--')).join(' ').trim();
const autoPush = !flagArgs.has('--no-push');
const amendCommit = flagArgs.has('--amend');

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
  if (messageArg) return messageArg;
  if (process.env.COMMIT_MESSAGE) return String(process.env.COMMIT_MESSAGE).trim();
  if (process.env.COMMIT_TITLE) return String(process.env.COMMIT_TITLE).trim();
  return 'feat: sortie de la maj majeure NeoPoly';
}

function printUsage() {
  console.log(`Usage:\n  npm run commit:now -- \"ton message\"\n  npm run commit:local -- \"sauvegarde locale\"\n  npm run prompt:tick\n\nOptions:\n  --no-push   commit sans push\n  --amend     remplace le dernier commit\n  --help      affiche cette aide\n\nAstuce:\n  utilise \"npm run prompt:tick\" après chaque demande ; au 3e passage, le commit part tout seul.`);
}

function hasGitLock() {
  return fs.existsSync(path.join(repoRoot, '.git', 'index.lock'));
}

try {
  if (flagArgs.has('--help')) {
    printUsage();
    process.exit(0);
  }

  if (hasGitLock()) {
    throw new Error('Git est occupé (index.lock présent). Réessaie dans un instant.');
  }

  const changes = getStatusLines();
  if (!changes.length) {
    console.log(`[${nowLabel()}] Aucun changement détecté.`);
    process.exit(0);
  }

  const message = buildCommitMessage();
  console.log(`[${nowLabel()}] ${changes.length} changement(s) détecté(s).`);

  runGit(['add', '-A']);

  try {
    if (amendCommit) runGit(['commit', '--amend', '-m', message]);
    else runGit(['commit', '-m', message]);
  } catch (error) {
    const stderr = String((error && error.stderr) || '');
    if (/nothing to commit/i.test(stderr)) {
      console.log(`[${nowLabel()}] Rien à commit après ajout.`);
      process.exit(0);
    }
    throw error;
  }

  console.log(`[${nowLabel()}] Commit créé : ${message}`);

  if (autoPush) {
    const remote = getFirstRemote();
    if (remote) {
      const branch = getBranchName();
      const pushArgs = amendCommit
        ? ['push', '--force-with-lease', remote, branch]
        : ['push', remote, branch];
      runGit(pushArgs);
      console.log(`[${nowLabel()}] Push effectué vers ${remote}/${branch}.`);
    } else {
      console.log(`[${nowLabel()}] Aucun remote trouvé, push ignoré.`);
    }
  } else {
    console.log(`[${nowLabel()}] Push désactivé (--no-push).`);
  }
} catch (error) {
  const details = String((error && (error.stderr || error.message)) || error || 'unknown_error').trim();
  console.error(`[${nowLabel()}] Commit manuel échoué : ${details}`);
  process.exit(1);
}
