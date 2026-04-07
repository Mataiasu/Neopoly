(function(){
// ═══════════════════════════════════════
//  ADDON — BOUTIQUE POWER-UPS
//  Extrait du core pour limiter les regressions dans test1.html.
// ═══════════════════════════════════════

function ensurePowerupsShopDom(){
  if(document.getElementById('shop-modal-bg'))return;
  const wrap=document.createElement('div');
  wrap.innerHTML=`
<div id="shop-modal-bg">
  <div id="shop-box">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <div id="shop-title">🛒 Boutique</div>
        <div id="shop-balance"></div>
      </div>
      <button class="btn btn-secondary btn-sm" type="button" onclick="closeShop()">✕</button>
    </div>
    <div id="shop-items-list"></div>
    <div id="shop-selection-panel" style="display:none"></div>
  </div>
</div>`;
  const modal=wrap.firstElementChild;
  if(modal)document.body.appendChild(modal);
}

const POWERUP_TAX_PER_OPPONENT=15;
const SHOP_ITEMS=[
  {id:'diceBoost',icon:'⚡',name:'Booster de dé',price:165,desc:'Ajoute un booster de dé tactique. Max 1 achat par tour.',maxPerTurn:1,maxHeld:3,buy:p=>{addMatchItem(p,'diceBoost',1,'boutique');return true;}},
  {id:'antiJail',icon:'🛡️',name:'Anti-prison',price:210,desc:'Sortie automatique au prochain emprisonnement. Stock max : 3.',maxHeld:3,buy:p=>{addMatchItem(p,'antiJail',1,'boutique');return true;}},
  {id:'ghostPass',icon:'👻',name:'Fantôme',price:235,desc:'Ignore le prochain loyer subi. Stock max : 2.',maxHeld:2,buy:p=>{p.ghostPass=(parseInt(p.ghostPass,10)||0)+1;toast('👻 Fantôme prêt pour le prochain loyer.','a');return true;}},
  {id:'quickBuild',icon:'🏗️',name:'Construction rapide',price:320,desc:'Construit gratuitement une maison sur une de tes propriétés.',selection:'quickBuild',maxPerTurn:1},
  {id:'sabotage',icon:'💣',name:'Sabotage',price:420,desc:'Détruit une maison sur une propriété adverse. Recharge : 2 tours.',selection:'sabotage',maxPerTurn:1,cooldownTurns:2},
  {id:'taxCollect',icon:'💰',name:'Collecte d\'impôts',price:140,desc:'Prend '+POWERUP_TAX_PER_OPPONENT+'$ à chaque joueur adverse actif. 1 fois par tour.',maxPerTurn:1,cooldownTurns:1,buy:p=>buyShopTaxCollect(p)}
];
let SHOP_PENDING_SELECTION=null;

function ensurePlayerShopUsage(player){
  if(!player||typeof player!=='object')return {};
  if(!player.shopUsage||typeof player.shopUsage!=='object')player.shopUsage={};
  return player.shopUsage;
}

function getShopHeldCount(itemId,player){
  const p=player||G.players[G.cur];
  if(!p)return 0;
  const mi=ensurePlayerMatchItems(p);
  if(itemId==='diceBoost')return (parseInt(mi.diceBoost,10)||0)+(isProfileControlledPlayer(p)?(parseInt(P.inventory?.diceBoost,10)||0):0);
  if(itemId==='antiJail')return (parseInt(mi.antiJail,10)||0)+(isProfileControlledPlayer(p)?(parseInt(P.inventory?.antiJail,10)||0):0);
  if(itemId==='ghostPass')return Math.max(0,parseInt(p.ghostPass,10)||0);
  return 0;
}

function getShopItemState(item,player){
  const p=player||G.players[G.cur];
  const nowTurn=Math.max(1,parseInt(G.turnCount,10)||1);
  const usage=ensurePlayerShopUsage(p);
  const entry=usage[item.id]&&typeof usage[item.id]==='object'?usage[item.id]:(usage[item.id]={turn:0,count:0,lastTurn:0});
  if(entry.turn!==nowTurn){
    entry.turn=nowTurn;
    entry.count=0;
  }
  const maxPerTurn=Math.max(0,parseInt(item.maxPerTurn,10)||0);
  const cooldownTurns=Math.max(0,parseInt(item.cooldownTurns,10)||0);
  const maxHeld=Math.max(0,parseInt(item.maxHeld,10)||0);
  const held=getShopHeldCount(item.id,p);
  const turnCount=Math.max(0,parseInt(entry.count,10)||0);
  const lastTurn=Math.max(0,parseInt(entry.lastTurn,10)||0);
  const turnsSinceUse=lastTurn?Math.max(0,nowTurn-lastTurn):999;
  const cooldownRemaining=lastTurn?Math.max(0,cooldownTurns-turnsSinceUse):0;
  const atTurnCap=!!(maxPerTurn&&turnCount>=maxPerTurn);
  const atStockCap=!!(maxHeld&&held>=maxHeld);
  let reason='';
  if(cooldownRemaining>0)reason='Recharge : '+cooldownRemaining+' tour'+(cooldownRemaining>1?'s':'');
  else if(atTurnCap)reason='Limite par tour atteinte';
  else if(atStockCap)reason='Stock max atteint';
  return {maxPerTurn,cooldownTurns,maxHeld,held,turnCount,cooldownRemaining,available:!reason,reason};
}

function registerShopItemUse(item,player){
  const p=player||G.players[G.cur];
  if(!item||!p)return;
  const usage=ensurePlayerShopUsage(p);
  const nowTurn=Math.max(1,parseInt(G.turnCount,10)||1);
  const entry=usage[item.id]&&typeof usage[item.id]==='object'?usage[item.id]:(usage[item.id]={turn:nowTurn,count:0,lastTurn:0});
  if(entry.turn!==nowTurn){entry.turn=nowTurn;entry.count=0;}
  entry.count=Math.max(0,parseInt(entry.count,10)||0)+1;
  entry.lastTurn=nowTurn;
}

function buildShopItemBadges(item,state){
  const badges=[];
  if(state.maxPerTurn)badges.push('⏱️ '+state.maxPerTurn+'/tour');
  if(state.cooldownTurns)badges.push('♻️ CD '+state.cooldownTurns+'t');
  if(state.maxHeld)badges.push('🎒 '+state.held+'/'+state.maxHeld);
  return badges;
}

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
  ensurePowerupsShopDom();
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
  ensurePowerupsShopDom();
  const player=G.players[G.cur];
  const balance=document.getElementById('shop-balance');
  const list=document.getElementById('shop-items-list');
  if(!player||!balance||!list)return;
  balance.textContent='Budget : '+player.money+'$ • Tour '+Math.max(1,parseInt(G.turnCount,10)||1);
  list.innerHTML=SHOP_ITEMS.map(item=>{
    const canAfford=player.money>=item.price;
    const state=getShopItemState(item,player);
    const canBuy=canAfford&&state.available;
    const badges=buildShopItemBadges(item,state);
    const statusNote=!canAfford
      ?('Manque '+Math.max(0,item.price-player.money)+'$.')
      :(state.reason||'Disponible maintenant.');
    return '<div class="shop-item'+(canBuy?'':' is-locked')+(canAfford?'':' cant-afford')+'>'+ 
      '<span class="shop-item-icon">'+item.icon+'</span>'+
      '<div class="shop-item-info">'+
        '<div class="shop-item-name">'+escapeHtml(item.name)+'</div>'+
        '<div class="shop-item-desc">'+escapeHtml(item.desc)+'</div>'+
        (badges.length?('<div class="shop-item-badges">'+badges.map(label=>'<span class="shop-mini-badge">'+escapeHtml(label)+'</span>').join('')+'</div>'):'')+
        '<div class="shop-item-note">'+escapeHtml(statusNote)+'</div>'+
      '</div>'+
      '<span class="shop-item-price">'+item.price+'$</span>'+
      '<button class="btn btn-'+(canBuy?'yellow':'secondary')+' btn-xs shop-item-btn" '+(canBuy?'':'disabled')+' onclick="buyShopItem(\''+item.id+'\')">'+(canBuy?'Acheter':'Bloqué')+'</button>'+
    '</div>';
  }).join('');
  renderShopSelectionPanel();
}

function buyShopItem(itemId){
  const item=SHOP_ITEMS.find(entry=>entry.id===itemId);
  const player=G.players[G.cur];
  if(!item||!player)return;
  if(player.money<item.price){toast('Pas assez d\'argent.','d');return;}
  const state=getShopItemState(item,player);
  if(!state.available){toast(state.reason||'Cet objet est temporairement indisponible.','i');renderShopItems();return;}
  if(item.selection){
    beginShopSelection(item,player);
    return;
  }
  saveUndo();
  const result=item.buy(player);
  if(result===false)return;
  registerShopItemUse(item,player);
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
        meta:(cell.houses||0)+' maison'+((cell.houses||0)>1?'s':''),
        desc:((cell.houses||0)>=4?'Passera en hôtel':'Passera à '+((cell.houses||0)+1)+' maison'+(((cell.houses||0)+1)>1?'s':'')),
        accent:cell.c||player.color||'#67f7d7',
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
          meta:(owner?owner.name:'Adversaire')+' • '+(cell.houses||0)+' maison'+((cell.houses||0)>1?'s':''),
          desc:'Retire 1 maison à cette propriété adverse.',
          accent:(owner&&owner.color)||cell.c||'#ff647c',
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
          '<button class="shop-target-btn" type="button" style="--shop-accent:'+(candidate.accent||'#67f7d7')+'" onclick="confirmShopSelection('+idx+')">'+
            '<span class="shop-target-accent"></span>'+
            '<span>'+escapeHtml(candidate.icon||'•')+'</span>'+
            '<span class="shop-target-copy"><strong>'+escapeHtml(candidate.title)+'</strong><span class="shop-target-desc">'+escapeHtml(candidate.desc||candidate.meta||'')+'</span></span>'+
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
  const state=getShopItemState(item,player);
  if(!state.available){toast(state.reason||'Cet objet est indisponible pour le moment.','i');clearShopSelection();renderShopItems();return;}
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
  registerShopItemUse(item,player);
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
    const take=Math.min(POWERUP_TAX_PER_OPPONENT,entry.money||0);
    entry.money-=take;
    player.money+=take;
    total+=take;
    recordTxn(entry,-take,'Taxe boutique: '+player.name);
    checkBust(entry);
  });
  if(total<=0){toast('Les autres joueurs sont déjà à sec.','w');return false;}
  recordTxn(player,total,'Collecte d\'impôts');
  toast('💰 '+total+'$ collectés.','a');
  return true;
}

function consumeGhostPass(player,cell){
  if(!player||(parseInt(player.ghostPass,10)||0)<=0)return false;
  if(!cell||cell.owner==null||cell.owner===player.id)return false;
  player.ghostPass=Math.max(0,(parseInt(player.ghostPass,10)||0)-1);
  renderMatchItemsUi();
  if(typeof broadcast==='function'&&G.mode==='online')broadcast();
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

window.ensurePowerupsShopDom=ensurePowerupsShopDom;
window.isPowerupsAddonEnabled=isPowerupsAddonEnabled;
window.refreshPowerupsUi=refreshPowerupsUi;
window.clearShopSelection=clearShopSelection;
window.refreshShopGameplayUi=refreshShopGameplayUi;
window.openShop=openShop;
window.closeShop=closeShop;
window.renderShopItems=renderShopItems;
window.buyShopItem=buyShopItem;
window.beginShopSelection=beginShopSelection;
window.getShopSelectionCandidates=getShopSelectionCandidates;
window.renderShopSelectionPanel=renderShopSelectionPanel;
window.confirmShopSelection=confirmShopSelection;
window.buyShopTaxCollect=buyShopTaxCollect;
window.consumeGhostPass=consumeGhostPass;

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{
    ensurePowerupsShopDom();
    if(typeof refreshPowerupsUi==='function')refreshPowerupsUi();
  },{once:true});
}else{
  ensurePowerupsShopDom();
}
})();