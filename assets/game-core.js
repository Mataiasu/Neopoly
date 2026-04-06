// ═══════════════════════════════════════
//  CONFIGURATION (Google OAuth)
// ═══════════════════════════════════════
const GOOGLE_CLIENT_ID='';
const GOOGLE_CLIENT_ID_KEY='NP_GOOGLE_CLIENT_ID';
const RENDER_FALLBACK_ORIGINS=['https://neopoly-eu.onrender.com','https://neopoly.onrender.com'];
const RENDER_PREFERRED_ORIGIN_KEY='NP_RENDER_PREFERRED_ORIGIN_V1';
let renderOriginProbePromise=null;

function getGoogleClientId(){
  const runtime=(window.NEOPOLY_GOOGLE_CLIENT_ID||'').trim();
  const stored=(localStorage.getItem(GOOGLE_CLIENT_ID_KEY)||'').trim();
  const inline=(GOOGLE_CLIENT_ID||'').trim();
  return runtime||stored||inline;
}

function normalizeOriginUrl(origin){
  return String(origin||'').trim().replace(/\/$/,'');
}

function coerceAbsoluteOriginUrl(origin){
  const normalized=normalizeOriginUrl(origin);
  if(!normalized)return '';
  if(/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized))return normalized;
  const stripped=normalized.replace(/^\/\//,'');
  if(/^(localhost|(?:\d{1,3}\.){3}\d{1,3}|[a-z0-9.-]+\.[a-z]{2,})(?::\d+)?$/i.test(stripped)){
    const protocol=/\.onrender\.com(?::\d+)?$/i.test(stripped)
      ?'https:'
      :((window.location&&window.location.protocol&&window.location.protocol!=='file:')?window.location.protocol:'http:');
    return protocol+'//'+stripped;
  }
  return normalized;
}

function isRenderOrigin(origin){
  const normalized=coerceAbsoluteOriginUrl(origin);
  if(!normalized)return false;
  const host=normalized
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i,'')
    .replace(/^\/\//,'')
    .split(/[/?#]/,1)[0]
    .toLowerCase();
  return /\.onrender\.com(?::\d+)?$/i.test(host);
}

function getStoredRenderOrigin(){
  try{
    const stored=coerceAbsoluteOriginUrl(localStorage.getItem(RENDER_PREFERRED_ORIGIN_KEY)||'');
    return isRenderOrigin(stored)?stored:'';
  }catch(_){
    return '';
  }
}

function rememberRenderOrigin(origin){
  const normalized=coerceAbsoluteOriginUrl(origin);
  if(!isRenderOrigin(normalized))return '';
  window.NEOPOLY_API_BASE=normalized;
  try{localStorage.setItem(RENDER_PREFERRED_ORIGIN_KEY,normalized);}catch(_){ }
  return normalized;
}

function getCanonicalRenderOrigin(){
  const configured=coerceAbsoluteOriginUrl(window.NEOPOLY_CANONICAL_ORIGIN||'');
  if(isRenderOrigin(configured))return configured;
  const active=coerceAbsoluteOriginUrl(window.NEOPOLY_API_BASE||'');
  if(isRenderOrigin(active))return active;
  const stored=getStoredRenderOrigin();
  if(stored)return stored;
  const current=coerceAbsoluteOriginUrl(window.location.origin||'');
  if(isRenderOrigin(current))return current;
  return '';
}

function getRenderOriginCandidates(){
  const current=coerceAbsoluteOriginUrl(window.location.origin||'');
  const configured=coerceAbsoluteOriginUrl(window.NEOPOLY_CANONICAL_ORIGIN||'');
  const active=coerceAbsoluteOriginUrl(window.NEOPOLY_API_BASE||'');
  const stored=getStoredRenderOrigin();
  const onRenderHost=/\.onrender\.com$/i.test(String(window.location.hostname||''));
  const wantsRender=onRenderHost||isRenderOrigin(configured)||isRenderOrigin(active)||isRenderOrigin(stored)||isRenderOrigin(current);
  const seen=new Set();
  const pool=wantsRender?[configured,active,stored,current].concat(RENDER_FALLBACK_ORIGINS):[configured,active,stored,current];
  return pool.filter(origin=>{
    const normalized=normalizeOriginUrl(origin);
    if(!normalized||!isRenderOrigin(normalized)||seen.has(normalized))return false;
    seen.add(normalized);
    return true;
  });
}

async function probeRenderOrigin(origin,timeoutMs=3500){
  const base=normalizeOriginUrl(origin);
  if(!isRenderOrigin(base))return false;
  try{
    const ctl=new AbortController();
    const t=setTimeout(()=>ctl.abort(),timeoutMs);
    const r=await fetch(base+'/api/health',{signal:ctl.signal,cache:'no-store'});
    clearTimeout(t);
    const data=await r.json().catch(()=>null);
    return !!(r.ok&&data&&data.ok);
  }catch(_){
    return false;
  }
}

function ensurePreferredRenderOrigin(force=false){
  const shouldProbe=!!(getRenderOriginCandidates().length);
  if(!shouldProbe)return Promise.resolve('');
  if(renderOriginProbePromise&&!force)return renderOriginProbePromise;
  renderOriginProbePromise=(async()=>{
    const candidates=getRenderOriginCandidates();
    const fastTimeout=force?2200:1400;
    for(const candidate of candidates){
      if(await probeRenderOrigin(candidate,fastTimeout)){
        const chosen=rememberRenderOrigin(candidate);
        pushGoogleDebug('Render origin actif: '+chosen);
        return chosen;
      }
      if(normalizeOriginUrl(window.NEOPOLY_API_BASE||'')===normalizeOriginUrl(candidate)){
        try{delete window.NEOPOLY_API_BASE;}catch(_){window.NEOPOLY_API_BASE='';}
      }
      try{
        if(getStoredRenderOrigin()===normalizeOriginUrl(candidate))localStorage.removeItem(RENDER_PREFERRED_ORIGIN_KEY);
      }catch(_){ }
    }
    const fallback=candidates[0]||'';
    if(fallback){
      pushGoogleDebug('Aucun endpoint Render sain détecté, fallback temporaire: '+fallback);
      rememberRenderOrigin(fallback);
    }
    return fallback;
  })().finally(()=>{renderOriginProbePromise=null;});
  return renderOriginProbePromise;
}

function getGoogleApiBase(){
  const configured=coerceAbsoluteOriginUrl(window.NEOPOLY_API_BASE||'').trim();
  if(configured)return configured.replace(/\/$/, '');
  const origin=(window.location.origin&&window.location.origin!=='null')?window.location.origin.replace(/\/$/,''):'';
  const p=String(window.location.port||'');
  const isLocalPreview=(p==='5500'||p==='5173');
  if(origin&&!isLocalPreview)return origin;
  if(isLocalPreview&&window.location.protocol==='http:'){
    return ('http://'+window.location.hostname+':3000').replace(/\/$/,'');
  }
  const renderOrigin=getCanonicalRenderOrigin();
  if(renderOrigin)return renderOrigin;
  return origin;
}

function getGoogleVerifyUrl(){
  const base=getGoogleApiBase();
  return base?base+'/api/google/verify':'';
}

function getGoogleIdVerifyUrl(){
  const base=getGoogleApiBase();
  return base?base+'/api/google/verify-idtoken':'';
}

function getGoogleStatusUrl(){
  const base=getGoogleApiBase();
  return base?base+'/api/google/status':'';
}

function getGoogleModeUrl(){
  const base=getGoogleApiBase();
  return base?base+'/api/google/mode':'';
}

function getGoogleCodeExchangeUrl(){
  const base=getGoogleApiBase();
  return base?base+'/api/google/exchange-code':'';
}

function googleRedirectUri(){
  return window.location.origin+'/test1.html';
}

function pushGoogleDebug(entry){
  const line='['+new Date().toLocaleTimeString('fr-FR')+'] '+entry;
  GOOGLE_DEBUG_LOG.push(line);
  if(GOOGLE_DEBUG_LOG.length>40)GOOGLE_DEBUG_LOG.shift();
}

function updateGoogleDebugPanel(){
  const box=document.getElementById('g-debug-log');
  if(box)box.textContent=GOOGLE_DEBUG_LOG.length?GOOGLE_DEBUG_LOG.join('\n'):'(vide)';
}

function showGoogleClickIndicator(msg){
  const el=document.getElementById('g-click-indicator');
  if(!el)return;
  el.textContent=msg||'Clic reçu';
  el.style.opacity='1';
  setTimeout(()=>{el.style.opacity='0';},700);
}

function copyTextToClipboard(text){
  const t=String(text||'');
  if(navigator.clipboard&&navigator.clipboard.writeText){
    return navigator.clipboard.writeText(t);
  }
  const ta=document.createElement('textarea');
  ta.value=t;
  ta.style.position='fixed';
  ta.style.left='-9999px';
  document.body.appendChild(ta);
  ta.select();
  try{document.execCommand('copy');}catch(_){ }
  document.body.removeChild(ta);
  return Promise.resolve();
}

function exportGoogleDiagnostic(){
  const diag=getGoogleAuthDiag();
  const lines=[
    'time='+new Date().toISOString(),
    'origin='+window.location.origin,
    'apiBase='+getGoogleApiBase(),
    'verifyUrl='+getGoogleVerifyUrl(),
    'statusUrl='+getGoogleStatusUrl(),
    'modeUrl='+getGoogleModeUrl(),
    'clientIdSet='+(diag.hasClientId?'yes':'no'),
    'gisReady='+(diag.gisReady?'yes':'no'),
    'secureOrigin='+(diag.secureOrigin?'yes':'no'),
    'topLevel='+(isTopLevelWindow()?'yes':'no'),
    'popupRejectedCount='+googlePopupRejectedCount,
    'logs=',
    GOOGLE_DEBUG_LOG.join('\n'),
  ];
  const payload=lines.join('\n');
  const ta=document.getElementById('g-diagnostic-export');
  if(ta){
    ta.style.display='block';
    ta.value=payload;
  }
  copyTextToClipboard(payload).then(()=>toast('Diagnostic Google copie','i')).catch(()=>toast('Diagnostic pret dans la zone texte','i'));
}

function openSecureGoogleTab(){
  const target='http://'+window.location.hostname+':3000/test1.html';
  window.open(target,'_blank','noopener');
}

function buildGoogleCloudConfigText(){
  const origin=window.location.origin;
  const redirect=googleRedirectUri();
  return [
    'Authorized JavaScript origins:',
    origin,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    '',
    'Authorized redirect URIs:',
    redirect,
    'http://localhost:3000/test1.html',
    'http://127.0.0.1:3000/test1.html',
  ].join('\n');
}

function copyGoogleCloudConfig(){
  const payload=buildGoogleCloudConfigText();
  const ta=document.getElementById('g-cloud-copy');
  if(ta)ta.value=payload;
  copyTextToClipboard(payload)
    .then(()=>toast('Config Google Cloud copiee','i'))
    .catch(()=>toast('Config prete dans la zone texte','i'));
}

function getCanonicalLocalUrl(){
  return 'http://localhost:3000/test1.html'+window.location.search+window.location.hash;
}

function isNonCanonicalLocalOrigin(){
  const host=window.location.hostname;
  const port=String(window.location.port||'');
  const loopback=(host==='localhost'||host==='127.0.0.1');
  if(!loopback)return false;
  return host!=='localhost'||port!=='3000';
}

function enforceCanonicalLocalOrigin(){
  if(!isNonCanonicalLocalOrigin())return Promise.resolve(false);
  const canonical='http://localhost:3000';
  const healthUrl=canonical+'/api/health';
  const ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
  const timer=setTimeout(()=>{if(ctrl)ctrl.abort();},1200);
  return fetch(healthUrl,{method:'GET',signal:ctrl?ctrl.signal:undefined})
    .then((res)=>{
      clearTimeout(timer);
      if(!res.ok)return false;
      window.location.replace(getCanonicalLocalUrl());
      return true;
    })
    .catch(()=>{
      clearTimeout(timer);
      pushGoogleDebug('Canonical redirect skipped: localhost:3000 unreachable');
      updateGoogleDebugPanel();
      return false;
    });
}

function maybeSuggestCanonicalOrigin(){
  const host=window.location.hostname;
  const port=String(window.location.port||'');
  const loopback=(host==='localhost'||host==='127.0.0.1');
  if(!loopback||port==='3000')return;
  const key='np_google_canonical_hint_'+port;
  if(localStorage.getItem(key))return;
  localStorage.setItem(key,'1');
  toast('Conseil Google: utilise http://'+host+':3000/test1.html','w');
  pushGoogleDebug('Hint canonical origin for port '+port);
}

function saveGoogleClientId(value){
  const clean=String(value||'').trim();
  if(clean)localStorage.setItem(GOOGLE_CLIENT_ID_KEY,clean);
  else localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
  googleTokenClient=null;
}

function isGoogleOriginAllowed(){
  const p=window.location.protocol;
  return p==='https:'||window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1';
}

function isTopLevelWindow(){
  try{return window.top===window.self;}catch(_){return false;}
}

function getGoogleBlockReason(){
  const diag=getGoogleAuthDiag();
  const host=window.location.hostname;
  const isHttp=window.location.protocol==='http:';
  const loopback=(host==='localhost'||host==='127.0.0.1');
  if(!diag.hasClientId)return 'Client ID Google manquant';
  if(!diag.gisReady)return 'SDK Google non charge';
  if(!isTopLevelWindow())return 'Google bloque la connexion dans un iframe/webview (ouvre un nouvel onglet)';
  if(isHttp&&!loopback)return 'Google bloque HTTP hors localhost/127.0.0.1';
  if(!diag.secureOrigin)return 'Origine non autorisee';
  if(!getGoogleVerifyUrl())return 'Backend de verification non configure';
  return '';
}

function getGoogleAuthDiag(){
  const clientId=getGoogleClientId();
  return {
    clientId,
    hasClientId:!!clientId&&clientId!=='YOUR_GOOGLE_CLIENT_ID',
    gisReady:typeof google!=='undefined'&&google.accounts&&google.accounts.oauth2,
    secureOrigin:isGoogleOriginAllowed(),
    origin:window.location.origin,
  };
}

function updateGoogleConfigUi(){
  const diag=getGoogleAuthDiag();
  const input=document.getElementById('g-client-id');
  const hint=document.getElementById('g-config-status');
  const origin=document.getElementById('g-origin');
  const activeApi=document.getElementById('g-api-active');
  const checklist=document.getElementById('g-cloud-checklist');
  const cloudCopy=document.getElementById('g-cloud-copy');
  const canonicalBanner=document.getElementById('g-canonical-banner');
  const oauthErr=document.getElementById('g-oauth-last-error');
  const testBtn=document.getElementById('g-btn-test');
  const redirectBtn=document.getElementById('g-btn-redirect');
  const recoBtn=document.getElementById('g-btn-reco');
  const ultraBadge=document.getElementById('g-ultra-safe-badge');
  const verifyUrl=getGoogleVerifyUrl();
  const statusUrl=getGoogleStatusUrl();
  const modeUrl=getGoogleModeUrl();
  if(input&&document.activeElement!==input)input.value=diag.clientId;
  if(origin)origin.textContent=diag.origin+(verifyUrl?' -> API '+verifyUrl:'');
  if(activeApi)activeApi.textContent='API active: '+(getGoogleApiBase()||'(none)')+(googleServerMode?(' | Mode serveur: '+googleServerMode):'')+(googleForceRedirectOnly?' | Mode force: redirect-only':'');
  if(cloudCopy&&document.activeElement!==cloudCopy)cloudCopy.value=buildGoogleCloudConfigText();
  if(oauthErr)oauthErr.textContent=googleLastOauthError?('Erreur OAuth brute: '+googleLastOauthError):'';
  if(canonicalBanner){
    const on5500=String(window.location.port||'')==='5500';
    const nonCanonical=isNonCanonicalLocalOrigin();
    if(on5500||nonCanonical){
      canonicalBanner.style.display='block';
      canonicalBanner.innerHTML='Utilise localhost:3000 uniquement. Origine detectee: <strong>'+escapeHtml(window.location.origin)+'</strong> • Recommande: <strong>http://localhost:3000/test1.html</strong>';
    }else{
      canonicalBanner.style.display='none';
    }
  }
  if(testBtn){
    testBtn.disabled=!(googleBackendReachable&&statusUrl&&verifyUrl&&modeUrl);
  }
  if(redirectBtn&&googleServerMode){
    redirectBtn.disabled=(googleServerMode==='popup_or_idtoken_only');
  }
  if(recoBtn){
    recoBtn.textContent=googleForceRedirectOnly?'Connexion redirect forcee':'Connexion recommandee';
  }
  if(ultraBadge){
    ultraBadge.style.display=googleZoneAlwaysRedirect?'inline-flex':'none';
  }
  if(hint){
    const parts=[];
    parts.push(diag.hasClientId?'Client ID configure':'Client ID manquant');
    parts.push(diag.gisReady?'SDK Google charge':'SDK Google non charge');
    parts.push(diag.secureOrigin?'Origine compatible':'Origine non autorisee par Google');
    parts.push(isTopLevelWindow()?'Top-level OK':'Ouvert dans iframe/webview');
    parts.push(verifyUrl?'API de verification configuree':'API de verification manquante');
    parts.push(statusUrl?'Endpoint de status configure':'Endpoint de status manquant');
    parts.push(modeUrl?'Endpoint mode configure':'Endpoint mode manquant');
    hint.textContent=parts.join(' • ');
    hint.style.color=(diag.hasClientId&&diag.gisReady&&diag.secureOrigin&&verifyUrl&&statusUrl&&modeUrl)?'var(--ok)':'#fbbf24';
  }
  if(checklist){
    const webClientType='OAuth 2.0 Client ID de type Web application';
    const lines=[
      '1) Google Cloud -> Credentials -> creer '+webClientType,
      '2) Authorized JavaScript origins: '+diag.origin,
      '3) Authorized JavaScript origins: http://localhost:3000 et/ou http://127.0.0.1:3000',
      '4) Copier le Client ID dans ce champ puis Enregistrer le Client ID',
      '5) Lancer le serveur NeoPoly puis cliquer Tester API',
    ];
    checklist.innerHTML=lines.map((line)=>'<div>'+escapeHtml(line)+'</div>').join('');
  }
}

async function testGoogleBackendStatus(){
  const out=document.getElementById('g-api-test-status');
  const testBtn=document.getElementById('g-btn-test');
  if(out)out.textContent='Test en cours...';
  if(testBtn)testBtn.disabled=true;
  const statusUrl=getGoogleStatusUrl();
  const healthUrl=(getGoogleApiBase()?getGoogleApiBase()+'/api/health':'');
  if(!statusUrl||!healthUrl){
    if(out)out.textContent='API non configuree. Definis NEOPOLY_API_BASE ou utilise la meme origine.';
    googleBackendReachable=false;
    if(testBtn)testBtn.disabled=true;
    updateGoogleConfigUi();
    return;
  }
  try{
    const [sRes,hRes]=await Promise.all([fetch(statusUrl),fetch(healthUrl)]);
    const sData=await sRes.json();
    const hData=await hRes.json();
    const statusOk=!!(sRes.ok&&sData&&sData.ok);
    const healthOk=!!(hRes.ok&&hData&&hData.ok);
    const idOk=!!(sData&&sData.hasGoogleClientId);
    if(out){
      out.textContent=(statusOk&&healthOk? 'Backend OK':'Backend KO')+
        ' | Health: '+(healthOk?'OK':'KO')+
        ' | Google Client ID serveur: '+(idOk?'OK':'MANQUANT')+
        (sData&&sData.verifyEndpoint?' | Verify: '+sData.verifyEndpoint:'');
      out.style.color=(statusOk&&healthOk&&idOk)?'var(--ok)':'#fbbf24';
    }
    pushGoogleDebug('API test health='+(healthOk?'ok':'ko')+' status='+(statusOk?'ok':'ko')+' clientId='+(idOk?'ok':'missing'));
    updateGoogleDebugPanel();
    googleBackendReachable=!!(statusOk&&healthOk);
    if(testBtn)testBtn.disabled=!googleBackendReachable;
    updateGoogleConfigUi();
  }catch(e){
    if(out){
      out.textContent='Impossible de joindre le backend ('+String(e&&e.message||'network_error')+')';
      out.style.color='#f87171';
    }
    pushGoogleDebug('API test error: '+String(e&&e.message||'network_error'));
    updateGoogleDebugPanel();
    googleBackendReachable=false;
    if(testBtn)testBtn.disabled=true;
    updateGoogleConfigUi();
  }
}

async function bootGoogleHealthCheckOnce(){
  if(googleBootHealthChecked)return googleBackendReachable;
  googleBootHealthChecked=true;
  const out=document.getElementById('g-api-test-status');
  const testBtn=document.getElementById('g-btn-test');
  const base=getGoogleApiBase();
  const healthUrl=base?base+'/api/health':'';
  if(!healthUrl){
    googleBackendReachable=false;
    if(testBtn)testBtn.disabled=true;
    if(out){out.textContent='Backend non detecte (api/health indisponible).';out.style.color='#fbbf24';}
    updateGoogleConfigUi();
    return false;
  }
  try{
    const r=await fetch(healthUrl);
    const data=await r.json();
    googleBackendReachable=!!(r.ok&&data&&data.ok);
    if(testBtn)testBtn.disabled=!googleBackendReachable;
    if(out&&googleBackendReachable){
      out.textContent='Boot check OK: backend joignable.';
      out.style.color='var(--ok)';
    }else if(out){
      out.textContent='Boot check KO: backend inaccessible.';
      out.style.color='#fbbf24';
    }
    pushGoogleDebug('Boot /api/health: '+(googleBackendReachable?'ok':'ko'));
    updateGoogleDebugPanel();
  }catch(e){
    googleBackendReachable=false;
    if(testBtn)testBtn.disabled=true;
    if(out){
      out.textContent='Boot check KO: '+String(e&&e.message||'network_error');
      out.style.color='#f87171';
    }
    pushGoogleDebug('Boot /api/health error: '+String(e&&e.message||'network_error'));
    updateGoogleDebugPanel();
  }
  updateGoogleConfigUi();
  return googleBackendReachable;
}

async function fetchGoogleMode(){
  const modeUrl=getGoogleModeUrl();
  if(!modeUrl)return null;
  try{
    const r=await fetch(modeUrl);
    const data=await r.json();
    if(!r.ok||!data||!data.ok)return null;
    return data;
  }catch(_){
    return null;
  }
}

function isGoogleDomainRejectionReason(reason){
  const s=String(reason||'').toLowerCase();
  return s.includes('app_domain')||s.includes('rejected')||s.includes('unknown_reason')||s.includes('origin_mismatch')||s.includes('unregistered_origin');
}

function canUseGoogleRedirectNow(){
  const btn=document.getElementById('g-btn-redirect');
  return !!(btn&&!btn.disabled);
}

function shouldBypassOneTap(){
  return !!(googleForceRedirectOnly||googleFedCmFailureCount>0);
}

function forceGoogleRedirectOnly(reason){
  if(googleForceRedirectOnly)return;
  googleForceRedirectOnly=true;
  googleLastOauthError='app_domain_rejected:'+String(reason||'detected');
  pushGoogleDebug('Redirect-only forced: '+String(reason||'detected'));
  updateGoogleDebugPanel();
  updateGoogleConfigUi();
}

async function applyGoogleModeHintFromServer(){
  const mode=await fetchGoogleMode();
  if(!mode)return;
  googleServerMode=String(mode.recommendation||'').trim();
  if(mode.redirectEnabled===false){
    const redirectBtn=document.getElementById('g-btn-redirect');
    if(redirectBtn)redirectBtn.disabled=true;
  }
  updateGoogleConfigUi();
  refreshGooglePreferredAction();
}

async function beginGoogleLoginRecommended(){
  showGoogleClickIndicator('Connexion recommandee');
  await applyGoogleModeHintFromServer();

  const mode=String(googleServerMode||'').trim();
  const redirectBtn=document.getElementById('g-btn-redirect');
  const canRedirect=!!(redirectBtn&&!redirectBtn.disabled);

  if(googleZoneAlwaysRedirect&&canRedirect){
    pushGoogleDebug('Recommended flow: redirect (ultra-safe)');
    updateGoogleDebugPanel();
    beginGoogleLoginCodeRedirect();
    return;
  }

  if(googleForceRedirectOnly){
    if(canRedirect){
      pushGoogleDebug('Recommended flow: redirect-only forced');
      updateGoogleDebugPanel();
      beginGoogleLoginCodeRedirect();
      return;
    }
    pushGoogleDebug('Redirect-only forced but redirect unavailable, fallback alternative');
    updateGoogleDebugPanel();
    beginGoogleLoginAlt();
    return;
  }

  if(mode==='popup_or_idtoken_only'){
    if(canRedirect&&shouldBypassOneTap()){
      pushGoogleDebug('Recommended flow: redirect (One Tap bypass)');
      updateGoogleDebugPanel();
      beginGoogleLoginCodeRedirect();
      return;
    }
    pushGoogleDebug('Recommended flow: popup (server mode without redirect)');
    updateGoogleDebugPanel();
    beginGoogleLogin('select_account');
    return;
  }

  if(mode==='popup_or_redirect'&&canRedirect&&googlePopupRejectedCount>0){
    pushGoogleDebug('Recommended flow: redirect (popup previously rejected)');
    updateGoogleDebugPanel();
    beginGoogleLoginCodeRedirect();
    return;
  }

  if(googlePopupRejectedCount>0){
    pushGoogleDebug('Recommended flow: alternative (popup rejected)');
    updateGoogleDebugPanel();
    beginGoogleLoginAlt();
    return;
  }

  pushGoogleDebug('Recommended flow: popup');
  updateGoogleDebugPanel();
  beginGoogleLogin();
}

function refreshGooglePreferredAction(){
  const popup=document.getElementById('g-btn-popup');
  const alt=document.getElementById('g-btn-alt');
  if(!popup||!alt)return;
  const preferAlt=!!(googlePopupRejectedCount>0&&googleServerMode!=='popup_or_idtoken_only');
  popup.classList.toggle('btn-primary',!preferAlt);
  popup.classList.toggle('btn-secondary',preferAlt);
  alt.classList.toggle('btn-primary',preferAlt);
  alt.classList.toggle('btn-secondary',!preferAlt);
  if(preferAlt){
    alt.style.outline='2px solid var(--accent)';
    alt.style.outlineOffset='1px';
  }else{
    alt.style.outline='';
    alt.style.outlineOffset='';
  }
}

function persistGoogleClientIdFromUi(){
  const input=document.getElementById('g-client-id');
  saveGoogleClientId(input?input.value:'');
  updateGoogleConfigUi();
  toast(getGoogleClientId()?'Client ID Google enregistre localement':'Client ID Google supprime','i');
}

function syncViewportHeight(){
  const vv=window.visualViewport;
  const h=(vv&&vv.height)?vv.height:window.innerHeight;
  if(!h)return;
  document.documentElement.style.setProperty('--app-vh',h+'px');
}

function syncMobileBodyScrollLock(app,sidebar){
  if(window.DEVICE!=='mobile'){
    document.body.style.overflow='';
    return;
  }
  if(!app){
    document.body.style.overflow='';
    return;
  }
  const isOpen=!app.classList.contains('mobile-sidebar-collapsed');
  let lock=false;
  if(isOpen&&sidebar){
    lock=getComputedStyle(sidebar).position==='fixed';
  }
  document.body.style.overflow=lock?'hidden':'';
}

function refreshMobileSidebarUiState(){
  const app=document.getElementById('app-wrap');
  const gear=document.getElementById('mobile-sidebar-gear');
  if(!app)return;
  const inLobby=app.classList.contains('in-lobby');
  const isMobile=window.DEVICE==='mobile';
  if(gear){
    gear.style.display=(isMobile&&!inLobby)?'flex':'none';
  }
  syncMobileBodyScrollLock(app,app.querySelector('.sidebar'));
}

let boardAdaptiveScaleTimer=null;
function queueBoardAdaptiveScale(delay=0){
  if(boardAdaptiveScaleTimer)clearTimeout(boardAdaptiveScaleTimer);
  boardAdaptiveScaleTimer=setTimeout(()=>{
    boardAdaptiveScaleTimer=null;
    requestAnimationFrame(()=>updateBoardAdaptiveScale());
  },Math.max(0,parseInt(delay,10)||0));
}

function applyMobilePerfProfile(){
  const rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cores=navigator.hardwareConcurrency||4;
  const mem=navigator.deviceMemory||4;
  const low=window.DEVICE==='mobile'&&(rm||cores<=4||mem<=4);
  document.documentElement.classList.toggle('mobile-lowfx',!!low);
}

function applyMobileCompactProfile(){
  const w=window.innerWidth;
  const h=window.innerHeight;
  const compact=window.DEVICE==='mobile'&&(Math.min(w,h)<=430||h<=740);
  document.documentElement.classList.toggle('mobile-compact',!!compact);
}

function updateConnectionZoneUi(){
  const zone=document.getElementById('connection-zone');
  const status=document.getElementById('connection-zone-status');
  const safe=document.getElementById('cz-redirect-safe');
  if(!zone||!status)return;
  if(window.DEVICE==='mobile'){
    connectionZoneUnlocked=true;
    zone.classList.add('hidden');
    setConnectionZoneStatus('Zone connection desactivee sur mobile.',false);
    return;
  }
  if(safe)safe.checked=!!googleZoneAlwaysRedirect;
  if(connectionZoneUnlocked){
    zone.classList.add('hidden');
    const mode=(P&&P.googleConnected)?'Google':'Invite';
    setConnectionZoneStatus('Acces autorise ('+mode+').',false);
    return;
  }
  zone.classList.remove('hidden');
  if(P&&P.googleConnected&&P.googleEmail){
    setConnectionZoneStatus('Compte detecte: '+P.googleEmail+' • Reconnexion silencieuse...',true);
    if(!connectionZoneSilentPending){
      connectionZoneSilentPending=true;
      connectionZoneSilentTimer=setTimeout(()=>{
        connectionZoneSilentPending=false;
        unlockConnectionZone('google_silent');
      },1200);
    }
  }else{
    connectionZoneSilentPending=false;
    if(connectionZoneSilentTimer){clearTimeout(connectionZoneSilentTimer);connectionZoneSilentTimer=null;}
    setConnectionZoneStatus('Aucune session selectionnee.',false);
  }
}

function setConnectionZoneStatus(message,showSpinner){
  const status=document.getElementById('connection-zone-status');
  if(!status)return;
  status.textContent=String(message||'');
  if(showSpinner){
    const spin=document.createElement('span');
    spin.className='connection-zone-spinner';
    status.appendChild(spin);
  }
}

function unlockConnectionZone(source){
  if(connectionZoneSilentTimer){clearTimeout(connectionZoneSilentTimer);connectionZoneSilentTimer=null;}
  connectionZoneSilentPending=false;
  connectionZoneUnlocked=true;
  updateConnectionZoneUi();
  if(source==='guest')toast('Mode invite active','i');
  if(source==='google_silent')toast('Reconnexion Google silencieuse','i');
}

function openGuestSetup(){
  const box=document.getElementById('connection-zone-guest');
  if(!box)return;
  box.classList.add('open');
  const n=document.getElementById('cz-guest-name');
  const c=document.getElementById('cz-guest-color');
  const e=document.getElementById('cz-guest-emoji');
  if(n&&!n.value)n.value=P&&P.name?P.name:'Invite';
  if(c&&!c.value)c.value=P&&P.color?P.color:'#22c55e';
  if(e&&!e.value)e.value=P&&P.emoji?P.emoji:'🎲';
  highlightGuestEmojiSelection(e?e.value:'');
  if(e){
    e.oninput=()=>highlightGuestEmojiSelection(e.value);
  }
}

function cancelGuestSetup(){
  const box=document.getElementById('connection-zone-guest');
  if(box)box.classList.remove('open');
}

function confirmGuestSetup(){
  const name=(document.getElementById('cz-guest-name')?.value||'').trim();
  const color=(document.getElementById('cz-guest-color')?.value||'').trim();
  const emoji=(document.getElementById('cz-guest-emoji')?.value||'').trim();
  if(name){
    const normalized=name.replace(/\s+/g,' ').trim();
    const valid=/^[a-zA-Z0-9 _-]{3,24}$/.test(normalized);
    if(!valid){
      toast('Pseudo invite invalide: 3-24 caracteres (lettres/chiffres/espace/_/-)','w');
      return;
    }
    P.name=normalized;
  }else{
    toast('Pseudo invite requis','w');
    return;
  }
  if(/^#[0-9a-fA-F]{6}$/.test(color))P.color=color;
  if(emoji)P.emoji=emoji.slice(0,2);
  saveProfileData();
  renderLobbyProfileTab();
  cancelGuestSetup();
  unlockConnectionZone('guest');
}

function selectGuestEmoji(emoji){
  const e=document.getElementById('cz-guest-emoji');
  if(e)e.value=String(emoji||'').slice(0,2);
  highlightGuestEmojiSelection(emoji);
}

function highlightGuestEmojiSelection(emoji){
  document.querySelectorAll('.connection-zone-emoji').forEach((btn)=>{
    btn.classList.toggle('sel',btn.getAttribute('data-cz-emoji')===String(emoji||''));
  });
}

function useGuestMode(){
  openGuestSetup();
}

function setConnectionZoneUltraSafe(enabled){
  googleZoneAlwaysRedirect=!!enabled;
  try{localStorage.setItem('NP_ZONE_ULTRASAFE_REDIRECT',googleZoneAlwaysRedirect?'1':'0');}catch(_){ }
  updateConnectionZoneUi();
}

function openConnectionZoneGoogle(){
  if(googleZoneAlwaysRedirect&&canUseGoogleRedirectNow()){
    beginGoogleLoginCodeRedirect();
    return;
  }
  beginGoogleLoginRecommended();
}

function openConnectionZoneGoogleSwitch(){
  if(googleZoneAlwaysRedirect&&canUseGoogleRedirectNow()){
    beginGoogleLoginCodeRedirect();
    return;
  }
  beginGoogleLogin('select_account');
}

// ═══════════════════════════════════════
//  DEVICE DETECTION SYSTEM
//  Détecte le type d'écran et l'orientation,
//  pose data-device et data-orient sur <html>
//  et expose window.DEVICE / window.ORIENT
// ═══════════════════════════════════════
(function detectDevice(){
  const html=document.documentElement;
  function classify(){
    syncViewportHeight();
    const w=window.innerWidth;
    const h=window.innerHeight;
    const ua=navigator.userAgent;
    const isTouch=('ontouchstart' in window)||(navigator.maxTouchPoints>0);
    // Orientation
    const orient=(w>=h)?'landscape':'portrait';
    // Device type — heuristique UA + taille + touch
    const isTabletUA=/ipad|tablet|playbook|silk|kindle/i.test(ua);
    const isMobileUA=/iphone|ipod|android|blackberry|windows phone|mobile/i.test(ua);
    let device;
    if(w<=599||(isTouch&&isMobileUA&&w<=900)){
      device='mobile';
    }else if(w<=1024||isTabletUA||(isTouch&&w<=1280)){
      device='tablet';
    }else{
      device='desktop';
    }
    html.setAttribute('data-device',device);
    html.setAttribute('data-orient',orient);
    window.DEVICE=device;
    window.ORIENT=orient;
    // Classes sur body pour ciblage JS éventuel
    document.body.className=document.body.className
      .replace(/\bdev-\S+|\bor-\S+/g,'').trim();
    document.body.classList.add('dev-'+device,'or-'+orient);
    const appWrap=document.getElementById('app-wrap');
    if(appWrap&&device!=='mobile')appWrap.classList.remove('mobile-sidebar-collapsed');
    refreshMobileSidebarUiState();
    applyMobilePerfProfile();
    applyMobileCompactProfile();
    queueBoardAdaptiveScale(0);
  }
  classify();
  let _rt;
  window.addEventListener('resize',()=>{clearTimeout(_rt);_rt=setTimeout(classify,80);});
  window.addEventListener('orientationchange',()=>setTimeout(classify,120));
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',syncViewportHeight,{passive:true});
    window.visualViewport.addEventListener('scroll',syncViewportHeight,{passive:true});
  }
})();

const IS_PC_PLATFORM=(()=>{
  const ua=String(navigator.userAgent||'').toLowerCase();
  const isMobileUa=/iphone|ipod|android|blackberry|windows phone|mobile|silk|kindle/i.test(ua);
  const isIpadOs=/macintosh/i.test(ua)&&navigator.maxTouchPoints>1;
  return !isMobileUa&&!isIpadOs;
})();

let UI_TOOLTIP_EL=null;
function ensureUiTooltip(){
  if(UI_TOOLTIP_EL&&document.body&&document.body.contains(UI_TOOLTIP_EL)) return UI_TOOLTIP_EL;
  UI_TOOLTIP_EL=document.getElementById('ui-tooltip');
  if(!UI_TOOLTIP_EL&&document.body){
    UI_TOOLTIP_EL=document.createElement('div');
    UI_TOOLTIP_EL.id='ui-tooltip';
    UI_TOOLTIP_EL.setAttribute('role','tooltip');
    UI_TOOLTIP_EL.setAttribute('aria-hidden','true');
    document.body.appendChild(UI_TOOLTIP_EL);
  }
  return UI_TOOLTIP_EL;
}
function positionUiTooltip(clientX,clientY){
  const tip=ensureUiTooltip();
  if(!tip) return;
  const margin=12;
  const rect=tip.getBoundingClientRect();
  let left=(Number.isFinite(clientX)?clientX:margin)+14;
  let top=(Number.isFinite(clientY)?clientY:margin)+16;
  if(left+rect.width+margin>window.innerWidth) left=Math.max(margin,(Number.isFinite(clientX)?clientX:window.innerWidth)-rect.width-14);
  if(top+rect.height+margin>window.innerHeight) top=Math.max(margin,(Number.isFinite(clientY)?clientY:window.innerHeight)-rect.height-14);
  tip.style.left=`${left}px`;
  tip.style.top=`${top}px`;
}
function showUiTooltip(el,evt){
  if(!el) return;
  const text=String(el.getAttribute('data-tip')||'').trim();
  if(!text){ hideUiTooltip(); return; }
  const tip=ensureUiTooltip();
  if(!tip) return;
  if(tip.textContent!==text) tip.textContent=text;
  tip.setAttribute('aria-hidden','false');
  tip.classList.add('show');
  const rect=el.getBoundingClientRect();
  const x=evt&&Number.isFinite(evt.clientX)?evt.clientX:(rect.left+rect.width/2);
  const y=evt&&Number.isFinite(evt.clientY)?evt.clientY:(rect.top+rect.height/2);
  positionUiTooltip(x,y);
}
function hideUiTooltip(){
  const tip=ensureUiTooltip();
  if(!tip) return;
  tip.classList.remove('show');
  tip.setAttribute('aria-hidden','true');
}
function initUiTooltips(){
  if(!document.body||document.body.dataset.npTooltipsBound==='1') return;
  ensureUiTooltip();
  document.body.dataset.npTooltipsBound='1';

  document.addEventListener('mouseover',e=>{
    const el=e&&e.target&&e.target.closest?e.target.closest('[data-tip]'):null;
    if(el) showUiTooltip(el,e);
  });
  document.addEventListener('mousemove',e=>{
    const tip=ensureUiTooltip();
    if(tip&&tip.classList.contains('show')) positionUiTooltip(e.clientX,e.clientY);
  });
  document.addEventListener('mouseout',e=>{
    const from=e&&e.target&&e.target.closest?e.target.closest('[data-tip]'):null;
    if(!from) return;
    const to=e&&e.relatedTarget&&e.relatedTarget.closest?e.relatedTarget.closest('[data-tip]'):null;
    if(from!==to) hideUiTooltip();
  });
  document.addEventListener('focusin',e=>{
    const el=e&&e.target&&e.target.closest?e.target.closest('[data-tip]'):null;
    if(el) showUiTooltip(el);
  });
  document.addEventListener('focusout',e=>{
    const el=e&&e.target&&e.target.closest?e.target.closest('[data-tip]'):null;
    if(el) hideUiTooltip();
  });
  window.addEventListener('scroll',hideUiTooltip,true);
  window.addEventListener('resize',hideUiTooltip,{passive:true});
}

function initGlobalLeaderboardEdgePanel(){
  const panel=document.getElementById('global-leaderboard-edge');
  const hotzone=document.getElementById('global-leaderboard-edge-hotzone');
  const handle=document.getElementById('global-leaderboard-edge-handle');
  if(!panel||panel.dataset.bound==='1')return;
  panel.dataset.bound='1';
  let closeTimer=null;
  const openNow=()=>{
    if(closeTimer)clearTimeout(closeTimer);
    panel.classList.add('is-open');
    document.body.classList.add('leaderboard-edge-open');
  };
  const closeSoon=(delay=140)=>{
    if(closeTimer)clearTimeout(closeTimer);
    closeTimer=setTimeout(()=>{
      if(panel.matches(':hover')||hotzone?.matches(':hover'))return;
      panel.classList.remove('is-open');
      document.body.classList.remove('leaderboard-edge-open');
    },delay);
  };
  hotzone?.addEventListener('mouseenter',openNow);
  hotzone?.addEventListener('mouseleave',()=>closeSoon(120));
  panel.addEventListener('mouseenter',openNow);
  panel.addEventListener('mouseleave',()=>closeSoon(120));
  handle?.addEventListener('click',ev=>{
    ev.preventDefault();
    ev.stopPropagation();
    if(panel.classList.contains('is-open'))closeSoon(0);
    else openNow();
  });
  document.addEventListener('mousemove',ev=>{
    if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches)return;
    const x=Number(ev.clientX)||0;
    if(x<=72)openNow();
    else if(!panel.matches(':hover')&&x>Math.min(window.innerWidth*0.3,panel.offsetWidth+96))closeSoon(90);
  },{passive:true});
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape')closeSoon(0);
  });
}

// Sélecteur d'emoji pour pion (tous modes)
document.addEventListener('DOMContentLoaded',()=>{
  enforceCanonicalLocalOrigin();
  try{googleZoneAlwaysRedirect=localStorage.getItem('NP_ZONE_ULTRASAFE_REDIRECT')==='1';}catch(_){googleZoneAlwaysRedirect=false;}
  updateConnectionZoneUi();
  initDefaultWsUrlInputs();
  ensurePreferredRenderOrigin(false).then(()=>initDefaultWsUrlInputs()).catch(()=>{});
  loadJoinBrowserPrefs();
  setJoinRoomFilter(JOIN_ROOM_FILTER);
  setJoinRoomSort(JOIN_ROOM_SORT);
  initMobileSidebarToggle();
  initMobileRestrictions();
  initMobileSidebarSwipe();
  loadClientUiPrefs();
  loadAudioPrefs();
  applyDaTheme(G.daTheme||'aurora');
  setClientCellScale(CLIENT_UI.cellScale);
  initUiTooltips();
  ensureEmojiUnlocks(false);
  renderPartyEmojiPickers();
  queueBoardAdaptiveScale(0);
  setTimeout(updateAddonButtonVisibility,500);
  setTimeout(bootGoogleHealthCheckOnce,350);
  setTimeout(handleGoogleRedirectCodeIfPresent,200);
  const observer=new MutationObserver(()=>updateAddonButtonVisibility());
  observer.observe(document.body,{childList:true});

  if(!document.getElementById('modal-google')){
    pushGoogleDebug('Self-test: modal-google introuvable');
  }else{
    pushGoogleDebug('Self-test: modal-google present');
  }
  if(typeof openGoogleLoginModal!=='function'){
    pushGoogleDebug('Self-test: openGoogleLoginModal manquante');
  }
  if(typeof beginGoogleLogin!=='function'||typeof beginGoogleLoginAlt!=='function'||typeof beginGoogleLoginCodeRedirect!=='function'){
    pushGoogleDebug('Self-test: handlers Google incomplets');
  }else{
    pushGoogleDebug('Self-test: handlers Google OK');
  }
  updateGoogleDebugPanel();
  refreshGooglePreferredAction();
  updateGoogleConfigUi();
  setTimeout(applyGoogleModeHintFromServer,500);

  window.addEventListener('error',(ev)=>{
    const msg=String(ev&&ev.message||'js_error');
    const src=String(ev&&ev.filename||'');
    const line=Number(ev&&ev.lineno||0);
    pushGoogleDebug('JS error: '+msg+(src?(' @ '+src+':'+line):''));
    updateGoogleDebugPanel();
  });

  document.addEventListener('keydown',(ev)=>{
    const tag=String(ev.target&&ev.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    if(ev.key==='g'||ev.key==='G'){
      openGoogleLoginModal();
    }
  });

  if(IS_PC_PLATFORM){
    ['cr-emoji','jn-emoji','lc-emoji'].forEach(id=>{
      const input=document.getElementById(id);
      if(!input)return;
      input.readOnly=true;
      input.setAttribute('inputmode','none');
      input.setAttribute('autocomplete','off');
      input.addEventListener('beforeinput',ev=>ev.preventDefault());
      input.addEventListener('keydown',ev=>ev.preventDefault());
      input.addEventListener('paste',ev=>ev.preventDefault());
    });
  }

  document.addEventListener('click',e=>{
    const googleBtn=e.target.closest('#google-connect-area .google-btn');
    if(googleBtn){
      e.preventDefault();
      openGoogleLoginModal();
      return;
    }
    const choice=e.target.closest('.emoji-choice');
    if(!choice) return;
    const picker=choice.closest('.emoji-picker, #emoji-picker');
    if(!picker) return;

    let inputId=picker.getAttribute('data-for');
    if(!inputId && picker.id==='emoji-picker') inputId='lc-emoji';
    const input=document.getElementById(inputId);
    if(!input) return;

    if(choice.getAttribute('data-unlocked')!=='1'){
      toast('🔒 '+(choice.getAttribute('data-lock-reason')||'Emoji verrouillé'),'i');
      return;
    }

    const emoji=String(choice.getAttribute('data-emoji')||choice.textContent||'').trim();
    if(!emoji) return;

    input.value=emoji;
    input.removeAttribute('data-img');
    input.style.backgroundImage='';
    renderPartyEmojiPickers();
  });

  document.querySelectorAll('.emoji-drop-zone').forEach(zone=>{
    const inputId=zone.getAttribute('data-for');
    const input=document.getElementById(inputId);
    const hint=zone.querySelector('.emoji-drop-hint');
    zone.addEventListener('dragover',e=>{
      e.preventDefault();
      zone.style.borderColor='var(--accent)';
      zone.style.background='rgba(34,197,94,.08)';
      if(hint) hint.textContent='Relâche pour utiliser cette image';
    });
    zone.addEventListener('dragleave',()=>{
      zone.style.borderColor='var(--border)';
      zone.style.background='var(--s2)';
      if(hint) hint.textContent='🖼️ Glisse une image ici ou clique';
    });
    zone.addEventListener('drop',e=>{
      e.preventDefault();
      zone.style.borderColor='var(--border)';
      zone.style.background='var(--s2)';
      const file=e.dataTransfer.files[0];
      if(file && file.type.startsWith('image/')){
        const reader=new FileReader();
        reader.onload=ev=>{
          input.value='';
          input.setAttribute('data-img',ev.target.result);
          input.style.backgroundImage=`url('${ev.target.result}')`;
          input.style.backgroundSize='cover';
          input.style.backgroundPosition='center';
          if(hint) hint.textContent='Image importée. Clique pour changer';
        };
        reader.readAsDataURL(file);
      }
    });
    zone.addEventListener('click',()=>{
      const picker=document.createElement('input');
      picker.type='file';picker.accept='image/*';
      picker.onchange=ev=>{
        const file=ev.target.files[0];
        if(file && file.type.startsWith('image/')){
          const reader=new FileReader();
          reader.onload=ev2=>{
            input.value='';
            input.setAttribute('data-img',ev2.target.result);
            input.style.backgroundImage=`url('${ev2.target.result}')`;
            input.style.backgroundSize='cover';
            input.style.backgroundPosition='center';
            if(hint) hint.textContent='Image importée. Clique pour changer';
          };
          reader.readAsDataURL(file);
        }
      };
      picker.click();
    });
    zone.addEventListener('mouseenter',()=>{
      zone.style.borderColor='rgba(148,163,184,.45)';
    });
    zone.addEventListener('mouseleave',()=>{
      zone.style.borderColor='var(--border)';
      zone.style.background='var(--s2)';
    });
  });

  initCenterActionsDrag();
  loadProfile();
  setTimeout(()=>refreshModerationStatus(true),850);
  setTimeout(()=>connectSocialWs(true),700);
  updateConnectionZoneUi();
  initDebugAccessControl();
  initProfileImgZone();
  initDesktopKeyboardShortcuts();
  initModalBackdropClose();
  initGlobalLeaderboardEdgePanel();
  if(typeof updateSidebarConnectionIndicator==='function')updateSidebarConnectionIndicator();
  window.maybeOpenSharedProfileFromUrl?.();
  document.querySelectorAll('.lobby-tab').forEach(btn=>btn.addEventListener('click',()=>switchLobbyTab(btn.dataset.ltab)));
});

// ═══════════════════════════════════════
//  CARDS
// ═══════════════════════════════════════
function getBalancedEventAmount(kind){
  const ref=Math.max(80,Math.round(((Number(G.passGoBonus)||200)*0.7)+((Number(G.startingMoney)||1500)*0.04)));
  if(kind==='smallGain')return Math.max(25,Math.round(ref*0.3/5)*5);
  if(kind==='mediumGain')return Math.max(60,Math.round(ref*0.75/10)*10);
  if(kind==='bigGain')return Math.max(100,Math.round(ref/10)*10);
  if(kind==='smallFee')return Math.max(25,Math.round(ref*0.28/5)*5);
  if(kind==='mediumFee')return Math.max(50,Math.round(ref*0.55/10)*10);
  if(kind==='bigFee')return Math.max(80,Math.round(ref*0.8/10)*10);
  if(kind==='birthdayShare')return Math.max(10,Math.round(ref*0.06/5)*5);
  return Math.max(20,Math.round(ref*0.4/5)*5);
}

function movePlayerToCellDirect(p,targetPos,reason,options){
  if(!p)return;
  const opts=options&&typeof options==='object'?options:{};
  const oldPos=Number(p.pos||0);
  const next=((parseInt(targetPos,10)||0)%40+40)%40;
  p.pos=next;
  if(opts.grantPassGo&&(next<oldPos||opts.forcePassGo)){
    p.money+=G.passGoBonus;
    recordTxn(p,G.passGoBonus,reason||'Carte: Départ');
  }
  animPawnArrive(next);
  if(opts.log!==false){
    const cell=G.board[next];
    glog((reason||'Carte')+' → '+(cell?cell.n:'case '+next)+'.','i');
  }
  if(opts.resolve!==false){
    const cell=G.board[next];
    if(cell)resolveCell(p,cell);
  }
}

function isPlayerUnavailable(p){
  return !p||!!p.bust||!!p.disconnected;
}

function getActivePlayers(){
  return G.players.filter(p=>p&&!p.bust&&!p.disconnected);
}

function grantBonusTurnToPlayer(p,reason){
  if(isPlayerUnavailable(p))return false;
  G.bonusTurns[p.id]=(G.bonusTurns[p.id]||0)+1;
  if(reason){
    glog('🎁 '+p.name+' obtient un tour bonus'+(reason?' ('+reason+')':'')+'.','a');
    toast('🎁 Tour bonus pour '+p.name,'a');
  }
  return true;
}

function grantGhostPassBonus(p,reason){
  if(isPlayerUnavailable(p))return false;
  p.ghostPass=(parseInt(p.ghostPass,10)||0)+1;
  if(reason){
    glog('👻 '+p.name+' gagne un passe-fantôme'+(reason?' ('+reason+')':'')+'.','a');
    toast('👻 Passe-fantôme gagné','a');
  }
  return true;
}

function awardFreeBuildBonus(p,reason){
  if(isPlayerUnavailable(p))return false;
  const eco=getBoardEconomySnapshot();
  const candidates=G.board.filter(cell=>{
    if(!cell||cell.t!=='property'||cell.owner!==p.id||cell.mortgaged||(cell.houses||0)>=5)return false;
    const total=eco.propertyGroupTotals.get(cell.c)||0;
    const owned=eco.propertyGroupOwned.get(cell.c)?.get(p.id)||0;
    return total>1&&owned===total;
  }).sort((a,b)=>calcRent(b,eco)-calcRent(a,eco));
  const target=candidates[0];
  if(!target)return false;
  target.houses=(target.houses||0)+1;
  recordTxn(p,0,'Bonus construction: '+target.n);
  glog('🏗️ '+p.name+' gagne '+(target.houses>=5?'un hôtel':'une maison')+' gratuite sur '+target.n+(reason?' ('+reason+')':'')+'.','a');
  toast((target.houses>=5?'🏨':'🏠')+' Bonus sur '+target.n,'a');
  refreshHouses();
  refreshOwners();
  return true;
}

function triggerSpecialPartyEvent(sourcePlayer,sourceLabel){
  if(!sourcePlayer||!G.started)return false;
  const active=getActivePlayers();
  if(!active.length)return false;
  const eco=getBoardEconomySnapshot();
  const richest=[...active].sort((a,b)=>getPlayerNetWorth(b,eco)-getPlayerNetWorth(a,eco))[0]||null;
  const poorest=[...active].sort((a,b)=>getPlayerNetWorth(a,eco)-getPlayerNetWorth(b,eco))[0]||null;
  const partyGain=Math.max(15,Math.round(getBalancedEventAmount('smallGain')*0.5/5)*5);
  const swing=Math.max(20,Math.round(getBalancedEventAmount('smallFee')/5)*5);
  const events=[
    {
      title:'🎉 Fête de quartier',
      apply:()=>{
        active.forEach(player=>{player.money+=partyGain;recordTxn(player,partyGain,'Événement: fête de quartier');});
        return true;
      }
    },
    {
      title:'🚀 Coup d’accélérateur',
      apply:()=>grantBonusTurnToPlayer(sourcePlayer,'événement spécial')
    },
    {
      title:'👻 Brouillard malin',
      apply:()=>grantGhostPassBonus(sourcePlayer,'événement spécial')
    },
    {
      title:'🏗️ Boom immobilier',
      apply:()=>awardFreeBuildBonus(sourcePlayer,'événement spécial')||((addMatchItem(sourcePlayer,'mortgageDiscount',1,'événement spécial')),true)
    },
    {
      title:'⚖️ Redistribution surprise',
      apply:()=>{
        if(!richest||!poorest||richest.id===poorest.id)return false;
        const amount=Math.min(swing,Math.max(10,(richest.money||0)-50));
        richest.money-=amount;poorest.money+=amount;
        recordTxn(richest,-amount,'Événement: redistribution');
        recordTxn(poorest,amount,'Événement: redistribution');
        return true;
      }
    },
    {
      title:'🎁 Colis mystère',
      apply:()=>{grantRandomMatchItem(sourcePlayer,sourceLabel||'événement spécial');return true;}
    }
  ];
  const shuffled=[...events].sort(()=>Math.random()-.5);
  const picked=shuffled.find(ev=>{
    try{return !!ev.apply();}catch(_){return false;}
  });
  if(!picked)return false;
  G.lastSpecialEventTurn=G.turnCount||0;
  glog('✨ Événement spécial: '+picked.title,'a');
  toast(picked.title,'a');
  renderPlayers();refreshPawns();updBtns();broadcast();
  return true;
}

const CHANCE_CARDS=[
  {getText:()=>"Avancez jusqu'au Départ. Recevez le bonus Départ.",fn:p=>movePlayerToCellDirect(p,0,'Chance: Départ',{grantPassGo:true,forcePassGo:true})},
  {getText:()=>"Allez en Prison.",fn:p=>sendToJail(p,'Carte Chance')},
  {getText:()=>`Payez ${getBalancedEventAmount('bigFee')}$ d'amende.`,fn:p=>{const fee=getBalancedEventAmount('bigFee');p.money-=fee;recordTxn(p,-fee,'Chance: Amende');checkBust(p);}},
  {getText:()=>`Recevez ${getBalancedEventAmount('mediumGain')}$ .`,fn:p=>{const gain=getBalancedEventAmount('mediumGain');p.money+=gain;recordTxn(p,gain,'Chance: Gain');}},
  {getText:()=>"Reculez de 3 cases.",fn:p=>movePlayerToCellDirect(p,(p.pos-3+40)%40,'Chance: Retour',{grantPassGo:false})},
  {getText:()=>`Recevez un dividende de ${getBalancedEventAmount('smallGain')}$ .`,fn:p=>{const gain=getBalancedEventAmount('smallGain');p.money+=gain;recordTxn(p,gain,'Chance: Dividende');}},
  {getText:()=>`Payez ${getBalancedEventAmount('mediumFee')}$ de réparations.`,fn:p=>{const fee=getBalancedEventAmount('mediumFee');p.money-=fee;recordTxn(p,-fee,'Chance: Réparations');checkBust(p);}},
  {getText:()=>"Avancez à la prochaine gare.",fn:p=>{let n=p.pos;do{n=(n+1)%40;}while(G.board[n].t!=='railroad');movePlayerToCellDirect(p,n,'Chance: Prochaine gare',{grantPassGo:n<p.pos});}},
  {getText:()=>"Recevez un passe-fantôme.",fn:p=>grantGhostPassBonus(p,'carte Chance')},
  {getText:()=>"Obtenez un tour bonus surprise.",fn:p=>grantBonusTurnToPlayer(p,'carte Chance')},
  {getText:()=>"Boom immobilier : gagnez une construction gratuite ou une réduction d’hypothèque.",fn:p=>{if(!awardFreeBuildBonus(p,'carte Chance'))addMatchItem(p,'mortgageDiscount',1,'carte Chance');}},
  {getText:()=>"Colis premium : recevez un objet de partie aléatoire.",fn:p=>grantRandomMatchItem(p,'carte Chance premium')},
];
const COMMUNITY_CARDS=[
  {getText:()=>`Erreur bancaire en votre faveur. Recevez ${getBalancedEventAmount('bigGain')}$ .`,fn:p=>{const gain=getBalancedEventAmount('bigGain');p.money+=gain;recordTxn(p,gain,'Caisse: Banque');}},
  {getText:()=>`Payez les frais médicaux: ${getBalancedEventAmount('mediumFee')}$ .`,fn:p=>{const fee=getBalancedEventAmount('mediumFee');p.money-=fee;recordTxn(p,-fee,'Caisse: Médecin');checkBust(p);}},
  {getText:()=>`Recevez votre héritage: ${getBalancedEventAmount('mediumGain')}$ .`,fn:p=>{const gain=getBalancedEventAmount('mediumGain');p.money+=gain;recordTxn(p,gain,'Caisse: Héritage');}},
  {getText:()=>`Amende pour excès de vitesse: ${getBalancedEventAmount('smallFee')}$ .`,fn:p=>{const fee=getBalancedEventAmount('smallFee');p.money-=fee;recordTxn(p,-fee,'Caisse: Amende');checkBust(p);}},
  {getText:()=>`Remboursement d'impôts: ${getBalancedEventAmount('smallGain')}$ .`,fn:p=>{const gain=getBalancedEventAmount('smallGain');p.money+=gain;recordTxn(p,gain,'Caisse: Impôts');}},
  {getText:()=>"Sortie de prison gratuite.",fn:p=>{p.jailCards=(p.jailCards||0)+1;recordTxn(p,0,'Carte: Sortie de prison');}},
  {getText:()=>`C'est votre anniversaire ! Recevez ${getBalancedEventAmount('birthdayShare')}$ de chaque joueur.`,fn:p=>{
    const share=getBalancedEventAmount('birthdayShare');
    const others=G.players.filter(o=>!o.bust&&o.id!==p.id);
    others.forEach(o=>{o.money-=share;p.money+=share;recordTxn(o,-share,'Anniversaire');});
    recordTxn(p,share*others.length,'Anniversaire');
  }},
  {getText:()=>"Subvention locale : tous les joueurs actifs reçoivent un petit bonus.",fn:_p=>{
    const gain=Math.max(10,Math.round(getBalancedEventAmount('smallGain')*0.45/5)*5);
    getActivePlayers().forEach(player=>{player.money+=gain;recordTxn(player,gain,'Caisse: Subvention locale');});
  }},
  {getText:()=>"Aide au quartier : le joueur le plus pauvre reçoit une prime.",fn:_p=>{
    const eco=getBoardEconomySnapshot();
    const poorest=[...getActivePlayers()].sort((a,b)=>getPlayerNetWorth(a,eco)-getPlayerNetWorth(b,eco))[0];
    if(!poorest)return;
    const gain=getBalancedEventAmount('mediumGain');
    poorest.money+=gain;recordTxn(poorest,gain,'Caisse: Aide au quartier');
  }},
  {getText:()=>"Livraison surprise : gagnez un objet de partie aléatoire.",fn:p=>grantRandomMatchItem(p,'caisse commune')},
];

// ═══════════════════════════════════════
//  BOARD DEFINITION (cases du plateau)
// ═══════════════════════════════════════
const DEF = [
  {i:0,  n:'Départ',           t:'start',     p:0,   r:0,   c:'#22c55e',ico:'🚦'},
  {i:1,  n:'Boulevard de Belleville', t:'property', p:60,  r:2,   c:'#8b5cf6',ico:'🏠'},
  {i:2,  n:'Caisse Commune',   t:'community', p:0,   r:0,   c:'#facc15',ico:'💳'},
  {i:3,  n:'Rue Lecourbe',     t:'property', p:60,  r:4,   c:'#8b5cf6',ico:'🏠'},
  {i:4,  n:'Impôt sur le revenu', t:'tax',      p:0,   r:200, c:'#ef4444',ico:'💸'},
  {i:5,  n:'Gare Montparnasse', t:'railroad',  p:200, r:25,  c:'#d4d4d4',ico:'🚂'},
  {i:6,  n:'Rue de Vaugirard',  t:'property', p:100, r:6,   c:'#22c55e',ico:'🏠'},
  {i:7,  n:'Chance',           t:'chance',    p:0,   r:0,   c:'#fbbf24',ico:'❓'},
  {i:8,  n:'Rue de Courcelles',t:'property', p:100, r:6,   c:'#22c55e',ico:'🏠'},
  {i:9,  n:'Avenue de la République', t:'property', p:120, r:8,   c:'#22c55e',ico:'🏠'},
  {i:10, n:'Prison / Visite',  t:'jail',      p:0,   r:0,   c:'#3b82f6',ico:'👮'},
  {i:11, n:'Boulevard de la Villette', t:'property', p:140, r:10,  c:'#3b82f6',ico:'🏠'},
  {i:12, n:'Compagnie Électricité', t:'utility',   p:150, r:30,  c:'#facc15',ico:'💡'},
  {i:13, n:'Avenue de Neuilly', t:'property', p:140, r:10,  c:'#3b82f6',ico:'🏠'},
  {i:14, n:'Rue de Paradis',    t:'property', p:160, r:12,  c:'#3b82f6',ico:'🏠'},
  {i:15, n:'Gare de Lyon',      t:'railroad',  p:200, r:25,  c:'#d4d4d4',ico:'🚂'},
  {i:16, n:'Avenue Mozart',     t:'property', p:180, r:14,  c:'#ec4899',ico:'🏠'},
  {i:17, n:'Caisse Commune',   t:'community', p:0,   r:0,   c:'#facc15',ico:'💳'},
  {i:18, n:'Boulevard Saint-Michel', t:'property', p:180, r:14,  c:'#ec4899',ico:'🏠'},
  {i:19, n:'Place Pigalle',    t:'property', p:200, r:16,  c:'#ec4899',ico:'🏠'},
  {i:20, n:'Parc Gratuit',     t:'parking',   p:0,   r:0,   c:'#84cc16',ico:'🅿️'},
  {i:21, n:'Avenue Matignon',  t:'property', p:220, r:18,  c:'#84cc16',ico:'🏠'},
  {i:22, n:'Chance',           t:'chance',    p:0,   r:0,   c:'#fbbf24',ico:'❓'},
  {i:23, n:'Boulevard Malesherbes', t:'property', p:220, r:18,  c:'#84cc16',ico:'🏠'},
  {i:24, n:'Avenue Henri-Martin', t:'property', p:240, r:20,  c:'#84cc16',ico:'🏠'},
  {i:25, n:'Gare Saint-Lazare', t:'railroad',  p:200, r:25,  c:'#d4d4d4',ico:'🚂'},
  {i:26, n:'Faubourg Saint-Honoré', t:'property', p:260, r:22,  c:'#f97316',ico:'🏠'},
  {i:27, n:'Avenue de Messine', t:'property', p:260, r:22,  c:'#f97316',ico:'🏠'},
  {i:28, n:'Compagnie Eau',    t:'utility',   p:150, r:30,  c:'#facc15',ico:'💧'},
  {i:29, n:'Rue de la Fayette',t:'property', p:280, r:24,  c:'#f97316',ico:'🏠'},
  {i:30, n:'Allez en Prison',  t:'gotojail',  p:0,   r:0,   c:'#ef4444',ico:'🚔'},
  {i:31, n:'Avenue de Breteuil', t:'property', p:300, r:26,  c:'#a855f7',ico:'🏠'},
  {i:32, n:'Boulevard des Capucines', t:'property', p:300, r:26,  c:'#a855f7',ico:'🏠'},
  {i:33, n:'Caisse Commune',   t:'community', p:0,   r:0,   c:'#facc15',ico:'💳'},
  {i:34, n:'Avenue Foch',      t:'property', p:320, r:28,  c:'#a855f7',ico:'🏠'},
  {i:35, n:'Gare du Nord',     t:'railroad',  p:200, r:25,  c:'#d4d4d4',ico:'🚂'},
  {i:36, n:'Avenue des Champs-Élysées', t:'property', p:350, r:35,  c:'#f43f5e',ico:'🏠'},
  {i:37, n:'Chance',           t:'chance',    p:0,   r:0,   c:'#fbbf24',ico:'❓'},
  {i:38, n:'Rue de la Paix',   t:'property', p:400, r:50,  c:'#f43f5e',ico:'🏠'},
  {i:39, n:'Avenue de la République', t:'property', p:400, r:50,  c:'#f43f5e',ico:'🏠'},
];

const EMOJIS=['🐱','🐶','🦊','🐸','🦁','🐼','🐨','🐵'];
const EMOJI_UNLOCK_DEFS=[
  {key:'base_cat',emoji:'🐱',base:true,label:'Chat',desc:'Un classique agile et discret.'},
  {key:'base_dog',emoji:'🐶',base:true,label:'Chien',desc:'Compagnon fidele pour ouvrir la collection.'},
  {key:'base_fox',emoji:'🦊',base:true,label:'Renard',desc:'Rapide, malin et tres polyvalent.'},
  {key:'base_frog',emoji:'🐸',base:true,label:'Grenouille',desc:'Petit pion fun avec un style atypique.'},
  {key:'base_lion',emoji:'🦁',base:true,label:'Lion',desc:'Aura royale pour les joueurs ambitieux.'},
  {key:'base_panda',emoji:'🐼',base:true,label:'Panda',desc:'Un look calme et iconique.'},
  {key:'base_koala',emoji:'🐨',base:true,label:'Koala',desc:'Un pion chill pour les longues parties.'},
  {key:'base_monkey',emoji:'🐵',base:true,label:'Singe',desc:'Energie et espièglerie sur le plateau.'},
  {key:'wolf_10_games',emoji:'🐺',label:'Loup',desc:'Symbole d\'endurance de joueur.',cond:'Jouer 10 parties',unlock:p=>(parseInt(p?.stats?.gamesPlayed,10)||0)>=10},
  {key:'tiger_5_wins',emoji:'🐯',label:'Tigre',desc:'Debloque en prouvant ta domination.',cond:'Gagner 5 parties',unlock:p=>(parseInt(p?.stats?.gamesWon,10)||0)>=5},
  {key:'robot_30_props',emoji:'🤖',label:'Robot',desc:'Pour les collectionneurs de proprietes.',cond:'Acheter 30 propriétés',unlock:p=>(parseInt(p?.stats?.propertiesBought,10)||0)>=30},
  {key:'dragon_1600_elo',emoji:'🐉',label:'Dragon',desc:'Embleme des joueurs montes en elo.',cond:'Atteindre 1600 ELO',unlock:p=>(parseInt(p?.elo,10)||0)>=1600},
  {key:'secret_glitch',emoji:'👾',label:'Glitch',desc:'Une anomalie retro venue d\'ailleurs.',secret:true,cond:'Condition secrète',unlock:p=>!!p?.secretUnlocks?.fx_arcade},
  {key:'secret_cosmic',emoji:'🛸',label:'Cosmique',desc:'Un visiteur venu des etoiles.',secret:true,cond:'Condition secrète',unlock:p=>!!p?.secretUnlocks?.fx_cosmic},
  {key:'secret_shadow',emoji:'🕶️',label:'Ombre',desc:'Style clandestin reserve aux obstines.',secret:true,cond:'Condition secrète',unlock:p=>((parseInt(p?.stats?.gamesLost,10)||0)>=13&&(parseInt(p?.stats?.gamesWon,10)||0)>=13)},
  {key:'quest_orchid',emoji:'🪷',label:'Lotus astral',desc:'Cosmétique premium obtenu via les quêtes.',secret:true,cond:'Obtenir la Palette prismatique',unlock:p=>!!p?.emojiUnlocks?.quest_orchid},
  {key:'rare_unicorn',emoji:'🦄',label:'Licorne Néo',desc:'Récompense hebdomadaire rare.',secret:true,cond:'Obtenir une mission hebdo rare',unlock:p=>!!p?.emojiUnlocks?.rare_unicorn},
  {key:'rare_phoenix',emoji:'🐦‍🔥',label:'Phénix',desc:'Récompense légendaire de saison.',secret:true,cond:'Débloquer un palier de saison rare',unlock:p=>!!p?.emojiUnlocks?.rare_phoenix},
  {key:'roulette_clover',emoji:'🍀',label:'Trèfle chanceux',desc:'Récompense exclusive gagnée à la roulette.',secret:true,cond:'Gagner le trèfle via la roulette premium',unlock:p=>!!p?.emojiUnlocks?.roulette_clover},
  {key:'roulette_joker',emoji:'🃏',label:'Joker VIP',desc:'Cosmétique rare réservé au casino NeoPoly.',secret:true,cond:'Gagner le joker via la roulette premium',unlock:p=>!!p?.emojiUnlocks?.roulette_joker},
  {key:'roulette_comet',emoji:'☄️',label:'Comète secrète',desc:'Récompense ultra rare de la roue du casino.',secret:true,cond:'Tomber sur le jackpot secret du casino',unlock:p=>!!p?.emojiUnlocks?.roulette_comet},
  {key:'season_saturn',emoji:'🪐',label:'Saturne mystique',desc:'Récompense secrète liée aux quêtes et saisons avancées.',secret:true,cond:'Obtenir le Sceau Nebula',unlock:p=>!!p?.emojiUnlocks?.season_saturn}
];
const COLORS=['#67f7d7','#8aa1ff','#ff9b74','#ff647c','#d36bff','#ffd166'];

// ═══════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════
const G={
  players:[],board:[],cur:0,started:false,rolled:false,
  doublesCount:0,pendingBuy:null,jailTurns:{},
  txns:[],undoStack:[],
  ws:null,wsOk:false,room:'',mode:'local',myId:null,
  myReady:false,
  pendingPartyBots:[],
  startingMoney:1500,
  passGoBonus:200,
  jailFine:50,
  maxTurns:0,
  goalMoney:0,
  dominationTarget:0,
  globalTimerSec:0,
  globalTimerLeft:0,
  globalTimerTick:null,
  inflationEnabled:false,
  inflationRate:2,
  taxVarianceEnabled:false,
  bonusTurnEnabled:false,
  bonusTurnChance:12,
  bonusTurns:{},
  parkingPotEnabled:false,
  parkingPot:0,
  roulette:{enabled:true,startingCoins:5,totalPot:0,bets:{},history:[]},
  pendingRollBoostFor:null,
  botActionTimer:null,
  turnCount:1,
  gameZoom:100,
  centerDiceScale:130,
  pawnScale:60,
  pawnGlow:true,
  streamerMode:false,
  musicEnabled:true,
  musicSource:'default',
  musicThemeVariant:'aurora',
  daTheme:'aurora',
  soundMuted:false,
  musicVolume:45,
  musicBoostEnabled:false,
  musicBoostPercent:130,
  sfxVolume:55,
  visualFxEnabled:true,
  timerTick:null,timerEnabled:false,timerDuration:60,
  toastMs:4000,
  autoEnd:true,
  centerActions:false,
  centerActionsPos:null,
  centerActionsScale:100,
  secretObjective:null,
  turnHistory:[],
  pendingRematch:false,
  rematchStarterIndex:0,
  rematchCount:0,
  lastWinnerId:null,
  boardEvent:null,
  lastBoardEventTurn:0,
  teamMode:false,
  teamModePreset:'off',
  teamModeFormat:'off',
  startDraftMode:'off',
  worldEventMode:'normal',
  survivalMode:'off',
  bossBotMode:'off',
  specialPowersMode:'normal',
  rematchMode:'standard',
  matchQuestMode:'secret',
  fogMode:'off',
  tutorialHintsEnabled:true,
  endTurnSummaryEnabled:true,
  gameLogEntries:[],
  gameLogFilter:'all',
  historyFilter:'all',
  txnFilter:'all',
  wsLogEntries:[],
  inGameChatEntries:[],
  lastTurnSummary:null,
};
const NET_TRADE={
  outgoing:{},
  incoming:null,
  incomingTimer:null,
  timeoutMs:30000,
};

const ROULETTE_SPIN_COST=8;
const ROULETTE_LOBBY_STARTING_BALANCE=0;
const CASINO_SHOP_ITEMS=[
  {id:'boost_crate',icon:'⚡',name:'Pack Turbo',price:14,desc:'2 boosters de dé persistants.',reward:{type:'diceBoost',qty:2}},
  {id:'escape_pass',icon:'🛡️',name:'Pack Évasion',price:16,desc:'2 anti-prison permanents.',reward:{type:'antiJail',qty:2}},
  {id:'finance_kit',icon:'🏦',name:'Kit Financier',price:18,desc:'2 remises hypothèque persistantes.',reward:{type:'mortgageDiscount',qty:2}},
  {id:'clover_ticket',icon:'🍀',name:'Ticket Trèfle',price:42,desc:'Débloque l’emoji Trèfle chanceux.',reward:{type:'unlockEmoji',key:'roulette_clover',fallback:{type:'diceBoost',qty:1}}},
  {id:'casino_badge',icon:'🎖️',name:'Badge Casino',price:58,desc:'Débloque le titre Favori du casino.',reward:{type:'unlockTitle',key:'casino_lucky',fallback:{type:'rouletteCoins',qty:10}}},
];

function getDefaultRouletteState(){
  return {
    enabled:true,
    totalPot:0,
    bets:{},
    history:[],
    spinCost:ROULETTE_SPIN_COST,
    pendingPayouts:{},
    settlementId:0,
    lastReward:null,
    lastSpinAt:0,
    displayRotation:0,
    isSpinning:false,
    pendingRewardPreview:null,
    secretFxActive:false,
    secretFxLabel:'',
    secretFxUntil:0,
  };
}

function ensureRouletteState(){
  if(!G.roulette||typeof G.roulette!=='object')G.roulette=getDefaultRouletteState();
  G.roulette.enabled=G.roulette.enabled!==false;
  G.roulette.totalPot=Math.max(0,parseInt(G.roulette.totalPot,10)||0);
  G.roulette.spinCost=Math.max(1,parseInt(G.roulette.spinCost,10)||ROULETTE_SPIN_COST);
  if(!G.roulette.bets||typeof G.roulette.bets!=='object')G.roulette.bets={};
  if(!G.roulette.pendingPayouts||typeof G.roulette.pendingPayouts!=='object')G.roulette.pendingPayouts={};
  G.roulette.settlementId=Math.max(0,parseInt(G.roulette.settlementId,10)||0);
  G.roulette.lastSpinAt=Math.max(0,parseInt(G.roulette.lastSpinAt,10)||0);
  G.roulette.displayRotation=Number.isFinite(Number(G.roulette.displayRotation))?Number(G.roulette.displayRotation):0;
  G.roulette.isSpinning=!!G.roulette.isSpinning;
  G.roulette.pendingRewardPreview=G.roulette.pendingRewardPreview||null;
  G.roulette.secretFxActive=!!G.roulette.secretFxActive;
  G.roulette.secretFxLabel=String(G.roulette.secretFxLabel||'');
  G.roulette.secretFxUntil=Math.max(0,parseInt(G.roulette.secretFxUntil,10)||0);
  if(G.roulette.secretFxUntil&&G.roulette.secretFxUntil<Date.now()){
    G.roulette.secretFxActive=false;
    G.roulette.secretFxLabel='';
    G.roulette.secretFxUntil=0;
  }
  if(!Array.isArray(G.roulette.history))G.roulette.history=[];
  return G.roulette;
}

function ensureProfileRouletteData(){
  if(!P||typeof P!=='object')return {rouletteCoins:0,rouletteSpinCount:0,lastRouletteSettlementId:0,lastRouletteFreeSpinDate:''};
  const parsedRouletteCoins=parseInt(P.rouletteCoins,10);
  P.rouletteCoins=Number.isFinite(parsedRouletteCoins)?Math.max(0,parsedRouletteCoins):ROULETTE_LOBBY_STARTING_BALANCE;
  P.rouletteSpinCount=Math.max(0,parseInt(P.rouletteSpinCount,10)||0);
  P.lastRouletteSettlementId=Math.max(0,parseInt(P.lastRouletteSettlementId,10)||0);
  P.lastRouletteFreeSpinDate=String(P.lastRouletteFreeSpinDate||'');
  return P;
}

function hasRouletteFreeSpinAvailable(){
  ensureProfileRouletteData();
  return String(P.lastRouletteFreeSpinDate||'')!==getFranceTodayKey();
}

function getRouletteFreeSpinResetMs(){
  const now=new Date();
  const franceNow=getTimeZoneDateParts(now,'Europe/Paris');
  const elapsedMs=((Math.max(0,franceNow.hour)*3600)+(Math.max(0,franceNow.minute)*60)+Math.max(0,franceNow.second))*1000+now.getMilliseconds();
  return Math.max(0,(86400000-elapsedMs)%86400000);
}

function getRouletteFreeSpinCountdownLabel(){
  const totalMs=getRouletteFreeSpinResetMs();
  const totalSec=Math.max(0,Math.ceil(totalMs/1000));
  const hours=Math.floor(totalSec/3600);
  const minutes=Math.floor((totalSec%3600)/60);
  const seconds=totalSec%60;
  return String(hours).padStart(2,'0')+':'+String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0');
}

function ensureRouletteCountdownTicker(){
  if(typeof window==='undefined')return;
  if(window.__rouletteCountdownTimer)return;
  window.__rouletteCountdownTimer=setInterval(()=>{
    const el=document.getElementById('roulette-free-spin-countdown');
    if(!el)return;
    el.textContent=hasRouletteFreeSpinAvailable()?'Disponible maintenant':getRouletteFreeSpinCountdownLabel();
  },1000);
}

function ensureRoulettePlayerData(player){
  return player&&typeof player==='object'?player:null;
}

function getRouletteSpinCost(){
  return Math.max(1,parseInt(ensureRouletteState().spinCost,10)||ROULETTE_SPIN_COST);
}

function getProfileBettingPlayer(){
  const players=Array.isArray(G.players)?G.players:[];
  const controlled=players.find(p=>p&&!p.bot&&!p.disconnected&&typeof isProfileControlledPlayer==='function'&&isProfileControlledPlayer(p));
  return controlled||players.find(p=>p&&!p.bot&&!p.bust&&!p.disconnected)||players.find(p=>p&&!p.disconnected)||players[0]||null;
}

function getRouletteBetForPlayer(playerId){
  if(!playerId)return null;
  const roulette=ensureRouletteState();
  const bet=roulette.bets[playerId];
  return bet&&typeof bet==='object'?bet:null;
}

function resetRouletteForNewMatch(){
  const roulette=ensureRouletteState();
  roulette.totalPot=0;
  roulette.bets={};
  roulette.pendingPayouts={};
  roulette.lastReward=null;
  roulette.secretFxActive=false;
  roulette.secretFxLabel='';
  roulette.secretFxUntil=0;
}

function pushRouletteHistory(entry){
  const roulette=ensureRouletteState();
  roulette.history.unshift(String(entry||''));
  if(roulette.history.length>12)roulette.history.length=12;
}

function addRouletteCoins(amount,reason='',opts){
  const options=opts&&typeof opts==='object'?opts:{};
  ensureProfileRouletteData();
  const delta=parseInt(amount,10)||0;
  if(!delta)return false;
  P.rouletteCoins=Math.max(0,(parseInt(P.rouletteCoins,10)||0)+delta);
  if(!options.silent){
    const msg='🪙 '+(delta>0?'+':'')+delta+' jeton'+(Math.abs(delta)>1?'s':'')+(reason?' • '+reason:'');
    pushRouletteHistory(msg);
    toast(msg,delta>0?'a':'i');
    if(typeof glog==='function')glog(msg,delta>0?'a':'i');
  }
  if(!options.skipSave)saveProfileData?.();
  if(!options.skipRender){
    renderRoulettePanel?.();
    if(typeof renderLobbyProfileTab==='function')setTimeout(()=>renderLobbyProfileTab(),0);
  }
  return true;
}

function spendRouletteCoins(amount,reason='',opts){
  const options=opts&&typeof opts==='object'?opts:{};
  ensureProfileRouletteData();
  const cost=Math.max(0,parseInt(amount,10)||0);
  if(!cost)return true;
  if((parseInt(P.rouletteCoins,10)||0)<cost)return false;
  P.rouletteCoins=Math.max(0,(parseInt(P.rouletteCoins,10)||0)-cost);
  if(!options.silent){
    const msg='💸 -'+cost+' jeton'+(cost>1?'s':'')+(reason?' • '+reason:'');
    pushRouletteHistory(msg);
    toast(msg,'i');
    if(typeof glog==='function')glog(msg,'i');
  }
  if(!options.skipSave)saveProfileData?.();
  if(!options.skipRender){
    renderRoulettePanel?.();
    if(typeof renderLobbyProfileTab==='function')setTimeout(()=>renderLobbyProfileTab(),0);
  }
  return true;
}

function syncPendingRoulettePayouts(){
  const roulette=ensureRouletteState();
  ensureProfileRouletteData();
  const settlementId=Math.max(0,parseInt(roulette.settlementId,10)||0);
  if(!settlementId||P.lastRouletteSettlementId>=settlementId)return false;
  const bettor=getProfileBettingPlayer();
  const gain=bettor?Math.max(0,parseInt(roulette.pendingPayouts?.[bettor.id],10)||0):0;
  P.lastRouletteSettlementId=settlementId;
  if(gain>0){
    P.rouletteCoins=Math.max(0,(parseInt(P.rouletteCoins,10)||0)+gain);
    toast('🪙 Pari gagnant : +'+gain+' jetons casino','a');
  }
  saveProfileData?.();
  return gain>0;
}

function applyRouletteCosmeticReward(reward){
  if(!reward||!reward.type)return false;
  if(reward.type==='unlockEmoji'){
    if(!P.emojiUnlocks||typeof P.emojiUnlocks!=='object')P.emojiUnlocks={};
    if(P.emojiUnlocks[reward.key])return reward.fallback?applyRouletteSpinReward(reward.fallback):false;
    P.emojiUnlocks[reward.key]=Date.now();
    renderPartyEmojiPickers?.();
    return true;
  }
  if(reward.type==='unlockTitle'){
    if(!Array.isArray(P.titles))P.titles=[];
    if(P.titles.includes(reward.key))return reward.fallback?applyRouletteSpinReward(reward.fallback):false;
    P.titles.push(reward.key);
    ensureTitleMeta?.(reward.key);
    showTitleDot?.();
    renderTitleSelector?.();
    return true;
  }
  return false;
}

function applySecretRouletteReward(){
  const secretBag=[
    {icon:'☄️',label:'Comète secrète',type:'unlockEmoji',key:'roulette_comet',fallback:{type:'rouletteCoins',qty:18}},
    {icon:'👑',label:'Titre High Roller',type:'unlockTitle',key:'casino_highroller',fallback:{type:'rouletteCoins',qty:16}},
    {icon:'🔮',label:'Oracle du jackpot',type:'unlockTitle',key:'casino_oracle',fallback:{type:'rouletteCoins',qty:20}},
    {icon:'✨',label:'Jackpot Mirage',type:'unlockSecret',key:'fx_jackpot',fallback:{type:'rouletteCoins',qty:22}},
    {icon:'🌠',label:'Relique astrale rare',type:'rareReward',key:'starlight_chip',fallback:{type:'rouletteCoins',qty:24}},
    {icon:'🪐',label:'Sceau Nebula',type:'rareReward',key:'season_sigil',fallback:{type:'seasonXp',qty:120}},
    {icon:'🎁',label:'Coffre bonus x3',type:'diceBoost',qty:3},
    {icon:'🪙',label:'Jackpot secret +25 jetons',type:'rouletteCoins',qty:25}
  ];
  const pick=secretBag[Math.floor(Math.random()*secretBag.length)]||secretBag[0];
  const ok=applyRouletteSpinReward(pick);
  if(!ok)return null;
  return pick;
}

function applyRouletteSpinReward(reward){
  if(!reward||!reward.type)return false;
  if(reward.type==='secretRandom'){
    return !!applySecretRouletteReward();
  }
  if(reward.type==='rouletteCoins'){
    ensureProfileRouletteData();
    P.rouletteCoins=Math.max(0,(parseInt(P.rouletteCoins,10)||0)+Math.max(1,parseInt(reward.qty,10)||1));
    return true;
  }
  if(reward.type==='unlockEmoji'||reward.type==='unlockTitle')return applyRouletteCosmeticReward(reward);
  if(reward.type==='diceBoost'||reward.type==='antiJail'||reward.type==='mortgageDiscount'){
    addInventoryItem(reward.type,Math.max(1,parseInt(reward.qty,10)||1));
    return true;
  }
  return grantProfileReward({type:reward.type,qty:reward.qty,key:reward.key,fallback:reward.fallback});
}

function isRouletteSecretReward(reward){
  if(!reward||!reward.type)return false;
  if(reward.secretFx)return true;
  if(reward.type==='secretRandom'||reward.type==='unlockSecret')return true;
  if(reward.type==='rareReward')return ['starlight_chip','season_sigil'].includes(String(reward.key||''));
  if(reward.type==='unlockEmoji')return ['roulette_comet'].includes(String(reward.key||''));
  if(reward.type==='unlockTitle')return ['casino_highroller','casino_oracle'].includes(String(reward.key||''));
  return false;
}

function triggerRouletteSecretCelebration(reward){
  const roulette=ensureRouletteState();
  roulette.secretFxActive=true;
  roulette.secretFxLabel=String(reward?.label||'Jackpot secret');
  roulette.secretFxUntil=Date.now()+4200;
  if(triggerRouletteSecretCelebration._timer)clearTimeout(triggerRouletteSecretCelebration._timer);
  triggerRouletteSecretCelebration._timer=setTimeout(()=>{
    const state=ensureRouletteState();
    state.secretFxActive=false;
    state.secretFxLabel='';
    state.secretFxUntil=0;
    renderRoulettePanel?.();
  },4200);
}

function buildRouletteRewardPool(){
  return [
    {icon:'🪙',label:'+4 jetons casino',type:'rouletteCoins',qty:4,weight:24,legendKey:'coins',legendLabel:'🟡 Jetons',colorA:'#ffd84f',colorB:'#f2b400',badgeBg:'radial-gradient(circle at 30% 30%,#fff4c6 0%,#ffd84f 52%,#8d5200 100%)',badgeBorder:'rgba(255,216,79,.72)',badgeColor:'#3a2200'},
    {icon:'💰',label:'+7 jetons casino',type:'rouletteCoins',qty:7,weight:16,legendKey:'coins',legendLabel:'🟡 Jetons',colorA:'#ffd84f',colorB:'#f2b400',badgeBg:'radial-gradient(circle at 30% 30%,#fff4c6 0%,#ffd84f 52%,#8d5200 100%)',badgeBorder:'rgba(255,216,79,.72)',badgeColor:'#3a2200'},
    {icon:'💎',label:'Jackpot +14 jetons',type:'rouletteCoins',qty:14,weight:7,legendKey:'coins',legendLabel:'🟡 Jetons',colorA:'#ffd84f',colorB:'#f2b400',badgeBg:'radial-gradient(circle at 30% 30%,#fff4c6 0%,#ffd84f 52%,#8d5200 100%)',badgeBorder:'rgba(255,216,79,.72)',badgeColor:'#3a2200'},
    {icon:'🪐',label:'+70 XP saison',type:'seasonXp',qty:70,weight:7,legendKey:'secret',legendLabel:'🟣 Saison / secrets',colorA:'#a986ff',colorB:'#7758ff',badgeBg:'radial-gradient(circle at 30% 30%,#f1eaff 0%,#b18cff 48%,#32208f 100%)',badgeBorder:'rgba(177,140,255,.68)',badgeColor:'#fffaff'},
    {icon:'⚡',label:'Booster de dé',type:'diceBoost',qty:1,weight:12,legendKey:'boost',legendLabel:'🟠 Boosts / titres',colorA:'#ffb06a',colorB:'#ff7b24',badgeBg:'radial-gradient(circle at 30% 30%,#fff1db 0%,#ffbf69 50%,#914407 100%)',badgeBorder:'rgba(255,191,105,.7)',badgeColor:'#391c03'},
    {icon:'🛡️',label:'Anti-prison',type:'antiJail',qty:1,weight:9,legendKey:'shield',legendLabel:'🔵 Protection / banque',colorA:'#78dcff',colorB:'#3a82ff',badgeBg:'radial-gradient(circle at 30% 30%,#ebf9ff 0%,#79dbff 48%,#163f92 100%)',badgeBorder:'rgba(121,219,255,.7)',badgeColor:'#f8fcff'},
    {icon:'🏦',label:'Remise hypothèque',type:'mortgageDiscount',qty:1,weight:9,legendKey:'shield',legendLabel:'🔵 Protection / banque',colorA:'#78dcff',colorB:'#3a82ff',badgeBg:'radial-gradient(circle at 30% 30%,#ebf9ff 0%,#79dbff 48%,#163f92 100%)',badgeBorder:'rgba(121,219,255,.7)',badgeColor:'#f8fcff'},
    {icon:'🌠',label:'Relique astrale',type:'rareReward',key:'starlight_chip',weight:2,fallback:{type:'rouletteCoins',qty:14},legendKey:'secret',legendLabel:'🟣 Saison / secrets',colorA:'#a986ff',colorB:'#7758ff',badgeBg:'radial-gradient(circle at 30% 30%,#f2f7ff 0%,#8bc3ff 35%,#7b4dff 100%)',badgeBorder:'rgba(160,92,255,.74)',badgeColor:'#ffffff'},
    {icon:'🍀',label:'Emoji Trèfle chanceux',type:'unlockEmoji',key:'roulette_clover',weight:5,fallback:{type:'rouletteCoins',qty:6},legendKey:'luck',legendLabel:'🟢 Chance / emoji',colorA:'#b9ef6d',colorB:'#49c96f',badgeBg:'radial-gradient(circle at 30% 30%,#f3ffe5 0%,#b5f06b 50%,#28784a 100%)',badgeBorder:'rgba(181,240,107,.72)',badgeColor:'#103221'},
    {icon:'🃏',label:'Emoji Joker VIP',type:'unlockEmoji',key:'roulette_joker',weight:3,fallback:{type:'rouletteCoins',qty:8},legendKey:'secret',legendLabel:'🟣 Saison / secrets',colorA:'#a986ff',colorB:'#7758ff',badgeBg:'radial-gradient(circle at 30% 30%,#ffeaff 0%,#ff93d8 42%,#6b27a1 100%)',badgeBorder:'rgba(255,147,216,.74)',badgeColor:'#fffaff'},
    {icon:'🎖️',label:'Titre Favori du casino',type:'unlockTitle',key:'casino_lucky',weight:4,fallback:{type:'rouletteCoins',qty:9},legendKey:'boost',legendLabel:'🟠 Boosts / titres',colorA:'#ffb06a',colorB:'#ff7b24',badgeBg:'radial-gradient(circle at 30% 30%,#fff0e2 0%,#ffb47e 46%,#ad4532 100%)',badgeBorder:'rgba(255,180,126,.72)',badgeColor:'#381207'},
    {icon:'👑',label:'Titre High Roller',type:'unlockTitle',key:'casino_highroller',weight:2,fallback:{type:'rouletteCoins',qty:12},legendKey:'boost',legendLabel:'🟠 Boosts / titres',colorA:'#ffb06a',colorB:'#ff7b24',badgeBg:'radial-gradient(circle at 30% 30%,#fff1e5 0%,#ffb18a 45%,#a13d24 100%)',badgeBorder:'rgba(255,177,138,.74)',badgeColor:'#fff8f2'},
    {icon:'❔',label:'Récompense secrète aléatoire',type:'secretRandom',weight:1,legendKey:'secret',legendLabel:'🟣 Saison / secrets',colorA:'#a986ff',colorB:'#7758ff',badgeBg:'radial-gradient(circle at 30% 30%,#f2eaff 0%,#ac8cff 38%,#4b2398 100%)',badgeBorder:'rgba(203,152,255,.8)',badgeColor:'#fffbff',secretFx:true}
  ];
}

function getRouletteSpinDurationMs(){
  return 3200;
}

function isCasinoShopRewardOwned(reward){
  if(!reward||!reward.type)return false;
  if(reward.type==='unlockEmoji')return !!P.emojiUnlocks?.[reward.key];
  if(reward.type==='unlockTitle')return Array.isArray(P.titles)&&P.titles.includes(reward.key);
  return false;
}

function purchaseCasinoShopItem(itemId){
  const item=(CASINO_SHOP_ITEMS||[]).find(entry=>entry&&entry.id===itemId);
  if(!item){toast('Article introuvable.','d');return;}
  const roulette=ensureRouletteState();
  ensureProfileRouletteData();
  if(roulette.isSpinning){toast('La roue est en train de tourner.','i');return;}
  const price=Math.max(0,parseInt(item.price,10)||0);
  if((parseInt(P.rouletteCoins,10)||0)<price){toast('Pas assez de jetons casino.','w');return;}
  const previousBalance=parseInt(P.rouletteCoins,10)||0;
  if(!spendRouletteCoins(price,'achat '+item.name,{silent:true,skipRender:true,skipSave:true}))return;
  const ok=applyRouletteSpinReward(item.reward);
  if(!ok){
    P.rouletteCoins=previousBalance;
    toast('Achat annulé, article indisponible.','w');
    saveProfileData?.();
    renderRoulettePanel?.();
    return;
  }
  const msg='🛍️ Achat casino : '+item.icon+' '+item.name+' pour '+price+' jetons.';
  pushRouletteHistory(msg);
  toast(msg,'a');
  if(typeof glog==='function')glog(msg,'a');
  saveProfileData?.();
  renderRoulettePanel?.();
  if(typeof renderLobbyProfileTab==='function')setTimeout(()=>renderLobbyProfileTab(),0);
}

function buildRouletteWheelGradient(pool){
  const colors=['#67f7d7','#8aa1ff','#ffd166','#d36bff','#ff9b74','#ff647c'];
  const list=Array.isArray(pool)&&pool.length?pool:buildRouletteRewardPool();
  const step=360/list.length;
  return 'conic-gradient(from -90deg,'+list.map((entry,index)=>{
    const colorA=entry.colorA||colors[index%colors.length];
    const colorB=entry.colorB||colors[(index+1)%colors.length];
    const start=(index*step).toFixed(2);
    const sep1=(index*step+0.9).toFixed(2);
    const mid=(index*step+step*0.52).toFixed(2);
    const sep2=((index+1)*step-0.9).toFixed(2);
    const end=((index+1)*step).toFixed(2);
    return 'rgba(255,255,255,.82) '+start+'deg '+sep1+'deg, '+colorA+' '+sep1+'deg '+mid+'deg, '+colorB+' '+mid+'deg '+sep2+'deg, rgba(6,10,24,.45) '+sep2+'deg '+end+'deg';
  }).join(',')+')';
}

function buildRouletteColorLegend(pool){
  const list=Array.isArray(pool)&&pool.length?pool:buildRouletteRewardPool();
  const seen=new Set();
  return list.filter(entry=>{
    const key=String(entry.legendKey||entry.icon||'');
    if(!key||seen.has(key))return false;
    seen.add(key);
    return true;
  }).map(entry=>{
    const swatch='linear-gradient(135deg,'+String(entry.colorA||'#94a3b8')+','+String(entry.colorB||'#64748b')+')';
    return '<span class="roulette-legend-item"><span class="roulette-legend-swatch" style="background:'+swatch+'"></span><b>'+escapeHtml(entry.legendLabel||entry.label)+'</b></span>';
  }).join('');
}

function buildRouletteWheelBadges(pool){
  const list=Array.isArray(pool)&&pool.length?pool:buildRouletteRewardPool();
  const step=(Math.PI*2)/list.length;
  const radius=35;
  return list.map((entry,index)=>{
    const angle=(-Math.PI/2)+(step*index)+(step/2);
    const x=(50+Math.cos(angle)*radius).toFixed(2);
    const y=(50+Math.sin(angle)*radius).toFixed(2);
    const badgeBg=entry.badgeBg||'radial-gradient(circle at 30% 30%,#ffffff 0%,#dbe7ff 48%,#334155 100%)';
    const badgeBorder=entry.badgeBorder||'rgba(255,255,255,.22)';
    const badgeColor=entry.badgeColor||'#fff';
    const secretCls=isRouletteSecretReward(entry)?' is-secret':'';
    return '<div class="roulette-wheel-badge'+secretCls+'" style="left:'+x+'%;top:'+y+'%;--roulette-badge-bg:'+badgeBg+';--roulette-badge-border:'+badgeBorder+';--roulette-badge-color:'+badgeColor+'" title="'+escapeAttr(entry.label)+'"><span>'+entry.icon+'</span></div>';
  }).join('');
}

function spinRouletteWheel(){
  const roulette=ensureRouletteState();
  ensureProfileRouletteData();
  if(G.started){
    toast('🎰 La roue se tourne hors partie. En match, utilise seulement les paris.','i');
    return;
  }
  if(roulette.isSpinning){toast('🎡 La roue tourne déjà.','i');return;}
  const cost=getRouletteSpinCost();
  const freeSpinAvailable=hasRouletteFreeSpinAvailable();
  const usedFreeSpin=freeSpinAvailable;
  if(!freeSpinAvailable&&(parseInt(P.rouletteCoins,10)||0)<cost){
    toast('Il faut '+cost+' jetons casino pour tourner la roue.','w');
    return;
  }
  const pool=buildRouletteRewardPool();
  const totalWeight=pool.reduce((sum,entry)=>sum+Math.max(1,parseInt(entry.weight,10)||1),0);
  let roll=Math.random()*totalWeight;
  let reward=pool[0];
  let rewardIndex=0;
  for(let i=0;i<pool.length;i++){
    const entry=pool[i];
    roll-=Math.max(1,parseInt(entry.weight,10)||1);
    if(roll<=0){reward=entry;rewardIndex=i;break;}
  }
  if(!usedFreeSpin&&!spendRouletteCoins(cost,'rotation de roulette',{silent:true,skipRender:true,skipSave:true}))return;
  const stepAngle=360/pool.length;
  const currentRotation=Number(roulette.displayRotation)||0;
  const landingAngle=(360-((rewardIndex*stepAngle)+(stepAngle/2)))%360;
  const finalRotation=currentRotation+(360*5)+landingAngle+(Math.random()*4-2);
  const durationMs=getRouletteSpinDurationMs();
  roulette.isSpinning=true;
  roulette.pendingRewardPreview=reward;
  renderRoulettePanel?.();
  const wheelEl=document.getElementById('roulette-wheel-disc');
  const statusEl=document.getElementById('roulette-spin-status');
  if(statusEl)statusEl.innerHTML='🎡 La roue accélère… accroche-toi !';
  if(wheelEl){
    wheelEl.classList.add('spinning');
    wheelEl.style.setProperty('--roulette-rotation',currentRotation+'deg');
    wheelEl.style.setProperty('--roulette-spin-duration',durationMs+'ms');
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        wheelEl.style.setProperty('--roulette-rotation',finalRotation+'deg');
      });
    });
  }
  if(spinRouletteWheel._timer)clearTimeout(spinRouletteWheel._timer);
  spinRouletteWheel._timer=setTimeout(()=>{
    roulette.isSpinning=false;
    roulette.displayRotation=finalRotation%360;
    roulette.pendingRewardPreview=null;
    const resolvedReward=reward.type==='secretRandom'?(applySecretRouletteReward()||reward):reward;
    const applied=reward.type==='secretRandom'?!!resolvedReward:applyRouletteSpinReward(resolvedReward);
    if(!applied){
      if(!usedFreeSpin)P.rouletteCoins=Math.max(0,(parseInt(P.rouletteCoins,10)||0)+cost);
      toast('Récompense indisponible, coût remboursé.','w');
      saveProfileData?.();
      renderRoulettePanel?.();
      return;
    }
    P.rouletteSpinCount=Math.max(0,(parseInt(P.rouletteSpinCount,10)||0)+1);
    if(usedFreeSpin)P.lastRouletteFreeSpinDate=getFranceTodayKey();
    roulette.lastSpinAt=Date.now();
    roulette.lastReward={label:resolvedReward.label,icon:resolvedReward.icon,at:roulette.lastSpinAt};
    const isSecretHit=isRouletteSecretReward(resolvedReward)||reward.type==='secretRandom';
    if(isSecretHit)triggerRouletteSecretCelebration(resolvedReward);
    const secretPrefix=isSecretHit?'🌌 Secret ! ':'';
    const msg=secretPrefix+'🎰 Roulette : '+resolvedReward.icon+' '+resolvedReward.label+' remporté '+(usedFreeSpin?'grâce au tour gratuit du jour':'pour '+cost+' jetons')+'.';
    pushRouletteHistory(msg);
    toast(msg,'a');
    if(typeof glog==='function')glog(msg,'a');
    saveProfileData?.();
    renderRoulettePanel?.();
    if(typeof renderLobbyProfileTab==='function')setTimeout(()=>renderLobbyProfileTab(),0);
  },durationMs+80);
}

function placeRouletteBet(){
  const roulette=ensureRouletteState();
  ensureProfileRouletteData();
  if(!G.started){toast('Les paris s’ouvrent uniquement pendant une partie.','w');return;}
  const bettor=getProfileBettingPlayer();
  if(isPlayerUnavailable(bettor)){toast('Aucun joueur de ton profil ne peut miser pour l’instant.','w');return;}
  const targetId=document.getElementById('roulette-target')?.value||'';
  const target=G.players.find(p=>p&&p.id===targetId&&!p.bust&&!p.disconnected);
  if(!target){toast('Choisis un joueur valide.','w');return;}
  const amount=Math.max(0,parseInt(document.getElementById('roulette-stake')?.value,10)||0);
  if(amount<=0){toast('Entre une mise supérieure à 0.','w');return;}
  if(amount>(parseInt(P.rouletteCoins,10)||0)){toast('Pas assez de jetons casino.','w');return;}
  const existing=getRouletteBetForPlayer(bettor.id);
  if(existing&&existing.targetId&&existing.targetId!==target.id&&existing.amount>0){
    const lockedName=G.players.find(p=>p.id===existing.targetId)?.name||existing.targetName||'ce joueur';
    toast('Ton pari soutient déjà '+lockedName+'.','w');
    return;
  }
  if(!spendRouletteCoins(amount,'pari sur '+target.name,{silent:true,skipRender:true,skipSave:true}))return;
  roulette.bets[bettor.id]={targetId:target.id,targetName:target.name,amount:(parseInt(existing?.amount,10)||0)+amount};
  roulette.totalPot=Math.max(0,(roulette.totalPot||0)+amount);
  const msg='🎯 '+bettor.name+' mise '+amount+' jeton'+(amount>1?'s':'')+' sur '+target.name+'.';
  pushRouletteHistory(msg);
  if(typeof glog==='function')glog(msg,'i');
  toast(msg,'a');
  saveProfileData?.();
  renderRoulettePanel?.();
  renderPlayers?.();
  broadcast?.();
}

function resolveRouletteBets(winner){
  const roulette=ensureRouletteState();
  const pot=Math.max(0,parseInt(roulette.totalPot,10)||0);
  const entries=Object.entries(roulette.bets||{}).map(([bettorId,bet])=>({bettorId,bet})).filter(entry=>entry.bet&&parseInt(entry.bet.amount,10)>0);
  roulette.pendingPayouts={};
  roulette.settlementId=Date.now();
  if(!entries.length||pot<=0){
    roulette.totalPot=0;
    roulette.bets={};
    renderRoulettePanel?.();
    return;
  }
  const winningEntries=winner?entries.filter(entry=>{
    if(entry.bet.targetId===winner.id)return true;
    if(G.teamMode&&winner.teamId){
      const target=G.players.find(p=>p&&p.id===entry.bet.targetId);
      return !!(target&&target.teamId&&target.teamId===winner.teamId);
    }
    return false;
  }):[];
  if(!winningEntries.length){
    const msg=winner
      ?('🎰 Aucun pari gagnant sur '+winner.name+' — le pot de '+pot+' jetons est perdu.')
      :('🎰 Égalité : le pot de '+pot+' jetons n’est attribué à personne.');
    pushRouletteHistory(msg);
    if(typeof glog==='function')glog(msg,'w');
    toast(msg,'w');
    roulette.totalPot=0;
    roulette.bets={};
    renderRoulettePanel?.();
    renderPlayers?.();
    return;
  }
  const totalWinningStake=winningEntries.reduce((sum,entry)=>sum+(parseInt(entry.bet.amount,10)||0),0);
  let distributed=0;
  const payouts=[];
  winningEntries.forEach((entry,index)=>{
    const bettor=G.players.find(p=>p&&p.id===entry.bettorId);
    if(!bettor)return;
    const stake=parseInt(entry.bet.amount,10)||0;
    let gain=index===winningEntries.length-1?(pot-distributed):Math.floor((pot*stake)/Math.max(1,totalWinningStake));
    gain=Math.max(0,gain);
    distributed+=gain;
    roulette.pendingPayouts[bettor.id]=(roulette.pendingPayouts[bettor.id]||0)+gain;
    payouts.push(bettor.name+' +'+gain);
  });
  const msg='🏆 Paris résolus : '+payouts.join(', ')+' récupèrent le pot de '+pot+' jetons.';
  pushRouletteHistory(msg);
  if(typeof glog==='function')glog(msg,'a');
  toast(msg,'a');
  roulette.totalPot=0;
  roulette.bets={};
  syncPendingRoulettePayouts();
  renderRoulettePanel?.();
  renderPlayers?.();
}

function renderRoulettePanel(){
  const inlineEl=document.getElementById('roulette-lobby-card')||document.getElementById('roulette-inline-panel');
  const bodyEl=document.getElementById('roulette-body');
  if(!inlineEl&&!bodyEl)return;
  const roulette=ensureRouletteState();
  ensureProfileRouletteData();
  syncPendingRoulettePayouts();
  const balance=Math.max(0,parseInt(P.rouletteCoins,10)||0);
  const spinCost=getRouletteSpinCost();
  const freeSpinAvailable=hasRouletteFreeSpinAvailable();
  const freeSpinCountdown=freeSpinAvailable?'Disponible maintenant':getRouletteFreeSpinCountdownLabel();
  const pool=buildRouletteRewardPool();
  const rewardPreview=pool.map(entry=>{
    const chipBg='linear-gradient(135deg,'+String(entry.colorA||'#94a3b8')+'33,'+String(entry.colorB||'#64748b')+'26)';
    const chipBorder=String(entry.badgeBorder||'rgba(148,163,184,.24)');
    return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:999px;background:'+chipBg+';border:1px solid '+chipBorder+';font-size:.66rem;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)">'+entry.icon+' '+escapeHtml(entry.label)+'</span>';
  }).join('');
  const legendHtml=buildRouletteColorLegend(pool);
  const wheelGradient=buildRouletteWheelGradient(pool);
  const wheelBadges=buildRouletteWheelBadges(pool);
  const bettor=getProfileBettingPlayer();
  const currentBet=bettor?getRouletteBetForPlayer(bettor.id):null;
  const selectedTarget=document.getElementById('roulette-target')?.value||(currentBet?.targetId)||G.players.find(p=>p&&!p.bust&&!p.disconnected)?.id||'';
  const betsList=Object.entries(roulette.bets||{}).map(([bettorId,bet])=>{
    const bettorObj=G.players.find(p=>p&&p.id===bettorId);
    const target=G.players.find(p=>p&&p.id===bet.targetId);
    if(!bettorObj||!target||!(parseInt(bet.amount,10)>0))return '';
    return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:.72rem;padding:4px 0;border-bottom:1px solid rgba(148,163,184,.08)"><span>'+escapeHtml(bettorObj.emoji+' '+bettorObj.name)+'</span><span style="color:var(--accent)">🎯 '+escapeHtml(target.name)+' • '+bet.amount+'🎟️</span></div>';
  }).filter(Boolean).join('')||'<div style="font-size:.72rem;color:var(--muted)">Aucun pari enregistré pour le moment.</div>';
  const historyHtml=(roulette.history||[]).length
    ?roulette.history.map(item=>'<div style="font-size:.68rem;color:var(--muted)">• '+escapeHtml(item)+'</div>').join('')
    :'<div style="font-size:.68rem;color:var(--muted)">Aucun tirage ou pari récent.</div>';
  const shopHtml=CASINO_SHOP_ITEMS.map(item=>{
    const affordable=balance>=item.price;
    const owned=isCasinoShopRewardOwned(item.reward);
    return '<div class="casino-shop-item'+(affordable?'':' is-locked')+'">'+
      '<div class="casino-shop-top">'+
        '<div class="casino-shop-icon">'+item.icon+'</div>'+
        '<div><div class="casino-shop-name">'+escapeHtml(item.name)+'</div><div class="casino-shop-desc">'+escapeHtml(item.desc)+(owned?' Déjà obtenu: achat = lot alternatif.':'')+'</div></div>'+
      '</div>'+
      '<div class="casino-shop-bottom">'+
        '<span class="casino-shop-price">'+item.price+' 🎟️</span>'+
        '<button class="btn btn-sm '+(affordable?'btn-yellow':'btn-secondary')+'" type="button" '+(affordable?'':'disabled')+' onclick="purchaseCasinoShopItem(\''+item.id+'\')">Acheter</button>'+
      '</div>'+
    '</div>';
  }).join('');
  const lastRewardLabel=roulette.lastReward?(roulette.lastReward.icon+' '+roulette.lastReward.label):'Aucun gain récent';
  const secretFxActive=!!roulette.secretFxActive&&((parseInt(roulette.secretFxUntil,10)||0)>Date.now());
  const secretOverlayHtml=secretFxActive?`
              <div class="roulette-secret-overlay" aria-hidden="true">
                <div class="roulette-secret-rays"></div>
                <div class="roulette-secret-ring ring-a"></div>
                <div class="roulette-secret-ring ring-b"></div>
                ${Array.from({length:10},(_,index)=>`<span class="roulette-secret-particle p${(index%5)+1}" style="--secret-angle:${index*36}deg;--secret-delay:${(index*0.08).toFixed(2)}s">✦</span>`).join('')}
                <div class="roulette-secret-banner">🌌 JACKPOT SECRET<div>${escapeHtml(roulette.secretFxLabel||'Récompense cachée')}</div></div>
              </div>`:'';

  if(inlineEl){
    inlineEl.innerHTML=''+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">'+
        '<div><div class="card-title" style="margin:0">🎰 Casino NeoPoly</div><div style="font-size:.68rem;color:var(--muted)">Solde: <b style="color:var(--accent)">'+balance+' jetons</b> • '+(freeSpinAvailable?'🎁 1 tour gratuit/jour (00:00 Paris)':'Coût: '+spinCost+' / tour')+'</div></div>'+
        '<button class="btn btn-yellow btn-sm" type="button" onclick="openRouletteModal()">Ouvrir</button>'+
      '</div>'+
      '<div style="margin-top:8px;font-size:.7rem;color:var(--muted)">Tourne la roue avec une vraie animation et dépense tes jetons dans la boutique casino.</div>';
  }

  if(bodyEl){
    ensureRouletteCountdownTicker();
    const spinDisabled=(G.started||(!freeSpinAvailable&&balance<spinCost)||roulette.isSpinning)?'disabled':'';
    const spinState=roulette.isSpinning
      ?('🎡 La roue tourne... récompense en approche !')
      :(secretFxActive
        ?('🌌 <b style="color:var(--yellow)">Jackpot secret :</b> '+escapeHtml(roulette.secretFxLabel||'Récompense cachée')+' !')
        :(G.started
          ?'La roue premium se tourne uniquement hors partie.'
          :(freeSpinAvailable
            ?'🎁 Ton tour gratuit du jour est disponible pour ce compte.'
            :('Chaque rotation coûte <b style="color:var(--accent)">'+spinCost+' jetons</b>.'))));
    const betState=G.started
      ?('<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">'+
          '<div style="flex:1;min-width:160px"><label style="display:block;font-size:.68rem;color:var(--muted);margin-bottom:4px">Joueur visé</label><select id="roulette-target" style="width:100%">'+
            G.players.filter(p=>p&&!p.bust&&!p.disconnected).map(p=>'<option value="'+p.id+'" '+(selectedTarget===p.id?'selected':'')+'>'+escapeHtml(p.emoji+' '+p.name)+'</option>').join('')+
          '</select></div>'+
          '<div style="width:110px"><label style="display:block;font-size:.68rem;color:var(--muted);margin-bottom:4px">Mise</label><input id="roulette-stake" type="number" min="1" max="999" value="1" style="width:100%"/></div>'+
          '<button class="btn btn-primary btn-sm" type="button" onclick="placeRouletteBet()">🎯 Miser</button>'+
        '</div><div style="font-size:.66rem;color:var(--muted);margin-top:8px">'+(currentBet?('Ton pari actuel: <b>🎯 '+escapeHtml(currentBet.targetName||G.players.find(p=>p.id===currentBet.targetId)?.name||'?')+' x'+currentBet.amount+'</b>.'):'Tu peux miser sur le joueur que tu vois gagner.')+'</div>')
      :'<div style="font-size:.72rem;color:var(--muted)">Les paris s’ouvrent quand une partie est en cours.</div>';

    bodyEl.innerHTML=`
      <div class="casino-roulette-layout">
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="card" style="padding:10px">
            <div class="card-title">🎡 Grande roue du casino</div>
            <div class="roulette-visual-stage ${secretFxActive?'is-secret-hit':''}" id="roulette-wheel-stage">
              ${secretOverlayHtml}
              <div class="roulette-pointer"></div>
              <div class="roulette-wheel-shell">
                <div class="roulette-wheel-disc ${roulette.isSpinning?'spinning':''}" id="roulette-wheel-disc" style="--roulette-rotation:${Number(roulette.displayRotation)||0}deg;--roulette-spin-duration:${getRouletteSpinDurationMs()}ms;background:${wheelGradient}">
                  ${wheelBadges}
                </div>
                <div class="roulette-wheel-center">Neo</div>
              </div>
            </div>
            <div class="roulette-spin-status" id="roulette-spin-status">${spinState}</div>
            <div style="display:flex;justify-content:space-between;gap:8px;font-size:.74rem;margin:8px 0"><span>🎟️ Solde</span><b style="color:var(--accent)">${balance} jetons</b></div>
            <div style="display:flex;justify-content:space-between;gap:8px;font-size:.74rem;margin-bottom:10px"><span>🔄 Tours de roue</span><b>${parseInt(P.rouletteSpinCount,10)||0}</b></div>
            <div style="display:flex;justify-content:space-between;gap:8px;font-size:.74rem;margin-bottom:6px"><span>🎁 Tour gratuit</span><b>${freeSpinAvailable?'Disponible':'Déjà utilisé'}</b></div>
            <div style="display:flex;justify-content:space-between;gap:8px;font-size:.72rem;margin-bottom:10px"><span>⏳ Reset 00:00 Paris</span><b id="roulette-free-spin-countdown">${freeSpinCountdown}</b></div>
            <div style="font-size:.66rem;color:var(--muted);margin-bottom:10px">Dernier gain : <b>${escapeHtml(lastRewardLabel)}</b></div>
            <button class="btn btn-yellow" type="button" onclick="spinRouletteWheel()" ${spinDisabled}>${roulette.isSpinning?'🎡 En cours...':(freeSpinAvailable?'🎁 Tour gratuit du jour':'🎰 Tourner la roue ('+spinCost+')')}</button>
          </div>
          <div class="card" style="padding:10px">
            <div class="card-title">🎁 Récompenses possibles</div>
            <div class="roulette-color-legend" style="margin-top:8px">${legendHtml}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${rewardPreview}</div>
            <div style="font-size:.64rem;color:var(--muted);margin-top:8px">Repère rapide : <b>même couleur = même famille de gain</b>.</div>
          </div>
          <div class="card" style="padding:10px">
            <div class="card-title">🛍️ Boutique casino</div>
            <div class="casino-shop-grid">${shopHtml}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="card" style="padding:10px">
            <div class="card-title">💼 Infos casino</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.72rem">
              <div>🪙 Jetons dispo: <b style="color:var(--accent)">${balance}</b></div>
              <div>🏦 Pot de pari: <b>${roulette.totalPot||0}</b></div>
              <div>🎯 Paris actifs: <b>${Object.keys(roulette.bets||{}).length}</b></div>
              <div>✨ Dernier spin: <b>${roulette.lastSpinAt?new Date(roulette.lastSpinAt).toLocaleTimeString('fr-FR'):'—'}</b></div>
            </div>
          </div>
          <div class="card" style="padding:10px">
            <div class="card-title">🎯 Paris de match</div>
            ${betState}
          </div>
          <div class="card" style="padding:10px">
            <div class="card-title">📋 Paris en cours</div>
            ${betsList}
          </div>
          <div class="card" style="padding:10px">
            <div class="card-title">🕘 Historique récent</div>
            <div style="display:flex;flex-direction:column;gap:5px">${historyHtml}</div>
          </div>
        </div>
      </div>`;
  }
}

function openRouletteModal(){
  syncPendingRoulettePayouts();
  renderRoulettePanel();
  openModal('modal-roulette');
}

// ═══════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════
//  PROFILE & SOCIAL SYSTEM
// ═══════════════════════════════════════
const PROFILE_KEY='neopoly_profile_v2';
const PROFILE_SYNC_CHANNEL='neopoly_profile_sync';
const DEBUG_OWNER_IP_KEY='neopoly_debug_owner_ip_v1';
const PROFILE_SYNC_BUS=(typeof BroadcastChannel!=='undefined')?new BroadcastChannel(PROFILE_SYNC_CHANNEL):null;
let googleTokenClient=null;
let googleAccessToken=null;
let googleIdInitialized=false;
let googleCodeClient=null;
var googlePopupRejectedCount=0;
var googleLastOauthError='';
var googleBackendReachable=false;
var googleBootHealthChecked=false;
var googleServerMode='';
var googleForceRedirectOnly=false;
var googleFedCmFailureCount=0;
var googleZoneAlwaysRedirect=false;
const GOOGLE_DEBUG_LOG=[];
let connectionZoneUnlocked=false;
let connectionZoneSilentPending=false;
let connectionZoneSilentTimer=null;
let P={
  uid:null,name:'Joueur',emoji:'🎲',avatarImg:null,color:'#22c55e',
  googleEmail:null,googleName:null,googleConnected:false,googleSub:null,googleVerifiedAt:0,googleSessionToken:null,
  isAdmin:false,
  moderation:{muted:false,banned:false,reason:'',updatedAt:0},
  stats:{gamesPlayed:0,gamesWon:0,gamesLost:0,moneyEarned:0,propertiesBought:0,totalTurns:0,bankruptcies:0},
  elo:0,
  titles:[],
  titleMeta:{},
  secretUnlocks:{},
  emojiUnlocks:{},
  selectedTitle:null,
  inventory:{diceBoost:0,antiJail:0,mortgageDiscount:0},
  rouletteCoins:0,
  rouletteSpinCount:0,
  lastRouletteSettlementId:0,
  lastRouletteFreeSpinDate:'',
  dailyChallenges:{dateKey:'',streak:0,lastCompletedDate:'',items:[]},
  weeklyMissions:{weekKey:'',streak:0,lastCompletedWeek:'',items:[],fullRewarded:false},
  rareRewards:[],
  rareTokenCount:0,
  seasonData:{seasonKey:'',label:'',xp:0,score:0,claimedTiers:[],bestLeague:'',bestRankedElo:0,bestRankedLabel:'',lastDivisionRewardText:'',lastDivisionRewardAt:0,history:[]},
  mutedUsers:[],
  blockedUsers:[],
  chatProfilePrivate:false,
  lastAdminStatsResetAt:0,
  friends:[], // [{uid,name,emoji,avatarImg,color,addedAt}]
  chatLog:[]  // [{name,color,text,ts,mine,uid,admin,emoji,avatarImg}]
};

const KNOWN_ADMIN_EMAILS=new Set([
  'matprize055@gmail.com',
]);

function isKnownAdminEmail(_email){
  const email=String(_email||'').trim().toLowerCase();
  return !!email&&KNOWN_ADMIN_EMAILS.has(email);
}
function getDefaultModerationState(){
  return {muted:false,banned:false,reason:'',updatedAt:0};
}

function getGoogleBoundUid(sub){
  const raw=String(sub||'').trim();
  if(!raw)return '';
  return 'npg_'+raw.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,72);
}

function syncUidWithGoogleIdentity(silent){
  if(!(P&&P.googleConnected&&P.googleSub))return false;
  const targetUid=getGoogleBoundUid(P.googleSub);
  if(!targetUid||P.uid===targetUid)return false;
  P.uid=targetUid;
  if(!silent)toast('🔐 ID ami synchronisé avec Google','i');
  return true;
}

function isInviteOnlyAccount(){
  return !(P&&P.googleConnected);
}

function canUseAccountProgression(){
  return !isInviteOnlyAccount();
}

function canTrackProfileStatsInCurrentMatch(){
  return !!(G&&G.mode==='online');
}

function canAwardPersistentProfileProgressInCurrentMatch(){
  return canTrackProfileStatsInCurrentMatch()&&canUseAccountProgression();
}

function getInviteAccountLockText(){
  return 'Mode invité : les statistiques restent enregistrées, mais la création de partie en ligne, les défis, les titres et les gains de profil sont réservés aux comptes Google.';
}

function showInviteAccountLock(featureLabel){
  toast('🔒 '+(featureLabel||'Cette fonctionnalité')+' est réservé aux comptes Google. Les stats invitées restent conservées.','w');
  return false;
}

function loadProfile(opts){
  const options=opts&&typeof opts==='object'?opts:{};
  let changed=false;
  try{const d=JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}');Object.keys(P).forEach(k=>{if(d[k]!==undefined)P[k]=d[k];});}catch(e){}
  if(!P.inventory||typeof P.inventory!=='object')P.inventory={};
  P.inventory.diceBoost=Math.max(0,parseInt(P.inventory.diceBoost,10)||0);
  P.inventory.antiJail=Math.max(0,parseInt(P.inventory.antiJail,10)||0);
  P.inventory.mortgageDiscount=Math.max(0,parseInt(P.inventory.mortgageDiscount,10)||0);
  {
    const parsedRouletteCoins=parseInt(P.rouletteCoins,10);
    P.rouletteCoins=Number.isFinite(parsedRouletteCoins)?Math.max(0,parsedRouletteCoins):ROULETTE_LOBBY_STARTING_BALANCE;
  }
  P.rouletteSpinCount=Math.max(0,parseInt(P.rouletteSpinCount,10)||0);
  P.lastRouletteSettlementId=Math.max(0,parseInt(P.lastRouletteSettlementId,10)||0);
  P.lastRouletteFreeSpinDate=String(P.lastRouletteFreeSpinDate||'');
  if(!Array.isArray(P.titles))P.titles=[];
  if(!P.titleMeta||typeof P.titleMeta!=='object')P.titleMeta={};
  if(!P.secretUnlocks||typeof P.secretUnlocks!=='object')P.secretUnlocks={};
  if(!P.redeemedSecretCodes||typeof P.redeemedSecretCodes!=='object')P.redeemedSecretCodes={};
  if(!P.emojiUnlocks||typeof P.emojiUnlocks!=='object')P.emojiUnlocks={};
  if(typeof P.stats.gamesLost!=='number')P.stats.gamesLost=parseInt(P.stats.gamesLost,10)||0;
  if(typeof P.elo!=='number'||isNaN(P.elo))P.elo=0;
  if(!('selectedTitle' in P))P.selectedTitle=null;
  if(typeof P.isAdmin!=='boolean')P.isAdmin=false;
  P.googleSessionToken=P.googleSessionToken?String(P.googleSessionToken):null;
  if(!P.moderation||typeof P.moderation!=='object')P.moderation=getDefaultModerationState();
  P.moderation.muted=!!P.moderation.muted;
  P.moderation.banned=!!P.moderation.banned;
  P.moderation.reason=String(P.moderation.reason||'');
  P.moderation.updatedAt=parseInt(P.moderation.updatedAt,10)||0;
  if(!Array.isArray(P.friends))P.friends=[];
  if(!Array.isArray(P.mutedUsers))P.mutedUsers=[];
  if(!Array.isArray(P.blockedUsers))P.blockedUsers=[];
  if(!P.dailyChallenges||typeof P.dailyChallenges!=='object')P.dailyChallenges={dateKey:'',streak:0,lastCompletedDate:'',items:[]};
  if(!P.weeklyMissions||typeof P.weeklyMissions!=='object')P.weeklyMissions={weekKey:'',streak:0,lastCompletedWeek:'',items:[],fullRewarded:false};
  if(!Array.isArray(P.rareRewards))P.rareRewards=[];
  P.rareTokenCount=Math.max(0,parseInt(P.rareTokenCount,10)||0);
  if(!P.seasonData||typeof P.seasonData!=='object')P.seasonData={seasonKey:'',label:'',xp:0,score:0,claimedTiers:[],bestLeague:'',bestRankedElo:0,bestRankedLabel:'',lastDivisionRewardText:'',lastDivisionRewardAt:0,history:[]};
  if(!Array.isArray(P.seasonData.claimedTiers))P.seasonData.claimedTiers=[];
  if(!Array.isArray(P.seasonData.history))P.seasonData.history=[];
  P.seasonData.bestRankedElo=Math.max(0,parseInt(P.seasonData.bestRankedElo,10)||0);
  P.seasonData.bestRankedLabel=String(P.seasonData.bestRankedLabel||'');
  P.seasonData.lastDivisionRewardText=String(P.seasonData.lastDivisionRewardText||'');
  P.seasonData.lastDivisionRewardAt=Math.max(0,parseInt(P.seasonData.lastDivisionRewardAt,10)||0);
  if(typeof P.chatProfilePrivate!=='boolean')P.chatProfilePrivate=!!P.chatProfilePrivate;
  P.lastAdminStatsResetAt=Math.max(0,parseInt(P.lastAdminStatsResetAt,10)||0);
  P.mutedUsers=P.mutedUsers.map(v=>String(v||'').trim()).filter(Boolean);
  P.blockedUsers=P.blockedUsers.map(v=>String(v||'').trim()).filter(Boolean);
  if(!Array.isArray(P.chatLog))P.chatLog=[];
  if(isKnownAdminEmail(P.googleEmail))P.isAdmin=true;
  if(!P.uid){P.uid='np_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);changed=true;}
  if(syncUidWithGoogleIdentity(true))changed=true;
  if(changed&&!options.skipPersist)saveProfileData();
  if(typeof ensureDailyChallenges==='function')ensureDailyChallenges(false);
  if(typeof ensureWeeklyMissions==='function')ensureWeeklyMissions(false);
  if(typeof ensureSeasonData==='function')ensureSeasonData(false);
  checkWinTitles();
  checkSecretTitles(false);
  ensureEmojiUnlocks(false);
  if(!isEmojiUnlocked(P.emoji))P.emoji=getUnlockedEmojis()[0];
  applySecretUnlocks();
  renderPartyEmojiPickers();
  if(P.googleConnected&&P.googleSessionToken&&!options.skipRemoteHydrate&&typeof queueRemoteProfileHydration==='function')queueRemoteProfileHydration('load');
  renderLobbyProfileTab();renderFriendsList();renderSocialChat();
}
function saveProfileData(){
  const safeProfile=Object.assign({},P,{
    googleSessionToken:P.googleSessionToken?String(P.googleSessionToken):null
  });
  localStorage.setItem(PROFILE_KEY,JSON.stringify(safeProfile));
  if(PROFILE_SYNC_BUS){
    try{PROFILE_SYNC_BUS.postMessage({type:'profile_updated',at:Date.now()});}catch(_){ }
  }
  if(typeof queueRemoteProfileSync==='function')queueRemoteProfileSync('save');
  if(typeof scheduleGlobalLeaderboardRefresh==='function')scheduleGlobalLeaderboardRefresh(false);
}

let remoteProfileHydrationTimer=null;
let remoteProfileHydrationInFlight=false;

function isDefaultHostedAvatar(value){
  const raw=String(value||'').trim().toLowerCase();
  if(!raw)return true;
  return raw.includes('dicebear.com')||raw.includes('googleusercontent.com')||raw.includes('gstatic.com');
}

async function hydrateRemoteProfileSnapshot(){
  const base=(typeof getGoogleApiBase==='function'?String(getGoogleApiBase()||''):'').replace(/\/$/, '');
  if(!base||!P.googleConnected||!P.googleSessionToken||!P.uid||remoteProfileHydrationInFlight)return false;
  remoteProfileHydrationInFlight=true;
  try{
    const r=await fetch(base+'/api/profile/get',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uid:P.uid,sessionToken:P.googleSessionToken||''}),
      cache:'no-store',
    });
    const data=await r.json().catch(()=>null);
    const remote=data&&data.ok&&data.profile&&typeof data.profile==='object'?data.profile:null;
    if(!r.ok||!remote)return false;
    let changed=false;
    const remoteAvatar=String(remote.avatarImg||remote.avatar||'').trim();
    const localAvatar=String(P.avatarImg||'').trim();
    if(remoteAvatar&&(!localAvatar||isDefaultHostedAvatar(localAvatar))&&remoteAvatar!==localAvatar){
      P.avatarImg=remoteAvatar;
      changed=true;
    }
    const remoteName=String(remote.name||'').trim();
    if(remoteName&&(!P.name||P.name==='Joueur')){
      P.name=remoteName;
      changed=true;
    }
    const remoteColor=String(remote.color||'').trim();
    if(/^#[0-9a-fA-F]{6}$/.test(remoteColor)&&(!P.color||P.color==='#22c55e')){
      P.color=remoteColor;
      changed=true;
    }
    if(changed){
      localStorage.setItem(PROFILE_KEY,JSON.stringify(Object.assign({},P,{googleSessionToken:P.googleSessionToken?String(P.googleSessionToken):null})));
      renderLobbyProfileTab?.();
      renderFriendsList?.();
      renderSocialChat?.();
    }
    return changed;
  }catch(_){
    return false;
  }finally{
    remoteProfileHydrationInFlight=false;
  }
}

function queueRemoteProfileHydration(reason='load'){
  if(remoteProfileHydrationTimer)clearTimeout(remoteProfileHydrationTimer);
  remoteProfileHydrationTimer=setTimeout(async()=>{
    remoteProfileHydrationTimer=null;
    await hydrateRemoteProfileSnapshot();
  },reason==='login'?120:320);
}

const DAILY_CHALLENGE_POOL=[
  {id:'play_1',label:'Lancer 1 partie',stat:'gamesPlayed',amount:1,reward:{type:'rouletteCoins',qty:4}},
  {id:'buy_4',label:'Acheter 4 propriétés',stat:'propertiesBought',amount:4,reward:{type:'antiJail',qty:1}},
  {id:'turns_12',label:'Jouer 12 tours',stat:'totalTurns',amount:12,reward:{type:'rouletteCoins',qty:6}},
  {id:'quest_turns_18',label:'Tenir 18 tours aujourd’hui',stat:'totalTurns',amount:18,reward:{type:'unlockTitle',key:'quest_scout',fallback:{type:'rouletteCoins',qty:8}}},
  {id:'quest_spin_3',label:'Tourner 3 fois la roulette • indice: les triples 8 portent chance.',stat:'rouletteSpinCount',amount:3,reward:{type:'unlockSecret',key:'fx_jackpot',fallback:{type:'rouletteCoins',qty:12}}},
  {id:'quest_season_120',label:'Gagner 120 XP de saison • indice: l’aurore aime 1600.',stat:'seasonData.xp',amount:120,reward:{type:'rareToken',qty:1}},
  {id:'hint_roulette_888',label:'Indice secret du casino : après 8 spins, pense à 888.',stat:'rouletteSpinCount',amount:8,reward:{type:'rouletteCoins',qty:10}},
  {id:'hint_night_shift',label:'Indice nocturne : certains secrets répondent après minuit.',stat:'totalTurns',amount:8,reward:{type:'antiJail',qty:1}},
  {id:'win_1',label:'Gagner 1 partie',stat:'gamesWon',amount:1,reward:{type:'diceBoost',qty:2}},
  {id:'earn_600',label:'Encaisser 600$',stat:'moneyEarned',amount:600,reward:{type:'rouletteCoins',qty:8}},
];

const WEEKLY_MISSION_POOL=[
  {id:'week_play_5',label:'Jouer 5 parties cette semaine',stat:'gamesPlayed',amount:5,reward:{type:'rouletteCoins',qty:18}},
  {id:'week_win_3',label:'Gagner 3 parties cette semaine',stat:'gamesWon',amount:3,reward:{type:'rareReward',key:'crown_neon'}},
  {id:'week_buy_18',label:'Acheter 18 propriétés • rumeur: le vault aime le nombre 40.',stat:'propertiesBought',amount:18,reward:{type:'unlockEmoji',key:'rare_unicorn',fallback:{type:'rareToken',qty:1}}},
  {id:'week_turns_80',label:'Jouer 80 tours',stat:'totalTurns',amount:80,reward:{type:'rareReward',key:'quest_palette'}},
  {id:'week_spin_12',label:'Effectuer 12 tours de roulette',stat:'rouletteSpinCount',amount:12,reward:{type:'rareReward',key:'starlight_chip',fallback:{type:'rouletteCoins',qty:20}}},
  {id:'week_season_450',label:'Cumuler 450 XP saison',stat:'seasonData.xp',amount:450,reward:{type:'rareReward',key:'season_sigil',fallback:{type:'rareToken',qty:2}}},
  {id:'week_money_5000',label:'Cumuler 5000$ gagnés • indice: le capital fantôme vise 25 000$.',stat:'moneyEarned',amount:5000,reward:{type:'unlockSecret',key:'fx_aura',fallback:{type:'seasonXp',qty:90}}},
  {id:'hint_aurora_1600',label:'Rumeur ranked : l’aurore s’éveille vers 1600 ELO.',stat:'elo',amount:1600,reward:{type:'seasonXp',qty:70}},
  {id:'hint_vault_40',label:'Le coffre du bâtisseur respecte les joueurs à 40 propriétés.',stat:'propertiesBought',amount:40,reward:{type:'mortgageDiscount',qty:1}},
  {id:'hint_capital_25k',label:'Le capital fantôme observe ceux qui dépassent 25 000$ gagnés.',stat:'moneyEarned',amount:25000,reward:{type:'rareToken',qty:1}},
];

const RARE_REWARD_DEFS={
  crown_neon:{label:'Couronne Néon',icon:'👑',rarity:'épique',desc:'Titre saisonnier clinquant.',titleKey:'season_contender'},
  phoenix_core:{label:'Cœur Phénix',icon:'🔥',rarity:'légendaire',desc:'Débloque l’emoji Phénix.',emojiKey:'rare_phoenix'},
  aurora_shard:{label:'Éclat Aurora',icon:'✨',rarity:'rare',desc:'Débloque l’aura Elite.',secretKey:'fx_aura'},
  quest_palette:{label:'Palette Prismatique',icon:'🎨',rarity:'épique',desc:'Débloque un lotus astral et un titre cosmétique exclusif.',emojiKey:'quest_orchid',titleKey:'quest_curator'},
  vault_key:{label:'Clé du Coffre',icon:'🗝️',rarity:'épique',desc:'Offre des objets premium.',itemBonus:{diceBoost:2,mortgageDiscount:1}},
  starlight_chip:{label:'Jeton Astral',icon:'🌠',rarity:'légendaire',desc:'Débloque un halo jackpot secret et un titre occulte du casino.',secretKey:'fx_jackpot',titleKey:'casino_oracle',itemBonus:{diceBoost:2,antiJail:1}},
  season_sigil:{label:'Sceau Nebula',icon:'🪐',rarity:'mythique',desc:'Récompense secrète des quêtes et saisons qui débloque Saturne mystique et une traînée stellaire.',emojiKey:'season_saturn',secretKey:'fx_stardust',titleKey:'season_oracle'},
};

const CASINO_TO_RARE_TOKEN_OFFERS=[
  {id:'chip_trade_small',casinoCost:25,rareGain:1,label:'Échange léger'},
  {id:'chip_trade_medium',casinoCost:60,rareGain:3,label:'Échange premium'},
  {id:'chip_trade_big',casinoCost:100,rareGain:5,label:'Échange jackpot'},
];

const RARE_TOKEN_SHOP_ITEMS=[
  {id:'rare_shop_aurora',icon:'✨',name:'Éclat Aurora',cost:2,desc:'Débloque l’aura Elite et un style plus lumineux.',reward:{type:'rareReward',key:'aurora_shard',fallback:{type:'seasonXp',qty:45}}},
  {id:'rare_shop_vault',icon:'🗝️',name:'Clé du Coffre',cost:3,desc:'Pack premium utile pour les parties longues.',reward:{type:'rareReward',key:'vault_key',fallback:{type:'mortgageDiscount',qty:2}}},
  {id:'rare_shop_phoenix',icon:'🔥',name:'Cœur Phénix',cost:4,desc:'Récompense légendaire cosmétique.',reward:{type:'rareReward',key:'phoenix_core',fallback:{type:'rareToken',qty:1}}},
  {id:'rare_shop_starlight',icon:'🌠',name:'Jeton Astral',cost:5,desc:'Halo jackpot + bonus premium du casino.',reward:{type:'rareReward',key:'starlight_chip',fallback:{type:'rouletteCoins',qty:18}}},
  {id:'rare_shop_nebula',icon:'🪐',name:'Sceau Nebula',cost:6,desc:'Récompense mythique liée aux saisons et secrets.',reward:{type:'rareReward',key:'season_sigil',fallback:{type:'rareToken',qty:2}}},
  {id:'rare_shop_bundle',icon:'🎁',name:'Pack tactique',cost:2,desc:'Bundle immédiat pour mieux tenir en ranked.',reward:{type:'diceBoost',qty:2},extraRewards:[{type:'antiJail',qty:1},{type:'mortgageDiscount',qty:1}]},
];

const SEASON_ROTATION=[
  {id:'aurora',label:'Saison Aurora',icon:'🌅'},
  {id:'solstice',label:'Saison Solstice',icon:'☀️'},
  {id:'harvest',label:'Saison Harvest',icon:'🍂'},
  {id:'nebula',label:'Saison Nebula',icon:'🌌'},
];

const SEASON_PASS_REWARDS=[
  {tier:1,xp:80,reward:{type:'diceBoost',qty:1}},
  {tier:2,xp:180,reward:{type:'rareReward',key:'aurora_shard',fallback:{type:'seasonXp',qty:45}}},
  {tier:3,xp:320,reward:{type:'rareReward',key:'phoenix_core',fallback:{type:'rouletteCoins',qty:12}}},
  {tier:4,xp:520,reward:{type:'rareReward',key:'vault_key',fallback:{type:'mortgageDiscount',qty:1}}},
  {tier:5,xp:760,reward:{type:'rareReward',key:'starlight_chip',fallback:{type:'rouletteCoins',qty:18}}},
  {tier:6,xp:980,reward:{type:'rareReward',key:'season_sigil',fallback:{type:'rareToken',qty:2}}},
];

const SEASON_LEAGUES=[
  {min:0,label:'Bronze',icon:'🥉',cls:'bronze'},
  {min:120,label:'Argent',icon:'🥈',cls:'silver'},
  {min:260,label:'Or',icon:'🥇',cls:'gold'},
  {min:420,label:'Élite',icon:'💎',cls:'elite'},
  {min:620,label:'Légende',icon:'👑',cls:'legend'},
];
const RANKED_DIVISION_BONUS={IV:1,III:2,II:4,I:6};
const RANKED_SEASON_REWARD_TIERS=[
  {tiers:['Placement','Non Rankée'],icon:'🎯',rewards:[{type:'rouletteCoins',qty:3}]},
  {tiers:['Bronze'],icon:'🥉',rewards:[{type:'rouletteCoins',qty:6}]},
  {tiers:['Argent'],icon:'🥈',rewards:[{type:'rouletteCoins',qty:10},{type:'antiJail',qty:1}]},
  {tiers:['Or'],icon:'🥇',rewards:[{type:'rouletteCoins',qty:14},{type:'diceBoost',qty:1}]},
  {tiers:['Platine'],icon:'💎',rewards:[{type:'rouletteCoins',qty:18},{type:'diceBoost',qty:1},{type:'mortgageDiscount',qty:1}]},
  {tiers:['Diamant'],icon:'💠',rewards:[{type:'rouletteCoins',qty:24},{type:'rareToken',qty:1},{type:'rareReward',key:'aurora_shard',fallback:{type:'rouletteCoins',qty:12}}]},
  {tiers:['Légendaire'],icon:'👑',rewards:[{type:'rouletteCoins',qty:30},{type:'rareToken',qty:2},{type:'rareReward',key:'starlight_chip',fallback:{type:'rouletteCoins',qty:16}}]},
  {tiers:['Maître Absolu'],icon:'✨',rewards:[{type:'rouletteCoins',qty:36},{type:'rareToken',qty:3},{type:'rareReward',key:'season_sigil',fallback:{type:'rareToken',qty:2}}]},
];

function cloneRewardPayload(reward){
  const copy=Object.assign({},reward||{});
  if(copy.fallback&&typeof copy.fallback==='object')copy.fallback=Object.assign({},copy.fallback);
  return copy;
}

function getSafeRankedDivisionInfo(elo){
  if(typeof getRankedDivisionSystemInfo==='function')return getRankedDivisionSystemInfo(elo);
  if(typeof getEloRankInfo==='function'){
    const rank=getEloRankInfo(elo);
    return {
      cls:rank.cls||'er-unranked',
      icon:rank.icon||'🏅',
      tier:rank.tier||'Placement',
      div:rank.div||'',
      label:rank.label||'—',
      shortLabel:(rank.tier||'Placement')+(rank.div?(' '+rank.div):''),
    };
  }
  return {cls:'er-unranked',icon:'🎯',tier:'Placement',div:'',label:'Placement',shortLabel:'Placement'};
}

function getRankedSeasonRewardInfo(elo){
  const info=getSafeRankedDivisionInfo(elo);
  const tierName=String(info.tier||'Placement');
  const def=RANKED_SEASON_REWARD_TIERS.find(entry=>Array.isArray(entry.tiers)&&entry.tiers.includes(tierName))||RANKED_SEASON_REWARD_TIERS[0];
  const rewards=(def?.rewards||[]).map(cloneRewardPayload);
  const divBonus=RANKED_DIVISION_BONUS[String(info.div||'').toUpperCase()]||0;
  if(rewards[0]&&rewards[0].type==='rouletteCoins')rewards[0].qty=Math.max(1,(parseInt(rewards[0].qty,10)||0)+divBonus);
  const rewardText=rewards.map(getRewardText).join(' • ');
  return Object.assign({
    rewards,
    rewardText,
    rewardLabel:(def?.icon||info.icon||'🏅')+' '+(info.shortLabel||info.label||'Placement'),
    divisionBonus:divBonus,
  },info,{icon:def?.icon||info.icon||'🏅'});
}

function awardSeasonDivisionRewards(closedSeasonData){
  if(!closedSeasonData||typeof closedSeasonData!=='object'||!canUseAccountProgression())return null;
  const bestElo=Math.max(0,parseInt(closedSeasonData.bestRankedElo,10)||parseInt(P.elo,10)||0);
  const rewardInfo=getRankedSeasonRewardInfo(bestElo);
  if(!rewardInfo||!Array.isArray(rewardInfo.rewards)||!rewardInfo.rewards.length)return null;
  rewardInfo.rewards.forEach(reward=>grantProfileReward(cloneRewardPayload(reward)));
  const summary=rewardInfo.rewardLabel+' • '+rewardInfo.rewardText;
  toast('🏁 Fin de saison : '+summary,'a');
  if(typeof glog==='function')glog('🏁 Fin de saison : '+summary,'a');
  return {
    summary,
    label:rewardInfo.shortLabel||rewardInfo.label||'Placement',
    rewardText:rewardInfo.rewardText,
    icon:rewardInfo.icon||'🏅',
    bestElo,
  };
}

const MATCH_OBJECTIVE_POOL=[
  {id:'collector',title:'Collection discrète',desc:'Achète 3 propriétés pendant cette partie.',target:3,reward:{type:'diceBoost',qty:1}},
  {id:'builder',title:'Architecte du quartier',desc:'Construis 2 maisons ou hôtels.',target:2,reward:{type:'unlockTitle',key:'quest_architect',fallback:{type:'elo',qty:20}}},
  {id:'voyager',title:'Tour express',desc:'Passe 2 fois par Départ.',target:2,reward:{type:'antiJail',qty:1}},
  {id:'rentier',title:'Cash-flow caché',desc:'Encaisse 250$ de loyers.',target:250,reward:{type:'mortgageDiscount',qty:1}},
  {id:'railmaster',title:'Baron du rail',desc:'Contrôle 2 gares en même temps.',target:2,reward:{type:'diceBoost',qty:1}},
];

const BOT_PERSONALITY_DEFS={
  balanced:{key:'balanced',label:'Polyvalent',icon:'🎯',buyBias:0,reserveDelta:0,propertyBias:10,railroadBias:10,utilityBias:5,setBias:20,buildBias:0.05,unmortgageBias:0.05,boostBias:0.05},
  tycoon:{key:'tycoon',label:'Magnat',icon:'💼',buyBias:0.05,reserveDelta:-35,propertyBias:28,railroadBias:12,utilityBias:8,setBias:45,buildBias:0.08,unmortgageBias:0.02,boostBias:0.04},
  builder:{key:'builder',label:'Bâtisseur',icon:'🏗️',buyBias:0.02,reserveDelta:-10,propertyBias:22,railroadBias:4,utilityBias:6,setBias:30,buildBias:0.16,unmortgageBias:0.06,boostBias:0.03},
  shark:{key:'shark',label:'Requin',icon:'🦈',buyBias:0.04,reserveDelta:-20,propertyBias:8,railroadBias:32,utilityBias:24,setBias:18,buildBias:0.04,unmortgageBias:0.03,boostBias:0.08},
  cautious:{key:'cautious',label:'Prudent',icon:'🛡️',buyBias:-0.06,reserveDelta:85,propertyBias:6,railroadBias:8,utilityBias:10,setBias:14,buildBias:-0.08,unmortgageBias:0.16,boostBias:-0.03},
  sprinter:{key:'sprinter',label:'Rush',icon:'⚡',buyBias:0.07,reserveDelta:-45,propertyBias:16,railroadBias:16,utilityBias:12,setBias:24,buildBias:0.03,unmortgageBias:0.01,boostBias:0.15},
};

function escapeUiText(str){
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getTodayKey(){
  const now=new Date();
  return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
}

function getTimeZoneDateParts(date,timeZone){
  const base=date instanceof Date?date:new Date();
  try{
    const parts=new Intl.DateTimeFormat('fr-FR',{
      timeZone:String(timeZone||'Europe/Paris'),
      year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',
      hourCycle:'h23'
    }).formatToParts(base);
    const map={};
    parts.forEach(part=>{if(part&&part.type&&part.type!=='literal')map[part.type]=part.value;});
    return {
      year:Math.max(0,parseInt(map.year,10)||base.getFullYear()),
      month:Math.max(1,parseInt(map.month,10)||base.getMonth()+1),
      day:Math.max(1,parseInt(map.day,10)||base.getDate()),
      hour:Math.max(0,parseInt(map.hour,10)||0),
      minute:Math.max(0,parseInt(map.minute,10)||0),
      second:Math.max(0,parseInt(map.second,10)||0),
    };
  }catch(_){
    return {
      year:base.getFullYear(),
      month:base.getMonth()+1,
      day:base.getDate(),
      hour:base.getHours(),
      minute:base.getMinutes(),
      second:base.getSeconds(),
    };
  }
}

function getFranceTodayKey(){
  const now=getTimeZoneDateParts(new Date(),'Europe/Paris');
  return now.year+'-'+String(now.month).padStart(2,'0')+'-'+String(now.day).padStart(2,'0');
}

function readProfileStatValue(statKey){
  const key=String(statKey||'').trim();
  if(!key)return 0;
  if(key.includes('.')){
    const value=key.split('.').reduce((acc,part)=>(acc&&typeof acc==='object')?acc[part]:undefined,P);
    return Math.max(0,parseInt(value,10)||0);
  }
  if(P?.stats&&Object.prototype.hasOwnProperty.call(P.stats,key)){
    return Math.max(0,parseInt(P.stats[key],10)||0);
  }
  return Math.max(0,parseInt(P?.[key],10)||0);
}

function pickRandomEntries(list,count){
  const copy=Array.isArray(list)?list.slice():[];
  for(let i=copy.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [copy[i],copy[j]]=[copy[j],copy[i]];
  }
  return copy.slice(0,Math.max(0,count||0));
}

function getRewardText(reward){
  const qty=Math.max(1,parseInt(reward?.qty,10)||1);
  const emojiDef=(EMOJI_UNLOCK_DEFS||[]).find(def=>def&&def.key===reward?.key);
  switch(reward?.type){
    case 'diceBoost':return '⚡ +'+qty+' booster'+(qty>1?'s':'');
    case 'antiJail':return '🛡️ +'+qty+' anti-prison';
    case 'mortgageDiscount':return '🏦 +'+qty+' remise hypo';
    case 'elo':return '📈 +'+qty+' ELO';
    case 'seasonXp':return '🏆 +'+qty+' XP saison';
    case 'rouletteCoins':return '🎰 +'+qty+' jetons casino';
    case 'rareToken':return '💠 +'+qty+' jeton rare';
    case 'rareReward':return '💎 '+(RARE_REWARD_DEFS[reward.key]?.label||'récompense rare');
    case 'unlockEmoji':return (emojiDef?.emoji||'🧩')+' '+(emojiDef?.label||'Cosmétique emoji');
    case 'unlockTitle':return '🏅 '+(TITLE_DEFS?.[reward.key]?.label||'Titre exclusif');
    case 'unlockSecret':return '✨ '+((typeof SECRET_FEATURE_DEFS!=='undefined'&&SECRET_FEATURE_DEFS?.[reward.key]?.label)||'Aura rare');
    default:return 'Bonus surprise';
  }
}

function getWeekKey(){
  const now=new Date();
  const d=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));
  d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
  const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week=Math.ceil((((d-yearStart)/86400000)+1)/7);
  return d.getUTCFullYear()+'-W'+String(week).padStart(2,'0');
}

function getCurrentSeasonInfo(){
  const now=new Date();
  const idx=Math.floor(now.getMonth()/3)%SEASON_ROTATION.length;
  const base=SEASON_ROTATION[idx]||SEASON_ROTATION[0];
  return Object.assign({key:now.getFullYear()+'-'+base.id},base);
}

function getSeasonLeagueInfo(score){
  const pts=Math.max(0,parseInt(score,10)||0);
  for(let i=SEASON_LEAGUES.length-1;i>=0;i--){
    const league=SEASON_LEAGUES[i];
    if(pts>=league.min){
      const next=SEASON_LEAGUES[i+1]||null;
      const span=next?Math.max(1,next.min-league.min):120;
      const progress=next?Math.max(0,Math.min(100,Math.round(((pts-league.min)/span)*100))):100;
      return Object.assign({score:pts,next,progress},league);
    }
  }
  return Object.assign({score:pts,next:SEASON_LEAGUES[1]||null,progress:0},SEASON_LEAGUES[0]);
}

function ensureSeasonData(forceReset=false){
  if(!P.seasonData||typeof P.seasonData!=='object')P.seasonData={seasonKey:'',label:'',xp:0,score:0,claimedTiers:[],bestLeague:'',bestRankedElo:0,bestRankedLabel:'',lastDivisionRewardText:'',lastDivisionRewardAt:0,history:[]};
  const info=getCurrentSeasonInfo();
  const data=P.seasonData;
  if(!Array.isArray(data.claimedTiers))data.claimedTiers=[];
  if(!Array.isArray(data.history))data.history=[];
  data.bestRankedElo=Math.max(0,parseInt(data.bestRankedElo,10)||0);
  data.bestRankedLabel=String(data.bestRankedLabel||'');
  data.lastDivisionRewardText=String(data.lastDivisionRewardText||'');
  data.lastDivisionRewardAt=Math.max(0,parseInt(data.lastDivisionRewardAt,10)||0);
  let changed=false;
  const seasonChanged=!!(data.seasonKey&&data.seasonKey!==info.key);
  if(forceReset||seasonChanged||!data.seasonKey){
    let rewardSummary=null;
    if(seasonChanged&&data.label){
      rewardSummary=awardSeasonDivisionRewards(data);
      data.history.unshift({
        seasonKey:data.seasonKey,
        label:data.label,
        score:parseInt(data.score,10)||0,
        xp:parseInt(data.xp,10)||0,
        bestLeague:String(data.bestLeague||''),
        bestRankedLabel:String(data.bestRankedLabel||''),
        rewardSummary:String(rewardSummary?.summary||''),
        closedAt:Date.now()
      });
      if(data.history.length>6)data.history.length=6;
    }
    data.seasonKey=info.key;
    data.label=info.icon+' '+info.label;
    data.xp=0;
    data.score=0;
    data.claimedTiers=[];
    data.bestLeague='';
    data.bestRankedElo=Math.max(0,parseInt(P.elo,10)||0);
    data.bestRankedLabel=getRankedSeasonRewardInfo(data.bestRankedElo).shortLabel||'Placement';
    if(rewardSummary){
      data.lastDivisionRewardText=rewardSummary.summary;
      data.lastDivisionRewardAt=Date.now();
    }
    changed=true;
  }
  const league=getSeasonLeagueInfo(data.score||0);
  if(!data.bestLeague||league.label!==data.bestLeague){
    data.bestLeague=league.label;
    changed=true;
  }
  const currentElo=Math.max(0,parseInt(P.elo,10)||0);
  if(currentElo>(parseInt(data.bestRankedElo,10)||0)){
    data.bestRankedElo=currentElo;
    changed=true;
  }
  const rankedBest=getRankedSeasonRewardInfo(data.bestRankedElo||currentElo);
  const nextBestLabel=String(rankedBest.shortLabel||rankedBest.label||'Placement');
  if(nextBestLabel!==String(data.bestRankedLabel||'')){
    data.bestRankedLabel=nextBestLabel;
    changed=true;
  }
  if(changed)saveProfileData();
  return data;
}

function recordRareReward(key,silent=false){
  if(!canUseAccountProgression())return false;
  const def=RARE_REWARD_DEFS[key];
  if(!def)return false;
  if(!Array.isArray(P.rareRewards))P.rareRewards=[];
  if(P.rareRewards.some(entry=>entry&&entry.key===key))return false;
  P.rareRewards.unshift({key,label:def.label,icon:def.icon,rarity:def.rarity,desc:def.desc,obtainedAt:Date.now()});
  if(P.rareRewards.length>18)P.rareRewards.length=18;
  if(def.emojiKey){
    if(!P.emojiUnlocks||typeof P.emojiUnlocks!=='object')P.emojiUnlocks={};
    P.emojiUnlocks[def.emojiKey]=Date.now();
  }
  if(def.secretKey&&typeof unlockSecretFeature==='function')unlockSecretFeature(def.secretKey);
  if(def.itemBonus){
    if(!P.inventory||typeof P.inventory!=='object')P.inventory={diceBoost:0,antiJail:0,mortgageDiscount:0};
    Object.keys(def.itemBonus).forEach(itemKey=>{
      P.inventory[itemKey]=Math.max(0,(parseInt(P.inventory[itemKey],10)||0)+(parseInt(def.itemBonus[itemKey],10)||0));
    });
  }
  if(def.titleKey&&Array.isArray(P.titles)&&!P.titles.includes(def.titleKey)){
    P.titles.push(def.titleKey);
    if(typeof ensureTitleMeta==='function')ensureTitleMeta(def.titleKey);
  }
  if(!silent)toast('💎 Récompense rare : '+def.icon+' '+def.label,'a');
  return true;
}

function getRareTokenShopRewards(item){
  if(!item||typeof item!=='object')return [];
  return [item.reward].concat(Array.isArray(item.extraRewards)?item.extraRewards:[]).filter(Boolean);
}

function spendRareTokens(amount,reason=''){
  if(!canUseAccountProgression())return false;
  const cost=Math.max(0,parseInt(amount,10)||0);
  if(!cost)return true;
  const tokens=Math.max(0,parseInt(P.rareTokenCount,10)||0);
  if(tokens<cost){toast('Pas assez de jetons rares.','w');return false;}
  P.rareTokenCount=Math.max(0,tokens-cost);
  if(reason){
    const msg='💠 -'+cost+' jeton'+(cost>1?'s':'')+' • '+reason;
    if(typeof glog==='function')glog(msg,'i');
  }
  return true;
}

function convertCasinoToRareTokens(casinoCost,rareGain){
  const casino=Math.max(1,parseInt(casinoCost,10)||0);
  const rare=Math.max(1,parseInt(rareGain,10)||0);
  if(!canUseAccountProgression()){showInviteAccountLock?.('La conversion premium');return false;}
  if((parseInt(P.rouletteCoins,10)||0)<casino){toast('Pas assez de jetons casino.','w');return false;}
  if(!spendRouletteCoins(casino,'conversion vers jetons rares',{silent:true,skipRender:true,skipSave:true}))return false;
  P.rareTokenCount=Math.max(0,(parseInt(P.rareTokenCount,10)||0)+rare);
  saveProfileData();
  renderRareRewardsUi?.();
  renderRoulettePanel?.();
  if(typeof renderLobbyProfileTab==='function')setTimeout(()=>renderLobbyProfileTab(),0);
  toast('💠 Conversion réussie : -'+casino+' jetons casino → +'+rare+' jeton'+(rare>1?'s rares':' rare'),'a');
  return true;
}

function buyRareTokenShopItem(itemId){
  const item=(RARE_TOKEN_SHOP_ITEMS||[]).find(entry=>entry&&entry.id===itemId);
  if(!item){toast('Objet introuvable.','w');return false;}
  if(!spendRareTokens(item.cost,item.name))return false;
  const rewards=getRareTokenShopRewards(item);
  const granted=[];
  let success=false;
  rewards.forEach(reward=>{
    if(!reward)return;
    const payload=typeof cloneRewardPayload==='function'?cloneRewardPayload(reward):Object.assign({},reward);
    const ok=grantProfileReward(payload);
    if(ok){success=true;granted.push(typeof getRewardText==='function'?getRewardText(reward):(reward.type||'bonus'));}
  });
  if(!success){
    P.rareTokenCount=Math.max(0,(parseInt(P.rareTokenCount,10)||0)+(parseInt(item.cost,10)||0));
    toast('Objet déjà possédé ou indisponible pour le moment.','i');
    renderRareRewardsUi?.();
    return false;
  }
  saveProfileData();
  renderInventoryUi?.();
  renderPartyEmojiPickers?.();
  renderRareRewardsUi?.();
  if(typeof renderLobbyProfileTab==='function')setTimeout(()=>renderLobbyProfileTab(),0);
  toast(item.icon+' Achat premium : '+item.name+(granted.length?(' • '+granted.join(' • ')):''),'a');
  return true;
}

function syncSeasonPassRewards(shouldPersist=true){
  const data=ensureSeasonData(false);
  let changed=false;
  SEASON_PASS_REWARDS.forEach(step=>{
    if((data.xp||0)>=step.xp&&!data.claimedTiers.includes(step.tier)){
      data.claimedTiers.push(step.tier);
      grantProfileReward(step.reward);
      toast('🏁 Palier de saison débloqué : niveau '+step.tier+' • '+getRewardText(step.reward),'a');
      changed=true;
    }
  });
  if(changed&&shouldPersist)saveProfileData();
  return changed;
}

function addSeasonProgress(amount,reason,shouldPersist=true){
  if(!canUseAccountProgression())return false;
  if(G&&G.started&&!canAwardPersistentProfileProgressInCurrentMatch())return false;
  const gain=Math.max(0,parseInt(amount,10)||0);
  if(!gain)return false;
  const data=ensureSeasonData(false);
  data.xp=Math.max(0,(parseInt(data.xp,10)||0)+gain);
  data.score=Math.max(0,(parseInt(data.score,10)||0)+Math.round(gain*0.85));
  syncSeasonPassRewards(false);
  if(shouldPersist)saveProfileData();
  if(reason)G.lastSeasonGainReason=reason;
  return true;
}

function grantProfileReward(reward){
  if(!reward||!reward.type)return false;
  if(G&&G.started&&!canTrackProfileStatsInCurrentMatch())return false;
  const isBonusReward=reward.type==='diceBoost'||reward.type==='antiJail'||reward.type==='mortgageDiscount'||reward.type==='rouletteCoins';
  if(!canUseAccountProgression()&&!isBonusReward){
    const fallback=reward.fallback;
    if(fallback&&(fallback.type==='diceBoost'||fallback.type==='antiJail'||fallback.type==='mortgageDiscount')){
      return grantProfileReward(fallback);
    }
    return false;
  }
  const qty=Math.max(1,parseInt(reward.qty,10)||1);
  if(reward.type==='rouletteCoins'){
    P.rouletteCoins=Math.max(0,(parseInt(P.rouletteCoins,10)||0)+qty);
    return true;
  }
  if(reward.type==='elo'){
    P.elo=Math.max(0,Math.min(9999,(parseInt(P.elo,10)||0)+qty));
    if(typeof checkSecretTitles==='function')checkSecretTitles(false);
    return true;
  }
  if(reward.type==='seasonXp')return addSeasonProgress(qty,'récompense',false);
  if(reward.type==='rareToken'){
    P.rareTokenCount=Math.max(0,(parseInt(P.rareTokenCount,10)||0)+qty);
    return true;
  }
  if(reward.type==='rareReward'){
    const ok=recordRareReward(reward.key,false);
    return ok||(reward.fallback?grantProfileReward(reward.fallback):false);
  }
  if(reward.type==='unlockEmoji'){
    if(!P.emojiUnlocks||typeof P.emojiUnlocks!=='object')P.emojiUnlocks={};
    if(P.emojiUnlocks[reward.key])return reward.fallback?grantProfileReward(reward.fallback):false;
    P.emojiUnlocks[reward.key]=Date.now();
    return true;
  }
  if(reward.type==='unlockTitle'){
    if(!Array.isArray(P.titles))P.titles=[];
    if(P.titles.includes(reward.key))return reward.fallback?grantProfileReward(reward.fallback):false;
    P.titles.push(reward.key);
    if(typeof ensureTitleMeta==='function')ensureTitleMeta(reward.key);
    return true;
  }
  if(reward.type==='unlockSecret'){
    const ok=typeof unlockSecretFeature==='function'?!!unlockSecretFeature(reward.key):false;
    return ok||(reward.fallback?grantProfileReward(reward.fallback):false);
  }
  if(!P.inventory||typeof P.inventory!=='object')P.inventory={diceBoost:0,antiJail:0,mortgageDiscount:0};
  if(!(reward.type in P.inventory))return false;
  P.inventory[reward.type]=Math.max(0,(parseInt(P.inventory[reward.type],10)||0)+qty);
  return true;
}

function ensureDailyChallenges(forceNew=false){
  if(!P.dailyChallenges||typeof P.dailyChallenges!=='object')P.dailyChallenges={dateKey:'',streak:0,lastCompletedDate:'',items:[]};
  const pack=P.dailyChallenges;
  const today=getTodayKey();
  let changed=false;
  if(forceNew||pack.dateKey!==today||!Array.isArray(pack.items)||pack.items.length<3){
    if(pack.dateKey&&pack.dateKey!==today){
      const previousDone=(pack.items||[]).length>0&&(pack.items||[]).every(item=>item&&item.done);
      pack.streak=previousDone?(Math.max(0,parseInt(pack.streak,10)||0)+1):0;
      if(previousDone)pack.lastCompletedDate=pack.dateKey;
    }
    pack.dateKey=today;
    pack.items=pickRandomEntries(DAILY_CHALLENGE_POOL,3).map(def=>(
      {id:def.id,label:def.label,stat:def.stat,amount:def.amount,reward:def.reward,base:readProfileStatValue(def.stat),progress:0,done:false,rewarded:false}
    ));
    changed=true;
  }
  if(syncDailyChallengesProgress(false))changed=true;
  if(changed)saveProfileData();
  return pack;
}

function syncDailyChallengesProgress(shouldPersist=true){
  if(!P.dailyChallenges||typeof P.dailyChallenges!=='object')return false;
  if(!canUseAccountProgression())return false;
  let changed=false;
  let unlockedReward=false;
  (P.dailyChallenges.items||[]).forEach(item=>{
    if(!item||!item.stat)return;
    const target=Math.max(1,parseInt(item.amount,10)||1);
    const base=Math.max(0,parseInt(item.base,10)||0);
    const progress=Math.max(0,Math.min(target,readProfileStatValue(item.stat)-base));
    if(item.progress!==progress){item.progress=progress;changed=true;}
    if(progress>=target&&!item.done){item.done=true;changed=true;}
    if(item.done&&!item.rewarded){
      item.rewarded=true;
      grantProfileReward(item.reward);
      unlockedReward=true;
      changed=true;
      toast('✅ Défi du jour complété : '+item.label+' • '+getRewardText(item.reward),'a');
    }
  });
  if(unlockedReward){
    if(typeof renderInventoryUi==='function')renderInventoryUi();
    if(typeof renderLobbyProfileTab==='function')setTimeout(()=>renderLobbyProfileTab(),0);
  }
  if(changed&&shouldPersist)saveProfileData();
  return changed;
}

function renderDailyChallengesUi(){
  const list=document.getElementById('daily-challenges-list');
  const meta=document.getElementById('daily-challenges-meta');
  if(!list)return;
  if(!canUseAccountProgression()){
    if(meta)meta.textContent='Compte invité • défis verrouillés';
    list.innerHTML='<div style="font-size:.68rem;color:var(--muted)">'+escapeUiText(getInviteAccountLockText())+'</div>';
    return;
  }
  const pack=ensureDailyChallenges(false);
  const items=Array.isArray(pack?.items)?pack.items:[];
  const todayTxt=(pack?.dateKey||getTodayKey()).split('-').reverse().join('/');
  const streak=Math.max(0,parseInt(pack?.streak,10)||0);
  const completed=items.filter(item=>item&&item.done).length;
  if(meta)meta.textContent=''+todayTxt+' • série '+streak+' • '+completed+'/'+items.length;
  if(!items.length){
    list.innerHTML='<div style="font-size:.68rem;color:var(--muted)">Les défis arrivent bientôt.</div>';
    return;
  }
  list.innerHTML=items.map(item=>{
    const target=Math.max(1,parseInt(item.amount,10)||1);
    const progress=Math.max(0,Math.min(target,parseInt(item.progress,10)||0));
    const pct=Math.max(8,Math.round((progress/target)*100));
    const done=!!item.done;
    return '<div style="padding:8px 9px;border:1px solid '+(done?'rgba(34,197,94,.45)':'var(--border)')+';border-radius:10px;background:'+(done?'rgba(34,197,94,.09)':'var(--s2)')+'">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'+
        '<div style="font-size:.72rem;font-weight:700">'+(done?'✅ ':'🎯 ')+escapeUiText(item.label)+'</div>'+
        '<div style="font-size:.62rem;color:'+(done?'#22c55e':'var(--muted)')+'">'+progress+'/'+target+'</div>'+
      '</div>'+
      '<div style="height:7px;margin-top:6px;border-radius:999px;background:rgba(148,163,184,.14);overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(done?'linear-gradient(90deg,#22c55e,#4ade80)':'linear-gradient(90deg,var(--accent),var(--blue))')+'"></div></div>'+
      '<div style="font-size:.64rem;color:var(--muted);margin-top:5px">Récompense : '+escapeUiText(getRewardText(item.reward))+'</div>'+
    '</div>';
  }).join('');
}

function ensureWeeklyMissions(forceNew=false){
  if(!P.weeklyMissions||typeof P.weeklyMissions!=='object')P.weeklyMissions={weekKey:'',streak:0,lastCompletedWeek:'',items:[],fullRewarded:false};
  const pack=P.weeklyMissions;
  const weekKey=getWeekKey();
  let changed=false;
  if(forceNew||pack.weekKey!==weekKey||!Array.isArray(pack.items)||pack.items.length<3){
    if(pack.weekKey&&pack.weekKey!==weekKey){
      const wasDone=(pack.items||[]).length>0&&(pack.items||[]).every(item=>item&&item.done);
      pack.streak=wasDone?(Math.max(0,parseInt(pack.streak,10)||0)+1):0;
      if(wasDone)pack.lastCompletedWeek=pack.weekKey;
    }
    pack.weekKey=weekKey;
    pack.items=pickRandomEntries(WEEKLY_MISSION_POOL,3).map(def=>(
      {id:def.id,label:def.label,stat:def.stat,amount:def.amount,reward:def.reward,base:readProfileStatValue(def.stat),progress:0,done:false,rewarded:false}
    ));
    pack.fullRewarded=false;
    changed=true;
  }
  if(syncWeeklyMissionsProgress(false))changed=true;
  if(changed)saveProfileData();
  return pack;
}

function syncWeeklyMissionsProgress(shouldPersist=true){
  if(!P.weeklyMissions||typeof P.weeklyMissions!=='object')return false;
  if(!canUseAccountProgression())return false;
  let changed=false;
  let granted=false;
  const items=P.weeklyMissions.items||[];
  items.forEach(item=>{
    if(!item||!item.stat)return;
    const target=Math.max(1,parseInt(item.amount,10)||1);
    const base=Math.max(0,parseInt(item.base,10)||0);
    const progress=Math.max(0,Math.min(target,readProfileStatValue(item.stat)-base));
    if(item.progress!==progress){item.progress=progress;changed=true;}
    if(progress>=target&&!item.done){item.done=true;changed=true;}
    if(item.done&&!item.rewarded){
      item.rewarded=true;
      grantProfileReward(item.reward);
      toast('📆 Mission hebdo complétée : '+item.label+' • '+getRewardText(item.reward),'a');
      granted=true;
      changed=true;
    }
  });
  const fullDone=items.length>0&&items.every(item=>item&&item.done);
  if(fullDone&&!P.weeklyMissions.fullRewarded){
    P.weeklyMissions.fullRewarded=true;
    recordRareReward('vault_key',false);
    P.rareTokenCount=Math.max(0,(parseInt(P.rareTokenCount,10)||0)+1);
    toast('💎 Semaine parfaite : coffre rare débloqué !','a');
    granted=true;
    changed=true;
  }
  if(granted){
    renderInventoryUi?.();
    renderPartyEmojiPickers?.();
    if(typeof renderLobbyProfileTab==='function')setTimeout(()=>renderLobbyProfileTab(),0);
  }
  if(changed&&shouldPersist)saveProfileData();
  return changed;
}

function renderWeeklyMissionsUi(){
  const list=document.getElementById('weekly-missions-list');
  const meta=document.getElementById('weekly-missions-meta');
  if(!list)return;
  if(!canUseAccountProgression()){
    if(meta)meta.textContent='Compte invité • hebdo verrouillé';
    list.innerHTML='<div style="font-size:.68rem;color:var(--muted)">'+escapeUiText(getInviteAccountLockText())+'</div>';
    return;
  }
  const pack=ensureWeeklyMissions(false);
  const items=Array.isArray(pack?.items)?pack.items:[];
  const streak=Math.max(0,parseInt(pack?.streak,10)||0);
  const done=items.filter(item=>item&&item.done).length;
  if(meta)meta.textContent=(pack?.weekKey||getWeekKey())+' • série '+streak+' • '+done+'/'+items.length;
  if(!items.length){
    list.innerHTML='<div style="font-size:.68rem;color:var(--muted)">Les missions hebdo arrivent bientôt.</div>';
    return;
  }
  list.innerHTML=items.map(item=>{
    const target=Math.max(1,parseInt(item.amount,10)||1);
    const progress=Math.max(0,Math.min(target,parseInt(item.progress,10)||0));
    const pct=Math.max(8,Math.round((progress/target)*100));
    const ok=!!item.done;
    return '<div style="padding:8px 9px;border:1px solid '+(ok?'rgba(45,212,191,.45)':'var(--border)')+';border-radius:10px;background:'+(ok?'rgba(45,212,191,.09)':'var(--s2)')+'">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'+
        '<div style="font-size:.72rem;font-weight:700">'+(ok?'✅ ':'📌 ')+escapeUiText(item.label)+'</div>'+
        '<div style="font-size:.62rem;color:'+(ok?'#2dd4bf':'var(--muted)')+'">'+progress+'/'+target+'</div>'+
      '</div>'+
      '<div style="height:7px;margin-top:6px;border-radius:999px;background:rgba(148,163,184,.14);overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(ok?'linear-gradient(90deg,#2dd4bf,#60a5fa)':'linear-gradient(90deg,#60a5fa,#a855f7)')+'"></div></div>'+
      '<div style="font-size:.64rem;color:var(--muted);margin-top:5px">Butin : '+escapeUiText(getRewardText(item.reward))+'</div>'+
    '</div>';
  }).join('');
}

function renderRareRewardsUi(){
  const list=document.getElementById('rare-rewards-list');
  if(!list)return;
  const rewards=Array.isArray(P.rareRewards)?P.rareRewards.slice(0,4):[];
  const tokens=Math.max(0,parseInt(P.rareTokenCount,10)||0);
  const casinoTokens=Math.max(0,parseInt(P.rouletteCoins,10)||0);
  if(!canUseAccountProgression()){
    list.innerHTML='<div style="font-size:.68rem;color:var(--muted)">'+escapeUiText(getInviteAccountLockText())+'</div>';
    return;
  }
  const recentRewardsHtml=rewards.length
    ? rewards.map(entry=>'<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:10px;background:var(--s2);border:1px solid var(--border)">'+
        '<span style="font-size:1rem">'+escapeUiText(entry.icon||'💎')+'</span>'+
        '<div style="flex:1;min-width:0"><div style="font-size:.72rem;font-weight:700">'+escapeUiText(entry.label||'Récompense')+'</div><div style="font-size:.62rem;color:var(--muted)">'+escapeUiText((entry.rarity||'rare')+(entry.desc?(' • '+entry.desc):''))+'</div></div>'+
      '</div>').join('')
    : '<div style="font-size:.68rem;color:var(--muted)">Aucune récompense rare obtenue pour le moment.</div>';
  const conversionHtml=(CASINO_TO_RARE_TOKEN_OFFERS||[]).map(offer=>{
    const canAfford=casinoTokens>=(parseInt(offer.casinoCost,10)||0);
    return '<button class="btn '+(canAfford?'btn-yellow':'btn-secondary')+' btn-xs" '+(canAfford?'':'disabled')+' onclick="convertCasinoToRareTokens('+parseInt(offer.casinoCost,10)+','+parseInt(offer.rareGain,10)+')">'+
      escapeUiText((offer.label||'Échange')+' • '+offer.casinoCost+' 🎰 → '+offer.rareGain+' 💠')+
    '</button>';
  }).join('');
  const shopHtml=(RARE_TOKEN_SHOP_ITEMS||[]).map(item=>{
    const cost=Math.max(1,parseInt(item.cost,10)||1);
    const canAfford=tokens>=cost;
    const rewardText=getRareTokenShopRewards(item).map(getRewardText).join(' • ');
    return '<div style="padding:8px 9px;border-radius:10px;background:linear-gradient(180deg,rgba(10,20,42,.92),rgba(9,14,28,.9));border:1px solid rgba(96,165,250,.14)">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'+
        '<div style="font-size:.72rem;font-weight:800">'+escapeUiText((item.icon||'💠')+' '+(item.name||'Offre premium'))+'</div>'+
        '<div style="font-size:.64rem;color:#facc15;font-weight:800">'+cost+' 💠</div>'+
      '</div>'+
      '<div style="font-size:.63rem;color:var(--muted);margin-top:4px">'+escapeUiText(item.desc||'Récompense premium')+'</div>'+
      '<div style="font-size:.62rem;color:#dbeafe;margin-top:5px">Butin : '+escapeUiText(rewardText||'Bonus surprise')+'</div>'+
      '<div style="margin-top:7px"><button class="btn '+(canAfford?'btn-blue':'btn-secondary')+' btn-xs" '+(canAfford?'':'disabled')+' onclick="buyRareTokenShopItem(\''+String(item.id||'')+'\')">Acheter</button></div>'+
    '</div>';
  }).join('');
  list.innerHTML=''+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 9px;border-radius:10px;background:linear-gradient(135deg,rgba(37,99,235,.16),rgba(168,85,247,.14));border:1px solid rgba(96,165,250,.24)">'+
      '<div><div style="font-size:.72rem;font-weight:800">💠 Boutique Jetons rares</div><div style="font-size:.62rem;color:var(--muted)">Utilise tes jetons rares ou convertis tes gains casino.</div></div>'+
      '<div style="text-align:right;font-size:.63rem;color:#dbeafe"><div>Rares : <b>'+tokens+'</b></div><div>Casino : <b>'+casinoTokens+'</b></div></div>'+
    '</div>'+
    '<div style="font-size:.64rem;color:var(--muted);margin-top:6px;font-weight:700">🔄 Conversion casino → rare</div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">'+conversionHtml+'</div>'+
    '<div style="font-size:.64rem;color:var(--muted);margin-top:9px;font-weight:700">🛍️ Offres premium</div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:7px;margin-top:6px">'+shopHtml+'</div>'+
    '<div style="font-size:.64rem;color:var(--muted);margin-top:9px;font-weight:700">💎 Récompenses rares obtenues</div>'+
    '<div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">'+recentRewardsHtml+'</div>';
}

function renderSeasonHubUi(){
  const body=document.getElementById('season-hub-body');
  if(!body)return;
  if(!canUseAccountProgression()){
    body.innerHTML='<div style="padding:8px 9px;border-radius:10px;background:var(--s2);border:1px solid var(--border);font-size:.68rem;color:var(--muted)">'+escapeUiText(getInviteAccountLockText())+'</div>';
    return;
  }
  const data=ensureSeasonData(false);
  const league=getSeasonLeagueInfo(data.score||0);
  const rankedReward=getRankedSeasonRewardInfo(Math.max(parseInt(data.bestRankedElo,10)||0,parseInt(P.elo,10)||0));
  const nextReward=SEASON_PASS_REWARDS.find(step=>(parseInt(data.xp,10)||0)<step.xp)||null;
  const targetXp=nextReward?nextReward.xp:(SEASON_PASS_REWARDS[SEASON_PASS_REWARDS.length-1]?.xp||1);
  const pct=Math.max(6,Math.min(100,Math.round(((parseInt(data.xp,10)||0)/Math.max(1,targetXp))*100)));
  const addons=typeof readPackManagerFallbackState==='function'?readPackManagerFallbackState():null;
  const seasonsFlag=addons?.seasons?'ON':'OFF';
  const eventsFlag=addons?.events?'ON':'OFF';
  const divisionBonusNote=rankedReward.div?(' • bonus '+rankedReward.div+' : +'+(parseInt(rankedReward.divisionBonus,10)||0)+' jeton'+((parseInt(rankedReward.divisionBonus,10)||0)>1?'s':'')):' • bonus placement inclus';
  const lastRewardText=String(data.lastDivisionRewardText||'Aucune récompense finale encore reçue sur ce compte.');
  body.innerHTML=''+
    '<div style="padding:8px 9px;border-radius:10px;background:var(--s2);border:1px solid var(--border)">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="font-size:.74rem;font-weight:800">'+escapeUiText(data.label||getCurrentSeasonInfo().label)+'</div><div style="font-size:.64rem;color:var(--muted)">'+league.icon+' '+escapeUiText(league.label)+'</div></div>'+
      '<div style="font-size:.64rem;color:var(--muted);margin-top:4px">Score saisonnier: '+(parseInt(data.score,10)||0)+' • Addons saisons '+seasonsFlag+' • events '+eventsFlag+'</div>'+
      '<div style="height:8px;margin-top:7px;border-radius:999px;background:rgba(148,163,184,.14);overflow:hidden"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#f59e0b,#eab308,#2dd4bf)"></div></div>'+
      '<div style="display:flex;justify-content:space-between;gap:8px;font-size:.64rem;color:var(--muted);margin-top:6px"><span>XP: '+(parseInt(data.xp,10)||0)+'</span><span>'+(nextReward?('Prochain palier '+nextReward.tier+' à '+nextReward.xp+' XP'):'Pass saison complété')+'</span></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px">'+
      '<div style="padding:8px 9px;border-radius:10px;background:var(--s2);border:1px solid var(--border)"><div style="font-size:.62rem;color:var(--muted)">Meilleure ligue</div><div style="font-size:.88rem;font-weight:800">'+league.icon+' '+escapeUiText(P.seasonData.bestLeague||league.label)+'</div></div>'+
      '<div style="padding:8px 9px;border-radius:10px;background:var(--s2);border:1px solid var(--border)"><div style="font-size:.62rem;color:var(--muted)">Division max</div><div style="font-size:.88rem;font-weight:800">'+escapeUiText(rankedReward.rewardLabel||data.bestRankedLabel||'🎯 Placement')+'</div></div>'+
      '<div style="padding:8px 9px;border-radius:10px;background:var(--s2);border:1px solid var(--border)"><div style="font-size:.62rem;color:var(--muted)">Paliers obtenus</div><div style="font-size:.88rem;font-weight:800">'+((P.seasonData.claimedTiers||[]).length)+' / '+SEASON_PASS_REWARDS.length+'</div></div>'+
      '<div style="padding:8px 9px;border-radius:10px;background:var(--s2);border:1px solid var(--border)"><div style="font-size:.62rem;color:var(--muted)">Récompense finale</div><div style="font-size:.72rem;font-weight:800;line-height:1.35">'+escapeUiText(rankedReward.rewardText||'Bonus à venir')+'</div></div>'+
    '</div>'+
    '<div style="margin-top:7px;padding:9px 10px;border-radius:10px;background:linear-gradient(135deg,rgba(37,99,235,.16),rgba(239,68,68,.12));border:1px solid rgba(96,165,250,.24)">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="font-size:.7rem;font-weight:800">🏁 Récompenses de fin de saison par division</div><div style="font-size:.62rem;color:#dbeafe">'+escapeUiText(rankedReward.shortLabel||data.bestRankedLabel||'Placement')+'</div></div>'+
      '<div style="font-size:.64rem;color:var(--muted);margin-top:4px">Si la saison se termine maintenant, tu reçois : '+escapeUiText(rankedReward.rewardText||'bonus à définir')+escapeUiText(divisionBonusNote)+'</div>'+
      '<div style="font-size:.62rem;color:#dbeafe;margin-top:6px">Dernier versement : '+escapeUiText(lastRewardText)+'</div>'+
    '</div>';
}

function ensurePlayerMatchStats(player){
  if(!player)return {propertiesBought:0,housesBuilt:0,passedGo:0,rentCollected:0,rentPaid:0,turnsPlayed:0};
  if(!player.matchStats||typeof player.matchStats!=='object')player.matchStats={};
  ['propertiesBought','housesBuilt','passedGo','rentCollected','rentPaid','turnsPlayed'].forEach(key=>{
    player.matchStats[key]=Math.max(0,parseInt(player.matchStats[key],10)||0);
  });
  return player.matchStats;
}

function getControlledMatchPlayer(){
  const players=Array.isArray(G.players)?G.players:[];
  const direct=players.find(player=>player&&isProfileControlledPlayer(player)&&!player.bust)||players.find(player=>player&&isProfileControlledPlayer(player));
  const fallback=players[G.cur]||players[0]||null;
  const player=direct||fallback;
  if(player)ensurePlayerMatchStats(player);
  return player;
}

function pickRandomBotPersona(preferredKey){
  if(preferredKey&&BOT_PERSONALITY_DEFS[preferredKey])return preferredKey;
  const keys=Object.keys(BOT_PERSONALITY_DEFS);
  return keys[Math.floor(Math.random()*keys.length)]||'balanced';
}

function getBotPersonaConfig(playerOrKey){
  const key=typeof playerOrKey==='string'
    ?playerOrKey
    :(playerOrKey?.botPersona||'balanced');
  return BOT_PERSONALITY_DEFS[key]||BOT_PERSONALITY_DEFS.balanced;
}

function ensureBotPersona(player,preferredKey){
  if(!player||!player.bot)return BOT_PERSONALITY_DEFS.balanced;
  if(preferredKey&&BOT_PERSONALITY_DEFS[preferredKey])player.botPersona=preferredKey;
  if(!player.botPersona||!BOT_PERSONALITY_DEFS[player.botPersona])player.botPersona=pickRandomBotPersona();
  return getBotPersonaConfig(player);
}

function ensureMatchObjectiveExists(forceNew=false){
  const questMode=normalizeMatchQuestMode(G.matchQuestMode);
  if(!G.started||questMode==='off'){G.secretObjective=null;return null;}
  const player=getControlledMatchPlayer();
  if(player)ensurePlayerMatchStats(player);
  if(forceNew||!G.secretObjective||G.secretObjective.playerId!==(player?.id||null)){
    const def=MATCH_OBJECTIVE_POOL[Math.floor(Math.random()*MATCH_OBJECTIVE_POOL.length)]||MATCH_OBJECTIVE_POOL[0];
    G.secretObjective={
      id:def.id,
      title:def.title,
      desc:def.desc,
      target:Math.max(1,parseInt(def.target,10)||1),
      reward:def.reward,
      playerId:player?.id||null,
      progress:0,
      done:false,
      rewarded:false,
      assignedAt:Date.now(),
    };
  }
  return G.secretObjective;
}

function getMatchObjectiveProgress(objective,player){
  if(!objective||!player)return 0;
  const stats=ensurePlayerMatchStats(player);
  switch(objective.id){
    case 'collector':return stats.propertiesBought||0;
    case 'builder':return stats.housesBuilt||0;
    case 'voyager':return stats.passedGo||0;
    case 'rentier':return stats.rentCollected||0;
    case 'railmaster':return G.board.filter(cell=>cell&&cell.t==='railroad'&&cell.owner===player.id).length;
    default:return 0;
  }
}

function updateSecretObjectiveProgress(){
  if(!G.started){renderMatchObjectiveUi();return false;}
  const objective=ensureMatchObjectiveExists(false);
  const player=(G.players||[]).find(entry=>entry&&entry.id===objective?.playerId)||getControlledMatchPlayer();
  if(!objective||!player){renderMatchObjectiveUi();return false;}
  const target=Math.max(1,parseInt(objective.target,10)||1);
  const progress=Math.max(0,Math.min(target,getMatchObjectiveProgress(objective,player)));
  let changed=false;
  if(objective.progress!==progress){objective.progress=progress;changed=true;}
  if(progress>=target&&!objective.done){
    objective.done=true;
    changed=true;
  }
  if(objective.done&&!objective.rewarded){
    objective.rewarded=true;
    const rewardGranted=grantProfileReward(objective.reward);
    const localNote=canTrackProfileStatsInCurrentMatch()?'':' • sans progression profil en local/rapide';
    toast('🎯 Mission secrète réussie : '+objective.title+(rewardGranted?(' • '+getRewardText(objective.reward)):localNote),'a');
    if(rewardGranted){
      saveProfileData();
      if(typeof renderInventoryUi==='function')renderInventoryUi();
    }
  }
  renderMatchObjectiveUi();
  return changed;
}

function renderMatchObjectiveUi(){
  const card=document.getElementById('match-objective-card');
  const body=document.getElementById('match-objective-body');
  if(!card||!body)return;
  const titleEl=card.querySelector('.card-title');
  const questMode=normalizeMatchQuestMode(G.matchQuestMode);
  if(titleEl)titleEl.textContent=questMode==='open'?'🎯 Succès du match':'🎯 Mission secrète';
  if(!G.started||questMode==='off'){
    card.style.display='none';
    body.innerHTML='';
    return;
  }
  card.style.display='block';
  const objective=ensureMatchObjectiveExists(false);
  const player=(G.players||[]).find(entry=>entry&&entry.id===objective?.playerId)||getControlledMatchPlayer();
  if(!objective||!player){
    body.innerHTML='<div style="font-size:.68rem;color:var(--muted)">Mission en préparation…</div>';
    return;
  }
  const target=Math.max(1,parseInt(objective.target,10)||1);
  const progress=Math.max(0,Math.min(target,parseInt(objective.progress,10)||0));
  const pct=Math.max(8,Math.round((progress/target)*100));
  body.innerHTML=''+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'+
      '<div style="font-size:.8rem;font-weight:800">'+(objective.done?'✅ ':'🕵️ ')+escapeUiText(objective.title)+'</div>'+
      '<div style="font-size:.63rem;color:'+(objective.done?'#22c55e':'var(--muted)')+'">'+progress+'/'+target+'</div>'+
    '</div>'+
    '<div style="font-size:.67rem;color:var(--muted);margin-top:4px">'+escapeUiText(objective.desc)+'</div>'+
    '<div style="height:7px;margin-top:7px;border-radius:999px;background:rgba(148,163,184,.14);overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(objective.done?'linear-gradient(90deg,#22c55e,#4ade80)':'linear-gradient(90deg,#a855f7,#3b82f6)')+'"></div></div>'+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.64rem;color:var(--muted);margin-top:6px">'+
      '<span>Joueur : <b style="color:'+escapeUiText(player.color||'#fff')+'">'+escapeUiText(player.name||'Joueur')+'</b></span>'+
      '<span>Récompense : '+escapeUiText(getRewardText(objective.reward))+'</span>'+
    '</div>';
}

function pushTurnHistory(msg,type='i'){
  const text=String(msg||'').trim();
  if(!text)return;
  const prev=G.turnHistory?.[0];
  if(prev&&prev.msg===text&&prev.type===type)return;
  if(!Array.isArray(G.turnHistory))G.turnHistory=[];
  G.turnHistory.unshift({msg:text,type,category:getActivityCategory(text,type),turn:Math.max(1,parseInt(G.turnCount,10)||1),ts:Date.now()});
  if(G.turnHistory.length>24)G.turnHistory.length=24;
  renderTurnHistory();
}

function renderTurnHistory(){
  const full=document.getElementById('turn-history-list');
  const mini=document.getElementById('turn-history-mini');
  const filterEl=document.getElementById('turn-history-filter');
  const filter=String((filterEl&&filterEl.value)||G.historyFilter||'all');
  G.historyFilter=filter;
  const source=Array.isArray(G.turnHistory)?G.turnHistory:[];
  const entries=(filter==='all'?source:source.filter(entry=>entry&&entry.category===filter)).slice(0,8);
  const sig=filter+'|'+entries.map(entry=>(entry.ts||0)+'::'+entry.msg).join('|');
  if(G.turnHistoryRenderSig===sig)return;
  G.turnHistoryRenderSig=sig;
  const renderList=(list,compact)=>{
    if(!list)return;
    if(!entries.length){
      list.innerHTML='<div style="font-size:.68rem;color:var(--muted)">Les derniers moments clés de la partie apparaîtront ici.</div>';
      return;
    }
    list.innerHTML=entries.slice(0,compact?4:8).map(entry=>{
      const color=entry.type==='a'?'#22c55e':(entry.type==='d'?'#f87171':(entry.type==='w'?'#fbbf24':'#93c5fd'));
      return '<div style="display:flex;align-items:flex-start;gap:7px;padding:'+(compact?'5px 6px':'7px 8px')+';border:1px solid var(--border);border-radius:9px;background:var(--s2)">'+
        '<span style="width:8px;height:8px;border-radius:999px;background:'+color+';margin-top:5px;flex-shrink:0"></span>'+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-size:'+(compact?'.64rem':'.68rem')+';color:var(--muted);margin-bottom:2px">Tour '+(entry.turn||1)+' • '+escapeUiText(entry.category||'info')+'</div>'+
          '<div style="font-size:'+(compact?'.69rem':'.74rem')+';line-height:1.35">'+escapeUiText(entry.msg)+'</div>'+
        '</div>'+
      '</div>';
    }).join('');
  };
  renderList(full,false);
  renderList(mini,true);
}

function getHouseCost(cell){
  const base=Math.floor((cell?.p||0)*0.5);
  const ev=G.boardEvent&&((G.turnCount||1)<=(G.boardEvent.untilTurn||0))?G.boardEvent:null;
  if(ev?.houseDiscount)return Math.max(20,Math.round(base*ev.houseDiscount));
  return base;
}

function normalizeTeamModePreset(value){
  const raw=String(value||'off').toLowerCase();
  return raw==='2v2'||raw==='2v2v2'?raw:'off';
}

function getTeamModeRequirement(preset){
  const mode=normalizeTeamModePreset(preset);
  if(mode==='2v2')return 4;
  if(mode==='2v2v2')return 6;
  return 0;
}

function getTeamModeIds(preset){
  const mode=normalizeTeamModePreset(preset);
  if(mode==='2v2')return ['team-a','team-b'];
  if(mode==='2v2v2')return ['team-a','team-b','team-c'];
  return [];
}

function getTeamModeLabel(preset){
  const mode=normalizeTeamModePreset(preset);
  return mode==='2v2'?'2v2':mode==='2v2v2'?'2v2v2':'Désactivé';
}

function getTeamLabel(teamId){
  return teamId==='team-a'?'Équipe A':teamId==='team-b'?'Équipe B':teamId==='team-c'?'Équipe C':'Solo';
}

function getTeamMembers(teamId,aliveOnly=false){
  return (G.players||[]).filter(player=>player&&player.teamId===teamId&&(!aliveOnly||!player.bust));
}

function clearTeamMode(){
  G.teamMode=false;
  G.teamModeFormat='off';
  (G.players||[]).forEach(player=>{ if(player)player.teamId=null; });
}

function setupTeamMode(){
  clearTeamMode();
  const preset=normalizeTeamModePreset(G.teamModePreset);
  const teamIds=getTeamModeIds(preset);
  const requiredPlayers=getTeamModeRequirement(preset);
  if(!teamIds.length||!requiredPlayers){renderAlliancePanel();return false;}
  if((G.players?.length||0)!==requiredPlayers){renderAlliancePanel();return false;}
  (G.players||[]).forEach((player,index)=>{ player.teamId=teamIds[index%teamIds.length]; });
  G.teamMode=true;
  G.teamModeFormat=preset;
  const versus=teamIds.map(teamId=>getTeamMembers(teamId).map(p=>p.name).join(' + ')).filter(Boolean).join(' VS ');
  glog('🤝 Mode '+getTeamModeLabel(preset)+' activé : '+versus+'.','a');
  renderAlliancePanel();
  return true;
}

function arePlayersAllied(p1,p2){
  return !!(G.teamMode&&p1&&p2&&p1.id!==p2.id&&p1.teamId&&p1.teamId===p2.teamId);
}

function checkTeamVictory(){
  if(!G.teamMode)return false;
  const teamIds=[...new Set((G.players||[]).map(player=>player?.teamId).filter(Boolean))];
  const aliveTeams=teamIds.filter(teamId=>getTeamMembers(teamId,true).length>0);
  if(aliveTeams.length>1)return false;
  const survivors=aliveTeams[0]?getTeamMembers(aliveTeams[0],true):[];
  endGame(survivors.sort((a,b)=>(b.money||0)-(a.money||0))[0]||null);
  return true;
}

function renderAlliancePanel(){
  const panel=document.getElementById('alliance-panel');
  const status=document.getElementById('alliance-status');
  if(!panel||!status)return;
  if(!G.started){panel.style.display='none';return;}
  panel.style.display='block';
  const preset=normalizeTeamModePreset(G.teamModePreset);
  const requiredPlayers=getTeamModeRequirement(preset);
  if(G.teamMode){
    const teamIds=getTeamModeIds(G.teamModeFormat||preset);
    const versus=teamIds.map(teamId=>{
      const members=getTeamMembers(teamId).map(p=>p.emoji+' '+p.name).join(' • ');
      return '<b>'+getTeamLabel(teamId)+'</b> : '+escapeUiText(members||'—');
    }).join(' <span style="color:var(--muted)">VS</span> ');
    status.innerHTML='<b>'+getTeamModeLabel(G.teamModeFormat||preset)+' actif</b> — '+versus+'<div style="font-size:.66rem;color:var(--muted);margin-top:4px">Les alliés paient 50% du loyer et gagnent ensemble.</div>';
    return;
  }
  if(preset==='off'){
    status.innerHTML='Mode équipes <b>désactivé</b> pour cette partie. Active <b>2v2</b> ou <b>2v2v2</b> dans les paramètres si tu veux jouer en duo.';
    return;
  }
  status.innerHTML='Option <b>'+getTeamModeLabel(preset)+'</b> sélectionnée, mais il faut <b>'+requiredPlayers+' joueurs</b> pour l\'activer.';
}

function createDynamicBoardEvent(){
  const turn=Math.max(1,parseInt(G.turnCount,10)||1);
  const colors=[...new Set((G.board||[]).filter(cell=>cell&&cell.t==='property'&&cell.c).map(cell=>cell.c))];
  const targetColor=colors[Math.floor(Math.random()*colors.length)]||'#22c55e';
  const sampleCell=(G.board||[]).find(cell=>cell&&cell.c===targetColor&&cell.t==='property');
  const districtLabel=sampleCell?('du secteur '+sampleCell.n):'du secteur ciblé';
  const pool=[
    {id:'rent_surge',label:'💥 Boom des loyers',desc:'Les propriétés '+districtLabel+' rapportent +60% pendant 2 tours.',untilTurn:turn+2,targetColor,rentMultiplier:1.6,weight:14,theme:'danger'},
    {id:'golden_block',label:'🏙️ Quartier en vedette',desc:'Les propriétés '+districtLabel+' rapportent presque le double pendant 2 tours.',untilTurn:turn+2,targetColor,rentMultiplier:1.9,weight:8,theme:'danger'},
    {id:'go_festival',label:'🎉 Festival du départ',desc:'Le bonus Départ est augmenté de 50% pendant 3 tours.',untilTurn:turn+3,goBonusMultiplier:1.5,weight:12,theme:'celebration'},
    {id:'go_parade',label:'🎊 Parade municipale',desc:'Le bonus Départ grimpe de 75% pendant 2 tours.',untilTurn:turn+2,goBonusMultiplier:1.75,weight:7,theme:'celebration'},
    {id:'builder_sale',label:'🏗️ Salon du BTP',desc:'Le coût des maisons baisse de 30% pendant 2 tours.',untilTurn:turn+2,houseDiscount:0.7,weight:12,theme:'industry'},
    {id:'mega_cranes',label:'🧱 Chantier géant',desc:'Les constructions sont en promo massive (-45%) pendant 2 tours.',untilTurn:turn+2,houseDiscount:0.55,weight:6,theme:'industry'},
    {id:'utility_blackout',label:'⚡ Blackout',desc:'Les compagnies ne rapportent plus pendant 2 tours.',untilTurn:turn+2,zeroUtility:true,weight:10,theme:'storm'},
    {id:'rail_rush',label:'🚂 Rush ferroviaire',desc:'Les gares rapportent +50% pendant 2 tours.',untilTurn:turn+2,railroadBonus:1.5,weight:10,theme:'rail'},
    {id:'cargo_week',label:'🚚 Semaine logistique',desc:'Les gares explosent à +90% pendant 2 tours.',untilTurn:turn+2,railroadBonus:1.9,weight:6,theme:'rail'},
    {id:'market_heat',label:'📈 Marché en surchauffe',desc:'Tous les loyers montent de 20% pendant 2 tours.',untilTurn:turn+2,globalRentMultiplier:1.2,weight:8,theme:'danger'},
  ];
  const bannerId='we_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6);
  const totalWeight=pool.reduce((sum,entry)=>sum+Math.max(1,parseInt(entry.weight,10)||1),0);
  let roll=Math.random()*totalWeight;
  for(const entry of pool){
    roll-=Math.max(1,parseInt(entry.weight,10)||1);
    if(roll<=0)return Object.assign({bannerId},entry);
  }
  return pool[0]?Object.assign({bannerId},pool[0]):null;
}

function getActiveBoardEvent(){
  const ev=G.boardEvent;
  if(!ev)return null;
  if((G.turnCount||1)>(ev.untilTurn||0)){
    G.boardEvent=null;
    renderBoardEventUi();
    return null;
  }
  return ev;
}

function maybeTriggerBoardEvent(force=false){
  if(!G.started)return false;
  const eventMode=normalizeWorldEventMode(G.worldEventMode);
  if(eventMode==='off')return false;
  if(!force){
    const turn=Math.max(1,parseInt(G.turnCount,10)||1);
    const minTurn=eventMode==='wild'?3:4;
    const gapNeeded=eventMode==='wild'?2:3;
    if(turn<minTurn)return false;
    if((turn-(G.lastBoardEventTurn||0))<gapNeeded)return false;
    const chance=eventMode==='wild'?0.42:0.24;
    if(Math.random()>chance)return false;
  }
  const next=createDynamicBoardEvent();
  if(!next)return false;
  G.boardEvent=next;
  G.lastBoardEventTurn=G.turnCount||1;
  glog('🌩️ '+next.label+' — '+next.desc,'a');
  toast(next.label,'a');
  showWorldEventBanner(next);
  renderBoardEventUi();
  broadcast?.();
  return true;
}

function showWorldEventBanner(ev){
  const banner=document.getElementById('world-event-banner');
  if(!banner||!ev)return;
  const labelParts=String(ev.label||'🌩️ Événement mondial').trim().split(/\s+/);
  const leadIcon=labelParts.shift()||'🌩️';
  const titleText=labelParts.join(' ')||String(ev.label||'Événement mondial');
  const theme=String(ev.theme||'default');
  banner.innerHTML=''+
    '<div class="world-event-banner-card theme-'+escapeUiText(theme)+'">'+
      '<div class="world-event-banner-chip">🌩️ ÉVÉNEMENT MONDIAL</div>'+
      '<div class="world-event-banner-head">'+
        '<div class="world-event-banner-icon">'+escapeUiText(leadIcon)+'</div>'+
        '<div><div class="world-event-banner-title">'+escapeUiText(titleText)+'</div><div class="world-event-banner-desc">'+escapeUiText(ev.desc||'Un nouvel événement mondial influence la partie.')+'</div></div>'+
      '</div>'+
      '<div class="world-event-banner-meta">Actif jusqu’au tour '+(parseInt(ev.untilTurn,10)||Math.max(1,parseInt(G.turnCount,10)||1))+'</div>'+
    '</div>';
  banner.classList.add('open');
  if(showWorldEventBanner._timer)clearTimeout(showWorldEventBanner._timer);
  showWorldEventBanner._timer=setTimeout(()=>{
    banner.classList.remove('open');
  },3200);
}

function renderBoardEventUi(){
  const card=document.getElementById('board-event-card');
  const status=document.getElementById('board-event-status');
  if(!card||!status)return;
  if(!G.started){card.style.display='none';return;}
  card.style.display='block';
  const eventMode=normalizeWorldEventMode(G.worldEventMode);
  if(eventMode==='off'){
    status.innerHTML='Événements mondiaux <b>désactivés</b> pour cette partie. Active-les dans les paramètres pour ajouter du mouvement.';
    return;
  }
  const ev=getActiveBoardEvent();
  if(!ev){
    status.innerHTML='Aucun événement actif. <span style="color:var(--muted)">Le prochain peut tomber aléatoirement à partir du tour '+Math.max(4,(G.lastBoardEventTurn||1)+3)+'.</span>';
    return;
  }
  status.innerHTML='<b>'+escapeUiText(ev.label)+'</b><div style="font-size:.66rem;color:var(--muted);margin-top:4px">'+escapeUiText(ev.desc)+' • fin au tour '+(ev.untilTurn||G.turnCount||1)+'</div>';
}

function normalizePartyMode(value,allowed,fallback){
  const raw=String(value??fallback).toLowerCase();
  return allowed.includes(raw)?raw:fallback;
}
function normalizeStartDraftMode(value){return normalizePartyMode(value,['off','light','strategic'],'off');}
function getStartDraftModeLabel(mode){return mode==='light'?'Léger':mode==='strategic'?'Tactique':'Off';}
function normalizeWorldEventMode(value){return normalizePartyMode(value,['off','normal','wild'],'normal');}
function getWorldEventModeLabel(mode){return mode==='wild'?'Furieux':mode==='off'?'Off':'Normal';}
function normalizeSurvivalMode(value){return normalizePartyMode(value,['off','soft','hard'],'off');}
function getSurvivalModeLabel(mode){return mode==='hard'?'Hardcore':mode==='soft'?'Soft':'Off';}
function normalizeBossBotMode(value){return normalizePartyMode(value,['off','standard','nightmare'],'off');}
function getBossBotModeLabel(mode){return mode==='nightmare'?'Boss+':mode==='standard'?'Boss':'Off';}
function normalizeSpecialPowersMode(value){return normalizePartyMode(value,['off','normal','chaos'],'normal');}
function getSpecialPowersModeLabel(mode){return mode==='chaos'?'Chaos':mode==='off'?'Off':'Actif';}
function normalizeRematchMode(value){return normalizePartyMode(value,['standard','vote','instant'],'standard');}
function getRematchModeLabel(mode){return mode==='vote'?'Vote express':mode==='instant'?'Instantanée':'Standard';}
function normalizeMatchQuestMode(value){return normalizePartyMode(value,['off','secret','open'],'secret');}
function getMatchQuestModeLabel(mode){return mode==='open'?'Visible':mode==='secret'?'Secrète':'Off';}
function normalizeFogMode(value){return normalizePartyMode(value,['off','soft','hard'],'off');}
function getFogModeLabel(mode){return mode==='hard'?'Dense':mode==='soft'?'Léger':'Off';}

function renderPartyModePreview(){
  const preview=document.getElementById('party-mode-preview');
  const quick=document.getElementById('party-quick-summary');
  const draft=normalizeStartDraftMode(G.startDraftMode);
  const events=normalizeWorldEventMode(G.worldEventMode);
  const survival=normalizeSurvivalMode(G.survivalMode);
  const boss=normalizeBossBotMode(G.bossBotMode);
  const powers=normalizeSpecialPowersMode(G.specialPowersMode);
  const rematch=normalizeRematchMode(G.rematchMode);
  const quests=normalizeMatchQuestMode(G.matchQuestMode);
  const fog=normalizeFogMode(G.fogMode);
  const chips=[];
  const addChip=(icon,label,cls='')=>chips.push('<span class="party-mini-badge '+cls+'">'+icon+' '+escapeUiText(label)+'</span>');
  if(draft!=='off')addChip('🎁','Draft '+getStartDraftModeLabel(draft),'mode');
  if(events!=='off')addChip('🌩️','Events '+getWorldEventModeLabel(events),'mode');
  if(survival!=='off')addChip('☣️','Survie '+getSurvivalModeLabel(survival),'warn');
  if(boss!=='off')addChip('👑','Boss IA '+getBossBotModeLabel(boss),'warn');
  if(powers!=='off')addChip('✨','Pouvoirs '+getSpecialPowersModeLabel(powers),'reward');
  if(rematch!=='standard')addChip('🔁','Revanche '+getRematchModeLabel(rematch),'info');
  if(quests!=='off')addChip('🎯','Quêtes '+getMatchQuestModeLabel(quests),'reward');
  if(fog!=='off')addChip('🌫️','Brouillard '+getFogModeLabel(fog),'warn');
  if(G.tutorialHintsEnabled)addChip('🧭','Coach visuel','info');
  if(G.endTurnSummaryEnabled)addChip('📋','Résumé fin tour','info');
  const intensityScore=(draft!=='off'?1:0)+(events==='wild'?2:(events!=='off'?1:0))+(survival!=='off'?2:0)+(boss!=='off'?1:0)+(powers==='chaos'?2:(powers!=='off'?1:0))+(fog!=='off'?1:0);
  const intensityLabel=intensityScore>=7?'🔥 Extrême':(intensityScore>=4?'⚡ Dynamique':'🎯 Classique');
  const objectiveLabel=G.goalMoney>0?('Objectif '+G.goalMoney+'$'):(G.dominationTarget>0?('Domination x'+G.dominationTarget):'Élimination / richesse');
  if(preview){
    preview.innerHTML='<div class="party-preview-title">Aperçu live — '+escapeUiText(intensityLabel)+'</div>'+
      '<div class="party-preview-sub">Départ '+G.startingMoney+'$ • Bonus '+G.passGoBonus+'$ • '+escapeUiText(objectiveLabel)+'</div>'+
      '<div class="party-preview-tags">'+(chips.length?chips.join(''):'<span class="party-mini-badge muted">Mode classique et lisible</span>')+'</div>';
  }
  if(quick){
    quick.innerHTML='<div style="font-weight:800;color:var(--text)">Départ '+G.startingMoney+'$ • Bonus '+G.passGoBonus+'$ • Amende '+G.jailFine+'$</div>'+
      '<div class="party-preview-tags" style="margin-top:5px">'+(chips.length?chips.join(''):'<span class="party-mini-badge muted">Classique</span>')+'</div>';
  }
  const states={
    'mode-card-draft':draft!=='off',
    'mode-card-world':events!=='off',
    'mode-card-survival':survival!=='off',
    'mode-card-boss':boss!=='off',
    'mode-card-powers':powers!=='off',
    'mode-card-rematch':rematch!=='standard',
    'mode-card-quests':quests!=='off',
    'mode-card-fog':fog!=='off',
    'mode-card-coach':!!G.tutorialHintsEnabled,
    'mode-card-summary':!!G.endTurnSummaryEnabled,
  };
  Object.entries(states).forEach(([id,active])=>{
    const el=document.getElementById(id);
    if(el)el.dataset.active=active?'1':'0';
  });
}

function applyStartingDraftBonuses(){
  const mode=normalizeStartDraftMode(G.startDraftMode);
  if(mode==='off'||!Array.isArray(G.players)||!G.players.length)return false;
  const pool=(mode==='strategic'
    ?[
      {label:'💰 Prime 250$',apply:p=>{p.money+=250;}},
      {label:'⚡ 2 boosters',apply:p=>{p.matchItems.diceBoost=(p.matchItems.diceBoost||0)+2;}},
      {label:'👻 Passe-fantôme',apply:p=>{p.ghostPass=(parseInt(p.ghostPass,10)||0)+1;}},
      {label:'🛡️ Anti-prison',apply:p=>{p.matchItems.antiJail=(p.matchItems.antiJail||0)+1;}},
    ]
    :[
      {label:'💰 Prime 150$',apply:p=>{p.money+=150;}},
      {label:'⚡ Booster',apply:p=>{p.matchItems.diceBoost=(p.matchItems.diceBoost||0)+1;}},
      {label:'🏦 Remise hypo',apply:p=>{p.matchItems.mortgageDiscount=(p.matchItems.mortgageDiscount||0)+1;}},
      {label:'🃏 Sortie prison',apply:p=>{p.jailCards=(p.jailCards||0)+1;}},
    ]).sort(()=>Math.random()-.5);
  G.players.forEach((player,index)=>{
    if(!player)return;
    const bonus=pool[index%pool.length];
    if(!bonus||typeof bonus.apply!=='function')return;
    bonus.apply(player);
    player.openingBonusLabel=bonus.label;
    glog('🎁 '+player.name+' démarre avec '+bonus.label+'.','a');
  });
  return true;
}

function assignBossBotLeader(){
  (G.players||[]).forEach(player=>{if(player)player.isBossBot=false;});
  const mode=normalizeBossBotMode(G.bossBotMode);
  if(mode==='off')return null;
  const bots=(G.players||[]).filter(player=>player&&player.bot&&!player.bust);
  if(!bots.length)return null;
  const weights={easy:1,medium:2,hard:3};
  const boss=[...bots].sort((a,b)=>(weights[b.botLevel]||0)-(weights[a.botLevel]||0))[0]||bots[0];
  boss.isBossBot=true;
  boss.botLevel='hard';
  ensureBotPersona(boss,mode==='nightmare'?'shark':'tycoon');
  boss.money+=mode==='nightmare'?350:180;
  boss.matchItems=boss.matchItems||{diceBoost:0,antiJail:0,mortgageDiscount:0};
  boss.matchItems.diceBoost=(boss.matchItems.diceBoost||0)+(mode==='nightmare'?2:1);
  glog('👑 Boss IA activé : '+boss.name+' entre en scène en mode '+getBossBotModeLabel(mode)+'.','a');
  return boss;
}

function applySurvivalTurnPulse(){
  const mode=normalizeSurvivalMode(G.survivalMode);
  if(!G.started||mode==='off')return false;
  const every=mode==='hard'?3:4;
  if((G.turnCount||1)<every||((G.turnCount||1)%every)!==0)return false;
  const fee=mode==='hard'?110:60;
  const targets=(G.players||[]).filter(player=>player&&!player.bust);
  if(!targets.length)return false;
  targets.forEach(player=>{
    player.money-=fee;
    recordTxn(player,-fee,'Mode survie: pression économique');
  });
  glog('☣️ Pression de survie : tous les joueurs perdent '+fee+'$.','w');
  toast('☣️ Mode survie : -'+fee+'$ pour tous','w');
  targets.forEach(player=>checkBust(player));
  return true;
}

function startRematch(){
  if(!Array.isArray(G.players)||G.players.length<2){toast('Ajoute au moins 2 joueurs pour une revanche.','w');return;}
  const canStart=G.mode==='local'||(G.mode==='online'&&G.myId&&String(G.myId).startsWith('h-'));
  if(!canStart){toast('Seul l’hôte peut lancer la revanche.','w');return;}
  const mode=normalizeRematchMode(G.rematchMode);
  if(mode==='vote'&&!confirm('Lancer une revanche avec le même lobby et rotation du premier joueur ?'))return;
  G.pendingRematch=true;
  G.rematchCount=Math.max(0,parseInt(G.rematchCount,10)||0)+1;
  if(!(G.rematchStarterIndex>=0))G.rematchStarterIndex=0;
  toast(mode==='instant'?'🔁 Revanche instantanée lancée !':'🔁 Revanche prête !','a');
  doStart();
}

// Keep profile UI synchronized across tabs/pages on the same origin.
window.addEventListener('storage',(ev)=>{
  if(!ev||ev.key!==PROFILE_KEY)return;
  loadProfile({skipPersist:true});
});
if(PROFILE_SYNC_BUS){
  PROFILE_SYNC_BUS.onmessage=(ev)=>{
    const m=ev&&ev.data;
    if(!m||m.type!=='profile_updated')return;
    loadProfile({skipPersist:true});
  };
}

async function resolvePublicIp(){
  const ctl=new AbortController();
  const t=setTimeout(()=>ctl.abort(),3500);
  try{
    const r=await fetch('https://api64.ipify.org?format=json',{signal:ctl.signal});
    if(!r.ok)throw new Error('ip fetch failed');
    const d=await r.json();
    return String(d?.ip||'').trim();
  }catch(e){
    return '';
  }finally{clearTimeout(t);}
}

function hasAdminDebugAccess(notify){
  const allowed=!!P?.isAdmin;
  if(!allowed&&notify)toast('Accès réservé aux admins.','w');
  return allowed;
}

function setDebugMenuVisibility(allowed,msg){
  const card=document.getElementById('debug-tools-card');
  const info=document.getElementById('debug-access-msg');
  const backdrop=document.getElementById('debug-tools-window-backdrop');
  if(card){
    card.dataset.allowed=allowed?'1':'0';
    if(!document.body?.classList.contains('debug-tools-window-open'))card.style.display='none';
  }
  if(backdrop&&!allowed)backdrop.classList.remove('open');
  if(!allowed)document.body?.classList.remove('debug-tools-window-open');
  if(info)info.textContent=msg||(allowed?'Acces administrateur autorise.':'Acces reserve aux admins.');
}

async function initDebugAccessControl(){
  const allowed=hasAdminDebugAccess(false);
  setDebugMenuVisibility(allowed,allowed?'Acces administrateur autorise.':'Acces reserve aux admins.');
}

async function rebindDebugOwnerIp(source='debug'){
  const curIp=await resolvePublicIp();
  if(!curIp){toast('Impossible de resoudre ton IP.','w');return;}
  localStorage.setItem(DEBUG_OWNER_IP_KEY,curIp);
  await initDebugAccessControl();
  toast(source==='code'?'🔐 IP proprietaire reassignee via code admin':'🛡️ IP proprietaire reassignee','a');
}

function debugRebindOwnerIp(){
  rebindDebugOwnerIp('debug');
}

function getProfileDefaultName(fallback='Joueur'){
  return String(P?.name||'').trim()||fallback;
}

function getProfileDefaultEmoji(fallback='🐱'){
  return String(P?.emoji||'').trim()||fallback;
}

function getProfileDefaultAvatar(){
  return P?.avatarImg||null;
}

function getProfileDefaultColor(fallback='#22c55e'){
  const color=String(P?.color||'').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color)?color:fallback;
}

function syncPartyProfileDefaults(){
  ['cr-color','jn-color','lc-color'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.value=getProfileDefaultColor(el.value||'#22c55e');
  });

  const defaultName=getProfileDefaultName('Joueur');
  const defaultWs=getDefaultWsUrl();
  const looksLikeEndpoint=(v)=>/^(wss?|https?):\/\//i.test(String(v||'').trim())||/^localhost:\d+$/i.test(String(v||'').trim());

  ['cr-name','jn-name'].forEach(id=>{
    const input=document.getElementById(id);
    if(!input)return;
    const cur=String(input.value||'').trim();
    if(!cur||looksLikeEndpoint(cur))input.value=defaultName;
  });

  ['cr-ws','jn-ws','social-ws-url'].forEach(id=>{
    const input=document.getElementById(id);
    if(!input)return;
    const cur=String(input.value||'').trim();
    if(!cur||!looksLikeEndpoint(cur))input.value=defaultWs;
  });
}

function resolvePlayerIdentity(nameInputId,emojiInputId,fallbackName='Joueur',fallbackEmoji='🐱'){
  const nameInput=document.getElementById(nameInputId);
  const emojiInput=document.getElementById(emojiInputId);
  const rawName=String(nameInput?.value||'').trim();
  const rawEmoji=String(emojiInput?.value||'').trim();
  const rawImg=emojiInput?.getAttribute('data-img')||null;
  const unlocked=getUnlockedEmojis();
  const safeFallback=unlocked.includes(fallbackEmoji)?fallbackEmoji:unlocked[0];
  const safeRawEmoji=isEmojiUnlocked(rawEmoji)?rawEmoji:'';
  const name=rawName||getProfileDefaultName(fallbackName);
  if(safeRawEmoji||rawImg){
    return {name,emoji:safeRawEmoji||safeFallback,img:rawImg};
  }
  const profileEmoji=getProfileDefaultEmoji(safeFallback);
  const safeProfileEmoji=isEmojiUnlocked(profileEmoji)?profileEmoji:safeFallback;
  return {
    name,
    emoji:safeProfileEmoji,
    img:getProfileDefaultAvatar(),
  };
}

const PARTY_SNAPSHOT_KEY='neopoly_party_snapshot_v1';
const PARTY_PRESET_KEY='neopoly_party_presets_v1';
const AUDIO_PREFS_KEY='neopoly_audio_prefs_v1';
const CLIENT_UI_PREFS_KEY='neopoly_client_ui_prefs_v1';
const JOIN_BROWSER_PREFS_KEY='neopoly_join_browser_prefs_v1';

const CLIENT_UI={
  cellScale:100,
};

const AUDIO_ENGINE={
  ctx:null,
  master:null,
  musicGain:null,
  sfxGain:null,
  bgAudio:null,
  bgSource:null,
  bgBoostGain:null,
  packQueue:[],
  packIndex:0,
  userTracks:[],
  userQueue:[],
  userIndex:0,
  theme:'none',
  timer:null,
  step:0,
  unlocked:false,
};

const DA_THEMES={
  aurora:{label:'Aurora néon',meta:'#050816'},
  arcade:{label:'Arcade pop',meta:'#14061f'},
  royal:{label:'Royal gold',meta:'#120d07'},
  midnight:{label:'Midnight blue',meta:'#04131f'},
};

const MUSIC_THEMES={
  aurora:{
    label:'Aurora lounge',
    lobby:{stepMs:680,sequence:[
      {f:[220.0,329.63,493.88],d:.82,v:.07,t:['sine','triangle','sine']},
      {f:[220.0,369.99,554.37],d:.75,v:.068,t:['sine','triangle','sine']},
      {f:[196.0,293.66,440.0],d:.84,v:.072,t:['sine','triangle','sine']},
      {f:[246.94,369.99,523.25],d:.7,v:.07,t:['sine','triangle','sine']},
      {f:[261.63,392.0,587.33],d:.78,v:.074,t:['triangle','sine','sine']},
      {f:[246.94,369.99,554.37],d:.74,v:.07,t:['sine','triangle','sine']},
      {f:[220.0,329.63,493.88],d:.92,v:.068,t:['sine','triangle','sine']},
      {f:0,d:.2,v:0,t:'sine'},
    ]},
    game:{stepMs:360,sequence:[
      {f:[110.0,220.0,329.63],d:.24,v:.11,t:['triangle','square','sine']},
      {f:[110.0,246.94,369.99],d:.22,v:.105,t:['triangle','square','sine']},
      {f:[123.47,246.94,392.0],d:.24,v:.108,t:['triangle','square','triangle']},
      {f:[146.83,293.66,440.0],d:.22,v:.11,t:['triangle','square','triangle']},
      {f:[164.81,329.63,493.88],d:.24,v:.108,t:['triangle','square','sine']},
      {f:[146.83,293.66,440.0],d:.2,v:.1,t:['triangle','square','triangle']},
      {f:[123.47,246.94,392.0],d:.22,v:.104,t:['triangle','square','triangle']},
      {f:[110.0,220.0,349.23],d:.28,v:.11,t:['triangle','square','sine']},
    ]},
  },
  arcade:{
    label:'Arcade pulse',
    lobby:{stepMs:520,sequence:[
      {f:[261.63,392.0,523.25],d:.32,v:.085,t:['square','triangle','sine']},
      {f:[293.66,440.0,587.33],d:.3,v:.082,t:['square','triangle','sine']},
      {f:[329.63,493.88,659.25],d:.28,v:.08,t:['square','triangle','sine']},
      {f:[293.66,440.0,587.33],d:.3,v:.082,t:['square','triangle','sine']},
      {f:[246.94,392.0,523.25],d:.36,v:.078,t:['square','triangle','sine']},
      {f:0,d:.16,v:0,t:'sine'},
    ]},
    game:{stepMs:280,sequence:[
      {f:[130.81,261.63,523.25],d:.16,v:.115,t:['square','square','triangle']},
      {f:[146.83,293.66,587.33],d:.15,v:.112,t:['square','square','triangle']},
      {f:[164.81,329.63,659.25],d:.16,v:.114,t:['square','square','triangle']},
      {f:[174.61,349.23,698.46],d:.14,v:.11,t:['square','square','triangle']},
      {f:[164.81,329.63,659.25],d:.16,v:.112,t:['square','square','triangle']},
      {f:[146.83,293.66,587.33],d:.15,v:.11,t:['square','square','triangle']},
      {f:[130.81,261.63,523.25],d:.18,v:.115,t:['square','square','triangle']},
      {f:0,d:.12,v:0,t:'sine'},
    ]},
  },
  royal:{
    label:'Royal casino',
    lobby:{stepMs:760,sequence:[
      {f:[196.0,293.66,392.0],d:.68,v:.074,t:['triangle','sine','sine']},
      {f:[220.0,329.63,440.0],d:.66,v:.076,t:['triangle','sine','sine']},
      {f:[246.94,349.23,493.88],d:.64,v:.078,t:['triangle','sine','sine']},
      {f:[261.63,392.0,523.25],d:.72,v:.08,t:['triangle','sine','sine']},
      {f:[220.0,329.63,440.0],d:.8,v:.074,t:['triangle','sine','sine']},
      {f:0,d:.22,v:0,t:'sine'},
    ]},
    game:{stepMs:390,sequence:[
      {f:[98.0,196.0,293.66],d:.24,v:.11,t:['triangle','square','sine']},
      {f:[110.0,220.0,329.63],d:.24,v:.112,t:['triangle','square','sine']},
      {f:[123.47,246.94,349.23],d:.24,v:.112,t:['triangle','square','sine']},
      {f:[130.81,261.63,392.0],d:.26,v:.114,t:['triangle','square','sine']},
      {f:[123.47,246.94,349.23],d:.24,v:.108,t:['triangle','square','sine']},
      {f:[110.0,220.0,329.63],d:.24,v:.108,t:['triangle','square','sine']},
      {f:0,d:.14,v:0,t:'sine'},
    ]},
  },
  midnight:{
    label:'Night drive',
    lobby:{stepMs:640,sequence:[
      {f:[174.61,261.63,392.0],d:.74,v:.07,t:['sine','triangle','sine']},
      {f:[196.0,293.66,440.0],d:.72,v:.072,t:['sine','triangle','sine']},
      {f:[220.0,329.63,493.88],d:.7,v:.074,t:['sine','triangle','sine']},
      {f:[196.0,293.66,440.0],d:.72,v:.07,t:['sine','triangle','sine']},
      {f:[164.81,246.94,392.0],d:.8,v:.068,t:['sine','triangle','sine']},
      {f:0,d:.2,v:0,t:'sine'},
    ]},
    game:{stepMs:340,sequence:[
      {f:[92.5,185.0,277.18],d:.2,v:.108,t:['triangle','square','triangle']},
      {f:[103.83,207.65,311.13],d:.2,v:.108,t:['triangle','square','triangle']},
      {f:[116.54,233.08,349.23],d:.2,v:.108,t:['triangle','square','triangle']},
      {f:[123.47,246.94,369.99],d:.22,v:.11,t:['triangle','square','triangle']},
      {f:[116.54,233.08,349.23],d:.2,v:.108,t:['triangle','square','triangle']},
      {f:[103.83,207.65,311.13],d:.2,v:.106,t:['triangle','square','triangle']},
      {f:[92.5,185.0,277.18],d:.24,v:.11,t:['triangle','square','triangle']},
      {f:0,d:.12,v:0,t:'sine'},
    ]},
  },
};

const ASIAN_MUSIC_BASE='file:///F:/dl%20c/asianempiresmusicpack/Asian_Empires_Music_Pack/M4A/';
const ASIAN_MUSIC_FILES=[
  'Battle_-_Dragon_Dance.m4a','Battle_-_Horse_Archers.m4a','Battle_-_Seven_Samurai.m4a','Battle_-_Sunset_Duel.m4a',
  'Battle_-_Swords_Drawn.m4a','Dungeon_-_Lost_Souls_Maze.m4a','Dungeon_-_Prison_Cells.m4a','Dungeon_-_Under_The_Palace.m4a',
  'Field_-_Pyroclastic_Plateau.m4a','Field_-_Shogun\'s_Domain.m4a','Field_-_Snowy_Pathways.m4a','Field_-_Ten_Thousand_Miles.m4a',
  'Field_-_The_Great_Steppe.m4a','Theme_-_Eternal_Dynasty.m4a','Theme_-_Jade_Princess.m4a','Town_-_Farming_Village.m4a',
  'Town_-_Fishing_Boats.m4a','Town_-_Hidden_Temple.m4a','Town_-_Peasant_Life.m4a','Town_-_Wind_Shrine.m4a',
];

const DEFAULT_WS_PORT=3000;
const ONLINE_ROOM_MAX_PLAYERS=6;
let JOIN_MODE='browser';
let JOIN_ROOMS=[];
let JOIN_ROOM_FILTER='all';
let JOIN_ROOM_SORT='recent';
let JOIN_ROOM_REFRESH_TIMER=null;
let JOIN_ROOM_REFRESH_IN_FLIGHT=false;

// ── LOBBY TABS ──
function getDefaultWsUrl(){
  const renderOrigin=getGoogleApiBase();
  if(isRenderOrigin(renderOrigin)){
    return renderOrigin.replace(/^http/i,'ws');
  }
  const isSecure=window.location.protocol==='https:';
  const host=window.location.host||'localhost';
  if(isSecure){
    return 'wss://'+host;
  }
  const p=String(window.location.port||'');
  if(p==='5500'||p==='5173'){
    return 'ws://'+(window.location.hostname||'localhost')+':'+DEFAULT_WS_PORT;
  }
  return 'ws://'+host;
}

function initDefaultWsUrlInputs(){
  const defaultUrl=getDefaultWsUrl();
  ['cr-ws','jn-ws','social-ws-url'].forEach(id=>{
    const input=document.getElementById(id);
    if(!input) return;
    input.placeholder=defaultUrl;
    const current=(input.value||'').trim();
    if(!current||current==='wss://echo.websocket.org'){
      input.value=defaultUrl;
      return;
    }
    // Auto-fix old or stale Render WS values and keep a single healthy endpoint.
    try{
      const u=new URL(current);
      const sameHost=u.hostname===window.location.hostname;
      const forced3000=u.port==='3000';
      const onRender=String(window.location.hostname||'').toLowerCase().endsWith('.onrender.com');
      const currentRenderHost=String(u.hostname||'').toLowerCase().endsWith('.onrender.com');
      if((window.location.protocol==='https:'&&sameHost&&forced3000)||(onRender&&currentRenderHost&&current!==defaultUrl)){
        input.value=defaultUrl;
      }
    }catch(_){ }
  });
}

function loadJoinBrowserPrefs(){
  try{
    const raw=localStorage.getItem(JOIN_BROWSER_PREFS_KEY);
    if(!raw) return;
    const parsed=JSON.parse(raw);
    if(parsed&&['all','waiting','in_progress'].includes(parsed.filter)) JOIN_ROOM_FILTER=parsed.filter;
    if(parsed&&['recent','players','waiting'].includes(parsed.sort)) JOIN_ROOM_SORT=parsed.sort;
  }catch(_e){}
}

function saveJoinBrowserPrefs(){
  try{
    localStorage.setItem(JOIN_BROWSER_PREFS_KEY,JSON.stringify({filter:JOIN_ROOM_FILTER,sort:JOIN_ROOM_SORT}));
  }catch(_e){}
}

function toggleProfileCard(){
  const wrap=document.getElementById('pc-form-wrap');
  const arrow=document.getElementById('pc-arrow');
  if(!wrap)return;
  const open=wrap.style.display==='none';
  wrap.style.display=open?'':'none';
  if(arrow)arrow.textContent=open?'▲':'▼';
  if(open){initProfileImgZone();clearTitleDot();}
}

function setJoinRoomStatus(message,tone='i'){
  const el=document.getElementById('join-room-status');
  if(!el) return;
  const colors={a:'var(--accent)',w:'#f59e0b',d:'#ef4444',i:'var(--muted)'};
  el.style.color=colors[tone]||'var(--muted)';
  el.textContent=message;
}

function switchJoinMode(mode){
  JOIN_MODE=mode==='direct'?'direct':'browser';
  const browser=document.getElementById('join-room-browser');
  const direct=document.getElementById('join-room-direct');
  const browserBtn=document.getElementById('join-tab-browser');
  const directBtn=document.getElementById('join-tab-direct');
  const submitBtn=document.getElementById('join-direct-btn');
  const filters=document.getElementById('join-room-filters');
  const sortWrap=document.getElementById('join-room-sort-wrap');
  if(browser) browser.style.display=JOIN_MODE==='browser'?'flex':'none';
  if(direct) direct.style.display=JOIN_MODE==='direct'?'block':'none';
  if(browserBtn) browserBtn.className='btn btn-sm '+(JOIN_MODE==='browser'?'btn-primary':'btn-secondary');
  if(directBtn) directBtn.className='btn btn-sm '+(JOIN_MODE==='direct'?'btn-primary':'btn-secondary');
  if(submitBtn) submitBtn.style.display=JOIN_MODE==='direct'?'inline-flex':'none';
  if(filters) filters.style.display=JOIN_MODE==='browser'?'flex':'none';
  if(sortWrap) sortWrap.style.display=JOIN_MODE==='browser'?'flex':'none';
  updateJoinRoomRefreshTimer();
}

function sortJoinRooms(rooms){
  const list=[...rooms];
  list.sort((a,b)=>{
    if(JOIN_ROOM_SORT==='players'){
      const byPlayers=(Number(b.playerCount)||0)-(Number(a.playerCount)||0);
      if(byPlayers!==0) return byPlayers;
      return (Number(b.updatedAt)||0)-(Number(a.updatedAt)||0);
    }
    if(JOIN_ROOM_SORT==='waiting'){
      const waitingA=(String(a.status||'waiting')==='waiting')?0:1;
      const waitingB=(String(b.status||'waiting')==='waiting')?0:1;
      if(waitingA!==waitingB) return waitingA-waitingB;
      return (Number(b.updatedAt)||0)-(Number(a.updatedAt)||0);
    }
    return (Number(b.updatedAt)||0)-(Number(a.updatedAt)||0);
  });
  return list;
}

function getFilteredJoinRooms(){
  const filtered=JOIN_ROOM_FILTER==='all'
    ? JOIN_ROOMS
    : JOIN_ROOMS.filter((room)=>String(room.status||'waiting')===JOIN_ROOM_FILTER);
  return sortJoinRooms(filtered);
}

function setJoinRoomFilter(filter){
  JOIN_ROOM_FILTER=['all','waiting','in_progress'].includes(filter)?filter:'all';
  const map={all:'join-filter-all',waiting:'join-filter-waiting',in_progress:'join-filter-live'};
  Object.entries(map).forEach(([key,id])=>{
    const btn=document.getElementById(id);
    if(!btn) return;
    btn.className='btn btn-sm '+(JOIN_ROOM_FILTER===key?'btn-primary':'btn-secondary');
  });
  saveJoinBrowserPrefs();
  renderJoinRoomList(getFilteredJoinRooms());
  updateJoinRoomStatusSummary();
}

function setJoinRoomSort(sortKey){
  JOIN_ROOM_SORT=['recent','players','waiting'].includes(sortKey)?sortKey:'recent';
  const select=document.getElementById('join-room-sort');
  if(select&&select.value!==JOIN_ROOM_SORT) select.value=JOIN_ROOM_SORT;
  saveJoinBrowserPrefs();
  renderJoinRoomList(getFilteredJoinRooms());
  updateJoinRoomStatusSummary();
}

function updateJoinRoomStatusSummary(){
  const total=JOIN_ROOMS.length;
  const filtered=getFilteredJoinRooms().length;
  const suffix=JOIN_MODE==='browser'?' Mise à jour auto active.':'';
  if(!total){
    setJoinRoomStatus('Aucune partie en attente ou en cours.'+(suffix||''),'w');
    return;
  }
  const filterLabel=JOIN_ROOM_FILTER==='all'?'toutes les salles':(JOIN_ROOM_FILTER==='waiting'?'les salles en attente':'les salles en cours');
  const sortLabel=JOIN_ROOM_SORT==='recent'?'activité récente':(JOIN_ROOM_SORT==='players'?'plus de joueurs':'en attente d\'abord');
  setJoinRoomStatus(filtered+' / '+total+' partie(s) affichée(s) pour '+filterLabel+', tri '+sortLabel+'.'+suffix,'a');
}

function copyRoomCode(roomCode){
  const code=String(roomCode||'').trim();
  if(!code)return;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(code).then(()=>toast('Code copié: '+code,'a')).catch(()=>toast('Impossible de copier.','w'));
    return;
  }
  try{
    const ta=document.createElement('textarea');
    ta.value=code;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Code copié: '+code,'a');
  }catch(_e){
    toast('Impossible de copier.','w');
  }
}

function stopJoinRoomRefresh(){
  if(JOIN_ROOM_REFRESH_TIMER){
    clearInterval(JOIN_ROOM_REFRESH_TIMER);
    JOIN_ROOM_REFRESH_TIMER=null;
  }
}

function updateJoinRoomRefreshTimer(){
  const modal=document.getElementById('modal-join');
  const isOpen=!!(modal&&modal.classList.contains('open'));
  if(!isOpen||JOIN_MODE!=='browser'){
    stopJoinRoomRefresh();
    return;
  }
  if(JOIN_ROOM_REFRESH_TIMER) return;
  JOIN_ROOM_REFRESH_TIMER=setInterval(()=>{
    refreshJoinRoomList(true);
  },4000);
}

function formatJoinRoomMeta(room){
  const parts=[];
  parts.push('Hôte: '+(room.hostName||'Hôte'));
  parts.push('Joueurs: '+(room.playerCount||0)+'/'+(room.maxPlayers||6));
  parts.push('Places libres: '+Math.max(0, Number(room.availableSlots)||0));
  parts.push('Plateau: '+(room.boardName||'Classique'));
  return parts.join(' • ');
}

function formatJoinRoomLastActivity(room){
  const updatedAt=Number(room.updatedAt)||0;
  if(!updatedAt) return 'Activité inconnue';
  const delta=Math.max(0,Date.now()-updatedAt);
  const seconds=Math.floor(delta/1000);
  if(seconds<10) return 'Actif à l’instant';
  if(seconds<60) return 'Actif il y a '+seconds+' s';
  const minutes=Math.floor(seconds/60);
  if(minutes<60) return 'Actif il y a '+minutes+' min';
  const hours=Math.floor(minutes/60);
  if(hours<24) return 'Actif il y a '+hours+' h';
  const days=Math.floor(hours/24);
  return 'Actif il y a '+days+' j';
}

function formatJoinRoomAddons(room){
  const addons=Array.isArray(room.activeAddons)?room.activeAddons:[];
  return addons.length?('Addons: '+addons.join(', ')):'Addons: aucun';
}

function formatJoinRoomAccess(room){
  return room&&room.isPrivate?'Privée 🔒':'Publique 🌐';
}

function renderJoinRoomList(rooms){
  const wrap=document.getElementById('join-room-browser');
  if(!wrap) return;
  wrap.innerHTML='';
  if(!rooms.length){
    const empty=document.createElement('div');
    empty.style.cssText='padding:12px;border:1px dashed var(--border);border-radius:10px;background:var(--s2);font-size:.74rem;color:var(--muted)';
    empty.textContent='Aucune partie en attente ou en cours pour le moment.';
    wrap.appendChild(empty);
    return;
  }
  rooms.forEach((room)=>{
    const card=document.createElement('div');
    card.style.cssText='padding:10px;border:1px solid var(--border);border-radius:12px;background:rgba(13,21,37,.85);display:flex;gap:10px;align-items:center;justify-content:space-between';

    const info=document.createElement('div');
    info.style.cssText='min-width:0;display:flex;flex-direction:column;gap:4px';

    const title=document.createElement('div');
    title.style.cssText='font-size:.82rem;font-weight:800;color:var(--text)';
    title.textContent=(room.hostEmoji||'👤')+' '+room.room;

    const meta=document.createElement('div');
    meta.style.cssText='font-size:.72rem;color:var(--muted)';
  meta.textContent=formatJoinRoomMeta(room);

  const addons=document.createElement('div');
  addons.style.cssText='font-size:.68rem;color:var(--muted)';
  addons.textContent=formatJoinRoomAddons(room);

    const activity=document.createElement('div');
    activity.style.cssText='font-size:.68rem;color:var(--muted)';
    activity.textContent=formatJoinRoomLastActivity(room);

    const access=document.createElement('div');
    access.style.cssText='font-size:.68rem;color:var(--muted)';
    access.textContent=formatJoinRoomAccess(room);

    const status=document.createElement('div');
    const inProgress=!!room.started||room.status==='in_progress';
    const isFull=Math.max(0, Number(room.availableSlots)||0)===0;
    status.style.cssText='font-size:.68rem;font-weight:800;color:'+(isFull?'#ef4444':(inProgress?'#f59e0b':'var(--accent)'));
    status.textContent=isFull?'COMPLÈTE':(inProgress?'EN COURS':'EN ATTENTE');

    info.appendChild(title);
    info.appendChild(meta);
    info.appendChild(addons);
    info.appendChild(access);
    info.appendChild(activity);
    info.appendChild(status);

    const actions=document.createElement('div');
    actions.style.cssText='display:flex;flex-direction:column;gap:6px;align-items:flex-end';

    const copyBtn=document.createElement('button');
    copyBtn.type='button';
    copyBtn.className='btn btn-xs btn-secondary';
    copyBtn.textContent='📋 Code';
    copyBtn.onclick=()=>copyRoomCode(room.room);

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='btn btn-sm '+(isFull?'btn-danger':(inProgress?'btn-yellow':'btn-primary'));
    btn.textContent=isFull?'Salle pleine':'Rejoindre';
    btn.disabled=isFull;
    if(!isFull) btn.onclick=()=>joinOnlineRoom(room.room,document.getElementById('jn-pass')?.value||'');

    actions.appendChild(copyBtn);
    actions.appendChild(btn);

    card.appendChild(info);
    card.appendChild(actions);
    wrap.appendChild(card);
  });
}

function requestWsServer(url,payload,expectedType,timeoutMs=3500){
  return new Promise((resolve,reject)=>{
    let settled=false;
    let timer=null;
    let socket=null;
    const enriched=Object.assign({},payload||{});
    if(P&&P.uid&&!enriched.uid)enriched.uid=P.uid;
    if(P&&P.googleSessionToken&&!enriched.sessionToken)enriched.sessionToken=P.googleSessionToken;
    const finish=(fn,value)=>{
      if(settled) return;
      settled=true;
      if(timer) clearTimeout(timer);
      try{ if(socket&&socket.readyState<=WebSocket.OPEN) socket.close(); }catch(_e){}
      fn(value);
    };
    try{
      socket=new WebSocket(url);
    }catch(err){
      reject(err);
      return;
    }
    timer=setTimeout(()=>finish(reject,new Error('timeout')),timeoutMs);
    socket.onopen=()=>{
      try{ socket.send(JSON.stringify(enriched)); }
      catch(err){ finish(reject,err); }
    };
    socket.onmessage=(event)=>{
      try{
        const msg=JSON.parse(event.data);
        if(msg.type!==expectedType) return;
        finish(resolve,msg);
      }catch(err){
        finish(reject,err);
      }
    };
    socket.onerror=()=>finish(reject,new Error('ws_error'));
    socket.onclose=()=>{
      if(!settled) finish(reject,new Error('closed'));
    };
  });
}

async function refreshJoinRoomList(){
  const silent=arguments[0]===true;
  const input=document.getElementById('jn-ws');
  const url=input?input.value.trim():'';
  if(JOIN_ROOM_REFRESH_IN_FLIGHT) return;
  if(!url){
    JOIN_ROOMS=[];
    renderJoinRoomList([]);
    setJoinRoomStatus('Entre une URL WebSocket valide.','d');
    return;
  }
  JOIN_ROOM_REFRESH_IN_FLIGHT=true;
  if(!silent) setJoinRoomStatus('Chargement des parties…','i');
  try{
    const response=await requestWsServer(url,{type:'room_list_request'},'room_list');
    JOIN_ROOMS=Array.isArray(response.rooms)?response.rooms:[];
    renderJoinRoomList(getFilteredJoinRooms());
    updateJoinRoomStatusSummary();
  }catch(err){
    JOIN_ROOMS=[];
    renderJoinRoomList([]);
    setJoinRoomStatus('Impossible de récupérer la liste des parties.','d');
  }finally{
    JOIN_ROOM_REFRESH_IN_FLIGHT=false;
  }
}

function sendWsMessage(payload){
  if(!G.ws||!G.wsOk) return false;
  try{
    const enriched=Object.assign({},payload||{});
    if(P&&P.uid&&!enriched.uid)enriched.uid=P.uid;
    if(P&&P.googleSessionToken&&!enriched.sessionToken)enriched.sessionToken=P.googleSessionToken;
    G.ws.send(JSON.stringify(enriched));
    return true;
  }catch(e){
    wsLog('Erreur envoi: '+e);
    return false;
  }
}

function announceOnlinePresence(roomPassword='',extraPayload){
  const me=G.players.find(p=>p.id===G.myId);
  if(!me) return;
  me.disconnected=false;
  sendWsMessage(Object.assign({type:'ready',room:G.room,sender:G.myId,playerId:G.myId,name:me.name,emoji:me.emoji,color:me.color,ready:!!me.ready,roomPassword:String(roomPassword||'').trim()},extraPayload||{}));
}

function toggleMobileSidebar(forceOpen){
  if(window.DEVICE!=='mobile')return;
  const app=document.getElementById('app-wrap');
  const sidebar=app?app.querySelector('.sidebar'):null;
  if(!app)return;
  if(forceOpen===true){
    app.classList.remove('mobile-sidebar-collapsed');
    syncMobileBodyScrollLock(app,sidebar);
    queueBoardAdaptiveScale(180);
    return;
  }
  app.classList.toggle('mobile-sidebar-collapsed');
  syncMobileBodyScrollLock(app,sidebar);
  queueBoardAdaptiveScale(180);
}

function initMobileSidebarToggle(){
  const app=document.getElementById('app-wrap');
  if(!app)return;
  if(window.DEVICE==='mobile')app.classList.add('mobile-sidebar-collapsed');
  else app.classList.remove('mobile-sidebar-collapsed');
  syncMobileBodyScrollLock(app,app.querySelector('.sidebar'));
}

function initMobileRestrictions(){
  if(window.DEVICE!=='mobile')return;
  // Mode une-main: actif par défaut sur mobile, car les toggles sont verrouillés.
  setCenterActionsEnabled(true);
  setCenterActionsScale(Math.max(110,G.centerActionsScale||100));
  setAutoEnd(true);
  // Désactiver les checkboxes sur mobile
  ['auto-end-chk','center-actions-chk','center-actions-size'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){
      el.disabled=true;
      el.style.cursor='not-allowed';
      el.addEventListener('change',e=>e.preventDefault(),true);
    }
  });
}

function initMobileSidebarSwipe(){
  if(window.DEVICE!=='mobile')return;
  const app=document.getElementById('app-wrap');
  if(!app)return;
  
  // Injecter les lisérés de swipe
  ['swipe-hint swipe-hint-top','swipe-hint swipe-hint-bottom'].forEach(cls=>{
    const d=document.createElement('div');
    d.className=cls;
    document.body.appendChild(d);
  });
  
  let touchStartY=0;
  let touchStartTarget=null;
  const swipeThreshold=50;
  const edgeZone=160; // zone déclenchable du haut/bas
  
  // Swipe sur l'écran entier
  document.addEventListener('touchstart',e=>{
    touchStartY=e.touches[0].clientY;
    touchStartTarget=e.target;
  },{passive:true});
  
  document.addEventListener('touchend',e=>{
    const touchEndY=e.changedTouches[0].clientY;
    const screenHeight=window.innerHeight;
    const diff=Math.abs(touchEndY-touchStartY);
    if(diff<swipeThreshold)return;

    const sidebarOpen=!app.classList.contains('mobile-sidebar-collapsed');
    const startedOnSidebar=touchStartTarget&&touchStartTarget.closest('.sidebar')!==null;
    const startedAtBottom=touchStartY>screenHeight-edgeZone;
    const startedAtTop=touchStartY<edgeZone;
    const swipedUp=touchEndY<touchStartY;
    const swipedDown=touchEndY>touchStartY;

    // Swipe vers le bas depuis le HAUT de la sidebar (sidebar ouverte) → ferme
    if(startedAtTop&&swipedDown&&sidebarOpen&&startedOnSidebar){
      toggleMobileSidebar();
    }
    // Swipe vers le haut depuis le bas du plateau (sidebar fermée) → ouvre
    else if(startedAtBottom&&swipedUp&&!sidebarOpen&&!startedOnSidebar){
      toggleMobileSidebar();
    }
  },{passive:true});
}

const FIRST_PARTY_TUTORIAL_KEY='neopoly_first_party_tutorial_v1';
const TUTORIAL_STEPS=[
  {title:'Bienvenue dans NeoPoly',body:'Lance les dés, achète malin et utilise les nouveaux panneaux pour suivre tes objectifs, événements et résumés.'},
  {title:'1. Commencer un tour',body:'Utilise `Entrée` pour lancer les dés sur PC, puis `E` pour finir ton tour quand tout est prêt.'},
  {title:'2. Paramètres de partie',body:'La roue ⚙️ te montre maintenant un aperçu live des règles, des modes spéciaux et leur impact.'},
  {title:'3. Historique premium',body:'Filtre le log par achat, loyer, prison, échange ou event pour relire uniquement l’action utile.'},
  {title:'4. Astuce perf mobile',body:'Sur mobile modeste, NeoPoly réduit automatiquement les effets visuels pour rester fluide.'},
];

function switchLobbyTab(name){
  if(name==='amis-pane'&&!(P&&P.googleConnected)){
    toast('👫 Le mode amis est réservé aux comptes Google.','w');
    if(typeof openGoogleLoginModal==='function')openGoogleLoginModal();
    name='profil-pane';
  }
  document.querySelectorAll('.lobby-tab').forEach(t=>t.classList.toggle('active',t.dataset.ltab===name));
  document.querySelectorAll('.lobby-tab-pane').forEach(p=>p.classList.toggle('active',p.id===name));
}
function openNewsPane(){switchLobbyTab('news-pane');}
function openHelpPane(){switchLobbyTab('help-pane');}
function renderTutorialStep(){
  const title=document.getElementById('tutorial-step-title');
  const body=document.getElementById('tutorial-step-body');
  const meta=document.getElementById('tutorial-step-meta');
  const prev=document.getElementById('tutorial-prev-btn');
  const next=document.getElementById('tutorial-next-btn');
  if(!title||!body||!meta||!prev||!next)return;
  const idx=Math.max(0,Math.min(TUTORIAL_STEPS.length-1,parseInt(G.tutorialStepIndex,10)||0));
  G.tutorialStepIndex=idx;
  const step=TUTORIAL_STEPS[idx]||TUTORIAL_STEPS[0];
  title.textContent=step.title;
  body.textContent=step.body;
  meta.textContent='Étape '+(idx+1)+' / '+TUTORIAL_STEPS.length;
  prev.disabled=idx<=0;
  next.textContent=idx>=TUTORIAL_STEPS.length-1?'Terminer':'Suivant';
}
function stepTutorial(delta){
  const next=Math.max(0,Math.min(TUTORIAL_STEPS.length-1,(parseInt(G.tutorialStepIndex,10)||0)+(parseInt(delta,10)||0)));
  if(next===G.tutorialStepIndex&&next===TUTORIAL_STEPS.length-1){
    closeModal('modal-tutorial');
    return;
  }
  G.tutorialStepIndex=next;
  renderTutorialStep();
}
function openFirstPartyTutorial(force){
  if(force===true){
    try{localStorage.setItem(FIRST_PARTY_TUTORIAL_KEY,'done');}catch(_){ }
  }
  G.tutorialStepIndex=0;
  renderTutorialStep();
  openModal('modal-tutorial');
}
function maybeOpenFirstPartyTutorial(){
  if(!G.tutorialHintsEnabled)return;
  let seen=false;
  try{seen=localStorage.getItem(FIRST_PARTY_TUTORIAL_KEY)==='done';}catch(_){seen=false;}
  if(seen)return;
  try{localStorage.setItem(FIRST_PARTY_TUTORIAL_KEY,'done');}catch(_){ }
  openFirstPartyTutorial(false);
}
function initDesktopKeyboardShortcuts(){
  if(document.body?.dataset?.npShortcutsBound==='1')return;
  if(document.body?.dataset)document.body.dataset.npShortcutsBound='1';
  document.addEventListener('keydown',ev=>{
    if(!IS_PC_PLATFORM)return;
    if(!ev||ev.repeat)return;
    const tag=(ev.target&&ev.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||tag==='select'||ev.target?.isContentEditable)return;
    const key=String(ev.key||'').toLowerCase();
    if(key==='f1'){
      ev.preventDefault();
      openFirstPartyTutorial(true);
      return;
    }
    if(key==='n'&&!G.started){openNewsPane();return;}
    if(key==='/'&&!G.started){openHelpPane();return;}
    if(!G.started)return;
    if(key==='enter'&&!document.getElementById('roll-btn')?.disabled){ev.preventDefault();doRoll();return;}
    if(key==='e'&&!document.getElementById('end-btn')?.disabled){ev.preventDefault();doNextTurn();return;}
    if(key==='h'&&!document.getElementById('house-btn')?.disabled){ev.preventDefault();openHouseModal();return;}
    if(key==='t'&&!document.getElementById('trade-btn')?.disabled){ev.preventDefault();openTradeModal();return;}
    if(key==='s'&&!document.getElementById('shop-btn')?.disabled){ev.preventDefault();openShop();return;}
    if(key==='m'&&!document.getElementById('mortgage-btn')?.disabled){ev.preventDefault();openMortgageModal();return;}
  });
}

function initAdminDebugWindowDrag(){
  const card=document.getElementById('debug-tools-card');
  const handle=card?.querySelector('summary');
  if(!card||!handle||card.dataset.dragInit==='1')return;
  card.dataset.dragInit='1';
  let dragging=false;
  let startX=0;
  let startY=0;
  let originLeft=0;
  let originTop=0;

  const onMove=(ev)=>{
    if(!dragging)return;
    const nextLeft=originLeft+(ev.clientX-startX);
    const nextTop=originTop+(ev.clientY-startY);
    card.style.left=nextLeft+'px';
    card.style.top=nextTop+'px';
    card.style.transform='none';
    card.dataset.dragMoved='1';
  };

  const stopDrag=()=>{
    if(!dragging)return;
    dragging=false;
    card.classList.remove('is-dragging');
    document.removeEventListener('mousemove',onMove);
    document.removeEventListener('mouseup',stopDrag);
  };

  handle.addEventListener('mousedown',ev=>{
    const target=ev.target;
    if(target&&typeof target.closest==='function'&&target.closest('button'))return;
    if(ev.button!==0)return;
    ev.preventDefault();
    dragging=true;
    card.classList.add('is-dragging');
    const rect=card.getBoundingClientRect();
    startX=ev.clientX;
    startY=ev.clientY;
    originLeft=rect.left;
    originTop=rect.top;
    card.style.left=rect.left+'px';
    card.style.top=rect.top+'px';
    card.style.transform='none';
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',stopDrag);
  });
}

function recenterAdminDebugMenu(){
  const card=document.getElementById('debug-tools-card');
  if(!card)return;
  card.style.left='50%';
  card.style.top='50%';
  card.style.transform='translate(-50%,-50%)';
  card.dataset.dragMoved='';
  card.classList.remove('is-dragging');
}

function closeAdminDebugMenu(){
  const card=document.getElementById('debug-tools-card');
  const backdrop=document.getElementById('debug-tools-window-backdrop');
  if(card){
    card.style.display='none';
    card.classList.remove('is-dragging');
  }
  if(backdrop)backdrop.classList.remove('open');
  document.body?.classList.remove('debug-tools-window-open');
  updateCenterActionsPopup?.();
  updateAddonButtonVisibility?.();
}

function openAdminDebugMenu(){
  if(!hasAdminDebugAccess(true))return;
  showScreen('lobby');
  switchLobbyTab('profil-pane');
  const card=document.getElementById('debug-tools-card');
  const backdrop=document.getElementById('debug-tools-window-backdrop');
  if(card){
    card.style.display='block';
    card.open=true;
    if(!card.dataset.dragMoved){
      recenterAdminDebugMenu();
    }
    initAdminDebugWindowDrag();
  }
  if(backdrop)backdrop.classList.add('open');
  document.body?.classList.add('debug-tools-window-open');
  updateCenterActionsPopup?.();
  updateAddonButtonVisibility?.();
}

// Profile / ELO / titles system moved to `assets/profile-system.js`.

// Profile title progression logic moved to `assets/profile-system.js`.

// Profile tab rendering and debug helpers moved to `assets/profile-system.js`.

function beginGoogleLogin(promptMode){
  showGoogleClickIndicator('Clic Google recu');
  if(googleForceRedirectOnly){
    pushGoogleDebug('Popup bypassed: redirect-only forced');
    updateGoogleDebugPanel();
    if(canUseGoogleRedirectNow()){
      beginGoogleLoginCodeRedirect();
    }else{
      beginGoogleLoginAlt();
    }
    return;
  }
  const reason=getGoogleBlockReason();
  if(reason){
    openModal('modal-google');
    updateGoogleConfigUi();
    if(!isTopLevelWindow())openSecureGoogleTab();
    pushGoogleDebug('Blocked before popup: '+reason);
    updateGoogleDebugPanel();
    toast(reason,'w');
    return;
  }
  const diag=getGoogleAuthDiag();
  try{
    if(!googleTokenClient){
      googleTokenClient=google.accounts.oauth2.initTokenClient({
        client_id:diag.clientId,
        scope:'openid email profile',
        callback:resp=>{
          if(!resp||resp.error){
            const msg=resp&&resp.error?String(resp.error):'cancelled';
            toast('Connexion Google annulee: '+msg,'i');
            googleLastOauthError=msg;
            if(msg==='access_denied'||msg==='popup_closed_by_user'||msg==='popup_failed_to_open'||String(msg).toLowerCase().includes('rejected')){
              googlePopupRejectedCount+=1;
            }
            if(isGoogleDomainRejectionReason(msg)){
              forceGoogleRedirectOnly(msg);
            }
            pushGoogleDebug('Popup error: '+msg);
            if(googleForceRedirectOnly&&canUseGoogleRedirectNow()){
              beginGoogleLoginCodeRedirect();
            }else if(msg==='popup_closed_by_user'||msg==='access_denied'||String(msg).toLowerCase().includes('rejected')){
              beginGoogleLoginAlt();
            }
            updateGoogleDebugPanel();
            refreshGooglePreferredAction();
            openModal('modal-google');
            updateGoogleConfigUi();
            return;
          }
          googleAccessToken=resp.access_token||null;
          completeGoogleLoginFromToken(resp.access_token);
        },
      });
    }
    googleTokenClient.requestAccessToken({prompt:String(promptMode||'consent')});
  }catch(e){
    openModal('modal-google');
    updateGoogleConfigUi();
    googleLastOauthError=String(e&&e.message||'open_failed');
    pushGoogleDebug('Popup exception: '+String(e&&e.message||'open_failed'));
    updateGoogleDebugPanel();
    refreshGooglePreferredAction();
    toast('Impossible d\'ouvrir la popup Google: verifie le Client ID et l origine autorisee','d');
  }
}

function openGoogleLoginModal(){
  try{
    const modal=document.getElementById('modal-google');
    if(!modal){toast('Modal Google introuvable','d');return;}
    showGoogleClickIndicator('Modal Google ouvert');
    openModal('modal-google');
    updateGoogleConfigUi();
    updateGoogleDebugPanel();
    refreshGooglePreferredAction();
    applyGoogleModeHintFromServer();
    maybeSuggestCanonicalOrigin();
  }catch(e){
    toast('Ouverture modal Google impossible','d');
  }
}

function beginGoogleLoginAlt(){
  showGoogleClickIndicator('Tentative alternative');
  if(googleForceRedirectOnly&&canUseGoogleRedirectNow()){
    pushGoogleDebug('Alternative bypassed: redirect-only forced');
    updateGoogleDebugPanel();
    beginGoogleLoginCodeRedirect();
    return;
  }
  if(shouldBypassOneTap()&&canUseGoogleRedirectNow()){
    pushGoogleDebug('Alternative bypassed: redirect preferred after FedCM failure');
    updateGoogleDebugPanel();
    beginGoogleLoginCodeRedirect();
    return;
  }
  pushGoogleDebug('Alternative flow start');
  updateGoogleDebugPanel();
  const diag=getGoogleAuthDiag();
  const verifyUrl=getGoogleIdVerifyUrl();
  if(!isTopLevelWindow()){
    openModal('modal-google');
    updateGoogleConfigUi();
    pushGoogleDebug('Alternative blocked: not top-level window');
    updateGoogleDebugPanel();
    toast('Google bloque la connexion dans un iframe/webview. Ouvre un nouvel onglet.','w');
    openSecureGoogleTab();
    return;
  }
  if(!diag.gisReady||!diag.hasClientId||!diag.secureOrigin||!verifyUrl){
    openModal('modal-google');
    updateGoogleConfigUi();
    pushGoogleDebug('Alternative blocked: prerequisites missing');
    updateGoogleDebugPanel();
    toast('Connexion alternative indisponible: verifie SDK/Client ID/origine/API','w');
    return;
  }
  try{
    let idTokenReceived=false;
    if(!googleIdInitialized){
      google.accounts.id.initialize({
        client_id:diag.clientId,
        callback:async(resp)=>{
          idTokenReceived=true;
          if(!resp||!resp.credential){
            pushGoogleDebug('Alternative callback without credential');
            updateGoogleDebugPanel();
            toast('Echec reception ID token Google','d');
            return;
          }
          pushGoogleDebug('ID token received');
          updateGoogleDebugPanel();
          await completeGoogleLoginFromIdToken(resp.credential);
        },
      });
      googleIdInitialized=true;
      pushGoogleDebug('Alternative initialize OK');
      updateGoogleDebugPanel();
    }
    google.accounts.id.prompt();
    pushGoogleDebug('One Tap prompt requested');
    updateGoogleDebugPanel();

    setTimeout(()=>{
      if(idTokenReceived)return;
      if(googleForceRedirectOnly&&canUseGoogleRedirectNow()){
        pushGoogleDebug('Alternative timeout: fallback redirect (forced)');
        updateGoogleDebugPanel();
        beginGoogleLoginCodeRedirect();
        return;
      }
      googleFedCmFailureCount+=1;
      if(canUseGoogleRedirectNow()){
        pushGoogleDebug('Alternative timeout: fallback redirect (FedCM)');
        updateGoogleDebugPanel();
        forceGoogleRedirectOnly('fedcm_timeout');
        beginGoogleLoginCodeRedirect();
        return;
      }
      googleLastOauthError='fedcm_token_error_no_redirect';
      pushGoogleDebug('Alternative timeout: fallback popup (no redirect available)');
      updateGoogleDebugPanel();
      updateGoogleConfigUi();
      beginGoogleLogin('select_account');
    },2200);
  }catch(_){
    openModal('modal-google');
    updateGoogleConfigUi();
    pushGoogleDebug('Alternative flow startup failed');
    updateGoogleDebugPanel();
    toast('Echec demarrage connexion alternative Google','d');
  }
}

function beginGoogleLoginCodeRedirect(){
  const diag=getGoogleAuthDiag();
  if(!isTopLevelWindow()){
    openModal('modal-google');
    updateGoogleConfigUi();
    toast('Redirect Google bloque dans iframe/webview. Ouvre un nouvel onglet.','w');
    openSecureGoogleTab();
    return;
  }
  if(!diag.gisReady||!diag.hasClientId||!diag.secureOrigin){
    openModal('modal-google');
    updateGoogleConfigUi();
    toast('Redirect indisponible: verifie SDK/Client ID/origine','w');
    return;
  }
  try{
    if(!googleCodeClient){
      googleCodeClient=google.accounts.oauth2.initCodeClient({
        client_id:diag.clientId,
        scope:'openid email profile',
        ux_mode:'redirect',
        redirect_uri:googleRedirectUri(),
        state:'np_google_'+Date.now(),
      });
    }
    pushGoogleDebug('Redirect flow requested');
    updateGoogleDebugPanel();
    googleCodeClient.requestCode();
  }catch(e){
    pushGoogleDebug('Redirect startup failed: '+String(e&&e.message||'code_start_failed'));
    updateGoogleDebugPanel();
    toast('Echec demarrage connexion redirect','d');
  }
}

async function completeGoogleLoginFromToken(accessToken){
  googleAccessToken=accessToken||googleAccessToken;
  try{
    const verifyUrl=getGoogleVerifyUrl();
    if(!verifyUrl)throw new Error('missing_verify_url');
    const r=await fetch(verifyUrl,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({accessToken:googleAccessToken}),
    });
    const data=await r.json();
    if(!r.ok||!data||!data.ok||!data.profile)throw new Error(data&&data.error||'verify_failed');
    const me=data.profile;
    applyGoogleIdentity(me.email||'',me.name||'',me.picture||'',me.sub||'',true,data.sessionToken||'');
  }catch(e){
    openModal('modal-google');
    googleLastOauthError=String(e&&e.message||'verify_failed');
    pushGoogleDebug('Token verify error: '+googleLastOauthError);
    updateGoogleDebugPanel();
    updateGoogleConfigUi();
    toast('Erreur verification Google: '+String(e&&e.message||'verify_failed'),'d');
  }
}

async function completeGoogleLoginFromIdToken(idToken){
  try{
    const verifyUrl=getGoogleIdVerifyUrl();
    if(!verifyUrl)throw new Error('missing_verify_url');
    const r=await fetch(verifyUrl,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({idToken}),
    });
    const data=await r.json();
    if(!r.ok||!data||!data.ok||!data.profile)throw new Error(data&&data.error||'verify_id_failed');
    const me=data.profile;
    applyGoogleIdentity(me.email||'',me.name||'',me.picture||'',me.sub||'',true,data.sessionToken||'');
  }catch(e){
    openModal('modal-google');
    googleLastOauthError=String(e&&e.message||'verify_id_failed');
    pushGoogleDebug('ID token verify error: '+googleLastOauthError);
    updateGoogleDebugPanel();
    updateGoogleConfigUi();
    toast('Erreur verification ID token: '+String(e&&e.message||'verify_id_failed'),'d');
  }
}

async function handleGoogleRedirectCodeIfPresent(){
  try{
    const sp=new URLSearchParams(window.location.search);
    const code=sp.get('code');
    const state=sp.get('state')||'';
    if(!code||!state.startsWith('np_google_'))return;
    const url=getGoogleCodeExchangeUrl();
    if(!url){toast('API exchange-code manquante','d');return;}
    pushGoogleDebug('Exchanging redirect code');
    updateGoogleDebugPanel();
    const r=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code,redirectUri:googleRedirectUri()}),
    });
    const data=await r.json();
    if(!r.ok||!data||!data.ok||!data.profile)throw new Error(data&&data.error||'exchange_failed');
    const me=data.profile;
    applyGoogleIdentity(me.email||'',me.name||'',me.picture||'',me.sub||'',true,data.sessionToken||'');
    sp.delete('code');sp.delete('scope');sp.delete('authuser');sp.delete('prompt');sp.delete('state');
    const qs=sp.toString();
    history.replaceState(null,'',window.location.pathname+(qs?('?'+qs):''));
    pushGoogleDebug('Redirect exchange success');
    updateGoogleDebugPanel();
  }catch(e){
    googleLastOauthError=String(e&&e.message||'exchange_failed');
    pushGoogleDebug('Redirect exchange error: '+String(e&&e.message||'exchange_failed'));
    updateGoogleDebugPanel();
    updateGoogleConfigUi();
    toast('Echec verification redirect Google','d');
  }
}

function resetGoogleUiState(){
  googlePopupRejectedCount=0;
  googleForceRedirectOnly=false;
  googleFedCmFailureCount=0;
  googleLastOauthError='';
  GOOGLE_DEBUG_LOG.length=0;
  const out=document.getElementById('g-api-test-status');
  if(out){out.textContent='';out.style.color='var(--muted)';}
  const ta=document.getElementById('g-diagnostic-export');
  if(ta){ta.value='';ta.style.display='none';}
  updateGoogleDebugPanel();
  refreshGooglePreferredAction();
  toast('Etat UI Google reinitialise','i');
}

function applyGoogleIdentity(email,name,avatarUrl,googleSub,isVerified,sessionToken){
  if(!email||!email.includes('@')){toast('Adresse Gmail invalide','d');return;}
  const emailBase=email.split('@')[0]||'joueur';
  const accountDefaultName=emailBase
    .replace(/[._-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/\b\w/g,ch=>ch.toUpperCase());
  const finalName=name||accountDefaultName||'Joueur';
  const avatarSeed=encodeURIComponent(email.toLowerCase());
  const fallbackAvatar=`https://api.dicebear.com/9.x/initials/svg?seed=${avatarSeed}`;
  const existingAvatar=String(P.avatarImg||'').trim();
  const nextHostedAvatar=avatarUrl||fallbackAvatar;

  P.googleConnected=true;
  P.googleEmail=email;
  P.googleName=finalName;
  P.googleSub=googleSub||null;
  P.googleSessionToken=sessionToken?String(sessionToken):null;
  P.googleVerifiedAt=isVerified?Date.now():0;
  P.isAdmin=isKnownAdminEmail(email);
  P.moderation=P.moderation&&typeof P.moderation==='object'?P.moderation:getDefaultModerationState();
  P.name=finalName;
  P.avatarImg=(existingAvatar&&!isDefaultHostedAvatar(existingAvatar))?existingAvatar:nextHostedAvatar;
  syncUidWithGoogleIdentity(false);
  saveProfileData();renderLobbyProfileTab();renderSocialChat();
  if(typeof queueRemoteProfileHydration==='function')queueRemoteProfileHydration('login');
  syncSocialAdminUi();
  refreshModerationStatus(false);
  unlockConnectionZone('google');
  closeModal('modal-google');
  toast(isVerified?'🔗 Compte Google verifie !':'Profil local lie sans verification Google','a');
}

function confirmGoogleLogin(){
  const email=document.getElementById('g-email')?.value.trim();
  const name=document.getElementById('g-dispname')?.value.trim();
  applyGoogleIdentity(email,name,'','',false);
}

function revokeGoogleGrant(){
  const hasGoogle=typeof google!=='undefined'&&google.accounts;
  const canOauthRevoke=hasGoogle&&google.accounts.oauth2&&typeof google.accounts.oauth2.revoke==='function';
  const canIdRevoke=hasGoogle&&google.accounts.id&&typeof google.accounts.id.revoke==='function';

  if(canOauthRevoke&&googleAccessToken){
    try{google.accounts.oauth2.revoke(googleAccessToken,()=>{});}catch(e){}
  }else if(canIdRevoke&&P.googleEmail){
    try{google.accounts.id.revoke(P.googleEmail,()=>{});}catch(e){}
  }
  googleAccessToken=null;
}
function disconnectGoogle(){
  revokeGoogleGrant();
  P.googleConnected=false;P.googleEmail=null;P.googleName=null;P.googleSub=null;P.googleSessionToken=null;P.googleVerifiedAt=0;
  P.isAdmin=false;
  P.moderation=getDefaultModerationState();
  saveProfileData();renderLobbyProfileTab();renderSocialChat();
  syncSocialAdminUi();
  toast('Google déconnecté (autorisation révoquée)','i');
}

// Social chat helpers moved to `assets/chat-social-ui.js`.

// Social chat menu, friends list and moderation/WebSocket logic moved to `assets/chat-social-ui.js`.

function setNetDiagLine(id,text,tone){
  const el=document.getElementById(id);
  if(!el)return;
  const colors={ok:'#22c55e',warn:'#f59e0b',bad:'#ef4444',info:'var(--muted)'};
  el.style.color=colors[tone]||'var(--muted)';
  el.textContent=text;
}

function wsUrlToHttpBase(wsUrl){
  const raw=String(wsUrl||'').trim();
  if(!raw)return '';
  try{
    const u=new URL(raw);
    const proto=u.protocol==='wss:'?'https:':'http:';
    return proto+'//'+u.host;
  }catch(_){
    return '';
  }
}

function isRenderWsUrl(wsUrl){
  return isRenderOrigin(wsUrlToHttpBase(wsUrl));
}

function getWsFallbackUrls(preferredUrl){
  const seen=new Set();
  const urls=[];
  const add=url=>{
    const value=String(url||'').trim();
    if(!value||seen.has(value))return;
    seen.add(value);
    urls.push(value);
  };
  add(preferredUrl);
  if(isRenderWsUrl(preferredUrl)||getRenderOriginCandidates().length){
    getRenderOriginCandidates().forEach(origin=>add(origin.replace(/^http/i,'ws')));
  }
  return urls;
}

function openNetworkDiagModal(){
  openModal('modal-netdiag');
  runNetworkDiagnostics();
}

async function runNetworkDiagnostics(){
  if(typeof ensurePreferredRenderOrigin==='function'){
    await ensurePreferredRenderOrigin(true).catch(()=>{});
    initDefaultWsUrlInputs();
  }
  const wsUrl=(document.getElementById('social-ws-url')?.value||document.getElementById('jn-ws')?.value||document.getElementById('cr-ws')?.value||getDefaultWsUrl()||'').trim();
  setNetDiagLine('netdiag-health','Test en cours...','info');
  setNetDiagLine('netdiag-ws','Test en cours...','info');
  setNetDiagLine('netdiag-social','Test en cours...','info');
  setNetDiagLine('netdiag-multi','Test en cours...','info');
  setNetDiagLine('netdiag-summary','Analyse en cours...','info');

  let healthOk=false;
  let wsOk=false;

  const healthBase=wsUrlToHttpBase(wsUrl)||getGoogleApiBase()||window.location.origin;
  const healthUrl=(healthBase?healthBase.replace(/\/$/,''):'')+'/api/health';
  try{
    const ctl=new AbortController();
    const t=setTimeout(()=>ctl.abort(),3500);
    const r=await fetch(healthUrl,{signal:ctl.signal});
    clearTimeout(t);
    const d=await r.json().catch(()=>null);
    healthOk=!!(r.ok&&d&&d.ok);
    setNetDiagLine('netdiag-health',healthOk?('OK ('+healthUrl+')'):('KO ('+healthUrl+')'),healthOk?'ok':'bad');
  }catch(_){
    setNetDiagLine('netdiag-health','KO (serveur API indisponible)','bad');
  }

  if(!wsUrl){
    setNetDiagLine('netdiag-ws','KO (URL WS vide)','bad');
  }else{
    try{
      wsOk=await new Promise(resolve=>{
        let done=false;
        let timer=null;
        try{
          const testWs=new WebSocket(wsUrl);
          timer=setTimeout(()=>{
            if(done)return;
            done=true;
            try{testWs.close();}catch(_){ }
            resolve(false);
          },3500);
          testWs.onopen=()=>{
            if(done)return;
            done=true;
            clearTimeout(timer);
            try{testWs.close();}catch(_){ }
            resolve(true);
          };
          testWs.onerror=()=>{
            if(done)return;
            done=true;
            clearTimeout(timer);
            resolve(false);
          };
        }catch(_){
          if(timer)clearTimeout(timer);
          resolve(false);
        }
      });
      setNetDiagLine('netdiag-ws',wsOk?('OK ('+wsUrl+')'):('KO ('+wsUrl+')'),wsOk?'ok':'bad');
    }catch(_){
      setNetDiagLine('netdiag-ws','KO (connexion impossible)','bad');
    }
  }

  const socialReady=!!(socialWs&&socialWsOk);
  setNetDiagLine('netdiag-social',socialReady?'Connecté':'Déconnecté',socialReady?'ok':'warn');

  const multiReady=!!(G.ws&&G.wsOk&&G.mode==='online');
  const multiTxt=multiReady?('Connecté en room '+(G.room||'?')):(G.mode==='online'?'Mode online mais WS coupé':'Hors mode online');
  setNetDiagLine('netdiag-multi',multiTxt,multiReady?'ok':'warn');

  if(healthOk&&wsOk){
    setNetDiagLine('netdiag-summary','Serveur joignable. Si le multi ne sync pas, vérifier que tous les onglets utilisent la même URL WS et la même room.','ok');
  }else if(!healthOk&&wsOk){
    setNetDiagLine('netdiag-summary','WS répond mais API health KO: possible mauvais port/proxy.','warn');
  }else if(healthOk&&!wsOk){
    setNetDiagLine('netdiag-summary','API OK mais WS KO: endpoint WebSocket incorrect ou serveur WS down.','bad');
  }else{
    setNetDiagLine('netdiag-summary','Serveur indisponible. Lancer server.js puis retester.','bad');
  }
}

// Profile image drop zone (lobby)
function getProfileEditorElements(){
  const zones=[];
  document.querySelectorAll('#p-img-zone,.emoji-drop-zone[data-for-profile="1"]').forEach(el=>{
    if(el&&!zones.includes(el))zones.push(el);
  });
  return {
    nameInputs:Array.from(document.querySelectorAll('#p-name-inp')),
    colorInputs:Array.from(document.querySelectorAll('#p-color-inp')),
    zones,
  };
}

function setProfileImageZonePreview(zone,dataUrl){
  if(!zone)return;
  const next=String(dataUrl||'').trim();
  zone.style.borderColor='var(--border)';
  if(next){
    zone.setAttribute('data-img',next);
    zone.style.backgroundImage=`url('${next}')`;
    zone.style.backgroundSize='cover';
    zone.style.backgroundPosition='center';
    zone.textContent='';
    return;
  }
  zone.removeAttribute('data-img');
  zone.style.backgroundImage='';
  zone.textContent='🖼️ Glisse ou clique';
}

function syncProfileImageZones(dataUrl){
  getProfileEditorElements().zones.forEach(zone=>setProfileImageZonePreview(zone,dataUrl));
}

function getProfileImageDraft(){
  const zones=getProfileEditorElements().zones;
  for(let i=zones.length-1;i>=0;i--){
    const raw=String(zones[i]?.getAttribute('data-img')||'').trim();
    if(raw)return raw;
  }
  return String(P?.avatarImg||'').trim();
}

function readImageFileAsDataUrl(file){
  return new Promise(resolve=>{
    if(!file||!file.type.startsWith('image/')){resolve('');return;}
    const reader=new FileReader();
    reader.onload=ev=>resolve(String(ev?.target?.result||''));
    reader.onerror=()=>resolve('');
    reader.readAsDataURL(file);
  });
}

function compressProfileImageDataUrl(dataUrl){
  return new Promise(resolve=>{
    const raw=String(dataUrl||'').trim();
    if(!raw||!/^data:image\//i.test(raw)){resolve(raw);return;}
    const img=new Image();
    img.onload=()=>{
      try{
        const maxSide=320;
        const largest=Math.max(1,img.width||1,img.height||1);
        const scale=Math.min(1,maxSide/largest);
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round((img.width||1)*scale));
        canvas.height=Math.max(1,Math.round((img.height||1)*scale));
        const ctx=canvas.getContext('2d');
        if(!ctx){resolve(raw);return;}
        ctx.imageSmoothingEnabled=true;
        ctx.imageSmoothingQuality='high';
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        let best='';
        ['image/webp','image/jpeg'].forEach(type=>{
          [0.88,0.82,0.76,0.7].forEach(quality=>{
            try{
              const candidate=canvas.toDataURL(type,quality);
              if(candidate&&(!best||candidate.length<best.length))best=candidate;
            }catch(_){ }
          });
        });
        resolve(best||raw);
      }catch(_){
        resolve(raw);
      }
    };
    img.onerror=()=>resolve(raw);
    img.src=raw;
  });
}

async function handleImportedProfileImage(file){
  if(!file||!file.type.startsWith('image/'))return;
  const raw=await readImageFileAsDataUrl(file);
  const optimized=await compressProfileImageDataUrl(raw);
  syncProfileImageZones(optimized||raw);
}

function initProfileImgZone(){
  const zones=getProfileEditorElements().zones;
  if(!zones.length)return;
  zones.forEach(zone=>{
    if(zone.dataset.bound==='1')return;
    zone.dataset.bound='1';
    zone.addEventListener('click',()=>{
      const p=document.createElement('input');
      p.type='file';
      p.accept='image/*';
      p.onchange=e=>handleImportedProfileImage(e.target.files[0]);
      p.click();
    });
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.style.borderColor='var(--accent)';});
    zone.addEventListener('dragleave',()=>{zone.style.borderColor='var(--border)';});
    zone.addEventListener('drop',e=>{e.preventDefault();handleImportedProfileImage(e.dataTransfer.files[0]);zone.style.borderColor='var(--border)';});
  });
  syncProfileImageZones(P?.avatarImg||'');
}

// ═══════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════
// ═══════════════════════════════════════
const clone=o=>JSON.parse(JSON.stringify(o));
const d6=()=>Math.floor(Math.random()*6)+1;

function hexToRgbString(hex){
  const h=String(hex||'').trim().replace('#','');
  if(!/^[0-9a-fA-F]{6}$/.test(h))return '255,255,255';
  const r=parseInt(h.slice(0,2),16);
  const g=parseInt(h.slice(2,4),16);
  const b=parseInt(h.slice(4,6),16);
  return r+','+g+','+b;
}

function randomHexColor(){
  const h='0123456789ABCDEF';
  let out='#';
  for(let i=0;i<6;i++)out+=h[Math.floor(Math.random()*16)];
  return out;
}

function pickUniquePlayerColor(preferred,excludeId){
  const used=new Set((G.players||[])
    .filter(p=>p&&p.id!==excludeId&&p.color)
    .map(p=>String(p.color).toLowerCase()));
  const p=(preferred||'').toLowerCase();
  if(p&&!used.has(p))return preferred;
  const pool=[...COLORS,'#06b6d4','#ec4899','#84cc16','#fb7185','#14b8a6','#f59e0b'];
  const cand=pool.find(c=>!used.has(String(c).toLowerCase()));
  if(cand)return cand;
  for(let i=0;i<40;i++){
    const c=randomHexColor();
    if(!used.has(c.toLowerCase()))return c;
  }
  return randomHexColor();
}

function enforceUniquePlayerColors(){
  if(!Array.isArray(G.players))return;
  const seen=new Set();
  G.players.forEach(p=>{
    if(!p)return;
    const c=String(p.color||'').toLowerCase();
    if(c&&!seen.has(c)){seen.add(c);return;}
    p.color=pickUniquePlayerColor(p.color,p.id);
    seen.add(String(p.color).toLowerCase());
  });
}

function recordTxn(p,amount,desc){
  G.txns.unshift({name:p.name,color:p.color,amount,desc});
  if(G.txns.length>100)G.txns.pop();
  if(p&&amount>0&&typeof isProfileControlledPlayer==='function'&&isProfileControlledPlayer(p)&&canTrackProfileStatsInCurrentMatch()){
    P.stats.moneyEarned=Math.max(0,(parseInt(P.stats.moneyEarned,10)||0)+Math.round(amount));
    syncDailyChallengesProgress(false);
    syncWeeklyMissionsProgress(false);
    saveProfileData();
  }
}

function saveUndo(){
  G.undoStack.push({
    players:clone(G.players),
    board:clone(G.board),
    cur:G.cur,rolled:G.rolled,doublesCount:G.doublesCount,
    roulette:clone(G.roulette),
  });
  if(G.undoStack.length>10)G.undoStack.shift();
}

function undoLast(){
  if(!G.undoStack.length){toast('Rien à annuler.','w');return;}
  const s=G.undoStack.pop();
  G.players=s.players;G.board=s.board;G.cur=s.cur;
  G.rolled=s.rolled;G.doublesCount=s.doublesCount;
  G.roulette=s.roulette||getDefaultRouletteState();
  ensureRouletteState();
  G.players.forEach(ensureRoulettePlayerData);
  hideBuyBar();buildBoard();renderPlayers();updBtns();
  toast('↩ Annulé.','i');
}

// ═══════════════════════════════════════
//  MODAL HELPERS
// ═══════════════════════════════════════
function openProfileEditModal(){
  renderLobbyProfileTab(); // populate form fields + title selector
  initProfileImgZone();    // re-bind img zone (modal now has it)
  openModal('modal-profile-edit');
}

function initModalBackdropClose(){
  if(window.__neopolyModalBackdropInit)return;
  window.__neopolyModalBackdropInit=true;
  document.addEventListener('click',e=>{
    const target=e.target;
    if(typeof Element==='undefined'||!(target instanceof Element))return;
    const bg=target.closest('.modal-bg.open,#shop-modal-bg.open,#pack-manager-modal.open');
    if(!bg||target!==bg)return;
    if(bg.id==='shop-modal-bg'){
      closeShop?.();
      return;
    }
    if(bg.id==='pack-manager-modal'){
      bg.classList.remove('open');
      updateCenterActionsPopup?.();
      updateAddonButtonVisibility?.();
      return;
    }
    if(bg.id)closeModal(bg.id);
  });
}

function openModal(id){
  if(id==='modal-create'&&typeof isInviteOnlyAccount==='function'&&isInviteOnlyAccount()){
    toast('🔐 Connecte-toi avec Google pour créer une partie en ligne. Le mode invité garde l’accès aux parties locales et rapides.','i');
    openGoogleLoginModal();
    return;
  }
  if(['modal-create','modal-join','modal-add-local'].includes(id))syncPartyProfileDefaults();
  document.getElementById(id).classList.add('open');
  updateCenterActionsPopup();
  updateAddonButtonVisibility();
  if(id==='modal-join'){
    setJoinRoomFilter(JOIN_ROOM_FILTER);
    setJoinRoomSort(JOIN_ROOM_SORT);
    switchJoinMode('browser');
    setJoinRoomStatus('Chargement des parties…','i');
    setTimeout(refreshJoinRoomList,0);
  }
}
function closeModal(id){
  document.getElementById(id).classList.remove('open');
  updateCenterActionsPopup();
  updateAddonButtonVisibility();
  if(id==='modal-join') stopJoinRoomRefresh();
}
function openGameWheel(){openModal('modal-game-wheel');}

function readPackManagerFallbackState(){
  const key='NP_ADDON_PACKS_V2';
  const defaults={
    seasons:false,loans:false,perf:false,auctions:false,events:false,powerups:false,blitz:false,
    cfg:{eventChance:20,blitzTimer:30,blitzMaxTurns:30,blitzRentMult:150,loanAmount:400,loanInterest:25,loanRepayTurns:6},
    meta:{version:0,updatedAt:0,updatedBy:'local',source:'local',hash:'00000000'}
  };
  try{
    const raw=localStorage.getItem(key);
    if(!raw)return defaults;
    const v=JSON.parse(raw)||{};
    return {
      seasons:!!v.seasons,loans:!!v.loans,perf:!!v.perf,auctions:!!v.auctions,events:!!v.events,powerups:!!v.powerups,blitz:!!v.blitz,
      cfg:Object.assign({},defaults.cfg,v.cfg||{}),
      meta:Object.assign({},defaults.meta,v.meta||{})
    };
  }catch(_){
    return defaults;
  }
}

function savePackManagerFallbackState(next){
  try{
    const key='NP_ADDON_PACKS_V2';
    const cur=readPackManagerFallbackState();
    const merged={
      seasons:!!(next&&next.seasons),loans:!!(next&&next.loans),perf:!!(next&&next.perf),
      auctions:!!(next&&next.auctions),events:!!(next&&next.events),powerups:!!(next&&next.powerups),blitz:!!(next&&next.blitz),
      cfg:Object.assign({},cur.cfg,next&&next.cfg||{}),
      meta:Object.assign({},cur.meta,next&&next.meta||{})
    };
    merged.meta.version=(Number(merged.meta.version)||0)+1;
    merged.meta.updatedAt=Date.now();
    merged.meta.updatedBy='local';
    merged.meta.source='local';
    localStorage.setItem(key,JSON.stringify(merged));
  }catch(_){ }
}

function openPackManagerFallback(){
  let modal=document.getElementById('pack-manager-fallback-modal');
  const state=readPackManagerFallbackState();
  if(!modal){
    modal=document.createElement('div');
    modal.id='pack-manager-fallback-modal';
    modal.className='modal-bg';
    modal.innerHTML=''+
      '<div class="modal" style="max-width:460px">'+
      '<button class="modal-close" type="button" data-pmfb-close>✕</button>'+
      '<div class="modal-title">Pack Manager (secours)</div>'+
      '<div class="modal-sub">Le script addon principal ne s\'est pas initialise. Ces options sont sauvegardees pour la prochaine partie.</div>'+
      '<div class="fgroup options-fgroup">'+
      '<div class="opt-row"><input type="checkbox" id="pmfb-seasons"><label for="pmfb-seasons">Saisons dynamiques</label></div>'+
      '<div class="opt-row"><input type="checkbox" id="pmfb-loans"><label for="pmfb-loans">Prets bancaires</label></div>'+
      '<div class="opt-row"><input type="checkbox" id="pmfb-perf"><label for="pmfb-perf">Optimisation rendu</label></div>'+
      '<div class="opt-row"><input type="checkbox" id="pmfb-auctions"><label for="pmfb-auctions">Encheres</label></div>'+
      '<div class="opt-row"><input type="checkbox" id="pmfb-events"><label for="pmfb-events">Evenements</label></div>'+
      '<div class="opt-row"><input type="checkbox" id="pmfb-powerups"><label for="pmfb-powerups">Boutique power-ups</label></div>'+
      '<div class="opt-row"><input type="checkbox" id="pmfb-blitz"><label for="pmfb-blitz">Mode Blitz</label></div>'+
      '</div>'+
      '<div class="btn-row" style="justify-content:flex-end">'+
      '<button class="btn btn-secondary btn-sm" type="button" data-pmfb-close>Fermer</button>'+
      '<button class="btn btn-primary btn-sm" type="button" id="pmfb-save">Sauvegarder</button>'+
      '</div>'+
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{ if(e.target===modal){ modal.classList.remove('open'); updateCenterActionsPopup(); } });
    modal.querySelectorAll('[data-pmfb-close]').forEach(el=>el.addEventListener('click',()=>{ modal.classList.remove('open'); updateCenterActionsPopup(); }));
    modal.querySelector('#pmfb-save').addEventListener('click',()=>{
      savePackManagerFallbackState({
        seasons:document.getElementById('pmfb-seasons').checked,
        loans:document.getElementById('pmfb-loans').checked,
        perf:document.getElementById('pmfb-perf').checked,
        auctions:document.getElementById('pmfb-auctions').checked,
        events:document.getElementById('pmfb-events').checked,
        powerups:document.getElementById('pmfb-powerups').checked,
        blitz:document.getElementById('pmfb-blitz').checked
      });
      toast('Configuration addons sauvegardee.','i');
      modal.classList.remove('open');
      updateCenterActionsPopup();
    });
  }

  document.getElementById('pmfb-seasons').checked=!!state.seasons;
  document.getElementById('pmfb-loans').checked=!!state.loans;
  document.getElementById('pmfb-perf').checked=!!state.perf;
  document.getElementById('pmfb-auctions').checked=!!state.auctions;
  document.getElementById('pmfb-events').checked=!!state.events;
  document.getElementById('pmfb-powerups').checked=!!state.powerups;
  document.getElementById('pmfb-blitz').checked=!!state.blitz;
  modal.classList.add('open');
  updateCenterActionsPopup();
}

function openPackManager(){
  const tryOpen=()=>{
    const modal=document.getElementById('pack-manager-modal');
    if(!modal)return false;
    modal.classList.add('open');
    return true;
  };
  if(tryOpen())return;

  const waitForModal=(tries=28)=>{
    if(tryOpen())return;
    if(tries<=0){
      toast('Addon manager externe indisponible. Ouverture du mode secours.','w');
      openPackManagerFallback();
      return;
    }
    setTimeout(()=>waitForModal(tries-1),120);
  };

  const loadPackManagerScript=()=>{
    const candidates=[];
    const baseTag=document.getElementById('pm-addon-script');
    if(baseTag&&baseTag.src)candidates.push(baseTag.src.split('?')[0]+'?v=reload');
    candidates.push('assets/addon-pack-manager.js?v=reload');
    candidates.push('./assets/addon-pack-manager.js?v=reload');
    candidates.push('/assets/addon-pack-manager.js?v=reload');

    let idx=0;
    const tryNext=()=>{
      if(idx>=candidates.length){window.__pmScriptLoading=false;return;}
      const src=candidates[idx++];
      const s=document.createElement('script');
      s.src=src;
      s.onload=()=>{window.__pmScriptLoading=false;window.__pmScriptLoaded=true;waitForModal(28);};
      s.onerror=()=>{tryNext();};
      document.body.appendChild(s);
    };
    tryNext();
  };

  if(!window.__pmScriptLoading){
    window.__pmScriptLoading=true;
    loadPackManagerScript();
  }

  waitForModal(28);
}
function showScreen(id){
    syncPartyProfileDefaults();
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const aw=document.getElementById('app-wrap');
  if(aw){
    aw.classList.toggle('in-lobby',id==='lobby');
    aw.classList.toggle('in-game',id==='game');
  }
  refreshMobileSidebarUiState();
  updateAddonButtonVisibility();
  updateMusicForContext();
  queueBoardAdaptiveScale(0);
}

function updateAddonButtonVisibility(){
  const btn=document.getElementById('pack-manager-btn');
  const debugBtn=document.getElementById('admin-debug-btn');
  const leaderboardPanel=document.getElementById('global-leaderboard-edge');
  const leaderboardHotzone=document.getElementById('global-leaderboard-edge-hotzone');
  const appWrap=document.getElementById('app-wrap');
  const inLobby=!!document.getElementById('lobby')?.classList.contains('active')&&!!appWrap?.classList.contains('in-lobby');
  const blockedByModal=!!document.querySelector('#modal-roulette.open,#modal-party-wheel.open,#modal-game-wheel.open,#pack-manager-modal.open');
  const showAddons=inLobby&&!blockedByModal;
  const showLeaderboard=inLobby&&!blockedByModal;
  document.body?.classList.toggle('addons-hidden-by-overlay',blockedByModal);
  if(btn){
    btn.style.setProperty('display',showAddons?'block':'none','important');
    btn.hidden=!showAddons;
    btn.setAttribute('aria-hidden',showAddons?'false':'true');
  }
  if(leaderboardPanel){
    if(!showLeaderboard){
      leaderboardPanel.classList.remove('is-open');
      document.body?.classList.remove('leaderboard-edge-open');
    }
    leaderboardPanel.style.setProperty('display',showLeaderboard?'block':'none','important');
    leaderboardPanel.hidden=!showLeaderboard;
    leaderboardPanel.setAttribute('aria-hidden',showLeaderboard?'false':'true');
  }
  if(leaderboardHotzone){
    leaderboardHotzone.style.setProperty('display',showLeaderboard?'block':'none','important');
    leaderboardHotzone.setAttribute('aria-hidden',showLeaderboard?'false':'true');
  }
  if(debugBtn)debugBtn.style.display=(inLobby&&!!P?.isAdmin)?'block':'none';
}

// ═══════════════════════════════════════
//  BOARD BUILD
// ═══════════════════════════════════════
// Board positions: 0=bottom-right corner, going counterclockwise
// Bottom row: 0-10 (right to left)
// Left col: 10-20 (bottom to top)  -- wait, standard monopoly layout:
// Bottom: 0(corner) ← 9,8,7,6,5,4,3,2,1 ← 10(corner)... 
// Let's define grid positions for each of 40 cells:
function getCellGridPos(i){
  // Bottom row: cells 0-10, col 11 down to 0, row 12
  if(i<=10) return {row:12,col:11-i};
  // Left col: cells 11-20, row 11 down to 2, col 0
  if(i<=20) return {row:12-(i-10),col:0};
  // Top row: cells 21-30, col 1 to 11, row 1 -- actually col 0 to 11
  if(i<=30) return {row:1,col:i-20};
  // Right col: cells 31-39, row 2 to 11, col 12
  return {row:i-29,col:12};
}

function buildBoard() {
  const b = document.getElementById('board');
  if (!b) return;
  b.innerHTML = '';
  G.boardCellEls = [];
  G.boardPawnEls = [];
  G.centerInfoEl = null;
  G.playerPanelSignature = '';
  G.lastPawnSignature = '';
  G.lastOwnerSignature = '';
  G.centerInfoSignature = '';

  G.board.forEach((cell, i) => {
    const el = document.createElement('div');
    el.className = 'cell';
    el.dataset.idx = i;

    // ── Position dans la grille 11×11 ──
    let col, row, side;

    if (i === 0)  { col=11; row=11; side='corner'; }  // Départ       (coin bas-droit)
    else if (i <= 9)  { col=11-i; row=11; side='bottom'; } // Bas →
    else if (i === 10) { col=1; row=11; side='corner'; }   // Prison
    else if (i <= 19) { col=1; row=11-(i-10); side='left'; } // Gauche ↑
    else if (i === 20) { col=1; row=1; side='corner'; }    // Parking
    else if (i <= 29) { col=i-19; row=1; side='top'; }    // Haut →
    else if (i === 30) { col=11; row=1; side='corner'; }   // GoToJail
    else if (i <= 39) { col=11; row=i-29; side='right'; } // Droite ↓

    el.style.gridColumn = col;
    el.style.gridRow    = row;

    if (side === 'corner') el.classList.add('corner');
    else el.dataset.side = side;

    // ── Contenu ──
    el.innerHTML = `
      ${cell.c && side !== 'corner'
        ? `<div class="cell-strip" style="background:${cell.c}"></div>`
        : ''}
      <div class="cell-meta">
        <div class="cell-icon">${cell.ico || ''}</div>
        ${cell.p ? `<div class="cell-price">${cell.p}$</div>` : ''}
      </div>
      <div class="cell-name">${cell.n}</div>
      <div class="pawns" id="pawns-${i}"></div>
    `;

    el.onclick = () => showPropModal(i);
    b.appendChild(el);
    G.boardCellEls[i] = el;
    G.boardPawnEls[i] = el.querySelector('.pawns');
  });

  // Centre
  const center = document.createElement('div');
  center.className = 'board-center';
  center.innerHTML = `
    <div class="board-center-logo">NeoPoly</div>
    <div class="board-center-sub">Monopoly Personnalisable</div>
    <div class="center-dice-row" id="center-dice-row">
      <div class="center-die" id="center-die1">⚀</div>
      <div class="center-die" id="center-die2">⚀</div>
      <div class="center-dsum" id="center-dsum">2</div>
    </div>
    <div class="board-center-info" id="center-info">Prêt à jouer</div>
  `;
  b.appendChild(center);
  G.centerInfoEl = center.querySelector('#center-info');

  refreshPawns();
  refreshOwners();
}

    // ...suppression du bloc dupliqué...

function refreshOwners(){
  const cachedCells=Array.isArray(G.boardCellEls)?G.boardCellEls:[];
  const ownerSignature=G.board.map(cell=>cell&&cell.owner!=null?String(cell.owner):'').join('|')+'::'+G.players.map(p=>`${p.id}:${p.color}`).join('|');
  if(G.lastOwnerSignature===ownerSignature&&cachedCells.length)return;
  G.lastOwnerSignature=ownerSignature;
  const ownerColors=new Map(G.players.map(p=>[p.id,p.color]));
  G.board.forEach((cell,i)=>{
    const cellEl=cachedCells[i]||document.querySelector(`.cell[data-idx="${i}"]`);
    if(!cellEl)return;
    if(cell.owner!=null){
      const ownerColor=ownerColors.get(cell.owner);
      if(ownerColor){
        cellEl.style.boxShadow='inset 0 0 0 2px '+ownerColor+', 0 0 18px '+ownerColor+'40';
      }else{
        cellEl.style.boxShadow='';
      }
    }else{
      cellEl.style.boxShadow='';
    }
  });
}

function refreshHouses(){
  G.board.forEach((cell,i)=>{
    const el=document.querySelector(`.cell[data-idx="${i}"] .cell-houses`);
    if(!el)return;
    const h=cell.houses||0;
    if(h===0){el.textContent='';return;}
    el.textContent=h>=5?'🏨':'🏠'.repeat(h);
  });
}

function refreshPawns(){
  const cachedPawns=Array.isArray(G.boardPawnEls)?G.boardPawnEls:[];
  const pawnSignature=G.players.filter(p=>p&&!p.bust&&!p.disconnected).map(p=>`${p.id}:${p.pos}:${p.emoji}:${p.color}:${p.img?'img':'plain'}`).join('|');
  if(G.lastPawnSignature===pawnSignature&&cachedPawns.length)return;
  G.lastPawnSignature=pawnSignature;
  if(cachedPawns.length){
    cachedPawns.forEach(el=>{if(el)el.innerHTML='';});
  }else{
    document.querySelectorAll('.cell .pawns').forEach(p=>p.innerHTML='');
  }
  G.players.forEach(p=>{
    if(!p||p.bust||p.disconnected)return;
    const el=cachedPawns[p.pos]||document.querySelector(`.cell[data-idx="${p.pos}"] .pawns`);
    if(!el)return;
    if(p.img){
      const img=document.createElement('img');
      img.src=p.img;
      img.alt='pion';
      img.title=p.name;
      img.style.width='1.5em';
      img.style.height='1.5em';
      img.style.objectFit='cover';
      img.style.borderRadius='50%';
      img.style.border='2px solid '+p.color;
      img.style.background='#fff';
      img.style.boxShadow='0 1px 4px #0008';
      img.className='pawn';
      img.style.setProperty('--pawn-glow-rgb',hexToRgbString(p.color));
      el.appendChild(img);
    }else{
      const pawn=document.createElement('span');
      pawn.className='pawn';
      pawn.textContent=p.emoji;
      pawn.title=p.name;
      pawn.style.color=p.color;
      pawn.style.setProperty('--pawn-glow-rgb',hexToRgbString(p.color));
      el.appendChild(pawn);
    }
  });
}

function animPawnArrive(pos){
  const el=document.querySelector(`.cell[data-idx="${pos}"]`);
  if(!el)return;
  el.classList.remove('landed');
  void el.offsetWidth;
  el.classList.add('landed');
  el.style.transition='background .25s';
  el.style.background='rgba(34,197,94,.3)';
  setTimeout(()=>{el.style.background='';el.classList.remove('landed');},1000);
  refreshPawns();
}

// ═══════════════════════════════════════
//  PLAYERS RENDER
// ═══════════════════════════════════════
function renderPlayers(){
  const list=document.getElementById('players-list');
  list.innerHTML='';
  G.players.forEach((p,i)=>{
    const row=document.createElement('div');
    row.className='player-row'+(i===G.cur&&!p.bust?' active-player':'')+(p.bust?' bust-player':'');
    row.style.cursor='pointer';
    row.onclick=()=>showPlayerModal(p.id);
    const cell=G.board[p.pos];
    let avatarHtml;
    if(p.img){
      avatarHtml = `<span class="player-avatar" style="background:${p.color}22;border:2px solid ${p.color};display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;overflow:hidden;">
        <img src="${p.img}" alt="pion" style="width:100%;height:100%;object-fit:cover;border-radius:50%;background:#fff;box-shadow:0 1px 4px #0008;">
      </span>`;
    }else{
      avatarHtml = `<span class="player-avatar" style="background:${p.color}22;border:2px solid ${p.color}">${p.emoji}</span>`;
    }
    row.innerHTML=`
      ${avatarHtml}
      <div style="flex:1;min-width:0">
        <div class="player-name" style="color:${p.color}">${p.name}${p.bust?' 💀':''}${p.jailed?' ⛓️':''}</div>
        <div class="player-pos">${cell?cell.ico+' '+cell.n:'?'}</div>
      </div>
      <div class="player-money">${p.money} $ </div>`;
    list.appendChild(row);
  });
  refreshPawns();
  refreshOwners();
  document.getElementById('center-info').textContent=
    G.started?((G.players[G.cur]?.img?'<img src="'+G.players[G.cur].img+'" style="width:1.2em;height:1.2em;vertical-align:middle;border-radius:50%;border:2px solid '+G.players[G.cur].color+';background:#fff;margin-right:2px;">':G.players[G.cur]?.emoji+' ')+G.players[G.cur]?.name+'\'s tour'):'Prêt à jouer';
}

// ═══════════════════════════════════════
//  BUTTONS STATE
// ═══════════════════════════════════════
function updBtns(){
  const p=G.players[G.cur];
  const controlled=!!(p&&isProfileControlledPlayer(p));
  const buyBar=document.getElementById('buy-bar');
  const buyActions=document.getElementById('buy-actions-row');
  const mainActions=document.getElementById('main-actions-row');
  const itemActions=document.getElementById('item-actions-row');
  if(!G.started){
    document.getElementById('roll-btn').disabled=true;
    document.getElementById('end-btn').disabled=true;
    document.getElementById('skip-btn').style.display='none';
    if(buyActions)buyActions.style.display='';
    if(mainActions)mainActions.style.display='';
    if(itemActions)itemActions.style.display='';
    refreshPowerupsUi();
    updateCenterActionsPopup();
    renderOnlineLobby();
    return;
  }
  if(mainActions)mainActions.style.display=controlled?'':'none';
  if(itemActions)itemActions.style.display=controlled?'':'none';
  if(buyActions)buyActions.style.display=(controlled&&G.pendingBuy)?'':'none';
  if(buyBar&&!controlled&&G.pendingBuy){
    buyBar.classList.remove('open');
  }
  const playerUnavailable=isPlayerUnavailable(p)||(G.mode==='online'&&!G.wsOk);
  document.getElementById('roll-btn').disabled=G.rolled||playerUnavailable;
  document.getElementById('end-btn').disabled=playerUnavailable||!G.rolled||!!G.pendingBuy;
  const skipBtn=document.getElementById('skip-btn');
  if(skipBtn){
    skipBtn.style.display=(p&&p.jailed&&!G.rolled)?'inline-flex':'none';
    skipBtn.textContent=(p&&(p.jailCards||0)>0)?'🃏 Sortir':'🔓 '+G.jailFine+' $';
  }
  refreshPowerupsUi();
  updateCenterActionsPopup();
}

function centerActionButton(label,cls,onClick,disabled){
  return `<button class="btn ${cls}" onclick="${onClick}" ${disabled?'disabled':''}>${label}</button>`;
}

function updateCenterActionsPopup(){
  const wrap=document.getElementById('center-actions-wrap');
  const row=document.getElementById('center-actions-row');
  const box=document.querySelector('.center-actions');
  const title=document.querySelector('.center-actions-title');
  if(!wrap||!row)return;

  const winnerOverlay=document.getElementById('winner-overlay');
  const hasOpenModal=
    !!document.querySelector('.modal-bg.open,#shop-modal-bg.open')||
    !!(winnerOverlay&&winnerOverlay.classList.contains('open'));
  if(hasOpenModal){
    wrap.classList.remove('open');
    if(row.innerHTML)row.innerHTML='';
    G.centerActionsSignature='';
    return;
  }

  if(!G.centerActions||!G.started){
    wrap.classList.remove('open');
    if(row.innerHTML)row.innerHTML='';
    G.centerActionsSignature='';
    return;
  }

  const p=G.players[G.cur];
  if(isPlayerUnavailable(p)){
    wrap.classList.remove('open');
    if(row.innerHTML)row.innerHTML='';
    G.centerActionsSignature='';
    return;
  }
  if(!isProfileControlledPlayer(p)){
    wrap.classList.remove('open');
    if(row.innerHTML)row.innerHTML='';
    G.centerActionsSignature='';
    return;
  }

  const isMobile=window.DEVICE==='mobile';
  let html='';
  if(isMobile){
    if(title)title.textContent='Commandes de jeu';
    if(G.pendingBuy){
      const buyInfo=document.getElementById('buy-info')?.innerHTML||'Achat disponible';
      html += '<div class="center-actions-buy">'+buyInfo+'</div>';
      html += centerActionButton('✅ Acheter','btn-primary btn-sm','confirmBuy()',false);
      html += centerActionButton('❌ Passer','btn-secondary btn-sm','declineBuy()',false);
    }else{
      html += centerActionButton('🎲 Lancer','btn-primary','doRoll()',G.rolled);
      html += centerActionButton('➡️ Fin tour','btn-secondary','doNextTurn()',!G.rolled);
      if(p.jailed&&!G.rolled){
        html += centerActionButton('🔓 Payer '+G.jailFine+' $','btn-yellow btn-sm','payJailFine()',false);
      }
    }
    html += centerActionButton('⚡ Booster dé','btn-yellow btn-sm','useDiceBoostItem()',false);
    if(isPowerupsAddonEnabled())html += centerActionButton('🛒 Shop','btn-blue btn-sm','openShop()',!!G.pendingBuy);
    html += centerActionButton('🏠 Maison','btn-blue btn-sm','openHouseModal()',false);
    html += centerActionButton('🤝 Echange','btn-blue btn-sm','openTradeModal()',false);
    html += centerActionButton('🏦 Hypo','btn-secondary btn-sm','openMortgageModal()',false);
  }else if(G.pendingBuy){
    if(title)title.textContent='Actions possibles';
    html += centerActionButton('✅ Acheter','btn-primary btn-sm','confirmBuy()',false);
    html += centerActionButton('❌ Passer','btn-secondary btn-sm','declineBuy()',false);
  }else{
    if(title)title.textContent='Actions possibles';
    html += centerActionButton('🎲 Lancer','btn-primary','doRoll()',G.rolled);
    html += centerActionButton('➡️ Fin tour','btn-secondary','doNextTurn()',!G.rolled);
    if(p.jailed&&!G.rolled){
      html += centerActionButton('🔓 '+G.jailFine+' $','btn-yellow btn-sm','payJailFine()',false);
    }
  }

  const nextSignature=JSON.stringify({
    mobile:isMobile,
    cur:p.id,
    rolled:!!G.rolled,
    pendingBuy:!!G.pendingBuy,
    jailed:!!p.jailed,
    shop:isPowerupsAddonEnabled(),
    html
  });
  if(G.centerActionsSignature!==nextSignature){
    G.centerActionsSignature=nextSignature;
    row.innerHTML=html;
  }
  wrap.classList.add('open');
  if(box){
    box.style.setProperty('--center-actions-scale',String((G.centerActionsScale||100)/100));
  }
  if(box&&G.centerActionsPos){
    box.style.left=G.centerActionsPos.x+'px';
    box.style.top=G.centerActionsPos.y+'px';
    box.style.setProperty('--center-actions-tx','0px');
    box.style.setProperty('--center-actions-ty','0px');
  }else if(box){
    box.style.left='50%';
    box.style.top='50%';
    box.style.setProperty('--center-actions-tx','-50%');
    box.style.setProperty('--center-actions-ty','-50%');
  }
}

function toggleCenterActions(){
  const v=document.getElementById('center-actions-chk')?.checked
    ??document.getElementById('lb-center-actions-chk')?.checked
    ??false;
  setCenterActionsEnabled(v);
}

function initCenterActionsDrag(){
  if(window.DEVICE==='mobile'){
    G.centerActionsPos=null;
    return;
  }
  const box=document.querySelector('.center-actions');
  const handle=document.getElementById('center-actions-handle');
  if(!box||!handle)return;

  let dragging=false;
  let offsetX=0;
  let offsetY=0;

  function clamp(v,min,max){return Math.min(Math.max(v,min),max);}

  function startDrag(clientX,clientY){
    const rect=box.getBoundingClientRect();
    dragging=true;
    offsetX=clientX-rect.left;
    offsetY=clientY-rect.top;
    box.style.setProperty('--center-actions-tx','0px');
    box.style.setProperty('--center-actions-ty','0px');
  }

  function moveDrag(clientX,clientY){
    if(!dragging)return;
    const maxX=Math.max(0,window.innerWidth-box.offsetWidth);
    const maxY=Math.max(0,window.innerHeight-box.offsetHeight);
    const x=clamp(clientX-offsetX,0,maxX);
    const y=clamp(clientY-offsetY,0,maxY);
    box.style.left=x+'px';
    box.style.top=y+'px';
    G.centerActionsPos={x,y};
  }

  handle.addEventListener('mousedown',e=>{
    e.preventDefault();
    startDrag(e.clientX,e.clientY);
  });

  window.addEventListener('mousemove',e=>moveDrag(e.clientX,e.clientY));
  window.addEventListener('mouseup',()=>{dragging=false;});

  handle.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    const t=e.touches[0];
    if(!t)return;
    startDrag(t.clientX,t.clientY);
  },{passive:true});

  window.addEventListener('touchmove',e=>{
    if(pinching||e.touches.length!==1)return;
    const t=e.touches[0];
    if(!t)return;
    moveDrag(t.clientX,t.clientY);
  },{passive:true});

  window.addEventListener('touchend',()=>{dragging=false;});

  // Pinch tactile pour redimensionner la popup
  let pinching=false;
  let pinchStartDist=0;
  let pinchStartScale=100;
  function dist(t1,t2){
    const dx=t1.clientX-t2.clientX;
    const dy=t1.clientY-t2.clientY;
    return Math.hypot(dx,dy);
  }
  box.addEventListener('touchstart',e=>{
    if(e.touches.length===2){
      dragging=false;
      pinching=true;
      pinchStartDist=dist(e.touches[0],e.touches[1]);
      pinchStartScale=G.centerActionsScale||100;
    }
  },{passive:true});
  box.addEventListener('touchmove',e=>{
    if(!pinching||e.touches.length!==2)return;
    const d=dist(e.touches[0],e.touches[1]);
    if(!pinchStartDist)return;
    const ratio=d/pinchStartDist;
    setCenterActionsScale(Math.round(pinchStartScale*ratio));
  },{passive:true});
  box.addEventListener('touchend',e=>{
    if(e.touches.length<2)pinching=false;
  },{passive:true});
}

// ═══════════════════════════════════════
//  DICE ANIMATION
// ═══════════════════════════════════════
const DICE_FACES=['','⚀','⚁','⚂','⚃','⚄','⚅'];
function animDice(a,b){
  const d1=document.getElementById('die1'),d2=document.getElementById('die2');
  const cd1=document.getElementById('center-die1'),cd2=document.getElementById('center-die2');
  d1.classList.add('rolling');d2.classList.add('rolling');
  if(cd1)cd1.classList.add('rolling');
  if(cd2)cd2.classList.add('rolling');
  playSfx('dice');
  setTimeout(()=>{
    d1.textContent=DICE_FACES[a]||a;
    d2.textContent=DICE_FACES[b]||b;
    document.getElementById('dsum').textContent=a+b;
    if(cd1)cd1.textContent=DICE_FACES[a]||a;
    if(cd2)cd2.textContent=DICE_FACES[b]||b;
    const csum=document.getElementById('center-dsum');
    if(csum)csum.textContent=String(a+b);
    d1.classList.remove('rolling');d2.classList.remove('rolling');
    if(cd1)cd1.classList.remove('rolling');
    if(cd2)cd2.classList.remove('rolling');
  },400);
}

function isProfileControlledPlayer(p){
  if(!p)return false;
  if(G.mode==='online')return p.id===G.myId;
  return true;
}

function sendToJail(p,reason=''){
  if(!p)return;
  const mi=ensurePlayerMatchItems(p);
  if((mi.antiJail||0)>0){
    mi.antiJail--;renderMatchItemsUi();
    glog(p.name+' évite la prison grâce à Anti-prison (temp.).','a');
    toast('🛡️ Anti-prison (temp) utilisé','a');
    return;
  }
  if(isProfileControlledPlayer(p)&&(P.inventory?.antiJail||0)>0){
    P.inventory.antiJail--;saveProfileData();renderInventoryUi();renderMatchItemsUi();
    glog(p.name+' évite la prison grâce à Anti-prison.','a');
    toast('🛡️ Anti-prison utilisé','a');
    return;
  }
  p.pos=10;
  p.jailed=true;
  G.doublesCount=0;
  if(G&&G.started&&G.players?.[G.cur]?.id===p.id){
    G.rolled=true;
    G.pendingBuy=null;
    document.getElementById('buy-bar')?.classList.remove('open');
  }
  playSfx('jail');
  glog(p.name+' va en prison'+(reason?' ('+reason+')':'')+' !','d');
  toast('👮 Prison !','d');
}

function getInflationMultiplier(){
  if(!G.inflationEnabled)return 1;
  const k=Math.max(0,(parseFloat(G.inflationRate)||0)/100);
  return 1+(k*Math.max(0,G.turnCount-1));
}

function getBoardEconomySnapshot(){
  const snapshot={
    valueByOwner:new Map(),
    railroadsByOwner:new Map(),
    utilitiesByOwner:new Map(),
    propertyGroupTotals:new Map(),
    propertyGroupOwned:new Map(),
    dominatedGroupsByOwner:new Map(),
  };
  G.board.forEach(cell=>{
    if(!cell)return;
    if(cell.t==='property'&&cell.c){
      snapshot.propertyGroupTotals.set(cell.c,(snapshot.propertyGroupTotals.get(cell.c)||0)+1);
      if(cell.owner!=null){
        let owners=snapshot.propertyGroupOwned.get(cell.c);
        if(!owners){owners=new Map();snapshot.propertyGroupOwned.set(cell.c,owners);}
        owners.set(cell.owner,(owners.get(cell.owner)||0)+1);
      }
    }
    if(cell.owner==null)return;
    snapshot.valueByOwner.set(cell.owner,(snapshot.valueByOwner.get(cell.owner)||0)+Number(cell.p||0));
    if(cell.t==='railroad')snapshot.railroadsByOwner.set(cell.owner,(snapshot.railroadsByOwner.get(cell.owner)||0)+1);
    if(cell.t==='utility')snapshot.utilitiesByOwner.set(cell.owner,(snapshot.utilitiesByOwner.get(cell.owner)||0)+1);
  });
  snapshot.propertyGroupTotals.forEach((total,color)=>{
    if(total<=1)return;
    const owners=snapshot.propertyGroupOwned.get(color);
    if(!owners)return;
    owners.forEach((count,ownerId)=>{
      if(count===total)snapshot.dominatedGroupsByOwner.set(ownerId,(snapshot.dominatedGroupsByOwner.get(ownerId)||0)+1);
    });
  });
  return snapshot;
}

function getPlayerNetWorth(playerOrId,snapshot){
  const player=typeof playerOrId==='object'?playerOrId:G.players.find(p=>p.id===playerOrId);
  if(!player)return 0;
  const eco=snapshot||getBoardEconomySnapshot();
  return (player.money||0)+(eco.valueByOwner.get(player.id)||0);
}

function startGlobalTimer(){
  if(G.globalTimerTick)clearInterval(G.globalTimerTick);
  G.globalTimerTick=null;
  if(!(G.globalTimerSec>0))return;
  G.globalTimerLeft=G.globalTimerSec;
  G.globalTimerTick=setInterval(()=>{
    if(!G.started){clearInterval(G.globalTimerTick);G.globalTimerTick=null;return;}
    G.globalTimerLeft=Math.max(0,(G.globalTimerLeft||0)-1);
    if(G.globalTimerLeft<=0){
      clearInterval(G.globalTimerTick);G.globalTimerTick=null;
      const winner=getLeaderByNetWorth();
      glog('⏰ Timer global écoulé.','w');
      toast('⏰ Fin du timer global','w');
      endGame(winner);
    }
  },1000);
}

function stopGlobalTimer(){
  if(G.globalTimerTick)clearInterval(G.globalTimerTick);
  G.globalTimerTick=null;
}

// ═══════════════════════════════════════
//  ROLL
// ═══════════════════════════════════════
function doRoll(){
  if(!G.started||G.rolled)return;
  const p=G.players[G.cur];
  if(isPlayerUnavailable(p))return;
  saveUndo();

  if(p.jailed){
    const a=d6(),b=d6();animDice(a,b);
    G.jailTurns[p.id]=(G.jailTurns[p.id]||0)+1;
    if(a===b){
      p.jailed=false;delete G.jailTurns[p.id];
      glog(p.name+' fait un double et sort de prison !','a');
      toast('🎲 Double ! Sortie de prison.','a');
      const boost=(G.pendingRollBoostFor===p.id)?2:0;if(boost)G.pendingRollBoostFor=null;
      if(boost)toast('⚡ Booster dé: +'+boost,'a');
      G.rolled=true;movePlayer(p,a+b+boost);
    } else if(G.jailTurns[p.id]>=3){
      p.money-=G.jailFine;recordTxn(p,-G.jailFine,'Prison: sortie payante');
      if(G.parkingPotEnabled)G.parkingPot+=G.jailFine;
      refreshPartyRuleUi();
      p.jailed=false;delete G.jailTurns[p.id];
      glog(p.name+' paie '+G.jailFine+' $ et sort de prison.','w');
      const boost=(G.pendingRollBoostFor===p.id)?2:0;if(boost)G.pendingRollBoostFor=null;
      if(boost)toast('⚡ Booster dé: +'+boost,'a');
      G.rolled=true;movePlayer(p,a+b+boost);
    } else {
      glog(p.name+' reste en prison ('+a+'+'+b+').','w');
      G.doublesCount=0;
      G.rolled=true;
      renderPlayers();updBtns();broadcast();
      if(G.autoEnd&&G.started&&!G.pendingBuy)setTimeout(()=>doNextTurn(),450);
    }
    return;
  }

  const a=d6(),b=d6();animDice(a,b);
  if(a===b){
    G.doublesCount++;
    if(G.doublesCount>=3){
      sendToJail(p,'3 doubles');
      G.rolled=true;renderPlayers();updBtns();broadcast();return;
    }
    glog(p.name+' fait un double ('+a+'+'+b+') ! Rejoue.','a');
    toast('🎲 Double ! Rejoue.','a');
    G.rolled=false;
  } else {
    G.doublesCount=0;G.rolled=true;
  }
  const boost=(G.pendingRollBoostFor===p.id)?2:0;if(boost)G.pendingRollBoostFor=null;
  if(boost)toast('⚡ Booster dé: +'+boost,'a');
  movePlayer(p,a+b+boost);
  renderPlayers();updBtns();broadcast();
}

function payJailFine(){
  const p=G.players[G.cur];if(!p||!p.jailed
  ||G.rolled)return;
  if((p.jailCards||0)>0){
    p.jailCards=Math.max(0,(p.jailCards||0)-1);
    p.jailed=false;delete G.jailTurns[p.id];G.doublesCount=0;
    glog(p.name+' utilise une carte pour sortir de prison.','a');
    toast('🃏 Sortie de prison utilisée','a');
    refreshPartyRuleUi();
    renderPlayers();updBtns();broadcast();
    return;
  }
  p.money-=G.jailFine;recordTxn(p,-G.jailFine,'Prison: amende volontaire');
  if(G.parkingPotEnabled)G.parkingPot+=G.jailFine;
  refreshPartyRuleUi();
  p.jailed=false;delete G.jailTurns[p.id];G.doublesCount=0;
  glog(p.name+' paie '+G.jailFine+'$ et sort de prison.','w');
  renderPlayers();updBtns();broadcast();
}

// ═══════════════════════════════════════
//  MOVE
// ═══════════════════════════════════════
function movePlayer(p,steps){
  if(!steps||steps<=0)return;
  const old=p.pos;
  p.pos=(old+steps)%40;
  if(old+steps>=40){
    ensurePlayerMatchStats(p).passedGo=(ensurePlayerMatchStats(p).passedGo||0)+1;
    let passBonus=G.passGoBonus;
    const ev=getActiveBoardEvent();
    if(ev?.goBonusMultiplier)passBonus=Math.round(passBonus*ev.goBonusMultiplier);
    p.money+=passBonus;recordTxn(p,passBonus,'Passage Départ');
    glog(p.name+' passe par Départ → +'+passBonus+'$.','a');toast('🚦 +'+passBonus+'$ !','a');
    const powerMode=normalizeSpecialPowersMode(G.specialPowersMode);
    const passItemChance=powerMode==='chaos'?0.22:(powerMode==='normal'?0.12:0);
    if(passItemChance>0&&Math.random()<passItemChance)grantRandomMatchItem(p,'passage départ');
  }
  const cell=G.board[p.pos];
  animPawnArrive(p.pos);
  glog(p.name+' → '+cell.n+'.');
  toast('📍 '+p.name+' arrive sur '+cell.n,'i');
  resolveCell(p,cell);
  updateSecretObjectiveProgress();
}

// ═══════════════════════════════════════
//  RESOLVE CELL
// ═══════════════════════════════════════
function resolveCell(p,cell){
  switch(cell.t){
    case 'start':break;
    case 'tax':{
      const base=cell.r||200;
      const t=G.taxVarianceEnabled?Math.max(1,Math.round(base*(0.75+Math.random()*0.5))):base;
      p.money-=t;recordTxn(p,-t,'Taxe: '+cell.n);
      if(G.parkingPotEnabled)G.parkingPot+=t;
      refreshPartyRuleUi();
      glog(p.name+' paie '+t+'$ de taxe.','d');
      toast('💸 Taxe '+t+'$','d');
      checkBust(p);break;
    }
    case 'chance':drawCard(p,CHANCE_CARDS,'❓ CHANCE');break;
    case 'community':drawCard(p,COMMUNITY_CARDS,'💳 CAISSE');break;
    case 'jail':glog(p.name+' est en visite.');break;
    case 'gotojail':
      sendToJail(p,'Case prison');break;
    case 'parking':
      if(G.parkingPotEnabled&&G.parkingPot>0){
        p.money+=G.parkingPot;recordTxn(p,G.parkingPot,'Gain parking pot');
        glog(p.name+' récupère le parking pot: +'+G.parkingPot+'$.','a');
        toast('🅿️ +'+G.parkingPot+'$','a');
        G.parkingPot=0;
        refreshPartyRuleUi();
      }else glog(p.name+' se gare. Rien.');
      break;
    case 'property':case 'railroad':case 'utility':
      handleProp(p,cell);break;
    default:glog(p.name+' sur '+cell.n+'.');
  }
  if(p.money<0)checkBust(p);
  if(checkPartyObjectives())return;
  if(G.autoEnd&&G.rolled&&!G.pendingBuy)setTimeout(doNextTurn,600);
}

// ═══════════════════════════════════════
//  CARDS
// ═══════════════════════════════════════
function drawCard(p,deck,label){
  const card=deck[Math.floor(Math.random()*deck.length)];
  const text=(card&&typeof card.getText==='function')?card.getText():card.txt;
  glog(label+': '+text,'i');
  toast(label+'\n'+text,'i');
  card.fn(p);
  const powerMode=normalizeSpecialPowersMode(G.specialPowersMode);
  const itemChance=powerMode==='chaos'?0.34:(powerMode==='normal'?0.2:0);
  const extraEventChance=powerMode==='chaos'?0.28:(powerMode==='normal'?0.18:0);
  if(itemChance>0&&Math.random()<itemChance)grantRandomMatchItem(p,label.toLowerCase());
  if(extraEventChance>0&&(G.turnCount||0)>=2&&((G.turnCount-(G.lastSpecialEventTurn||0))>=2)&&Math.random()<extraEventChance){
    triggerSpecialPartyEvent(p,label.toLowerCase());
  }
  renderPlayers();refreshPawns();updBtns();
}

// ═══════════════════════════════════════
//  PROPERTY
// ═══════════════════════════════════════
function calcRent(cell,snapshot){
  if(cell.mortgaged||cell.owner==null)return 0;
  const eco=snapshot||getBoardEconomySnapshot();
  const ev=getActiveBoardEvent();
  if(ev?.zeroUtility&&cell.t==='utility')return 0;
  let rent=0;
  if(cell.t==='railroad'){
    const n=eco.railroadsByOwner.get(cell.owner)||0;
    rent=Math.round(25*Math.pow(2,Math.max(0,n-1))*getInflationMultiplier());
    if(ev?.railroadBonus)rent=Math.round(rent*ev.railroadBonus);
    return rent;
  }
  if(cell.t==='utility'){
    const n=eco.utilitiesByOwner.get(cell.owner)||0;
    rent=Math.round((cell.r||30)*(n>=2?2:1)*getInflationMultiplier());
    return rent;
  }
  const base=cell.r||10;
  const houses=cell.houses||0;
  if(houses===0){
    const total=eco.propertyGroupTotals.get(cell.c)||0;
    const owned=(eco.propertyGroupOwned.get(cell.c)?.get(cell.owner))||0;
    const ownsAll=total>1&&owned===total;
    rent=Math.round((ownsAll?base*2:base)*getInflationMultiplier());
  }else{
    const mult=[0,5,15,45,80,125];
    rent=Math.round(base*(mult[Math.min(houses,5)]||1)*getInflationMultiplier());
  }
  if(ev?.targetColor&&cell.c===ev.targetColor&&ev.rentMultiplier)rent=Math.round(rent*ev.rentMultiplier);
  if(ev?.globalRentMultiplier)rent=Math.round(rent*ev.globalRentMultiplier);
  return rent;
}

function handleProp(p,cell){
  if(cell.mortgaged&&cell.owner!=null){glog(cell.n+' est hypothéquée.','w');return;}
  if(cell.owner==null&&cell.p>0){
    if(p.money>=cell.p){
      G.pendingBuy={cell};
      const groupInfo=(cell.t==='property'&&cell.c)?(()=>{
        const group=G.board.filter(c=>c.t==='property'&&c.c===cell.c);
        const mine=group.filter(c=>c.owner===p.id).length;
        return group.length>1?(' • série '+mine+'/'+group.length):'';
      })():'';
      const reserve=Math.max(0,(p.money||0)-(cell.p||0));
      document.getElementById('buy-info').textContent=
        'Acheter '+cell.ico+' '+cell.n+' pour '+cell.p+'$ ? (loyer: '+cell.r+'$'+groupInfo+' • reste: '+reserve+'$)';
      document.getElementById('buy-bar').classList.add('open');
      toast('🛒 Achat possible: '+cell.n+' pour '+cell.p+'$','a');
      G.rolled=true;updBtns();
    } else {glog(p.name+" n'a pas assez pour "+cell.n+'.','w');}
  } else if(cell.owner!=null&&cell.owner!==p.id){
    const owner=G.players.find(o=>o.id===cell.owner);
    if(!owner||owner.bust)return;
    if(consumeGhostPass(p,cell)){
      renderPlayers();refreshHouses();refreshOwners();updBtns();broadcast();
      return;
    }
    let rent=calcRent(cell);if(rent<=0)return;
    if(arePlayersAllied(p,owner)){
      rent=Math.max(0,Math.ceil(rent*0.5));
      glog('🤝 Alliance active : loyer réduit entre '+p.name+' et '+owner.name+'.','i');
    }
    const payerStats=ensurePlayerMatchStats(p);
    const ownerStats=ensurePlayerMatchStats(owner);
    payerStats.rentPaid=Math.max(0,(parseInt(payerStats.rentPaid,10)||0)+rent);
    ownerStats.rentCollected=Math.max(0,(parseInt(ownerStats.rentCollected,10)||0)+rent);
    p.money-=rent;owner.money+=rent;
    recordTxn(p,-rent,'Loyer: '+cell.n);
    recordTxn(owner,rent,'Loyer reçu: '+cell.n);
    glog(p.name+' paie '+rent+'$ de loyer à '+owner.name+'.','w');
    toast('🏠 '+rent+'$ → '+owner.name,'w');
    checkBust(p);
  } else if(cell.owner===p.id){
    glog(p.name+' est sur sa propriété.');
  }
}

function confirmBuy(){
  const p=G.players[G.cur];if(!G.pendingBuy||!p)return;
  const cell=G.pendingBuy.cell;
  if(p.money<cell.p){toast("Pas assez d'argent !",'d');return;}
  ensurePlayerMatchStats(p).propertiesBought=(ensurePlayerMatchStats(p).propertiesBought||0)+1;
  p.money-=cell.p;recordTxn(p,-cell.p,'Achat: '+cell.n);
  cell.owner=p.id;cell.houses=0;cell.mortgaged=false;
  playSfx('buy');
  glog(p.name+' achète '+cell.n+' pour '+cell.p+'$.','a');
  toast('🏠 Acheté: '+cell.n,'a');
  hideBuyBar();refreshOwners();renderPlayers();broadcast();
  if(G.autoEnd&&G.started&&G.rolled&&!G.pendingBuy){
    setTimeout(()=>doNextTurn(),450);
  }
  if(p.id===G.myId&&canTrackProfileStatsInCurrentMatch()){
    P.stats.propertiesBought++;
    saveProfileData();
    syncDailyChallengesProgress(true);
    syncWeeklyMissionsProgress(true);
  }
  if(isProfileControlledPlayer(p)&&canAwardPersistentProfileProgressInCurrentMatch())addSeasonProgress(10,'achat propriété');
  updateSecretObjectiveProgress();
}

function declineBuy(){
  glog(G.players[G.cur]?.name+' passe.','w');
  hideBuyBar();updBtns();
  if(G.autoEnd&&G.started&&G.rolled&&!G.pendingBuy){
    setTimeout(()=>doNextTurn(),450);
  }
}

function hideBuyBar(){
  G.pendingBuy=null;
  document.getElementById('buy-bar').classList.remove('open');
  updBtns();
}

// ═══════════════════════════════════════
//  HOUSES & MORTGAGE
// ═══════════════════════════════════════
function getHouseBuildUnlockTurn(){
  return Math.max(4,Math.min(7,(G.players?.length||2)+2));
}

function getHouseBuildStatus(player,cell){
  const reasons=[];
  if(!player||!cell||cell.t!=='property')reasons.push('Case invalide.');
  if(!player||!cell)return {ok:false,reasons,cost:0};
  const cost=getHouseCost(cell);
  const houses=cell.houses||0;
  const unlockTurn=getHouseBuildUnlockTurn();
  const group=G.board.filter(c=>c&&c.t==='property'&&c.c===cell.c);
  const ownedInGroup=group.filter(c=>c.owner===player.id).length;
  const minHouses=group.length?Math.min(...group.map(c=>c.houses||0)):0;

  if(cell.owner!==player.id)reasons.push('Tu dois posséder ce terrain.');
  if(cell.mortgaged)reasons.push('Retire d’abord l’hypothèque.');
  if(houses>=5)reasons.push('Maximum atteint sur cette case.');
  if((G.turnCount||1)<unlockTurn)reasons.push('Construction débloquée à partir du tour '+unlockTurn+'.');
  if(group.length>1&&ownedInGroup!==group.length)reasons.push('Possède toute la série de couleur pour construire.');
  if(group.length>1&&houses>minHouses)reasons.push('Construis d’abord sur les autres terrains de la série.');
  if((player.money||0)<cost)reasons.push('Pas assez d’argent ('+cost+'$ requis).');

  return {ok:reasons.length===0,reasons,cost,unlockTurn,groupSize:group.length,ownedInGroup,houses,minHouses};
}

function openHouseModal(){
  const p=G.players[G.cur];if(!p)return;
  const props=G.board.filter(c=>c.owner===p.id&&c.t==='property'&&!c.mortgaged);
  const body=document.getElementById('house-body');
  if(!props.length){body.innerHTML='<div style="color:var(--muted);font-size:.75rem">Aucune propriété disponible.</div>';openModal('modal-house');return;}
  const unlockTurn=getHouseBuildUnlockTurn();
  body.innerHTML='<div class="card" style="padding:8px 10px;margin-bottom:10px;font-size:.72rem;color:var(--muted)">🔓 Construction débloquée à partir du <b>tour '+unlockTurn+'</b>, avec <b>série complète</b> et construction <b>équilibrée</b>.</div>';
  props.forEach((cell,idx)=>{
    const status=getHouseBuildStatus(p,cell);
    const cost=status.cost;
    const sellVal=Math.floor(cost*.5);
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:.75rem';
    row.innerHTML=`
      <span style="flex:1">
        <div>${cell.ico} ${cell.n} ${'🏠'.repeat(cell.houses||0)||'—'}</div>
        <div style="font-size:.64rem;color:${status.ok?'var(--accent)':'var(--muted)'};margin-top:2px">${status.ok?'✅ Construction débloquée':'🔒 '+status.reasons[0]}</div>
      </span>
      <span style="color:var(--accent)">${calcRent(cell)}$/tour</span>`;
    const btnBuy=document.createElement('button');
    btnBuy.className='btn btn-primary btn-xs';
    btnBuy.textContent='🏗️ +'+cost+'$';
    btnBuy.disabled=!status.ok;
    btnBuy.title=status.ok?'Construire ici':status.reasons.join(' • ');
    btnBuy.onclick=()=>{buyHouse(G.board.indexOf(cell));openHouseModal();};
    const btnSell=document.createElement('button');
    btnSell.className='btn btn-yellow btn-xs';
    btnSell.textContent='🔨 +'+sellVal+'$';
    btnSell.disabled=(cell.houses||0)<=0;
    btnSell.onclick=()=>{sellHouse(G.board.indexOf(cell));openHouseModal();};
    row.appendChild(btnBuy);row.appendChild(btnSell);
    body.appendChild(row);
  });
  openModal('modal-house');
}

function buyHouse(idx){
  const p=G.players[G.cur];const cell=G.board[idx];
  if(!cell||!p||cell.owner!==p.id)return;
  const status=getHouseBuildStatus(p,cell);
  const cost=status.cost;
  if(!status.ok){toast(status.reasons[0]||'Construction verrouillée.','w');return;}
  saveUndo();
  ensurePlayerMatchStats(p).housesBuilt=(ensurePlayerMatchStats(p).housesBuilt||0)+1;
  p.money-=cost;recordTxn(p,-cost,'Maison: '+cell.n);
  cell.houses=(cell.houses||0)+1;
  glog(p.name+' construit '+(cell.houses>=5?'un hôtel':'une maison')+' sur '+cell.n+'.','a');
  toast((cell.houses>=5?'🏨 Hôtel':'🏠 Maison')+' sur '+cell.n,'a');
  refreshHouses();renderPlayers();broadcast();
  updateSecretObjectiveProgress();
}

function sellHouse(idx){
  const p=G.players[G.cur];const cell=G.board[idx];
  if(!cell||!p||cell.owner!==p.id)return;
  if(!(cell.houses||0)){toast('Pas de maison !','w');return;}
  saveUndo();
  const val=Math.floor(cell.p*.25);
  p.money+=val;recordTxn(p,val,'Vente maison: '+cell.n);
  cell.houses--;
  glog(p.name+' vend une maison sur '+cell.n+' (+'+val+'$).','w');
  toast('🔨 Vendu +'+val+'$','w');
  refreshHouses();renderPlayers();broadcast();
}

function openMortgageModal(){
  const p=G.players[G.cur];if(!p)return;
  const props=G.board.filter(c=>c.owner===p.id&&['property','railroad','utility'].includes(c.t));
  const body=document.getElementById('mortgage-body');
  if(!props.length){body.innerHTML='<div style="color:var(--muted);font-size:.75rem">Aucune propriété.</div>';openModal('modal-mortgage');return;}
  body.innerHTML='';
  props.forEach(cell=>{
    const val=Math.floor(cell.p*.5);
    const cost=Math.floor(cell.p*.55);
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:.75rem';
    row.innerHTML=`<span style="flex:1">${cell.ico} ${cell.n}${cell.mortgaged?' <span style="color:#f97316">HYPO</span>':''}</span>`;
    const btn=document.createElement('button');
    btn.className='btn btn-sm '+(cell.mortgaged?'btn-blue':'btn-secondary');
    btn.textContent=cell.mortgaged?'📤 Lever ('+cost+'$)':'📥 Hypo (+'+val+'$)';
    if(cell.mortgaged&&p.money<cost)btn.disabled=true;
    btn.onclick=()=>{
      if(cell.mortgaged)unmortgageProp(G.board.indexOf(cell));
      else mortgageProp(G.board.indexOf(cell));
      openMortgageModal();
    };
    row.appendChild(btn);body.appendChild(row);
  });
  openModal('modal-mortgage');
}

function mortgageProp(idx){
  const p=G.players[G.cur];const cell=G.board[idx];
  if(!cell||cell.mortgaged)return;
  saveUndo();
  const val=Math.floor(cell.p*.5);
  p.money+=val;recordTxn(p,val,'Hypothèque: '+cell.n);
  cell.mortgaged=true;
  glog(p.name+' hypothèque '+cell.n+' (+'+val+'$).','w');
  toast('📥 Hypothèque +'+val+'$','w');
  refreshOwners();renderPlayers();broadcast();
}

function unmortgageProp(idx){
  const p=G.players[G.cur];const cell=G.board[idx];
  if(!cell||!cell.mortgaged)return;
  let cost=Math.floor(cell.p*.55);
  const mi=ensurePlayerMatchItems(p);
  if((mi.mortgageDiscount||0)>0){
    mi.mortgageDiscount--;
    cost=Math.floor(cost*0.8);
    renderMatchItemsUi();
    toast('🏦 Réduction de rachat (temp) utilisée','a');
  }else if(isProfileControlledPlayer(p)&&(P.inventory?.mortgageDiscount||0)>0){
    P.inventory.mortgageDiscount--;
    cost=Math.floor(cost*0.8);
    saveProfileData();renderInventoryUi();renderMatchItemsUi();
    toast('🏦 Réduction de rachat utilisée','a');
  }
  if(p.money<cost){toast('Pas assez !','d');return;}
  saveUndo();
  p.money-=cost;recordTxn(p,-cost,'Lever hypothèque: '+cell.n);
  cell.mortgaged=false;
  glog(p.name+' lève l\'hypothèque de '+cell.n+' (-'+cost+'$).','a');
  toast('📤 Levée +'+cost+'$','a');
  refreshOwners();renderPlayers();broadcast();
}

function getTradableCellListByOwner(ownerId){
  if(!ownerId)return [];
  return G.board.filter(c=>
    c.owner===ownerId&&
    ['property','railroad','utility'].includes(c.t)
  );
}

function openTradeModal(){
  if(!G.started){toast('Lance une partie d\'abord.','w');return;}
  const me=G.players[G.cur];
  if(isPlayerUnavailable(me))return;
  if(!isProfileControlledPlayer(me)){toast('Ce n\'est pas ton tour.','w');return;}

  const body=document.getElementById('trade-body');
  if(!body)return;
  const others=G.players.filter(p=>p.id!==me.id&&!p.bust&&!p.disconnected);
  const outgoingList=Object.values(NET_TRADE.outgoing||{});
  const pendingOffer=outgoingList[0]||null;
  const pendingLeft=pendingOffer?Math.max(1,Math.ceil(((parseInt(pendingOffer.expiresAt,10)||Date.now())-Date.now())/1000)):0;
  const myCells=getTradableCellListByOwner(me.id);
  const othersCells=G.board.filter(c=>c.owner&&c.owner!==me.id&&['property','railroad','utility'].includes(c.t));

  const buyRows=othersCells.map(cell=>{
    const idx=G.board.indexOf(cell);
    const owner=G.players.find(p=>p.id===cell.owner);
    const locked=(cell.mortgaged||((cell.houses||0)>0));
    const suggested=Math.max(1,Math.floor((cell.p||0)*1.1));
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:.74rem">
      <span style="flex:1;min-width:0">${cell.ico} ${cell.n} <span style="color:${owner?.color||'#9ca3af'}">(${owner?.name||'?'})</span>${cell.mortgaged?' <span style="color:#f97316">HYPO</span>':''}${(cell.houses||0)>0?' <span style="color:#fde047">🏠x'+(cell.houses||0)+'</span>':''}</span>
      <input id="trade-buy-price-${idx}" type="number" min="1" value="${suggested}" style="width:84px" ${locked?'disabled':''}/>
      <button class="btn btn-primary btn-xs" onclick="buyCellFromPlayer(${idx})" ${locked?'disabled':''}>${G.mode==='online'?'Demander':'Acheter'}</button>
    </div>`;
  }).join('');

  const myOptions=myCells.map(cell=>`<option value="${G.board.indexOf(cell)}">${cell.ico} ${cell.n}${cell.mortgaged?' [HYPO]':''}${(cell.houses||0)>0?' [🏠x'+(cell.houses||0)+']':''}</option>`).join('');
  const otherOptions=othersCells.map(cell=>{
    const owner=G.players.find(p=>p.id===cell.owner);
    return `<option value="${G.board.indexOf(cell)}">${cell.ico} ${cell.n} (${owner?.name||'?'})${cell.mortgaged?' [HYPO]':''}${(cell.houses||0)>0?' [🏠x'+(cell.houses||0)+']':''}</option>`;
  }).join('');

  body.innerHTML=`
    ${pendingOffer?`<div class="card" style="padding:10px 12px;border-color:#f59e0b66">
      <div style="font-size:.76rem;font-weight:800;margin-bottom:6px;color:#fbbf24">⏳ Demande en attente (${pendingLeft}s)</div>
      <div style="font-size:.7rem;color:var(--muted);margin-bottom:8px">${describeTradeOffer(pendingOffer)}</div>
      <button class="btn btn-secondary btn-sm" onclick="cancelOutgoingTradeOffer('${pendingOffer.id}')">Annuler la demande</button>
    </div>`:''}
    <div class="card" style="padding:10px 12px">
      <div style="font-size:.78rem;font-weight:800;margin-bottom:4px">💸 Acheter une case a un autre joueur</div>
      <div style="font-size:.68rem;color:var(--muted);margin-bottom:8px">Les cases hypothéquées ou avec maisons/hotel ne sont pas achetables.</div>
      ${buyRows||'<div style="font-size:.73rem;color:var(--muted)">Aucune case disponible chez les autres joueurs.</div>'}
    </div>
    <div class="card" style="padding:10px 12px">
      <div style="font-size:.78rem;font-weight:800;margin-bottom:6px">🔁 Echanger des cases</div>
      <div style="display:grid;grid-template-columns:1fr;gap:8px">
        <div>
          <label>Ta case</label>
          <select id="trade-my-cell">${myOptions||'<option value="">Aucune</option>'}</select>
        </div>
        <div>
          <label>Case de l\'autre joueur</label>
          <select id="trade-other-cell">${otherOptions||'<option value="">Aucune</option>'}</select>
        </div>
        <div class="frow" style="grid-template-columns:1fr 1fr">
          <div>
            <label>Ton cash vers l\'autre ($)</label>
            <input id="trade-cash-me" type="number" min="0" value="0"/>
          </div>
          <div>
            <label>Cash de l\'autre vers toi ($)</label>
            <input id="trade-cash-other" type="number" min="0" value="0"/>
          </div>
        </div>
        <button class="btn btn-blue btn-sm" onclick="exchangeCellsBetweenPlayers()" ${(!myCells.length||!othersCells.length)?'disabled':''}>${G.mode==='online'?'Envoyer la demande':'Valider l\'echange'}</button>
      </div>
    </div>`;

  if(!others.length){
    body.innerHTML='<div style="font-size:.75rem;color:var(--muted)">Aucun autre joueur actif pour negocier.</div>';
  }
  openModal('modal-trade');
}

function applyBuyCellTransfer(buyer,seller,cell,price){
  if(!buyer||!seller||!cell)return false;
  if(cell.owner!==seller.id)return false;
  if(cell.mortgaged||(cell.houses||0)>0)return false;
  if(price<=0||buyer.money<price)return false;
  saveUndo();
  buyer.money-=price;
  seller.money+=price;
  cell.owner=buyer.id;
  recordTxn(buyer,-price,'Achat joueur: '+cell.n);
  recordTxn(seller,price,'Vente joueur: '+cell.n);
  glog(buyer.name+' achète '+cell.n+' a '+seller.name+' pour '+price+'$.','a');
  refreshOwners();refreshHouses();renderPlayers();broadcast();
  return true;
}

function applySwapCellsTransfer(me,other,myCell,otherCell,cashMe,cashOther){
  if(!me||!other||!myCell||!otherCell)return false;
  if(myCell.owner!==me.id||otherCell.owner!==other.id)return false;
  if(myCell.mortgaged||otherCell.mortgaged||(myCell.houses||0)>0||(otherCell.houses||0)>0)return false;
  if(me.money<cashMe||other.money<cashOther)return false;
  saveUndo();
  const oldOwner=myCell.owner;
  myCell.owner=otherCell.owner;
  otherCell.owner=oldOwner;
  if(cashMe>0){
    me.money-=cashMe;
    other.money+=cashMe;
    recordTxn(me,-cashMe,'Echange vers '+other.name);
    recordTxn(other,cashMe,'Echange recu de '+me.name);
  }
  if(cashOther>0){
    other.money-=cashOther;
    me.money+=cashOther;
    recordTxn(other,-cashOther,'Echange vers '+me.name);
    recordTxn(me,cashOther,'Echange recu de '+other.name);
  }
  glog('🤝 Echange: '+me.name+' ('+myCell.n+') ↔ '+other.name+' ('+otherCell.n+').','a');
  refreshOwners();refreshHouses();renderPlayers();broadcast();
  return true;
}

function sendTradeOffer(offer){
  if(!offer||!offer.id)return false;
  const pendingCount=Object.keys(NET_TRADE.outgoing).length;
  if(pendingCount>0){
    toast('Une offre est déjà en attente de réponse.','w');
    return false;
  }
  offer.expiresAt=Date.now()+NET_TRADE.timeoutMs;
  NET_TRADE.outgoing[offer.id]={...offer};
  NET_TRADE.outgoing[offer.id]._timer=setTimeout(()=>expireOutgoingTradeOffer(offer.id),NET_TRADE.timeoutMs+200);
  return sendWsMessage({
    type:'trade_offer',
    room:G.room,
    sender:G.myId,
    senderName:G.players.find(p=>p.id===G.myId)?.name||'Joueur',
    targetId:offer.targetId,
    offer,
  });
}

function clearOutgoingTradeOffer(offerId){
  const offer=NET_TRADE.outgoing[offerId];
  if(!offer)return null;
  if(offer._timer)clearTimeout(offer._timer);
  delete NET_TRADE.outgoing[offerId];
  return offer;
}

function expireOutgoingTradeOffer(offerId){
  const offer=clearOutgoingTradeOffer(offerId);
  if(!offer)return;
  toast('⏳ Offre expirée (sans réponse).','w');
  if(document.getElementById('modal-trade')?.classList.contains('open'))openTradeModal();
}

function cancelOutgoingTradeOffer(offerId){
  const offer=clearOutgoingTradeOffer(offerId);
  if(!offer)return;
  sendWsMessage({
    type:'trade_cancel',
    room:G.room,
    sender:G.myId,
    senderName:G.players.find(p=>p.id===G.myId)?.name||'Joueur',
    targetId:offer.targetId,
    offerId:offer.id,
  });
  toast('Demande annulée.','i');
  if(document.getElementById('modal-trade')?.classList.contains('open'))openTradeModal();
}

function describeTradeOffer(offer){
  if(!offer)return '';
  if(offer.type==='buy'){
    const cell=G.board[offer.cellIdx];
    return '💸 Achat de '+(cell?cell.n:'une case')+' pour '+(offer.price||0)+'$';
  }
  if(offer.type==='swap'){
    const a=G.board[offer.myIdx];
    const b=G.board[offer.otherIdx];
    return '🔁 Echange '+(a?a.n:'?')+' ↔ '+(b?b.n:'?')+' | toi: '+(offer.cashOther||0)+'$ | lui: '+(offer.cashMe||0)+'$';
  }
  return 'Proposition d\'echange';
}

function showIncomingTradeRequest(offer,senderName){
  if(!offer||offer.targetId!==G.myId)return;
  if((parseInt(offer.expiresAt,10)||0)<=Date.now())return;
  if(NET_TRADE.incomingTimer){clearTimeout(NET_TRADE.incomingTimer);NET_TRADE.incomingTimer=null;}
  NET_TRADE.incoming=offer;
  const body=document.getElementById('trade-request-body');
  const remain=Math.max(1,Math.ceil(((parseInt(offer.expiresAt,10)||Date.now())-Date.now())/1000));
  if(body){
    body.innerHTML='<div style="font-weight:800;margin-bottom:6px">'+String(senderName||'Un joueur')+' te propose:</div><div>'+describeTradeOffer(offer)+'</div><div style="margin-top:8px;color:var(--muted)">Expire dans ~'+remain+'s</div>';
  }
  NET_TRADE.incomingTimer=setTimeout(()=>{
    if(!NET_TRADE.incoming||NET_TRADE.incoming.id!==offer.id)return;
    NET_TRADE.incoming=null;
    closeModal('modal-trade-request');
    toast('⏳ Demande expirée.','w');
  },Math.max(500,((parseInt(offer.expiresAt,10)||Date.now())-Date.now())+250));
  openModal('modal-trade-request');
  toast('📨 Nouvelle demande d\'echange','i');
}

function respondIncomingTradeRequest(accepted){
  const offer=NET_TRADE.incoming;
  if(!offer)return;
  const stillValid=(parseInt(offer.expiresAt,10)||0)>Date.now();
  if(NET_TRADE.incomingTimer){clearTimeout(NET_TRADE.incomingTimer);NET_TRADE.incomingTimer=null;}
  sendWsMessage({
    type:'trade_response',
    room:G.room,
    sender:G.myId,
    senderName:G.players.find(p=>p.id===G.myId)?.name||'Joueur',
    targetId:offer.sender,
    offerId:offer.id,
    accepted:!!accepted&&stillValid,
  });
  NET_TRADE.incoming=null;
  closeModal('modal-trade-request');
  toast((accepted&&stillValid)?'✅ Offre acceptée':'❌ Offre refusée',(accepted&&stillValid)?'a':'w');
}

function handleIncomingTradeResponse(msg){
  const offer=clearOutgoingTradeOffer(msg.offerId);
  if(!offer)return;
  if((parseInt(offer.expiresAt,10)||0)<=Date.now()){
    toast('⏳ Réponse reçue trop tard (offre expirée).','w');
    return;
  }
  if(!msg.accepted){
    toast('❌ '+(msg.senderName||'Le joueur')+' a refusé la demande.','w');
    return;
  }

  if(offer.type==='buy'){
    const buyer=G.players.find(p=>p.id===offer.sender);
    const seller=G.players.find(p=>p.id===offer.targetId);
    const cell=G.board[offer.cellIdx];
    const ok=applyBuyCellTransfer(buyer,seller,cell,Math.max(0,parseInt(offer.price,10)||0));
    if(ok)toast('🤝 Achat validé par '+(msg.senderName||'le joueur'),'a');
    else toast('⚠️ Achat annulé: état changé.','w');
  }else if(offer.type==='swap'){
    const me=G.players.find(p=>p.id===offer.sender);
    const other=G.players.find(p=>p.id===offer.targetId);
    const myCell=G.board[offer.myIdx];
    const otherCell=G.board[offer.otherIdx];
    const cashMe=Math.max(0,parseInt(offer.cashMe,10)||0);
    const cashOther=Math.max(0,parseInt(offer.cashOther,10)||0);
    const ok=applySwapCellsTransfer(me,other,myCell,otherCell,cashMe,cashOther);
    if(ok)toast('🤝 Echange validé par '+(msg.senderName||'le joueur'),'a');
    else toast('⚠️ Echange annulé: état changé.','w');
  }
  if(document.getElementById('modal-trade')?.classList.contains('open'))openTradeModal();
}

function buyCellFromPlayer(idx){
  const me=G.players[G.cur];
  const cell=G.board[idx];
  if(!me||!cell||!G.started)return;
  if(!isProfileControlledPlayer(me)){toast('Ce n\'est pas ton tour.','w');return;}
  if(!cell.owner||cell.owner===me.id){toast('Case non achetable.','w');return;}
  if(cell.mortgaged||(cell.houses||0)>0){toast('Case non eligible (HYPO/maisons).','w');return;}
  const seller=G.players.find(p=>p.id===cell.owner);
  if(!seller||seller.bust){toast('Vendeur indisponible.','w');return;}

  const priceInput=document.getElementById('trade-buy-price-'+idx);
  const price=Math.max(0,parseInt(priceInput?.value,10)||0);
  if(price<=0){toast('Prix invalide.','d');return;}
  if(me.money<price){toast('Pas assez d\'argent.','d');return;}

  if(G.mode==='online'&&G.wsOk&&seller.id!==me.id){
    const offer={
      id:'trade-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),
      type:'buy',room:G.room,sender:me.id,targetId:seller.id,
      cellIdx:idx,price,
      ts:Date.now(),
    };
    const sent=sendTradeOffer(offer);
    if(sent){
      glog(me.name+' envoie une demande d\'achat à '+seller.name+' pour '+cell.n+'.','i');
      toast('📨 Demande envoyée à '+seller.name,'i');
    }else{
      toast('Envoi impossible.','d');
    }
    return;
  }

  const ok=applyBuyCellTransfer(me,seller,cell,price);
  if(ok)toast('🤝 Achat valide: '+cell.n,'a');
  else toast('Transaction impossible.','d');
  openTradeModal();
}

function exchangeCellsBetweenPlayers(){
  const me=G.players[G.cur];
  if(!me||!G.started)return;
  if(!isProfileControlledPlayer(me)){toast('Ce n\'est pas ton tour.','w');return;}

  const myIdx=parseInt(document.getElementById('trade-my-cell')?.value,10);
  const otherIdx=parseInt(document.getElementById('trade-other-cell')?.value,10);
  const cashMe=Math.max(0,parseInt(document.getElementById('trade-cash-me')?.value,10)||0);
  const cashOther=Math.max(0,parseInt(document.getElementById('trade-cash-other')?.value,10)||0);
  const myCell=G.board[myIdx];
  const otherCell=G.board[otherIdx];

  if(!myCell||!otherCell){toast('Selection incomplete.','w');return;}
  if(myCell.owner!==me.id){toast('Ta case selectionnee est invalide.','d');return;}
  if(!otherCell.owner||otherCell.owner===me.id){toast('Case adverse invalide.','d');return;}
  if(myCell.mortgaged||otherCell.mortgaged||(myCell.houses||0)>0||(otherCell.houses||0)>0){
    toast('Echange bloque: HYPO/maisons detectees.','w');
    return;
  }

  const other=G.players.find(p=>p.id===otherCell.owner);
  if(!other||other.bust){toast('Autre joueur indisponible.','w');return;}
  if(me.money<cashMe){toast('Tu n\'as pas assez de cash.','d');return;}
  if(other.money<cashOther){toast(other.name+' n\'a pas assez de cash.','d');return;}

  if(G.mode==='online'&&G.wsOk&&other.id!==me.id){
    const offer={
      id:'trade-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),
      type:'swap',room:G.room,sender:me.id,targetId:other.id,
      myIdx,otherIdx,cashMe,cashOther,
      ts:Date.now(),
    };
    const sent=sendTradeOffer(offer);
    if(sent){
      glog(me.name+' envoie une demande d\'échange à '+other.name+'.','i');
      toast('📨 Demande d\'échange envoyée à '+other.name,'i');
    }else{
      toast('Envoi impossible.','d');
    }
    return;
  }

  const ok=applySwapCellsTransfer(me,other,myCell,otherCell,cashMe,cashOther);
  if(ok)toast('🤝 Echange effectue','a');
  else toast('Echange impossible.','d');
  openTradeModal();
}

// ═══════════════════════════════════════
//  BUST & WIN
// ═══════════════════════════════════════
function checkBust(p){
  if(p.money>=0||p.bust)return;
  p.bust=true;
  // Release all properties
  G.board.forEach(c=>{if(c.owner===p.id){c.owner=null;c.houses=0;c.mortgaged=false;}});
  glog(p.name+' est en faillite ! 💀','d');
  toast('💀 '+p.name+' est en faillite !','d');
  refreshOwners();refreshHouses();
  renderAlliancePanel();
  if(checkTeamVictory())return;
  const alive=G.players.filter(p=>!p.bust);
  if(alive.length<=1)endGame(alive[0]);
}

function endGame(winner){
  G.started=false;stopTimer();stopGlobalTimer();
  G.lastWinnerId=winner?.id||null;
  if(Array.isArray(G.players)&&G.players.length){
    const winIndex=winner?G.players.findIndex(p=>p&&p.id===winner.id):-1;
    G.rematchStarterIndex=winIndex>=0?((winIndex+1)%G.players.length):((Math.max(0,parseInt(G.rematchStarterIndex,10)||0)+1)%G.players.length);
  }
  if(G.botActionTimer){clearTimeout(G.botActionTimer);G.botActionTimer=null;}
  G.pendingRollBoostFor=null;
  playSfx('victory');
  updateMusicForContext();
  updateCenterActionsPopup();
  const overlay=document.getElementById('winner-overlay');
  overlay.classList.add('open');
  const winnerLabel=winner
    ?(G.teamMode&&winner.teamId
      ?('🤝 '+getTeamLabel(winner.teamId)+' — '+getTeamMembers(winner.teamId).map(p=>p.name).join(' + '))
      :(winner.emoji+' '+winner.name))
    :'Égalité';
  document.getElementById('endgame-body').textContent=winnerLabel+' gagne !';
  resolveRouletteBets(winner);
    const profilePlayer=G.players.find(p=>!p.bot&&isProfileControlledPlayer(p))||null;
    const profileWon=!!(winner&&profilePlayer&&(winner.id===profilePlayer.id||(G.teamMode&&winner.teamId&&profilePlayer.teamId===winner.teamId)));
    const canTrackStats=canTrackProfileStatsInCurrentMatch();
    const canProgress=canAwardPersistentProfileProgressInCurrentMatch();
    if(profilePlayer){
      addRouletteCoins(profileWon?6:2,profileWon?'victoire de partie':'partie terminée',{skipRender:true});
    }
    if(profileWon){
      if(canTrackStats)P.stats.gamesWon++;
      if(canProgress){
        P.elo=Math.min(9999,(P.elo||1000)+30);
        checkWinTitles();
        checkSecretTitles();
        addSeasonProgress(70,'victoire');
      }
      if(canTrackStats||canProgress)saveProfileData();
      renderLobbyProfileTab();
    }
    else if(winner&&profilePlayer){
      if(canTrackStats)P.stats.gamesLost=(P.stats.gamesLost||0)+1;
      if(canProgress){
        P.elo=Math.max(0,(P.elo||1000)-20);
        addSeasonProgress(22,'fin de partie');
      }
      if(canTrackStats||canProgress)saveProfileData();
    }
    if(canTrackStats){
      syncDailyChallengesProgress(true);
      syncWeeklyMissionsProgress(true);
    }
    renderLobbyProfileTab();
    if(profileWon&&profilePlayer&&canTrackStats){
      grantRandomItem('victoire');
    }
  const scoreById=new Map();
  G.board.forEach(c=>{
    if(c&&c.owner!=null)scoreById.set(c.owner,(scoreById.get(c.owner)||0)+Number(c.p||0));
  });
  renderMatchObjectiveUi();
  renderBoardEventUi();
  renderAlliancePanel();
  const grid=document.getElementById('p-count');grid.innerHTML='';
  const sorted=[...G.players].sort((a,b)=>((b.money+(scoreById.get(b.id)||0))-(a.money+(scoreById.get(a.id)||0))));
  const frag=document.createDocumentFragment();
  sorted.forEach(p=>{
    const d=document.createElement('div');d.className='ws-stat';
    const net=p.money+(scoreById.get(p.id)||0);
    d.innerHTML=`<div class="ws-stat-val" style="color:${p.color}">${p.emoji}</div>
      <div style="font-size:.8rem;font-weight:700">${p.name}</div>
      <div class="ws-stat-label">${net}$ net</div>`;
    frag.appendChild(d);
  });
  grid.appendChild(frag);
}

function countDominatedGroups(playerId){
  if(!playerId)return 0;
  const eco=getBoardEconomySnapshot();
  return eco.dominatedGroupsByOwner.get(playerId)||0;
}

function getLeaderByNetWorth(){
  const alive=getActivePlayers();
  if(!alive.length)return null;
  const eco=getBoardEconomySnapshot();
  if(G.teamMode){
    const teamTotals=new Map();
    alive.forEach(player=>{
      const key=player.teamId||player.id;
      teamTotals.set(key,(teamTotals.get(key)||0)+getPlayerNetWorth(player,eco));
    });
    const bestTeam=[...teamTotals.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
    const teamMembers=alive.filter(player=>(player.teamId||player.id)===bestTeam);
    return teamMembers.sort((a,b)=>getPlayerNetWorth(b,eco)-getPlayerNetWorth(a,eco))[0]||alive[0]||null;
  }
  return [...alive].sort((a,b)=>getPlayerNetWorth(b,eco)-getPlayerNetWorth(a,eco))[0]||null;
}

function checkPartyObjectives(){
  if(G.goalMoney>0){
    const winner=G.players.find(p=>!p.bust&&!p.disconnected&&p.money>=G.goalMoney);
    if(winner){
      glog('🏁 Objectif fortune atteint par '+winner.name+' ('+winner.money+'$).','a');
      toast('🏁 Objectif atteint: '+winner.name,'a');
      endGame(winner);
      return true;
    }
  }
  if(G.dominationTarget>0){
    const winner=G.players.find(p=>!p.bust&&!p.disconnected&&countDominatedGroups(p.id)>=G.dominationTarget);
    if(winner){
      glog('👑 Domination de quartiers atteinte par '+winner.name+'.','a');
      toast('👑 Domination: '+winner.name,'a');
      endGame(winner);
      return true;
    }
  }
  if(G.maxTurns>0&&G.turnCount>G.maxTurns){
    const winner=getLeaderByNetWorth();
    glog('⏱️ Limite de tours atteinte ('+G.maxTurns+').','w');
    toast('⏱️ Limite de tours atteinte','w');
    endGame(winner);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════
//  NEXT TURN
// ═══════════════════════════════════════
function doNextTurn(){
  if(!G.started||!G.rolled||G.pendingBuy)return;
  const curP=G.players[G.cur];
  if(curP){
    const matchStats=ensurePlayerMatchStats(curP);
    matchStats.turnsPlayed=(matchStats.turnsPlayed||0)+1;
  }
  if(curP&&G.bonusTurns[curP.id]>0){
    G.bonusTurns[curP.id]--;
    G.rolled=false;G.doublesCount=0;
    glog('🎁 Tour bonus pour '+curP.name+' !','a');
    toast('🎁 '+curP.name+' rejoue','a');
    renderPlayers();updBtns();broadcast();
    return;
  }
  if(curP&&G.endTurnSummaryEnabled){
    const propsOwned=(G.board||[]).filter(cell=>cell&&cell.owner===curP.id).length;
    const delta=(curP.money||0)-Math.max(0,parseInt(curP.turnStartMoney,10)||0);
    G.lastTurnSummary={
      name:curP.name||'Joueur',
      emoji:curP.emoji||'🎲',
      color:curP.color||'#fff',
      money:curP.money||0,
      delta,
      props:propsOwned,
      turn:G.turnCount||1,
      cellName:G.board?.[curP.pos]?.n||'Case inconnue',
      status:curP.bust?'Faillite':(curP.disconnected?'Déconnecté':(curP.jailed?'Termine en prison':'Tour terminé'))
    };
    pushTurnHistory(curP.name+' termine avec '+curP.money+'$ et '+propsOwned+' propriété(s).','i');
    renderTurnSummaryUi();
  }
  G.turnCount++;
  if(applySurvivalTurnPulse()&&!G.started)return;
  if(checkPartyObjectives())return;
  hideBuyBar();
  stopTimer();
  // Advance to next non-bust player
  let next=G.cur;
  let tries=0;
  do{next=(next+1)%G.players.length;tries++;}
  while(isPlayerUnavailable(G.players[next])&&tries<G.players.length);
  G.cur=next;G.rolled=false;G.doublesCount=0;
  const np=G.players[G.cur];
  if(isPlayerUnavailable(np)){
    renderPlayers();updBtns();broadcast();
    wsLog?.('Partie en pause : aucun joueur actif.');
    return;
  }
  if(np)np.turnStartMoney=np.money||0;
  if(np&&G.bonusTurnEnabled&&!isPlayerUnavailable(np)&&Math.random()<((G.bonusTurnChance||0)/100)){
    G.bonusTurns[np.id]=(G.bonusTurns[np.id]||0)+1;
    glog('✨ '+np.name+' obtient un tour bonus.','a');
  }
  renderPlayers();updBtns();broadcast();
  startTimer();
  glog('--- Tour de '+G.players[G.cur].name+' ---','i');
  if(canTrackProfileStatsInCurrentMatch()){
    P.stats.totalTurns++;
    saveProfileData();
    syncDailyChallengesProgress(true);
    syncWeeklyMissionsProgress(true);
    addSeasonProgress(1,'tour',true);
  }
  updateSecretObjectiveProgress();
  maybeTriggerBoardEvent();
  renderBoardEventUi();
  renderAlliancePanel();
}

// ═══════════════════════════════════════
//  TIMER
// ═══════════════════════════════════════
function toggleTimer(){
  const v=document.getElementById('timer-chk')?.checked
    ??document.getElementById('lb-timer-chk')?.checked
    ??false;
  setTimerEnabled(v);
}

function setTurnTimerValue(value){
  const wrap=G.timerWrapEl||(G.timerWrapEl=document.getElementById('timer-wrap'));
  const num=G.timerNumEl||(G.timerNumEl=document.getElementById('timer-num'));
  const next=Math.max(0,parseInt(value,10)||0);
  if(num&&num.textContent!==String(next))num.textContent=String(next);
  if(wrap&&wrap.style.display!=='flex')wrap.style.display='flex';
  refreshTurnTimerWheelDisplay(next);
}

function startTimer(){
  if(!G.timerEnabled)return;
  stopTimer();
  let t=G.timerDuration;
  setTurnTimerValue(t);
  G.timerTick=setInterval(()=>{
    t--;
    setTurnTimerValue(t);
    if(t<=0){stopTimer();toast('⏱ Temps écoulé !','d');doNextTurn();}
  },1000);
}

function stopTimer(){
  if(G.timerTick)clearInterval(G.timerTick);
  G.timerTick=null;
  refreshTurnTimerWheelDisplay(G.timerDuration);
}

// ═══════════════════════════════════════
//  GAME LOG
// ═══════════════════════════════════════
const GAME_LOG_RENDER_LIMIT=60;
let gameLogRenderQueued=false;
function getActivityCategory(text,type=''){
  const raw=(String(text||'')+' '+String(type||'')).toLowerCase();
  if(/achat|achete|shop|construction|maison|hotel/.test(raw))return 'buy';
  if(/loyer|rent|imp[oô]t|taxe|redistribution/.test(raw))return 'rent';
  if(/prison|jail|amende/.test(raw))return 'jail';
  if(/echange|trade|swap/.test(raw))return 'trade';
  if(/[🌩✨🎉🎁☣👑🎯]|event|événement|mission|survie|boss/.test(raw))return 'event';
  if(/ws|r[eé]seau|connect|disconnect|room|serveur/.test(raw))return 'network';
  if(/tour|revanche|partie/.test(raw))return 'turn';
  return 'info';
}
function setHistoryFilter(value){
  G.historyFilter=String(value||'all');
  renderTurnHistory();
}
function setGameLogFilter(value){
  G.gameLogFilter=String(value||'all');
  renderGameLog();
}
function setTxnFilter(value){
  G.txnFilter=String(value||'all');
  if(typeof renderTxns==='function')renderTxns();
}
function queueGameLogRender(){
  if(gameLogRenderQueued)return;
  gameLogRenderQueued=true;
  requestAnimationFrame(()=>{
    gameLogRenderQueued=false;
    renderGameLog();
  });
}
function renderGameLog(){
  const log=document.getElementById('glog');
  if(!log)return;
  const filterEl=document.getElementById('glog-filter');
  const meta=document.getElementById('glog-meta');
  const filter=String((filterEl&&filterEl.value)||G.gameLogFilter||'all');
  G.gameLogFilter=filter;
  const allEntries=Array.isArray(G.gameLogEntries)?G.gameLogEntries:[];
  const filtered=filter==='all'?allEntries:allEntries.filter(entry=>entry&&entry.category===filter);
  const visible=filtered.slice(0,GAME_LOG_RENDER_LIMIT);
  const sig=filter+'|'+visible.map(entry=>(entry.ts||0)+'::'+entry.type+'::'+entry.msg).join('|');
  if(G.gameLogRenderSig===sig)return;
  G.gameLogRenderSig=sig;
  log.innerHTML='';
  const frag=document.createDocumentFragment();
  visible.forEach(entry=>{
    const el=document.createElement('div');
    el.className='le'+(entry.type?' '+entry.type:'');
    el.textContent=entry.msg;
    frag.appendChild(el);
  });
  log.appendChild(frag);
  if(meta)meta.textContent=visible.length+' visibles / '+allEntries.length+' entrées';
}
function renderTurnSummaryUi(){
  const card=document.getElementById('turn-summary-card');
  const body=document.getElementById('turn-summary-body');
  if(!card||!body)return;
  if(!G.started||!G.endTurnSummaryEnabled){
    card.style.display='none';
    return;
  }
  card.style.display='block';
  const summary=G.lastTurnSummary;
  if(!summary){
    body.innerHTML='<div style="font-size:.68rem;color:var(--muted)">Le résumé visuel du dernier tour apparaîtra ici.</div>';
    return;
  }
  const delta=Math.round(Number(summary.delta||0));
  const deltaColor=delta>0?'#22c55e':(delta<0?'#f87171':'#cbd5e1');
  const deltaLabel=(delta>0?'+':'')+delta+'$';
  body.innerHTML=''+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'+
      '<div style="font-size:.8rem;font-weight:800;color:'+escapeUiText(summary.color||'#fff')+'">'+escapeUiText(summary.emoji||'🎲')+' '+escapeUiText(summary.name||'Joueur')+'</div>'+
      '<div style="font-size:.72rem;font-weight:800;color:'+deltaColor+'">'+deltaLabel+'</div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px">'+
      '<div class="stat-tile"><div class="stat-tile-val">'+escapeUiText(String(summary.money??0))+'$</div><div class="stat-tile-label">Argent</div></div>'+
      '<div class="stat-tile"><div class="stat-tile-val">'+escapeUiText(String(summary.props??0))+'</div><div class="stat-tile-label">Propriétés</div></div>'+
      '<div class="stat-tile"><div class="stat-tile-val">'+escapeUiText(String(summary.turn||1))+'</div><div class="stat-tile-label">Tour</div></div>'+
    '</div>'+
    '<div style="font-size:.66rem;color:var(--muted);margin-top:7px">📍 '+escapeUiText(summary.cellName||'—')+' • '+escapeUiText(summary.status||'Tour terminé proprement')+'</div>';
}
function glog(msg,type=''){
  const now=Date.now();
  const key=String(type||'')+'::'+String(msg||'');
  if(G.lastLogKey===key&&(now-(G.lastLogAt||0))<700)return;
  G.lastLogKey=key;
  G.lastLogAt=now;
  if(!Array.isArray(G.gameLogEntries))G.gameLogEntries=[];
  G.gameLogEntries.unshift({msg:String(msg||''),type:type||'',category:getActivityCategory(msg,type),ts:now});
  if(G.gameLogEntries.length>240)G.gameLogEntries.length=240;
  queueGameLogRender();
  pushTurnHistory(msg,type||'i');
}

// ═══════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════
function toast(msg,type='i'){
  const wrap=document.getElementById('toasts');
  if(!wrap)return;
  const now=Date.now();
  const key=String(type||'i')+'::'+String(msg||'');
  if(G.lastToastKey===key&&(now-(G.lastToastAt||0))<900)return;
  G.lastToastKey=key;
  G.lastToastAt=now;
  const el=document.createElement('div');
  el.className='toast t-'+type;
  el.textContent=msg;
  const ms=Math.max(1000,Number(G.toastMs)||4000);
  el.style.setProperty('--toast-life',ms+'ms');
  wrap.appendChild(el);
  setTimeout(()=>el.remove(),ms);
}

function setToastDuration(seconds){
  const sec=Math.max(1,Math.min(20,parseInt(seconds,10)||4));
  G.toastMs=sec*1000;
  const inp=document.getElementById('notif-dur');
  if(inp)inp.value=sec;
  const inpLb=document.getElementById('lb-notif-dur');
  if(inpLb)inpLb.value=sec;
}

function setAutoEnd(enabled){
  G.autoEnd=!!enabled;
  const a=document.getElementById('auto-end-chk');
  const b=document.getElementById('lb-auto-end-chk');
  if(a)a.checked=G.autoEnd;
  if(b)b.checked=G.autoEnd;
}

function setTimerDuration(seconds){
  const sec=Math.max(10,Math.min(300,parseInt(seconds,10)||60));
  G.timerDuration=sec;
  const a=document.getElementById('timer-dur');
  const b=document.getElementById('lb-timer-dur');
  const c=document.getElementById('pw-turn-timer-dur');
  if(a)a.value=sec;
  if(b)b.value=sec;
  if(c)c.value=sec;
  refreshTurnTimerWheelDisplay(sec);
}

function setTimerEnabled(enabled){
  G.timerEnabled=!!enabled;
  const a=document.getElementById('timer-chk');
  const b=document.getElementById('lb-timer-chk');
  const c=document.getElementById('pw-turn-timer-chk');
  if(a)a.checked=G.timerEnabled;
  if(b)b.checked=G.timerEnabled;
  if(c)c.checked=G.timerEnabled;
  const cfgA=document.getElementById('timer-cfg');
  const cfgB=document.getElementById('lb-timer-cfg');
  if(cfgA)cfgA.style.display=G.timerEnabled?'block':'none';
  if(cfgB)cfgB.style.display=G.timerEnabled?'block':'none';
  document.getElementById('timer-wrap').style.display=G.timerEnabled?'flex':'none';
  if(!G.timerEnabled)stopTimer();
  refreshTurnTimerWheelDisplay(G.timerDuration);
}

function setCenterActionsEnabled(enabled){
  G.centerActions=!!enabled;
  const a=document.getElementById('center-actions-chk');
  const b=document.getElementById('lb-center-actions-chk');
  if(a)a.checked=G.centerActions;
  if(b)b.checked=G.centerActions;
  updateCenterActionsPopup();
}

function setCenterActionsScale(percent){
  const p=Math.max(70,Math.min(170,parseInt(percent,10)||100));
  G.centerActionsScale=p;
  document.documentElement.style.setProperty('--center-actions-scale',String(p/100));
  const a=document.getElementById('center-actions-size');
  const b=document.getElementById('lb-center-actions-size');
  if(a&&parseInt(a.value,10)!==p)a.value=p;
  if(b&&parseInt(b.value,10)!==p)b.value=p;
  const av=document.getElementById('center-actions-size-val');
  const bv=document.getElementById('lb-center-actions-size-val');
  if(av)av.textContent=p+'%';
  if(bv)bv.textContent=p+'%';
  const box=document.querySelector('.center-actions');
  if(box)box.style.setProperty('--center-actions-scale',String(p/100));
}

function setPawnScale(percent){
  const p=Math.max(60,Math.min(130,parseInt(percent,10)||60));
  G.pawnScale=p;
  document.documentElement.style.setProperty('--pawn-scale',String(p/30));
  const a=document.getElementById('pawn-size');
  const b=document.getElementById('lb-pawn-size');
  if(a&&parseInt(a.value,10)!==p)a.value=p;
  if(b&&parseInt(b.value,10)!==p)b.value=p;
  const av=document.getElementById('pawn-size-val');
  const bv=document.getElementById('lb-pawn-size-val');
  if(av)av.textContent=p+'%';
  if(bv)bv.textContent=p+'%';
  refreshPawns();
}

function updateBoardAdaptiveScale(){
  const board=document.getElementById('board');
  if(!board)return;
  const rect=board.getBoundingClientRect();
  const boardSize=Math.min(rect.width||0,rect.height||0);
  if(!boardSize)return;
  const cellSize=boardSize/11;
  const userScale=Math.max(0.85,Math.min(1.7,(CLIENT_UI.cellScale||100)/100));
  const detail=Math.max(0.88,Math.min(1.65,(cellSize/47)*userScale));
  const cellUpscale=Math.max(0.9,Math.min(1.9,(cellSize/45)*userScale));
  G.gameZoom=100;
  document.documentElement.style.setProperty('--game-zoom','1');
  document.documentElement.style.setProperty('--game-zoom-fit','1');
  document.documentElement.style.setProperty('--game-tilt','0deg');
  document.documentElement.style.setProperty('--zoom-detail',detail.toFixed(2));
  document.documentElement.style.setProperty('--cell-upscale',cellUpscale.toFixed(2));
  const pct=Math.round(detail*100);
  const av=document.getElementById('game-upscale-val');
  const bv=document.getElementById('lb-game-upscale-val');
  if(av)av.textContent=pct+'%';
  if(bv)bv.textContent=pct+'%';
}

function setGameZoom(){
  queueBoardAdaptiveScale(0);
}

function isOnlineHost(){
  return !!(G.mode==='online'&&G.myId&&String(G.myId).startsWith('h-'));
}

function canEditPartyOptions(){
  if(G.mode!=='online')return true;
  return isOnlineHost();
}

function syncPartyOptionsBlockVisibility(){
  const block=document.getElementById('cfg-options-partie');
  const resetRow=document.getElementById('cfg-reset-row');
  const cellEditor=document.getElementById('cfg-cell-editor');
  const jsonBox=document.getElementById('cfg-json-export');
  const show=(G.mode!=='online')||isOnlineHost();
  if(block)block.style.display=show?'block':'none';
  if(resetRow)resetRow.style.display=show?'flex':'none';
  if(cellEditor)cellEditor.style.display=show?'block':'none';
  if(jsonBox)jsonBox.style.display=show?'block':'none';
}

function isPartyOptionsLocked(){
  return !!(G.started||!canEditPartyOptions());
}

function applyPartyWheelLockState(){
  syncPartyOptionsBlockVisibility();
  const modal=document.getElementById('modal-party-wheel');
  if(!modal)return;
  const locked=isPartyOptionsLocked();
  const msg=document.getElementById('pw-lock-msg');
  if(msg)msg.style.display=locked?'block':'none';
  const tWrap=document.getElementById('pw-turn-timer-wrap');
  if(tWrap)tWrap.style.display=canEditPartyOptions()?'block':'none';
  modal.querySelectorAll('input,select,textarea,button').forEach(el=>{
    if(el.classList.contains('modal-close'))return;
    if(el.textContent&&el.textContent.trim()==='Fermer')return;
    const id=el.id||'';
    if(id==='invite-link')return;
    el.disabled=locked;
  });
}

function setCenterDiceScale(percent){
  const p=Math.max(80,Math.min(260,parseInt(percent,10)||130));
  G.centerDiceScale=p;
  document.documentElement.style.setProperty('--center-dice-scale',String(p/100));
  const a=document.getElementById('center-dice-size');
  const b=document.getElementById('lb-center-dice-size');
  if(a&&parseInt(a.value,10)!==p)a.value=p;
  if(b&&parseInt(b.value,10)!==p)b.value=p;
  const av=document.getElementById('center-dice-size-val');
  const bv=document.getElementById('lb-center-dice-size-val');
  if(av)av.textContent=p+'%';
  if(bv)bv.textContent=p+'%';
}

function setPawnGlow(enabled){
  G.pawnGlow=!!enabled;
  document.documentElement.style.setProperty('--pawn-glow',G.pawnGlow?'.8':'0');
  const chk=document.getElementById('pawn-glow-chk');
  if(chk)chk.checked=G.pawnGlow;
  const chkLb=document.getElementById('lb-pawn-glow-chk');
  if(chkLb)chkLb.checked=G.pawnGlow;
  refreshPawns();
}

function setStreamerMode(enabled){
  G.streamerMode=!!enabled;
  document.body.classList.toggle('streamer-mode',G.streamerMode);
  const a=document.getElementById('streamer-chk');
  const b=document.getElementById('lb-streamer-chk');
  if(a)a.checked=G.streamerMode;
  if(b)b.checked=G.streamerMode;
  updateMusicForContext();
}

function ensureAudioEngine(){
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return false;
  if(!AUDIO_ENGINE.ctx){
    AUDIO_ENGINE.ctx=new Ctx();
    AUDIO_ENGINE.master=AUDIO_ENGINE.ctx.createGain();
    AUDIO_ENGINE.musicGain=AUDIO_ENGINE.ctx.createGain();
    AUDIO_ENGINE.sfxGain=AUDIO_ENGINE.ctx.createGain();
    AUDIO_ENGINE.master.gain.value=1;
    AUDIO_ENGINE.musicGain.gain.value=0;
    AUDIO_ENGINE.sfxGain.gain.value=0;
    AUDIO_ENGINE.musicGain.connect(AUDIO_ENGINE.master);
    AUDIO_ENGINE.sfxGain.connect(AUDIO_ENGINE.master);
    AUDIO_ENGINE.master.connect(AUDIO_ENGINE.ctx.destination);
  }
  return true;
}

function playMusicTone(freq,duration=0.25,volume=0.12,wave='sine'){
  if(!AUDIO_ENGINE.ctx||!AUDIO_ENGINE.musicGain||!freq||freq<=0)return;
  const now=AUDIO_ENGINE.ctx.currentTime;
  const osc=AUDIO_ENGINE.ctx.createOscillator();
  const gain=AUDIO_ENGINE.ctx.createGain();
  osc.type=wave||'sine';
  osc.frequency.setValueAtTime(freq,now);
  gain.gain.setValueAtTime(0,now);
  gain.gain.linearRampToValueAtTime(volume,now+0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001,now+Math.max(0.08,duration));
  osc.connect(gain);
  gain.connect(AUDIO_ENGINE.musicGain);
  osc.start(now);
  osc.stop(now+Math.max(0.1,duration+0.06));
}

function playSfxTone(freq,duration=0.12,volume=0.2,wave='triangle',atOffset=0){
  if(!AUDIO_ENGINE.ctx||!AUDIO_ENGINE.sfxGain||!freq||freq<=0)return;
  if(G.soundMuted||G.sfxVolume<=0)return;
  if(AUDIO_ENGINE.ctx.state!=='running')return;
  const now=AUDIO_ENGINE.ctx.currentTime+Math.max(0,atOffset);
  const osc=AUDIO_ENGINE.ctx.createOscillator();
  const gain=AUDIO_ENGINE.ctx.createGain();
  osc.type=wave||'triangle';
  osc.frequency.setValueAtTime(freq,now);
  gain.gain.setValueAtTime(0.0001,now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002,volume),now+0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001,now+Math.max(0.03,duration));
  osc.connect(gain);
  gain.connect(AUDIO_ENGINE.sfxGain);
  osc.start(now);
  osc.stop(now+Math.max(0.05,duration+0.02));
}

function playSfx(name){
  if(!ensureAudioEngine())return;
  if(!AUDIO_ENGINE.unlocked)return;
  switch(name){
    case 'dice':
      playSfxTone(180,.07,.18,'square',0);
      playSfxTone(130,.08,.16,'square',.08);
      break;
    case 'buy':
      playSfxTone(440,.08,.16,'triangle',0);
      playSfxTone(554,.1,.16,'triangle',.08);
      playSfxTone(659,.12,.14,'triangle',.17);
      break;
    case 'jail':
      playSfxTone(280,.1,.17,'sawtooth',0);
      playSfxTone(210,.12,.16,'sawtooth',.1);
      playSfxTone(160,.14,.15,'triangle',.22);
      break;
    case 'victory':
      playSfxTone(523.25,.11,.17,'triangle',0);
      playSfxTone(659.25,.11,.18,'triangle',.1);
      playSfxTone(783.99,.14,.19,'triangle',.2);
      playSfxTone(1046.5,.2,.16,'sine',.34);
      break;
  }
}

function testSfxPack(){
  unlockAudio();
  if(G.soundMuted||G.sfxVolume<=0){
    toast('Active le son SFX pour tester','w');
    return;
  }
  playSfx('dice');
  setTimeout(()=>playSfx('buy'),260);
  setTimeout(()=>playSfx('jail'),620);
  setTimeout(()=>playSfx('victory'),1020);
  toast('Préécoute SFX lancée','i');
}

function testSingleSfx(name){
  unlockAudio();
  if(G.soundMuted||G.sfxVolume<=0){
    toast('Active le son SFX pour tester','w');
    return;
  }
  playSfx(name);
}

function getAsianPlaylistUrls(){
  return ASIAN_MUSIC_FILES.map(n=>ASIAN_MUSIC_BASE+encodeURIComponent(n));
}

function getImportedPlaylistUrls(){
  return (AUDIO_ENGINE.userTracks||[]).map(t=>t.url);
}

function updateImportedMusicUi(){
  const n=(AUDIO_ENGINE.userTracks||[]).length;
  const txt=n>0?(n+' piste(s) importée(s).'):'Aucune musique importée.';
  const a=document.getElementById('music-import-info');
  const b=document.getElementById('lb-music-import-info');
  if(a)a.textContent=txt;
  if(b)b.textContent=txt;
}

function clearImportedMusicFiles(){
  (AUDIO_ENGINE.userTracks||[]).forEach(t=>{try{URL.revokeObjectURL(t.url);}catch(e){}});
  AUDIO_ENGINE.userTracks=[];
  AUDIO_ENGINE.userQueue=[];
  AUDIO_ENGINE.userIndex=0;
  updateImportedMusicUi();
}

function triggerUserMusicImport(){
  const inp=document.getElementById('music-import-input');
  if(inp)inp.click();
}

function importUserMusicFiles(files){
  const arr=Array.from(files||[]).filter(f=>f&&((f.type&&f.type.startsWith('audio/'))||/\.(m4a|mp3|wav|ogg|aac)$/i.test(f.name||'')));
  if(!arr.length){toast('Aucun fichier audio valide','w');return;}
  clearImportedMusicFiles();
  AUDIO_ENGINE.userTracks=arr.map(f=>({name:f.name,url:URL.createObjectURL(f)}));
  AUDIO_ENGINE.userQueue=[];
  AUDIO_ENGINE.userIndex=0;
  updateImportedMusicUi();
  setMusicSource('imported-files');
  toast(arr.length+' musique(s) importée(s)','a');
}

function shuffleArray(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    const t=a[i];a[i]=a[j];a[j]=t;
  }
  return a;
}

function ensureBackgroundAudioElement(){
  if(AUDIO_ENGINE.bgAudio)return AUDIO_ENGINE.bgAudio;
  const a=new Audio();
  a.preload='auto';
  a.addEventListener('ended',()=>playNextAsianTrack());
  a.addEventListener('error',()=>playNextAsianTrack());
  AUDIO_ENGINE.bgAudio=a;
  if(ensureAudioEngine()){
    try{
      if(!AUDIO_ENGINE.bgSource){
        AUDIO_ENGINE.bgSource=AUDIO_ENGINE.ctx.createMediaElementSource(a);
      }
      if(!AUDIO_ENGINE.bgBoostGain){
        AUDIO_ENGINE.bgBoostGain=AUDIO_ENGINE.ctx.createGain();
        AUDIO_ENGINE.bgBoostGain.gain.value=1;
      }
      AUDIO_ENGINE.bgSource.disconnect();
      AUDIO_ENGINE.bgBoostGain.disconnect();
      AUDIO_ENGINE.bgSource.connect(AUDIO_ENGINE.bgBoostGain);
      AUDIO_ENGINE.bgBoostGain.connect(AUDIO_ENGINE.musicGain);
    }catch(e){}
  }
  return a;
}

function stopExternalPlaylist(){
  const a=AUDIO_ENGINE.bgAudio;
  if(!a)return;
  a.pause();
}

function isManagedMusicPlaylistSource(source){
  return source==='asian-pack'||source==='imported-files';
}

function playNextAsianTrack(){
  if(!isManagedMusicPlaylistSource(G.musicSource))return;
  if(!G.musicEnabled||G.soundMuted||G.musicVolume<=0)return;
  if(!AUDIO_ENGINE.unlocked)return;
  const a=ensureBackgroundAudioElement();
  let list=[];
  let idx=0;
  if(G.musicSource==='asian-pack'){
    if(!AUDIO_ENGINE.packQueue.length||AUDIO_ENGINE.packIndex>=AUDIO_ENGINE.packQueue.length){
      AUDIO_ENGINE.packQueue=shuffleArray(getAsianPlaylistUrls());
      AUDIO_ENGINE.packIndex=0;
    }
    list=AUDIO_ENGINE.packQueue;
    idx=AUDIO_ENGINE.packIndex;
  }else{
    if(!AUDIO_ENGINE.userTracks.length){
      stopExternalPlaylist();
      return;
    }
    if(!AUDIO_ENGINE.userQueue.length||AUDIO_ENGINE.userIndex>=AUDIO_ENGINE.userQueue.length){
      AUDIO_ENGINE.userQueue=shuffleArray(getImportedPlaylistUrls());
      AUDIO_ENGINE.userIndex=0;
    }
    list=AUDIO_ENGINE.userQueue;
    idx=AUDIO_ENGINE.userIndex;
  }
  const url=list[idx];
  if(G.musicSource==='asian-pack')AUDIO_ENGINE.packIndex++;
  else AUDIO_ENGINE.userIndex++;
  if(!url)return;
  a.src=url;
  a.currentTime=0;
  a.play().catch(()=>{});
}

function startExternalPlaylist(){
  stopSynthMusic();
  const a=ensureBackgroundAudioElement();
  a.loop=false;
  if(!a.src||a.paused){
    playNextAsianTrack();
  }else{
    a.play().catch(()=>{});
  }
}

function stopSynthMusic(){
  if(AUDIO_ENGINE.timer){clearInterval(AUDIO_ENGINE.timer);AUDIO_ENGINE.timer=null;}
  AUDIO_ENGINE.theme='none';
}

function stopMusic(){
  stopSynthMusic();
  stopExternalPlaylist();
}

function startMusicTheme(theme){
  const variantKey=getSafeMusicThemeVariant(G.musicThemeVariant||'aurora');
  const family=MUSIC_THEMES[variantKey]||MUSIC_THEMES.aurora;
  const rawTheme=(family&&family[theme])||family?.lobby||null;
  const themeDef=Array.isArray(rawTheme)?{stepMs:460,sequence:rawTheme}:rawTheme;
  const seq=themeDef&&Array.isArray(themeDef.sequence)?themeDef.sequence:[];
  if(!seq.length)return;
  if(AUDIO_ENGINE.timer&&AUDIO_ENGINE.theme===theme+'::'+variantKey)return;
  stopSynthMusic();
  AUDIO_ENGINE.theme=theme+'::'+variantKey;
  AUDIO_ENGINE.step=0;
  const stepMs=Math.max(180,parseInt(themeDef.stepMs,10)||460);
  const runStep=()=>{
    if(!G.musicEnabled||G.soundMuted||G.musicVolume<=0)return;
    if(!AUDIO_ENGINE.ctx||AUDIO_ENGINE.ctx.state!=='running')return;
    const n=seq[AUDIO_ENGINE.step%seq.length];
    AUDIO_ENGINE.step++;
    if(!n)return;
    const freqs=Array.isArray(n.f)?n.f:[n.f];
    const waves=Array.isArray(n.t)?n.t:[n.t];
    freqs.forEach((freq,index)=>{
      if(!(freq>0))return;
      const wave=waves[index]||waves[0]||(index===0?'sine':'triangle');
      const volume=Math.max(.018,(Number(n.v)||.12)*(index===0?1:.68));
      const duration=Math.max(.08,(Number(n.d)||.25)*(index===0?1:1.08));
      playMusicTone(freq,duration,volume,wave);
    });
  };
  runStep();
  AUDIO_ENGINE.timer=setInterval(runStep,stepMs);
}

function syncAudioVolumeUi(){
  const mv=Math.max(0,Math.min(100,parseInt(G.musicVolume,10)||45));
  const sv=Math.max(0,Math.min(100,parseInt(G.sfxVolume,10)||55));
  ['music-vol','lb-music-vol'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=mv;});
  ['music-vol-val','lb-music-vol-val'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=mv+'%';});
  ['sfx-vol','lb-sfx-vol'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=sv;});
  ['sfx-vol-val','lb-sfx-vol-val'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=sv+'%';});
}

function syncMusicBoostUi(){
  const playlistMode=isManagedMusicPlaylistSource(G.musicSource);
  const enabled=!!G.musicBoostEnabled&&playlistMode;
  const pct=Math.max(100,Math.min(250,parseInt(G.musicBoostPercent,10)||130));
  ['music-boost-chk','lb-music-boost-chk'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){
      el.checked=!!G.musicBoostEnabled;
      el.disabled=!playlistMode;
    }
  });
  ['music-boost','lb-music-boost'].forEach(id=>{const el=document.getElementById(id);if(el){el.value=pct;el.disabled=!enabled;}});
  ['music-boost-val','lb-music-boost-val'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent=pct+'%';el.style.opacity=enabled?'1':'.55';}});
}

function volumePercentToGain(percent){
  const p=Math.max(0,Math.min(100,Number(percent)||0));
  if(p<=0)return 0;
  // Linear in dB for a more natural perceived progression.
  const minDb=-60;
  const maxDb=0;
  const db=minDb+((p/100)*(maxDb-minDb));
  return Math.pow(10,db/20);
}

function applyAudioGain(){
  ensureAudioEngine();
  const musicBlocked=!!G.streamerMode;
  const m=(G.soundMuted||!G.musicEnabled||musicBlocked)?0:volumePercentToGain(G.musicVolume);
  const s=(G.soundMuted)?0:volumePercentToGain(G.sfxVolume);
  const external=isManagedMusicPlaylistSource(G.musicSource);
  const fixedBoost=(G.musicBoostEnabled&&external)?Math.max(1,Math.min(2.5,(parseInt(G.musicBoostPercent,10)||130)/100)):1;
  if(AUDIO_ENGINE.musicGain)AUDIO_ENGINE.musicGain.gain.value=m;
  if(AUDIO_ENGINE.sfxGain)AUDIO_ENGINE.sfxGain.gain.value=s;
  if(AUDIO_ENGINE.bgBoostGain)AUDIO_ENGINE.bgBoostGain.gain.value=fixedBoost;
  if(AUDIO_ENGINE.bgAudio){
    const routed=!!AUDIO_ENGINE.bgSource;
    AUDIO_ENGINE.bgAudio.volume=routed?1:Math.min(1,m*fixedBoost);
    AUDIO_ENGINE.bgAudio.muted=!!G.soundMuted||!G.musicEnabled||musicBlocked;
  }
}

function getSafeDaTheme(value){
  const key=String(value||'aurora').trim().toLowerCase();
  return DA_THEMES[key]?key:'aurora';
}

function getSafeMusicThemeVariant(value){
  const key=String(value||'aurora').trim().toLowerCase();
  return MUSIC_THEMES[key]?key:'aurora';
}

function syncDaThemeUi(){
  const v=getSafeDaTheme(G.daTheme||'aurora');
  ['da-theme','lb-da-theme'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.value=v;
  });
}

function syncMusicThemeVariantUi(){
  const v=getSafeMusicThemeVariant(G.musicThemeVariant||'aurora');
  const enabled=(G.musicSource||'default')==='default';
  ['music-theme-variant','lb-music-theme-variant'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.value=v;
    el.disabled=!enabled;
    el.style.opacity=enabled?'1':'.65';
  });
}

function applyDaTheme(themeValue){
  const key=getSafeDaTheme(themeValue);
  G.daTheme=key;
  document.documentElement.setAttribute('data-da-theme',key);
  if(document.body)document.body.setAttribute('data-da-theme',key);
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',DA_THEMES[key]?.meta||'#050816');
  syncDaThemeUi();
}

function setDaTheme(themeValue){
  applyDaTheme(themeValue);
  saveAudioPrefs();
  toast('DA appliquée : '+(DA_THEMES[G.daTheme]?.label||'Aurora néon'),'a');
}

function syncMusicSourceUi(){
  const v=G.musicSource||'default';
  const a=document.getElementById('music-source');
  const b=document.getElementById('lb-music-source');
  if(a)a.value=v;
  if(b)b.value=v;
  syncMusicThemeVariantUi();
  syncMusicBoostUi();
  updateImportedMusicUi();
}

function setMusicThemeVariant(value){
  G.musicThemeVariant=getSafeMusicThemeVariant(value);
  syncMusicThemeVariantUi();
  saveAudioPrefs();
  if(G.musicSource==='default')updateMusicForContext();
  toast('Ambiance musicale : '+(MUSIC_THEMES[G.musicThemeVariant]?.label||'Aurora lounge'),'i');
}

function setMusicSource(source){
  G.musicSource=(['default','external-player','asian-pack','imported-files'].includes(source)?source:'default');
  syncMusicSourceUi();
  if(G.musicSource==='imported-files'&&!AUDIO_ENGINE.userTracks.length){
    toast('Importe des fichiers audio pour utiliser cette playlist','w');
  }else if(G.musicSource==='external-player'){
    toast('🎵 Playlist perso active : NeoPoly coupe sa musique et garde les SFX.','i');
  }else if(G.musicSource==='default'){
    toast('🎮 Musique NeoPoly activée.','i');
  }
  saveAudioPrefs();
  updateMusicForContext();
}

function updateMusicForContext(){
  applyAudioGain();
  if(G.streamerMode||!G.musicEnabled||G.soundMuted||G.musicVolume<=0){stopMusic();return;}
  if(!AUDIO_ENGINE.unlocked)return;
  if(G.musicSource==='external-player'){
    stopMusic();
    return;
  }
  if(isManagedMusicPlaylistSource(G.musicSource)){
    startExternalPlaylist();
    return;
  }
  stopExternalPlaylist();
  const target=(G.started||document.getElementById('game')?.classList.contains('active'))?'game':'lobby';
  startMusicTheme(target);
}

function unlockAudio(){
  const ok=ensureAudioEngine();
  if(ok&&AUDIO_ENGINE.ctx.state!=='running'){
    AUDIO_ENGINE.ctx.resume().catch(()=>{});
  }
  AUDIO_ENGINE.unlocked=true;
  updateMusicForContext();
}

function saveAudioPrefs(){
  const payload={
    musicEnabled:!!G.musicEnabled,
    musicSource:G.musicSource||'default',
    musicThemeVariant:getSafeMusicThemeVariant(G.musicThemeVariant||'aurora'),
    daTheme:getSafeDaTheme(G.daTheme||'aurora'),
    soundMuted:!!G.soundMuted,
    musicVolume:Math.max(0,Math.min(100,parseInt(G.musicVolume,10)||45)),
    musicBoostEnabled:!!G.musicBoostEnabled,
    musicBoostPercent:Math.max(100,Math.min(250,parseInt(G.musicBoostPercent,10)||130)),
    sfxVolume:Math.max(0,Math.min(100,parseInt(G.sfxVolume,10)||55)),
    visualFxEnabled:!!G.visualFxEnabled,
  };
  try{localStorage.setItem(AUDIO_PREFS_KEY,JSON.stringify(payload));}catch(e){}
}

function saveClientUiPrefs(){
  try{localStorage.setItem(CLIENT_UI_PREFS_KEY,JSON.stringify({cellScale:CLIENT_UI.cellScale}));}catch(e){}
}

function loadClientUiPrefs(){
  try{
    const raw=localStorage.getItem(CLIENT_UI_PREFS_KEY)||'{}';
    const prefs=JSON.parse(raw);
    if(prefs&&typeof prefs==='object'&&prefs.cellScale!==undefined){
      CLIENT_UI.cellScale=Math.max(85,Math.min(170,parseInt(prefs.cellScale,10)||100));
    }
  }catch(e){}
}

function setClientCellScale(percent){
  const p=Math.max(85,Math.min(170,parseInt(percent,10)||100));
  CLIENT_UI.cellScale=p;
  const a=document.getElementById('cell-scale');
  const b=document.getElementById('lb-cell-scale');
  if(a&&parseInt(a.value,10)!==p)a.value=p;
  if(b&&parseInt(b.value,10)!==p)b.value=p;
  const av=document.getElementById('cell-scale-val');
  const bv=document.getElementById('lb-cell-scale-val');
  if(av)av.textContent=p+'%';
  if(bv)bv.textContent=p+'%';
  saveClientUiPrefs();
  queueBoardAdaptiveScale(30);
}

function loadAudioPrefs(){
  try{
    const raw=localStorage.getItem(AUDIO_PREFS_KEY)||'{}';
    const a=JSON.parse(raw);
    if(a&&typeof a==='object'){
      if(a.musicEnabled!==undefined)G.musicEnabled=!!a.musicEnabled;
      if(a.musicSource!==undefined)G.musicSource=(['default','external-player','asian-pack','imported-files'].includes(a.musicSource)?a.musicSource:'default');
      if(a.musicThemeVariant!==undefined)G.musicThemeVariant=getSafeMusicThemeVariant(a.musicThemeVariant);
      if(a.daTheme!==undefined)G.daTheme=getSafeDaTheme(a.daTheme);
      if(a.soundMuted!==undefined)G.soundMuted=!!a.soundMuted;
      if(a.musicVolume!==undefined)G.musicVolume=Math.max(0,Math.min(100,parseInt(a.musicVolume,10)||45));
      if(a.musicBoostEnabled!==undefined)G.musicBoostEnabled=!!a.musicBoostEnabled;
      if(a.musicBoostPercent!==undefined)G.musicBoostPercent=Math.max(100,Math.min(250,parseInt(a.musicBoostPercent,10)||130));
      if(a.sfxVolume!==undefined)G.sfxVolume=Math.max(0,Math.min(100,parseInt(a.sfxVolume,10)||55));
      if(a.masterVolume!==undefined){
        const legacy=Math.max(0,Math.min(100,parseInt(a.masterVolume,10)||45));
        if(a.musicVolume===undefined)G.musicVolume=legacy;
        if(a.sfxVolume===undefined)G.sfxVolume=legacy;
      }
      if(a.visualFxEnabled!==undefined)G.visualFxEnabled=!!a.visualFxEnabled;
    }
  }catch(e){}
  applyDaTheme(G.daTheme||'aurora');
  syncMusicSourceUi();
  syncDaThemeUi();
}

function setMusicVolume(v){
  G.musicVolume=Math.max(0,Math.min(100,parseInt(v,10)||0));
  syncAudioVolumeUi();
  applyAudioGain();
  saveAudioPrefs();
  updateMusicForContext();
}

function setSfxVolume(v){
  G.sfxVolume=Math.max(0,Math.min(100,parseInt(v,10)||0));
  syncAudioVolumeUi();
  applyAudioGain();
  saveAudioPrefs();
  updateMusicForContext();
}

function setMusicBoostEnabled(enabled){
  G.musicBoostEnabled=!!enabled;
  syncMusicBoostUi();
  applyAudioGain();
  saveAudioPrefs();
  updateMusicForContext();
}

function setMusicBoostPercent(v){
  G.musicBoostPercent=Math.max(100,Math.min(250,parseInt(v,10)||130));
  syncMusicBoostUi();
  applyAudioGain();
  saveAudioPrefs();
  updateMusicForContext();
}

function setMusicEnabled(enabled){
  G.musicEnabled=!!enabled;
  const a=document.getElementById('music-chk');
  const b=document.getElementById('lb-music-chk');
  if(a)a.checked=G.musicEnabled;
  if(b)b.checked=G.musicEnabled;
  syncMusicSourceUi();
  saveAudioPrefs();
  updateMusicForContext();
}

function setSoundMuted(enabled){
  G.soundMuted=!!enabled;
  const a=document.getElementById('sound-mute-chk');
  const b=document.getElementById('lb-sound-mute-chk');
  if(a)a.checked=G.soundMuted;
  if(b)b.checked=G.soundMuted;
  saveAudioPrefs();
  updateMusicForContext();
}

function setVisualFxEnabled(enabled){
  G.visualFxEnabled=!!enabled;
  const a=document.getElementById('visual-fx-chk');
  const b=document.getElementById('lb-visual-fx-chk');
  if(a)a.checked=G.visualFxEnabled;
  if(b)b.checked=G.visualFxEnabled;
  const layers=['lobby-ambient','game-ambient'];
  layers.forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.classList.toggle('hidden',!G.visualFxEnabled);
  });
  saveAudioPrefs();
}

function refreshTurnTimerWheelDisplay(currentLeft){
  const el=document.getElementById('pw-turn-timer-live');
  if(!el)return;
  if(!G.timerEnabled){el.textContent='Chrono tour: off';return;}
  const t=Math.max(0,parseInt(currentLeft,10)||G.timerDuration||0);
  const mm=Math.floor(t/60).toString().padStart(2,'0');
  const ss=String(t%60).padStart(2,'0');
  el.textContent='Chrono tour: '+mm+':'+ss;
}

function refreshPartyRuleUi(){
  syncPartyOptionsBlockVisibility();
  const editable=canEditPartyOptions();
  const sm=document.getElementById('pw-start-money');
  const pg=document.getElementById('pw-passgo-bonus');
  const jf=document.getElementById('pw-jail-fine');
  const mt=document.getElementById('pw-max-turns');
  const gm=document.getElementById('pw-goal-money');
  const dom=document.getElementById('pw-domination-groups');
  const gt=document.getElementById('pw-global-timer');
  const inf=document.getElementById('pw-inflation-chk');
  const infRate=document.getElementById('pw-inflation-rate');
  const taxVar=document.getElementById('pw-tax-variance-chk');
  const bonus=document.getElementById('pw-bonus-turn-chk');
  const bonusRate=document.getElementById('pw-bonus-turn-rate');
  const park=document.getElementById('pw-parking-pot-chk');
  const teamPreset=document.getElementById('pw-team-mode');
  const cfgTeamPreset=document.getElementById('cfg-team-mode');
  const teamNote=document.getElementById('pw-team-mode-note');
  const cfgTeamNote=document.getElementById('cfg-team-mode-note');
  const openPartyBtn=document.getElementById('open-party-custom-btn');
  const turnTimer=document.getElementById('pw-turn-timer-chk');
  const turnTimerDur=document.getElementById('pw-turn-timer-dur');
  const draft=document.getElementById('pw-start-draft');
  const worldEvent=document.getElementById('pw-world-event-mode');
  const survival=document.getElementById('pw-survival-mode');
  const boss=document.getElementById('pw-boss-mode');
  const powers=document.getElementById('pw-special-powers-mode');
  const rematch=document.getElementById('pw-rematch-mode');
  const quests=document.getElementById('pw-quest-mode');
  const fog=document.getElementById('pw-fog-mode');
  const tutorial=document.getElementById('pw-tutorial-hints-chk');
  const endSummary=document.getElementById('pw-end-summary-chk');
  if(sm)sm.value=G.startingMoney;
  if(pg)pg.value=G.passGoBonus;
  if(jf)jf.value=G.jailFine;
  if(mt)mt.value=G.maxTurns;
  if(gm)gm.value=G.goalMoney;
  if(dom)dom.value=G.dominationTarget;
  if(gt)gt.value=G.globalTimerSec;
  if(inf)inf.checked=!!G.inflationEnabled;
  if(infRate)infRate.value=G.inflationRate;
  if(taxVar)taxVar.checked=!!G.taxVarianceEnabled;
  if(bonus)bonus.checked=!!G.bonusTurnEnabled;
  if(bonusRate)bonusRate.value=G.bonusTurnChance;
  if(park)park.checked=!!G.parkingPotEnabled;
  if(teamPreset)teamPreset.value=normalizeTeamModePreset(G.teamModePreset);
  if(cfgTeamPreset)cfgTeamPreset.value=normalizeTeamModePreset(G.teamModePreset);
  if(turnTimer)turnTimer.checked=!!G.timerEnabled;
  if(turnTimerDur)turnTimerDur.value=G.timerDuration;
  if(draft)draft.value=normalizeStartDraftMode(G.startDraftMode);
  if(worldEvent)worldEvent.value=normalizeWorldEventMode(G.worldEventMode);
  if(survival)survival.value=normalizeSurvivalMode(G.survivalMode);
  if(boss)boss.value=normalizeBossBotMode(G.bossBotMode);
  if(powers)powers.value=normalizeSpecialPowersMode(G.specialPowersMode);
  if(rematch)rematch.value=normalizeRematchMode(G.rematchMode);
  if(quests)quests.value=normalizeMatchQuestMode(G.matchQuestMode);
  if(fog)fog.value=normalizeFogMode(G.fogMode);
  if(tutorial)tutorial.checked=!!G.tutorialHintsEnabled;
  if(endSummary)endSummary.checked=!!G.endTurnSummaryEnabled;

  if(teamPreset)teamPreset.disabled=!editable;
  if(cfgTeamPreset)cfgTeamPreset.disabled=isPartyOptionsLocked();
  if(turnTimer)turnTimer.disabled=!editable;
  if(turnTimerDur)turnTimerDur.disabled=!editable||!G.timerEnabled;
  if(infRate)infRate.disabled=!editable||!G.inflationEnabled;
  if(bonusRate)bonusRate.disabled=!editable||!G.bonusTurnEnabled;
  [draft,worldEvent,survival,boss,powers,rematch,quests,fog,tutorial,endSummary].forEach(el=>{if(el)el.disabled=!editable;});

  const preset=normalizeTeamModePreset(G.teamModePreset);
  const requiredPlayers=getTeamModeRequirement(preset);
  const teamHelpText=preset==='off'
    ?'Modes d\'équipe désactivés : la partie restera en chacun pour soi.'
    :(getTeamModeLabel(preset)+' : '+requiredPlayers+' joueurs requis ('+(preset==='2v2'?'2 équipes de 2':'3 équipes de 2')+').');
  if(teamNote)teamNote.textContent=teamHelpText;
  if(cfgTeamNote)cfgTeamNote.textContent=teamHelpText;
  if(openPartyBtn){
    openPartyBtn.disabled=isPartyOptionsLocked();
    openPartyBtn.textContent=G.mode==='online'?'⚙️ Personnaliser la partie (hôte)':'⚙️ Personnaliser la partie';
  }
  refreshTurnTimerWheelDisplay(document.getElementById('timer-num')?.textContent||G.timerDuration);
  renderPartyModePreview();
  const skip=document.getElementById('skip-btn');
  if(skip){
    const cur=G.players[G.cur];
    skip.textContent=(cur&&(cur.jailCards||0)>0)?'🃏 Sortir':'🔓 '+G.jailFine+' $';
  }
  const pot=document.getElementById('pw-parking-pot-val');
  if(pot)pot.textContent=String(G.parkingPot||0);
  applyPartyWheelLockState();
  refreshPartyBotUi();
  renderInventoryUi();
}

function setStartingMoney(v){
  const n=Math.max(500,Math.min(10000,parseInt(v,10)||1500));
  G.startingMoney=n;
  refreshPartyRuleUi();
}

function setPassGoBonus(v){
  const n=Math.max(0,Math.min(2000,parseInt(v,10)||200));
  G.passGoBonus=n;
  refreshPartyRuleUi();
}

function setJailFine(v){
  const n=Math.max(0,Math.min(500,parseInt(v,10)||50));
  G.jailFine=n;
  refreshPartyRuleUi();
}

function setMaxTurns(v){
  const n=Math.max(0,Math.min(300,parseInt(v,10)||0));
  G.maxTurns=n;
  refreshPartyRuleUi();
}

function setGoalMoney(v){
  const n=Math.max(0,Math.min(50000,parseInt(v,10)||0));
  G.goalMoney=n;
  refreshPartyRuleUi();
}

function setDominationTarget(v){
  const n=Math.max(0,Math.min(8,parseInt(v,10)||0));
  G.dominationTarget=n;
  refreshPartyRuleUi();
}

function setGlobalTimerSec(v){
  const n=Math.max(0,Math.min(14400,parseInt(v,10)||0));
  G.globalTimerSec=n;
  refreshPartyRuleUi();
}

function setInflationEnabled(v){
  G.inflationEnabled=!!v;
  refreshPartyRuleUi();
}

function setInflationRate(v){
  const n=Math.max(0,Math.min(20,parseFloat(v)||0));
  G.inflationRate=n;
  refreshPartyRuleUi();
}

function setTaxVarianceEnabled(v){
  G.taxVarianceEnabled=!!v;
  refreshPartyRuleUi();
}

function setBonusTurnEnabled(v){
  G.bonusTurnEnabled=!!v;
  refreshPartyRuleUi();
}

function setBonusTurnChance(v){
  const n=Math.max(0,Math.min(100,parseInt(v,10)||0));
  G.bonusTurnChance=n;
  refreshPartyRuleUi();
}

function setParkingPotEnabled(v){
  G.parkingPotEnabled=!!v;
  refreshPartyRuleUi();
}

function setTeamModePreset(v){
  G.teamModePreset=normalizeTeamModePreset(v);
  clearTeamMode();
  refreshPartyRuleUi();
  renderAlliancePanel();
}
function setStartDraftMode(v){
  G.startDraftMode=normalizeStartDraftMode(v);
  refreshPartyRuleUi();
}
function setWorldEventMode(v){
  G.worldEventMode=normalizeWorldEventMode(v);
  if(G.worldEventMode==='off')G.boardEvent=null;
  refreshPartyRuleUi();
  renderBoardEventUi();
}
function setSurvivalMode(v){
  G.survivalMode=normalizeSurvivalMode(v);
  refreshPartyRuleUi();
}
function setBossBotMode(v){
  G.bossBotMode=normalizeBossBotMode(v);
  refreshPartyRuleUi();
}
function setSpecialPowersMode(v){
  G.specialPowersMode=normalizeSpecialPowersMode(v);
  refreshPartyRuleUi();
}
function setRematchMode(v){
  G.rematchMode=normalizeRematchMode(v);
  refreshPartyRuleUi();
}
function setMatchQuestMode(v){
  G.matchQuestMode=normalizeMatchQuestMode(v);
  refreshPartyRuleUi();
  renderMatchObjectiveUi();
}
function setFogMode(v){
  G.fogMode=normalizeFogMode(v);
  refreshPartyRuleUi();
  if(typeof renderPlayers==='function')renderPlayers();
  if(typeof renderStats==='function')renderStats();
}
function setTutorialHintsEnabled(v){
  G.tutorialHintsEnabled=!!v;
  refreshPartyRuleUi();
  if(typeof renderPlayers==='function')renderPlayers();
}
function setEndTurnSummaryEnabled(v){
  G.endTurnSummaryEnabled=!!v;
  refreshPartyRuleUi();
}

function renderInventoryUi(){
  const i=P.inventory||{};
  const sig=[i.diceBoost||0,i.antiJail||0,i.mortgageDiscount||0,G.cur,G.started,G.rolled].join('|');
  if(G.inventoryUiSignature===sig)return;
  G.inventoryUiSignature=sig;
  const d=document.getElementById('inv-dice');if(d)d.textContent=String(i.diceBoost||0);
  const j=document.getElementById('inv-jail');if(j)j.textContent=String(i.antiJail||0);
  const m=document.getElementById('inv-discount');if(m)m.textContent=String(i.mortgageDiscount||0);
  const b=document.getElementById('boost-btn');
  const p=G.players[G.cur];
  const controlled=!!(p&&isProfileControlledPlayer(p));
  if(b){
    const qty=i.diceBoost||0;
    b.textContent='⚡ Booster dé ('+qty+')';
    b.disabled=qty<=0||!G.started||G.rolled||!controlled;
  }
  refreshPowerupsUi();
}

function ensurePlayerMatchItems(p){
  if(!p)return {diceBoost:0,antiJail:0,mortgageDiscount:0};
  if(!p.matchItems||typeof p.matchItems!=='object')p.matchItems={};
  p.matchItems.diceBoost=Math.max(0,parseInt(p.matchItems.diceBoost,10)||0);
  p.matchItems.antiJail=Math.max(0,parseInt(p.matchItems.antiJail,10)||0);
  p.matchItems.mortgageDiscount=Math.max(0,parseInt(p.matchItems.mortgageDiscount,10)||0);
  return p.matchItems;
}

function renderMatchItemsUi(){
  const p=G.players[G.cur];
  const controlled=!!(p&&isProfileControlledPlayer(p));
  const mi=ensurePlayerMatchItems(p);
  const d=document.getElementById('match-dice');if(d)d.textContent=controlled?String(mi.diceBoost||0):'—';
  const j=document.getElementById('match-jail');if(j)j.textContent=controlled?String(mi.antiJail||0):'—';
  const m=document.getElementById('match-discount');if(m)m.textContent=controlled?String(mi.mortgageDiscount||0):'—';
  const b=document.getElementById('boost-btn');
  if(b){
    const qMatch=mi.diceBoost||0;
    const qPers=(P.inventory?.diceBoost||0);
    b.textContent=controlled
      ?'⚡ Booster dé ('+qMatch+' temp / '+qPers+' pers)'
      :'⚡ Booster dé';
    b.disabled=(qMatch+qPers)<=0||!G.started||G.rolled||!controlled;
  }
}

function addMatchItem(p,type,qty=1,reason){
  const mi=ensurePlayerMatchItems(p);
  if(!['diceBoost','antiJail','mortgageDiscount'].includes(type))return;
  mi[type]=Math.max(0,(parseInt(mi[type],10)||0)+qty);
  if(reason)glog('🎁 '+p.name+' gagne un objet de partie ('+reason+').','a');
  renderMatchItemsUi();
}

function grantRandomMatchItem(p,reason){
  if(isPlayerUnavailable(p))return;
  const bag=['diceBoost','antiJail','mortgageDiscount'];
  const pick=bag[Math.floor(Math.random()*bag.length)];
  addMatchItem(p,pick,1,reason);
  const txt=pick==='diceBoost'?'⚡ Booster de dé':pick==='antiJail'?'🛡️ Anti-prison':'🏦 Rachat hypothèque réduit';
  if(p.id===G.players[G.cur]?.id)toast('Objet de partie: '+txt,'a');
}

function addInventoryItem(type,qty=1){
  if(!P.inventory)P.inventory={diceBoost:0,antiJail:0,mortgageDiscount:0};
  if(!['diceBoost','antiJail','mortgageDiscount'].includes(type))return;
  P.inventory[type]=Math.max(0,(parseInt(P.inventory[type],10)||0)+qty);
  saveProfileData();
  renderInventoryUi();
}

function grantRandomItem(reason){
  if(!canTrackProfileStatsInCurrentMatch())return false;
  const bag=['diceBoost','antiJail','mortgageDiscount'];
  const pick=bag[Math.floor(Math.random()*bag.length)];
  addInventoryItem(pick,1);
  const txt=pick==='diceBoost'?'⚡ Booster de dé':pick==='antiJail'?'🛡️ Anti-prison':'🏦 Rachat hypothèque réduit';
  toast('Objet gagné: '+txt,'a');
  if(reason)glog('🎁 '+txt+' obtenu ('+reason+').','a');
}

function useDiceBoostItem(){
  if(!G.started||G.rolled)return;
  const p=G.players[G.cur];if(!p)return;
  const mi=ensurePlayerMatchItems(p);
  if((mi.diceBoost||0)>0){
    mi.diceBoost--;
  }else if((P.inventory?.diceBoost||0)>0){
    P.inventory.diceBoost--;saveProfileData();
  }else{toast('Aucun booster disponible','w');return;}
  G.pendingRollBoostFor=p.id;
  renderInventoryUi();renderMatchItemsUi();
  toast('⚡ Booster prêt pour ce lancer','a');
}

const SHOP_ITEMS=[
  {id:'diceBoost',icon:'⚡',name:'Booster de dé',price:150,desc:'Ajoute un booster de dé utilisable ce tour ou plus tard.',buy:p=>{addMatchItem(p,'diceBoost',1,'boutique');return true;}},
  {id:'antiJail',icon:'🛡️',name:'Anti-prison',price:200,desc:'Sortie automatique lors du prochain emprisonnement.',buy:p=>{addMatchItem(p,'antiJail',1,'boutique');return true;}},
  {id:'ghostPass',icon:'👻',name:'Fantôme',price:250,desc:'Ignore le prochain loyer subi sur une case adverse.',buy:p=>{p.ghostPass=(parseInt(p.ghostPass,10)||0)+1;toast('👻 Fantôme prêt pour le prochain loyer.','a');return true;}},
  {id:'quickBuild',icon:'🏗️',name:'Construction rapide',price:300,desc:'Construit gratuitement une maison sur une de tes propriétés.',selection:'quickBuild'},
  {id:'sabotage',icon:'💣',name:'Sabotage',price:350,desc:'Détruit une maison sur une propriété adverse.',selection:'sabotage'},
  {id:'taxCollect',icon:'💰',name:'Collecte d\'impôts',price:100,desc:'Prend 20$ à chaque joueur adverse actif.',buy:p=>buyShopTaxCollect(p)}
];
let SHOP_PENDING_SELECTION=null;

function isPowerupsAddonEnabled(){
  return !!readPackManagerFallbackState().powerups;
}

function refreshPowerupsUi(){
  const btn=document.getElementById('shop-btn');
  if(!btn)return;
  const enabled=isPowerupsAddonEnabled();
  const p=G.players[G.cur];
  const controlled=!!(p&&isProfileControlledPlayer(p));
  const active=enabled&&!!G.started&&controlled&&!p?.bust&&!p?.disconnected;
  const sig=[enabled,G.cur,!!G.started,!!controlled,!!(p&&p.bust),!!(p&&p.disconnected),!!G.pendingBuy].join('|');
  if(G.powerupsUiSignature===sig)return;
  G.powerupsUiSignature=sig;
  btn.style.display=enabled?'inline-flex':'none';
  btn.disabled=!active||!!G.pendingBuy;
  if(!enabled)closeShop();
}

function clearShopSelection(){
  SHOP_PENDING_SELECTION=null;
  const panel=document.getElementById('shop-selection-panel');
  if(panel){
    panel.style.display='none';
    panel.innerHTML='';
  }
}

function refreshShopGameplayUi(){
  renderInventoryUi();
  renderMatchItemsUi();
  refreshHouses();
  refreshOwners();
  renderPlayers();
  updBtns();
  broadcast();
}

function openShop(){
  if(!isPowerupsAddonEnabled()){toast('Active l\'addon Boutique power-ups dans Addons.','w');return;}
  if(!G.started){toast('Lance une partie d\'abord.','w');return;}
  const p=G.players[G.cur];
  if(!p||p.bust||!isProfileControlledPlayer(p)){toast('Boutique disponible uniquement pour le joueur courant.','w');return;}
  if(G.pendingBuy){toast('Termine d\'abord l\'achat de la case en cours.','w');return;}
  clearShopSelection();
  renderShopItems();
  document.getElementById('shop-modal-bg').classList.add('open');
  updateCenterActionsPopup();
}

function closeShop(){
  const modal=document.getElementById('shop-modal-bg');
  if(!modal)return;
  clearShopSelection();
  modal.classList.remove('open');
  updateCenterActionsPopup();
}

function renderShopItems(){
  const player=G.players[G.cur];
  const balance=document.getElementById('shop-balance');
  const list=document.getElementById('shop-items-list');
  if(!player||!balance||!list)return;
  balance.textContent='Budget : '+player.money+'$';
  list.innerHTML=SHOP_ITEMS.map(item=>{
    const canAfford=player.money>=item.price;
    return '<div class="shop-item'+(canAfford?'':' cant-afford')+'">'+
      '<span class="shop-item-icon">'+item.icon+'</span>'+
      '<div class="shop-item-info">'+
        '<div class="shop-item-name">'+escapeHtml(item.name)+'</div>'+
        '<div class="shop-item-desc">'+escapeHtml(item.desc)+'</div>'+
      '</div>'+
      '<span class="shop-item-price">'+item.price+'$</span>'+
      '<button class="btn btn-blue btn-xs shop-item-btn" '+(canAfford?'':'disabled')+' onclick="buyShopItem(\''+item.id+'\')">Acheter</button>'+
    '</div>';
  }).join('');
  renderShopSelectionPanel();
}

function buyShopItem(itemId){
  const item=SHOP_ITEMS.find(entry=>entry.id===itemId);
  const player=G.players[G.cur];
  if(!item||!player)return;
  if(player.money<item.price){toast('Pas assez d\'argent.','d');return;}
  if(item.selection){
    beginShopSelection(item,player);
    return;
  }
  saveUndo();
  const result=item.buy(player);
  if(result===false)return;
  player.money-=item.price;
  recordTxn(player,-item.price,'Shop: '+item.name);
  glog('🛒 '+player.name+' achète '+item.name+'.','a');
  refreshShopGameplayUi();
  renderShopItems();
}

function beginShopSelection(item,player){
  const candidates=getShopSelectionCandidates(item.selection,player);
  if(!candidates.length){
    toast(item.selection==='quickBuild'?'Aucune propriété constructible.':'Aucune maison adverse à saboter.','w');
    clearShopSelection();
    renderShopItems();
    return;
  }
  SHOP_PENDING_SELECTION={itemId:item.id,playerId:player.id,candidates};
  renderShopSelectionPanel();
}

function getShopSelectionCandidates(kind,player){
  if(kind==='quickBuild'){
    return G.board
      .filter(cell=>cell&&cell.owner===player.id&&cell.t==='property'&&!cell.mortgaged&&(cell.houses||0)<5)
      .map(cell=>({
        cellIndex:G.board.indexOf(cell),
        icon:cell.ico,
        title:cell.n,
        meta:(cell.houses||0)+' maison',
      }));
  }
  if(kind==='sabotage'){
    return G.board
      .filter(cell=>cell&&cell.owner&&cell.owner!==player.id&&(cell.houses||0)>0)
      .map(cell=>{
        const owner=G.players.find(entry=>entry.id===cell.owner);
        return {
          cellIndex:G.board.indexOf(cell),
          icon:cell.ico,
          title:cell.n,
          meta:(owner?owner.name:'Adversaire')+' • '+(cell.houses||0)+' maison',
        };
      });
  }
  return [];
}

function renderShopSelectionPanel(){
  const panel=document.getElementById('shop-selection-panel');
  if(!panel)return;
  if(!SHOP_PENDING_SELECTION){
    panel.style.display='none';
    panel.innerHTML='';
    return;
  }
  const item=SHOP_ITEMS.find(entry=>entry.id===SHOP_PENDING_SELECTION.itemId);
  if(!item){
    clearShopSelection();
    return;
  }
  const title=item.selection==='quickBuild'?'Choisis une propriété à améliorer':'Choisis une propriété à saboter';
  const subtitle=item.selection==='quickBuild'?'La maison sera construite gratuitement immédiatement.':'Une maison sera retirée immédiatement.';
  panel.style.display='block';
  panel.innerHTML=''+
    '<div class="shop-selection">'+
      '<div class="shop-selection-head">'+
        '<div><div class="shop-selection-title">'+escapeHtml(title)+'</div><div class="shop-selection-sub">'+escapeHtml(subtitle)+'</div></div>'+
        '<button class="btn btn-secondary btn-xs" type="button" onclick="clearShopSelection()">Annuler</button>'+
      '</div>'+
      '<div class="shop-target-list">'+
        SHOP_PENDING_SELECTION.candidates.map((candidate,idx)=>
          '<button class="shop-target-btn" type="button" onclick="confirmShopSelection('+idx+')">'+
            '<span>'+escapeHtml(candidate.icon||'•')+'</span>'+
            '<span>'+escapeHtml(candidate.title)+'</span>'+
            '<span class="shop-target-meta">'+escapeHtml(candidate.meta||'')+'</span>'+
          '</button>'
        ).join('')+
      '</div>'+
    '</div>';
}

function confirmShopSelection(candidateIndex){
  const pending=SHOP_PENDING_SELECTION;
  if(!pending)return;
  const item=SHOP_ITEMS.find(entry=>entry.id===pending.itemId);
  const player=G.players.find(entry=>entry.id===pending.playerId);
  const candidate=pending.candidates[candidateIndex];
  if(!item||!player||!candidate){clearShopSelection();renderShopItems();return;}
  if(player.money<item.price){toast('Pas assez d\'argent.','d');clearShopSelection();renderShopItems();return;}
  const cell=G.board[candidate.cellIndex];
  if(!cell){toast('Cible indisponible.','w');clearShopSelection();renderShopItems();return;}
  saveUndo();
  if(item.selection==='quickBuild'){
    if(cell.owner!==player.id||cell.t!=='property'||cell.mortgaged||(cell.houses||0)>=5){toast('Cette propriété ne peut plus être améliorée.','w');clearShopSelection();renderShopItems();return;}
    cell.houses=(cell.houses||0)+1;
    toast('🏗️ Maison gratuite sur '+cell.n,'a');
  }else if(item.selection==='sabotage'){
    if(!cell.owner||cell.owner===player.id||(cell.houses||0)<=0){toast('Cette cible n\'est plus valide.','w');clearShopSelection();renderShopItems();return;}
    cell.houses=Math.max(0,(cell.houses||0)-1);
    toast('💣 Sabotage réussi sur '+cell.n,'d');
  }
  player.money-=item.price;
  recordTxn(player,-item.price,'Shop: '+item.name);
  glog('🛒 '+player.name+' achète '+item.name+' sur '+cell.n+'.','a');
  clearShopSelection();
  refreshShopGameplayUi();
  renderShopItems();
}

function buyShopTaxCollect(player){
  const others=G.players.filter(entry=>entry&&!entry.bust&&entry.id!==player.id);
  if(!others.length){toast('Aucun joueur à taxer.','w');return false;}
  let total=0;
  others.forEach(entry=>{
    const take=Math.min(20,entry.money||0);
    entry.money-=take;
    player.money+=take;
    total+=take;
    recordTxn(entry,-take,'Taxe boutique: '+player.name);
    checkBust(entry);
  });
  recordTxn(player,total,'Collecte d\'impôts');
  toast('💰 '+total+'$ collectés.','a');
  return true;
}

function consumeGhostPass(player,cell){
  if(!player||(parseInt(player.ghostPass,10)||0)<=0)return false;
  if(!cell||cell.owner==null||cell.owner===player.id)return false;
  player.ghostPass=Math.max(0,(parseInt(player.ghostPass,10)||0)-1);
  toast('👻 Fantôme actif: aucun loyer payé.','a');
  glog(player.name+' traverse '+cell.n+' en mode fantôme.','a');
  return true;
}

window.addEventListener('neopoly:addons-changed',()=>{
  refreshPowerupsUi();
  if(document.getElementById('shop-modal-bg')?.classList.contains('open'))renderShopItems();
});
window.addEventListener('storage',e=>{
  if(e.key!=='NP_ADDON_PACKS_V2')return;
  refreshPowerupsUi();
  if(document.getElementById('shop-modal-bg')?.classList.contains('open'))renderShopItems();
});

function applyPartyPreset(kind){
  if(kind==='classic'){
    setStartingMoney(1500);setPassGoBonus(200);setJailFine(50);setMaxTurns(0);setGoalMoney(0);
    setDominationTarget(0);setGlobalTimerSec(0);setInflationEnabled(false);setInflationRate(2);
    setTaxVarianceEnabled(false);setBonusTurnEnabled(false);setBonusTurnChance(12);setParkingPotEnabled(false);
    setTeamModePreset('off');
    setStartDraftMode('off');setWorldEventMode('normal');setSurvivalMode('off');setBossBotMode('off');
    setSpecialPowersMode('normal');setRematchMode('standard');setMatchQuestMode('secret');setFogMode('off');
    setTutorialHintsEnabled(true);setEndTurnSummaryEnabled(true);
    setAutoEnd(false);setTimerEnabled(false);
  }else if(kind==='quick'){
    setStartingMoney(1200);setPassGoBonus(150);setJailFine(75);setMaxTurns(40);setGoalMoney(5000);
    setDominationTarget(0);setGlobalTimerSec(1200);setInflationEnabled(true);setInflationRate(2.5);
    setTaxVarianceEnabled(true);setBonusTurnEnabled(true);setBonusTurnChance(18);setParkingPotEnabled(true);
    setTeamModePreset('off');
    setStartDraftMode('light');setWorldEventMode('normal');setSurvivalMode('soft');setBossBotMode('off');
    setSpecialPowersMode('normal');setRematchMode('vote');setMatchQuestMode('open');setFogMode('off');
    setTutorialHintsEnabled(true);setEndTurnSummaryEnabled(true);
    setAutoEnd(true);setTimerEnabled(true);setTimerDuration(30);
  }else if(kind==='chaos'){
    setStartingMoney(2500);setPassGoBonus(350);setJailFine(0);setMaxTurns(25);setGoalMoney(12000);
    setDominationTarget(2);setGlobalTimerSec(900);setInflationEnabled(true);setInflationRate(4);
    setTaxVarianceEnabled(true);setBonusTurnEnabled(true);setBonusTurnChance(30);setParkingPotEnabled(true);
    setTeamModePreset('off');
    setStartDraftMode('strategic');setWorldEventMode('wild');setSurvivalMode('hard');setBossBotMode('standard');
    setSpecialPowersMode('chaos');setRematchMode('instant');setMatchQuestMode('open');setFogMode('soft');
    setTutorialHintsEnabled(true);setEndTurnSummaryEnabled(true);
    setAutoEnd(false);setTimerEnabled(false);
  }
  refreshAdvancedStats();
  toast('Preset appliqué: '+kind,'a');
}

function saveCustomPreset(slot){
  const key=String(slot||'A').toUpperCase();
  const all=JSON.parse(localStorage.getItem(PARTY_PRESET_KEY)||'{}');
  all[key]={
    startingMoney:G.startingMoney,
    passGoBonus:G.passGoBonus,
    jailFine:G.jailFine,
    maxTurns:G.maxTurns,
    goalMoney:G.goalMoney,
    dominationTarget:G.dominationTarget,
    globalTimerSec:G.globalTimerSec,
    inflationEnabled:G.inflationEnabled,
    inflationRate:G.inflationRate,
    taxVarianceEnabled:G.taxVarianceEnabled,
    bonusTurnEnabled:G.bonusTurnEnabled,
    bonusTurnChance:G.bonusTurnChance,
    parkingPotEnabled:G.parkingPotEnabled,
    teamModePreset:G.teamModePreset,
    startDraftMode:G.startDraftMode,
    worldEventMode:G.worldEventMode,
    survivalMode:G.survivalMode,
    bossBotMode:G.bossBotMode,
    specialPowersMode:G.specialPowersMode,
    rematchMode:G.rematchMode,
    matchQuestMode:G.matchQuestMode,
    fogMode:G.fogMode,
    tutorialHintsEnabled:G.tutorialHintsEnabled,
    endTurnSummaryEnabled:G.endTurnSummaryEnabled,
  };
  localStorage.setItem(PARTY_PRESET_KEY,JSON.stringify(all));
  toast('Preset '+key+' sauvegardé','a');
}

function loadCustomPreset(slot){
  const key=String(slot||'A').toUpperCase();
  const all=JSON.parse(localStorage.getItem(PARTY_PRESET_KEY)||'{}');
  const p=all[key];
  if(!p){toast('Preset '+key+' vide','w');return;}
  setStartingMoney(p.startingMoney);
  setPassGoBonus(p.passGoBonus);
  setJailFine(p.jailFine);
  setMaxTurns(p.maxTurns);
  setGoalMoney(p.goalMoney);
  setDominationTarget(p.dominationTarget);
  setGlobalTimerSec(p.globalTimerSec);
  setInflationEnabled(p.inflationEnabled);
  setInflationRate(p.inflationRate);
  setTaxVarianceEnabled(p.taxVarianceEnabled);
  setBonusTurnEnabled(p.bonusTurnEnabled);
  setBonusTurnChance(p.bonusTurnChance);
  setParkingPotEnabled(p.parkingPotEnabled);
  setTeamModePreset(p.teamModePreset??'off');
  setStartDraftMode(p.startDraftMode??'off');
  setWorldEventMode(p.worldEventMode??'normal');
  setSurvivalMode(p.survivalMode??'off');
  setBossBotMode(p.bossBotMode??'off');
  setSpecialPowersMode(p.specialPowersMode??'normal');
  setRematchMode(p.rematchMode??'standard');
  setMatchQuestMode(p.matchQuestMode??'secret');
  setFogMode(p.fogMode??'off');
  setTutorialHintsEnabled(p.tutorialHintsEnabled??true);
  setEndTurnSummaryEnabled(p.endTurnSummaryEnabled??true);
  refreshAdvancedStats();
  toast('Preset '+key+' chargé','a');
}

function buildInviteLink(){
  if(!G.room)return '';
  const base=location.origin&&location.origin!=='null'
    ?(location.origin+location.pathname)
    :location.href.split('?')[0];
  return base+'?room='+encodeURIComponent(G.room);
}

function refreshInviteLink(){
  const card=document.getElementById('party-invite-card');
  const ctx=window.__partyWheelContext||G.mode||'local';
  const isLocal=ctx==='local';
  if(card)card.style.display=isLocal?'none':'block';
  const inp=document.getElementById('invite-link');
  if(!inp)return;
  if(isLocal){inp.value='';return;}
  inp.value=buildInviteLink()||'';
  if(!inp.value)inp.placeholder='Crée une salle pour générer le lien';
}

function copyInviteLink(){
  refreshInviteLink();
  const txt=document.getElementById('invite-link')?.value||'';
  if(!txt){toast('Aucune salle active pour inviter','w');return;}
  navigator.clipboard?.writeText(txt).then(()=>toast('🔗 Lien copié','a')).catch(()=>toast('Copie impossible','d'));
}

function snapshotGame(){
  return {
    version:1,
    at:Date.now(),
    game:{
      players:clone(G.players),board:clone(G.board),cur:G.cur,started:G.started,rolled:G.rolled,
      doublesCount:G.doublesCount,jailTurns:clone(G.jailTurns),txns:clone(G.txns),
      roulette:clone(G.roulette),
      room:G.room,mode:G.mode,myId:G.myId,myReady:G.myReady,
      startingMoney:G.startingMoney,passGoBonus:G.passGoBonus,jailFine:G.jailFine,
      maxTurns:G.maxTurns,goalMoney:G.goalMoney,turnCount:G.turnCount,
      dominationTarget:G.dominationTarget,globalTimerSec:G.globalTimerSec,
      inflationEnabled:G.inflationEnabled,inflationRate:G.inflationRate,
      taxVarianceEnabled:G.taxVarianceEnabled,bonusTurnEnabled:G.bonusTurnEnabled,
      bonusTurnChance:G.bonusTurnChance,parkingPotEnabled:G.parkingPotEnabled,parkingPot:G.parkingPot,
      teamModePreset:G.teamModePreset,teamMode:G.teamMode,teamModeFormat:G.teamModeFormat,
      startDraftMode:G.startDraftMode,worldEventMode:G.worldEventMode,survivalMode:G.survivalMode,bossBotMode:G.bossBotMode,
      specialPowersMode:G.specialPowersMode,rematchMode:G.rematchMode,matchQuestMode:G.matchQuestMode,fogMode:G.fogMode,
      tutorialHintsEnabled:G.tutorialHintsEnabled,endTurnSummaryEnabled:G.endTurnSummaryEnabled,
      timerEnabled:G.timerEnabled,timerDuration:G.timerDuration,autoEnd:G.autoEnd,
      centerActions:G.centerActions,gameZoom:G.gameZoom,centerDiceScale:G.centerDiceScale,pawnScale:G.pawnScale,pawnGlow:G.pawnGlow,streamerMode:G.streamerMode,musicSource:G.musicSource,musicThemeVariant:G.musicThemeVariant,daTheme:G.daTheme,musicBoostEnabled:G.musicBoostEnabled,musicBoostPercent:G.musicBoostPercent,toastMs:G.toastMs,
    },
    profile:{
      stats:clone(P.stats),
      inventory:clone(P.inventory||{}),
      rouletteCoins:parseInt(P.rouletteCoins,10)||0,
      rouletteSpinCount:parseInt(P.rouletteSpinCount,10)||0,
      lastRouletteSettlementId:parseInt(P.lastRouletteSettlementId,10)||0,
      lastRouletteFreeSpinDate:String(P.lastRouletteFreeSpinDate||''),
    },
  };
}

function exportPartySnapshot(){
  const snap=snapshotGame();
  const json=JSON.stringify(snap,null,2);
  const ta=document.getElementById('party-save-json');
  if(ta)ta.value=json;
  try{localStorage.setItem(PARTY_SNAPSHOT_KEY,json);}catch(e){}
  try{
    const blob=new Blob([json],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='neopoly-party-snapshot-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),500);
  }catch(e){}
  toast('Snapshot exporté','a');
}

function applyImportedSnapshot(snap){
  if(!snap||!snap.game)throw new Error('invalid_snapshot');
  const g=snap.game;
  if(Array.isArray(g.players))G.players=g.players;
  enforceUniquePlayerColors();
  if(Array.isArray(g.board)&&g.board.length===40)G.board=g.board;
  G.cur=Math.max(0,Math.min((G.players.length||1)-1,parseInt(g.cur,10)||0));
  G.started=!!g.started;G.rolled=!!g.rolled;
  G.doublesCount=parseInt(g.doublesCount,10)||0;
  G.jailTurns=g.jailTurns||{};
  G.txns=Array.isArray(g.txns)?g.txns:[];
  G.roulette=Object.assign(getDefaultRouletteState(),g.roulette||{});
  ensureRouletteState();
  G.players.forEach(ensureRoulettePlayerData);
  G.room=g.room||'';G.mode=g.mode||G.mode;G.myId=g.myId||G.myId;G.myReady=!!g.myReady;
  setStartingMoney(g.startingMoney??G.startingMoney);
  setPassGoBonus(g.passGoBonus??G.passGoBonus);
  setJailFine(g.jailFine??G.jailFine);
  setMaxTurns(g.maxTurns??G.maxTurns);
  setGoalMoney(g.goalMoney??G.goalMoney);
  setDominationTarget(g.dominationTarget??G.dominationTarget);
  setGlobalTimerSec(g.globalTimerSec??G.globalTimerSec);
  setInflationEnabled(g.inflationEnabled??G.inflationEnabled);
  setInflationRate(g.inflationRate??G.inflationRate);
  setTaxVarianceEnabled(g.taxVarianceEnabled??G.taxVarianceEnabled);
  setBonusTurnEnabled(g.bonusTurnEnabled??G.bonusTurnEnabled);
  setBonusTurnChance(g.bonusTurnChance??G.bonusTurnChance);
  setParkingPotEnabled(g.parkingPotEnabled??G.parkingPotEnabled);
  setTeamModePreset(g.teamModePreset??g.teamModeFormat??((g.teamMode&&Array.isArray(g.players)&&g.players.length===6)?'2v2v2':((g.teamMode&&Array.isArray(g.players)&&g.players.length===4)?'2v2':'off')));
  setStartDraftMode(g.startDraftMode??G.startDraftMode);
  setWorldEventMode(g.worldEventMode??G.worldEventMode);
  setSurvivalMode(g.survivalMode??G.survivalMode);
  setBossBotMode(g.bossBotMode??G.bossBotMode);
  setSpecialPowersMode(g.specialPowersMode??G.specialPowersMode);
  setRematchMode(g.rematchMode??G.rematchMode);
  setMatchQuestMode(g.matchQuestMode??G.matchQuestMode);
  setFogMode(g.fogMode??G.fogMode);
  setTutorialHintsEnabled(g.tutorialHintsEnabled??G.tutorialHintsEnabled);
  setEndTurnSummaryEnabled(g.endTurnSummaryEnabled??G.endTurnSummaryEnabled);
  G.parkingPot=Math.max(0,parseInt(g.parkingPot,10)||0);
  G.turnCount=Math.max(1,parseInt(g.turnCount,10)||1);
  setTimerDuration(g.timerDuration??G.timerDuration);
  setTimerEnabled(g.timerEnabled??G.timerEnabled);
  setAutoEnd(g.autoEnd??G.autoEnd);
  setCenterActionsEnabled(g.centerActions??G.centerActions);
  setCenterActionsScale(g.centerActionsScale??G.centerActionsScale);
  setGameZoom(g.gameZoom??G.gameZoom);
  setCenterDiceScale(g.centerDiceScale??G.centerDiceScale);
  setPawnScale(g.pawnScale??G.pawnScale);
  setPawnGlow(g.pawnGlow??G.pawnGlow);
  setStreamerMode(g.streamerMode??G.streamerMode);
  setMusicSource(g.musicSource??G.musicSource);
  setMusicThemeVariant(g.musicThemeVariant??G.musicThemeVariant);
  setDaTheme(g.daTheme??G.daTheme);
  setMusicBoostEnabled(g.musicBoostEnabled??G.musicBoostEnabled);
  setMusicBoostPercent(g.musicBoostPercent??G.musicBoostPercent);
  setToastDuration(Math.round((g.toastMs??G.toastMs)/1000));
  if(snap.profile&&snap.profile.stats)P.stats=Object.assign({},P.stats,snap.profile.stats);
  if(snap.profile&&snap.profile.inventory){
    P.inventory=Object.assign({},P.inventory||{},snap.profile.inventory);
  }
  if(snap.profile){
    const parsedRouletteCoins=parseInt(snap.profile.rouletteCoins,10);
    if(Number.isFinite(parsedRouletteCoins))P.rouletteCoins=Math.max(0,parsedRouletteCoins);
    P.rouletteSpinCount=Math.max(0,parseInt(snap.profile.rouletteSpinCount,10)||P.rouletteSpinCount||0);
    P.lastRouletteSettlementId=Math.max(0,parseInt(snap.profile.lastRouletteSettlementId,10)||P.lastRouletteSettlementId||0);
    P.lastRouletteFreeSpinDate=String(snap.profile.lastRouletteFreeSpinDate||P.lastRouletteFreeSpinDate||'');
  }
  if(G.started)setupTeamMode();
  else clearTeamMode();
  saveProfileData();renderLobbyProfileTab();
  buildBoard();renderPlayers();updBtns();renderStats();renderTxns();refreshInviteLink();refreshAdvancedStats();refreshPartyRuleUi();
}

function importPartySnapshot(){
  const ta=document.getElementById('party-save-json');
  let raw=(ta?.value||'').trim();
  if(!raw){
    raw=localStorage.getItem(PARTY_SNAPSHOT_KEY)||'';
  }
  if(!raw){toast('Colle un JSON de snapshot','w');return;}
  try{
    const snap=JSON.parse(raw);
    applyImportedSnapshot(snap);
    toast('Snapshot importé','a');
  }catch(e){
    toast('Snapshot invalide','d');
  }
}

function refreshAdvancedStats(){
  const grid=document.getElementById('advanced-stats-grid');
  if(!grid)return;
  const games=Math.max(1,P.stats.gamesPlayed||0);
  const winRate=Math.round(((P.stats.gamesWon||0)/games)*100);
  const alive=G.players.filter(p=>!p.bust&&!p.disconnected).length;
  const avgTurns=Math.round((P.stats.totalTurns||0)/games);
  const netNow=(G.players||[]).reduce((s,p)=>s+(p.money||0),0);
  const turnsRule=G.maxTurns>0?String(G.maxTurns):'∞';
  const goalRule=G.goalMoney>0?(G.goalMoney+'$'):'off';
  const domRule=G.dominationTarget>0?String(G.dominationTarget):'off';
  const gtRule=G.globalTimerSec>0?(Math.floor(G.globalTimerSec/60)+'m'):'off';
  grid.innerHTML=[
    {k:'Winrate',v:winRate+'%'},
    {k:'Tours/partie',v:String(avgTurns)},
    {k:'Joueurs actifs',v:String(alive||0)},
    {k:'Cash total courant',v:netNow+'$'},
    {k:'Achats profil',v:String(P.stats.propertiesBought||0)},
    {k:'Parties jouées',v:String(P.stats.gamesPlayed||0)},
    {k:'Règle max tours',v:turnsRule},
    {k:'Objectif fortune',v:goalRule},
    {k:'Domination',v:domRule},
    {k:'Timer global',v:gtRule},
  ].map(x=>`<div style="background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:7px 8px"><div style="font-size:.62rem;color:var(--muted)">${x.k}</div><div style="font-size:.9rem;font-weight:800;color:var(--accent)">${x.v}</div></div>`).join('');
}

function getPartyBotContextList(){
  const ctx=window.__partyWheelContext||G.mode||'local';
  if(ctx==='online')return G.pendingPartyBots;
  return G.players.filter(p=>p&&p.bot);
}

const BOT_NAME_PREFIXES=['Neo','Cyber','Turbo','Pixel','Shadow','Nova','Alpha','Omega','Rocket','Luna','Aero','Drift'];
const BOT_NAME_SUFFIXES=['Fox','Wolf','Panda','Tiger','Byte','Pulse','Spark','Vortex','Comet','Blaze','Echo','Dash'];

function buildUsedBotNames(){
  const used=new Set();
  [...(G.players||[]),...(G.pendingPartyBots||[])].forEach(p=>{
    if(p&&p.bot&&p.name)used.add(String(p.name).toLowerCase());
  });
  return used;
}

function pickRandomBotIdentity(customName){
  const emojiPool=EMOJIS.length?EMOJIS:['🤖'];
  const emoji=emojiPool[Math.floor(Math.random()*emojiPool.length)]||'🤖';
  const forcedName=String(customName||'').trim();
  if(forcedName)return {name:forcedName,emoji};
  const used=buildUsedBotNames();
  for(let i=0;i<48;i++){
    const pre=BOT_NAME_PREFIXES[Math.floor(Math.random()*BOT_NAME_PREFIXES.length)];
    const suf=BOT_NAME_SUFFIXES[Math.floor(Math.random()*BOT_NAME_SUFFIXES.length)];
    const name=pre+suf;
    if(!used.has(name.toLowerCase()))return {name,emoji};
  }
  return {name:'Bot '+((G.players?.length||0)+(G.pendingPartyBots?.length||0)+1),emoji};
}

function refreshPartyBotUi(){
  const card=document.getElementById('party-bots-card');
  const list=document.getElementById('pw-bots-list');
  const info=document.getElementById('pw-bot-cap-info');
  if(!card||!list)return;
  const ctx=window.__partyWheelContext||G.mode||'local';
  const allowed=(ctx==='local'||ctx==='online');
  card.style.display=allowed?'block':'none';
  if(!allowed)return;
  const bots=getPartyBotContextList();
  const totalPlayers=ctx==='online'?(1+bots.length):Math.max(1,(G.players||[]).length);
  if(info){
    info.textContent='Capacité salle: '+totalPlayers+'/'+ONLINE_ROOM_MAX_PLAYERS+' joueur(s)';
    info.style.color=totalPlayers>=ONLINE_ROOM_MAX_PLAYERS?'#f59e0b':'var(--muted)';
  }
  if(!bots.length){
    list.innerHTML='<div style="font-size:.68rem;color:var(--muted)">Aucun bot ajouté.</div>';
    return;
  }
  list.innerHTML='';
  bots.forEach((b,i)=>{
    const persona=ensureBotPersona(b);
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:var(--s2);font-size:.72rem';
    row.innerHTML=`<span style="font-size:.95rem">${b.emoji||'🤖'}</span><span style="flex:1;color:${b.color||'#9ca3af'};font-weight:700">${b.name||('Bot '+(i+1))}</span><span style="font-size:.65rem;color:var(--muted)">${b.botLevel||'easy'} • ${persona.icon} ${persona.label}</span><button class="btn btn-xs btn-danger" type="button" onclick="removeBotFromPartyWheel(${i})">✕</button>`;
    list.appendChild(row);
  });
}

function addBotFromPartyWheel(){
  if(G.started){toast('Ajout de bots indisponible pendant la partie.','w');return;}
  const ctx=window.__partyWheelContext||G.mode||'local';
  if(ctx!=='local'&&ctx!=='online'){toast('Bots dispo uniquement en création locale/online.','w');return;}
  const currentCount=ctx==='online'?(1+(G.pendingPartyBots?.length||0)):(G.players?.length||0);
  if(currentCount>=ONLINE_ROOM_MAX_PLAYERS){toast('Limite de '+ONLINE_ROOM_MAX_PLAYERS+' joueurs atteinte.','w');return;}
  const lvl=document.getElementById('pw-bot-level')?.value||'easy';
  const rawName=(document.getElementById('pw-bot-name')?.value||'').trim();
  const botIdentity=pickRandomBotIdentity(rawName);
  const idx=getPartyBotContextList().length+1;
  const name=botIdentity.name||('Bot '+idx);
  const id='bot-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const color=pickUniquePlayerColor(COLORS[(G.players.length+idx)%COLORS.length],id);
  const botObj={id,name,emoji:botIdentity.emoji,color,img:null,bot:true,botLevel:lvl,botPersona:pickRandomBotPersona(),matchItems:{diceBoost:0,antiJail:0,mortgageDiscount:0},money:G.startingMoney,pos:0,jailed:false,bust:false,jailCards:0,ready:true};
  if(ctx==='online'){
    G.pendingPartyBots.push(botObj);
  }else{
    G.players.push(botObj);
    renderLocalPlayerList();
    renderPlayers();
  }
  const nInp=document.getElementById('pw-bot-name');
  if(nInp)nInp.value='';
  refreshPartyBotUi();
  refreshAdvancedStats();
  toast('Bot ajouté: '+name,'a');
}

function removeBotFromPartyWheel(i){
  const ctx=window.__partyWheelContext||G.mode||'local';
  if(ctx==='online'){
    if(i>=0&&i<G.pendingPartyBots.length)G.pendingPartyBots.splice(i,1);
  }else{
    const bots=G.players.filter(p=>p&&p.bot);
    const target=bots[i];
    if(target){
      G.players=G.players.filter(p=>p!==target);
      renderLocalPlayerList();
      renderPlayers();
    }
  }
  refreshPartyBotUi();
  refreshAdvancedStats();
}

function openPartyWheel(context){
  window.__partyWheelContext=context||G.mode||'local';
  refreshPartyRuleUi();
  refreshInviteLink();
  refreshPartyBotUi();
  refreshAdvancedStats();
  applyPartyWheelLockState();
  openModal('modal-party-wheel');
}

function applyInviteFromUrl(){
  try{
    const q=new URLSearchParams(location.search||'');
    const room=q.get('room');
    if(room){
      const inp=document.getElementById('jn-room');
      if(inp&&!inp.value)inp.value=room;
    }
  }catch(e){}
}

// ═══════════════════════════════════════

