(function () {
  'use strict';

  const STORAGE_KEY = 'NP_ADDON_PACKS_V2';

  const defaultState = {
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
      updatedBy: 'local',
      source: 'local',
      hash: '00000000',
    },
  };

  let state = null;

  const internals = {
    seasonIndex: 0,
    seasonEvery: 8,
    boardQueued: false,
    uiQueued: false,
    blitzSkipJail3Doubles: false,
    originals: {
      calcRent: null,
      getHouseCost: null,
      checkBust: null,
      doNextTurn: null,
      renderBoard: null,
      updateUI: null,
      movePlayer: null,
      declineBuy: null,
      startTimer: null,
      sendToJail: null,
      doRoll: null,
      connectWs: null,
      disconnectWs: null,
    },
    attachedWs: null,
    syncTimer: null,
    syncPendingFull: false,
    syncPendingToggleKeys: {},
    syncPendingCfgKeys: {},
    lockToastAt: 0,
    status: {
      pending: false,
      connected: false,
      source: 'local',
      note: 'Local uniquement',
      lastSyncAt: 0,
        powerups: false,
    },
    loansByPlayer: {},
    loanPanelPlayerId: null,
    loanConfig: {
      amount: 400,
      interest: 1.25,
      repayTurns: 6,
    },
    auction: {
      open: false,
      cell: null,
      bids: {},
      passed: {},
      order: [],
      idx: 0,
    },
    events: {
      chance: 0.2,
      rentMultiplier: 1,
      rentTurns: 0,
      goMultiplier: 1,
      goTurns: 0,
      blockedCells: {},
    },
    blitz: {
      rentMultiplier: 1.5,
      startMoney: 1000,
      maxTurns: 30,
      timerSec: 30,
      warned: {},
    },
  };

  const seasons = [
    { id: 'spring', label: 'Printemps', rent: 1.0, go: 1.25, house: 1.0 },
    { id: 'summer', label: 'Ete', rent: 1.2, go: 1.0, house: 1.0 },
    { id: 'autumn', label: 'Automne', rent: 1.0, go: 1.0, house: 0.8 },
    { id: 'winter', label: 'Hiver', rent: 0.85, go: 1.0, house: 1.0 },
  ];

  const randomEvents = [
    {
      icon: '🌪️',
      title: 'Crise economique',
      desc: 'Chaque joueur perd 10% de son argent.',
      effect: '-10% pour tous',
      run() {
        alivePlayers().forEach((p) => {
          const loss = Math.ceil((p.money || 0) * 0.1);
          p.money -= loss;
          recordTxnSafe(p, -loss, 'Crise economique');
          checkBustSafe(p);
        });
      },
    },
    {
      icon: '💹',
      title: 'Boom immobilier',
      desc: 'Les loyers passent a x2 pendant 3 tours.',
      effect: 'Loyers x2 (3 tours)',
      run() {
        internals.events.rentMultiplier = 2;
        internals.events.rentTurns = 3;
      },
    },
    {
      icon: '🔥',
      title: 'Incendie',
      desc: 'Une maison aleatoire est detruite.',
      effect: '-1 maison aleatoire',
      run() {
        if (!window.G || !Array.isArray(window.G.board)) return;
        const cells = window.G.board.filter((c) => (c.houses || 0) > 0);
        if (!cells.length) return;
        const cell = cells[Math.floor(Math.random() * cells.length)];
        cell.houses -= 1;
        glogSafe('🔥 Incendie sur ' + cell.n + ' (-1 maison).', 'd');
      },
    },
    {
      icon: '🎁',
      title: 'Jackpot fiscal',
      desc: 'Chaque joueur recoit 150$.',
      effect: '+150$ pour tous',
      run() {
        alivePlayers().forEach((p) => {
          p.money += 150;
          recordTxnSafe(p, 150, 'Jackpot fiscal');
        });
      },
    },
    {
      icon: '🚧',
      title: 'Travaux',
      desc: 'Une propriete ne paie plus de loyer pendant 2 tours.',
      effect: 'Case bloquee (2 tours)',
      run() {
        if (!window.G || !Array.isArray(window.G.board)) return;
        const props = window.G.board.filter((c) => c && c.t === 'property' && c.owner != null);
        if (!props.length) return;
        const cell = props[Math.floor(Math.random() * props.length)];
        internals.events.blockedCells[cell.i] = 2;
        glogSafe('🚧 Travaux sur ' + cell.n + ' (loyer suspendu 2 tours).', 'w');
      },
    },
    {
      icon: '🔀',
      title: 'Redistribution',
      desc: 'Rotation de 100$ entre joueurs actifs.',
      effect: 'Transfert circulaire de 100$',
      run() {
        const alive = alivePlayers();
        if (alive.length < 2) return;
        const paid = alive.map((p) => Math.min(100, p.money));
        alive.forEach((p, i) => {
          p.money -= paid[i];
          const next = alive[(i + 1) % alive.length];
          next.money += paid[i];
          recordTxnSafe(p, -paid[i], 'Redistribution');
          recordTxnSafe(next, paid[i], 'Redistribution recue');
        });
      },
    },
    {
      icon: '💸',
      title: 'Taxe speciale',
      desc: '50$ par propriete possedee.',
      effect: '-50$ x nb proprietes',
      run() {
        if (!window.G || !Array.isArray(window.G.board)) return;
        alivePlayers().forEach((p) => {
          const count = window.G.board.filter((c) => c.owner === p.id).length;
          if (!count) return;
          const tax = count * 50;
          p.money -= tax;
          recordTxnSafe(p, -tax, 'Taxe speciale');
          checkBustSafe(p);
        });
      },
    },
    {
      icon: '🌟',
      title: 'Bonus depart double',
      desc: 'Le bonus depart est double pendant 5 tours.',
      effect: 'Bonus depart x2 (5 tours)',
      run() {
        internals.events.goMultiplier = 2;
        internals.events.goTurns = 5;
      },
    },
  ];

  const CFG_BOUNDS = {
    eventChance:    [0,   100, 1],
    blitzTimer:     [10,  300, 1],
    blitzMaxTurns:  [5,   200, 1],
    blitzRentMult:  [100, 400, 10],
    loanAmount:     [50,  5000, 50],
    loanInterest:   [0,   200, 1],
    loanRepayTurns: [1,   30,  1],
  };

  const PRESETS = {
    classic: {
      label: 'Classique',
      state: {
        seasons: false,
        loans: false,
        perf: true,
        auctions: false,
        events: false,
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
      },
    },
    chaos: {
      label: 'Chaos',
      state: {
        seasons: true,
        loans: true,
        perf: true,
        auctions: true,
        events: true,
        powerups: true,
        blitz: false,
        cfg: {
          eventChance: 45,
          blitzTimer: 30,
          blitzMaxTurns: 30,
          blitzRentMult: 150,
          loanAmount: 700,
          loanInterest: 35,
          loanRepayTurns: 5,
        },
      },
    },
    blitz: {
      label: 'Blitz Competitif',
      state: {
        seasons: false,
        loans: false,
        perf: true,
        auctions: true,
        events: false,
        powerups: false,
        blitz: true,
        cfg: {
          eventChance: 10,
          blitzTimer: 20,
          blitzMaxTurns: 24,
          blitzRentMult: 175,
          loanAmount: 300,
          loanInterest: 15,
          loanRepayTurns: 4,
        },
      },
    },
  };

  state = loadState();

  function clampCfg(key, val) {
    const b = CFG_BOUNDS[key];
    return b ? Math.min(b[1], Math.max(b[0], Number(val) || b[0])) : val;
  }

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getConfigSnapshot(src) {
    const from = src || state;
    return {
      seasons: !!from.seasons,
      loans: !!from.loans,
      perf: !!from.perf,
      auctions: !!from.auctions,
      events: !!from.events,
      powerups: !!from.powerups,
      blitz: !!from.blitz,
      cfg: {
        eventChance: clampCfg('eventChance', from.cfg && from.cfg.eventChance),
        blitzTimer: clampCfg('blitzTimer', from.cfg && from.cfg.blitzTimer),
        blitzMaxTurns: clampCfg('blitzMaxTurns', from.cfg && from.cfg.blitzMaxTurns),
        blitzRentMult: clampCfg('blitzRentMult', from.cfg && from.cfg.blitzRentMult),
        loanAmount: clampCfg('loanAmount', from.cfg && from.cfg.loanAmount),
        loanInterest: clampCfg('loanInterest', from.cfg && from.cfg.loanInterest),
        loanRepayTurns: clampCfg('loanRepayTurns', from.cfg && from.cfg.loanRepayTurns),
      },
    };
  }

  function serializeConfigSnapshot(src) {
    return JSON.stringify(getConfigSnapshot(src));
  }

  function computeConfigHash(src) {
    const str = serializeConfigSnapshot(src);
    let hash = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function touchMeta(source, updatedBy, version, updatedAt) {
    state.meta = state.meta || cloneValue(defaultState.meta);
    state.meta.hash = computeConfigHash(state);
    state.meta.source = source || state.meta.source || 'local';
    state.meta.updatedBy = updatedBy || state.meta.updatedBy || 'local';
    if (version != null) state.meta.version = Number(version) || 0;
    if (updatedAt != null) state.meta.updatedAt = Number(updatedAt) || 0;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fallback = cloneValue(defaultState);
        fallback.meta.hash = computeConfigHash(fallback);
        return fallback;
      }
      const parsed = JSON.parse(raw);
      const pc = parsed.cfg || {};
      const dc = defaultState.cfg;
      const loaded = {
        seasons:  !!parsed.seasons,
        loans:    !!parsed.loans,
        perf:     !!parsed.perf,
        auctions: !!parsed.auctions,
        events:   !!parsed.events,
        powerups: !!parsed.powerups,
        blitz:    !!parsed.blitz,
        cfg: {
          eventChance:    clampCfg('eventChance',    pc.eventChance    ?? dc.eventChance),
          blitzTimer:     clampCfg('blitzTimer',     pc.blitzTimer     ?? dc.blitzTimer),
          blitzMaxTurns:  clampCfg('blitzMaxTurns',  pc.blitzMaxTurns  ?? dc.blitzMaxTurns),
          blitzRentMult:  clampCfg('blitzRentMult',  pc.blitzRentMult  ?? dc.blitzRentMult),
          loanAmount:     clampCfg('loanAmount',     pc.loanAmount     ?? dc.loanAmount),
          loanInterest:   clampCfg('loanInterest',   pc.loanInterest   ?? dc.loanInterest),
          loanRepayTurns: clampCfg('loanRepayTurns', pc.loanRepayTurns ?? dc.loanRepayTurns),
        },
        meta: {
          version: Number(parsed.meta && parsed.meta.version) || 0,
          updatedAt: Number(parsed.meta && parsed.meta.updatedAt) || 0,
          updatedBy: String(parsed.meta && parsed.meta.updatedBy || 'local'),
          source: String(parsed.meta && parsed.meta.source || 'local'),
          hash: '',
        },
      };
      loaded.meta.hash = computeConfigHash(loaded);
      return loaded;
    } catch (e) {
      const fallback = cloneValue(defaultState);
      fallback.meta.hash = computeConfigHash(fallback);
      return fallback;
    }
  }

  function applyCfgToInternals() {
    const c = state.cfg;
    internals.events.chance         = c.eventChance / 100;
    internals.blitz.timerSec        = c.blitzTimer;
    internals.blitz.maxTurns        = c.blitzMaxTurns;
    internals.blitz.rentMultiplier  = c.blitzRentMult / 100;
    internals.loanConfig.amount     = c.loanAmount;
    internals.loanConfig.interest   = 1 + c.loanInterest / 100;
    internals.loanConfig.repayTurns = c.loanRepayTurns;
  }

  function saveState() {
    touchMeta(state.meta && state.meta.source, state.meta && state.meta.updatedBy, state.meta && state.meta.version, state.meta && state.meta.updatedAt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function notifyAddonStateChanged() {
    try {
      window.dispatchEvent(new CustomEvent('neopoly:addons-changed', {
        detail: cloneValue(getConfigSnapshot(state)),
      }));
    } catch (_) {}
  }

  function alivePlayers() {
    if (!window.G || !Array.isArray(window.G.players)) return [];
    return window.G.players.filter((p) => p && !p.bust);
  }

  function toastSafe(msg, kind) {
    if (typeof window.toast === 'function') window.toast(msg, kind || 'i');
  }

  function glogSafe(msg, kind) {
    if (typeof window.glog === 'function') window.glog(msg, kind || 'i');
  }

  function recordTxnSafe(p, amount, desc) {
    if (typeof window.recordTxn === 'function') window.recordTxn(p, amount, desc);
  }

  function checkBustSafe(p) {
    if (typeof window.checkBust === 'function') window.checkBust(p);
  }

  function callRenderSafe() {
    if (typeof window.renderPlayers === 'function') window.renderPlayers();
    if (typeof window.updBtns === 'function') window.updBtns();
    if (typeof window.refreshOwners === 'function') window.refreshOwners();
    if (typeof window.refreshHouses === 'function') window.refreshHouses();
    if (typeof window.broadcast === 'function') window.broadcast();
  }

  function currentSeason() {
    return seasons[internals.seasonIndex] || seasons[0];
  }

  function seasonChip() {
    return document.getElementById('pm-season-chip');
  }

  function updateSeasonByTurn() {
    if (!state.seasons || !window.G) return;
    const turn = Math.max(1, Number(window.G.turnCount || 1));
    const idx = Math.floor((turn - 1) / internals.seasonEvery) % seasons.length;
    if (idx !== internals.seasonIndex) {
      internals.seasonIndex = idx;
      const s = currentSeason();
      toastSafe('Saison active: ' + s.label, 'i');
      glogSafe('Meteo eco -> ' + s.label, 'i');
    }
    const chip = seasonChip();
    if (chip) {
      chip.textContent = 'Saison: ' + currentSeason().label;
      chip.style.display = '';
    }
  }

  function hideSeasonChip() {
    const chip = seasonChip();
    if (chip) chip.style.display = 'none';
  }

  function getLoan(playerId) {
    return internals.loansByPlayer[playerId] || null;
  }

  function ensureLoanPanel() {
    if (document.getElementById('pm-loan-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'pm-loan-panel';
    panel.innerHTML =
      '<div id="pm-loan-title">Pret bancaire</div>' +
      '<div id="pm-loan-sub"></div>' +
      '<div id="pm-loan-actions">' +
      '<button id="pm-loan-accept" type="button">Accepter</button>' +
      '<button id="pm-loan-deny" type="button">Refuser</button>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('pm-loan-accept').addEventListener('click', acceptLoan);
    document.getElementById('pm-loan-deny').addEventListener('click', denyLoan);
  }

  function openLoanPanel(player) {
    ensureLoanPanel();
    const panel = document.getElementById('pm-loan-panel');
    const sub = document.getElementById('pm-loan-sub');
    if (!panel || !sub) return;
    const total = Math.ceil(internals.loanConfig.amount * internals.loanConfig.interest);
    sub.textContent =
      player.name +
      ' peut emprunter ' +
      internals.loanConfig.amount +
      '$ (remboursement: ' +
      total +
      '$ sur ' +
      internals.loanConfig.repayTurns +
      ' tours).';
    internals.loanPanelPlayerId = player.id;
    panel.classList.add('open');
  }

  function closeLoanPanel() {
    const panel = document.getElementById('pm-loan-panel');
    internals.loanPanelPlayerId = null;
    if (panel) panel.classList.remove('open');
  }

  function acceptLoan() {
    if (!window.G || !internals.loanPanelPlayerId) {
      closeLoanPanel();
      return;
    }
    const p = window.G.players.find((x) => x.id === internals.loanPanelPlayerId);
    if (!p) {
      closeLoanPanel();
      return;
    }
    const total = Math.ceil(internals.loanConfig.amount * internals.loanConfig.interest);
    internals.loansByPlayer[p.id] = { remaining: total, turnsLeft: internals.loanConfig.repayTurns };
    p.money += internals.loanConfig.amount;
    recordTxnSafe(p, internals.loanConfig.amount, 'Pret bancaire');
    toastSafe('Pret accepte: ' + p.name, 'i');
    closeLoanPanel();
    if (typeof window.updateUI === 'function') window.updateUI(true);
  }

  function denyLoan() {
    closeLoanPanel();
  }

  function tickLoans() {
    if (!state.loans) return;
    alivePlayers().forEach((p) => {
      const st = getLoan(p.id);
      if (!st) return;

      if (st.turnsLeft <= 0) {
        const fee = Math.ceil(st.remaining * 0.12);
        st.remaining += fee;
        st.turnsLeft = 2;
        toastSafe('Retard pret: +' + fee + '$ pour ' + p.name, 'd');
      }

      const due = Math.ceil(st.remaining / Math.max(1, st.turnsLeft));
      const pay = Math.min(due, p.money);
      p.money -= pay;
      st.remaining -= pay;
      st.turnsLeft -= 1;

      if (pay > 0) recordTxnSafe(p, -pay, 'Remboursement pret');

      if (st.remaining <= 0) {
        delete internals.loansByPlayer[p.id];
        toastSafe(p.name + ' a rembourse son pret', 'a');
      }
      checkBustSafe(p);
    });
  }

  function ensureAuctionModal() {
    if (document.getElementById('pm-auction-bg')) return;
    const bg = document.createElement('div');
    bg.id = 'pm-auction-bg';
    bg.innerHTML =
      '<div id="pm-auction-box">' +
      '<div id="pm-auction-title">Encheres</div>' +
      '<div id="pm-auction-sub"></div>' +
      '<div id="pm-auction-list"></div>' +
      '<div id="pm-auction-form">' +
      '<input id="pm-auction-input" type="number" min="1" placeholder="Mise" />' +
      '<button id="pm-auction-bid" type="button">Encherir</button>' +
      '</div>' +
      '<div id="pm-auction-actions">' +
      '<button id="pm-auction-pass" type="button">Passer</button>' +
      '<button id="pm-auction-confirm" type="button">Confirmer</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(bg);

    document.getElementById('pm-auction-bid').addEventListener('click', submitAuctionBid);
    document.getElementById('pm-auction-pass').addEventListener('click', passAuctionBid);
    document.getElementById('pm-auction-confirm').addEventListener('click', finalizeAuction);
  }

  function closeAuctionModal() {
    const bg = document.getElementById('pm-auction-bg');
    if (bg) bg.classList.remove('open');
    internals.auction.open = false;
    internals.auction.cell = null;
    internals.auction.bids = {};
    internals.auction.passed = {};
    internals.auction.order = [];
    internals.auction.idx = 0;
  }

  function startAuctionFromPending() {
    if (!state.auctions || !window.G || !window.G.pendingBuy || !window.G.pendingBuy.cell) return false;
    const cell = window.G.pendingBuy.cell;
    if (!cell || cell.owner != null || !cell.t || (cell.t !== 'property' && cell.t !== 'railroad' && cell.t !== 'utility')) {
      return false;
    }

    ensureAuctionModal();

    const order = alivePlayers().map((p) => p.id);
    const cur = window.G.players[window.G.cur] ? window.G.players[window.G.cur].id : null;
    const ci = order.indexOf(cur);
    const sorted = ci > 0 ? order.slice(ci).concat(order.slice(0, ci)) : order;

    internals.auction.open = true;
    internals.auction.cell = cell;
    internals.auction.bids = {};
    internals.auction.passed = {};
    internals.auction.order = sorted;
    internals.auction.idx = 0;

    if (typeof window.hideBuyBar === 'function') {
      window.hideBuyBar();
    } else {
      window.G.pendingBuy = null;
      const buyBar = document.getElementById('buy-bar');
      if (buyBar) buyBar.classList.remove('open');
      if (typeof window.updBtns === 'function') window.updBtns();
    }

    renderAuctionModal();
    const bg = document.getElementById('pm-auction-bg');
    if (bg) bg.classList.add('open');
    glogSafe('🔨 Encheres ouvertes pour ' + cell.n + '.', 'w');
    return true;
  }

  function renderAuctionModal() {
    if (!internals.auction.open || !internals.auction.cell) return;
    const title = document.getElementById('pm-auction-title');
    const sub = document.getElementById('pm-auction-sub');
    const list = document.getElementById('pm-auction-list');
    const input = document.getElementById('pm-auction-input');
    const confirm = document.getElementById('pm-auction-confirm');
    if (!title || !sub || !list || !input || !confirm) return;

    const a = internals.auction;
    const cell = a.cell;
    const maxBid = Math.max(0, ...Object.values(a.bids));
    const allDone = a.order.every((id) => a.bids[id] != null || a.passed[id]);
    const curId = a.order[a.idx];
    const curP = window.G && Array.isArray(window.G.players) ? window.G.players.find((p) => p.id === curId) : null;

    title.textContent = curP ? 'Encheres - ' + curP.name : 'Encheres';
    sub.textContent = cell.n + ' - prix banque: ' + cell.p + '$';

    list.innerHTML = a.order
      .map((id) => {
        const p = window.G.players.find((x) => x.id === id);
        if (!p) return '';
        const bid = a.bids[id];
        const passed = !!a.passed[id];
        const marker = curId === id && !allDone ? ' ◀' : '';
        return (
          '<div class="pm-auction-row">' +
          '<span>' +
          p.emoji +
          ' ' +
          p.name +
          marker +
          '</span>' +
          '<strong>' +
          (passed ? '-' : bid != null ? bid + '$' : '?') +
          '</strong>' +
          '</div>'
        );
      })
      .join('');

    input.min = String(maxBid + 1);
    input.value = '';
    input.placeholder = 'Min: ' + (maxBid + 1) + '$';
    confirm.style.display = allDone ? '' : 'none';
  }

  function advanceAuction() {
    const a = internals.auction;
    const allDone = a.order.every((id) => a.bids[id] != null || a.passed[id]);
    if (allDone) {
      a.idx = a.order.length;
      renderAuctionModal();
      return;
    }

    let next = (a.idx + 1) % a.order.length;
    let guard = 0;
    while ((a.bids[a.order[next]] != null || a.passed[a.order[next]]) && guard < a.order.length) {
      next = (next + 1) % a.order.length;
      guard += 1;
    }
    a.idx = next;
    renderAuctionModal();
  }

  function submitAuctionBid() {
    const a = internals.auction;
    if (!a.open) return;
    const curId = a.order[a.idx];
    const p = window.G.players.find((x) => x.id === curId);
    const input = document.getElementById('pm-auction-input');
    if (!p || !input) return;

    const amount = parseInt(input.value, 10);
    const maxBid = Math.max(0, ...Object.values(a.bids));
    if (!amount || amount <= maxBid) {
      toastSafe('Mise trop faible (min ' + (maxBid + 1) + '$)', 'w');
      return;
    }
    if (amount > p.money) {
      toastSafe(p.name + ' n a pas assez d argent.', 'd');
      return;
    }
    a.bids[curId] = amount;
    advanceAuction();
  }

  function passAuctionBid() {
    const a = internals.auction;
    if (!a.open) return;
    const curId = a.order[a.idx];
    a.passed[curId] = true;
    advanceAuction();
  }

  function finalizeAuction() {
    const a = internals.auction;
    if (!a.open || !a.cell) return;
    const maxBid = Math.max(0, ...Object.values(a.bids));
    if (maxBid <= 0) {
      toastSafe('Aucune offre. La propriete reste a la banque.', 'i');
      closeAuctionModal();
      return;
    }

    const winnerId = Object.keys(a.bids).find((id) => a.bids[id] === maxBid);
    const winner = window.G.players.find((p) => p.id === winnerId);
    if (!winner) {
      closeAuctionModal();
      return;
    }

    winner.money -= maxBid;
    a.cell.owner = winner.id;
    a.cell.houses = 0;
    a.cell.mortgaged = false;

    recordTxnSafe(winner, -maxBid, 'Enchere: ' + a.cell.n);
    toastSafe('🏆 ' + winner.name + ' remporte ' + a.cell.n + ' pour ' + maxBid + '$', 'a');
    glogSafe('🔨 ' + winner.name + ' gagne ' + a.cell.n + ' pour ' + maxBid + '$.', 'a');

    callRenderSafe();
    closeAuctionModal();
  }

  function ensureEventPopup() {
    if (document.getElementById('pm-event-popup')) return;
    const popup = document.createElement('div');
    popup.id = 'pm-event-popup';
    popup.innerHTML =
      '<div id="pm-event-icon">🌀</div>' +
      '<div id="pm-event-title">Evenement</div>' +
      '<div id="pm-event-desc"></div>' +
      '<div id="pm-event-effect"></div>' +
      '<button id="pm-event-ok" type="button">OK</button>';
    document.body.appendChild(popup);
    document.getElementById('pm-event-ok').addEventListener('click', closeEventPopup);
  }

  function closeEventPopup() {
    const popup = document.getElementById('pm-event-popup');
    if (popup) popup.classList.remove('open');
  }

  function showEventPopup(ev) {
    ensureEventPopup();
    const popup = document.getElementById('pm-event-popup');
    const icon = document.getElementById('pm-event-icon');
    const title = document.getElementById('pm-event-title');
    const desc = document.getElementById('pm-event-desc');
    const effect = document.getElementById('pm-event-effect');
    if (!popup || !icon || !title || !desc || !effect) return;
    icon.textContent = ev.icon;
    title.textContent = ev.title;
    desc.textContent = ev.desc;
    effect.textContent = ev.effect;
    popup.classList.add('open');
  }

  function tickEventStates() {
    if (!state.events) return;
    if (internals.events.rentTurns > 0) {
      internals.events.rentTurns -= 1;
      if (internals.events.rentTurns <= 0) internals.events.rentMultiplier = 1;
    }
    if (internals.events.goTurns > 0) {
      internals.events.goTurns -= 1;
      if (internals.events.goTurns <= 0) internals.events.goMultiplier = 1;
    }
    Object.keys(internals.events.blockedCells).forEach((k) => {
      internals.events.blockedCells[k] -= 1;
      if (internals.events.blockedCells[k] <= 0) delete internals.events.blockedCells[k];
    });
  }

  function maybeTriggerRandomEvent() {
    if (!state.events || !window.G || !window.G.started) return;
    if (Math.random() > internals.events.chance) return;
    const ev = randomEvents[Math.floor(Math.random() * randomEvents.length)];
    if (!ev) return;
    ev.run();
    showEventPopup(ev);
    callRenderSafe();
  }

  function scheduleRender() {
    if (internals.boardQueued) return;
    internals.boardQueued = true;
    requestAnimationFrame(() => {
      internals.boardQueued = false;
      if (internals.originals.renderBoard) internals.originals.renderBoard.call(window);
    });
  }

  function scheduleUI() {
    if (internals.uiQueued) return;
    internals.uiQueued = true;
    requestAnimationFrame(() => {
      internals.uiQueued = false;
      if (internals.originals.updateUI) internals.originals.updateUI.call(window);
    });
  }

  function applyBlitzState() {
    document.body.classList.toggle('pm-blitz', !!state.blitz);
    if (!window.G) return;
    if (state.blitz) {
      window.G.startingMoney = internals.blitz.startMoney;
      window.G.maxTurns = internals.blitz.maxTurns;
      window.G.timerEnabled = true;
      window.G.timerDuration = internals.blitz.timerSec;
      window.G.autoEnd = true;
      const badge = document.getElementById('pm-blitz-banner');
      if (badge) badge.style.display = 'block';
    } else {
      const badge = document.getElementById('pm-blitz-banner');
      if (badge) badge.style.display = 'none';
      internals.blitz.warned = {};
    }
  }

  function isHost() {
    if (typeof window.isOnlineHost === 'function') return !!window.isOnlineHost();
    return !!(window.G && window.G.myId && String(window.G.myId).startsWith('h-'));
  }

  function isOnlineMode() {
    return !!(window.G && window.G.mode === 'online');
  }

  function getEditLockReason() {
    if (window.G && window.G.started) return 'Regles verrouillees pendant la partie';
    if (isOnlineMode() && !isHost()) return 'Seul l hote peut modifier les addons';
    return '';
  }

  function isEditingLocked() {
    return !!getEditLockReason();
  }

  function notifyEditLocked() {
    const reason = getEditLockReason();
    if (!reason) return false;
    const now = Date.now();
    if (now - internals.lockToastAt > 1000) {
      internals.lockToastAt = now;
      toastSafe(reason, 'w');
    }
    return true;
  }

  function formatSyncTime(ts) {
    if (!ts) return '--:--:--';
    try {
      return new Date(ts).toLocaleTimeString('fr-FR');
    } catch (_) {
      return '--:--:--';
    }
  }

  function refreshUIToggles() {
    ['seasons', 'loans', 'perf', 'auctions', 'events', 'powerups', 'blitz'].forEach((k) => {
      const el = document.getElementById('pm-toggle-' + k);
      if (el) el.checked = !!state[k];
    });
  }

  function refreshCfgInputs() {
    Object.keys(defaultState.cfg).forEach((k) => {
      const el = document.getElementById('pm-cfg-' + k);
      if (el) el.value = String(state.cfg[k]);
    });
  }

  function refreshSyncInfo() {
    const sourceEl = document.getElementById('pm-sync-source');
    const versionEl = document.getElementById('pm-sync-version');
    const hashEl = document.getElementById('pm-sync-hash');
    const timeEl = document.getElementById('pm-sync-time');
    const noteEl = document.getElementById('pm-sync-note');
    const lockEl = document.getElementById('pm-lock-note');
    const forceBtn = document.getElementById('pm-sync-now');
    const presetButtons = document.querySelectorAll('[data-pm-preset]');
    const locked = isEditingLocked();
    const reason = getEditLockReason() || 'Edition autorisee';

    if (sourceEl) sourceEl.textContent = internals.status.source;
    if (versionEl) versionEl.textContent = String(state.meta && state.meta.version || 0);
    if (hashEl) hashEl.textContent = state.meta && state.meta.hash || '00000000';
    if (timeEl) timeEl.textContent = formatSyncTime(internals.status.lastSyncAt || state.meta && state.meta.updatedAt);
    if (noteEl) noteEl.textContent = internals.status.note || 'Aucun statut';
    if (lockEl) lockEl.textContent = reason;
    if (forceBtn) forceBtn.textContent = isHost() ? 'Forcer la resynchronisation' : 'Redemander la configuration';

    ['seasons', 'loans', 'perf', 'auctions', 'events', 'powerups', 'blitz'].forEach((k) => {
      const el = document.getElementById('pm-toggle-' + k);
      if (el) el.disabled = locked;
    });
    Object.keys(defaultState.cfg).forEach((k) => {
      const el = document.getElementById('pm-cfg-' + k);
      if (el) el.disabled = locked;
    });
    const resetBtn = document.getElementById('pm-cfg-reset');
    if (resetBtn) resetBtn.disabled = locked;
    presetButtons.forEach((btn) => {
      btn.disabled = locked;
    });
  }

  function applyStateSideEffects() {
    applyCfgToInternals();
    applyBlitzState();

    if (state.seasons) updateSeasonByTurn();
    else hideSeasonChip();

    if (!state.loans) closeLoanPanel();
    if (!state.auctions) closeAuctionModal();
    if (!state.events) {
      internals.events.rentMultiplier = 1;
      internals.events.rentTurns = 0;
      internals.events.goMultiplier = 1;
      internals.events.goTurns = 0;
      internals.events.blockedCells = {};
      closeEventPopup();
    }
    refreshUIToggles();
    refreshCfgInputs();
    refreshSyncInfo();
    notifyAddonStateChanged();
  }

  function markPendingSync(note) {
    internals.status.pending = true;
    internals.status.note = note || 'Sync en attente';
    internals.status.source = isHost() ? 'Host local' : 'Client local';
    refreshSyncInfo();
  }

  function queueAddonSync(options) {
    const opt = options || {};
    if (!isHost()) return;
    if (opt.full) internals.syncPendingFull = true;
    if (opt.toggleKey) internals.syncPendingToggleKeys[opt.toggleKey] = true;
    if (opt.cfgKey) internals.syncPendingCfgKeys[opt.cfgKey] = true;
    clearTimeout(internals.syncTimer);
    markPendingSync(opt.note || 'Sync en attente');
    internals.syncTimer = setTimeout(flushAddonSync, opt.immediate ? 0 : 250);
  }

  function buildAddonPatch() {
    if (internals.syncPendingFull || !(state.meta && state.meta.version)) {
      return getConfigSnapshot(state);
    }

    const patch = {};
    Object.keys(internals.syncPendingToggleKeys).forEach((key) => {
      if (internals.syncPendingToggleKeys[key]) patch[key] = !!state[key];
    });
    Object.keys(internals.syncPendingCfgKeys).forEach((key) => {
      if (!internals.syncPendingCfgKeys[key]) return;
      if (!patch.cfg) patch.cfg = {};
      patch.cfg[key] = state.cfg[key];
    });
    return Object.keys(patch).length ? patch : getConfigSnapshot(state);
  }

  function clearPendingSyncFlags() {
    internals.syncPendingFull = false;
    internals.syncPendingToggleKeys = {};
    internals.syncPendingCfgKeys = {};
  }

  function flushAddonSync() {
    internals.syncTimer = null;
    const G = window.G;
    if (!isHost() || !G || !G.ws || !G.wsOk) return;
    try {
      G.ws.send(JSON.stringify({
        type: 'addon_sync',
        room: G.room,
        sender: G.myId,
        addonPatch: buildAddonPatch(),
      }));
      clearPendingSyncFlags();
    } catch (_) {}
  }

  function requestAddonSync() {
    const G = window.G;
    if (!G || !G.ws || !G.wsOk) return;
    try {
      G.ws.send(JSON.stringify({
        type: 'addon_sync_request',
        room: G.room,
        sender: G.myId,
      }));
      internals.status.note = 'Demande de configuration envoyee';
      internals.status.source = 'Serveur';
      refreshSyncInfo();
    } catch (_) {}
  }

  function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    if (notifyEditLocked()) {
      refreshUIToggles();
      refreshCfgInputs();
      return;
    }
    const snap = preset.state;
    ['seasons', 'loans', 'perf', 'auctions', 'events', 'powerups', 'blitz'].forEach((key) => {
      state[key] = !!snap[key];
      internals.syncPendingToggleKeys[key] = true;
    });
    Object.keys(defaultState.cfg).forEach((key) => {
      state.cfg[key] = clampCfg(key, snap.cfg[key]);
      internals.syncPendingCfgKeys[key] = true;
    });
    touchMeta('local', window.G && window.G.myId || 'local');
    saveState();
    applyStateSideEffects();
    queueAddonSync({ full: true, note: 'Preset ' + preset.label + ' en attente' });
    toastSafe('Preset applique: ' + preset.label, 'i');
  }

  function applyRemoteAddonState(addonState) {
    if (!addonState || typeof addonState !== 'object') return;
    const incomingVersion = Number(addonState.meta && addonState.meta.version) || 0;
    const currentVersion = Number(state.meta && state.meta.version) || 0;
    if (incomingVersion && incomingVersion < currentVersion) return;

    const snapshot = getConfigSnapshot(addonState);
    const incomingHash = computeConfigHash(snapshot);
    const drifted = incomingHash !== (state.meta && state.meta.hash);
    ['seasons', 'loans', 'perf', 'auctions', 'events', 'powerups', 'blitz'].forEach((k) => {
      state[k] = snapshot[k];
    });
    Object.keys(defaultState.cfg).forEach((k) => {
      state.cfg[k] = snapshot.cfg[k];
    });
    touchMeta(
      String(addonState.meta && addonState.meta.source || 'server'),
      String(addonState.meta && addonState.meta.updatedBy || 'server'),
      incomingVersion,
      Number(addonState.meta && addonState.meta.updatedAt) || Date.now()
    );
    saveState();
    internals.status.pending = false;
    internals.status.source = state.meta.source === 'server' ? 'Serveur' : state.meta.source;
    internals.status.note = drifted ? 'Desynchronisation corrigee par le serveur' : 'Configuration synchronisee';
    internals.status.lastSyncAt = state.meta.updatedAt;
    clearPendingSyncFlags();
    applyStateSideEffects();
    toastSafe(drifted ? 'Config corrigee depuis le serveur' : 'Config addons synchronisee', drifted ? 'w' : 'i');
  }

  function handleWsMessage(e) {
    try {
      const msg = JSON.parse(e.data);
      if (!window.G || msg.room !== window.G.room) return;
      if (msg.type === 'addon_sync' && msg.addonState) {
        applyRemoteAddonState(msg.addonState);
      }
    } catch (_) {}
  }

  function handleWsOpen() {
    internals.status.connected = true;
    internals.status.source = 'Serveur';
    internals.status.note = isHost() ? 'Connexion ouverte, sync host prete' : 'Connexion ouverte, attente config';
    refreshSyncInfo();
    if (isHost()) queueAddonSync({ full: true, note: 'Resynchronisation host', immediate: true });
    else requestAddonSync();
  }

  function handleWsClose() {
    internals.attachedWs = null;
    internals.status.connected = false;
    internals.status.note = 'Connexion fermee';
    refreshSyncInfo();
  }

  function attachWsListener(ws) {
    const socket = ws || window.G && window.G.ws;
    if (!socket || socket === internals.attachedWs) return;
    internals.attachedWs = socket;
    socket.addEventListener('message', handleWsMessage);
    socket.addEventListener('open', handleWsOpen);
    socket.addEventListener('close', handleWsClose);
    if (socket.readyState === 1) handleWsOpen();
  }

  function patchWsLifecycle() {
    if (typeof window.connectWs === 'function' && !internals.originals.connectWs) {
      internals.originals.connectWs = window.connectWs;
      window.connectWs = function (url, room, onOpen) {
        return internals.originals.connectWs.call(this, url, room, function () {
          if (typeof onOpen === 'function') onOpen.apply(this, arguments);
          if (window.G && window.G.ws) attachWsListener(window.G.ws);
        });
      };
    }
    if (typeof window.disconnectWs === 'function' && !internals.originals.disconnectWs) {
      internals.originals.disconnectWs = window.disconnectWs;
      window.disconnectWs = function () {
        handleWsClose();
        return internals.originals.disconnectWs.apply(this, arguments);
      };
    }
  }

  function ensureFunctionPatches() {
    if (typeof window.calcRent === 'function' && !internals.originals.calcRent) {
      internals.originals.calcRent = window.calcRent;
      window.calcRent = function (cell, player) {
        if (state.events && cell && internals.events.blockedCells[cell.i] > 0) return 0;

        let rent = internals.originals.calcRent.call(this, cell, player);
        if (state.seasons) rent = Math.ceil(rent * currentSeason().rent);
        if (state.events) rent = Math.ceil(rent * internals.events.rentMultiplier);
        if (state.blitz) rent = Math.ceil(rent * internals.blitz.rentMultiplier);
        return rent;
      };
    }

    if (typeof window.getHouseCost === 'function' && !internals.originals.getHouseCost) {
      internals.originals.getHouseCost = window.getHouseCost;
      window.getHouseCost = function (cell) {
        let cost = internals.originals.getHouseCost.call(this, cell);
        if (state.seasons) cost = Math.ceil(cost * currentSeason().house);
        return cost;
      };
    }

    if (typeof window.movePlayer === 'function' && !internals.originals.movePlayer) {
      internals.originals.movePlayer = window.movePlayer;
      window.movePlayer = function (p, steps) {
        const old = p ? p.pos : 0;
        const out = internals.originals.movePlayer.call(this, p, steps);
        if (state.events && p && old + steps >= 40 && internals.events.goMultiplier > 1 && window.G) {
          const extra = Math.round(window.G.passGoBonus * (internals.events.goMultiplier - 1));
          if (extra > 0) {
            p.money += extra;
            recordTxnSafe(p, extra, 'Bonus depart evenement x' + internals.events.goMultiplier);
            toastSafe('🌟 Bonus depart evenement: +' + extra + '$', 'a');
          }
        }
        return out;
      };
    }

    if (typeof window.checkBust === 'function' && !internals.originals.checkBust) {
      internals.originals.checkBust = window.checkBust;
      window.checkBust = function (player) {
        if (state.loans && player && player.money < 0 && !getLoan(player.id)) {
          openLoanPanel(player);
        }
        return internals.originals.checkBust.call(this, player);
      };
    }

    if (typeof window.declineBuy === 'function' && !internals.originals.declineBuy) {
      internals.originals.declineBuy = window.declineBuy;
      window.declineBuy = function () {
        if (state.auctions && startAuctionFromPending()) return;
        return internals.originals.declineBuy.apply(this, arguments);
      };
    }

    if (typeof window.sendToJail === 'function' && !internals.originals.sendToJail) {
      internals.originals.sendToJail = window.sendToJail;
      window.sendToJail = function (p, reason) {
        if (state.blitz && String(reason || '').toLowerCase().includes('3 doubles')) {
          internals.blitzSkipJail3Doubles = true;
          if (window.G) window.G.doublesCount = 0;
          toastSafe('⚡ Blitz: prison ignoree pour 3 doubles.', 'w');
          return;
        }
        return internals.originals.sendToJail.apply(this, arguments);
      };
    }

    if (typeof window.doRoll === 'function' && !internals.originals.doRoll) {
      internals.originals.doRoll = window.doRoll;
      window.doRoll = function () {
        internals.blitzSkipJail3Doubles = false;
        const out = internals.originals.doRoll.apply(this, arguments);
        if (state.blitz && internals.blitzSkipJail3Doubles && window.G) {
          window.G.rolled = false;
          if (typeof window.updBtns === 'function') window.updBtns();
        }
        return out;
      };
    }

    if (typeof window.doNextTurn === 'function' && !internals.originals.doNextTurn) {
      internals.originals.doNextTurn = window.doNextTurn;
      window.doNextTurn = function () {
        if (state.loans) tickLoans();
        const out = internals.originals.doNextTurn.apply(this, arguments);
        if (state.seasons) updateSeasonByTurn();
        else hideSeasonChip();
        if (state.events) {
          tickEventStates();
          maybeTriggerRandomEvent();
        }
        applyBlitzState();
        return out;
      };
    }

    if (typeof window.startTimer === 'function' && !internals.originals.startTimer) {
      internals.originals.startTimer = window.startTimer;
      window.startTimer = function () {
        if (!state.blitz) return internals.originals.startTimer.apply(this, arguments);
        if (!window.G) return internals.originals.startTimer.apply(this, arguments);

        window.G.timerEnabled = true;
        window.G.timerDuration = internals.blitz.timerSec;
        if (typeof window.stopTimer === 'function') window.stopTimer();

        let t = internals.blitz.timerSec;
        const num = document.getElementById('timer-num');
        const wrap = document.getElementById('timer-wrap');
        if (num) num.textContent = String(t);
        if (wrap) wrap.style.display = 'flex';
        if (typeof window.refreshTurnTimerWheelDisplay === 'function') {
          window.refreshTurnTimerWheelDisplay(t);
        }

        window.G.timerTick = setInterval(() => {
          t -= 1;
          if (num) num.textContent = String(t);
          if (typeof window.refreshTurnTimerWheelDisplay === 'function') {
            window.refreshTurnTimerWheelDisplay(t);
          }

          if ((t === 20 || t === 10) && !internals.blitz.warned[t]) {
            internals.blitz.warned[t] = true;
            toastSafe('⏰ Blitz: ' + t + 's restantes', 'w');
          }

          if (t <= 0) {
            if (typeof window.stopTimer === 'function') window.stopTimer();
            internals.blitz.warned = {};
            toastSafe('⏱ Temps ecoule !', 'd');
            if (typeof window.doNextTurn === 'function') window.doNextTurn();
          }
        }, 1000);
      };
    }

    if (typeof window.renderBoard === 'function' && !internals.originals.renderBoard) {
      internals.originals.renderBoard = window.renderBoard;
      window.renderBoard = function () {
        if (!state.perf || arguments[0] === true) {
          return internals.originals.renderBoard.apply(this, arguments);
        }
        return scheduleRender();
      };
    }

    if (typeof window.updateUI === 'function' && !internals.originals.updateUI) {
      internals.originals.updateUI = window.updateUI;
      window.updateUI = function () {
        if (!state.perf || arguments[0] === true) {
          return internals.originals.updateUI.apply(this, arguments);
        }
        return scheduleUI();
      };
    }
  }

  function ensureStyle() {
    if (document.getElementById('pm-style')) return;
    const style = document.createElement('style');
    style.id = 'pm-style';
    style.textContent = [
      '#pack-manager-btn{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:500;background:#111827;color:#e5e7eb;border:1px solid rgba(148,163,184,.4);border-radius:999px;padding:10px 14px;font-weight:800;cursor:pointer;transition:bottom .2s ease}',
      '#pack-manager-btn:hover{border-color:#22c55e;box-shadow:0 0 18px rgba(34,197,94,.22)}',
      '@media(max-width:768px){#pack-manager-btn{bottom:calc(52px + 12px + env(safe-area-inset-bottom,0px));right:12px;padding:8px 12px;font-size:.78rem}}',
      '#pack-manager-modal{position:fixed;inset:0;z-index:520;background:rgba(8,12,24,.86);display:none;align-items:center;justify-content:center}',
      '#pack-manager-modal.open{display:flex}',
      '#pack-manager-card{width:min(92vw,440px);max-height:88vh;overflow:auto;background:#0d1525;border:1px solid rgba(148,163,184,.22);border-radius:14px;padding:16px}',
      '#pack-manager-title{font-size:1rem;font-weight:900;color:#22c55e;margin-bottom:10px}',
      '#pm-sync-box{background:#111827;border:1px solid rgba(34,197,94,.18);border-radius:10px;padding:10px 12px;margin-bottom:12px}',
      '#pm-sync-grid{display:grid;grid-template-columns:1fr auto;gap:4px 10px;font-size:.74rem;color:#cbd5e1}',
      '#pm-sync-grid b{color:#e5e7eb}',
      '#pm-sync-note{margin-top:8px;font-size:.72rem;color:#9ca3af}',
      '#pm-lock-note{margin-top:6px;font-size:.72rem;color:#fbbf24}',
      '#pm-sync-now{margin-top:8px;width:100%;border:none;border-radius:8px;background:#1d4ed8;color:#eff6ff;padding:7px 10px;font-weight:700;cursor:pointer}',
      '#pm-presets{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}',
      '.pm-preset{border:none;border-radius:8px;background:#172033;color:#dbe5f5;padding:8px 6px;font-size:.73rem;font-weight:800;cursor:pointer}',
      '.pm-preset:hover{background:#1f2d48}',
      '.pm-item{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px dashed rgba(148,163,184,.15)}',
      '.pm-item:last-of-type{border-bottom:none}',
      '.pm-label{font-size:.84rem;font-weight:700}',
      '.pm-desc{font-size:.73rem;color:#9ca3af;max-width:280px}',
      '.pm-switch{accent-color:#22c55e;transform:scale(1.05);margin-top:2px}',
      '#pm-close{margin-top:12px;width:100%;border:none;border-radius:8px;background:#1f2937;color:#e5e7eb;padding:8px 10px;font-weight:700;cursor:pointer}',
      '#pm-season-chip{position:fixed;right:14px;top:14px;z-index:500;font-size:.73rem;font-weight:800;background:#0d1525;border:1px solid rgba(45,212,191,.5);color:#2dd4bf;border-radius:999px;padding:6px 10px;display:none}',
      '#pm-loan-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.96);z-index:530;background:#0d1525;border:1px solid rgba(96,165,250,.55);border-radius:12px;padding:14px;min-width:min(92vw,320px);display:none;opacity:0;transition:transform .16s ease,opacity .16s ease}',
      '#pm-loan-panel.open{display:block;opacity:1;transform:translate(-50%,-50%) scale(1)}',
      '#pm-loan-title{font-weight:900;color:#60a5fa;margin-bottom:8px}',
      '#pm-loan-sub{font-size:.78rem;color:#cbd5e1;line-height:1.4;margin-bottom:10px}',
      '#pm-loan-actions{display:flex;gap:8px}',
      '#pm-loan-actions button{flex:1;border:none;border-radius:8px;padding:8px 10px;font-weight:700;cursor:pointer}',
      '#pm-loan-accept{background:#3b82f6;color:#fff}',
      '#pm-loan-deny{background:#1f2937;color:#e5e7eb}',
      '#pm-auction-bg{display:none;position:fixed;inset:0;z-index:540;background:rgba(8,12,24,.86);align-items:center;justify-content:center}',
      '#pm-auction-bg.open{display:flex}',
      '#pm-auction-box{width:min(92vw,420px);background:#0d1525;border:1px solid rgba(250,204,21,.45);border-radius:12px;padding:14px}',
      '#pm-auction-title{font-weight:900;color:#facc15;margin-bottom:4px}',
      '#pm-auction-sub{font-size:.76rem;color:#cbd5e1;margin-bottom:10px}',
      '#pm-auction-list{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}',
      '.pm-auction-row{display:flex;align-items:center;justify-content:space-between;background:#111827;border:1px solid rgba(148,163,184,.2);border-radius:8px;padding:7px 10px;font-size:.78rem}',
      '#pm-auction-form{display:flex;gap:8px;margin-bottom:8px}',
      '#pm-auction-form input{flex:1;background:#111827;border:1px solid rgba(148,163,184,.25);border-radius:8px;color:#e5e7eb;padding:7px 10px}',
      '#pm-auction-form button,#pm-auction-actions button{border:none;border-radius:8px;padding:7px 10px;font-weight:700;cursor:pointer}',
      '#pm-auction-bid{background:#facc15;color:#111827}',
      '#pm-auction-actions{display:flex;gap:8px}',
      '#pm-auction-pass{flex:1;background:#1f2937;color:#e5e7eb}',
      '#pm-auction-confirm{flex:1;background:#22c55e;color:#07100a;display:none}',
      '#pm-event-popup{display:none;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.95);z-index:545;background:#0d1525;border:1px solid rgba(168,85,247,.55);border-radius:14px;padding:18px;max-width:min(92vw,380px);opacity:0;transition:all .16s ease}',
      '#pm-event-popup.open{display:block;opacity:1;transform:translate(-50%,-50%) scale(1)}',
      '#pm-event-icon{font-size:2.1rem;margin-bottom:4px}',
      '#pm-event-title{font-weight:900;color:#a855f7;margin-bottom:4px}',
      '#pm-event-desc{font-size:.8rem;color:#e2e8f0;line-height:1.45;margin-bottom:8px}',
      '#pm-event-effect{font-size:.73rem;color:#9ca3af;margin-bottom:10px}',
      '#pm-event-ok{border:none;border-radius:8px;background:#3b82f6;color:#fff;padding:7px 12px;cursor:pointer}',
      '#pm-blitz-banner{display:none;position:fixed;left:0;right:0;top:0;z-index:535;text-align:center;padding:5px 10px;font-size:.73rem;font-weight:900;letter-spacing:.04em;background:linear-gradient(90deg,rgba(239,68,68,.86),rgba(249,115,22,.86));color:#fff}',
      '#pm-tabs{display:flex;gap:4px;margin-bottom:12px;background:#111827;border-radius:8px;padding:3px}',
      '.pm-tab{flex:1;border:none;border-radius:6px;padding:7px 4px;font-size:.76rem;font-weight:700;cursor:pointer;background:transparent;color:#9ca3af;transition:.15s}',
      '.pm-tab.active{background:#1f2937;color:#22c55e}',
      '#pm-pane-addons,#pm-pane-settings{display:none}',
      '#pm-pane-addons.active,#pm-pane-settings.active{display:block}',
      '#pm-pane-settings{display:none}',
      '.pm-section{font-size:.68rem;font-weight:900;letter-spacing:.08em;color:#4b5563;text-transform:uppercase;margin:10px 0 6px}',
      '.pm-field{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px dashed rgba(148,163,184,.1)}',
      '.pm-field:last-child{border-bottom:none}',
      '.pm-field-label{font-size:.8rem;color:#cbd5e1;flex:1}',
      '.pm-field-unit{font-size:.7rem;color:#6b7280;white-space:nowrap}',
      '.pm-field input[type=number]{width:72px;background:#111827;border:1px solid rgba(148,163,184,.22);border-radius:6px;color:#e5e7eb;padding:4px 7px;font-size:.78rem;text-align:right}',
      '.pm-field input[type=number]:focus{outline:none;border-color:#22c55e}',
      '.pm-reset{margin-top:8px;border:none;border-radius:6px;background:#1f2937;color:#9ca3af;padding:5px 10px;font-size:.72rem;cursor:pointer;width:100%}',
      '.pm-reset:hover{color:#e5e7eb}',
      '.pm-reset:disabled,.pm-preset:disabled,#pm-sync-now:disabled,.pm-switch:disabled,.pm-field input:disabled{opacity:.45;cursor:not-allowed}',
    ].join('');
    document.head.appendChild(style);
  }

  function ensureUI() {
    ensureStyle();

    if (!document.getElementById('pm-season-chip')) {
      const chip = document.createElement('div');
      chip.id = 'pm-season-chip';
      chip.textContent = 'Saison: Printemps';
      document.body.appendChild(chip);
    }

    if (!document.getElementById('pm-blitz-banner')) {
      const banner = document.createElement('div');
      banner.id = 'pm-blitz-banner';
      banner.textContent = 'MODE BLITZ ACTIF - 30s / tour - 30 tours max';
      document.body.appendChild(banner);
    }

    if (!document.getElementById('pack-manager-btn')) {
      const btn = document.createElement('button');
      btn.id = 'pack-manager-btn';
      btn.type = 'button';
      btn.textContent = 'Addons';
      btn.addEventListener('click', () => {
        const modal = document.getElementById('pack-manager-modal');
        if (modal) modal.classList.add('open');
      });
      document.body.appendChild(btn);
    }

    if (document.getElementById('pack-manager-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'pack-manager-modal';
    modal.innerHTML =
      '<div id="pack-manager-card">' +
      '<div id="pack-manager-title">Pack Manager</div>' +
      '<div id="pm-sync-box">' +
      '<div id="pm-sync-grid">' +
      '<span>Source</span><b id="pm-sync-source">Local</b>' +
      '<span>Version</span><b id="pm-sync-version">0</b>' +
      '<span>Hash</span><b id="pm-sync-hash">00000000</b>' +
      '<span>Derniere sync</span><b id="pm-sync-time">--:--:--</b>' +
      '</div>' +
      '<div id="pm-sync-note">Local uniquement</div>' +
      '<div id="pm-lock-note">Edition autorisee</div>' +
      '<button id="pm-sync-now" type="button">Forcer la resynchronisation</button>' +
      '</div>' +
      '<div id="pm-tabs">' +
        '<button class="pm-tab active" data-pane="addons" type="button">Addons</button>' +
        '<button class="pm-tab" data-pane="settings" type="button">Reglages</button>' +
      '</div>' +
      // ── pane addons ──
      '<div id="pm-pane-addons" class="active">' +
      '<div class="pm-section">Presets</div>' +
      '<div id="pm-presets">' +
      '<button class="pm-preset" data-pm-preset="classic" type="button">Classique</button>' +
      '<button class="pm-preset" data-pm-preset="chaos" type="button">Chaos</button>' +
      '<button class="pm-preset" data-pm-preset="blitz" type="button">Blitz</button>' +
      '</div>' +
      '<div class="pm-item"><div><div class="pm-label">Saisons Dynamiques</div><div class="pm-desc">Cycle economique tous les 8 tours</div></div><input id="pm-toggle-seasons" class="pm-switch" type="checkbox" /></div>' +
      '<div class="pm-item"><div><div class="pm-label">Prets Bancaires</div><div class="pm-desc">Pret auto quand un joueur passe sous 0$</div></div><input id="pm-toggle-loans" class="pm-switch" type="checkbox" /></div>' +
      '<div class="pm-item"><div><div class="pm-label">Optimisation Rendu</div><div class="pm-desc">Batch render UI/plateau par frame</div></div><input id="pm-toggle-perf" class="pm-switch" type="checkbox" /></div>' +
      '<div class="pm-item"><div><div class="pm-label">Encheres</div><div class="pm-desc">Si achat refuse, vente aux encheres entre joueurs</div></div><input id="pm-toggle-auctions" class="pm-switch" type="checkbox" /></div>' +
      '<div class="pm-item"><div><div class="pm-label">Evenements</div><div class="pm-desc">Evenements aleatoires de debut de tour</div></div><input id="pm-toggle-events" class="pm-switch" type="checkbox" /></div>' +
      '<div class="pm-item"><div><div class="pm-label">Boutique Power-ups</div><div class="pm-desc">Active la boutique d\'objets pendant le tour du joueur</div></div><input id="pm-toggle-powerups" class="pm-switch" type="checkbox" /></div>' +
      '<div class="pm-item"><div><div class="pm-label">Mode Blitz</div><div class="pm-desc">30s/tour, 30 tours max, loyers x1.5</div></div><input id="pm-toggle-blitz" class="pm-switch" type="checkbox" /></div>' +
      '</div>' +
      // ── pane settings ──
      '<div id="pm-pane-settings">' +
      '<div class="pm-section">Evenements</div>' +
      '<div class="pm-field"><span class="pm-field-label">Chance par tour</span><input id="pm-cfg-eventChance" type="number" /><span class="pm-field-unit">%</span></div>' +
      '<div class="pm-section">Mode Blitz</div>' +
      '<div class="pm-field"><span class="pm-field-label">Duree minuteur</span><input id="pm-cfg-blitzTimer" type="number" /><span class="pm-field-unit">s</span></div>' +
      '<div class="pm-field"><span class="pm-field-label">Tours maximum</span><input id="pm-cfg-blitzMaxTurns" type="number" /><span class="pm-field-unit">tours</span></div>' +
      '<div class="pm-field"><span class="pm-field-label">Multiplicateur loyers</span><input id="pm-cfg-blitzRentMult" type="number" /><span class="pm-field-unit">%</span></div>' +
      '<div class="pm-section">Prets Bancaires</div>' +
      '<div class="pm-field"><span class="pm-field-label">Montant du pret</span><input id="pm-cfg-loanAmount" type="number" /><span class="pm-field-unit">$</span></div>' +
      '<div class="pm-field"><span class="pm-field-label">Interets</span><input id="pm-cfg-loanInterest" type="number" /><span class="pm-field-unit">%</span></div>' +
      '<div class="pm-field"><span class="pm-field-label">Duree remboursement</span><input id="pm-cfg-loanRepayTurns" type="number" /><span class="pm-field-unit">tours</span></div>' +
      '<button id="pm-cfg-reset" class="pm-reset" type="button">Reinitialiser les reglages</button>' +
      '</div>' +
      '<button id="pm-close" type="button">Fermer</button>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    document.getElementById('pm-close').addEventListener('click', () => {
      modal.classList.remove('open');
    });

    // ── tab switching ──
    modal.querySelectorAll('.pm-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.pm-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const pane = tab.dataset.pane;
        document.getElementById('pm-pane-addons').classList.toggle('active', pane === 'addons');
        document.getElementById('pm-pane-settings').classList.toggle('active', pane === 'settings');
      });
    });

    document.getElementById('pm-sync-now').addEventListener('click', () => {
      if (isHost()) {
        queueAddonSync({ full: true, note: 'Resynchronisation forcee', immediate: true });
        toastSafe('Resynchronisation demandee', 'i');
      } else {
        requestAddonSync();
      }
    });

    modal.querySelectorAll('[data-pm-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyPreset(btn.getAttribute('data-pm-preset'));
      });
    });

    // ── toggles ──
    const bindToggle = (id, key, onChange) => {
      const el = document.getElementById(id);
      el.checked = !!state[key];
      el.addEventListener('change', () => {
        if (notifyEditLocked()) {
          el.checked = !!state[key];
          return;
        }
        state[key] = el.checked;
        touchMeta('local', window.G && window.G.myId || 'local');
        saveState();
        onChange();
        queueAddonSync({ toggleKey: key, note: 'Modification de ' + key + ' en attente' });
      });
    };

    bindToggle('pm-toggle-seasons', 'seasons', () => {
      applyStateSideEffects();
      toastSafe('Addon Saisons ' + (state.seasons ? 'active' : 'desactive'), state.seasons ? 'a' : 'i');
    });

    bindToggle('pm-toggle-loans', 'loans', () => {
      applyStateSideEffects();
      toastSafe('Addon Prets ' + (state.loans ? 'active' : 'desactive'), state.loans ? 'a' : 'i');
    });

    bindToggle('pm-toggle-perf', 'perf', () => {
      applyStateSideEffects();
      toastSafe('Addon Perf ' + (state.perf ? 'active' : 'desactive'), state.perf ? 'a' : 'i');
    });

    bindToggle('pm-toggle-auctions', 'auctions', () => {
      applyStateSideEffects();
      toastSafe('Addon Encheres ' + (state.auctions ? 'active' : 'desactive'), state.auctions ? 'a' : 'i');
    });

    bindToggle('pm-toggle-events', 'events', () => {
      applyStateSideEffects();
      toastSafe('Addon Evenements ' + (state.events ? 'active' : 'desactive'), state.events ? 'a' : 'i');
    });

    bindToggle('pm-toggle-powerups', 'powerups', () => {
      applyStateSideEffects();
      toastSafe('Boutique Power-ups ' + (state.powerups ? 'active' : 'desactive'), state.powerups ? 'a' : 'i');
    });

    bindToggle('pm-toggle-blitz', 'blitz', () => {
      applyStateSideEffects();
      toastSafe('Mode Blitz ' + (state.blitz ? 'active' : 'desactive'), state.blitz ? 'w' : 'i');
    });

    // ── settings inputs ──
    const cfgFields = [
      'eventChance', 'blitzTimer', 'blitzMaxTurns', 'blitzRentMult',
      'loanAmount', 'loanInterest', 'loanRepayTurns',
    ];

    cfgFields.forEach((key) => {
      const el = document.getElementById('pm-cfg-' + key);
      if (!el) return;
      const b = CFG_BOUNDS[key];
      if (b) { el.min = String(b[0]); el.max = String(b[1]); el.step = String(b[2]); }
      el.value = String(state.cfg[key]);
      el.addEventListener('change', () => {
        if (notifyEditLocked()) {
          el.value = String(state.cfg[key]);
          return;
        }
        const val = clampCfg(key, el.value);
        el.value = String(val);
        state.cfg[key] = val;
        touchMeta('local', window.G && window.G.myId || 'local');
        saveState();
        applyStateSideEffects();
        queueAddonSync({ cfgKey: key, note: 'Reglage ' + key + ' en attente' });
      });
    });

    document.getElementById('pm-cfg-reset').addEventListener('click', () => {
      if (notifyEditLocked()) return;
      const dc = defaultState.cfg;
      Object.keys(dc).forEach((key) => {
        state.cfg[key] = dc[key];
        internals.syncPendingCfgKeys[key] = true;
        const el = document.getElementById('pm-cfg-' + key);
        if (el) el.value = String(dc[key]);
      });
      touchMeta('local', window.G && window.G.myId || 'local');
      saveState();
      applyStateSideEffects();
      queueAddonSync({ full: true, note: 'Reglages reinitialises' });
      toastSafe('Reglages reinitialises', 'i');
    });

    refreshSyncInfo();
  }

  function bootWhenReady() {
    ensureUI();

    try {
      touchMeta(state.meta && state.meta.source, state.meta && state.meta.updatedBy, state.meta && state.meta.version, state.meta && state.meta.updatedAt);
      applyCfgToInternals();
      ensureFunctionPatches();
      patchWsLifecycle();
    } catch (err) {
      try { console.error('[addon-pack-manager] bootstrap error', err); } catch (_) {}
      toastSafe('Pack Manager charge en mode degrade.', 'w');
    }

    if (state.seasons) updateSeasonByTurn();
    else hideSeasonChip();

    applyBlitzState();
    internals.status.source = 'Local';
    internals.status.note = 'Configuration locale chargee';
    internals.status.lastSyncAt = state.meta.updatedAt;
    refreshSyncInfo();

    if (window.G && window.G.ws) attachWsListener(window.G.ws);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootWhenReady);
  } else {
    bootWhenReady();
  }
})();
