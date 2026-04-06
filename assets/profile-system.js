function getVictoryStarCount(){
  return Math.max(0,Math.min(100,Math.floor((P?.stats?.gamesWon||0)/5)));
}

const ELO_TIERS=[
  {min:4000,name:'Maître Absolu',icon:'✨',cls:'er-legend'},
  {min:3200,name:'Légendaire',icon:'👑',cls:'er-legend'},
  {min:2400,name:'Diamant',icon:'💠',cls:'er-diamond'},
  {min:1600,name:'Platine',icon:'💎',cls:'er-plat'},
  {min:800,name:'Or',icon:'🥇',cls:'er-gold'},
  {min:400,name:'Argent',icon:'🥈',cls:'er-silver'},
  {min:0,name:'Bronze',icon:'🥉',cls:'er-bronze'},
];
const ELO_DIV_NAMES=['IV','III','II','I'];

function getEloRankInfo(elo){
  const e=Math.max(0,typeof elo==='number'?elo:0);
  if(e<100)return{label:'— Non Rankée',cls:'er-unranked',tier:'Non Rankée',div:'',icon:'—'};
  for(let ti=0;ti<ELO_TIERS.length;ti++){
    const t=ELO_TIERS[ti];
    if(e>=t.min){
      if(ti<=1)return{label:t.icon+' '+t.name,cls:t.cls,tier:t.name,div:'',icon:t.icon};
      const span=ELO_TIERS[ti-1].min-t.min;
      const divSpan=Math.floor(span/4);
      const off=e-t.min;
      const divIdx=Math.min(3,Math.floor(off/divSpan));
      const div=ELO_DIV_NAMES[divIdx];
      return{label:t.icon+' '+t.name+' '+div,cls:t.cls,tier:t.name,div,icon:t.icon};
    }
  }
  return{label:'— Non Rankée',cls:'er-unranked',tier:'Non Rankée',div:'',icon:'—'};
}

function getRankedDivisionSystemInfo(elo){
  const e=Math.max(0,parseInt(elo,10)||0);
  const rank=getEloRankInfo(e);
  if(e<100){
    return {
      cls:'er-unranked',
      icon:'🎯',
      tier:'Placement',
      div:'',
      label:'🎯 Placement',
      shortLabel:'Placement',
      currentMin:0,
      nextMin:100,
      progressPct:Math.max(4,Math.min(100,Math.round((e/100)*100))),
      pointsToNext:Math.max(0,100-e),
      nextLabel:'Bronze IV',
    };
  }
  const tierIndex=ELO_TIERS.findIndex(t=>t.name===rank.tier);
  const tier=tierIndex>=0?ELO_TIERS[tierIndex]:ELO_TIERS[ELO_TIERS.length-1];
  const prevTier=tierIndex>0?ELO_TIERS[tierIndex-1]:null;
  if(!rank.div){
    const currentMin=tier?.min||0;
    const nextMin=prevTier?.min||currentMin;
    const span=Math.max(1,nextMin-currentMin||400);
    return {
      cls:rank.cls||'er-unranked',
      icon:rank.icon||'🏅',
      tier:rank.tier||'Bronze',
      div:'',
      label:rank.label||'—',
      shortLabel:rank.tier||'Bronze',
      currentMin,
      nextMin,
      progressPct:prevTier?Math.max(8,Math.min(100,Math.round(((e-currentMin)/span)*100))):100,
      pointsToNext:prevTier?Math.max(0,nextMin-e):0,
      nextLabel:prevTier?prevTier.name:'Cap max',
    };
  }
  const tierFloor=tier?.min||0;
  const tierCeil=prevTier?.min||(tierFloor+400);
  const tierSpan=Math.max(4,tierCeil-tierFloor);
  const divSpan=Math.max(1,Math.floor(tierSpan/4));
  const divIndex=Math.max(0,ELO_DIV_NAMES.indexOf(rank.div));
  const currentMin=tierFloor+(divIndex*divSpan);
  const finalDivision=divIndex>=ELO_DIV_NAMES.length-1;
  const nextMin=finalDivision?tierCeil:Math.min(tierCeil,currentMin+divSpan);
  const nextLabel=!finalDivision
    ?((rank.tier||'Bronze')+' '+ELO_DIV_NAMES[Math.min(ELO_DIV_NAMES.length-1,divIndex+1)])
    :(prevTier?(prevTier.name+(tierIndex>2?' IV':'')):'Cap max');
  return {
    cls:rank.cls||'er-unranked',
    icon:rank.icon||'🏅',
    tier:rank.tier||'Bronze',
    div:rank.div||'',
    label:rank.label||'—',
    shortLabel:(rank.tier||'Bronze')+(rank.div?(' '+rank.div):''),
    currentMin,
    nextMin,
    progressPct:Math.max(6,Math.min(100,Math.round(((e-currentMin)/Math.max(1,nextMin-currentMin))*100))),
    pointsToNext:Math.max(0,nextMin-e),
    nextLabel,
  };
}

function renderRankedDivisionPanel(info,title,subtitle){
  const data=info&&typeof info==='object'?info:getRankedDivisionSystemInfo(0);
  const progress=Math.max(0,Math.min(100,parseInt(data.progressPct,10)||0));
  const footLabel=data.pointsToNext>0
    ?(data.pointsToNext+' ELO avant '+(data.nextLabel||'la promo'))
    :'Division max atteinte';
  return ''
    +'<div class="ranked-division-panel '+String(data.cls||'er-unranked')+'">'
      +'<div class="ranked-division-top">'
        +'<div>'
          +'<div class="ranked-division-kicker">'+escapeHtml(title||'🏅 Division ranked')+'</div>'
          +'<div class="ranked-division-name">'+escapeHtml((data.icon||'🏅')+' '+(data.shortLabel||data.label||'Placement'))+'</div>'
        +'</div>'
        +'<div class="ranked-division-badge">'+escapeHtml(data.div?('DIV '+data.div):(data.tier||'TOP'))+'</div>'
      +'</div>'
      +(subtitle?('<div class="ranked-division-sub">'+escapeHtml(subtitle)+'</div>'):'')
      +'<div class="ranked-division-track"><span class="ranked-division-fill" style="width:'+progress+'%"></span></div>'
      +'<div class="ranked-division-meta"><span>'+escapeHtml(String(data.currentMin||0)+' ELO')+'</span><span>'+escapeHtml(String(data.nextMin||data.currentMin||0)+' ELO')+'</span></div>'
      +'<div class="ranked-division-foot">'+escapeHtml(footLabel)+'</div>'
    +'</div>';
}

function renderLobbyVictoryStars(){
  const wrap=document.getElementById('lobby-victory-stars');
  if(!wrap)return;
  const count=getVictoryStarCount();
  if(count===UI_RENDER_CACHE.starsCount)return;
  UI_RENDER_CACHE.starsCount=count;
  if(count<=0){wrap.innerHTML='';return;}
  const out=[];
  for(let i=0;i<count;i++){
    const x=((i*37)%92)+2;
    const y=((i*19)%74)+4;
    const size=10+((i*7)%13);
    const variant=(i%7===0)?' s3':((i%3===0)?' s2':'');
    const delay=((i%9)*.37).toFixed(2)+'s';
    out.push('<span class="victory-star'+variant+'" style="left:'+x+'%;top:'+y+'%;font-size:'+size+'px;--twinkle-offset:'+delay+'">★</span>');
  }
  wrap.innerHTML=out.join('');
}

function applyVictoryTitles(){
  const pcTitle=document.getElementById('pc-title');
  if(!pcTitle)return;
  const rank=getEloRankInfo(P.elo||0);
  let html='<div style="margin-bottom:2px"><span class="elo-rank-badge '+rank.cls+'">'+rank.label+'</span></div>';
  if(Array.isArray(P.titles)&&P.titles.includes('winner_looser')){
    html+='<div><span class="profile-title-badge winner-looser" title="'+escapeAttr(getTitleTooltip('winner_looser'))+'">🏅 Winner Looser</span></div>';
  } else if(P.selectedTitle&&TITLE_DEFS[P.selectedTitle]){
    const def=TITLE_DEFS[P.selectedTitle];
    html+='<div><span class="profile-title-badge '+def.cls+'" title="'+escapeAttr(getTitleTooltip(P.selectedTitle))+'">'+def.label+'</span></div>';
  }
  pcTitle.innerHTML=html;
  renderAmbientFloatingTitles();
}

function renderAmbientFloatingTitles(){
  const keys=Array.isArray(P.titles)?P.titles.filter(k=>TITLE_DEFS[k]):[];
  const wornKey=(Array.isArray(P.titles)&&P.titles.includes('winner_looser'))?'winner_looser':(TITLE_DEFS[P.selectedTitle]?P.selectedTitle:null);
  const floating=keys.filter(k=>k!==wornKey);
  const floatingKey=floating.join('|')+'::'+(wornKey||'');
  if(floatingKey===UI_RENDER_CACHE.floatingKey)return;
  UI_RENDER_CACHE.floatingKey=floatingKey;
  const targets=[document.getElementById('lobby-floating-titles'),document.getElementById('game-floating-titles')];
  const html=floating.map((key,i)=>{
    const def=TITLE_DEFS[key];
    if(!def)return '';
    const x=((i*29)%76)+8;
    const y=((i*17)%62)+14;
    const delay=(-(i%7)*1.35).toFixed(2)+'s';
    const dur=(15+(i%5)*2)+'s';
    return '<span class="floating-title '+def.cls+'" title="'+escapeAttr(getTitleTooltip(key))+'" style="left:'+x+'%;top:'+y+'%;--ft-delay:'+delay+';--ft-dur:'+dur+'">'+def.label+'</span>';
  }).join('');
  targets.forEach(el=>{if(el)el.innerHTML=html;});
}

function updateRankBackdrop(){
  const rank=getEloRankInfo(P.elo||0);
  const rankKey=(rank.cls||'')+'|'+(rank.div||'')+'|'+(rank.icon||'');
  if(rankKey===UI_RENDER_CACHE.rankKey)return;
  UI_RENDER_CACHE.rankKey=rankKey;
  const clsMap={
    'er-unranked':'re-unranked',
    'er-bronze':'re-bronze',
    'er-silver':'re-silver',
    'er-gold':'re-gold',
    'er-plat':'re-plat',
    'er-diamond':'re-diamond',
    'er-legend':'re-legend',
  };
  const emblems=[document.getElementById('lobby-rank-emblem'),document.getElementById('game-rank-emblem')];
  const divCls=rank.div?('rank-div-'+rank.div.toLowerCase()):'';
  emblems.forEach(el=>{
    if(!el)return;
    el.classList.remove('re-unranked','re-bronze','re-silver','re-gold','re-plat','re-diamond','re-legend','rank-div-iv','rank-div-iii','rank-div-ii','rank-div-i');
    el.classList.add(clsMap[rank.cls]||'re-unranked');
    if(divCls)el.classList.add(divCls);
    el.textContent=rank.div?((rank.icon||'—')+' '+rank.div):(rank.icon||'—');
    el.setAttribute('title',rank.label);
  });
}

const TITLE_DEFS={
  win_1:   {label:'🎯 Chanceux',         cls:'vt-1',      req:1,   cond:'Gagner 1 partie'},
  win_5:   {label:'⚔️ Combattant',       cls:'vt-2',      req:5,   cond:'Gagner 5 parties'},
  win_15:  {label:'🏅 Vétéran',          cls:'vt-3',      req:15,  cond:'Gagner 15 parties'},
  win_30:  {label:'🔥 Redoutable',       cls:'vt-4',      req:30,  cond:'Gagner 30 parties'},
  win_50:  {label:'💀 Impitoyable',      cls:'vt-5',      req:50,  cond:'Gagner 50 parties'},
  win_100: {label:'👑 Légende Vivante',  cls:'vt-legend', req:100, cond:'Gagner 100 parties'},
  win_200: {label:'🩸 Mythique',         cls:'vt-m1',     req:200, cond:'Gagner 200 parties'},
  win_350: {label:'⚡ Titan du Plateau',  cls:'vt-m2',     req:350, cond:'Gagner 350 parties'},
  win_500: {label:'🌌 Empereur du Board', cls:'vt-m3',     req:500, cond:'Gagner 500 parties'},
  s_maudit:    {label:'☠️ Le Maudit',          cls:'vt-s1', cond:'Avoir 5 faillites au total'},
  s_nabab:     {label:'💸 Nabab',              cls:'vt-s2', cond:'Atteindre 500000$ de gains cumulés'},
  s_centenaire:{label:'🎖️ Centenaire',         cls:'vt-s3', cond:'Jouer 100 parties'},
  s_noctambule:{label:'🌙 Noctambule',         cls:'vt-s4', cond:'Lancer le jeu entre 00:00 et 03:59'},
  s_spectre:   {label:'👻 Le Spectre',         cls:'vt-s5', cond:'Entrer le code secret Spectre'},
  s_pionnier:  {label:'🌟 Pionnier Neopoly',   cls:'vt-s6', cond:'Entrer le code secret Pionnier'},
  s_marathon:  {label:'🏃 Marathonien',        cls:'vt-s7', cond:'Jouer 1500 tours cumulés'},
  s_ascendant: {label:'🪐 Ascendant',          cls:'vt-s8', cond:'Atteindre 3200 ELO'},
  s_collection:{label:'🧠 Collectionneur',     cls:'vt-s9', cond:'Acheter 120 propriétés cumulées'},
  season_contender:{label:'👑 Prétendant saisonnier', cls:'vt-legend', cond:'Obtenir la Couronne Néon'},
  quest_scout:{label:'🧭 Éclaireur des quêtes', cls:'vt-s4', cond:'Compléter un défi quotidien cosmétique'},
  quest_architect:{label:'🏗️ Architecte mystique', cls:'vt-s7', cond:'Réussir une mission secrète du bâtisseur'},
  quest_curator:{label:'🎨 Curateur prismatique', cls:'vt-legend', cond:'Obtenir la Palette prismatique via une quête'},
  casino_lucky:{label:'🎰 Favori du casino', cls:'vt-s2', cond:'Débloquer un titre via la roulette premium'},
  casino_highroller:{label:'💰 High Roller', cls:'vt-legend', cond:'Décrocher le gros lot du casino NeoPoly'},
  casino_oracle:{label:'🔮 Oracle du jackpot', cls:'vt-m2', cond:'Obtenir le Jeton Astral ou un jackpot secret du casino'},
  season_oracle:{label:'🌠 Oracle de saison', cls:'vt-m3', cond:'Obtenir le Sceau Nebula pendant une saison'},
};

const SECRET_FEATURE_DEFS={
  fx_cosmic:{label:'Cosmic Mode'},
  fx_arcade:{label:'Arcade Pulse'},
  fx_aura:{label:'Aura Elite'},
  fx_jackpot:{label:'Jackpot Mirage'},
  fx_stardust:{label:'Stardust Trails'},
};

function ensureTitleMeta(key){
  if(!key)return;
  if(!P.titleMeta||typeof P.titleMeta!=='object')P.titleMeta={};
  if(!P.titleMeta[key])P.titleMeta[key]={obtainedAt:Date.now()};
}

function escapeAttr(str){
  return String(str||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escapeHtml(str){
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function safeCssColor(color,fallback='#6b7280'){
  const c=String(color||'').trim();
  return /^#[0-9a-fA-F]{6}$/.test(c)?c:fallback;
}

function getTitleTooltip(key){
  const def=TITLE_DEFS[key];
  if(!def&&key!=='winner_looser')return '';
  const cond=key==='winner_looser'
    ? 'Entrer le code 12/23/26 avec au moins 50 défaites'
    : (def?.cond||'Condition inconnue');
  const ts=P.titleMeta?.[key]?.obtainedAt;
  const dateTxt=ts?new Date(ts).toLocaleString('fr-FR'):'Date inconnue';
  return 'Condition: '+cond+'\nObtenu le: '+dateTxt;
}

function ensureSecretUnlock(key){
  if(!key)return;
  if(!P.secretUnlocks||typeof P.secretUnlocks!=='object')P.secretUnlocks={};
  if(!P.secretUnlocks[key])P.secretUnlocks[key]=Date.now();
}

function applySecretUnlocks(){
  const root=document.body;
  if(!root)return;
  const has=k=>!!P.secretUnlocks?.[k];
  root.classList.toggle('secret-cosmic',has('fx_cosmic'));
  root.classList.toggle('secret-arcade',has('fx_arcade'));
  root.classList.toggle('secret-aura',has('fx_aura'));
  root.classList.toggle('secret-jackpot',has('fx_jackpot'));
  root.classList.toggle('secret-stardust',has('fx_stardust'));
}

function unlockSecretFeature(key,toastMsg){
  if(!SECRET_FEATURE_DEFS[key])return false;
  if(typeof canUseAccountProgression==='function'&&!canUseAccountProgression())return false;
  if(P.secretUnlocks?.[key])return false;
  ensureSecretUnlock(key);
  applySecretUnlocks();
  saveProfileData();
  if(toastMsg)toast(toastMsg,'a');
  return true;
}

function getEmojiDefByChar(emoji){
  return EMOJI_UNLOCK_DEFS.find(def=>def.emoji===emoji)||null;
}

function isEmojiUnlocked(emoji){
  const def=getEmojiDefByChar(emoji);
  if(!def)return false;
  if(def.base)return true;
  return !!P.emojiUnlocks?.[def.key];
}

function getUnlockedEmojis(){
  const list=EMOJI_UNLOCK_DEFS.filter(def=>isEmojiUnlocked(def.emoji)).map(def=>def.emoji);
  return list.length?list:[EMOJIS[0]||'🐱'];
}

function ensureEmojiUnlocks(notify=true){
  if(typeof canUseAccountProgression==='function'&&!canUseAccountProgression())return false;
  if(!P.emojiUnlocks||typeof P.emojiUnlocks!=='object')P.emojiUnlocks={};
  let changed=false;
  EMOJI_UNLOCK_DEFS.forEach(def=>{
    if(def.base)return;
    if(P.emojiUnlocks[def.key])return;
    const ok=typeof def.unlock==='function'?!!def.unlock(P):false;
    if(!ok)return;
    P.emojiUnlocks[def.key]=Date.now();
    changed=true;
    if(notify){
      if(def.secret)toast('🔐 Emoji secret débloqué !','a');
      else toast('🧩 Emoji débloqué : '+def.emoji+' ('+def.cond+')','a');
    }
  });
  if(changed){
    saveProfileData();
    renderPartyEmojiPickers();
  }
  return changed;
}

function renderPartyEmojiPickers(){
  const pickers=[...document.querySelectorAll('.emoji-picker')];
  const localPicker=document.getElementById('emoji-picker');
  if(localPicker)pickers.push(localPicker);
  pickers.forEach(picker=>{
    const inputId=picker.getAttribute('data-for')||(picker.id==='emoji-picker'?'lc-emoji':'');
    if(!inputId)return;
    const input=document.getElementById(inputId);
    if(!input)return;
    const unlocked=getUnlockedEmojis();
    if(!isEmojiUnlocked(input.value))input.value=unlocked[0];
    picker.innerHTML=EMOJI_UNLOCK_DEFS.map(def=>{
      const unlockedNow=isEmojiUnlocked(def.emoji);
      const secretLocked=def.secret&&!unlockedNow;
      const symbol=unlockedNow?def.emoji:(secretLocked?'❔':'🔒');
      const lockReason=def.secret?'Condition secrète':(def.cond||'Condition à remplir');
      const titleTxt=unlockedNow?(def.label||def.emoji):lockReason;
      const active=unlockedNow&&input.value===def.emoji;
      return '<span class="emoji-choice" data-emoji="'+def.emoji+'" data-unlocked="'+(unlockedNow?'1':'0')+'" data-lock-reason="'+escapeAttr(lockReason)+'" title="'+escapeAttr(titleTxt)+'" style="cursor:'+(unlockedNow?'pointer':'not-allowed')+';font-size:1.5em;opacity:'+(active?'1':(unlockedNow?'.4':'.25'))+';filter:'+(secretLocked?'saturate(0.2)':'none')+'">'+symbol+'</span>';
    }).join('');
  });
}

function renderEmojiCollection(){
  const countEl=document.getElementById('emoji-collection-count');
  const barEl=document.getElementById('emoji-collection-bar');
  const labelEl=document.getElementById('emoji-collection-label');
  const gridEl=document.getElementById('emoji-collection-grid');
  if(!countEl||!barEl||!labelEl||!gridEl)return;

  const total=EMOJI_UNLOCK_DEFS.length;
  const unlockedDefs=EMOJI_UNLOCK_DEFS.filter(def=>isEmojiUnlocked(def.emoji));
  const unlocked=unlockedDefs.length;
  const pct=total?Math.round((unlocked/total)*100):0;

  countEl.textContent=unlocked+' / '+total;
  barEl.style.width=pct+'%';
  labelEl.textContent='Progression: '+pct+'%';

  gridEl.innerHTML=EMOJI_UNLOCK_DEFS.map(def=>{
    const ok=isEmojiUnlocked(def.emoji);
    const char=ok?def.emoji:(def.secret?'❔':'🔒');
    const title=getEmojiTooltip(def);
    return '<div title="'+escapeAttr(title)+'" style="height:34px;border-radius:8px;border:1px solid '+(ok?'rgba(34,197,94,.45)':'var(--border)')+';background:'+(ok?'rgba(34,197,94,.1)':'var(--s2)')+';display:flex;align-items:center;justify-content:center;font-size:1.1rem;opacity:'+(ok?'1':'.68')+'">'+char+'</div>';
  }).join('');
}

function getEmojiConditionText(def,unlocked){
  if(def.base)return 'Disponible de base';
  if(def.secret&&!unlocked)return 'Condition secrète';
  return def.cond||'Condition inconnue';
}

function getEmojiObtainedText(def,unlocked){
  if(def.base)return 'De base';
  if(!unlocked)return 'Non obtenu';
  const ts=parseInt(P.emojiUnlocks?.[def.key],10)||0;
  return ts?new Date(ts).toLocaleString('fr-FR'):'Date inconnue';
}

function getEmojiTooltip(def){
  const unlocked=isEmojiUnlocked(def.emoji);
  const cond=getEmojiConditionText(def,unlocked);
  const dateTxt=getEmojiObtainedText(def,unlocked);
  return 'Condition: '+cond+'\nObtenu le: '+dateTxt;
}

const _S={
  a:btoa('spectre'),
  b:btoa('np2026'),
  d:btoa('nebula'),
  e:btoa('8bit'),
};

const UI_RENDER_CACHE={
  starsCount:null,
  floatingKey:'',
  rankKey:'',
  emojiKey:'',
  statsKey:'',
  leaderboardKey:'',
};

const GLOBAL_LEADERBOARD_STATE={
  entries:[],
  status:'Ladder local',
  loading:false,
  lastFetchAt:0,
  onlinePlayers:0,
  siteUsers:0,
  publicRooms:0,
};
let globalLeaderboardFetchTimer=null;
let globalLeaderboardLiveTicker=null;
let remoteProfileSyncTimer=null;
const GLOBAL_LEADERBOARD_FETCH_COOLDOWN_MS=45000;
const GLOBAL_LEADERBOARD_LIVE_REFRESH_MS=5000;
const SITE_PRESENCE_STORAGE_KEY='NP_SITE_PRESENCE_ID';
const SITE_PRESENCE_TAB_KEY='NP_SITE_PRESENCE_TAB_ID';
const SITE_PRESENCE_PING_MS=25000;
let sitePresenceTimer=null;
let sitePresenceInFlight=false;
let sitePresenceStarted=false;

function createSitePresenceToken(prefix='np'){
  try{
    if(window.crypto&&typeof window.crypto.randomUUID==='function')return prefix+'-'+window.crypto.randomUUID();
  }catch(_){ }
  return prefix+'-'+Math.random().toString(36).slice(2,10)+'-'+Date.now().toString(36);
}

function getSitePresenceId(){
  try{
    let id=localStorage.getItem(SITE_PRESENCE_STORAGE_KEY)||'';
    if(!id){
      id=createSitePresenceToken('site');
      localStorage.setItem(SITE_PRESENCE_STORAGE_KEY,id);
    }
    return id;
  }catch(_){
    if(!window.__npSitePresenceId)window.__npSitePresenceId=createSitePresenceToken('site');
    return window.__npSitePresenceId;
  }
}

function getSitePresenceTabId(){
  try{
    let id=sessionStorage.getItem(SITE_PRESENCE_TAB_KEY)||'';
    if(!id){
      id=createSitePresenceToken('tab');
      sessionStorage.setItem(SITE_PRESENCE_TAB_KEY,id);
    }
    return id;
  }catch(_){
    if(!window.__npSitePresenceTabId)window.__npSitePresenceTabId=createSitePresenceToken('tab');
    return window.__npSitePresenceTabId;
  }
}

function getSitePresencePayload(){
  return {
    presenceId:getSitePresenceId(),
    tabId:getSitePresenceTabId(),
    uid:P?.uid||'',
    name:P?.name||'Joueur',
    page:String(window.location?.pathname||'/'),
  };
}
if(typeof window!=='undefined')window.getSitePresencePayload=getSitePresencePayload;

async function pingSitePresence(opts){
  const options=opts&&typeof opts==='object'?opts:{};
  const base=(typeof getGoogleApiBase==='function'?String(getGoogleApiBase()||''):'').replace(/\/$/, '');
  if(!base)return false;
  const payload=getSitePresencePayload();
  const url=base+(options.leave?'/api/presence/leave':'/api/presence/ping');
  if(options.leave&&typeof navigator!=='undefined'&&typeof navigator.sendBeacon==='function'){
    try{
      const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
      navigator.sendBeacon(url,blob);
      return true;
    }catch(_){ }
  }
  if(sitePresenceInFlight&&!options.force&&!options.leave)return false;
  sitePresenceInFlight=true;
  try{
    const r=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload),
      cache:'no-store',
      keepalive:!!options.keepalive,
    });
    const data=await r.json().catch(()=>null);
    const live=data&&data.live&&typeof data.live==='object'?data.live:data;
    if(r.ok&&data&&data.ok&&live){
      if(live.onlinePlayers!==undefined)GLOBAL_LEADERBOARD_STATE.onlinePlayers=Math.max(0,parseInt(live.onlinePlayers,10)||0);
      if(live.siteUsers!==undefined)GLOBAL_LEADERBOARD_STATE.siteUsers=Math.max(0,parseInt(live.siteUsers,10)||0);
      if(live.publicRooms!==undefined)GLOBAL_LEADERBOARD_STATE.publicRooms=Math.max(0,parseInt(live.publicRooms,10)||0);
      renderGlobalLeaderboardCard();
      return true;
    }
  }catch(_){
  }finally{
    sitePresenceInFlight=false;
  }
  return false;
}

function ensureSitePresenceHeartbeat(){
  if(sitePresenceStarted)return;
  sitePresenceStarted=true;
  pingSitePresence({force:true});
  if(sitePresenceTimer)clearInterval(sitePresenceTimer);
  sitePresenceTimer=setInterval(()=>{pingSitePresence({force:true});},SITE_PRESENCE_PING_MS);
  if(typeof window!=='undefined'&&!window.__npSitePresenceBound){
    window.__npSitePresenceBound=true;
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible')pingSitePresence({force:true});
    });
    window.addEventListener('pagehide',()=>{pingSitePresence({leave:true,keepalive:true,force:true});});
    window.addEventListener('beforeunload',()=>{pingSitePresence({leave:true,keepalive:true,force:true});});
  }
}

function normalizeGlobalLeaderboardEntry(raw,source='local'){
  if(!raw||typeof raw!=='object')return null;
  const uid=String(raw.uid||'').trim();
  const name=String(raw.name||'Joueur').trim()||'Joueur';
  const avatarRaw=String(raw.avatar||'').trim();
  const avatarImg=String(raw.avatarImg||((/^(data:|blob:|https?:)/i.test(avatarRaw))?avatarRaw:'')||'').trim()||null;
  const emoji=String(raw.emoji||((!avatarImg&&avatarRaw&&!/^(data:|blob:|https?:)/i.test(avatarRaw))?avatarRaw:'👤')||'👤');
  const color=safeCssColor(raw.color,'#22c55e');
  const elo=Math.max(0,parseInt(raw.elo,10)||0);
  const wins=Math.max(0,parseInt(raw.wins ?? raw.gamesWon,10)||0);
  const gamesPlayed=Math.max(0,parseInt(raw.gamesPlayed,10)||0);
  const gamesLost=Math.max(0,parseInt(raw.gamesLost ?? raw.losses,10)||0);
  const propertiesBought=Math.max(0,parseInt(raw.propertiesBought,10)||0);
  const moneyEarned=Math.max(0,parseInt(raw.moneyEarned ?? raw.totalMoney,10)||0);
  const titlesCount=Math.max(0,parseInt(raw.titlesCount,10)||(Array.isArray(raw.unlockedTitles)?raw.unlockedTitles.length:0));
  const emojiCount=Math.max(1,parseInt(raw.emojiCount,10)||1);
  const titleLabel=String(raw.titleLabel||raw.title||'').trim();
  const rankLabel=String(raw.rankLabel||getEloRankInfo(elo).label||'— Non Rankée');
  if(!uid&&!name)return null;
  return {
    uid,
    key:uid?('uid:'+uid):('name:'+name.toLowerCase()),
    name,
    avatarImg,
    emoji,
    color,
    elo,
    wins,
    gamesPlayed,
    gamesLost,
    propertiesBought,
    moneyEarned,
    titlesCount,
    emojiCount,
    titleLabel,
    rankLabel,
    profilePrivate:!!raw.profilePrivate,
    googleConnected:!!raw.googleConnected,
    source,
    updatedAt:Math.max(0,parseInt(raw.updatedAt,10)||0),
  };
}

function mergeGlobalLeaderboardEntries(entries){
  const map=new Map();
  (Array.isArray(entries)?entries:[]).forEach(raw=>{
    const entry=normalizeGlobalLeaderboardEntry(raw,raw&&raw.source?raw.source:'local');
    if(!entry)return;
    const existing=map.get(entry.key);
    if(!existing){
      map.set(entry.key,entry);
      return;
    }
    existing.elo=Math.max(existing.elo,entry.elo);
    existing.wins=Math.max(existing.wins,entry.wins);
    existing.gamesPlayed=Math.max(existing.gamesPlayed,entry.gamesPlayed);
    existing.gamesLost=Math.max(existing.gamesLost||0,entry.gamesLost||0);
    existing.propertiesBought=Math.max(existing.propertiesBought||0,entry.propertiesBought||0);
    existing.moneyEarned=Math.max(existing.moneyEarned||0,entry.moneyEarned||0);
    existing.titlesCount=Math.max(existing.titlesCount||0,entry.titlesCount||0);
    existing.emojiCount=Math.max(existing.emojiCount||1,entry.emojiCount||1);
    existing.profilePrivate=!!(existing.profilePrivate||entry.profilePrivate);
    existing.googleConnected=!!(existing.googleConnected||entry.googleConnected);
    existing.updatedAt=Math.max(existing.updatedAt||0,entry.updatedAt||0);
    if(entry.source==='remote')existing.source='remote';
    ['name','avatarImg','emoji','color','titleLabel','rankLabel'].forEach(field=>{
      const nextValue=entry[field];
      if(!nextValue)return;
      if(entry.source==='remote'||!existing[field]||existing[field]==='Joueur'||existing[field]==='👤'||existing[field]==='— Non Rankée'){
        existing[field]=nextValue;
      }
    });
  });
  return Array.from(map.values());
}

function collectKnownLeaderboardEntries(){
  const localEntries=[{
    uid:P.uid,
    name:P.name,
    avatarImg:P.avatarImg||null,
    emoji:P.emoji||'👤',
    color:P.color,
    elo:P.elo||0,
    wins:P.stats?.gamesWon||0,
    gamesPlayed:P.stats?.gamesPlayed||0,
    gamesLost:P.stats?.gamesLost||0,
    propertiesBought:P.stats?.propertiesBought||0,
    moneyEarned:P.stats?.moneyEarned||0,
    titlesCount:Array.isArray(P.titles)?P.titles.length:0,
    emojiCount:(P.emojiUnlocks&&typeof P.emojiUnlocks==='object')?Object.keys(P.emojiUnlocks).length:1,
    titleLabel:getActiveProfileTitleLabel(P),
    rankLabel:getEloRankInfo(P.elo||0).label,
    googleConnected:!!P.googleConnected,
    profilePrivate:!!P.chatProfilePrivate,
    source:'local',
    updatedAt:Date.now(),
  }];
  if(Array.isArray(P.friends))P.friends.forEach(friend=>{
    if(!friend||friend.profilePrivate)return;
    localEntries.push({
      uid:friend.uid,
      name:friend.name,
      avatarImg:friend.avatarImg||null,
      emoji:friend.emoji||'👤',
      color:friend.color,
      elo:friend.elo||0,
      gamesWon:friend.gamesWon||0,
      gamesPlayed:friend.gamesPlayed||0,
      gamesLost:friend.gamesLost||0,
      propertiesBought:friend.propertiesBought||0,
      moneyEarned:friend.moneyEarned||0,
      titlesCount:friend.titlesCount||0,
      emojiCount:friend.emojiCount||1,
      titleLabel:friend.titleLabel||'',
      rankLabel:friend.rankLabel||'',
      googleConnected:!!friend.googleConnected,
      source:'friend',
      updatedAt:friend.updatedAt||friend.addedAt||0,
    });
  });
  if(Array.isArray(P.chatLog))P.chatLog.slice(-120).forEach(msg=>{
    if(!msg||msg.profilePrivate)return;
    localEntries.push({
      uid:msg.uid,
      name:msg.name,
      avatarImg:msg.avatarImg||null,
      emoji:msg.emoji||'👤',
      color:msg.color,
      elo:msg.elo||0,
      gamesWon:msg.gamesWon||0,
      gamesPlayed:msg.gamesPlayed||0,
      gamesLost:msg.gamesLost||0,
      propertiesBought:msg.propertiesBought||0,
      moneyEarned:msg.moneyEarned||0,
      titlesCount:msg.titlesCount||0,
      emojiCount:msg.emojiCount||1,
      titleLabel:msg.titleLabel||'',
      rankLabel:msg.rankLabel||'',
      googleConnected:!!msg.googleConnected,
      source:'chat',
      updatedAt:msg.ts||0,
    });
  });
  return mergeGlobalLeaderboardEntries(localEntries).filter(entry=>entry&&(entry.elo>0||entry.wins>0||entry.gamesPlayed>0||entry.uid===P.uid));
}

function getGlobalLeaderboardEntries(){
  return mergeGlobalLeaderboardEntries([...(GLOBAL_LEADERBOARD_STATE.entries||[]),...collectKnownLeaderboardEntries()]);
}

function renderGlobalLeaderboardProfileModal(entry){
  const body=document.getElementById('global-profile-modal-body');
  if(!body)return;
  const entries=getGlobalLeaderboardEntries();
  if(!entries.length){
    body.innerHTML='<div class="leaderboard-profile-note">Aucune donnée de classement disponible pour le moment.</div>';
    return;
  }
  const eloSorted=entries.slice().sort((a,b)=>(b.elo-a.elo)||(b.wins-a.wins)||(b.gamesPlayed-a.gamesPlayed)||String(a.name||'').localeCompare(String(b.name||'')));
  const winsSorted=entries.slice().sort((a,b)=>(b.wins-a.wins)||(b.elo-a.elo)||(b.gamesPlayed-a.gamesPlayed)||String(a.name||'').localeCompare(String(b.name||'')));
  const topElo=eloSorted.slice(0,10);
  const topWins=winsSorted.slice(0,10);
  const selectedKey=String(entry&&entry.key||'').trim();
  const focus=entries.find(item=>String(item.key||'')===selectedKey)||(P.uid?entries.find(item=>item.uid===P.uid):null)||topElo[0]||entries[0];
  const focusUid=String(focus&&focus.uid||'').trim();
  const focusIsSelf=!!(focusUid&&focusUid===P.uid);
  const focusRank=getEloRankInfo(focus?.elo||0);
  const focusColor=safeCssColor(focus?.color,'#22c55e');
  const focusAvatar=(focus&&focus.avatarImg)
    ?'<img src="'+escapeAttr(focus.avatarImg)+'" alt="avatar">'
    :escapeHtml(focus?.emoji||'👤');
  const focusEloPos=Math.max(0,eloSorted.findIndex(item=>String(item.key||'')===String(focus?.key||''))+1);
  const focusWinsPos=Math.max(0,winsSorted.findIndex(item=>String(item.key||'')===String(focus?.key||''))+1);
  const myEloPos=Math.max(0,eloSorted.findIndex(item=>item.uid&&item.uid===P.uid)+1);
  const myWinsPos=Math.max(0,winsSorted.findIndex(item=>item.uid&&item.uid===P.uid)+1);
  const focusDivision=getRankedDivisionSystemInfo(focus?.elo||0);
  const myDivision=getRankedDivisionSystemInfo(P.elo||0);
  const winsLeader=topWins[0]||null;
  const eloLeader=topElo[0]||null;
  const totalMatches=entries.reduce((sum,item)=>sum+(parseInt(item.gamesPlayed,10)||0),0);
  const totalWins=entries.reduce((sum,item)=>sum+(parseInt(item.wins,10)||0),0);
  const onlinePlayers=Math.max(0,parseInt(GLOBAL_LEADERBOARD_STATE.onlinePlayers,10)||0);
  const siteUsers=Math.max(0,parseInt(GLOBAL_LEADERBOARD_STATE.siteUsers,10)||0);
  const publicRooms=Math.max(0,parseInt(GLOBAL_LEADERBOARD_STATE.publicRooms,10)||0);
  const focusStatus=focusEloPos===1
    ?'👑 Seed #1'
    :(focusWinsPos===1
      ?'🏆 Clutch Player'
      :(((focusEloPos&&focusEloPos<=3)||(focusWinsPos&&focusWinsPos<=3))
        ?'🔥 Top Seed'
        :'⚡ Ranked Contender'));
  const focusSummary=(focus?.gamesPlayed||0)>0
    ?((focus?.wins||0)+' victoire'+((focus?.wins||0)>1?'s':'')+' • '+Math.round(((focus?.wins||0)/Math.max(1,focus?.gamesPlayed||0))*100)+'% winrate')
    :'Aucune partie enregistrée pour le moment';
  body.innerHTML=''
    +'<div class="global-leaderboard-hero">'
      +'<div class="global-leaderboard-hero-top">'
        +'<div>'
          +'<div class="global-leaderboard-hero-title">🏟️ NeoPoly Ranked Arena</div>'
          +'<div class="global-leaderboard-hero-sub">Ladder esports officiel • Top 10 ELO + victoires • '+entries.length+' joueurs suivis • '+onlinePlayers+' en ligne</div>'
        +'</div>'
        +'<div class="global-leaderboard-crown">💎</div>'
      +'</div>'
      +'<div class="global-leaderboard-hero-pills">'
        +'<span class="global-leaderboard-pill primary">🎯 Ranked Esports</span>'
        +'<span class="global-leaderboard-pill">👑 Leader ELO : '+escapeHtml(eloLeader?.name||'—')+'</span>'
        +'<span class="global-leaderboard-pill">🏆 Leader victoires : '+escapeHtml(winsLeader?.name||'—')+'</span>'
        +'<span class="global-leaderboard-pill">🟢 En ligne : '+onlinePlayers+'</span>'
        +'<span class="global-leaderboard-pill">🌐 Sur le site : '+siteUsers+'</span>'
        +'<span class="global-leaderboard-pill">🏠 Salons ouverts : '+publicRooms+'</span>'
        +'<span class="global-leaderboard-pill">🎮 Matchs classés : '+totalMatches+'</span>'
        +'<span class="global-leaderboard-pill">⚔️ Wins ladder : '+totalWins+'</span>'
        +'<span class="global-leaderboard-pill">🎯 Votre rang ELO : '+(myEloPos?('#'+myEloPos):'—')+'</span>'
        +'<span class="global-leaderboard-pill">🔥 Votre rang victoires : '+(myWinsPos?('#'+myWinsPos):'—')+'</span>'
      +'</div>'
    +'</div>'
    +'<div class="leaderboard-premium-focus">'
      +'<div class="leaderboard-profile-hero">'
        +'<div class="leaderboard-profile-avatar" style="border-color:'+focusColor+';background:'+(focus?.avatarImg?'rgba(15,23,42,.9)':(focusColor+'22'))+'">'+focusAvatar+'</div>'
        +'<div class="leaderboard-profile-meta">'
          +'<div class="leaderboard-profile-kicker">'+escapeHtml(focusStatus)+'</div>'
          +'<div class="leaderboard-profile-name" style="color:'+focusColor+'">'+escapeHtml(focus?.name||'Joueur')+(focusIsSelf?'<span class="global-leaderboard-you">Vous</span>':'')+'</div>'
          +'<div class="leaderboard-profile-sub">'+escapeHtml(focusSummary)+' • position ELO '+(focusEloPos?('#'+focusEloPos):'—')+' • position victoires '+(focusWinsPos?('#'+focusWinsPos):'—')+'</div>'
          +'<div class="leaderboard-profile-badges">'
            +'<span class="elo-rank-badge '+String(focusRank.cls||'er-unranked')+'">'+escapeHtml(focus?.rankLabel||focusRank.label||'— Non Rankée')+'</span>'
            +'<span class="global-leaderboard-chip chip-rank">'+escapeHtml((focusRank.icon||'🏅')+' '+(focusRank.tier||'Bronze')+(focusRank.div?(' '+focusRank.div):''))+'</span>'
            +(focus?.titleLabel?('<span class="leaderboard-profile-tag">'+escapeHtml(focus.titleLabel)+'</span>'):'')
          +'</div>'
        +'</div>'
      +'</div>'
    +'</div>'
    +'<div class="leaderboard-profile-grid">'
      +'<div class="leaderboard-profile-stat super"><div class="leaderboard-profile-stat-val">'+entries.length+'</div><div class="leaderboard-profile-stat-label">🌐 Joueurs visibles</div></div>'
      +'<div class="leaderboard-profile-stat super"><div class="leaderboard-profile-stat-val">'+(eloLeader?eloLeader.elo:'—')+'</div><div class="leaderboard-profile-stat-label">📈 Meilleur ELO</div></div>'
      +'<div class="leaderboard-profile-stat super"><div class="leaderboard-profile-stat-val">'+(winsLeader?winsLeader.wins:'—')+'</div><div class="leaderboard-profile-stat-label">🏆 Meilleures victoires</div></div>'
      +'<div class="leaderboard-profile-stat"><div class="leaderboard-profile-stat-val">'+(focus?.elo||0)+'</div><div class="leaderboard-profile-stat-label">🎖️ ELO focus</div></div>'
      +'<div class="leaderboard-profile-stat"><div class="leaderboard-profile-stat-val">'+(focus?.wins||0)+'</div><div class="leaderboard-profile-stat-label">⚔️ Victoires focus</div></div>'
      +'<div class="leaderboard-profile-stat"><div class="leaderboard-profile-stat-val">'+(focus?.gamesPlayed||0)+'</div><div class="leaderboard-profile-stat-label">🎮 Parties focus</div></div>'
    +'</div>'
    +'<div class="ranked-division-wrap">'
      +renderRankedDivisionPanel(focusDivision,'🏅 Division du joueur focus',focusIsSelf?'Votre progression classée':'Progression du seed sélectionné')
      +renderRankedDivisionPanel(myDivision,'🎯 Votre division actuelle','Suivi de votre promotion ranked')
    +'</div>'
    +'<div class="leaderboard-profile-note">Clique sur une ligne pour changer le joueur mis en avant, tout en gardant la vue grand format du ladder ranked.</div>'
    +'<div class="global-leaderboard-grid">'
      +'<div class="global-leaderboard-section premium-elo">'
        +'<div class="global-leaderboard-section-title">📊 Top 10 ELO</div>'
        +renderGlobalLeaderboardList(topElo,'elo',{highlightKey:String(focus?.key||'')})
      +'</div>'
      +'<div class="global-leaderboard-section premium-wins">'
        +'<div class="global-leaderboard-section-title">🏆 Top 10 victoires</div>'
        +renderGlobalLeaderboardList(topWins,'wins',{highlightKey:String(focus?.key||'')})
      +'</div>'
    +'</div>'
    +'<div class="leaderboard-profile-actions">'
      +(focusUid?'<button class="btn btn-secondary btn-sm" type="button" id="global-profile-copy-btn">📋 Copier le code</button>':'')
      +(!focusIsSelf&&focusUid?'<button class="btn btn-blue btn-sm" type="button" id="global-profile-friend-btn">👫 Ajouter / gérer</button>':'')
      +'<button class="btn btn-primary btn-sm" type="button" onclick="closeModal(\'modal-global-profile\')">Fermer</button>'
    +'</div>';

  bindGlobalLeaderboardInteractions(body);
  const copyBtn=document.getElementById('global-profile-copy-btn');
  if(copyBtn&&focusUid)copyBtn.onclick=()=>{
    if(typeof copyChatUserUid==='function')copyChatUserUid(focusUid);
    else navigator.clipboard?.writeText(focusUid).catch(()=>{});
  };
  const friendBtn=document.getElementById('global-profile-friend-btn');
  if(friendBtn&&focusUid){
    const alreadyFriend=(typeof hasFriendUid==='function')?hasFriendUid(focusUid):false;
    friendBtn.textContent=alreadyFriend?'❌ Retirer des amis':'👫 Ajouter en ami';
    friendBtn.className='btn '+(alreadyFriend?'btn-secondary':'btn-blue')+' btn-sm';
    friendBtn.onclick=()=>{
      if(alreadyFriend&&typeof removeFriend==='function'){
        removeFriend(focusUid);
        friendBtn.textContent='👫 Ajouter en ami';
        friendBtn.className='btn btn-blue btn-sm';
        toast('👫 Ami retiré','i');
      }else if(typeof addFriendFromProfile==='function'){
        addFriendFromProfile({
          uid:focusUid,
          name:focus?.name||'Joueur',
          emoji:focus?.emoji||'👤',
          avatarImg:focus?.avatarImg||null,
          color:focusColor,
          elo:focus?.elo||0,
          rankLabel:focus?.rankLabel||focusRank.label||'',
          titleLabel:focus?.titleLabel||'',
          gamesWon:focus?.wins||0,
          gamesPlayed:focus?.gamesPlayed||0,
          gamesLost:focus?.gamesLost||0,
          propertiesBought:focus?.propertiesBought||0,
          moneyEarned:focus?.moneyEarned||0,
          titlesCount:focus?.titlesCount||0,
          emojiCount:focus?.emojiCount||1,
          googleConnected:!!focus?.googleConnected,
        },{silent:false});
      }
    };
  }
}

function openGlobalLeaderboardEntryProfile(event,entryKey){
  const key=String(entryKey||'').trim();
  const entry=getGlobalLeaderboardEntries().find(item=>String(item.key||'')===key);
  if(!entry){toast('Profil introuvable.','w');return;}
  if(event&&typeof event.preventDefault==='function')event.preventDefault();
  if(event&&typeof event.stopPropagation==='function')event.stopPropagation();
  if(typeof closeChatUserMenu==='function')closeChatUserMenu();
  renderGlobalLeaderboardProfileModal(entry);
  if(typeof openModal==='function')openModal('modal-global-profile');
}

function bindGlobalLeaderboardInteractions(root){
  const host=root||document;
  host.querySelectorAll('.global-leaderboard-row[data-entry-key]').forEach(row=>{
    const key=String(row.dataset.entryKey||'').trim();
    if(!key||row.dataset.bound==='1')return;
    row.dataset.bound='1';
    row.addEventListener('click',ev=>openGlobalLeaderboardEntryProfile(ev,key));
    row.addEventListener('keydown',ev=>{
      if(ev.key==='Enter'||ev.key===' '){
        ev.preventDefault();
        openGlobalLeaderboardEntryProfile(ev,key);
      }
    });
  });
}

function renderGlobalLeaderboardList(entries,metric,opts){
  const options=opts&&typeof opts==='object'?opts:{};
  const highlightKey=String(options.highlightKey||'').trim();
  const rows=(Array.isArray(entries)?entries:[]).slice(0,10);
  if(!rows.length)return '<div class="global-leaderboard-meta-note">Pas encore de score visible.</div>';
  const medals=['🥇','🥈','🥉'];
  const leaderValue=Math.max(1,...rows.map(entry=>Math.max(0,metric==='elo'?entry.elo:entry.wins)));
  return '<div class="global-leaderboard-list">'+rows.map((entry,idx)=>{
    const isSelf=!!(entry.uid&&entry.uid===P.uid);
    const metricValue=metric==='elo'?entry.elo:entry.wins;
    const ratio=Math.max(8,Math.min(100,Math.round((metricValue/leaderValue)*100)));
    const podiumClass=idx===0?' podium-1':(idx===1?' podium-2':(idx===2?' podium-3':''));
    const rankInfo=getEloRankInfo(entry.elo||0);
    const primaryChip=metric==='elo'?(entry.rankLabel||'— Non Rankée'):('ELO '+(entry.elo||0));
    const secondaryChip=metric==='elo'
      ?((entry.wins||0)+' victoire'+((entry.wins||0)>1?'s':''))
      :(entry.rankLabel||((entry.gamesPlayed||0)+' partie'+((entry.gamesPlayed||0)>1?'s':'')));
    const rankChip='<span class="global-leaderboard-chip chip-rank">'+escapeHtml((rankInfo.icon||'🏅')+' '+(rankInfo.tier||'Bronze')+(rankInfo.div?(' '+rankInfo.div):''))+'</span>';
    const divisionChip=rankInfo.div?('<span class="global-leaderboard-chip chip-division">DIV '+escapeHtml(rankInfo.div)+'</span>'):'';
    const titleChip=entry.titleLabel?('<span class="global-leaderboard-chip chip-title">'+escapeHtml(entry.titleLabel)+'</span>'):'';
    const ribbonLabel=idx===0?'MVP':(idx===1?'ACE':(idx===2?'CLUTCH':''));
    const avatarHtml=entry.avatarImg
      ?('<img src="'+escapeAttr(entry.avatarImg)+'" alt="avatar">')
      :escapeHtml(entry.emoji||'👤');
    const focusClass=(highlightKey&&highlightKey===String(entry.key||''))?' focus-selected':'';
    return '<div class="global-leaderboard-row'+(isSelf?' is-self':'')+focusClass+podiumClass+'" style="--glb-accent:'+entry.color+';--glb-delay:'+(idx*0.045).toFixed(2)+'s" data-entry-key="'+escapeAttr(entry.key)+'" role="button" tabindex="0" title="Voir le ladder ranked">'
      +(ribbonLabel?('<span class="global-leaderboard-ribbon">'+ribbonLabel+'</span>'):'')
      +'<div class="global-leaderboard-pos">'+(medals[idx]||('#'+(idx+1)))+'</div>'
      +'<div class="global-leaderboard-avatar" style="border-color:'+entry.color+';background:'+(entry.avatarImg?'rgba(15,23,42,.9)':(entry.color+'22'))+'">'+avatarHtml+'</div>'
      +'<div class="global-leaderboard-main">'
        +'<div class="global-leaderboard-name" style="color:'+entry.color+'">'+escapeHtml(entry.name||'Joueur')+(isSelf?'<span class="global-leaderboard-you">Vous</span>':'')+'</div>'
        +'<div class="global-leaderboard-sub">'
          +'<span class="global-leaderboard-chip">'+escapeHtml(primaryChip)+'</span>'
          +rankChip
          +divisionChip
          +'<span class="global-leaderboard-chip">'+escapeHtml(secondaryChip)+'</span>'
          +titleChip
        +'</div>'
      +'</div>'
      +'<div class="global-leaderboard-side">'
        +'<div class="global-leaderboard-metric">'+metricValue+'</div>'
        +'<div class="global-leaderboard-bar"><span class="global-leaderboard-fill" style="width:'+ratio+'%"></span></div>'
      +'</div>'
    +'</div>';
  }).join('')+'</div>';
}

function renderGlobalLeaderboardCard(){
  const host=document.getElementById('global-leaderboard-card');
  const meta=document.getElementById('global-leaderboard-meta');
  if(!host)return;
  const entries=getGlobalLeaderboardEntries();
  const eloSorted=entries.slice().sort((a,b)=>(b.elo-a.elo)||(b.wins-a.wins)||(b.gamesPlayed-a.gamesPlayed)||String(a.name||'').localeCompare(String(b.name||'')));
  const winsSorted=entries.slice().sort((a,b)=>(b.wins-a.wins)||(b.elo-a.elo)||(b.gamesPlayed-a.gamesPlayed)||String(a.name||'').localeCompare(String(b.name||'')));
  const topElo=eloSorted.slice(0,10);
  const topWins=winsSorted.slice(0,10);
  const onlinePlayers=Math.max(0,parseInt(GLOBAL_LEADERBOARD_STATE.onlinePlayers,10)||0);
  const siteUsers=Math.max(0,parseInt(GLOBAL_LEADERBOARD_STATE.siteUsers,10)||0);
  const publicRooms=Math.max(0,parseInt(GLOBAL_LEADERBOARD_STATE.publicRooms,10)||0);
  const statusLabel=GLOBAL_LEADERBOARD_STATE.loading?'Synchronisation…':(GLOBAL_LEADERBOARD_STATE.status||(GLOBAL_LEADERBOARD_STATE.entries.length?'Serveur ranked':'Ladder local'));
  if(meta)meta.textContent=statusLabel+' • '+entries.length+' joueur'+(entries.length>1?'s':'')+' • '+onlinePlayers+' en ligne';
  const sig=[statusLabel,entries.length,onlinePlayers,siteUsers,publicRooms,topElo.map(e=>[e.uid,e.elo,e.wins].join(':')).join('|'),topWins.map(e=>[e.uid,e.wins,e.elo].join(':')).join('|')].join('||');
  if(sig===UI_RENDER_CACHE.leaderboardKey)return;
  UI_RENDER_CACHE.leaderboardKey=sig;
  if(!topElo.length&&!topWins.length){
    host.innerHTML='<div class="global-leaderboard-meta-note">Aucune donnée globale disponible pour le moment. Connecte-toi ou croise des joueurs dans le chat pour remplir ce top.</div>';
    return;
  }
  const eloLeader=topElo[0]||null;
  const winsLeader=topWins[0]||null;
  const eloLeaderRank=eloLeader?getEloRankInfo(eloLeader.elo||0):null;
  const myEloPos=Math.max(0,eloSorted.findIndex(entry=>entry.uid&&entry.uid===P.uid)+1);
  const myWinsPos=Math.max(0,winsSorted.findIndex(entry=>entry.uid&&entry.uid===P.uid)+1);
  const myDivision=getRankedDivisionSystemInfo(P.elo||0);
  host.innerHTML=''
    +'<div class="global-leaderboard-hero">'
      +'<div class="global-leaderboard-hero-top">'
        +'<div>'
          +'<div class="global-leaderboard-hero-title">🏟️ Ladder Ranked NeoPoly</div>'
          +'<div class="global-leaderboard-hero-sub">Seed ELO #1 : '+escapeHtml(eloLeader?.name||'—')+' '+escapeHtml(eloLeaderRank?.label||'')+' • Seed wins #1 : '+escapeHtml(winsLeader?.name||'—')+' • '+siteUsers+' sur le site</div>'
        +'</div>'
        +'<div class="global-leaderboard-crown">🏆</div>'
      +'</div>'
      +'<div class="global-leaderboard-hero-pills">'
        +'<span class="global-leaderboard-pill primary">🎯 Ranked Esports</span>'
        +'<span class="global-leaderboard-pill">📈 Meilleur ELO : '+(eloLeader?eloLeader.elo:'—')+'</span>'
        +'<span class="global-leaderboard-pill">🏆 Meilleures victoires : '+(winsLeader?winsLeader.wins:'—')+'</span>'
        +'<span class="global-leaderboard-pill">🟢 Joueurs en ligne : '+onlinePlayers+'</span>'
        +'<span class="global-leaderboard-pill">🌐 Joueurs sur le site : '+siteUsers+'</span>'
        +'<span class="global-leaderboard-pill">🏠 Salons actifs : '+publicRooms+'</span>'
        +'<span class="global-leaderboard-pill">🎯 Votre rang ELO : '+(myEloPos?('#'+myEloPos):'—')+'</span>'
        +'<span class="global-leaderboard-pill">🔥 Votre rang victoires : '+(myWinsPos?('#'+myWinsPos):'—')+'</span>'
        +'<span class="global-leaderboard-pill">🏅 Division : '+escapeHtml(myDivision.shortLabel||'Placement')+'</span>'
      +'</div>'
    +'</div>'
    +renderRankedDivisionPanel(myDivision,'🏅 Votre division actuelle','Progression vers '+(myDivision.nextLabel||'la prochaine promotion'))
    +'<div class="global-leaderboard-grid">'
      +'<div class="global-leaderboard-section premium-elo">'
        +'<div class="global-leaderboard-section-title">📊 Top 10 ELO</div>'
        +renderGlobalLeaderboardList(topElo,'elo')
      +'</div>'
      +'<div class="global-leaderboard-section premium-wins">'
        +'<div class="global-leaderboard-section-title">🏆 Top 10 victoires</div>'
        +renderGlobalLeaderboardList(topWins,'wins')
      +'</div>'
    +'</div>';
  bindGlobalLeaderboardInteractions(host);
}

function buildRemoteLeaderboardProfileSnapshot(){
  const rank=getEloRankInfo(P.elo||0);
  return {
    uid:P.uid,
    googleSub:P.googleSub||'',
    name:P.name||'Joueur',
    avatar:P.avatarImg||P.emoji||'👤',
    avatarImg:P.avatarImg||'',
    emoji:P.emoji||'👤',
    color:P.color||'#22c55e',
    title:getActiveProfileTitleLabel(P),
    elo:Math.max(0,parseInt(P.elo,10)||0),
    rankLabel:String(rank.label||'— Non Rankée'),
    wins:Math.max(0,parseInt(P.stats?.gamesWon,10)||0),
    losses:Math.max(0,parseInt(P.stats?.gamesLost,10)||0),
    gamesPlayed:Math.max(0,parseInt(P.stats?.gamesPlayed,10)||0),
    totalMoney:Math.max(0,parseInt(P.stats?.moneyEarned,10)||0),
  };
}

async function syncRemoteProfileSnapshot(){
  const base=(typeof getGoogleApiBase==='function'?String(getGoogleApiBase()||''):'').replace(/\/$/,'');
  if(!base||!P.googleConnected||!P.googleSessionToken)return false;
  try{
    const r=await fetch(base+'/api/profile/upsert',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        uid:P.uid,
        sessionToken:P.googleSessionToken||'',
        clientUpdatedAt:Date.now(),
        profile:buildRemoteLeaderboardProfileSnapshot(),
      }),
      cache:'no-store',
    });
    const data=await r.json().catch(()=>null);
    return !!(r.ok&&data&&data.ok);
  }catch(_){
    return false;
  }
}

function queueRemoteProfileSync(_reason='save'){
  if(remoteProfileSyncTimer)clearTimeout(remoteProfileSyncTimer);
  remoteProfileSyncTimer=setTimeout(async()=>{
    remoteProfileSyncTimer=null;
    const ok=await syncRemoteProfileSnapshot();
    if(ok)scheduleGlobalLeaderboardRefresh(true);
  },450);
}

function ensureGlobalLeaderboardLiveTicker(){
  ensureSitePresenceHeartbeat();
  if(globalLeaderboardLiveTicker)return;
  globalLeaderboardLiveTicker=setInterval(()=>{
    const inLobby=!!document.getElementById('app-wrap')?.classList.contains('in-lobby');
    if(document.visibilityState!=='visible'||!inLobby)return;
    scheduleGlobalLeaderboardRefresh(true);
  },GLOBAL_LEADERBOARD_LIVE_REFRESH_MS);
  if(typeof document!=='undefined'&&!document.body?.dataset?.leaderboardLiveBound){
    if(document.body?.dataset)document.body.dataset.leaderboardLiveBound='1';
    document.addEventListener('visibilitychange',()=>{
      const inLobby=!!document.getElementById('app-wrap')?.classList.contains('in-lobby');
      if(document.visibilityState==='visible'&&inLobby)scheduleGlobalLeaderboardRefresh(true);
    });
  }
}

function scheduleGlobalLeaderboardRefresh(force=false){
  renderGlobalLeaderboardCard();
  if(globalLeaderboardFetchTimer)clearTimeout(globalLeaderboardFetchTimer);
  globalLeaderboardFetchTimer=setTimeout(async()=>{
    globalLeaderboardFetchTimer=null;
    const base=(typeof getGoogleApiBase==='function'?String(getGoogleApiBase()||''):'').replace(/\/$/,'');
    const now=Date.now();
    const hostedOnline=(String(window.location.protocol||'').toLowerCase()==='https:')||/\.onrender\.com$/i.test(String(window.location.hostname||''));
    const fallbackLabel=hostedOnline?'En ligne':'Mode local';
    if(!base){
      GLOBAL_LEADERBOARD_STATE.status=collectKnownLeaderboardEntries().length?fallbackLabel:'Hors ligne';
      renderGlobalLeaderboardCard();
      return;
    }
    if(GLOBAL_LEADERBOARD_STATE.loading)return;
    if(!force&&(now-GLOBAL_LEADERBOARD_STATE.lastFetchAt)<GLOBAL_LEADERBOARD_FETCH_COOLDOWN_MS)return;
    GLOBAL_LEADERBOARD_STATE.loading=true;
    GLOBAL_LEADERBOARD_STATE.status='Synchronisation…';
    renderGlobalLeaderboardCard();
    try{
      const presence=getSitePresencePayload();
      const leaderboardUrl=base+'/api/profile/leaderboard?limit=20&presenceId='+encodeURIComponent(presence.presenceId||'')+'&tabId='+encodeURIComponent(presence.tabId||'');
      const r=await fetch(leaderboardUrl,{
        cache:'no-store',
        headers:{
          'x-neopoly-presence':presence.presenceId||'',
          'x-neopoly-tab':presence.tabId||'',
        },
      });
      const data=await r.json().catch(()=>null);
      if(!r.ok||!data||!data.ok)throw new Error('leaderboard_unavailable');
      GLOBAL_LEADERBOARD_STATE.entries=mergeGlobalLeaderboardEntries([
        ...((Array.isArray(data.topElo)?data.topElo:[]).map(entry=>Object.assign({source:'remote'},entry))),
        ...((Array.isArray(data.topWins)?data.topWins:[]).map(entry=>Object.assign({source:'remote'},entry))),
      ]);
      GLOBAL_LEADERBOARD_STATE.onlinePlayers=Math.max(0,parseInt(data?.live?.onlinePlayers,10)||0);
      GLOBAL_LEADERBOARD_STATE.siteUsers=Math.max(0,parseInt(data?.live?.siteUsers,10)||0);
      GLOBAL_LEADERBOARD_STATE.publicRooms=Math.max(0,parseInt(data?.live?.publicRooms,10)||0);
      GLOBAL_LEADERBOARD_STATE.lastFetchAt=Date.now();
      GLOBAL_LEADERBOARD_STATE.status=GLOBAL_LEADERBOARD_STATE.entries.length?'Serveur ranked':'Ladder local';
    }catch(_){
      GLOBAL_LEADERBOARD_STATE.onlinePlayers=0;
      GLOBAL_LEADERBOARD_STATE.siteUsers=0;
      GLOBAL_LEADERBOARD_STATE.publicRooms=0;
      GLOBAL_LEADERBOARD_STATE.lastFetchAt=Date.now();
      GLOBAL_LEADERBOARD_STATE.status=collectKnownLeaderboardEntries().length?fallbackLabel:'Hors ligne';
    }finally{
      GLOBAL_LEADERBOARD_STATE.loading=false;
      renderGlobalLeaderboardCard();
    }
  },force?40:160);
}

function checkSecretTitles(showToast=true){
  if(typeof canUseAccountProgression==='function'&&!canUseAccountProgression())return false;
  if(!Array.isArray(P.titles))P.titles=[];
  let changed=false;
  const fuse=(key)=>{
    if(!P.titles.includes(key)){
      P.titles.push(key);
      ensureTitleMeta(key);
      changed=true;
      toast('🔐 Titre secret débloqué : '+TITLE_DEFS[key].label,'a');
      showTitleDot();
    }
  };
  if((parseInt(P.stats?.bankruptcies,10)||0)>=5)          fuse('s_maudit');
  if((parseInt(P.stats?.moneyEarned,10)||0)>=500000)       fuse('s_nabab');
  if((parseInt(P.stats?.gamesPlayed,10)||0)>=100)          fuse('s_centenaire');
  if((parseInt(P.stats?.totalTurns,10)||0)>=1500)          fuse('s_marathon');
  if((parseInt(P.stats?.propertiesBought,10)||0)>=120)     fuse('s_collection');
  if((parseInt(P.elo,10)||0)>=3200)                        fuse('s_ascendant');
  const h=new Date().getHours();
  if(h>=0&&h<4)                                            fuse('s_noctambule');
  if((parseInt(P.elo,10)||0)>=2400)                        unlockSecretFeature('fx_aura','✨ Fonction secrète débloquée : Aura Elite');
  ensureEmojiUnlocks(showToast);
  if(changed){saveProfileData();renderTitleSelector();}
}

function showTitleDot(){
  const dot=document.getElementById('pc-new-title-dot');
  if(dot)dot.style.display='inline-block';
}

function clearTitleDot(){
  const dot=document.getElementById('pc-new-title-dot');
  if(dot)dot.style.display='none';
}

function checkWinTitles(){
  if(typeof canUseAccountProgression==='function'&&!canUseAccountProgression())return false;
  const wins=parseInt(P.stats?.gamesWon,10)||0;
  if(!Array.isArray(P.titles))P.titles=[];
  let changed=false;
  Object.entries(TITLE_DEFS).forEach(([key,def])=>{
    if(def.req!==undefined&&wins>=def.req&&!P.titles.includes(key)){
      P.titles.push(key);
      ensureTitleMeta(key);
      changed=true;
      toast('🎖️ Titre débloqué : '+def.label,'a');
      showTitleDot();
    }
  });
  P.titles.forEach(t=>ensureTitleMeta(t));
  if(changed){saveProfileData();renderTitleSelector();}
}

function renderTitleSelector(){
  const el=document.getElementById('title-selector');
  if(!el)return;
  const selectable=Array.isArray(P.titles)?P.titles.filter(t=>TITLE_DEFS[t]):[];
  if(selectable.length===0){
    el.innerHTML='<div style="font-size:.68rem;color:var(--muted)">Aucun titre sélectionnable. Les titres spéciaux (ex. Winner Looser) sont toujours affichés automatiquement.</div>';
    return;
  }
  const sel=P.selectedTitle;
  const noneActive=!sel||!TITLE_DEFS[sel];
  let html='<div style="display:flex;flex-direction:column;gap:5px;margin-top:2px">';
  html+='<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.72rem;padding:5px 6px;border-radius:6px;background:'+(noneActive?'var(--accent)22':'var(--s2)')+';border:1px solid '+(noneActive?'var(--accent)':'var(--border)')+'"><input type="radio" name="title-pick" '+(noneActive?'checked':'')+' onchange="selectTitle(null)"> <span>— Aucun titre supplémentaire</span></label>';
  selectable.forEach(key=>{
    const def=TITLE_DEFS[key];
    const active=sel===key;
    html+='<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.72rem;padding:5px 6px;border-radius:6px;background:'+(active?'var(--accent)22':'var(--s2)')+';border:1px solid '+(active?'var(--accent)':'var(--border)')+'"><input type="radio" name="title-pick" '+(active?'checked':'')+' onchange="selectTitle(\''+key+'\')"> <span class="'+def.cls+'" title="'+escapeAttr(getTitleTooltip(key))+'">'+def.label+'</span></label>';
  });
  html+='</div>';
  el.innerHTML=html;
}

function selectTitle(key){
  P.selectedTitle=key||null;
  saveProfileData();
  applyVictoryTitles();
  renderTitleSelector();
}

const PUBLIC_PROFILE_QUERY_KEY='profile';

function encodePublicProfileString(value){
  try{
    return btoa(encodeURIComponent(String(value||'')).replace(/%([0-9A-F]{2})/g,(_,hex)=>String.fromCharCode(parseInt(hex,16))));
  }catch(_){
    return '';
  }
}

function decodePublicProfileString(value){
  try{
    const binary=atob(String(value||''));
    let escaped='';
    for(let i=0;i<binary.length;i++)escaped+='%'+binary.charCodeAt(i).toString(16).padStart(2,'0');
    return decodeURIComponent(escaped);
  }catch(_){
    return '';
  }
}

function getSourcePublicTitleLabel(src){
  if(Array.isArray(src?.titles)&&src.titles.includes('winner_looser'))return '🏅 Winner Looser';
  if(src?.selectedTitle&&TITLE_DEFS[src.selectedTitle])return TITLE_DEFS[src.selectedTitle].label;
  return '— Aucun titre';
}

function buildPublicProfilePayload(sourceProfile){
  const src=sourceProfile&&typeof sourceProfile==='object'?sourceProfile:P;
  const stats=src?.stats&&typeof src.stats==='object'?src.stats:{};
  const elo=Math.max(0,parseInt(src?.elo,10)||0);
  const rank=getEloRankInfo(elo);
  const titles=Array.isArray(src?.titles)?src.titles.filter(key=>TITLE_DEFS[key]).slice(0,4).map(key=>TITLE_DEFS[key].label):[];
  return {
    v:1,
    uid:String(src?.uid||'—').slice(0,32),
    name:String(src?.name||'Joueur').slice(0,32),
    emoji:String(src?.emoji||'🎲'),
    color:safeCssColor(src?.color,'#22c55e'),
    elo,
    rankLabel:rank.label||'—',
    titleLabel:getSourcePublicTitleLabel(src),
    titles,
    stats:{
      wins:Math.max(0,parseInt(stats.gamesWon,10)||0),
      games:Math.max(0,parseInt(stats.gamesPlayed,10)||0),
      losses:Math.max(0,parseInt(stats.gamesLost,10)||0),
      money:Math.max(0,parseInt(stats.moneyEarned,10)||0),
      properties:Math.max(0,parseInt(stats.propertiesBought,10)||0),
      turns:Math.max(0,parseInt(stats.totalTurns,10)||0),
    },
    seasonBest:String(src?.seasonData?.bestLeague||src?.seasonData?.label||'—').slice(0,40),
    sharedAt:Date.now(),
  };
}

function getPublicProfileShareUrl(){
  try{
    const url=new URL(window.location.href);
    url.searchParams.set(PUBLIC_PROFILE_QUERY_KEY,encodePublicProfileString(JSON.stringify(buildPublicProfilePayload())));
    return url.toString();
  }catch(_){
    return window.location.href.split('?')[0];
  }
}

function setPublicProfileShareUrl(url){
  const finalUrl=String(url||getPublicProfileShareUrl());
  if(typeof G==='object'&&G)G.activePublicProfileShareUrl=finalUrl;
  const input=document.getElementById('public-profile-url');
  if(input)input.value=finalUrl;
  return finalUrl;
}

async function copyPublicProfileLink(){
  const currentUrl=(typeof G==='object'&&G&&G.activePublicProfileShareUrl)||getPublicProfileShareUrl();
  const url=setPublicProfileShareUrl(currentUrl);
  const input=document.getElementById('public-profile-url');
  try{
    if(input){
      input.focus();
      input.select();
      if(typeof input.setSelectionRange==='function')input.setSelectionRange(0,url.length);
    }
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
    else if(document.execCommand)document.execCommand('copy');
    toast('🔗 Lien public copié.','a');
  }catch(_){
    toast('🔗 Lien prêt à être copié.','i');
  }
}

function renderPublicProfilePreview(payload,sharedMode){
  const titleEl=document.getElementById('public-profile-preview-title');
  const bodyEl=document.getElementById('public-profile-preview-body');
  if(!titleEl||!bodyEl)return;
  const data=payload&&typeof payload==='object'?payload:{};
  const accent=safeCssColor(data.color,'#22c55e');
  const stats=data.stats&&typeof data.stats==='object'?data.stats:{};
  const badges=(Array.isArray(data.titles)?data.titles:[]).slice(0,4).map(label=>'<span style="padding:4px 8px;border-radius:999px;background:var(--s2);border:1px solid var(--border);font-size:.64rem">'+escapeHtml(label)+'</span>').join('');
  const sharedDate=data.sharedAt?new Date(data.sharedAt).toLocaleDateString('fr-FR'):'—';
  titleEl.textContent=sharedMode?'🔗 Profil public partagé':'🔗 Mon profil public';
  bodyEl.innerHTML=
    '<div style="display:flex;align-items:center;gap:12px;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--s2);margin-bottom:10px">'+
      '<div style="width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.7rem;background:'+accent+'22;border:2px solid '+accent+'">'+escapeHtml(data.emoji||'🎲')+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:1rem;font-weight:800">'+escapeHtml(data.name||'Joueur')+'</div>'+
        '<div style="font-size:.66rem;color:var(--muted)">ID public: '+escapeHtml(data.uid||'—')+' • Partagé le '+escapeHtml(sharedDate)+'</div>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'+
          '<span style="padding:4px 8px;border-radius:999px;background:'+accent+'22;border:1px solid '+accent+';font-size:.64rem;font-weight:700">'+escapeHtml(data.rankLabel||'—')+'</span>'+
          '<span style="padding:4px 8px;border-radius:999px;background:var(--s2);border:1px solid var(--border);font-size:.64rem">'+escapeHtml(data.titleLabel||'— Aucun titre')+'</span>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="stats-grid">'+
      '<div class="stat-tile"><div class="stat-tile-val">'+(parseInt(stats.wins,10)||0)+'</div><div class="stat-tile-label">🏆 Victoires</div></div>'+
      '<div class="stat-tile"><div class="stat-tile-val">'+(parseInt(stats.games,10)||0)+'</div><div class="stat-tile-label">🎮 Parties</div></div>'+
      '<div class="stat-tile"><div class="stat-tile-val">'+(parseInt(data.elo,10)||0)+'</div><div class="stat-tile-label">📊 ELO</div></div>'+
      '<div class="stat-tile"><div class="stat-tile-val">'+escapeHtml(data.seasonBest||'—')+'</div><div class="stat-tile-label">🏅 Ligue</div></div>'+
      '<div class="stat-tile"><div class="stat-tile-val">'+(parseInt(stats.properties,10)||0)+'</div><div class="stat-tile-label">🏠 Achats</div></div>'+
      '<div class="stat-tile"><div class="stat-tile-val">'+(parseInt(stats.turns,10)||0)+'</div><div class="stat-tile-label">⏱️ Tours</div></div>'+
    '</div>'+
    '<div style="margin-top:10px;font-size:.67rem;color:var(--muted)">Aucune donnée privée (email, session, IP) n’est partagée.</div>'+
    (badges?('<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+badges+'</div>'):'');
}

function openMyPublicProfilePreview(){
  setPublicProfileShareUrl(getPublicProfileShareUrl());
  renderPublicProfilePreview(buildPublicProfilePayload(),false);
  openModal('modal-public-profile');
}

function maybeOpenSharedProfileFromUrl(){
  let encoded='';
  try{
    encoded=new URL(window.location.href).searchParams.get(PUBLIC_PROFILE_QUERY_KEY)||'';
  }catch(_){
    encoded='';
  }
  if(!encoded)return;
  const raw=decodePublicProfileString(encoded);
  if(!raw)return;
  let payload=null;
  try{payload=JSON.parse(raw);}catch(_){payload=null;}
  if(!payload||typeof payload!=='object')return;
  setPublicProfileShareUrl(window.location.href);
  renderPublicProfilePreview(payload,true);
  openModal('modal-public-profile');
}

function renderLobbyProfileTab(){
  applySecretUnlocks();
  ensureEmojiUnlocks(false);
  renderPartyEmojiPickers();
  renderEmojiCollection();
  if(typeof renderDailyChallengesUi==='function')renderDailyChallengesUi();
  if(typeof renderWeeklyMissionsUi==='function')renderWeeklyMissionsUi();
  if(typeof renderRareRewardsUi==='function')renderRareRewardsUi();
  if(typeof renderSeasonHubUi==='function')renderSeasonHubUi();
  if(typeof renderMatchObjectiveUi==='function')renderMatchObjectiveUi();
  if(typeof renderRoulettePanel==='function')renderRoulettePanel();
  ensureGlobalLeaderboardLiveTicker();
  renderGlobalLeaderboardCard();
  scheduleGlobalLeaderboardRefresh(false);
  const av=document.getElementById('pc-avatar');
  if(av){
    if(P.avatarImg){av.innerHTML=`<img src="${P.avatarImg}" alt="avatar">`;}
    else{av.textContent=P.emoji;av.style.fontSize='1.8rem';}
    av.style.borderColor=P.color;av.style.background=P.color+'22';
  }
  const pcName=document.getElementById('pc-name');if(pcName)pcName.textContent=P.name;
  const pcTitle=document.getElementById('pc-title');
  if(pcTitle)applyVictoryTitles();
  updateRankBackdrop();
  renderTitleSelector();
  const pcUid=document.getElementById('pc-uid');
  if(pcUid){pcUid.textContent='ID: '+P.uid;pcUid.title='Clique pour copier (code ami)';}
  const fcEl=document.getElementById('my-friend-code');if(fcEl)fcEl.textContent=P.uid;
  const friendsTab=document.querySelector('.lobby-tab[data-ltab="amis-pane"]');
  if(friendsTab){
    const locked=!P.googleConnected;
    friendsTab.classList.toggle('tab-locked',locked);
    friendsTab.setAttribute('aria-disabled',locked?'true':'false');
    friendsTab.title=locked?'Réservé aux comptes Google':'Amis';
    if(locked&&document.getElementById('amis-pane')?.classList.contains('active')&&typeof switchLobbyTab==='function')switchLobbyTab('profil-pane');
  }
  setPublicProfileShareUrl(getPublicProfileShareUrl());
  const gArea=document.getElementById('google-connect-area');
  if(gArea){
    if(P.googleConnected){
      const safeGoogleName=escapeHtml(P.googleName||P.name);
      const safeGoogleEmail=escapeHtml(P.googleEmail||'');
      const hasServerSession=!!(P.googleVerifiedAt&&P.googleSessionToken);
      const googleState=hasServerSession?'Verifie par le serveur':(P.googleVerifiedAt?'Session a renouveler':'Lien local uniquement');
      const adminBadge=P.isAdmin?'<div style="font-size:.62rem;color:#facc15;font-weight:800">👑 Administrateur</div>':'';
      gArea.innerHTML=`<div class="google-connected">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:.78rem">${safeGoogleName}</div><div style="font-size:.65rem;color:var(--muted)">${safeGoogleEmail}</div>${adminBadge}<div style="font-size:.62rem;color:var(--muted)">${escapeHtml(googleState)}</div></div>
        <button class="btn btn-xs btn-danger" onclick="disconnectGoogle()">✕</button>
      </div>`;
    }else{
      const guestNote=typeof getInviteAccountLockText==='function'?getInviteAccountLockText():'Mode invité : stats conservées, progression de profil verrouillée.';
      gArea.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px"><button class="google-btn" onclick="openGoogleLoginModal()">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Se connecter avec Google
      </button><div style="font-size:.64rem;color:var(--muted)">${escapeHtml(guestNote)}</div></div>`;
    }
  }
  updateGoogleConfigUi();
  const epRow=document.getElementById('p-emoji-row');
  if(epRow){
    const emojiKey=String(P.emoji||'')+'|'+getUnlockedEmojis().join('');
    if(emojiKey!==UI_RENDER_CACHE.emojiKey){
      UI_RENDER_CACHE.emojiKey=emojiKey;
      const defs=EMOJI_UNLOCK_DEFS.filter(def=>isEmojiUnlocked(def.emoji));
      epRow.innerHTML=defs.map(def=>`<span style="font-size:1.4rem;cursor:pointer;opacity:${def.emoji===P.emoji?1:.4};transition:.15s" title="${escapeAttr(def.label||def.emoji)}" onclick="selectProfileEmoji('${def.emoji}')">${def.emoji}</span>`).join('');
    }
  }
  const profileEditors=(typeof getProfileEditorElements==='function')?getProfileEditorElements():{nameInputs:[],colorInputs:[],zones:[]};
  (profileEditors.nameInputs||[]).forEach(inp=>{if(inp)inp.value=P.name;});
  (profileEditors.colorInputs||[]).forEach(inp=>{if(inp)inp.value=P.color;});
  if(typeof syncProfileImageZones==='function')syncProfileImageZones(P.avatarImg||'');
  const sg=document.getElementById('profile-stats-grid');
  if(sg){
    const s=P.stats;
    const rank=getEloRankInfo(P.elo||0);
    const statsKey=[P.elo||0,rank.label,s.gamesWon,s.gamesPlayed,P.rouletteCoins||0].join('|');
    if(statsKey!==UI_RENDER_CACHE.statsKey){
      UI_RENDER_CACHE.statsKey=statsKey;
      sg.innerHTML=[
        {val:P.elo||0,label:'📊 ELO'},
        {val:rank.label,label:'🎖️ Rang'},
        {val:s.gamesWon,label:'🏆 Victoires'},
        {val:s.gamesPlayed,label:'🎮 Parties'},
        {val:P.rouletteCoins||0,label:'🎰 Jetons'},
      ].map(x=>`<div class="stat-tile"><div class="stat-tile-val" style="font-size:${String(x.val).length>6?'.65rem':'1.05rem'}">${x.val}</div><div class="stat-tile-label">${x.label}</div></div>`).join('');
    }
  }
  renderLobbyVictoryStars();
}

function selectProfileEmoji(emoji){
  if(!isEmojiUnlocked(emoji)){
    toast('Emoji verrouillé.','w');
    return;
  }
  P.emoji=emoji;
  saveProfileData();
  renderLobbyProfileTab();
}

function saveProfileEdit(){
  const profileEditors=(typeof getProfileEditorElements==='function')?getProfileEditorElements():{nameInputs:[],colorInputs:[],zones:[]};
  const n=[...(profileEditors.nameInputs||[])].map(inp=>String(inp?.value||'').trim()).reverse().find(Boolean)||'';
  const c=[...(profileEditors.colorInputs||[])].map(inp=>String(inp?.value||'').trim()).reverse().find(Boolean)||'';
  const nextAvatar=(typeof getProfileImageDraft==='function')?getProfileImageDraft():'';
  if(n)P.name=n;
  if(c)P.color=c;
  if(nextAvatar)P.avatarImg=nextAvatar;
  saveProfileData();
  renderLobbyProfileTab();
  toast((P.googleConnected&&P.googleSessionToken)?'✅ Profil sauvegardé et synchronisé en ligne !':'✅ Profil sauvegardé !','a');
}

function debugAddVictories(amount){
  if(typeof hasAdminDebugAccess==='function'&&!hasAdminDebugAccess(true))return;
  const add=Math.max(0,parseInt(amount,10)||0);
  if(!add)return;
  P.stats.gamesWon=Math.max(0,(parseInt(P.stats.gamesWon,10)||0)+add);
  P.stats.gamesPlayed=Math.max(P.stats.gamesWon,parseInt(P.stats.gamesPlayed,10)||0);
  checkWinTitles();
  saveProfileData();
  renderLobbyProfileTab();
  toast('🏆 +'+add+' victoire(s)','a');
}

function debugAddLosses(amount){
  if(typeof hasAdminDebugAccess==='function'&&!hasAdminDebugAccess(true))return;
  const add=Math.max(0,parseInt(amount,10)||0);
  if(!add)return;
  P.stats.gamesLost=(parseInt(P.stats.gamesLost,10)||0)+add;
  P.stats.gamesPlayed=(parseInt(P.stats.gamesPlayed,10)||0)+add;
  saveProfileData();
  renderLobbyProfileTab();
  toast('💥 +'+add+' défaite(s)','w');
}

function debugAddElo(amount){
  if(typeof hasAdminDebugAccess==='function'&&!hasAdminDebugAccess(true))return;
  const add=parseInt(amount,10)||0;
  P.elo=Math.max(0,Math.min(9999,(P.elo||0)+add));
  saveProfileData();
  renderLobbyProfileTab();
  toast('📊 ELO : '+(add>0?'+':'')+add+' → '+P.elo,'i');
}

function debugSetElo(value){
  if(typeof hasAdminDebugAccess==='function'&&!hasAdminDebugAccess(true))return;
  P.elo=Math.max(0,Math.min(9999,parseInt(value,10)||0));
  saveProfileData();
  renderLobbyProfileTab();
  toast('📊 ELO fixé à '+P.elo,'i');
}

function debugUnlockWinnerLooser(){
  if(typeof hasAdminDebugAccess==='function'&&!hasAdminDebugAccess(true))return;
  if(!Array.isArray(P.titles))P.titles=[];
  if(P.titles.includes('winner_looser')){toast('Déjà déverrouillé.','i');return;}
  P.titles.push('winner_looser');
  ensureTitleMeta('winner_looser');
  saveProfileData();
  renderLobbyProfileTab();
  toast('🏅 Titre "Winner Looser" déverrouillé (debug)','a');
}

function resetProfileProgress(options){
  const opts=options&&typeof options==='object'?options:{};
  const resetAt=Math.max(0,parseInt(opts.resetAt,10)||Date.now());
  P.stats={gamesPlayed:0,gamesWon:0,gamesLost:0,moneyEarned:0,propertiesBought:0,totalTurns:0,bankruptcies:0};
  P.elo=0;
  P.titles=[];
  P.titleMeta={};
  P.secretUnlocks={};
  P.emojiUnlocks={};
  P.selectedTitle=null;
  P.dailyChallenges={dateKey:'',streak:0,lastCompletedDate:'',items:[]};
  P.weeklyMissions={weekKey:'',streak:0,lastCompletedWeek:'',items:[],fullRewarded:false};
  P.rareRewards=[];
  P.rareTokenCount=0;
  P.seasonData={seasonKey:'',label:'',xp:0,score:0,claimedTiers:[],bestLeague:'',bestRankedElo:0,bestRankedLabel:'',lastDivisionRewardText:'',lastDivisionRewardAt:0,history:[]};
  if(opts.source==='admin')P.lastAdminStatsResetAt=Math.max(parseInt(P.lastAdminStatsResetAt,10)||0,resetAt);
  saveProfileData();
  renderLobbyProfileTab();
  if(typeof renderFriendsList==='function')renderFriendsList();
  if(typeof renderSocialChat==='function')renderSocialChat();
  if(!opts.silent)toast(opts.toast||(opts.source==='admin'?'🧹 Tes stats ont été réinitialisées par un admin.':'🧹 Reset total: stats, ELO, titres, dates et secrets'),'i');
}

function debugResetStats(){
  if(typeof hasAdminDebugAccess==='function'&&!hasAdminDebugAccess(true))return;
  resetProfileProgress({source:'debug',toast:'🧹 Reset total: stats, ELO, titres, dates et secrets'});
}

function debugRemoveWinnerLooser(){
  if(typeof hasAdminDebugAccess==='function'&&!hasAdminDebugAccess(true))return;
  if(!Array.isArray(P.titles)||!P.titles.includes('winner_looser')){
    toast('Titre "Winner Looser" non présent.','i');
    return;
  }
  P.titles=P.titles.filter(t=>t!=='winner_looser');
  if(P.selectedTitle==='winner_looser')P.selectedTitle=null;
  saveProfileData();
  renderLobbyProfileTab();
  toast('🗑️ Titre "Winner Looser" retiré.','w');
}

function redeemSecretCode(){
  if(typeof canUseAccountProgression==='function'&&!canUseAccountProgression()){
    showInviteAccountLock?.('Les codes de progression');
    return;
  }
  const inp=document.getElementById('secret-code-inp');
  if(!inp)return;
  const code=inp.value.trim();
  inp.value='';
  if(code==='12/23/26'){
    const losses=parseInt(P.stats?.gamesLost,10)||0;
    if(losses<50){
      toast('❌ Conditions non remplies.','w');
      return;
    }
    if(!Array.isArray(P.titles))P.titles=[];
    if(!P.titles.includes('winner_looser')){
      P.titles.push('winner_looser');
      ensureTitleMeta('winner_looser');
      saveProfileData();
      renderLobbyProfileTab();
      toast('🏅 Titre débloqué : "Winner Looser" !','a');
    } else {
      toast('Tu possèdes déjà ce titre.','i');
    }
  } else if(code===atob(_S.a)){
    if(!Array.isArray(P.titles))P.titles=[];
    if(!P.titles.includes('s_spectre')){P.titles.push('s_spectre');ensureTitleMeta('s_spectre');saveProfileData();renderLobbyProfileTab();toast('👻 Titre secret débloqué !','a');}else{toast('Titre déjà obtenu.','i');}
  } else if(code===atob(_S.b)){
    if(!Array.isArray(P.titles))P.titles=[];
    if(!P.titles.includes('s_pionnier')){P.titles.push('s_pionnier');ensureTitleMeta('s_pionnier');saveProfileData();renderLobbyProfileTab();toast('🌟 Titre secret débloqué !','a');}else{toast('Titre déjà obtenu.','i');}
  } else if(code===atob(_S.d)){
    if(!unlockSecretFeature('fx_cosmic','🌌 Fonction secrète débloquée : Cosmic Mode'))toast('Secret déjà obtenu.','i');
    ensureEmojiUnlocks(true);
    renderLobbyProfileTab();
  } else if(code===atob(_S.e)){
    if(!unlockSecretFeature('fx_arcade','🕹️ Fonction secrète débloquée : Arcade Pulse'))toast('Secret déjà obtenu.','i');
    ensureEmojiUnlocks(true);
    renderLobbyProfileTab();
  } else if(code.length>0){
    toast('Code invalide.','w');
  }
}
