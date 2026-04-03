//  STATS & TXN
// ═══════════════════════════════════════
function renderStats(){
  const el=document.getElementById('stats-body');if(!el)return;
  const summaries=G.players.map(p=>({player:p,props:0,assetValue:0,ownedCells:[]}));
  const byId=new Map(summaries.map(entry=>[entry.player.id,entry]));
  G.board.forEach(cell=>{
    const ownerEntry=byId.get(cell.owner);
    if(!ownerEntry)return;
    ownerEntry.props+=1;
    ownerEntry.assetValue+=Number(cell.p||0);
    ownerEntry.ownedCells.push(cell);
  });
  const sorted=[...summaries].sort((a,b)=>(b.player.money+b.assetValue)-(a.player.money+a.assetValue));
  el.innerHTML=`<table class="stats-table">
    <tr><th>Joueur</th><th>Argent</th><th>Props</th><th>Net</th></tr>
    ${sorted.map(entry=>{
      const p=entry.player;
      const net=p.money+entry.assetValue;
      return`<tr><td><span style="color:${p.color}">${p.emoji} ${p.name}</span>${p.bust?' 💀':''}</td>
        <td>${p.money}$</td><td>${entry.props}</td><td>${net}$</td></tr>`;
    }).join('')}</table>`;

  const gh=document.getElementById('gh-turn');if(!gh)return;
  const eco=(typeof getBoardEconomySnapshot==='function')?getBoardEconomySnapshot():null;
  gh.innerHTML='';
  G.players.forEach(p=>{
    const props=(byId.get(p.id)?.ownedCells)||[];if(!props.length)return;
    const sec=document.createElement('div');sec.style.marginBottom='10px';
    sec.innerHTML=`<div style="font-size:.72rem;font-weight:700;color:${p.color};margin-bottom:4px">${p.emoji} ${p.name}</div>`;
    props.forEach(c=>{
      const row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:5px;padding:2px 0;font-size:.7rem';
      row.innerHTML=`
        <span style="width:7px;height:7px;border-radius:999px;background:${c.c};flex-shrink:0;display:inline-block"></span>
        ${c.ico} ${c.n}${c.mortgaged?' <span style="color:#f97316;font-size:.6rem">HYPO</span>':''}
        ${(c.houses||0)>0?'<span>'+(c.houses>=5?'🏨':'🏠'.repeat(c.houses))+'</span>':''}
        <span style="margin-left:auto;color:var(--muted)">${calcRent(c,eco)}$</span>`;
      sec.appendChild(row);
    });
    gh.appendChild(sec);
  });
}

function renderTxns(){
  const el=document.getElementById('txn-body');
  if(!el)return;
  const sub=document.getElementById('txn-sub');
  if(sub)sub.textContent=G.txns.length+' transactions';
  el.innerHTML=G.txns.slice(0,30).map(t=>`
    <div class="txn-item">
      <span><span style="color:${t.color}">${t.name}</span> - ${t.desc}</span>
      <span class="${t.amount>0?'txn-pos':'txn-neg'}">${t.amount>0?'+':''}${t.amount}$</span>
    </div>`).join('');
}

function switchTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.toggle('active',p.id===name));
  if(name==='stats-tab')renderStats();
  if(name==='txn-tab')renderTxns();
}

function renderPlayers(){
  const list=document.getElementById('players-list');
  if(!list)return;
  const playerSignature=JSON.stringify({
    cur:G.cur,
    started:!!G.started,
    players:G.players.map(p=>({id:p.id,name:p.name,color:p.color,emoji:p.emoji,img:!!p.img,money:p.money,pos:p.pos,bust:!!p.bust,jailed:!!p.jailed,ghostPass:parseInt(p.ghostPass)||0,teamId:p.teamId||'',matchItems:p.matchItems||{}}))
  });
  if(G.playerPanelSignature!==playerSignature){
    list.innerHTML='';
    const frag=document.createDocumentFragment();
    G.players.forEach((p,i)=>{
      const row=document.createElement('div');
    row.className='player-row'+(i===G.cur&&!p.bust?' active-player':'')+(p.bust?' bust-player':'');
    row.style.cursor='pointer';
    row.title='Voir les stats de '+p.name;
    row.onclick=()=>showPlayerModal(p.id);
    const cell=G.board[p.pos];
    let avatarHtml;
    if(p.img){
      avatarHtml = `<img src="${p.img}" alt="pion" class="player-avatar" style="background:${p.color}22;border:2px solid ${p.color};width:30px;height:30px;object-fit:cover;border-radius:50%;background:#fff;box-shadow:0 1px 4px #0008;">`;
    }else{
      avatarHtml = `<span class="player-avatar" style="background:${p.color}22;border:2px solid ${p.color}">${p.emoji}</span>`;
    }
    const mi=p.matchItems||{};
    const _pBadges=[];
    if(p.teamId&&typeof getTeamLabel==='function')_pBadges.push('🤝 '+getTeamLabel(p.teamId));
    if(p.bot&&typeof getBotPersonaConfig==='function'){
      const persona=getBotPersonaConfig(p);
      _pBadges.push(persona.icon+' '+persona.label);
    }
    if((mi.diceBoost||0)>0)_pBadges.push('⚡×'+mi.diceBoost);
    if((mi.antiJail||0)>0)_pBadges.push('🛡×'+mi.antiJail);
    if((parseInt(p.ghostPass)||0)>0)_pBadges.push('👻×'+(parseInt(p.ghostPass)||0));
    const badgesHtml=_pBadges.length?`<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:2px">${_pBadges.map(b=>`<span style="font-size:.55rem;background:rgba(255,255,255,.08);border-radius:3px;padding:0 3px;line-height:1.5">${b}</span>`).join('')}</div>`:'';
      row.innerHTML=`
        ${avatarHtml}
        <div style="flex:1;min-width:0">
          <div class="player-name" style="color:${p.color}">${p.name}${p.bust?' 💀':''}${p.jailed?' ⛓️':''}</div>
          <div class="player-pos">${cell?cell.ico+' '+cell.n:'?'}</div>
          ${badgesHtml}
        </div>
        <div class="player-money">${p.money} $ </div>`;
      frag.appendChild(row);
    });
    list.appendChild(frag);
    G.playerPanelSignature=playerSignature;
    const activeId=G.players[G.cur]?.id||'';
    if(activeId&&G.lastActivePlayerId!==activeId){
      G.lastActivePlayerId=activeId;
      const activeRow=list.querySelector('.active-player');
      if(activeRow&&typeof activeRow.scrollIntoView==='function'){
        try{activeRow.scrollIntoView({block:'nearest',behavior:(window.DEVICE==='mobile'?'smooth':'auto')});}catch(_){ }
      }
    }
  }
  refreshPawns();
  refreshOwners();
  // Affichage du pion du joueur courant dans le centre du plateau
  const centerInfoEl=G.centerInfoEl||document.getElementById('center-info');
  if(!centerInfoEl)return;
  let cur = G.players[G.cur];
  let nextCenterInfo='Prêt à jouer';
  let nextCenterHtml='Prêt à jouer';
  if(G.started && cur){
    let info = '';
    if(cur.img){
      info = `<img src="${cur.img}" style="width:1.2em;height:1.2em;vertical-align:middle;border-radius:50%;border:2px solid ${cur.color};background:#fff;margin-right:2px;">`;
    }else{
      info = cur.emoji+' ';
    }
    const gt=(G.globalTimerSec>0)?(' • ⏰ '+Math.floor((G.globalTimerLeft||0)/60).toString().padStart(2,'0')+':'+String((G.globalTimerLeft||0)%60).padStart(2,'0')):'';
    nextCenterInfo=[cur.name,cur.color,cur.img||'',cur.emoji||'',gt].join('|');
    nextCenterHtml=info + cur.name + ' (tour)' + gt;
  }
  if(G.centerInfoSignature!==nextCenterInfo){
    G.centerInfoSignature=nextCenterInfo;
    if(G.started && cur)centerInfoEl.innerHTML = nextCenterHtml;
    else centerInfoEl.textContent = 'Prêt à jouer';
  }
  const hintEl=document.getElementById('turn-hint');
  if(hintEl){
    const hintText=!G.started
      ?'💡 Ajoute les joueurs puis lance la partie.'
      :(!isProfileControlledPlayer(cur)
        ?('👀 Tour de '+(cur?.name||'un joueur')+' — observe en direct.')
        :(G.pendingBuy
          ?'🛒 Achat dispo : choisis Acheter ou Passer.'
          :((cur&&cur.jailed&&!G.rolled)
            ?'🔓 Tu es en prison : lance les dés ou paie l’amende.'
            :(!G.rolled?'🎲 Lance les dés pour continuer.':'➡️ Gère tes actions puis termine le tour.'))));
    if(hintEl.dataset.lastHint!==hintText){
      hintEl.dataset.lastHint=hintText;
      hintEl.textContent=hintText;
    }
  }
  renderInventoryUi();
  renderMatchItemsUi();
  if(typeof renderMatchObjectiveUi==='function')renderMatchObjectiveUi();
  if(typeof renderTurnHistory==='function')renderTurnHistory();
  if(typeof renderBoardEventUi==='function')renderBoardEventUi();
  if(typeof renderAlliancePanel==='function')renderAlliancePanel();
  scheduleBotTurn();
}

function isCurrentPlayerBot(){
  const p=G.players[G.cur];
  const hostOnline=G.mode==='online'&&G.myId&&String(G.myId).startsWith('h-');
  return !!(G.started&&p&&p.bot&&!p.bust&&(G.mode==='local'||hostOnline));
}

function getBotPurchaseScore(p,cell){
  if(!p||!cell)return 0;
  const persona=(typeof getBotPersonaConfig==='function')?getBotPersonaConfig(p):{key:'balanced',propertyBias:10,railroadBias:10,utilityBias:5,setBias:20};
  let score=0;
  if(cell.t==='property'){
    const group=G.board.filter(c=>c.t==='property'&&c.c===cell.c);
    const ownedByBot=group.filter(c=>c.owner===p.id).length;
    const blockedByOther=group.some(c=>c.owner!=null&&c.owner!==p.id);
    score+=ownedByBot*55;
    score+=persona.propertyBias||0;
    if(group.length>1&&ownedByBot===group.length-1)score+=140+(persona.setBias||0);
    if((persona.key||'')==='sprinter'&&(G.turnCount||1)<=6)score+=26;
    if(blockedByOther)score-=25;
  }else if(cell.t==='railroad'){
    const ownedRails=G.board.filter(c=>c.t==='railroad'&&c.owner===p.id).length;
    score+=ownedRails*45+(persona.railroadBias||0);
    if(ownedRails>=3)score+=60;
  }else if(cell.t==='utility'){
    const ownedUtils=G.board.filter(c=>c.t==='utility'&&c.owner===p.id).length;
    score+=(ownedUtils?50:20)+(persona.utilityBias||0);
  }
  if((p.money||0)>(G.startingMoney||1500)*1.4)score+=10;
  return score;
}

function botBuyDecision(p,cell){
  if(!p||!cell||cell.owner!=null||!(cell.p>0))return false;
  const lvl=p.botLevel||'easy';
  const persona=(typeof getBotPersonaConfig==='function')?getBotPersonaConfig(p):{buyBias:0,reserveDelta:0};
  const cash=p.money||0;
  const price=cell.p||0;
  const score=getBotPurchaseScore(p,cell);
  const reserveBase=lvl==='easy'?320:(lvl==='medium'?220:140);
  const reserve=Math.max(70,reserveBase+(persona.reserveDelta||0)-Math.round(Math.max(0,score)/2));
  if(cash<price+reserve)return false;
  const chanceBase=lvl==='easy'?0.55:(lvl==='medium'?0.74:0.9);
  return Math.random()<Math.min(0.98,Math.max(0.18,chanceBase+(persona.buyBias||0)+(score/250)));
}

function tryBotEconomicAction(p){
  if(!p||p.bust||p._lastBotEconomyTurn===G.turnCount)return false;
  const lvl=p.botLevel||'easy';
  const persona=(typeof getBotPersonaConfig==='function')?getBotPersonaConfig(p):{reserveDelta:0,buildBias:0,unmortgageBias:0};
  const eco=(typeof getBoardEconomySnapshot==='function')?getBoardEconomySnapshot():null;
  const reserve=Math.max(120,(lvl==='easy'?420:(lvl==='medium'?310:220))+(persona.reserveDelta||0));
  const buildChance=Math.min(0.92,Math.max(0.08,(lvl==='easy'?0.2:(lvl==='medium'?0.45:0.72))+(persona.buildBias||0)));
  const monopolyProps=G.board.filter(cell=>{
    if(!cell||cell.t!=='property'||cell.owner!==p.id||cell.mortgaged||(cell.houses||0)>=3)return false;
    const total=eco?.propertyGroupTotals?.get(cell.c)||0;
    const owned=eco?.propertyGroupOwned?.get(cell.c)?.get(p.id)||0;
    return total>1&&owned===total;
  }).sort((a,b)=>calcRent(b,eco)-calcRent(a,eco));
  const buildTarget=monopolyProps.find(cell=>p.money>=Math.floor((cell.p||0)*0.5)+reserve);
  if(buildTarget&&Math.random()<buildChance){
    p._lastBotEconomyTurn=G.turnCount;
    buyHouse(G.board.indexOf(buildTarget));
    glog('🤖 '+p.name+' investit sur '+buildTarget.n+'.','a');
    scheduleBotTurn();
    return true;
  }
  const unmortgageChance=Math.min(0.95,Math.max(0.05,(lvl==='hard'?0.62:(lvl==='medium'?0.35:0.15))+(persona.unmortgageBias||0)));
  const mortgaged=G.board.filter(cell=>cell&&cell.owner===p.id&&cell.mortgaged).sort((a,b)=>(a.p||0)-(b.p||0));
  const unmortgageTarget=mortgaged.find(cell=>p.money>=Math.floor((cell.p||0)*0.55)+reserve+40);
  if(unmortgageTarget&&Math.random()<unmortgageChance){
    p._lastBotEconomyTurn=G.turnCount;
    unmortgageProp(G.board.indexOf(unmortgageTarget));
    glog('🤖 '+p.name+' relève une hypothèque sur '+unmortgageTarget.n+'.','i');
    scheduleBotTurn();
    return true;
  }
  return false;
}

function scheduleBotTurn(){
  if(G.botActionTimer||!isCurrentPlayerBot())return;
  const p=G.players[G.cur];
  const lvl=p.botLevel||'easy';
  const delay=lvl==='hard'?450:(lvl==='medium'?800:1200);
  G.botActionTimer=setTimeout(()=>{
    G.botActionTimer=null;
    runBotTurn();
  },delay);
}

function runBotTurn(){
  if(!isCurrentPlayerBot())return;
  const p=G.players[G.cur];
  if(!p)return;
  if(G.pendingBuy&&G.pendingBuy.cell){
    if(botBuyDecision(p,G.pendingBuy.cell))confirmBuy();else declineBuy();
    return;
  }
  if(!G.rolled){
    if(tryBotEconomicAction(p))return;
    const mi=ensurePlayerMatchItems(p);
    const persona=(typeof getBotPersonaConfig==='function')?getBotPersonaConfig(p):{boostBias:0};
    const shouldBoost=(mi.diceBoost||0)>0&&((p.botLevel==='hard'&&Math.random()<Math.min(0.9,0.55+(persona.boostBias||0)))||(p.botLevel==='medium'&&Math.random()<Math.min(0.7,0.28+(persona.boostBias||0))));
    if(shouldBoost&&!G.pendingRollBoostFor){
      mi.diceBoost--;
      G.pendingRollBoostFor=p.id;
      glog('🤖 '+p.name+' prépare un booster de dé.','i');
      renderMatchItemsUi();
    }
    doRoll();
    return;
  }
  doNextTurn();
}

function showPlayerModal(playerId){
  const p=G.players.find(x=>x.id===playerId);
  if(!p)return;
  const revealItems=isProfileControlledPlayer(p);
  const owned=G.board.filter(c=>c.owner===p.id);
  const props=owned.filter(c=>c.type==='property');
  const rails=owned.filter(c=>c.type==='railroad');
  const utils=owned.filter(c=>c.type==='utility');
  const totalPropVal=owned.reduce((s,c)=>s+(c.p||0),0);
  const netWorth=p.money+totalPropVal;
  const cell=G.board[p.pos];
  const matchItems=ensurePlayerMatchItems(p);
  const title=document.getElementById('player-modal-title');
  const body=document.getElementById('player-modal-body');
  if(!title||!body)return;

  // Header: avatar + name + badges
  const avatarHtml=p.img
    ?`<img src="${p.img}" style="width:52px;height:52px;border-radius:50%;border:3px solid ${p.color};object-fit:cover;background:#fff;box-shadow:0 2px 8px #0006">`
    :`<div style="width:52px;height:52px;border-radius:50%;background:${p.color}22;border:3px solid ${p.color};display:flex;align-items:center;justify-content:center;font-size:1.8rem">${p.emoji}</div>`;
  const badges=[
    p.bust?'<span style="background:#ef444422;color:#ef4444;border:1px solid #ef444466;border-radius:4px;font-size:.65rem;padding:1px 5px">💀 Éliminé</span>':'',
    p.jailed?'<span style="background:#f9731622;color:#f97316;border:1px solid #f9731666;border-radius:4px;font-size:.65rem;padding:1px 5px">⛓️ En prison</span>':'',
    (p.jailCards||0)>0?'<span style="background:#a78bfa22;color:#a78bfa;border:1px solid #a78bfa66;border-radius:4px;font-size:.65rem;padding:1px 5px">🃏 ×'+p.jailCards+'</span>':''
  ].filter(Boolean).join(' ');
  title.innerHTML=`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
      ${avatarHtml}
      <div style="flex:1;min-width:0">
        <div style="font-size:1.05rem;font-weight:800;color:${p.color}">${p.name}</div>
        <div style="font-size:.7rem;color:var(--muted);margin-top:2px">${cell?cell.ico+' '+cell.n:'?'}</div>
        ${badges?'<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">'+badges+'</div>':''}
      </div>
    </div>`;
  body.innerHTML='';

  // Stats rapides
  const stats=document.createElement('div');
  stats.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px';
  stats.innerHTML=[
    {label:'💰 Argent',val:p.money+'$',accent:true},
    {label:'📊 Valeur nette',val:netWorth+'$',accent:false},
    {label:'🏠 Propriétés',val:owned.length,accent:false},
    {label:'🎴 Cartes prison',val:p.jailCards||0,accent:false}
  ].map(s=>`
    <div class="card" style="padding:8px 10px">
      <div style="font-size:.62rem;color:var(--muted);margin-bottom:2px">${s.label}</div>
      <div style="font-size:1rem;font-weight:800;${s.accent?'color:var(--accent)':''} ">${s.val}</div>
    </div>`).join('');
  body.appendChild(stats);

  const itemCard=document.createElement('div');
  itemCard.className='card';
  itemCard.style.padding='10px';
  itemCard.innerHTML=revealItems
    ?'<div class="card-title">🎒 Objets</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.72rem">'+
      '<div>⚡ Temp: <b>'+String(matchItems.diceBoost||0)+'</b></div>'+
      '<div>🛡️ Temp: <b>'+String(matchItems.antiJail||0)+'</b></div>'+
      '<div>🏦 Temp: <b>'+String(matchItems.mortgageDiscount||0)+'</b></div>'+
      '<div>🎒 Perso: <b>'+
        String((P.inventory?.diceBoost||0)+(P.inventory?.antiJail||0)+(P.inventory?.mortgageDiscount||0))+
      '</b></div>'+
      '</div>'
    :'<div class="card-title">🎒 Objets</div><div style="font-size:.72rem;color:var(--muted)">Objets cachés pour les autres joueurs.</div>';
  body.appendChild(itemCard);

  // Propriétés possédées
  const mkSection=(title2,items)=>{
    if(!items.length)return;
    const sec=document.createElement('div');
    sec.className='card';
    sec.style.padding='10px';
    sec.innerHTML='<div class="card-title">'+title2+'</div>'+items.map(c=>{
      const mortTag=c.mortgaged?'<span style="color:#f97316;font-size:.65rem">(HYPO)</span>':'';
      const houseTxt=(c.houses||0)>0?(c.houses>=5?' 🏨':' '+'🏠'.repeat(c.houses)):'';
      const colorDot=c.clr?`<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${c.clr};margin-right:4px;vertical-align:middle"></span>`:'';
      return `<div class="prop-row" style="border-bottom:1px solid var(--border);padding:4px 0">
        <span>${c.ico||''} ${colorDot}${c.n} ${mortTag}${houseTxt}</span>
        <span style="color:var(--muted);font-size:.72rem">${c.p||0}$</span>
      </div>`;
    }).join('');
    body.appendChild(sec);
  };

  if(!owned.length){
    const empty=document.createElement('div');
    empty.className='card';
    empty.style.cssText='padding:14px;text-align:center;color:var(--muted);font-size:.78rem';
    empty.textContent='Aucune propriété possédée.';
    body.appendChild(empty);
  }else{
    mkSection('🏙️ Terrains',props);
    mkSection('🚂 Gares',rails);
    mkSection('⚡ Services',utils);
  }

  openModal('modal-player');
}
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));

// ═══════════════════════════════════════
//  LOCAL GAME SETUP
// ═══════════════════════════════════════
function renderLocalPlayerList(){
  const list=document.getElementById('local-player-list');if(!list)return;
  const signature=JSON.stringify(G.players.map(p=>({id:p.id,name:p.name,color:p.color,emoji:p.emoji,img:!!p.img,bot:!!p.bot,botLevel:p.botLevel||'easy',ready:!!p.ready})));
  if(G.localPlayerListSignature!==signature){
    list.innerHTML='';
    const frag=document.createDocumentFragment();
    G.players.forEach((p,i)=>{
      if(p.bot)p.ready=true;
      const row=document.createElement('div');
    const bdrColor=p.ready?'#22c55e66':'var(--border)';
    row.style.cssText=`display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(13,21,37,.8);border-radius:10px;border:1px solid ${bdrColor};transition:.2s`;
    const avatarHtml=p.img
      ?`<img src="${p.img}" style="width:28px;height:28px;border-radius:999px;object-fit:cover;border:2px solid ${p.color}">`
      :`<div style="width:28px;height:28px;border-radius:999px;background:${p.color}33;border:2px solid ${p.color};display:flex;align-items:center;justify-content:center">${p.emoji}</div>`;
      const personaLabel=p.bot&&typeof getBotPersonaConfig==='function'?(' • '+getBotPersonaConfig(p).icon+' '+getBotPersonaConfig(p).label):'';
      row.innerHTML=`
        ${avatarHtml}
        <span style="flex:1;font-size:.78rem;font-weight:700;color:${p.color}">${p.name}${p.bot?(' 🤖 '+(p.botLevel||'easy')+personaLabel):''}</span>
        ${p.bot?'<span class="ready-pill rdy" style="cursor:default">✅ Prêt</span>':`<button class="ready-pill ${p.ready?'rdy':'not-rdy'}" onclick="toggleLocalReady(${i})">${p.ready?'\u2705 Pr\u00eat':'\u23f3 Pr\u00eat ?'}</button>`}
        <button class="btn btn-danger btn-xs" onclick="removeLocalPlayer(${i})">\u2715</button>`;
      frag.appendChild(row);
    });
    list.appendChild(frag);
    G.localPlayerListSignature=signature;
  }
  const allReady=G.players.length>=2&&G.players.every(p=>p.ready);
  const btn=document.getElementById('start-btn');
  btn.disabled=!allReady;
  btn.textContent=allReady?'\ud83d\ude80 D\u00e9marrer':'\u23f3 En attente des joueurs...';
}

function startQuickGame(){
  disconnectWs();
  const meId='p-'+Date.now();
  const me={
    id:meId,
    name:getProfileDefaultName('Joueur 1'),
    emoji:getProfileDefaultEmoji('🐱'),
    color:pickUniquePlayerColor(getProfileDefaultColor('#22c55e'),meId),
    img:getProfileDefaultAvatar(),
    matchItems:{diceBoost:0,antiJail:0,mortgageDiscount:0},
    money:G.startingMoney,
    pos:0,
    jailed:false,
    bust:false,
    jailCards:0,
    ready:true,
  };
  const botIdentity=pickRandomBotIdentity('Bot Rapide');
  const bot={
    id:'bot-'+Date.now(),
    name:botIdentity?.name||'Bot Rapide',
    emoji:botIdentity?.emoji||'🤖',
    color:pickUniquePlayerColor('#3b82f6','bot-quick'),
    img:null,
    bot:true,
    botLevel:'easy',
    botPersona:pickRandomBotPersona(),
    matchItems:{diceBoost:0,antiJail:0,mortgageDiscount:0},
    money:G.startingMoney,
    pos:0,
    jailed:false,
    bust:false,
    jailCards:0,
    ready:true,
  };
  G.mode='local';
  G.room='';
  G.myId=meId;
  G.players=[me,bot];
  enforceUniquePlayerColors();
  doStart();
}

function confirmAddLocal(){
  const identity=resolvePlayerIdentity('lc-name','lc-emoji','Joueur '+(G.players.length+1),EMOJIS[G.players.length%EMOJIS.length]);
  const emojiInput=document.getElementById('lc-emoji');
  const requestedColor=document.getElementById('lc-color').value||getProfileDefaultColor(COLORS[G.players.length%COLORS.length]);
  const color=pickUniquePlayerColor(requestedColor,null);
  const bot=document.getElementById('lc-bot-chk')?.checked||false;
  const botLevel=document.getElementById('lc-bot-level')?.value||'easy';
  const botIdentity=bot?pickRandomBotIdentity(''):null;
  const name=bot?(botIdentity?.name||identity.name):identity.name;
  const emoji=bot?(botIdentity?.emoji||'🤖'):identity.emoji;
  const img=bot?null:identity.img;
  if(G.players.length>=6){toast('Maximum 6 joueurs !','w');return;}
  G.players.push({
    id:'p'+Date.now()+Math.random(),
    name,emoji,color,img,
    bot,botLevel,botPersona:bot?pickRandomBotPersona():null,
    matchItems:{diceBoost:0,antiJail:0,mortgageDiscount:0},
    money:G.startingMoney,pos:0,
    jailed:false,bust:false,jailCards:0,ready:bot,
  });
  if(color.toLowerCase()!==String(requestedColor).toLowerCase()){
    toast('Couleur déjà prise, couleur aléatoire attribuée.','w');
  }
  document.getElementById('lc-name').value='';
  const botChk=document.getElementById('lc-bot-chk');if(botChk)botChk.checked=false;
  emojiInput.value='';
  emojiInput.removeAttribute('data-img');
  emojiInput.style.backgroundImage='';
  renderLocalPlayerList();
  closeModal('modal-add-local');
}

function removeLocalPlayer(i){
  G.players.splice(i,1);
  renderLocalPlayerList();
}

function toggleLocalReady(i){
  if(i<0||i>=G.players.length)return;
  if(G.players[i].bot){
    G.players[i].ready=true;
    renderLocalPlayerList();
    return;
  }
  G.players[i].ready=!G.players[i].ready;
  renderLocalPlayerList();
  if(G.players.length>=2&&G.players.every(p=>p.ready)){
    setTimeout(doStart,700);
  }
}

// ─── Online lobby (mode online pré-partie) ───
function renderOnlineLobby(){
  const lobby=document.getElementById('online-lobby');
  const pl=document.getElementById('online-lobby-players');
  const hostBtn=document.getElementById('host-start-btn');
  const hostPartyBtn=document.getElementById('host-party-btn');
  const readyBtn=document.getElementById('ready-me-btn');
  if(typeof syncPartyOptionsBlockVisibility==='function')syncPartyOptionsBlockVisibility();
  if(!lobby)return;
  const show=G.mode==='online'&&!G.started;
  lobby.style.display=show?'block':'none';
  if(!show){
    G.onlineLobbySignature='';
    return;
  }
  const lobbySignature=JSON.stringify({
    players:G.players.map(p=>({id:p.id,name:p.name,color:p.color,emoji:p.emoji,img:p.img,ready:!!p.ready})),
    myId:G.myId,
    myReady:!!G.myReady
  });
  if(pl&&G.onlineLobbySignature!==lobbySignature){
    pl.innerHTML=G.players.length?G.players.map(p=>`
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
        ${p.img?`<img src="${p.img}" style="width:22px;height:22px;border-radius:999px;object-fit:cover;border:2px solid ${p.color}">`:`<span style="font-size:.9rem">${p.emoji||'👤'}</span>`}
        <span style="flex:1;font-size:.75rem;font-weight:700;color:${p.color}">${p.name}${p.id===G.myId?' <span style="color:var(--muted);font-weight:400">(moi)</span>':''}</span>
        <span class="ready-pill ${p.ready?'rdy':'not-rdy'}" style="cursor:default">${p.ready?'✅ Prêt':'⏳ Attente'}</span>
      </div>`).join(''):'<div style="font-size:.72rem;color:var(--muted)">En attente de joueurs…</div>';
    G.onlineLobbySignature=lobbySignature;
  }
  const allReady=G.players.length>=2&&G.players.every(p=>p.ready);
  const isHost=G.myId&&G.myId.startsWith('h-');
  if(hostBtn){hostBtn.style.display=isHost?'inline-flex':'none';hostBtn.disabled=!allReady;}
  if(hostPartyBtn){
    hostPartyBtn.style.display=isHost?'inline-flex':'none';
    hostPartyBtn.disabled=!!G.started;
  }
  if(readyBtn){
    readyBtn.className='btn btn-sm '+(G.myReady?'btn-primary':'btn-secondary');
    readyBtn.textContent=G.myReady?'✅ Prêt !':'⏳ Je suis Prêt';
  }
}

function toggleOnlineReady(){
  G.myReady=!G.myReady;
  const me=G.players.find(p=>p.id===G.myId);
  if(me)me.ready=G.myReady;
  renderOnlineLobby();renderPlayers();
  if(G.ws&&G.wsOk){
    try{sendWsMessage({type:'ready',room:G.room,sender:G.myId,playerId:G.myId,name:me?.name,emoji:me?.emoji,color:me?.color,ready:G.myReady});}
    catch(e){wsLog('Erreur envoi prêt: '+e);}
  }
}

function doStart(){
  if(G.players.length<2){toast('Il faut au moins 2 joueurs !','w');return;}
  enforceUniquePlayerColors();
  G.board=clone(DEF);
  const starterIndex=(G.pendingRematch&&G.players.length)
    ?Math.max(0,Math.min(G.players.length-1,parseInt(G.rematchStarterIndex,10)||0))
    :0;
  G.cur=starterIndex;G.rolled=false;G.doublesCount=0;
  G.turnCount=1;
  G.parkingPot=0;
  G.bonusTurns={};
  G.pendingRollBoostFor=null;
  G.secretObjective=null;
  G.turnHistory=[];
  G.boardEvent=null;
  G.lastBoardEventTurn=0;
  clearTeamMode?.();
  if(G.botActionTimer){clearTimeout(G.botActionTimer);G.botActionTimer=null;}
  G.txns=[];G.undoStack=[];G.jailTurns={};
  G.pendingBuy=null;G.started=true;G.myReady=false;
  // Mobil defaults
  if(window.DEVICE==='mobile'){G.autoEnd=true;G.centerActions=true;}
  setBoardEditingLocked(true);
  G.players.forEach(p=>{
    p.pos=0;p.money=G.startingMoney;p.jailed=false;p.bust=false;p.jailCards=0;p.ready=false;
    p.matchItems={diceBoost:0,antiJail:0,mortgageDiscount:0};p.ghostPass=0;
    p.matchStats={propertiesBought:0,housesBuilt:0,passedGo:0,rentCollected:0,rentPaid:0,turnsPlayed:0};
    if(p.bot)ensureBotPersona(p);
  });
  setupTeamMode?.();
  document.getElementById('winner-overlay').classList.remove('open');
  const _ol=document.getElementById('online-lobby');if(_ol)_ol.style.display='none';
  closeModal('modal-local');
  showScreen('game');
  toggleMobileSidebar(true);
  buildBoard();renderPlayers();updBtns();
  glog(G.pendingRematch?'--- Revanche instantanée ! ---':'--- Partie démarrée ! ---','a');
  glog('--- Tour de '+G.players[G.cur].name+' ---','i');
  ensureMatchObjectiveExists(true);
  renderMatchObjectiveUi();
  renderTurnHistory();
  renderBoardEventUi?.();
  renderAlliancePanel?.();
  toast(G.pendingRematch?'🔁 Revanche prête !':'🚀 Partie démarrée !','a');
  if(G.mode==='online') document.getElementById('chat-card').style.display='block';
  if(G.timerEnabled)startTimer();
  startGlobalTimer();
  updateMusicForContext();
  P.stats.gamesPlayed++;
  saveProfileData();
  syncDailyChallengesProgress(true);
  syncWeeklyMissionsProgress(true);
  addSeasonProgress(8,'participation');
  renderLobbyProfileTab();
  G.pendingRematch=false;
}

function doReset(){
  if(!confirm('Réinitialiser la partie ?'))return;
  enforceUniquePlayerColors();
  G.board=clone(DEF);
  G.players.forEach(p=>{
    p.pos=0;p.money=G.startingMoney;p.jailed=false;p.bust=false;p.jailCards=0;p.matchItems={diceBoost:0,antiJail:0,mortgageDiscount:0};
    p.matchStats={propertiesBought:0,housesBuilt:0,passedGo:0,rentCollected:0,rentPaid:0,turnsPlayed:0};
    if(p.bot)ensureBotPersona(p);
  });
  G.cur=0;G.rolled=false;G.doublesCount=0;G.txns=[];G.undoStack=[];
  G.turnCount=1;
  G.parkingPot=0;
  G.bonusTurns={};
  G.pendingRollBoostFor=null;
  G.secretObjective=null;
  G.turnHistory=[];
  G.boardEvent=null;
  G.lastBoardEventTurn=0;
  clearTeamMode?.();
  if(G.botActionTimer){clearTimeout(G.botActionTimer);G.botActionTimer=null;}
  G.pendingBuy=null;G.jailTurns={};
  setupTeamMode?.();
  stopGlobalTimer();
  startGlobalTimer();
  updateMusicForContext();
  hideBuyBar();buildBoard();renderPlayers();updBtns();
  ensureMatchObjectiveExists(true);
  renderMatchObjectiveUi();
  renderTurnHistory();
  renderBoardEventUi?.();
  renderAlliancePanel?.();
  toast('🔄 Partie réinitialisée.','i');
}

function handleLeaveButtonClick(ev){
  if(ev&&typeof ev.stopPropagation==='function')ev.stopPropagation();
  confirmLeave();
  return false;
}

function confirmLeave(skipPrompt){
  if(skipPrompt===true||confirm('Quitter ce lobby et revenir au menu principal ?'))backToLobby();
}

function backToLobby(){
  G.started=false;stopTimer();stopGlobalTimer();
  if(G.botActionTimer){clearTimeout(G.botActionTimer);G.botActionTimer=null;}
  G.pendingRollBoostFor=null;
  G.pendingBuy=null;
  G.myReady=false;
  G.room='';
  G.mode='local';
  if(typeof syncPartyOptionsBlockVisibility==='function')syncPartyOptionsBlockVisibility();
  G.rolled=false;
  G.cur=0;
  G.turnCount=1;
  G.jailTurns={};
  G.bonusTurns={};
  G.secretObjective=null;
  G.turnHistory=[];
  G.boardEvent=null;
  G.lastBoardEventTurn=0;
  clearTeamMode?.();
  G.pendingRematch=false;
  G.pendingPartyBots=[];
  G.onlineLobbySignature='';
  G.playerPanelSignature='';
  setBoardEditingLocked(false);
  updateCenterActionsPopup();
  disconnectWs();
  G.board=clone(DEF);
  G.players=[];
  hideBuyBar();
  const winnerOverlay=document.getElementById('winner-overlay');
  if(winnerOverlay)winnerOverlay.classList.remove('open');
  const roomInfo=document.getElementById('room-info');
  if(roomInfo)roomInfo.textContent='Non connecté';
  const chatCard=document.getElementById('chat-card');
  if(chatCard)chatCard.style.display='none';
  const onlineLobby=document.getElementById('online-lobby');
  if(onlineLobby)onlineLobby.style.display='none';
  renderOnlineLobby();
  renderLocalPlayerList();
  renderPlayers();
  updBtns();
  showScreen('lobby');
  updateMusicForContext();
}

// ═══════════════════════════════════════
//  ONLINE / WEBSOCKET
// ═══════════════════════════════════════
function wsLog(msg){
  const el=document.getElementById('ws-log');
  const d=document.createElement('div');
  d.style.cssText='font-size:.65rem;color:var(--muted);padding:1px 0';
  d.textContent=new Date().toLocaleTimeString()+' '+msg;
  el.prepend(d);if(el.children.length>30)el.lastChild.remove();
}

function connectWs(url,room,onOpen){
  const requestedUrl=String(url||'').trim();
  const urls=getWsFallbackUrls(requestedUrl||getDefaultWsUrl());

  const startConnect=(index)=>{
    const candidate=urls[index]||requestedUrl;
    let opened=false;
    try{
      G.ws=new WebSocket(candidate);
    }catch(e){
      if(index+1<urls.length){
        wsLog('Bascule auto vers '+urls[index+1]);
        startConnect(index+1);
        return;
      }
      toast('Erreur connexion WS','d');
      wsLog('Erreur: '+e);
      return;
    }
    G.ws.onopen=()=>{
      opened=true;
      G.wsOk=true;
      if(typeof rememberRenderOrigin==='function')rememberRenderOrigin(wsUrlToHttpBase(candidate));
      document.getElementById('ws-dot').style.background='var(--accent)';
      document.getElementById('ws-label').textContent='En ligne';
      document.getElementById('disc-btn').disabled=false;
      wsLog('Connecté à '+candidate);
      if(onOpen)onOpen();
    };
    G.ws.onmessage=e=>{
      try{
        const msg=JSON.parse(e.data);
        if(msg.type==='error'&&msg.code==='ROOM_NOT_FOUND'){
          toast('Salle introuvable.','d');
          wsLog('Salle introuvable: '+(msg.room||'?'));
          disconnectWs();
          showScreen('lobby');
          return;
        }
        if(msg.type==='error'&&msg.code==='ROOM_FULL'){
          toast('Salle pleine.','d');
          wsLog('Salle pleine: '+(msg.room||'?'));
          disconnectWs();
          showScreen('lobby');
          return;
        }
        if(msg.type==='error'&&msg.code==='ROOM_BAD_PASSWORD'){
          toast('Mot de passe de salle invalide.','d');
          wsLog('Mot de passe invalide pour: '+(msg.room||'?'));
          disconnectWs();
          showScreen('lobby');
          return;
        }
        if(msg.room!==G.room)return;
        if(msg.type==='state'&&msg.sender!==G.myId){
          G.players=msg.state.players;
          G.board=msg.state.board;
          G.cur=msg.state.cur;
          G.started=!!msg.state.started;
          G.rolled=msg.state.rolled;
          G.jailTurns=msg.state.jailTurns||{};
          if(G.started) document.getElementById('chat-card').style.display='block';
          buildBoard();renderPlayers();updBtns();renderOnlineLobby();
          wsLog('État reçu de '+msg.sender);
        }
        if(msg.type==='ready'&&msg.sender!==G.myId){
          const rp=G.players.find(x=>x.id===msg.playerId);
          if(rp){rp.ready=msg.ready;}
          else{
            const netColor=pickUniquePlayerColor(msg.color||'#888',msg.playerId);
            G.players.push({id:msg.playerId,name:msg.name||'?',emoji:msg.emoji||'👤',color:netColor,img:null,matchItems:{diceBoost:0,antiJail:0,mortgageDiscount:0},money:G.startingMoney,pos:0,jailed:false,bust:false,jailCards:0,ready:msg.ready});
          }
          enforceUniquePlayerColors();
          renderOnlineLobby();renderPlayers();
          wsLog((msg.ready?'✅':'⏳')+' Prêt: '+(msg.name||msg.playerId));
        }
        if(msg.type==='state_request'&&msg.sender!==G.myId){
          const isHost=G.myId&&String(G.myId).startsWith('h-');
          if(isHost) broadcast();
        }
        if(msg.type==='trade_offer'&&msg.sender!==G.myId&&msg.targetId===G.myId){
          showIncomingTradeRequest(msg.offer,msg.senderName||msg.sender);
        }
        if(msg.type==='trade_response'&&msg.sender!==G.myId&&msg.targetId===G.myId){
          handleIncomingTradeResponse(msg);
        }
        if(msg.type==='trade_cancel'&&msg.sender!==G.myId&&msg.targetId===G.myId){
          if(NET_TRADE.incoming&&NET_TRADE.incoming.id===msg.offerId){
            if(NET_TRADE.incomingTimer){clearTimeout(NET_TRADE.incomingTimer);NET_TRADE.incomingTimer=null;}
            NET_TRADE.incoming=null;
            closeModal('modal-trade-request');
            toast('❌ '+(msg.senderName||'Le joueur')+' a annulé la demande.','w');
          }
        }
        if(msg.type==='chat'&&msg.sender!==G.myId){
          addChatMsg(msg.name,msg.color,msg.text,{uid:msg.uid||null,admin:!!msg.admin,emoji:msg.emoji||'',avatarImg:msg.avatarImg||null,elo:msg.elo,rankLabel:msg.rankLabel||'',rankClass:msg.rankClass||'',titleLabel:msg.titleLabel||'',gamesWon:msg.gamesWon,gamesPlayed:msg.gamesPlayed,gamesLost:msg.gamesLost,propertiesBought:msg.propertiesBought,moneyEarned:msg.moneyEarned,titlesCount:msg.titlesCount,emojiCount:msg.emojiCount,profilePrivate:!!msg.profilePrivate});
        }
      }catch(err){wsLog('Erreur parse: '+err);}
    };
    G.ws.onerror=()=>{
      if(!opened&&index+1<urls.length){
        wsLog('Erreur WebSocket, tentative '+urls[index+1]);
      }else{
        wsLog('Erreur WebSocket.');
      }
    };
    G.ws.onclose=()=>{
      G.wsOk=false;
      G.ws=null;
      document.getElementById('ws-dot').style.background='#6b7280';
      document.getElementById('ws-label').textContent='Hors ligne';
      document.getElementById('disc-btn').disabled=true;
      if(!opened&&index+1<urls.length){
        wsLog('Déconnecté, bascule auto vers '+urls[index+1]);
        startConnect(index+1);
        return;
      }
      wsLog('Déconnecté.');
    };
  };

  const prep=(typeof ensurePreferredRenderOrigin==='function'&&isRenderWsUrl(requestedUrl))
    ?ensurePreferredRenderOrigin(false)
    :Promise.resolve('');
  Promise.resolve(prep).catch(()=>{}).finally(()=>startConnect(0));
}

function broadcast(){
  if(!G.ws||!G.wsOk)return;
  const msg=JSON.stringify({
    type:'state',room:G.room,sender:G.myId,
    state:{players:G.players,board:G.board,cur:G.cur,started:G.started,rolled:G.rolled,jailTurns:G.jailTurns}
  });
  try{G.ws.send(msg);}catch(e){wsLog('Erreur envoi: '+e);}
}

function disconnectWs(){
  const ws=G.ws;
  G.ws=null;
  G.wsOk=false;
  if(ws){
    try{ws.onopen=null;ws.onmessage=null;ws.onerror=null;ws.onclose=null;}catch(_e){}
    try{if(ws.readyState<=WebSocket.OPEN)ws.close();}catch(_e){}
  }
  const wsDot=document.getElementById('ws-dot');
  if(wsDot)wsDot.style.background='#6b7280';
  const wsLabel=document.getElementById('ws-label');
  if(wsLabel)wsLabel.textContent=G.room?'Hors ligne':'Local';
  const discBtn=document.getElementById('disc-btn');
  if(discBtn)discBtn.disabled=true;
}

function createOnlineRoom(){
  const identity=resolvePlayerIdentity('cr-name','cr-emoji','Joueur','🐱');
  const emojiInput=document.getElementById('cr-emoji');
  const name=identity.name;
  const emoji=identity.emoji;
  const img=identity.img;
  const color=pickUniquePlayerColor(document.getElementById('cr-color').value||getProfileDefaultColor('#22c55e'),null);
  const wsUrl=document.getElementById('cr-ws').value.trim();
  const hostPrivate=!!document.getElementById('cr-private')?.checked;
  const hostPass=String(document.getElementById('cr-pass')?.value||'').trim();
  const roomId=document.getElementById('cr-room').value.trim()||
    'room-'+Math.random().toString(36).slice(2,8);
  if(hostPass&&hostPass.length<4){toast('Mot de passe trop court (min 4).','w');return;}
  const totalPlayers=1+(G.pendingPartyBots?.length||0);
  if(totalPlayers>ONLINE_ROOM_MAX_PLAYERS){toast('Trop de joueurs configurés pour une salle online ('+totalPlayers+'/'+ONLINE_ROOM_MAX_PLAYERS+').','d');return;}
  G.room=roomId;G.mode='online';
  G.myId='h-'+Date.now();
  const host={id:G.myId,name,emoji,color,img,matchItems:{diceBoost:0,antiJail:0,mortgageDiscount:0},money:G.startingMoney,pos:0,jailed:false,bust:false,jailCards:0,ready:false};
  const bots=(G.pendingPartyBots||[]).map((b,ix)=>{
    const botIdentity=pickRandomBotIdentity(b.name);
    return {
    id:b.id||('bot-net-'+Date.now().toString(36)+ix),
    name:botIdentity.name||('Bot '+(ix+1)),
    emoji:b.emoji||botIdentity.emoji,
    color:pickUniquePlayerColor(b.color||COLORS[(ix+1)%COLORS.length],b.id),
    img:null,bot:true,botLevel:b.botLevel||'easy',botPersona:b.botPersona||pickRandomBotPersona(),
    matchItems:{diceBoost:0,antiJail:0,mortgageDiscount:0},money:G.startingMoney,pos:0,jailed:false,bust:false,jailCards:0,ready:true,
  };});
  G.players=[host,...bots];
  enforceUniquePlayerColors();
  refreshInviteLink();
  document.getElementById('room-info').textContent='Salle: '+roomId+' (hôte)';
  document.getElementById('chat-card').style.display='block';
  closeModal('modal-create');
  connectWs(wsUrl,roomId,()=>{
    sendWsMessage({type:'create_room',room:roomId,sender:G.myId,playerId:G.myId,name,hostName:name,hostEmoji:emoji,isPrivate:hostPrivate||!!hostPass,roomPassword:hostPass,playerCount:G.players.length,started:false});
    announceOnlinePresence();
    toast('Salle créée: '+roomId,'a');
    wsLog('Salle créée: '+roomId);
  });
  const passInput=document.getElementById('cr-pass');
  if(passInput) passInput.value='';
  const privateChk=document.getElementById('cr-private');
  if(privateChk) privateChk.checked=false;
  emojiInput.value='';
  emojiInput.removeAttribute('data-img');
  emojiInput.style.backgroundImage='';
  renderLocalPlayerList();
  showScreen('game');
  toggleMobileSidebar(true);
  buildBoard();renderPlayers();updBtns();
}

async function joinOnlineRoom(roomOverride,roomPasswordOverride){
  const identity=resolvePlayerIdentity('jn-name','jn-emoji','Joueur','🐶');
  const emojiInput=document.getElementById('jn-emoji');
  const name=identity.name;
  const emoji=identity.emoji;
  const img=identity.img;
  const color=pickUniquePlayerColor(document.getElementById('jn-color').value||getProfileDefaultColor('#3b82f6'),null);
  const wsUrl=document.getElementById('jn-ws').value.trim();
  const roomId=(roomOverride||document.getElementById('jn-room').value).trim();
  const roomPassword=String(roomPasswordOverride===undefined?(document.getElementById('jn-pass')?.value||''):roomPasswordOverride).trim();
  if(!roomId){toast('Entre un code de salle !','w');return;}
  if(!wsUrl){toast('Entre une URL WebSocket !','w');setJoinRoomStatus('Entre une URL WebSocket valide.','d');return;}

  setJoinRoomStatus('Vérification de la salle '+roomId+'…','i');
  let probe;
  try{
    probe=await requestWsServer(wsUrl,{type:'join_probe',room:roomId,password:roomPassword},'join_probe_result');
  }catch(err){
    toast('Impossible de joindre le serveur de salons.','d');
    setJoinRoomStatus('Impossible de vérifier le code de salle.','d');
    return;
  }
  if(!probe.ok){
    if(probe.error==='ROOM_FULL'){
      toast('Cette salle est pleine.','d');
      setJoinRoomStatus('La salle '+roomId+' est pleine.','d');
      return;
    }
    if(probe.error==='ROOM_BAD_PASSWORD'){
      toast('Mot de passe incorrect.','d');
      setJoinRoomStatus('Mot de passe incorrect pour la salle '+roomId+'.','d');
      switchJoinMode('direct');
      document.getElementById('jn-room').value=roomId;
      return;
    }
    toast('Aucune salle ne correspond à ce code.','d');
    setJoinRoomStatus('Aucune salle ne correspond au code '+roomId+'.','d');
    switchJoinMode('direct');
    document.getElementById('jn-room').value=roomId;
    return;
  }

  G.room=roomId;G.mode='online';
  G.myId='j-'+Date.now();
  G.players=[{id:G.myId,name,emoji,color,img,matchItems:{diceBoost:0,antiJail:0,mortgageDiscount:0},money:G.startingMoney,pos:0,jailed:false,bust:false,jailCards:0,ready:false}];
  refreshInviteLink();
  document.getElementById('room-info').textContent='Salle: '+roomId+' (invité)';
  document.getElementById('chat-card').style.display='block';
  closeModal('modal-join');
  connectWs(wsUrl,roomId,()=>{
    announceOnlinePresence(roomPassword);
    toast('Rejoint: '+roomId,'a');
    wsLog('Rejoint la salle: '+roomId);
    sendWsMessage({type:'state_request',room:roomId,sender:G.myId});
  });
  const joinPass=document.getElementById('jn-pass');
  if(joinPass) joinPass.value='';
  emojiInput.value='';
  emojiInput.removeAttribute('data-img');
  emojiInput.style.backgroundImage='';
  showScreen('game');
  toggleMobileSidebar(true);
  buildBoard();renderPlayers();updBtns();
}

// ═══════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════
function sendChat(){
  const input=document.getElementById('chat-input');
  const text=(input?.value||'').trim();if(!text)return;
  const p=G.players.find(p=>p.id===G.myId)||G.players[G.cur];
  if(!p)return;
  input.value='';
  const chatProfile=getSharedChatProfilePayload({
    uid:P.uid,
    name:p.name,
    color:p.color,
    emoji:P.emoji,
    avatarImg:P.avatarImg,
    isAdmin:P.isAdmin,
    elo:P.elo,
    stats:P.stats,
    selectedTitle:P.selectedTitle,
    titles:P.titles,
    titleLabel:getActiveProfileTitleLabel(P)
  });
  addChatMsg(p.name,p.color,text,chatProfile);
  if(G.ws&&G.wsOk){
    try{sendWsMessage(Object.assign({type:'chat',room:G.room,sender:G.myId,text},chatProfile));}
    catch(e){}
  }
}

function addChatMsg(name,color,text,meta){
  const log=document.getElementById('chat-log');
  if(!log)return;
  const extra=meta&&typeof meta==='object'?meta:{};
  const uid=normalizeProfileUid(extra.uid);
  const muted=isLocallyMutedUid(uid);
  const blocked=isLocallyBlockedUid(uid);
  const el=document.createElement('div');
  el.style.cssText='font-size:.7rem;padding:2px 0;border-bottom:1px solid rgba(148,163,184,.06)';
  const sp=document.createElement('span');
  sp.style.cssText='color:'+safeCssColor(color,'#22c55e')+';font-weight:700';
  sp.textContent=(extra.admin?'👑 ':'')+String(name||'Joueur')+':';
  sp.classList.add('chat-user-link');
  sp.title='Cliquer pour ouvrir le profil';
  sp.addEventListener('click',ev=>openChatUserMenu(ev,{
    uid,
    name:name||'Joueur',
    color,
    admin:!!extra.admin,
    emoji:extra.emoji||'',
    avatarImg:extra.avatarImg||null,
    elo:extra.elo,
    rankLabel:extra.rankLabel||'',
    rankClass:extra.rankClass||'',
    titleLabel:extra.titleLabel||'',
    gamesWon:extra.gamesWon,
    gamesPlayed:extra.gamesPlayed,
    gamesLost:extra.gamesLost,
    propertiesBought:extra.propertiesBought,
    moneyEarned:extra.moneyEarned,
    titlesCount:extra.titlesCount,
    emojiCount:extra.emojiCount,
    profilePrivate:!!extra.profilePrivate
  }));
  el.appendChild(sp);
  el.appendChild(document.createTextNode(' '+(blocked?'🚫 message masqué':(muted?'🔇 message masqué':String(text||'')))));
  log.appendChild(el);
  log.scrollTop=log.scrollHeight;
}

// ═══════════════════════════════════════
//  CELL EDITOR
// ═══════════════════════════════════════
const SWATCH_COLORS=['#8b5cf6','#22c55e','#f97316','#ef4444','#f43f5e','#3b82f6',
  '#84cc16','#d4d4d4','#facc15','#ec4899','#06b6d4','#a855f7'];

function buildSwatches(){
  const row=document.getElementById('c-swatches');if(!row)return;
  row.innerHTML='';
  SWATCH_COLORS.forEach(col=>{
    const s=document.createElement('div');s.className='color-swatch';
    s.style.background=col;s.dataset.color=col;
    s.onclick=()=>{
      if(G.started){toast('Modification des cases verrouillée pendant la partie.','w');return;}
      row.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('sel'));
      s.classList.add('sel');
      updateCellPrev();
    };
    row.appendChild(s);
  });
}

function setBoardEditingLocked(locked){
  const lockEl=document.getElementById('board-edit-lock');
  if(lockEl)lockEl.style.display=locked?'block':'none';

  ['cell-sel','c-name','c-type','c-icon','c-price','c-rent','board-json'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.disabled=locked;
  });

  ['btn-apply-cell','btn-reset-cell','btn-import-board','btn-reset-board'].forEach(id=>{
    const btn=document.getElementById(id);
    if(btn)btn.disabled=locked;
  });

  const sw=document.getElementById('c-swatches');
  if(sw){
    sw.style.pointerEvents=locked?'none':'auto';
    sw.style.opacity=locked?'.5':'1';
  }
}

function populateCellSel(){
  const sel=document.getElementById('cell-sel');if(!sel)return;sel.innerHTML='';
  G.board.forEach((c,i)=>{
    const o=document.createElement('option');o.value=i;
    o.textContent=i+' — '+c.ico+' '+c.n;sel.appendChild(o);
  });
}

function loadCellEditor(){
  const idx=parseInt(document.getElementById('cell-sel').value,10);
  const cell=G.board[idx];if(!cell)return;
  document.getElementById('c-name').value=cell.n;
  document.getElementById('c-type').value=cell.t;
  document.getElementById('c-icon').value=cell.ico||'';
  document.getElementById('c-price').value=cell.p||0;
  document.getElementById('c-rent').value=cell.r||0;
  document.getElementById('c-swatches').querySelectorAll('.color-swatch')
    .forEach(s=>s.classList.toggle('sel',s.dataset.color===cell.c));
  updateCellPrev();
}

function updateCellPrev(){
  const n=document.getElementById('c-name').value;
  const ico=document.getElementById('c-icon').value;
  const p=document.getElementById('c-price').value;
  const sel=document.getElementById('c-swatches')?.querySelector('.color-swatch.sel');
  const col=sel?sel.dataset.color:'#22c55e';
  document.getElementById('cp-strip').style.background=col;
  document.getElementById('cp-icon').textContent=ico||'🏠';
  document.getElementById('cp-name').textContent=n||'NOM';
  document.getElementById('cp-price').textContent=p>0?p+'$':'';
}

function applyCell(){
  if(G.started){toast('Modification des cases verrouillée pendant la partie.','w');return;}
  const idx=parseInt(document.getElementById('cell-sel').value,10);
  const cell=G.board[idx];if(!cell)return;
  cell.n=document.getElementById('c-name').value||cell.n;
  cell.t=document.getElementById('c-type').value;
  cell.ico=document.getElementById('c-icon').value;
  cell.p=parseInt(document.getElementById('c-price').value||0);
  cell.r=parseInt(document.getElementById('c-rent').value||0);
  const sel=document.getElementById('c-swatches')?.querySelector('.color-swatch.sel');
  if(sel)cell.c=sel.dataset.color;
  buildBoard();populateCellSel();
  document.getElementById('cell-sel').value=idx;
  loadCellEditor();
  glog('Case '+idx+' ('+cell.n+') mise à jour.','a');
  toast('Case "'+cell.n+'" modifiée !','a');
  broadcast();
}

function resetCell(){
  if(G.started){toast('Modification des cases verrouillée pendant la partie.','w');return;}
  const idx=parseInt(document.getElementById('cell-sel').value,10);
  G.board[idx]=clone(DEF[idx]);
  buildBoard();populateCellSel();
  document.getElementById('cell-sel').value=idx;
  loadCellEditor();
  toast('Case '+idx+' réinitialisée.','i');
}

function exportJson(){
  document.getElementById('board-json').value=JSON.stringify(G.board,null,2);
}

function importJson(){
  if(G.started){toast('Modification des cases verrouillée pendant la partie.','w');return;}
  try{
    const data=JSON.parse(document.getElementById('board-json').value);
    if(!Array.isArray(data)||data.length!==40)throw new Error('40 cases requises');
    G.board=data;buildBoard();populateCellSel();loadCellEditor();
    toast('Plateau importé !','a');
  }catch(e){toast('JSON invalide: '+e.message,'d');}
}

function resetBoard(){
  if(G.started){toast('Modification des cases verrouillée pendant la partie.','w');return;}
  if(!confirm('Réinitialiser tout le plateau ?'))return;
  G.board=clone(DEF);buildBoard();populateCellSel();loadCellEditor();
  toast('Plateau réinitialisé.','i');
}

function onCellClick(idx){
  document.querySelectorAll('.cell').forEach(c=>c.classList.remove('selected'));
  const el=document.querySelector('.cell[data-idx="'+idx+'"]');
  if(el)el.classList.add('selected');
  const cell=G.board[idx];
  if(G.started&&cell&&['property','railroad','utility'].includes(cell.t)){
    showPropModal(idx);return;
  }
  document.getElementById('cell-sel').value=idx;
  loadCellEditor();switchTab('custom-tab');
}

// ═══════════════════════════════════════
//  PROP MODAL
// ═══════════════════════════════════════
function showPropModal(cellIdx){
  const cell=G.board[cellIdx];if(!cell)return;
  const owner=G.players.find(p=>p.id===cell.owner);
  const curP=G.players[G.cur];
  const isMine=cell.owner===curP?.id;
  document.getElementById('prop-title').textContent=(cell.ico||'🏠')+' '+cell.n;
  const body=document.getElementById('prop-body');
  const rent=calcRent(cell);
  body.innerHTML=`
    <div class="prop-row"><span class="prop-label">Type</span><span style="text-transform:capitalize">${cell.t}</span></div>
    <div class="prop-row"><span class="prop-label">💰 Prix</span><span>${cell.p||0}$</span></div>
    <div class="prop-row"><span class="prop-label">💸 Loyer actuel</span><span style="color:var(--accent);font-weight:700">${rent}$</span></div>
    <div class="prop-row"><span class="prop-label">🏠 Constructions</span><span>${(cell.houses||0)>=5?'🏨 Hôtel':'🏠'.repeat(cell.houses||0)||'—'}</span></div>
    <div class="prop-row"><span class="prop-label">👤 Propriétaire</span><span>${owner?owner.emoji+' '+owner.name:'Libre'}</span></div>
    ${cell.mortgaged?'<div class="prop-row"><span class="prop-label" style="color:#f97316">⚠️ Hypothéquée</span><span style="color:#f97316">Loyer suspendu</span></div>':''}`;
  const actEl=document.getElementById('prop-actions');actEl.innerHTML='';
  if(isMine&&cell.t==='property'&&!cell.mortgaged&&(cell.houses||0)<5){
    const cost=Math.floor(cell.p*.5);
    const b=document.createElement('button');b.className='btn btn-primary btn-sm';
    b.textContent='🏗️ Construire ('+cost+'$)';
    b.onclick=()=>{buyHouse(cellIdx);closeModal('modal-prop');};
    actEl.appendChild(b);
  }
  if(isMine&&(cell.houses||0)>0){
    const b=document.createElement('button');b.className='btn btn-yellow btn-sm';
    b.textContent='🔨 Vendre maison';
    b.onclick=()=>{sellHouse(cellIdx);closeModal('modal-prop');};
    actEl.appendChild(b);
  }
  if(isMine&&['property','railroad','utility'].includes(cell.t)){
    const val=Math.floor(cell.p*.5),cost=Math.floor(cell.p*.55);
    const b=document.createElement('button');b.className='btn btn-secondary btn-sm';
    b.textContent=cell.mortgaged?'📤 Lever ('+cost+'$)':'📥 Hypothéquer (+'+val+'$)';
    b.onclick=()=>{
      if(cell.mortgaged)unmortgageProp(cellIdx);else mortgageProp(cellIdx);
      closeModal('modal-prop');
    };
    actEl.appendChild(b);
  }
  const bc=document.createElement('button');bc.className='btn btn-secondary btn-sm';
  bc.textContent='Fermer';bc.onclick=()=>closeModal('modal-prop');
  actEl.appendChild(bc);
  openModal('modal-prop');
}

// ═══════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  switch(e.key){
    case 'r':case 'R':if(!document.getElementById('roll-btn').disabled)doRoll();break;
    case 'Enter':if(!document.getElementById('end-btn').disabled)doNextTurn();break;
    case 'Escape':document.querySelectorAll('.modal-bg.open,#shop-modal-bg.open').forEach(m=>m.classList.remove('open'));updateCenterActionsPopup();break;
  }
});

// ═══════════════════════════════════════
//  INIT
// ═══════════════════════════════════════
G.board=clone(DEF);
buildSwatches();
populateCellSel();
buildBoard();
renderPlayers();
updBtns();
setBoardEditingLocked(false);
updateCenterActionsPopup();
loadAudioPrefs();
renderLobbyVictoryStars();
setToastDuration(document.getElementById('notif-dur')?.value||4);
setAutoEnd(document.getElementById('auto-end-chk')?.checked||false);
setTimerDuration(document.getElementById('timer-dur')?.value||60);
setTimerEnabled(document.getElementById('timer-chk')?.checked||false);
setCenterActionsEnabled(document.getElementById('center-actions-chk')?.checked||false);
setCenterActionsScale(document.getElementById('center-actions-size')?.value||100);
setGameZoom(document.getElementById('game-zoom')?.value||100);
setCenterDiceScale(document.getElementById('center-dice-size')?.value||130);
setPawnScale(document.getElementById('pawn-size')?.value||60);
setPawnGlow(document.getElementById('pawn-glow-chk')?.checked??true);
setStreamerMode(document.getElementById('streamer-chk')?.checked||false);
setMusicSource(document.getElementById('music-source')?.value||G.musicSource);
setMusicEnabled(G.musicEnabled);
setSoundMuted(G.soundMuted);
setMusicVolume(G.musicVolume);
setMusicBoostEnabled(G.musicBoostEnabled);
setMusicBoostPercent(G.musicBoostPercent);
setSfxVolume(G.sfxVolume);
setVisualFxEnabled(G.visualFxEnabled);
refreshPartyRuleUi();
refreshAdvancedStats();
refreshInviteLink();
applyInviteFromUrl();

window.addEventListener('pointerdown',unlockAudio,{passive:true});
window.addEventListener('keydown',unlockAudio,{passive:true});

// HTML additions needed in custom-tab for cell editor preview & JSON export:
// Make sure these elements exist in the HTML (add after swatches div):
// <div class="cell-preview"><div id="cp-strip"></div><div id="cp-icon"></div>
// <div id="cp-name"></div><div id="cp-price"></div></div>
// <div class="btn-row" style="margin-top:8px">
//   <button class="btn btn-primary btn-sm" onclick="applyCell()">✅ Appliquer</button>
//   <button class="btn btn-danger btn-sm" onclick="resetCell()">🔄 Reset</button>
// </div>
// And the JSON export card below.

