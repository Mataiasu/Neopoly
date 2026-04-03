const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');
const gitDir = path.join(repoRoot, '.git');
const stateFile = path.join(gitDir, 'copilot-prompt-commit.json');
const manualCommitScript = path.join(__dirname, 'manual-commit.js');
const rawArgs = process.argv.slice(2);
const flagArgs = new Set(rawArgs.filter(arg => arg.startsWith('--')));
const thresholdArg = rawArgs.find(arg => arg.startsWith('--threshold='));
const messageArg = rawArgs.filter(arg => !arg.startsWith('--')).join(' ').trim();
const threshold = Math.max(1, parseInt((thresholdArg || '').split('=').pop(), 10) || Number(process.env.PROMPT_COMMIT_THRESHOLD || 3) || 3);

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

function readState() {
  try {
    const raw = fs.readFileSync(stateFile, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      count: Number(parsed.count) || 0,
      threshold: Number(parsed.threshold) || threshold,
      lastCommitAt: parsed.lastCommitAt || '',
      lastMessage: parsed.lastMessage || '',
    };
  } catch (_) {
    return { count: 0, threshold, lastCommitAt: '', lastMessage: '' };
  }
}

function writeState(state) {
  if (!fs.existsSync(gitDir)) fs.mkdirSync(gitDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function buildCommitMessage() {
  if (messageArg) return messageArg;
  if (process.env.COMMIT_MESSAGE) return String(process.env.COMMIT_MESSAGE).trim();
  if (process.env.COMMIT_TITLE) return String(process.env.COMMIT_TITLE).trim();
  return 'feat: sortie de la maj majeure NeoPoly';
}

function printUsage() {
  console.log(`Usage:\n  npm run prompt:tick\n  npm run prompt:tick -- \"message optionnel\"\n  npm run prompt:status\n  npm run prompt:reset\n\nOptions:\n  --threshold=3  change le seuil de déclenchement\n  --no-push      commit sans push\n  --amend        remplace le dernier commit quand le seuil est atteint\n  --status       affiche le compteur actuel\n  --reset        remet le compteur à zéro\n  --help         affiche cette aide`);
}

try {
  if (flagArgs.has('--help')) {
    printUsage();
    process.exit(0);
  }

  const state = readState();
  state.threshold = threshold;

  if (flagArgs.has('--reset')) {
    state.count = 0;
    writeState(state);
    console.log(`[${nowLabel()}] Compteur de prompts remis à zéro.`);
    process.exit(0);
  }

  if (flagArgs.has('--status')) {
    console.log(`[${nowLabel()}] Compteur actuel : ${state.count}/${state.threshold}${state.lastCommitAt ? ` • dernier commit auto: ${state.lastCommitAt}` : ''}.`);
    process.exit(0);
  }

  state.count += 1;

  if (state.count < state.threshold) {
    writeState(state);
    console.log(`[${nowLabel()}] Prompt enregistré (${state.count}/${state.threshold}). Commit auto au prochain seuil.`);
    process.exit(0);
  }

  const commitArgs = [manualCommitScript];
  if (flagArgs.has('--no-push')) commitArgs.push('--no-push');
  if (flagArgs.has('--amend')) commitArgs.push('--amend');
  commitArgs.push(buildCommitMessage());

  const result = spawnSync(process.execPath, commitArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    encoding: 'utf8',
  });

  if (result.status === 0) {
    state.count = 0;
    state.lastCommitAt = new Date().toISOString();
    state.lastMessage = buildCommitMessage();
    writeState(state);
    console.log(`[${nowLabel()}] Seuil atteint: commit auto effectué et compteur remis à zéro.`);
    process.exit(0);
  }

  state.count = state.threshold;
  writeState(state);
  process.exit(result.status || 1);
} catch (error) {
  const details = String((error && (error.stderr || error.message)) || error || 'unknown_error').trim();
  console.error(`[${nowLabel()}] Prompt auto-commit échoué : ${details}`);
  process.exit(1);
}
