const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');
const path = require('path');
const { URL } = require('url');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT || process.env.HTTP_PORT || process.env.WS_PORT || 3000);
const ROOT_DIR = __dirname;
const GOOGLE_CONFIG_PATH = path.join(ROOT_DIR, 'assets', 'google-config.js');

// ── Profile persistent storage ────────────────────────────────────────────────
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PROFILES_DB_PATH = path.join(DATA_DIR, 'profiles.json');
const MODERATION_DB_PATH = path.join(DATA_DIR, 'moderation.json');

function loadProfilesDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(PROFILES_DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(PROFILES_DB_PATH, 'utf8')) || {};
  } catch (_) { return {}; }
}

function saveProfilesDb(db) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = PROFILES_DB_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, PROFILES_DB_PATH);
  } catch (_) {}
}

function sanitizeStr(v, maxLen) {
  return typeof v === 'string' ? v.slice(0, maxLen) : '';
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase().slice(0, 160);
}

function sanitizeProfilePayload(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return {
    uid:        sanitizeStr(raw.uid, 128),
    googleSub:  sanitizeStr(raw.googleSub, 128),
    name:       sanitizeStr(raw.name, 64),
    avatar:     sanitizeStr(raw.avatar, 4096),
    avatarImg:  sanitizeStr(raw.avatarImg, 4096),
    emoji:      sanitizeStr(raw.emoji, 16),
    color:      sanitizeStr(raw.color, 32),
    title:      sanitizeStr(raw.title, 64),
    bio:        sanitizeStr(raw.bio, 300),
    elo:        Math.max(0, Math.min(999999, parseInt(raw.elo, 10) || 0)),
    rankLabel:  sanitizeStr(raw.rankLabel, 64),
    wins:       Math.max(0, Math.min(999999, parseInt(raw.wins, 10) || 0)),
    losses:     Math.max(0, Math.min(999999, parseInt(raw.losses, 10) || 0)),
    gamesPlayed:Math.max(0, Math.min(999999, parseInt(raw.gamesPlayed, 10) || 0)),
    totalMoney: Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Number(raw.totalMoney) || 0)),
    friends:    Array.isArray(raw.friends) ? raw.friends.slice(0, 200).map(f => sanitizeStr(f, 128)) : [],
    badges:     Array.isArray(raw.badges)  ? raw.badges.slice(0, 100).map(b => sanitizeStr(b, 64))   : [],
    unlockedTitles: Array.isArray(raw.unlockedTitles) ? raw.unlockedTitles.slice(0, 100).map(t => sanitizeStr(t, 64)) : [],
  };
}

function getProfileStorageKey(uid, googleSub) {
  if (googleSub && typeof googleSub === 'string' && googleSub.trim()) {
    return 'gsub:' + googleSub.trim().slice(0, 128);
  }
  return 'uid:' + String(uid || '').trim().slice(0, 128);
}

function getGoogleBoundUid(sub) {
  const raw = sanitizeStr(sub, 128);
  if (!raw) return '';
  return 'npg_' + raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 72);
}

function resetProfileStatsInDb(identity) {
  const uid = sanitizeStr(identity && identity.uid, 128);
  const googleSub = sanitizeStr(identity && identity.googleSub, 128);
  const keys = Array.from(new Set([
    getProfileStorageKey(uid, googleSub),
    uid ? getProfileStorageKey(uid, '') : '',
  ].filter(Boolean)));
  if (!keys.length) return false;
  const db = loadProfilesDb();
  let changed = false;
  keys.forEach((key) => {
    const entry = db[key];
    if (!entry || !entry.profile || typeof entry.profile !== 'object') return;
    db[key] = {
      profile: Object.assign({}, entry.profile, {
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        totalMoney: 0,
        badges: [],
        unlockedTitles: [],
      }),
      updatedAt: Date.now(),
    };
    changed = true;
  });
  if (changed) saveProfilesDb(db);
  return changed;
}

const DEFAULT_ADMIN_EMAILS = [
  'matprize055@gmail.com',
];
const ADMIN_EMAILS = new Set(
  DEFAULT_ADMIN_EMAILS
    .concat(String(process.env.ADMIN_EMAILS || '').split(','))
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean)
);

function loadModerationDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(MODERATION_DB_PATH)) return { users: {} };
    const parsed = JSON.parse(fs.readFileSync(MODERATION_DB_PATH, 'utf8')) || {};
    return {
      users: parsed && typeof parsed.users === 'object' && parsed.users ? parsed.users : {},
    };
  } catch (_) {
    return { users: {} };
  }
}

function saveModerationDb(db) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = MODERATION_DB_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, MODERATION_DB_PATH);
  } catch (_) {}
}

function getModerationKeys(identity) {
  const keys = [];
  const uid = sanitizeStr(identity && identity.uid, 128);
  const googleSub = sanitizeStr(identity && identity.googleSub, 128);
  const email = normalizeEmail(identity && identity.email);
  if (googleSub) keys.push('gsub:' + googleSub);
  if (email) keys.push('email:' + email);
  if (uid) keys.push('uid:' + uid);
  return Array.from(new Set(keys));
}

function getModerationState(identity) {
  const db = loadModerationDb();
  const keys = getModerationKeys(identity);
  const state = { muted: false, banned: false, reason: '', updatedAt: 0, profileResetAt: 0 };
  keys.forEach((key) => {
    const entry = db.users[key];
    if (!entry || typeof entry !== 'object') return;
    state.muted = state.muted || !!entry.muted;
    state.banned = state.banned || !!entry.banned;
    state.profileResetAt = Math.max(state.profileResetAt, Number(entry.profileResetAt || 0));
    const entryUpdatedAt = Number(entry.updatedAt || 0);
    if (entryUpdatedAt >= state.updatedAt) {
      state.reason = sanitizeStr(entry.reason, 160) || state.reason;
      state.updatedAt = entryUpdatedAt;
    }
  });
  return {
    isAdmin: ADMIN_EMAILS.has(normalizeEmail(identity && identity.email)),
    muted: !!state.muted,
    banned: !!state.banned,
    reason: state.reason || '',
    updatedAt: Number(state.updatedAt || 0),
    profileResetAt: Number(state.profileResetAt || 0),
  };
}

function updateModerationState(identity, patch, actor) {
  const keys = getModerationKeys(identity);
  if (!keys.length) return null;
  const current = getModerationState(identity);
  const next = {
    muted: patch && patch.muted === undefined ? current.muted : !!(patch && patch.muted),
    banned: patch && patch.banned === undefined ? current.banned : !!(patch && patch.banned),
    reason: sanitizeStr(patch && patch.reason !== undefined ? patch.reason : current.reason, 160),
    profileResetAt: patch && patch.profileResetAt === undefined ? Number(current.profileResetAt || 0) : Math.max(0, Number(patch && patch.profileResetAt || 0)),
    updatedAt: Date.now(),
    updatedBy: sanitizeStr(actor && actor.uid, 128) || 'admin',
  };
  const db = loadModerationDb();
  keys.forEach((key) => {
    db.users[key] = next;
  });
  saveModerationDb(db);
  return next;
}
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
const GOOGLE_RECENT_AUTH_ATTEMPTS = [];
const GOOGLE_MAX_AUTH_ATTEMPTS = 20;

function loadGoogleClientIdFromFile() {
  try {
    const raw = fs.readFileSync(GOOGLE_CONFIG_PATH, 'utf8');
    const match = raw.match(/NEOPOLY_GOOGLE_CLIENT_ID\s*=\s*['"]([^'"]*)['"]/);
    return match ? String(match[1]).trim() : '';
  } catch (_) {
    return '';
  }
}

const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || loadGoogleClientIdFromFile() || '').trim();
const SESSION_SECRET = String(process.env.SESSION_SECRET || GOOGLE_CLIENT_SECRET || crypto.randomBytes(32).toString('hex')).trim();
const SESSION_TTL_MS = Math.max(15 * 60 * 1000, Number(process.env.SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000));
const STATIC_PUBLIC_ROOT_FILES = new Set(['/test1.html', '/privacy.html', '/terms.html', '/favicon.ico']);
const STATIC_PUBLIC_PREFIXES = ['assets/', 'addons/'];
const STATIC_PRIVATE_PATTERNS = [
  /^\/data\//i,
  /^\/tools\//i,
  /^\/memories\//i,
  /^\/\.git(?:\/|$)/i,
  /^\/\.env/i,
  /^\/server\.js$/i,
  /^\/package(?:-lock)?\.json$/i,
  /^\/render\.yaml$/i,
  /^\/todo-neopoly\.md$/i,
];

function toBase64Url(value) {
  return Buffer.from(String(value || ''), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
  return Buffer.from(normalized + pad, 'base64').toString('utf8');
}

function signSessionValue(value) {
  return crypto.createHmac('sha256', SESSION_SECRET)
    .update(String(value || ''))
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createSessionToken(profile) {
  const now = Date.now();
  const payload = {
    sub: sanitizeStr(profile && profile.sub, 128),
    email: normalizeEmail(profile && profile.email),
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  return `${encoded}.${signSessionValue(encoded)}`;
}

function verifySessionToken(token) {
  const raw = String(token || '').trim();
  if (!raw || raw.indexOf('.') === -1) return null;
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const encoded = parts[0];
  const signature = parts[1];
  const expected = signSessionValue(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(fromBase64Url(encoded));
    if (!payload || typeof payload !== 'object') return null;
    const exp = Number(payload.exp || 0);
    if (!exp || exp < Date.now()) return null;
    return {
      sub: sanitizeStr(payload.sub, 128),
      email: normalizeEmail(payload.email),
      iat: Number(payload.iat || 0),
      exp,
    };
  } catch (_) {
    return null;
  }
}

function getTrustedSession(body) {
  return verifySessionToken(body && (body.sessionToken || body.googleSessionToken));
}

const rooms = {};
const roomAddons = {};
const roomMeta = {};
const activeOnlineIdentities = new Map();
const MAX_ROOM_PLAYERS = 6;
const SOCIAL_ROOM_ID = 'social-lobby';
const SOCIAL_CHAT_AUTO_CLEAR_MS = 5 * 60 * 1000;

const CFG_BOUNDS = {
  eventChance:    [0, 100],
  blitzTimer:     [10, 300],
  blitzMaxTurns:  [5, 200],
  blitzRentMult:  [100, 400],
  loanAmount:     [50, 5000],
  loanInterest:   [0, 200],
  loanRepayTurns: [1, 30],
};

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
};

function isHostId(id) {
  return typeof id === 'string' && id.startsWith('h-');
}

function clampCfg(key, value, fallback) {
  const bounds = CFG_BOUNDS[key];
  const num = Number(value);
  if (!bounds) return fallback;
  if (!Number.isFinite(num)) return fallback;
  return Math.max(bounds[0], Math.min(bounds[1], num));
}

function createDefaultAddonState() {
  return {
    seasons: false,
    loans: false,
    perf: false,
    auctions: false,
    events: false,
    powerups: false,
    blitz: false,
    cfg: {
      eventChance: 20,
      blitzTimer: 30,
      blitzMaxTurns: 30,
      blitzRentMult: 150,
      loanAmount: 400,
      loanInterest: 25,
      loanRepayTurns: 6,
    },
    meta: {
      version: 0,
      updatedAt: 0,
      updatedBy: 'server',
      source: 'server',
    },
  };
}

function sanitizeAddonPatch(rawPatch, previousState) {
  const prev = previousState || createDefaultAddonState();
  const patch = rawPatch && typeof rawPatch === 'object' ? rawPatch : {};
  return {
    seasons: patch.seasons === undefined ? prev.seasons : !!patch.seasons,
    loans: patch.loans === undefined ? prev.loans : !!patch.loans,
    perf: patch.perf === undefined ? prev.perf : !!patch.perf,
    auctions: patch.auctions === undefined ? prev.auctions : !!patch.auctions,
    events: patch.events === undefined ? prev.events : !!patch.events,
    powerups: patch.powerups === undefined ? prev.powerups : !!patch.powerups,
    blitz: patch.blitz === undefined ? prev.blitz : !!patch.blitz,
    cfg: {
      eventChance:    clampCfg('eventChance',    patch.cfg && patch.cfg.eventChance,    prev.cfg.eventChance),
      blitzTimer:     clampCfg('blitzTimer',     patch.cfg && patch.cfg.blitzTimer,     prev.cfg.blitzTimer),
      blitzMaxTurns:  clampCfg('blitzMaxTurns',  patch.cfg && patch.cfg.blitzMaxTurns,  prev.cfg.blitzMaxTurns),
      blitzRentMult:  clampCfg('blitzRentMult',  patch.cfg && patch.cfg.blitzRentMult,  prev.cfg.blitzRentMult),
      loanAmount:     clampCfg('loanAmount',     patch.cfg && patch.cfg.loanAmount,     prev.cfg.loanAmount),
      loanInterest:   clampCfg('loanInterest',   patch.cfg && patch.cfg.loanInterest,   prev.cfg.loanInterest),
      loanRepayTurns: clampCfg('loanRepayTurns', patch.cfg && patch.cfg.loanRepayTurns, prev.cfg.loanRepayTurns),
    },
  };
}

function sendJson(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function ensureRoomMeta(room) {
  if (!roomMeta[room]) {
    roomMeta[room] = {
      hostSender: null,
      hostName: '',
      hostEmoji: '👤',
      playerCount: 0,
      started: false,
      isPrivate: false,
      roomPassword: '',
      updatedAt: 0,
      hidden: false,
    };
  }
  return roomMeta[room];
}

function updateRoomMetaFromState(room, state) {
  const meta = ensureRoomMeta(room);
  const players = Array.isArray(state && state.players) ? state.players : [];
  const activePlayers = players.filter((player) => player && !player.disconnected);

  if (players.length) {
    meta.playerCount = activePlayers.length || players.length;
    const host = players.find((player) => isHostId(player && player.id));
    if (host) {
      meta.hostSender = host.id || meta.hostSender;
      meta.hostName = host.name || meta.hostName;
      meta.hostEmoji = host.emoji || meta.hostEmoji;
    }
  }

  if (state && typeof state.started !== 'undefined') {
    meta.started = !!state.started;
  }

  meta.updatedAt = Date.now();
  return meta;
}

function getActiveAddonList(room) {
  const state = roomAddons[room] || createDefaultAddonState();
  const mapping = [
    ['seasons', 'Saisons'],
    ['loans', 'Prets'],
    ['perf', 'Perf'],
    ['auctions', 'Encheres'],
    ['events', 'Evenements'],
    ['powerups', 'Power-ups'],
    ['blitz', 'Blitz'],
  ];
  return mapping.filter(([key]) => !!state[key]).map(([, label]) => label);
}

function getRoomPassword(input) {
  return String(input || '').trim().slice(0, 64);
}

function getRoomSummary(room) {
  const meta = ensureRoomMeta(room);
  const activeConnections = rooms[room] ? rooms[room].size : 0;
  const playerCount = meta.playerCount > 0 ? meta.playerCount : activeConnections;
  const activeAddons = getActiveAddonList(room);
  const availableSlots = Math.max(0, MAX_ROOM_PLAYERS - playerCount);
  const hasPassword = !!meta.roomPassword;

  return {
    room,
    hostName: meta.hostName || 'Hote',
    hostEmoji: meta.hostEmoji || '👤',
    playerCount,
    maxPlayers: MAX_ROOM_PLAYERS,
    availableSlots,
    started: !!meta.started,
    status: meta.started ? 'in_progress' : 'waiting',
    boardName: 'Classique',
    activeAddons,
    isPrivate: !!meta.isPrivate || hasPassword,
    access: (!!meta.isPrivate || hasPassword) ? 'private' : 'public',
    hasPassword,
    updatedAt: meta.updatedAt || Date.now(),
  };
}

function listPublicRooms() {
  return Object.keys(rooms)
    .filter((room) => {
      const meta = ensureRoomMeta(room);
      return !meta.hidden && room !== SOCIAL_ROOM_ID;
    })
    .map((room) => getRoomSummary(room))
    .sort((a, b) => {
      if (a.started !== b.started) return Number(a.started) - Number(b.started);
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
}

function broadcastToRoom(room, payload) {
  if (!rooms[room]) return;
  const encoded = JSON.stringify(payload);
  rooms[room].forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(encoded);
    }
  });
}

function getOnlineIdentityKey(msg, session) {
  const googleSub = sanitizeStr(msg && (msg.googleSub || (session && session.sub)), 128);
  if (googleSub) return 'gsub:' + googleSub;
  const email = normalizeEmail(msg && (msg.email || (session && session.email)));
  if (email) return 'email:' + email;
  const uid = sanitizeStr(msg && (msg.uid || msg.userId || msg.profileUid), 128);
  if (uid) return 'uid:' + uid;
  return '';
}

function getOnlineIdentityClaim(identityKey) {
  const key = String(identityKey || '').trim();
  if (!key) return null;
  const claim = activeOnlineIdentities.get(key);
  if (!claim) return null;
  if (!claim.ws || claim.ws.readyState !== WebSocket.OPEN) {
    activeOnlineIdentities.delete(key);
    return null;
  }
  return claim;
}

function claimOnlineIdentity(identityKey, room, ws, options) {
  const key = String(identityKey || '').trim();
  const roomId = String(room || '').trim();
  const opts = options && typeof options === 'object' ? options : {};
  if (!key || !roomId || roomId === SOCIAL_ROOM_ID) return { ok: true };
  const previousKey = String(ws && ws.__onlineIdentityKey || '').trim();
  if (previousKey && previousKey !== key) activeOnlineIdentities.delete(previousKey);
  const existing = getOnlineIdentityClaim(key);
  if (existing && existing.ws !== ws) {
    const sameRoom = String(existing.room || '').trim() === roomId;
    if (!(opts.allowReconnect && sameRoom)) {
      return { ok: false, room: existing.room || '', joinedAt: Number(existing.joinedAt || 0) };
    }
    try { existing.ws.close(4001, 'replaced_by_reconnect'); } catch (_) {}
    activeOnlineIdentities.delete(key);
  }
  activeOnlineIdentities.set(key, { ws, room: roomId, joinedAt: Date.now() });
  ws.__onlineIdentityKey = key;
  ws.__onlineRoom = roomId;
  return { ok: true, room: roomId };
}

function releaseOnlineIdentityForSocket(ws) {
  const key = String(ws && ws.__onlineIdentityKey || '').trim();
  if (!key) return;
  const existing = activeOnlineIdentities.get(key);
  if (!existing || existing.ws === ws) activeOnlineIdentities.delete(key);
  try {
    delete ws.__onlineIdentityKey;
    delete ws.__onlineRoom;
  } catch (_) {}
}

function ensureSocialRoom() {
  if (!rooms[SOCIAL_ROOM_ID]) rooms[SOCIAL_ROOM_ID] = new Set();
  const socialMeta = ensureRoomMeta(SOCIAL_ROOM_ID);
  socialMeta.hidden = true;
  socialMeta.hostName = 'Chat social';
  socialMeta.started = false;
  socialMeta.isPrivate = false;
  socialMeta.updatedAt = Date.now();
  return socialMeta;
}

function broadcastSocialClear(payload) {
  ensureSocialRoom();
  broadcastToRoom(SOCIAL_ROOM_ID, Object.assign({
    type: 'social_clear',
    room: SOCIAL_ROOM_ID,
    clearedAt: Date.now(),
    auto: false,
    by: 'admin',
  }, payload || {}));
}

function broadcastSocialProfileReset(payload) {
  ensureSocialRoom();
  broadcastToRoom(SOCIAL_ROOM_ID, Object.assign({
    type: 'social_profile_reset',
    room: SOCIAL_ROOM_ID,
    resetAt: Date.now(),
    targetUid: '',
    targetName: 'Joueur',
    byUid: '',
    by: 'admin',
  }, payload || {}));
}

ensureSocialRoom();
const socialChatAutoClearTimer = setInterval(() => {
  broadcastSocialClear({ auto: true, by: 'serveur', reason: 'interval' });
}, SOCIAL_CHAT_AUTO_CLEAR_MS);
if (typeof socialChatAutoClearTimer.unref === 'function') socialChatAutoClearTimer.unref();

function buildRequestOrigin(req) {
  const host = String(req && req.headers && req.headers.host || '').trim();
  if (!host) return '';
  const proto = String(req && req.headers && req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  return proto + '://' + host;
}

function getCorsOrigin(req) {
  const origin = String(req && req.headers && req.headers.origin || '').trim();
  if (!origin || origin === 'null') return '*';
  const allowed = new Set([
    buildRequestOrigin(req),
    'http://localhost:' + PORT,
    'http://127.0.0.1:' + PORT,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean));
  String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .forEach((entry) => allowed.add(entry));
  return allowed.has(origin) ? origin : 'null';
}

function writeCorsHeaders(req, res) {
  res.setHeader('Access-Control-Allow-Origin', getCorsOrigin(req));
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function applySecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://api64.ipify.org ws: wss:",
    "frame-src https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com"
  ].join('; '));
}

function sendApiJson(req, res, statusCode, payload) {
  writeCorsHeaders(req, res);
  applySecurityHeaders(req, res);
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('body_too_large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_) {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function recordGoogleAuthAttempt(kind, ok, detail) {
  GOOGLE_RECENT_AUTH_ATTEMPTS.push({
    at: Date.now(),
    kind: String(kind || 'unknown'),
    ok: !!ok,
    detail: String(detail || ''),
  });
  if (GOOGLE_RECENT_AUTH_ATTEMPTS.length > GOOGLE_MAX_AUTH_ATTEMPTS) {
    GOOGLE_RECENT_AUTH_ATTEMPTS.splice(0, GOOGLE_RECENT_AUTH_ATTEMPTS.length - GOOGLE_MAX_AUTH_ATTEMPTS);
  }
}

function httpsJson(urlString, options) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const requestOptions = options || {};
    const requestBody = Object.prototype.hasOwnProperty.call(requestOptions, 'body')
      ? requestOptions.body
      : null;
    const cleanOptions = { ...requestOptions };
    delete cleanOptions.body;

    const req = https.request(url, cleanOptions, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch (_) {
          reject(new Error('invalid_google_json'));
          return;
        }
        if (res.statusCode >= 400) {
          const message = parsed && (parsed.error_description || parsed.error || parsed.message) || 'google_error';
          reject(new Error(message));
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    if (requestBody !== null && requestBody !== undefined) {
      req.write(requestBody);
    }
    req.end();
  });
}

async function verifyGoogleAccessToken(accessToken) {
  const token = String(accessToken || '').trim();
  if (!token) throw new Error('missing_access_token');

  const tokenInfo = await httpsJson(
    'https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token)
  );

  if (!tokenInfo || !tokenInfo.scope || String(tokenInfo.scope).indexOf('email') === -1) {
    throw new Error('missing_email_scope');
  }
  if (GOOGLE_CLIENT_ID && tokenInfo.aud && tokenInfo.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('audience_mismatch');
  }

  const me = await httpsJson('https://www.googleapis.com/oauth2/v3/userinfo', {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token },
  });

  if (!me || !me.email || !me.sub) throw new Error('invalid_google_profile');
  const emailVerified = me.email_verified === true || me.email_verified === 'true';
  if (!emailVerified) throw new Error('email_not_verified');

  return {
    sub: String(me.sub),
    email: String(me.email),
    name: String(me.name || me.given_name || me.email.split('@')[0] || 'Joueur'),
    picture: typeof me.picture === 'string' ? me.picture : '',
    emailVerified: true,
  };
}

async function verifyGoogleIdToken(idToken) {
  const token = String(idToken || '').trim();
  if (!token) throw new Error('missing_id_token');

  const info = await httpsJson(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token)
  );

  if (!info || !info.email || !info.sub) throw new Error('invalid_google_idtoken');
  if (GOOGLE_CLIENT_ID && info.aud && info.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('audience_mismatch');
  }
  if (!(info.email_verified === 'true' || info.email_verified === true)) {
    throw new Error('email_not_verified');
  }

  return {
    sub: String(info.sub),
    email: String(info.email),
    name: String(info.name || info.given_name || info.email.split('@')[0] || 'Joueur'),
    picture: typeof info.picture === 'string' ? info.picture : '',
    emailVerified: true,
  };
}

async function exchangeGoogleCode(code, redirectUri) {
  const authCode = String(code || '').trim();
  const safeRedirectUri = String(redirectUri || '').trim();
  if (!authCode) throw new Error('missing_code');
  if (!safeRedirectUri) throw new Error('missing_redirect_uri');
  if (!GOOGLE_CLIENT_ID) throw new Error('missing_google_client_id');
  if (!GOOGLE_CLIENT_SECRET) throw new Error('google_exchange_not_configured');

  const body = new URLSearchParams({
    code: authCode,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: safeRedirectUri,
    grant_type: 'authorization_code',
  });

  const tokenData = await httpsJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (tokenData && tokenData.id_token) {
    return verifyGoogleIdToken(tokenData.id_token);
  }
  if (tokenData && tokenData.access_token) {
    return verifyGoogleAccessToken(tokenData.access_token);
  }
  throw new Error('invalid_google_exchange_payload');
}

function isAllowedPublicPath(decodedPath) {
  const normalized = '/' + String(decodedPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (STATIC_PRIVATE_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  if (STATIC_PUBLIC_ROOT_FILES.has(normalized)) return true;
  return STATIC_PUBLIC_PREFIXES.some((prefix) => normalized.startsWith('/' + prefix));
}

function isCompressibleMimeType(mimeType) {
  return /^text\//.test(String(mimeType || '')) || /(javascript|json|xml|svg)/i.test(String(mimeType || ''));
}

function getStaticEtag(stats) {
  return `W/"${Number(stats.size || 0).toString(16)}-${Math.floor(Number(stats.mtimeMs || 0)).toString(16)}"`;
}

function getPreferredEncoding(req, mimeType) {
  if (!isCompressibleMimeType(mimeType)) return '';
  const accepted = String(req.headers['accept-encoding'] || '');
  if (/\bbr\b/i.test(accepted)) return 'br';
  if (/\bgzip\b/i.test(accepted)) return 'gzip';
  return '';
}

function pipeStaticFile(req, res, safePath, stats, mimeType) {
  const etag = getStaticEtag(stats);
  const lastModified = stats.mtime.toUTCString();
  const ifNoneMatch = String(req.headers['if-none-match'] || '').trim();
  const ifModifiedSince = Date.parse(String(req.headers['if-modified-since'] || ''));
  if (ifNoneMatch === etag || (Number.isFinite(ifModifiedSince) && ifModifiedSince >= (stats.mtimeMs - 1000))) {
    applySecurityHeaders(req, res);
    res.writeHead(304, {
      'Cache-Control': path.extname(safePath).toLowerCase() === '.html' ? 'no-store' : 'public, max-age=300',
      'ETag': etag,
      'Last-Modified': lastModified,
    });
    res.end();
    return;
  }

  const encoding = getPreferredEncoding(req, mimeType);
  const headers = {
    'Content-Type': mimeType,
    'Cache-Control': path.extname(safePath).toLowerCase() === '.html' ? 'no-store' : 'public, max-age=300',
    'ETag': etag,
    'Last-Modified': lastModified,
  };
  if (!encoding) headers['Content-Length'] = stats.size;
  if (encoding === 'br') headers['Content-Encoding'] = 'br';
  if (encoding === 'gzip') headers['Content-Encoding'] = 'gzip';

  applySecurityHeaders(req, res);
  res.writeHead(200, headers);

  let stream = fs.createReadStream(safePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      applySecurityHeaders(req, res);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    }
    res.end('Server Error');
  });

  if (encoding === 'br') {
    stream = stream.pipe(zlib.createBrotliCompress({
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 },
    }));
  } else if (encoding === 'gzip') {
    stream = stream.pipe(zlib.createGzip({ level: 6 }));
  }

  stream.pipe(res);
}

function serveStatic(req, res, pathname) {
  const relativePath = pathname === '/' ? '/test1.html' : pathname;
  const decoded = decodeURIComponent(relativePath);
  if (!isAllowedPublicPath(decoded)) {
    applySecurityHeaders(req, res);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Forbidden');
    return;
  }
  const safePath = path.normalize(path.join(ROOT_DIR, decoded));
  if (!safePath.startsWith(ROOT_DIR)) {
    applySecurityHeaders(req, res);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Forbidden');
    return;
  }

  fs.stat(safePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      applySecurityHeaders(req, res);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    pipeStaticFile(req, res, safePath, stats, mimeType);
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    writeCorsHeaders(req, res);
    res.writeHead(204);
    res.end();
    return true;
  }

  if (pathname === '/api/google/verify' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const profile = await verifyGoogleAccessToken(body && body.accessToken);
      const sessionToken = createSessionToken(profile);
      recordGoogleAuthAttempt('verify_access_token', true, 'ok');
      sendApiJson(req, res, 200, { ok: true, profile, sessionToken, sessionExpiresAt: Date.now() + SESSION_TTL_MS });
    } catch (err) {
      const errorMessage = err && err.message ? err.message : 'google_verify_failed';
      recordGoogleAuthAttempt('verify_access_token', false, errorMessage);
      sendApiJson(req, res, 400, {
        ok: false,
        error: errorMessage,
      });
    }
    return true;
  }

  if (pathname === '/api/google/verify-idtoken' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const profile = await verifyGoogleIdToken(body && body.idToken);
      const sessionToken = createSessionToken(profile);
      recordGoogleAuthAttempt('verify_id_token', true, 'ok');
      sendApiJson(req, res, 200, { ok: true, profile, sessionToken, sessionExpiresAt: Date.now() + SESSION_TTL_MS });
    } catch (err) {
      const errorMessage = err && err.message ? err.message : 'google_verify_id_failed';
      recordGoogleAuthAttempt('verify_id_token', false, errorMessage);
      sendApiJson(req, res, 400, {
        ok: false,
        error: errorMessage,
      });
    }
    return true;
  }

  if (pathname === '/api/google/exchange-code' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const profile = await exchangeGoogleCode(body && body.code, body && body.redirectUri);
      const sessionToken = createSessionToken(profile);
      recordGoogleAuthAttempt('exchange_code', true, 'ok');
      sendApiJson(req, res, 200, { ok: true, profile, sessionToken, sessionExpiresAt: Date.now() + SESSION_TTL_MS });
    } catch (err) {
      const errorMessage = err && err.message ? err.message : 'google_exchange_failed';
      recordGoogleAuthAttempt('exchange_code', false, errorMessage);
      sendApiJson(req, res, 400, {
        ok: false,
        error: errorMessage,
      });
    }
    return true;
  }

  if (pathname === '/api/google/mode' && req.method === 'GET') {
    sendApiJson(req, res, 200, {
      ok: true,
      popupEnabled: true,
      oneTapEnabled: true,
      redirectEnabled: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
      hasGoogleClientId: !!GOOGLE_CLIENT_ID,
      exchangeCodeEndpoint: '/api/google/exchange-code',
      sessionEnabled: true,
      recommendation: GOOGLE_CLIENT_SECRET
        ? 'popup_or_redirect'
        : 'popup_or_idtoken_only',
    });
    return true;
  }

  if (pathname === '/api/google/status' && req.method === 'GET') {
    const origin = buildRequestOrigin(req) || ('http://localhost:' + PORT);
    sendApiJson(req, res, 200, {
      ok: true,
      server: 'neopoly',
      hasGoogleClientId: !!GOOGLE_CLIENT_ID,
      verifyEndpoint: origin + '/api/google/verify',
      modeEndpoint: origin + '/api/google/mode',
      exchangeCodeEndpoint: origin + '/api/google/exchange-code',
      sessionEnabled: true,
    });
    return true;
  }

  if (pathname === '/api/health' && req.method === 'GET') {
    sendApiJson(req, res, 200, { ok: true, service: 'neopoly-server' });
    return true;
  }

  if (pathname === '/api/profile/get' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const session = getTrustedSession(body);
      if (!session || !session.sub) {
        sendApiJson(req, res, 401, { ok: false, error: 'session_required' });
        return true;
      }
      const uid = sanitizeStr(body && body.uid, 128) || getGoogleBoundUid(session.sub);
      const db = loadProfilesDb();
      const key = getProfileStorageKey(uid, session.sub);
      const entry = db[key];
      if (!entry) { sendApiJson(req, res, 200, { ok: true, profile: null, updatedAt: 0 }); return true; }
      sendApiJson(req, res, 200, { ok: true, profile: entry.profile, updatedAt: entry.updatedAt || 0 });
    } catch (_) { sendApiJson(req, res, 500, { ok: false, error: 'server_error' }); }
    return true;
  }

  if (pathname === '/api/profile/upsert' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const session = getTrustedSession(body);
      if (!session || !session.sub) {
        sendApiJson(req, res, 401, { ok: false, error: 'session_required' });
        return true;
      }
      const uid = sanitizeStr(body && body.uid, 128) || getGoogleBoundUid(session.sub);
      const sanitized = sanitizeProfilePayload(body && body.profile);
      const db = loadProfilesDb();
      const key = getProfileStorageKey(uid, session.sub);
      const existing = db[key];
      const clientUpdatedAt = parseInt(body && body.clientUpdatedAt, 10) || 0;
      const serverUpdatedAt = (existing && existing.updatedAt) || 0;
      let merged;
      if (existing && serverUpdatedAt > clientUpdatedAt && !body.preferServer) {
        merged = existing.profile;
      } else {
        merged = sanitized;
      }
      const now = Date.now();
      db[key] = { profile: merged, updatedAt: now };
      saveProfilesDb(db);
      sendApiJson(req, res, 200, { ok: true, updatedAt: now, profile: merged });
    } catch (_) { sendApiJson(req, res, 500, { ok: false, error: 'server_error' }); }
    return true;
  }

  if (pathname === '/api/profile/leaderboard' && req.method === 'GET') {
    try {
      const limit = Math.max(5, Math.min(30, parseInt((parsedUrl.searchParams.get('limit') || '12'), 10) || 12));
      const db = loadProfilesDb();
      const dedup = new Map();
      Object.values(db).forEach((entry) => {
        if (!entry || !entry.profile || typeof entry.profile !== 'object') return;
        const profile = entry.profile;
        const uid = sanitizeStr(profile.uid, 128);
        const name = sanitizeStr(profile.name, 64);
        const key = uid || (name ? ('name:' + name.toLowerCase()) : '');
        if (!key) return;
        const next = {
          uid,
          name: name || 'Joueur',
          avatar: sanitizeStr(profile.avatar, 4096),
          avatarImg: sanitizeStr(profile.avatarImg, 4096),
          emoji: sanitizeStr(profile.emoji, 16) || '👤',
          color: sanitizeStr(profile.color, 32) || '#22c55e',
          title: sanitizeStr(profile.title, 64),
          rankLabel: sanitizeStr(profile.rankLabel, 64),
          elo: Math.max(0, Math.min(999999, parseInt(profile.elo, 10) || 0)),
          wins: Math.max(0, Math.min(999999, parseInt(profile.wins, 10) || 0)),
          losses: Math.max(0, Math.min(999999, parseInt(profile.losses, 10) || 0)),
          gamesPlayed: Math.max(0, Math.min(999999, parseInt(profile.gamesPlayed, 10) || 0)),
          totalMoney: Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Number(profile.totalMoney) || 0)),
          updatedAt: Math.max(0, Number(entry.updatedAt || 0)),
        };
        const existing = dedup.get(key);
        if (!existing || next.updatedAt >= existing.updatedAt) dedup.set(key, next);
      });
      const allEntries = Array.from(dedup.values());
      const topElo = allEntries
        .slice()
        .sort((a, b) => (b.elo - a.elo) || (b.wins - a.wins) || (b.gamesPlayed - a.gamesPlayed) || (b.updatedAt - a.updatedAt))
        .slice(0, limit);
      const topWins = allEntries
        .slice()
        .sort((a, b) => (b.wins - a.wins) || (b.elo - a.elo) || (b.gamesPlayed - a.gamesPlayed) || (b.updatedAt - a.updatedAt))
        .slice(0, limit);
      sendApiJson(req, res, 200, {
        ok: true,
        total: allEntries.length,
        topElo,
        topWins,
        updatedAt: Date.now(),
      });
    } catch (_) { sendApiJson(req, res, 500, { ok: false, error: 'server_error' }); }
    return true;
  }

  if (pathname === '/api/mod/status' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const session = getTrustedSession(body);
      const state = getModerationState({
        uid: body && body.uid,
        googleSub: session ? session.sub : '',
        email: session ? session.email : '',
      });
      sendApiJson(req, res, 200, {
        ok: true,
        isAdmin: !!(session && state.isAdmin),
        moderation: {
          muted: !!state.muted,
          banned: !!state.banned,
          reason: state.reason || '',
          updatedAt: state.updatedAt || 0,
        },
        profileResetAt: state.profileResetAt || 0,
      });
    } catch (_) {
      sendApiJson(req, res, 500, { ok: false, error: 'server_error' });
    }
    return true;
  }

  if (pathname === '/api/mod/action' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const session = getTrustedSession(body);
      if (!session || !session.email) {
        sendApiJson(req, res, 401, { ok: false, error: 'session_required' });
        return true;
      }
      const adminState = getModerationState({
        uid: body && body.adminUid,
        googleSub: session.sub,
        email: session.email,
      });
      if (!adminState.isAdmin) {
        sendApiJson(req, res, 403, { ok: false, error: 'admin_required' });
        return true;
      }

      const action = String(body && body.action || '').trim().toLowerCase();
      const target = {
        uid: body && body.targetUid,
        googleSub: body && body.targetGoogleSub,
        email: body && body.targetEmail,
      };
      let patch = null;
      if (action === 'mute') patch = { muted: true, reason: body && body.reason };
      if (action === 'unmute') patch = { muted: false, reason: body && body.reason };
      if (action === 'ban') patch = { banned: true, muted: true, reason: body && body.reason };
      if (action === 'unban') patch = { banned: false, muted: false, reason: body && body.reason };
      if (action === 'reset_stats') patch = { profileResetAt: Date.now() };
      if (!patch) {
        sendApiJson(req, res, 400, { ok: false, error: 'invalid_action' });
        return true;
      }

      const moderation = updateModerationState(target, patch, {
        uid: body && body.adminUid,
      });
      if (!moderation) {
        sendApiJson(req, res, 400, { ok: false, error: 'missing_target' });
        return true;
      }

      if (action === 'reset_stats') {
        resetProfileStatsInDb(target);
        broadcastSocialProfileReset({
          resetAt: moderation.profileResetAt || Date.now(),
          targetUid: sanitizeStr(body && body.targetUid, 128),
          targetName: sanitizeStr(body && body.targetName, 80) || sanitizeStr(body && body.targetUid, 80) || 'Joueur',
          byUid: sanitizeStr(body && body.adminUid, 128),
          by: sanitizeStr(session && (session.email || body && body.adminUid), 160) || 'admin',
        });
      }

      sendApiJson(req, res, 200, { ok: true, action, moderation, profileResetAt: moderation.profileResetAt || 0 });
    } catch (_) {
      sendApiJson(req, res, 500, { ok: false, error: 'server_error' });
    }
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, 'http://localhost');
    if (parsed.pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, parsed.pathname);
      if (!handled) sendApiJson(req, res, 404, { ok: false, error: 'not_found' });
      return;
    }
    serveStatic(req, res, parsed.pathname);
  } catch (_) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server Error');
  }
});

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const origin = String(req && req.headers && req.headers.origin || '').trim();
  if (origin && getCorsOrigin(req) === 'null') {
    try { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); } catch (_) {}
    try { socket.destroy(); } catch (_) {}
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  let myRoom = null;
  let mySender = null;
  let roomRegistered = false;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.sender) mySender = msg.sender;
      const senderSession = getTrustedSession(msg);

      if (msg.type === 'room_list_request') {
        sendJson(ws, { type: 'room_list', rooms: listPublicRooms() });
        return;
      }

      if (msg.type === 'join_probe') {
        const roomId = typeof msg.room === 'string' ? msg.room.trim() : '';
        const exists = !!(roomId && rooms[roomId]);
        const roomInfo = exists ? getRoomSummary(roomId) : null;
        const meta = exists ? ensureRoomMeta(roomId) : null;
        const providedPassword = getRoomPassword(msg.password);
        const missingPassword = !!(meta && meta.roomPassword && providedPassword !== meta.roomPassword);
        const identityKey = getOnlineIdentityKey(msg, senderSession);
        const onlineClaim = getOnlineIdentityClaim(identityKey);
        const allowReconnectSameRoom = !!(msg.reconnect && onlineClaim && String(onlineClaim.room || '').trim() === roomId);
        const roomFull = !!(roomInfo && roomInfo.availableSlots <= 0 && !allowReconnectSameRoom);
        const identityBusy = !!(onlineClaim && onlineClaim.ws !== ws && !allowReconnectSameRoom);
        const ok = exists && !missingPassword && !roomFull && !identityBusy;
        sendJson(ws, {
          type: 'join_probe_result',
          room: roomId,
          ok,
          error: !exists ? 'ROOM_NOT_FOUND' : (roomFull ? 'ROOM_FULL' : (missingPassword ? 'ROOM_BAD_PASSWORD' : (identityBusy ? 'ACCOUNT_ALREADY_IN_ROOM' : null))),
          roomInfo,
          activeRoom: identityBusy ? (onlineClaim.room || '') : '',
        });
        return;
      }

      const senderMod = getModerationState({
        uid: msg.uid || msg.playerId || msg.userId || msg.sender,
        googleSub: senderSession ? senderSession.sub : '',
        email: senderSession ? senderSession.email : '',
      });
      const isChatMessage = msg.type === 'social_join' || msg.type === 'social_chat' || msg.type === 'chat';
      const isOnlineAction = msg.type === 'create_room' || msg.type === 'ready' || msg.type === 'state';
      if (isChatMessage && (senderMod.banned || senderMod.muted)) {
        sendJson(ws, {
          type: 'mod_status',
          banned: !!senderMod.banned,
          muted: !!senderMod.muted,
          reason: senderMod.reason || '',
        });
        return;
      }
      if (isOnlineAction && senderMod.banned) {
        sendJson(ws, {
          type: 'mod_status',
          banned: true,
          muted: !!senderMod.muted,
          reason: senderMod.reason || '',
        });
        return;
      }

      const room = msg.room || myRoom;
      if (!room) return;
      myRoom = room;

      if (msg.type === 'create_room') {
        const identityClaim = claimOnlineIdentity(getOnlineIdentityKey(msg, senderSession), room, ws, { allowReconnect: !!msg.reconnect });
        if (!identityClaim.ok) {
          sendJson(ws, {
            type: 'error',
            code: 'ACCOUNT_ALREADY_IN_ROOM',
            room,
            activeRoom: identityClaim.room || '',
            roomInfo: identityClaim.room ? getRoomSummary(identityClaim.room) : null,
          });
          return;
        }
        if (!rooms[room]) rooms[room] = new Set();
        const meta = ensureRoomMeta(room);
        rooms[room].add(ws);
        roomRegistered = true;

        const candidateHost = msg.sender || msg.playerId;
        if (isHostId(candidateHost)) meta.hostSender = candidateHost;
        meta.hostName = msg.hostName || msg.name || meta.hostName || 'Hote';
        meta.hostEmoji = msg.hostEmoji || msg.emoji || meta.hostEmoji || '👤';
        const roomPassword = getRoomPassword(msg.roomPassword);
        meta.roomPassword = roomPassword;
        meta.isPrivate = !!msg.isPrivate || !!roomPassword;
        meta.playerCount = Math.max(1, Number(msg.playerCount) || 1);
        meta.started = !!msg.started;
        meta.updatedAt = Date.now();

        sendJson(ws, { type: 'create_room_ack', room, roomInfo: getRoomSummary(room) });
        return;
      }

      const isSocialMessage = msg.type === 'social_join' || msg.type === 'social_chat' || msg.type === 'social_clear_request';
      if (!rooms[room]) {
        if (isSocialMessage && room === SOCIAL_ROOM_ID) {
          rooms[room] = new Set();
          const socialMeta = ensureRoomMeta(room);
          socialMeta.hidden = true;
          socialMeta.hostName = 'Chat social';
          socialMeta.started = false;
          socialMeta.isPrivate = false;
          socialMeta.updatedAt = Date.now();
        } else {
          sendJson(ws, { type: 'error', code: 'ROOM_NOT_FOUND', room });
          return;
        }
      }

      const meta = ensureRoomMeta(room);
      if (isSocialMessage && room === SOCIAL_ROOM_ID) {
        meta.hidden = true;
        meta.updatedAt = Date.now();
      }

      if (!roomRegistered && msg.type === 'ready') {
        const roomInfo = getRoomSummary(room);
        const reconnectClaim = msg.reconnect ? getOnlineIdentityClaim(getOnlineIdentityKey(msg, senderSession)) : null;
        const allowReconnectSameRoom = !!(reconnectClaim && String(reconnectClaim.room || '').trim() === room);
        if (roomInfo.availableSlots <= 0 && !allowReconnectSameRoom) {
          sendJson(ws, { type: 'error', code: 'ROOM_FULL', room, roomInfo });
          return;
        }
        const providedPassword = getRoomPassword(msg.roomPassword);
        if (meta.roomPassword && providedPassword !== meta.roomPassword) {
          sendJson(ws, { type: 'error', code: 'ROOM_BAD_PASSWORD', room, roomInfo });
          return;
        }
      }

      if (msg.type === 'ready') {
        const identityClaim = claimOnlineIdentity(getOnlineIdentityKey(msg, senderSession), room, ws, { allowReconnect: !!msg.reconnect });
        if (!identityClaim.ok) {
          sendJson(ws, {
            type: 'error',
            code: 'ACCOUNT_ALREADY_IN_ROOM',
            room,
            activeRoom: identityClaim.room || '',
            roomInfo: identityClaim.room ? getRoomSummary(identityClaim.room) : null,
          });
          return;
        }
      }

      rooms[room].add(ws);
      roomRegistered = true;

      if (msg.type === 'ready' && !meta.hostSender) {
        const candidateHost = msg.sender || msg.playerId;
        if (isHostId(candidateHost)) meta.hostSender = candidateHost;
      }

      if (msg.type === 'ready') {
        if (isHostId(msg.sender || msg.playerId)) {
          meta.hostName = msg.name || meta.hostName || 'Hote';
          meta.hostEmoji = msg.emoji || meta.hostEmoji || '👤';
        }
        meta.playerCount = Math.max(meta.playerCount || 0, rooms[room].size);
        meta.started = false;
        meta.updatedAt = Date.now();
      }

      if (msg.type === 'state') {
        updateRoomMetaFromState(room, msg.state || {});
      }

      if (msg.type === 'addon_sync') {
        const sender = msg.sender;
        if (!meta.hostSender && isHostId(sender)) meta.hostSender = sender;
        if (sender !== meta.hostSender) return;

        const current = roomAddons[room] || createDefaultAddonState();
        const merged = sanitizeAddonPatch(msg.addonPatch || msg.addonState, current);
        merged.meta = {
          version: Number(current.meta && current.meta.version || 0) + 1,
          updatedAt: Date.now(),
          updatedBy: sender || 'server',
          source: 'server',
        };
        roomAddons[room] = merged;
        broadcastToRoom(room, {
          type: 'addon_sync',
          room,
          sender: 'server',
          addonState: merged,
        });
        return;
      }

      if (msg.type === 'addon_sync_request') {
        if (roomAddons[room] && ws.readyState === WebSocket.OPEN) {
          sendJson(ws, {
            type: 'addon_sync',
            room,
            sender: 'server',
            addonState: roomAddons[room],
          });
        }
        return;
      }

      if (msg.type === 'social_clear_request') {
        if (room !== SOCIAL_ROOM_ID) return;
        if (!senderMod.isAdmin) {
          sendJson(ws, { type: 'error', code: 'ADMIN_REQUIRED', room });
          return;
        }
        broadcastSocialClear({
          auto: false,
          by: sanitizeStr(msg.name, 64) || 'Admin',
          reason: 'manual',
        });
        return;
      }

      broadcastToRoom(room, msg);

      if (msg.type === 'ready' && roomAddons[room]) {
        sendJson(ws, {
          type: 'addon_sync',
          room,
          sender: 'server',
          addonState: roomAddons[room],
        });
      }
    } catch (e) {
      console.error('Invalid message', e);
    }
  });

  ws.on('close', () => {
    releaseOnlineIdentityForSocket(ws);
    if (myRoom && rooms[myRoom]) {
      rooms[myRoom].delete(ws);
      if (roomMeta[myRoom] && roomMeta[myRoom].hostSender === mySender) {
        roomMeta[myRoom].hostSender = null;
      }
      if (rooms[myRoom].size === 0) {
        delete rooms[myRoom];
        delete roomAddons[myRoom];
        delete roomMeta[myRoom];
      } else {
        if (mySender) {
          broadcastToRoom(myRoom, {
            type: 'player_disconnected',
            room: myRoom,
            sender: mySender,
            playerId: mySender,
            at: Date.now(),
          });
        }
        if (roomMeta[myRoom]) {
          roomMeta[myRoom].updatedAt = Date.now();
          roomMeta[myRoom].playerCount = Math.max(1, rooms[myRoom].size);
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log('NeoPoly server on http://localhost:' + PORT);
  console.log('WebSocket endpoint on ws://localhost:' + PORT);
});
