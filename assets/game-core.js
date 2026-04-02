// ═══════════════════════════════════════
//  CONFIGURATION (Google OAuth)
// ═══════════════════════════════════════
const GOOGLE_CLIENT_ID='';
const GOOGLE_CLIENT_ID_KEY='NP_GOOGLE_CLIENT_ID';

function getGoogleClientId(){
  const runtime=(window.NEOPOLY_GOOGLE_CLIENT_ID||'').trim();
  const stored=(localStorage.getItem(GOOGLE_CLIENT_ID_KEY)||'').trim();
  const inline=(GOOGLE_CLIENT_ID||'').trim();
  return runtime||stored||inline;
}

function getGoogleApiBase(){
  const configured=(window.NEOPOLY_API_BASE||'').trim();
  if(configured)return configured.replace(/\/$/,'');
  const p=String(window.location.port||'');
  if((p==='5500'||p==='5173')&&window.location.protocol==='http:'){
    return ('http://'+window.location.hostname+':3000').replace(/\/$/,'');
  }
  return window.location.origin&&window.location.origin!=='null'?window.location.origin:'';
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
  if(googleServerMode==='popup_or_idtoken_only'){
    googlePopupRejectedCount=Math.max(googlePopupRejectedCount,1);
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
    pushGoogleDebug('Recommended flow: alternative (server mode)');
    updateGoogleDebugPanel();
    beginGoogleLoginAlt();
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
  const preferAlt=true;
  popup.classList.toggle('btn-primary',!preferAlt);
  popup.classList.toggle('btn-secondary',preferAlt);
  alt.classList.toggle('btn-primary',preferAlt);
  alt.classList.toggle('btn-secondary',!preferAlt);
  if(googlePopupRejectedCount>0){
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
    setTimeout(updateBoardAdaptiveScale,0);
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

// Sélecteur d'emoji pour pion (tous modes)
document.addEventListener('DOMContentLoaded',()=>{
  enforceCanonicalLocalOrigin();
  try{googleZoneAlwaysRedirect=localStorage.getItem('NP_ZONE_ULTRASAFE_REDIRECT')==='1';}catch(_){googleZoneAlwaysRedirect=false;}
  updateConnectionZoneUi();
  initDefaultWsUrlInputs();
  loadJoinBrowserPrefs();
  setJoinRoomFilter(JOIN_ROOM_FILTER);
  setJoinRoomSort(JOIN_ROOM_SORT);
  initMobileSidebarToggle();
  initMobileRestrictions();
  initMobileSidebarSwipe();
  loadClientUiPrefs();
  setClientCellScale(CLIENT_UI.cellScale);
  ensureEmojiUnlocks(false);
  renderPartyEmojiPickers();
  setTimeout(updateBoardAdaptiveScale,0);
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
  document.querySelectorAll('.lobby-tab').forEach(btn=>btn.addEventListener('click',()=>switchLobbyTab(btn.dataset.ltab)));
});

// ═══════════════════════════════════════
//  CARDS
// ═══════════════════════════════════════
const CHANCE_CARDS=[
  {txt:'Avancez jusqu\'au Départ. Recevez le bonus Départ.',fn:p=>{p.pos=0;p.money+=G.passGoBonus;recordTxn(p,G.passGoBonus,'Chance: Départ');}},
  {txt:'Allez en Prison.',fn:p=>{p.pos=10;p.jailed=true;}},
  {txt:'Payez 150$ d\'amende.',fn:p=>{p.money-=150;recordTxn(p,-150,'Chance: Amende');checkBust(p);}},
  {txt:'Recevez 150 $ .',fn:p=>{p.money+=150;recordTxn(p,150,'Chance: Gain');}},
  {txt:'Reculez de 3 cases.',fn:p=>{p.pos=(p.pos-3+40)%40;}},
  {txt:'Recevez un dividende de 50 $ .',fn:p=>{p.money+=50;recordTxn(p,50,'Chance: Dividende');}},
  {txt:'Payez 100$ de réparations.',fn:p=>{p.money-=100;recordTxn(p,-100,'Chance: Réparations');checkBust(p);}},
  {txt:'Avancez à la prochaine gare.',fn:p=>{let n=p.pos;do{n=(n+1)%40;}while(G.board[n].t!=='railroad');p.pos=n;}},
];
const COMMUNITY_CARDS=[
  {txt:'Erreur bancaire en votre faveur. Recevez 200 $ .',fn:p=>{p.money+=200;recordTxn(p,200,'Caisse: Banque');}},
  {txt:'Payez les frais médicaux: 100 $ .',fn:p=>{p.money-=100;recordTxn(p,-100,'Caisse: Médecin');checkBust(p);}},
  {txt:'Recevez votre héritage: 100 $ .',fn:p=>{p.money+=100;recordTxn(p,100,'Caisse: Héritage');}},
  {txt:'Amende pour excès de vitesse: 50 $ .',fn:p=>{p.money-=50;recordTxn(p,-50,'Caisse: Amende');checkBust(p);}},
  {txt:'Remboursement d\'impôts: 20 $ .',fn:p=>{p.money+=20;recordTxn(p,20,'Caisse: Impôts');}},
  {txt:'Sortie de prison gratuite.',fn:p=>{p.jailCards=(p.jailCards||0)+1;recordTxn(p,0,'Carte: Sortie de prison');}},
  {txt:'C\'est votre anniversaire ! Recevez 10 $  de chaque joueur.',fn:p=>{
    G.players.filter(o=>!o.bust&&o.id!==p.id).forEach(o=>{o.money-=10;p.money+=10;recordTxn(o,-10,'Anniversaire');});
    recordTxn(p,10*(G.players.filter(o=>!o.bust&&o.id!==p.id).length),'Anniversaire');
  }},
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
  {i:16, n:'Avenue Mozart',     t:'property', p:180, r:14,  c:'#f43f5e',ico:'🏠'},
  {i:17, n:'Caisse Commune',   t:'community', p:0,   r:0,   c:'#facc15',ico:'💳'},
  {i:18, n:'Boulevard Saint-Michel', t:'property', p:180, r:14,  c:'#f43f5e',ico:'🏠'},
  {i:19, n:'Place Pigalle',    t:'property', p:200, r:16,  c:'#f43f5e',ico:'🏠'},
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
  {key:'secret_shadow',emoji:'🕶️',label:'Ombre',desc:'Style clandestin reserve aux obstines.',secret:true,cond:'Condition secrète',unlock:p=>((parseInt(p?.stats?.gamesLost,10)||0)>=13&&(parseInt(p?.stats?.gamesWon,10)||0)>=13)}
];
const COLORS=['#22c55e','#3b82f6','#f97316','#ef4444','#a855f7','#facc15'];

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
};
const NET_TRADE={
  outgoing:{},
  incoming:null,
  incomingTimer:null,
  timeoutMs:30000,
};

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
  googleEmail:null,googleName:null,googleConnected:false,googleSub:null,googleVerifiedAt:0,
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
  mutedUsers:[],
  blockedUsers:[],
  friends:[], // [{uid,name,emoji,avatarImg,color,addedAt}]
  chatLog:[]  // [{name,color,text,ts,mine,uid,admin,emoji,avatarImg}]
};

const ADMIN_EMAIL_FALLBACK='matthprizee55@gmail.com';
function isKnownAdminEmail(email){
  return String(email||'').trim().toLowerCase()===ADMIN_EMAIL_FALLBACK;
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

function loadProfile(opts){
  const options=opts&&typeof opts==='object'?opts:{};
  let changed=false;
  try{const d=JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}');Object.keys(P).forEach(k=>{if(d[k]!==undefined)P[k]=d[k];});}catch(e){}
  if(!P.inventory||typeof P.inventory!=='object')P.inventory={};
  P.inventory.diceBoost=Math.max(0,parseInt(P.inventory.diceBoost,10)||0);
  P.inventory.antiJail=Math.max(0,parseInt(P.inventory.antiJail,10)||0);
  P.inventory.mortgageDiscount=Math.max(0,parseInt(P.inventory.mortgageDiscount,10)||0);
  if(!Array.isArray(P.titles))P.titles=[];
  if(!P.titleMeta||typeof P.titleMeta!=='object')P.titleMeta={};
  if(!P.secretUnlocks||typeof P.secretUnlocks!=='object')P.secretUnlocks={};
  if(!P.emojiUnlocks||typeof P.emojiUnlocks!=='object')P.emojiUnlocks={};
  if(typeof P.stats.gamesLost!=='number')P.stats.gamesLost=parseInt(P.stats.gamesLost,10)||0;
  if(typeof P.elo!=='number'||isNaN(P.elo))P.elo=0;
  if(!('selectedTitle' in P))P.selectedTitle=null;
  if(typeof P.isAdmin!=='boolean')P.isAdmin=false;
  if(!P.moderation||typeof P.moderation!=='object')P.moderation=getDefaultModerationState();
  P.moderation.muted=!!P.moderation.muted;
  P.moderation.banned=!!P.moderation.banned;
  P.moderation.reason=String(P.moderation.reason||'');
  P.moderation.updatedAt=parseInt(P.moderation.updatedAt,10)||0;
  if(!Array.isArray(P.friends))P.friends=[];
  if(!Array.isArray(P.mutedUsers))P.mutedUsers=[];
  if(!Array.isArray(P.blockedUsers))P.blockedUsers=[];
  P.mutedUsers=P.mutedUsers.map(v=>String(v||'').trim()).filter(Boolean);
  P.blockedUsers=P.blockedUsers.map(v=>String(v||'').trim()).filter(Boolean);
  if(!Array.isArray(P.chatLog))P.chatLog=[];
  if(isKnownAdminEmail(P.googleEmail))P.isAdmin=true;
  if(!P.uid){P.uid='np_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);changed=true;}
  if(syncUidWithGoogleIdentity(true))changed=true;
  if(changed&&!options.skipPersist)saveProfileData();
  checkWinTitles();
  checkSecretTitles(false);
  ensureEmojiUnlocks(false);
  if(!isEmojiUnlocked(P.emoji))P.emoji=getUnlockedEmojis()[0];
  applySecretUnlocks();
  renderPartyEmojiPickers();
  renderLobbyProfileTab();renderFriendsList();renderSocialChat();
}
function saveProfileData(){
  localStorage.setItem(PROFILE_KEY,JSON.stringify(P));
  if(PROFILE_SYNC_BUS){
    try{PROFILE_SYNC_BUS.postMessage({type:'profile_updated',at:Date.now()});}catch(_){ }
  }
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

function setDebugMenuVisibility(allowed,msg){
  const card=document.getElementById('debug-tools-card');
  const info=document.getElementById('debug-access-msg');
  if(card)card.style.display=allowed?'block':'none';
  if(info&&msg)info.textContent=msg;
}

async function initDebugAccessControl(){
  const curIp=await resolvePublicIp();
  if(!curIp){
    setDebugMenuVisibility(false,'Debug verrouille: IP non resolue.');
    return;
  }
  let ownerIp=localStorage.getItem(DEBUG_OWNER_IP_KEY)||'';
  if(!ownerIp){
    localStorage.setItem(DEBUG_OWNER_IP_KEY,curIp);
    ownerIp=curIp;
    toast('🛡️ Debug lie a IP: '+ownerIp,'i');
  }
  const allowed=curIp===ownerIp;
  setDebugMenuVisibility(allowed,allowed?('Acces autorise: '+curIp):('IP refusee ('+curIp+'). IP autorisee: '+ownerIp));
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

function adminRebindIpPrompt(){
  const code=prompt('Code admin pour reassignment IP:');
  if(!code)return;
  if(code.trim()!==atob(_S.c)){toast('Code admin invalide.','d');return;}
  rebindDebugOwnerIp('code');
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

const MUSIC_THEMES={
  lobby:[
    {f:261.63,d:.35,v:.12,t:'sine'},{f:329.63,d:.35,v:.12,t:'sine'},{f:392.0,d:.45,v:.12,t:'triangle'},
    {f:329.63,d:.3,v:.1,t:'sine'},{f:293.66,d:.4,v:.1,t:'triangle'},{f:0,d:.25,v:0,t:'sine'},
  ],
  game:[
    {f:220.0,d:.22,v:.14,t:'square'},{f:277.18,d:.2,v:.13,t:'square'},{f:329.63,d:.22,v:.13,t:'square'},
    {f:392.0,d:.2,v:.12,t:'triangle'},{f:329.63,d:.18,v:.12,t:'square'},{f:277.18,d:.2,v:.12,t:'square'},
    {f:246.94,d:.2,v:.11,t:'triangle'},{f:0,d:.16,v:0,t:'sine'},
  ],
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
    // Auto-fix old values like wss://<same-host>:3000 when deployed behind HTTPS proxies (Render).
    try{
      const u=new URL(current);
      const sameHost=u.hostname===window.location.hostname;
      const forced3000=u.port==='3000';
      if(window.location.protocol==='https:'&&sameHost&&forced3000){
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
      try{ socket.send(JSON.stringify(payload)); }
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
    G.ws.send(JSON.stringify(enriched));
    return true;
  }catch(e){
    wsLog('Erreur envoi: '+e);
    return false;
  }
}

function announceOnlinePresence(roomPassword=''){
  const me=G.players.find(p=>p.id===G.myId);
  if(!me) return;
  sendWsMessage({type:'ready',room:G.room,sender:G.myId,playerId:G.myId,name:me.name,emoji:me.emoji,color:me.color,ready:!!me.ready,roomPassword:String(roomPassword||'').trim()});
}

function toggleMobileSidebar(forceOpen){
  if(window.DEVICE!=='mobile')return;
  const app=document.getElementById('app-wrap');
  const sidebar=app?app.querySelector('.sidebar'):null;
  if(!app)return;
  if(forceOpen===true){
    app.classList.remove('mobile-sidebar-collapsed');
    syncMobileBodyScrollLock(app,sidebar);
    setTimeout(updateBoardAdaptiveScale,180);
    return;
  }
  app.classList.toggle('mobile-sidebar-collapsed');
  syncMobileBodyScrollLock(app,sidebar);
  setTimeout(updateBoardAdaptiveScale,180);
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

function switchLobbyTab(name){
  document.querySelectorAll('.lobby-tab').forEach(t=>t.classList.toggle('active',t.dataset.ltab===name));
  document.querySelectorAll('.lobby-tab-pane').forEach(p=>p.classList.toggle('active',p.id===name));
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
      pushGoogleDebug('Alternative timeout: no redirect available (server mode popup_or_idtoken_only)');
      updateGoogleDebugPanel();
      updateGoogleConfigUi();
      toast('Google bloque One Tap/FedCM et le redirect est indisponible (secret serveur manquant). Configure GOOGLE_CLIENT_SECRET ou utilise Mode local.','w');
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
    applyGoogleIdentity(me.email||'',me.name||'',me.picture||'',me.sub||'',true);
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
    applyGoogleIdentity(me.email||'',me.name||'',me.picture||'',me.sub||'',true);
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
    applyGoogleIdentity(me.email||'',me.name||'',me.picture||'',me.sub||'',true);
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

function applyGoogleIdentity(email,name,avatarUrl,googleSub,isVerified){
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

  P.googleConnected=true;
  P.googleEmail=email;
  P.googleName=finalName;
  P.googleSub=googleSub||null;
  P.googleVerifiedAt=isVerified?Date.now():0;
  P.isAdmin=isKnownAdminEmail(email);
  P.moderation=P.moderation&&typeof P.moderation==='object'?P.moderation:getDefaultModerationState();
  P.name=finalName;
  P.avatarImg=avatarUrl||fallbackAvatar;
  syncUidWithGoogleIdentity(false);
  saveProfileData();renderLobbyProfileTab();renderSocialChat();
  syncSocialAdminUi();
  refreshModerationStatus(true);
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
  P.googleConnected=false;P.googleEmail=null;P.googleName=null;P.googleSub=null;P.googleVerifiedAt=0;
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

function openNetworkDiagModal(){
  openModal('modal-netdiag');
  runNetworkDiagnostics();
}

async function runNetworkDiagnostics(){
  const wsUrl=(document.getElementById('social-ws-url')?.value||document.getElementById('jn-ws')?.value||document.getElementById('cr-ws')?.value||'').trim();
  setNetDiagLine('netdiag-health','Test en cours...','info');
  setNetDiagLine('netdiag-ws','Test en cours...','info');
  setNetDiagLine('netdiag-social','Test en cours...','info');
  setNetDiagLine('netdiag-multi','Test en cours...','info');
  setNetDiagLine('netdiag-summary','Analyse en cours...','info');

  let healthOk=false;
  let wsOk=false;

  const healthBase=wsUrlToHttpBase(wsUrl)||window.location.origin;
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
function initProfileImgZone(){
  const zone=document.getElementById('p-img-zone');
  if(!zone)return;
  if(zone.dataset.bound==='1')return;
  zone.dataset.bound='1';
  const handleFile=file=>{
    if(!file||!file.type.startsWith('image/'))return;
    const r=new FileReader();
    r.onload=ev=>{zone.setAttribute('data-img',ev.target.result);zone.style.backgroundImage=`url('${ev.target.result}')`;zone.style.backgroundSize='cover';zone.style.backgroundPosition='center';zone.textContent='';};
    r.readAsDataURL(file);
  };
  zone.addEventListener('click',()=>{const p=document.createElement('input');p.type='file';p.accept='image/*';p.onchange=e=>handleFile(e.target.files[0]);p.click();});
  zone.addEventListener('dragover',e=>{e.preventDefault();zone.style.borderColor='var(--accent)';});
  zone.addEventListener('dragleave',()=>{zone.style.borderColor='var(--border)';});
  zone.addEventListener('drop',e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);zone.style.borderColor='var(--border)';});
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
}

function saveUndo(){
  G.undoStack.push({
    players:clone(G.players),
    board:clone(G.board),
    cur:G.cur,rolled:G.rolled,doublesCount:G.doublesCount,
  });
  if(G.undoStack.length>10)G.undoStack.shift();
}

function undoLast(){
  if(!G.undoStack.length){toast('Rien à annuler.','w');return;}
  const s=G.undoStack.pop();
  G.players=s.players;G.board=s.board;G.cur=s.cur;
  G.rolled=s.rolled;G.doublesCount=s.doublesCount;
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

function openModal(id){
  if(['modal-create','modal-join','modal-add-local'].includes(id))syncPartyProfileDefaults();
  document.getElementById(id).classList.add('open');
  updateCenterActionsPopup();
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
  setTimeout(updateBoardAdaptiveScale,0);
}

function updateAddonButtonVisibility(){
  const btn=document.getElementById('pack-manager-btn');
  if(!btn)return;
  const inLobby=!!document.getElementById('lobby')?.classList.contains('active');
  btn.style.display=inLobby?'block':'none';
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
  b.innerHTML = '';

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

  refreshPawns();
  refreshOwners();
}

    // ...suppression du bloc dupliqué...

function refreshOwners(){
  G.board.forEach((cell,i)=>{
    const cellEl=document.querySelector(`.cell[data-idx="${i}"]`);
    if(!cellEl)return;
    if(cell.owner!=null){
      const p=G.players.find(p=>p.id===cell.owner);
      if(p&&p.color){
        cellEl.style.boxShadow='inset 0 0 0 2px '+p.color+', 0 0 18px '+p.color+'40';
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
  document.querySelectorAll('.cell .pawns').forEach(p=>p.innerHTML='');
  G.players.forEach(p=>{
    if(p.bust)return;
    const el=document.querySelector(`.cell[data-idx="${p.pos}"] .pawns`);
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
  document.getElementById('roll-btn').disabled=G.rolled||!p||p.bust;
  document.getElementById('end-btn').disabled=!G.rolled||!!G.pendingBuy;
  document.getElementById('skip-btn').style.display=(p&&p.jailed&&!G.rolled)?'inline-flex':'none';
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

  const hasOpenModal=
    !!document.querySelector('.modal-bg.open,#shop-modal-bg.open')||
    !!document.querySelector('#winner-overlay[style*="display:flex"],#winner-overlay[style*="display: flex"]');
  if(hasOpenModal){
    wrap.classList.remove('open');
    row.innerHTML='';
    return;
  }

  if(!G.centerActions||!G.started){
    wrap.classList.remove('open');
    row.innerHTML='';
    return;
  }

  const p=G.players[G.cur];
  if(!p||p.bust){
    wrap.classList.remove('open');
    row.innerHTML='';
    return;
  }
  if(!isProfileControlledPlayer(p)){
    wrap.classList.remove('open');
    row.innerHTML='';
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

  row.innerHTML=html;
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
  p.pos=10;p.jailed=true;G.doublesCount=0;
  playSfx('jail');
  glog(p.name+' va en prison'+(reason?' ('+reason+')':'')+' !','d');
  toast('👮 Prison !','d');
}

function getInflationMultiplier(){
  if(!G.inflationEnabled)return 1;
  const k=Math.max(0,(parseFloat(G.inflationRate)||0)/100);
  return 1+(k*Math.max(0,G.turnCount-1));
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
  if(!p||p.bust)return;
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
      G.rolled=true;renderPlayers();updBtns();broadcast();
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
  p.money-=G.jailFine;recordTxn(p,-G.jailFine,'Prison: amende volontaire');
  if(G.parkingPotEnabled)G.parkingPot+=G.jailFine;
  refreshPartyRuleUi();
  p.jailed=false;delete G.jailTurns[p.id];G.doublesCount=0;
  glog(p.name+' paie '+G.jailFine+'$ et sort de prison.','w');
  renderPlayers();updBtns();
}

// ═══════════════════════════════════════
//  MOVE
// ═══════════════════════════════════════
function movePlayer(p,steps){
  if(!steps||steps<=0)return;
  const old=p.pos;
  p.pos=(old+steps)%40;
  if(old+steps>=40){
    p.money+=G.passGoBonus;recordTxn(p,G.passGoBonus,'Passage Départ');
    glog(p.name+' passe par Départ → +'+G.passGoBonus+'$.','a');toast('🚦 +'+G.passGoBonus+'$ !','a');
    if(Math.random()<0.2)grantRandomMatchItem(p,'passage départ');
  }
  const cell=G.board[p.pos];
  animPawnArrive(p.pos);
  glog(p.name+' → '+cell.n+'.');
  toast('📍 '+p.name+' arrive sur '+cell.n,'i');
  resolveCell(p,cell);
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
  glog(label+': '+card.txt,'i');
  toast(label+'\n'+card.txt,'i');
  card.fn(p);
  if(Math.random()<0.35)grantRandomMatchItem(p,label.toLowerCase());
  renderPlayers();refreshPawns();updBtns();
}

// ═══════════════════════════════════════
//  PROPERTY
// ═══════════════════════════════════════
function calcRent(cell){
  if(cell.mortgaged||cell.owner==null)return 0;
  if(cell.t==='railroad'){
    const n=G.board.filter(c=>c.t==='railroad'&&c.owner===cell.owner).length;
    return Math.round(25*Math.pow(2,n-1)*getInflationMultiplier());
  }
  if(cell.t==='utility'){
    const n=G.board.filter(c=>c.t==='utility'&&c.owner===cell.owner).length;
    return Math.round((cell.r||30)*(n>=2?2:1)*getInflationMultiplier());
  }
  const base=cell.r||10;
  const houses=cell.houses||0;
  if(houses===0){
    const group=G.board.filter(c=>c.c===cell.c&&c.t==='property');
    const ownsAll=group.length>1&&group.every(c=>c.owner===cell.owner);
    return Math.round((ownsAll?base*2:base)*getInflationMultiplier());
  }
  const mult=[0,5,15,45,80,125];
  return Math.round(base*(mult[Math.min(houses,5)]||1)*getInflationMultiplier());
}

function handleProp(p,cell){
  if(cell.mortgaged&&cell.owner!=null){glog(cell.n+' est hypothéquée.','w');return;}
  if(cell.owner==null&&cell.p>0){
    if(p.money>=cell.p){
      G.pendingBuy={cell};
      document.getElementById('buy-info').textContent=
        'Acheter '+cell.ico+' '+cell.n+' pour '+cell.p+'$ ? (loyer: '+cell.r+'$)';
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
    const rent=calcRent(cell);if(rent<=0)return;
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
  p.money-=cell.p;recordTxn(p,-cell.p,'Achat: '+cell.n);
  cell.owner=p.id;cell.houses=0;cell.mortgaged=false;
  playSfx('buy');
  glog(p.name+' achète '+cell.n+' pour '+cell.p+'$.','a');
  toast('🏠 Acheté: '+cell.n,'a');
  hideBuyBar();refreshOwners();renderPlayers();broadcast();
  if(G.autoEnd&&G.started&&G.rolled&&!G.pendingBuy){
    setTimeout(()=>doNextTurn(),450);
  }
  if(p.id===G.myId){P.stats.propertiesBought++;saveProfileData();}
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
function openHouseModal(){
  const p=G.players[G.cur];if(!p)return;
  const props=G.board.filter(c=>c.owner===p.id&&c.t==='property'&&!c.mortgaged);
  const body=document.getElementById('house-body');
  if(!props.length){body.innerHTML='<div style="color:var(--muted);font-size:.75rem">Aucune propriété disponible.</div>';openModal('modal-house');return;}
  body.innerHTML='';
  props.forEach((cell,idx)=>{
    const cost=Math.floor(cell.p*.5);
    const sellVal=Math.floor(cost*.5);
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:.75rem';
    row.innerHTML=`
      <span style="flex:1">${cell.ico} ${cell.n} ${'🏠'.repeat(cell.houses||0)||'—'}</span>
      <span style="color:var(--accent)">${calcRent(cell)}$/tour</span>`;
    const btnBuy=document.createElement('button');
    btnBuy.className='btn btn-primary btn-xs';
    btnBuy.textContent='🏗️ +'+cost+'$';
    btnBuy.disabled=(cell.houses||0)>=5||p.money<cost;
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
  const cost=Math.floor(cell.p*.5);
  if(p.money<cost){toast('Pas assez !','d');return;}
  if((cell.houses||0)>=5){toast('Maximum atteint !','w');return;}
  saveUndo();
  p.money-=cost;recordTxn(p,-cost,'Maison: '+cell.n);
  cell.houses=(cell.houses||0)+1;
  glog(p.name+' construit '+(cell.houses>=5?'un hôtel':'une maison')+' sur '+cell.n+'.','a');
  toast((cell.houses>=5?'🏨 Hôtel':'🏠 Maison')+' sur '+cell.n,'a');
  refreshHouses();renderPlayers();broadcast();
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
  if(!me||me.bust)return;
  if(!isProfileControlledPlayer(me)){toast('Ce n\'est pas ton tour.','w');return;}

  const body=document.getElementById('trade-body');
  if(!body)return;
  const others=G.players.filter(p=>p.id!==me.id&&!p.bust);
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
  const alive=G.players.filter(p=>!p.bust);
  if(alive.length<=1)endGame(alive[0]);
}

function endGame(winner){
  G.started=false;stopTimer();stopGlobalTimer();
  if(G.botActionTimer){clearTimeout(G.botActionTimer);G.botActionTimer=null;}
  G.pendingRollBoostFor=null;
  playSfx('victory');
  updateMusicForContext();
  updateCenterActionsPopup();
  const overlay=document.getElementById('winner-overlay');
  overlay.classList.add('open');
  document.getElementById('endgame-body').textContent=
    (winner?winner.emoji+' '+winner.name:'Égalité')+' gagne !';
    if(winner&&winner.id===G.myId){P.stats.gamesWon++;P.elo=Math.min(9999,(P.elo||1000)+30);checkWinTitles();checkSecretTitles();saveProfileData();renderLobbyProfileTab();}
    else if(winner&&G.players.some(p=>!p.bot&&isProfileControlledPlayer(p))){P.stats.gamesLost=(P.stats.gamesLost||0)+1;P.elo=Math.max(0,(P.elo||1000)-20);saveProfileData();}
    if(winner&&!winner.bot&&isProfileControlledPlayer(winner)){
      grantRandomItem('victoire');
    }
  const grid=document.getElementById('p-count');grid.innerHTML='';
  const sorted=[...G.players].sort((a,b)=>
    (b.money+G.board.filter(c=>c.owner===b.id).reduce((s,c)=>s+c.p,0))-
    (a.money+G.board.filter(c=>c.owner===a.id).reduce((s,c)=>s+c.p,0))
  );
  sorted.forEach(p=>{
    const d=document.createElement('div');d.className='ws-stat';
    const net=p.money+G.board.filter(c=>c.owner===p.id).reduce((s,c)=>s+c.p,0);
    d.innerHTML=`<div class="ws-stat-val" style="color:${p.color}">${p.emoji}</div>
      <div style="font-size:.8rem;font-weight:700">${p.name}</div>
      <div class="ws-stat-label">${net}$ net</div>`;
    grid.appendChild(d);
  });
}

function countDominatedGroups(playerId){
  if(!playerId)return 0;
  const groups={};
  G.board.forEach(c=>{if(c.t==='property'&&c.c){if(!groups[c.c])groups[c.c]=[];groups[c.c].push(c);}});
  let n=0;
  Object.keys(groups).forEach(clr=>{
    const arr=groups[clr];
    if(arr.length>1&&arr.every(c=>c.owner===playerId))n++;
  });
  return n;
}

function getLeaderByNetWorth(){
  const alive=G.players.filter(p=>!p.bust);
  if(!alive.length)return null;
  return [...alive].sort((a,b)=>{
    const na=a.money+G.board.filter(c=>c.owner===a.id).reduce((s,c)=>s+(c.p||0),0);
    const nb=b.money+G.board.filter(c=>c.owner===b.id).reduce((s,c)=>s+(c.p||0),0);
    return nb-na;
  })[0]||null;
}

function checkPartyObjectives(){
  if(G.goalMoney>0){
    const winner=G.players.find(p=>!p.bust&&p.money>=G.goalMoney);
    if(winner){
      glog('🏁 Objectif fortune atteint par '+winner.name+' ('+winner.money+'$).','a');
      toast('🏁 Objectif atteint: '+winner.name,'a');
      endGame(winner);
      return true;
    }
  }
  if(G.dominationTarget>0){
    const winner=G.players.find(p=>!p.bust&&countDominatedGroups(p.id)>=G.dominationTarget);
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
  if(curP&&G.bonusTurns[curP.id]>0){
    G.bonusTurns[curP.id]--;
    G.rolled=false;G.doublesCount=0;
    glog('🎁 Tour bonus pour '+curP.name+' !','a');
    toast('🎁 '+curP.name+' rejoue','a');
    renderPlayers();updBtns();broadcast();
    return;
  }
  G.turnCount++;
  if(checkPartyObjectives())return;
  hideBuyBar();
  stopTimer();
  // Advance to next non-bust player
  let next=G.cur;
  let tries=0;
  do{next=(next+1)%G.players.length;tries++;}
  while(G.players[next].bust&&tries<G.players.length);
  G.cur=next;G.rolled=false;G.doublesCount=0;
  const np=G.players[G.cur];
  if(np&&G.bonusTurnEnabled&&!np.bust&&Math.random()<((G.bonusTurnChance||0)/100)){
    G.bonusTurns[np.id]=(G.bonusTurns[np.id]||0)+1;
    glog('✨ '+np.name+' obtient un tour bonus.','a');
  }
  renderPlayers();updBtns();broadcast();
  startTimer();
  glog('--- Tour de '+G.players[G.cur].name+' ---','i');
  P.stats.totalTurns++;saveProfileData();
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

function startTimer(){
  if(!G.timerEnabled)return;
  stopTimer();
  let t=G.timerDuration;
  document.getElementById('timer-num').textContent=t;
  refreshTurnTimerWheelDisplay(t);
  document.getElementById('timer-wrap').style.display='flex';
  G.timerTick=setInterval(()=>{
    t--;
    document.getElementById('timer-num').textContent=t;
    refreshTurnTimerWheelDisplay(t);
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
function glog(msg,type=''){
  const log=document.getElementById('glog');
  const el=document.createElement('div');
  el.className='le'+(type?' '+type:'');
  el.textContent=msg;
  log.prepend(el);
  if(log.children.length>80)log.lastChild.remove();
}

// ═══════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════
function toast(msg,type='i'){
  const wrap=document.getElementById('toasts');
  if(!wrap)return;
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
  updateBoardAdaptiveScale();
}

function isOnlineHost(){
  return !!(G.mode==='online'&&G.myId&&String(G.myId).startsWith('h-'));
}

function canEditPartyOptions(){
  if(G.mode!=='online')return true;
  return isOnlineHost();
}

function isPartyOptionsLocked(){
  return !!(G.started||!canEditPartyOptions());
}

function applyPartyWheelLockState(){
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

function playNextAsianTrack(){
  if(G.musicSource!=='asian-pack'&&G.musicSource!=='imported-files')return;
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
  const seq=MUSIC_THEMES[theme];
  if(!seq||!seq.length)return;
  if(AUDIO_ENGINE.timer&&AUDIO_ENGINE.theme===theme)return;
  stopSynthMusic();
  AUDIO_ENGINE.theme=theme;
  AUDIO_ENGINE.step=0;
  AUDIO_ENGINE.timer=setInterval(()=>{
    if(!G.musicEnabled||G.soundMuted||G.musicVolume<=0)return;
    if(!AUDIO_ENGINE.ctx||AUDIO_ENGINE.ctx.state!=='running')return;
    const n=seq[AUDIO_ENGINE.step%seq.length];
    AUDIO_ENGINE.step++;
    if(n&&n.f>0)playMusicTone(n.f,n.d,n.v,n.t);
  },460);
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
  const enabled=!!G.musicBoostEnabled;
  const pct=Math.max(100,Math.min(250,parseInt(G.musicBoostPercent,10)||130));
  ['music-boost-chk','lb-music-boost-chk'].forEach(id=>{const el=document.getElementById(id);if(el)el.checked=enabled;});
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
  const external=(G.musicSource==='asian-pack'||G.musicSource==='imported-files');
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

function syncMusicSourceUi(){
  const v=G.musicSource||'default';
  const a=document.getElementById('music-source');
  const b=document.getElementById('lb-music-source');
  if(a)a.value=v;
  if(b)b.value=v;
  updateImportedMusicUi();
}

function setMusicSource(source){
  G.musicSource=(['default','asian-pack','imported-files'].includes(source)?source:'default');
  syncMusicSourceUi();
  if(G.musicSource==='imported-files'&&!AUDIO_ENGINE.userTracks.length){
    toast('Importe des fichiers audio pour utiliser cette playlist','w');
  }
  saveAudioPrefs();
  updateMusicForContext();
}

function updateMusicForContext(){
  applyAudioGain();
  if(G.streamerMode||!G.musicEnabled||G.soundMuted||G.musicVolume<=0){stopMusic();return;}
  if(!AUDIO_ENGINE.unlocked)return;
  if(G.musicSource==='asian-pack'||G.musicSource==='imported-files'){
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
  updateBoardAdaptiveScale();
}

function loadAudioPrefs(){
  try{
    const raw=localStorage.getItem(AUDIO_PREFS_KEY)||'{}';
    const a=JSON.parse(raw);
    if(a&&typeof a==='object'){
      if(a.musicEnabled!==undefined)G.musicEnabled=!!a.musicEnabled;
      if(a.musicSource!==undefined)G.musicSource=(a.musicSource==='asian-pack')?'asian-pack':'default';
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
  syncMusicSourceUi();
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
  const turnTimer=document.getElementById('pw-turn-timer-chk');
  const turnTimerDur=document.getElementById('pw-turn-timer-dur');
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
  if(turnTimer)turnTimer.checked=!!G.timerEnabled;
  if(turnTimerDur)turnTimerDur.value=G.timerDuration;
  if(turnTimer)turnTimer.disabled=!canEditPartyOptions();
  if(turnTimerDur)turnTimerDur.disabled=!canEditPartyOptions();
  refreshTurnTimerWheelDisplay(document.getElementById('timer-num')?.textContent||G.timerDuration);
  const quick=document.getElementById('party-quick-summary');
  if(quick){
    const turnsTxt=G.maxTurns>0?(' • '+G.maxTurns+' tours max'):' • tours infinis';
    const goalTxt=G.goalMoney>0?(' • objectif '+G.goalMoney+'$'):' • objectif off';
    const domTxt=G.dominationTarget>0?(' • domination '+G.dominationTarget):'';
    quick.textContent='Départ '+G.startingMoney+'$ • Bonus '+G.passGoBonus+'$ • Amende '+G.jailFine+'$'+turnsTxt+goalTxt+domTxt;
  }
  const skip=document.getElementById('skip-btn');
  if(skip)skip.textContent='🔓 '+G.jailFine+' $';
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

function renderInventoryUi(){
  const i=P.inventory||{};
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
  if(!p||p.bust)return;
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
  const active=enabled&&!!G.started&&controlled&&!p?.bust;
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
    setAutoEnd(false);setTimerEnabled(false);
  }else if(kind==='quick'){
    setStartingMoney(1200);setPassGoBonus(150);setJailFine(75);setMaxTurns(40);setGoalMoney(5000);
    setDominationTarget(0);setGlobalTimerSec(1200);setInflationEnabled(true);setInflationRate(2.5);
    setTaxVarianceEnabled(true);setBonusTurnEnabled(true);setBonusTurnChance(18);setParkingPotEnabled(true);
    setAutoEnd(true);setTimerEnabled(true);setTimerDuration(30);
  }else if(kind==='chaos'){
    setStartingMoney(2500);setPassGoBonus(350);setJailFine(0);setMaxTurns(25);setGoalMoney(12000);
    setDominationTarget(2);setGlobalTimerSec(900);setInflationEnabled(true);setInflationRate(4);
    setTaxVarianceEnabled(true);setBonusTurnEnabled(true);setBonusTurnChance(30);setParkingPotEnabled(true);
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
      room:G.room,mode:G.mode,myId:G.myId,myReady:G.myReady,
      startingMoney:G.startingMoney,passGoBonus:G.passGoBonus,jailFine:G.jailFine,
      maxTurns:G.maxTurns,goalMoney:G.goalMoney,turnCount:G.turnCount,
      dominationTarget:G.dominationTarget,globalTimerSec:G.globalTimerSec,
      inflationEnabled:G.inflationEnabled,inflationRate:G.inflationRate,
      taxVarianceEnabled:G.taxVarianceEnabled,bonusTurnEnabled:G.bonusTurnEnabled,
      bonusTurnChance:G.bonusTurnChance,parkingPotEnabled:G.parkingPotEnabled,parkingPot:G.parkingPot,
      timerEnabled:G.timerEnabled,timerDuration:G.timerDuration,autoEnd:G.autoEnd,
      centerActions:G.centerActions,gameZoom:G.gameZoom,centerDiceScale:G.centerDiceScale,pawnScale:G.pawnScale,pawnGlow:G.pawnGlow,streamerMode:G.streamerMode,musicSource:G.musicSource,musicBoostEnabled:G.musicBoostEnabled,musicBoostPercent:G.musicBoostPercent,toastMs:G.toastMs,
    },
    profile:{stats:clone(P.stats),inventory:clone(P.inventory||{})},
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
  setMusicBoostEnabled(g.musicBoostEnabled??G.musicBoostEnabled);
  setMusicBoostPercent(g.musicBoostPercent??G.musicBoostPercent);
  setToastDuration(Math.round((g.toastMs??G.toastMs)/1000));
  if(snap.profile&&snap.profile.stats)P.stats=Object.assign({},P.stats,snap.profile.stats);
  if(snap.profile&&snap.profile.inventory){
    P.inventory=Object.assign({},P.inventory||{},snap.profile.inventory);
  }
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
  const alive=G.players.filter(p=>!p.bust).length;
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
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:var(--s2);font-size:.72rem';
    row.innerHTML=`<span style="font-size:.95rem">${b.emoji||'🤖'}</span><span style="flex:1;color:${b.color||'#9ca3af'};font-weight:700">${b.name||('Bot '+(i+1))}</span><span style="font-size:.65rem;color:var(--muted)">${b.botLevel||'easy'}</span><button class="btn btn-xs btn-danger" type="button" onclick="removeBotFromPartyWheel(${i})">✕</button>`;
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
  const botObj={id,name,emoji:botIdentity.emoji,color,img:null,bot:true,botLevel:lvl,matchItems:{diceBoost:0,antiJail:0,mortgageDiscount:0},money:G.startingMoney,pos:0,jailed:false,bust:false,jailCards:0,ready:true};
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

