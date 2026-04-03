function copyFriendCode(){
  navigator.clipboard?.writeText(P.uid).then(()=>toast('📋 Code copié !','i')).catch(()=>{});
}

function normalizeProfileUid(uid){
  return String(uid||'').trim();
}

function hasFriendUid(uid){
  const key=normalizeProfileUid(uid);
  return !!(key&&Array.isArray(P.friends)&&P.friends.some(f=>normalizeProfileUid(f.uid)===key));
}

function isLocallyMutedUid(uid){
  const key=normalizeProfileUid(uid);
  return !!(key&&Array.isArray(P.mutedUsers)&&P.mutedUsers.includes(key));
}

function isLocallyBlockedUid(uid){
  const key=normalizeProfileUid(uid);
  return !!(key&&Array.isArray(P.blockedUsers)&&P.blockedUsers.includes(key));
}

function setLocalUidMembership(listKey,uid,enabled){
  const key=normalizeProfileUid(uid);
  if(!key||key===P.uid)return false;
  if(!Array.isArray(P[listKey]))P[listKey]=[];
  if(enabled){
    if(!P[listKey].includes(key))P[listKey].push(key);
  }else{
    P[listKey]=P[listKey].filter(v=>v!==key);
  }
  return true;
}

function addFriendFromProfile(profile,opts){
  const options=opts&&typeof opts==='object'?opts:{};
  const msg=document.getElementById('add-friend-msg');
  const uid=normalizeProfileUid(profile&&profile.uid);
  const name=String(profile&&profile.name||'Ami').trim()||'Ami';
  if(!uid){
    if(msg&&!options.silent){msg.style.color='var(--red)';msg.textContent='UID ami introuvable.';}
    return false;
  }
  if(uid===P.uid){
    if(msg&&!options.silent){msg.style.color='var(--red)';msg.textContent="Tu ne peux pas t'ajouter toi-même.";}
    return false;
  }
  if(isLocallyBlockedUid(uid)){
    if(msg&&!options.silent){msg.style.color='var(--yellow)';msg.textContent="Débloque ce joueur avant de l'ajouter.";}
    toast("🚫 Débloque ce joueur avant de l'ajouter en ami",'w');
    return false;
  }
  const safeColor=safeCssColor(profile&&profile.color,'#6b7280');
  const existing=P.friends.find(f=>normalizeProfileUid(f.uid)===uid);
  const payload={
    uid,
    name,
    emoji:String(profile&&profile.emoji||existing&&existing.emoji||'👤'),
    avatarImg:(profile&&profile.avatarImg)||(existing&&existing.avatarImg)||null,
    color:safeColor,
    elo:Math.max(0,parseInt(profile&&profile.elo,10)||parseInt(existing&&existing.elo,10)||0),
    rankLabel:String(profile&&profile.rankLabel||existing&&existing.rankLabel||''),
    titleLabel:String(profile&&profile.titleLabel||existing&&existing.titleLabel||''),
    gamesWon:Math.max(0,parseInt(profile&&profile.gamesWon,10)||parseInt(existing&&existing.gamesWon,10)||0),
    gamesPlayed:Math.max(0,parseInt(profile&&profile.gamesPlayed,10)||parseInt(existing&&existing.gamesPlayed,10)||0),
    gamesLost:Math.max(0,parseInt(profile&&profile.gamesLost,10)||parseInt(profile?.stats?.gamesLost,10)||parseInt(existing&&existing.gamesLost,10)||0),
    propertiesBought:Math.max(0,parseInt(profile&&profile.propertiesBought,10)||parseInt(profile?.stats?.propertiesBought,10)||parseInt(existing&&existing.propertiesBought,10)||0),
    moneyEarned:Math.max(0,parseInt(profile&&profile.moneyEarned,10)||parseInt(profile?.stats?.moneyEarned,10)||parseInt(existing&&existing.moneyEarned,10)||0),
    titlesCount:Math.max(0,parseInt(profile&&profile.titlesCount,10)||parseInt(existing&&existing.titlesCount,10)||0),
    emojiCount:Math.max(1,parseInt(profile&&profile.emojiCount,10)||parseInt(existing&&existing.emojiCount,10)||1),
    profilePrivate:!!(profile&&profile.profilePrivate),
    addedAt:(existing&&existing.addedAt)||Date.now()
  };
  if(existing){
    Object.assign(existing,payload);
    saveProfileData();renderFriendsList();
    if(msg&&!options.silent){msg.style.color='var(--yellow)';msg.textContent='Cet ami est déjà dans ta liste.';}
    return false;
  }
  P.friends.push(payload);
  saveProfileData();renderFriendsList();
  if(msg&&!options.silent){msg.style.color='var(--accent)';msg.textContent='✅ Ami ajouté !';}
  toast('👫 Ami ajouté !','a');
  return true;
}

function getActiveProfileTitleLabel(profile){
  const source=profile&&typeof profile==='object'?profile:P;
  if(source&&source.titleLabel)return String(source.titleLabel||'');
  if(Array.isArray(source?.titles)&&source.titles.includes('winner_looser'))return '🏅 Winner Looser';
  const key=source&&source.selectedTitle;
  if(key&&typeof TITLE_DEFS!=='undefined'&&TITLE_DEFS[key])return String(TITLE_DEFS[key].label||'');
  return '';
}

function isChatProfilePrivate(profile){
  const source=profile&&typeof profile==='object'?profile:P;
  return !!(source&&(source.profilePrivate||source.chatProfilePrivate));
}

function toggleOwnChatProfilePrivacy(){
  if(!P.isAdmin){
    toast('Option réservée aux admins','d');
    return;
  }
  P.chatProfilePrivate=!isChatProfilePrivate(P);
  saveProfileData();
  renderSocialChat();
  closeChatUserMenu();
  toast(P.chatProfilePrivate?'🙈 Profil admin passé en privé':'🌐 Profil admin rendu public','i');
}

function getSharedChatProfilePayload(sourceProfile){
  const source=sourceProfile&&typeof sourceProfile==='object'?sourceProfile:P;
  const stats=source&&typeof source.stats==='object'&&source.stats?source.stats:{};
  const elo=Math.max(0,parseInt(source&&source.elo,10)||0);
  const rank=(typeof getEloRankInfo==='function')?getEloRankInfo(elo):{label:'— Non Rankée',cls:'er-unranked'};
  const admin=!!(source&&source.admin)||!!(source&&source.isAdmin);
  const profilePrivate=!!(admin&&isChatProfilePrivate(source));
  const base={
    uid:normalizeProfileUid(source&&source.uid||P.uid),
    name:String(source&&source.name||P.name||'Joueur').trim()||'Joueur',
    color:safeCssColor(source&&source.color||P.color,'#22c55e'),
    emoji:String(source&&source.emoji||P.emoji||'👤'),
    avatarImg:(source&&source.avatarImg)||null,
    admin,
    profilePrivate
  };
  if(profilePrivate){
    return Object.assign(base,{
      elo:0,
      rankLabel:'🔒 Profil privé',
      rankClass:'er-unranked',
      titleLabel:'🔒 Profil privé',
      gamesWon:0,
      gamesPlayed:0,
      gamesLost:0,
      propertiesBought:0,
      moneyEarned:0,
      titlesCount:0,
      emojiCount:1
    });
  }
  return Object.assign(base,{
    elo,
    rankLabel:String(rank.label||'— Non Rankée'),
    rankClass:String(rank.cls||'er-unranked'),
    titleLabel:getActiveProfileTitleLabel(source),
    gamesWon:Math.max(0,parseInt(stats.gamesWon,10)||0),
    gamesPlayed:Math.max(0,parseInt(stats.gamesPlayed,10)||0),
    gamesLost:Math.max(0,parseInt(stats.gamesLost,10)||0),
    propertiesBought:Math.max(0,parseInt(stats.propertiesBought,10)||0),
    moneyEarned:Math.max(0,parseInt(stats.moneyEarned,10)||0),
    titlesCount:Math.max(0,Array.isArray(source?.titles)?source.titles.length:0),
    emojiCount:Math.max(1,(source&&source.emojiUnlocks&&typeof source.emojiUnlocks==='object')?Object.keys(source.emojiUnlocks).length:0)
  });
}

function getChatUserRarityClass(rankInfo){
  const cls=String(rankInfo&&rankInfo.cls||'er-unranked').toLowerCase();
  if(cls.includes('legend'))return 'chat-rarity-legend';
  if(cls.includes('diamond'))return 'chat-rarity-diamond';
  if(cls.includes('plat'))return 'chat-rarity-plat';
  if(cls.includes('gold'))return 'chat-rarity-gold';
  if(cls.includes('silver'))return 'chat-rarity-silver';
  if(cls.includes('bronze'))return 'chat-rarity-bronze';
  return 'chat-rarity-unranked';
}

function toggleLocalMuteUser(uid,name){
  const key=normalizeProfileUid(uid);
  if(!key||key===P.uid)return;
  const next=!isLocallyMutedUid(key);
  setLocalUidMembership('mutedUsers',key,next);
  saveProfileData();
  renderSocialChat();
  closeChatUserMenu();
  toast((next?'🔇 ':'🔊 ')+(name||'Utilisateur')+(next?' est maintenant en sourdine':' n est plus en sourdine'),'i');
}

function toggleBlockedUser(uid,name){
  const key=normalizeProfileUid(uid);
  if(!key||key===P.uid)return;
  const next=!isLocallyBlockedUid(key);
  setLocalUidMembership('blockedUsers',key,next);
  if(next){
    P.friends=P.friends.filter(f=>normalizeProfileUid(f.uid)!==key);
  }
  saveProfileData();
  renderFriendsList();
  renderSocialChat();
  closeChatUserMenu();
  toast((next?'🚫 ':'✅ ')+(name||'Utilisateur')+(next?' a été bloqué':' a été débloqué'),'i');
}

function makeChatUserMenuButton(label,className,onClick){
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='btn btn-xs '+(className||'btn-secondary');
  btn.textContent=label;
  btn.addEventListener('click',ev=>{
    ev.preventDefault();
    ev.stopPropagation();
    if(typeof onClick==='function')onClick();
  });
  return btn;
}

function makeChatUserTag(label,className){
  const tag=document.createElement('span');
  tag.className='chat-user-tag'+(className?(' '+className):'');
  tag.textContent=label;
  return tag;
}

function copyChatUserUid(uid){
  const value=normalizeProfileUid(uid);
  if(!value)return;
  navigator.clipboard?.writeText(value)
    .then(()=>toast('📋 Code ami copié !','i'))
    .catch(()=>toast('Copie impossible','w'));
}

function closeChatUserMenu(){
  const menu=document.getElementById('chat-user-menu');
  if(!menu)return;
  menu.classList.remove('open');
  menu.innerHTML='';
  document.body.classList.remove('chat-user-menu-open');
}

function openChatUserMenu(event,user){
  const incoming=user&&typeof user==='object'?user:{};
  const fallbackFriend=Array.isArray(P.friends)?P.friends.find(f=>normalizeProfileUid(f.uid)===normalizeProfileUid(incoming.uid))||{}:{};
  const profile=Object.assign({},fallbackFriend,incoming);
  const uid=normalizeProfileUid(profile.uid);
  const isSelf=!!(uid&&uid===P.uid);
  if(isSelf){
    Object.assign(profile,{
      uid:P.uid,
      name:P.name,
      color:P.color,
      emoji:P.emoji,
      avatarImg:P.avatarImg,
      admin:P.isAdmin,
      elo:P.elo,
      stats:P.stats,
      gamesWon:P.stats?.gamesWon,
      gamesPlayed:P.stats?.gamesPlayed,
      gamesLost:P.stats?.gamesLost,
      propertiesBought:P.stats?.propertiesBought,
      moneyEarned:P.stats?.moneyEarned,
      titles:P.titles,
      titlesCount:Array.isArray(P.titles)?P.titles.length:0,
      emojiUnlocks:P.emojiUnlocks,
      emojiCount:(P.emojiUnlocks&&typeof P.emojiUnlocks==='object')?Object.keys(P.emojiUnlocks).length:1,
      selectedTitle:P.selectedTitle,
      titleLabel:getActiveProfileTitleLabel(P),
      profilePrivate:!!P.chatProfilePrivate
    });
  }
  if(!uid&&!profile.name&&!profile.emoji)return;
  if(event){
    event.preventDefault();
    event.stopPropagation();
  }
  let menu=document.getElementById('chat-user-menu');
  if(!menu){
    menu=document.createElement('div');
    menu.id='chat-user-menu';
    menu.className='chat-user-menu';
    document.body.appendChild(menu);
  }

  const name=String(profile.name||P.name||'Joueur').trim()||'Joueur';
  const color=safeCssColor(profile.color||P.color,'#22c55e');
  const statsSource=profile&&typeof profile.stats==='object'&&profile.stats?profile.stats:{};
  const friend=!isSelf&&hasFriendUid(uid);
  const muted=!isSelf&&isLocallyMutedUid(uid);
  const blocked=!isSelf&&isLocallyBlockedUid(uid);
  const profilePrivate=!isSelf&&isChatProfilePrivate(profile);
  const ownPrivacyEnabled=isSelf&&isChatProfilePrivate(P);
  const hasSharedStats=!profilePrivate&&(
    profile.elo!==undefined||profile.rankLabel||profile.gamesWon!==undefined||profile.gamesPlayed!==undefined||
    profile.gamesLost!==undefined||statsSource.gamesLost!==undefined||
    profile.propertiesBought!==undefined||statsSource.propertiesBought!==undefined||
    profile.moneyEarned!==undefined||statsSource.moneyEarned!==undefined
  );
  const elo=hasSharedStats?Math.max(0,parseInt(profile.elo,10)||0):0;
  const rank=hasSharedStats?getEloRankInfo(elo):{label:String(profile.rankLabel||'— Stats privées'),cls:'er-unranked',tier:'Inconnu'};
  const wins=hasSharedStats?Math.max(0,parseInt(profile.gamesWon,10)||0):0;
  const games=hasSharedStats?Math.max(0,parseInt(profile.gamesPlayed,10)||0):0;
  const losses=hasSharedStats?Math.max(0,parseInt(profile.gamesLost ?? statsSource.gamesLost,10)||Math.max(0,games-wins)):0;
  const propertiesBought=hasSharedStats?Math.max(0,parseInt(profile.propertiesBought ?? statsSource.propertiesBought,10)||0):0;
  const moneyEarned=hasSharedStats?Math.max(0,parseInt(profile.moneyEarned ?? statsSource.moneyEarned,10)||0):0;
  const titlesCount=Math.max(0,parseInt(profile.titlesCount,10)||0);
  const emojiCount=Math.max(1,parseInt(profile.emojiCount,10)||1);
  const winRate=hasSharedStats&&games>0?Math.round((wins/games)*100):0;
  const titleText=String(profile.titleLabel||getActiveProfileTitleLabel(profile)||'').trim();
  const rarityClass=getChatUserRarityClass(rank);
  const socialState=!uid?'Invité':(isSelf?(ownPrivacyEnabled?'Vous • Privé':'Vous'):(profilePrivate?'Privé':(blocked?'Bloqué':(muted?'En sourdine':(friend?'Ami':'Libre')))));
  const activityText=!hasSharedStats
    ?'Profil discret'
    :(elo>=2400?'Icône du lobby':(elo>=1800?'Vétéran classé':(games>=25?'Joueur régulier':(games>=5?'Actif':'Nouveau'))));

  const card=document.createElement('div');
  card.className='chat-user-card '+rarityClass;
  card.style.setProperty('--chat-user-accent-soft',color+'22');
  card.style.borderColor=color+'55';
  if(rarityClass==='chat-rarity-legend')card.style.boxShadow='0 0 0 1px rgba(250,204,21,.14), 0 14px 34px rgba(168,85,247,.20)';

  const closeBtn=document.createElement('button');
  closeBtn.type='button';
  closeBtn.className='chat-user-close';
  closeBtn.textContent='✕';
  closeBtn.setAttribute('aria-label','Fermer le profil');
  closeBtn.addEventListener('click',ev=>{
    ev.preventDefault();
    ev.stopPropagation();
    closeChatUserMenu();
  });
  card.appendChild(closeBtn);

  const hero=document.createElement('div');
  hero.className='chat-user-hero';

  const profileRow=document.createElement('div');
  profileRow.className='chat-user-profile';

  const avatar=document.createElement('div');
  avatar.className='chat-user-avatar';
  avatar.style.borderColor=color;
  if(profile.avatarImg){
    const img=document.createElement('img');
    img.src=profile.avatarImg;
    img.alt='avatar';
    avatar.appendChild(img);
  }else{
    avatar.style.background=color+'22';
    avatar.textContent=profile.emoji||'👤';
  }

  const meta=document.createElement('div');
  meta.className='chat-user-meta';

  const head=document.createElement('div');
  head.className='chat-user-menu-head';
  head.style.color=color;
  head.textContent=(profile.admin?'👑 ':'')+name;

  const sub=document.createElement('div');
  sub.className='chat-user-menu-sub';
  sub.textContent=(uid?('@'+uid):'UID indisponible')+' • '+activityText;

  const tags=document.createElement('div');
  tags.className='chat-user-tags';
  if(isSelf)tags.appendChild(makeChatUserTag('Vous','friend'));
  if(profile.admin)tags.appendChild(makeChatUserTag('Admin','admin'));
  if(profilePrivate||ownPrivacyEnabled)tags.appendChild(makeChatUserTag('Privé','private'));
  if(friend)tags.appendChild(makeChatUserTag('Ami','friend'));
  if(muted)tags.appendChild(makeChatUserTag('Muet local','muted'));
  if(blocked)tags.appendChild(makeChatUserTag('Bloqué','blocked'));
  if(!tags.children.length)tags.appendChild(makeChatUserTag(uid?'Joueur':'Profil chat'));

  meta.append(head,sub,tags);
  profileRow.append(avatar,meta);
  hero.appendChild(profileRow);
  card.appendChild(hero);

  const titleEl=document.createElement('div');
  titleEl.className='chat-user-title';
  titleEl.textContent=(profilePrivate?'🔒 Profil privé':(titleText||(hasSharedStats?'Titre non équipé':'Profil sans stats publiques')));
  card.appendChild(titleEl);

  const highlights=document.createElement('div');
  highlights.className='chat-user-highlights';
  [
    {label:'Statut',value:socialState,tone:(blocked?'blocked':(muted?'muted':(friend?'friend':'neutral')))},
    {label:'Rang',value:(hasSharedStats?String(rank.label||'—'):'Privé'),tone:'rank'},
    {label:'Style',value:activityText,tone:'neutral'}
  ].forEach(item=>{
    const box=document.createElement('div');
    box.className='chat-user-highlight'+(item.tone?(' '+item.tone):'');
    const label=document.createElement('span');
    label.className='chat-user-highlight-label';
    label.textContent=item.label;
    const value=document.createElement('span');
    value.className='chat-user-highlight-value';
    value.textContent=item.value;
    box.append(label,value);
    highlights.appendChild(box);
  });
  card.appendChild(highlights);

  const rankLine=document.createElement('div');
  rankLine.className='chat-user-rank-line';
  const rankBadge=document.createElement('span');
  rankBadge.className='elo-rank-badge '+String(rank.cls||'er-unranked');
  rankBadge.textContent=String(rank.label||'— Stats privées');
  const rankValue=document.createElement('strong');
  rankValue.style.color='#e2e8f0';
  rankValue.style.fontSize='.78rem';
  rankValue.textContent=hasSharedStats?('ELO '+elo):'ELO —';
  rankLine.append(rankBadge,rankValue);
  card.appendChild(rankLine);

  const sectionTitle=document.createElement('div');
  sectionTitle.className='chat-user-section-title';
  sectionTitle.textContent='Aperçu rapide';
  card.appendChild(sectionTitle);

  const stats=document.createElement('div');
  stats.className='chat-user-stats';
  [
    {val:hasSharedStats?elo:'—',label:'📊 ELO'},
    {val:hasSharedStats?wins:'—',label:'🏆 Victoires'},
    {val:hasSharedStats?losses:'—',label:'💥 Défaites'},
    {val:hasSharedStats?games:'—',label:'🎮 Parties'},
    {val:hasSharedStats?(games>0?(winRate+'%'):'—'):'—',label:'⚡ Winrate'},
    {val:hasSharedStats?propertiesBought:'—',label:'🏠 Achats'}
  ].forEach(item=>{
    const box=document.createElement('div');
    box.className='chat-user-stat';
    const val=document.createElement('div');
    val.className='chat-user-stat-val';
    val.textContent=String(item.val);
    const label=document.createElement('div');
    label.className='chat-user-stat-label';
    label.textContent=item.label;
    box.append(val,label);
    stats.appendChild(box);
  });
  card.appendChild(stats);

  const progress=document.createElement('div');
  progress.className='chat-user-progress';
  const progressTop=document.createElement('div');
  progressTop.className='chat-user-progress-top';
  const progressLabel=document.createElement('span');
  const progressHint=document.createElement('span');
  const progressBar=document.createElement('div');
  progressBar.className='chat-user-progress-bar';
  const progressFill=document.createElement('div');
  progressFill.className='chat-user-progress-fill';

  if(hasSharedStats){
    const tiersAsc=[...ELO_TIERS].reverse();
    const currentTier=tiersAsc.filter(t=>elo>=t.min).slice(-1)[0]||tiersAsc[0];
    const nextTier=tiersAsc.find(t=>elo<t.min)||null;
    let pct=100;
    if(nextTier){
      const span=Math.max(1,nextTier.min-currentTier.min);
      pct=Math.max(0,Math.min(100,Math.round(((elo-currentTier.min)/span)*100)));
      progressLabel.textContent='Progression vers '+nextTier.icon+' '+nextTier.name;
      progressHint.textContent=(nextTier.min-elo)+' pts';
    }else{
      progressLabel.textContent='Rang maximum atteint';
      progressHint.textContent='MAX';
    }
    progressFill.style.width=pct+'%';
  }else{
    progressLabel.textContent='Aucune statistique partagée';
    progressHint.textContent='—';
    progressFill.style.width='0%';
  }

  progressBar.appendChild(progressFill);
  progressTop.append(progressLabel,progressHint);
  progress.append(progressTop,progressBar);
  card.appendChild(progress);

  const note=document.createElement('div');
  note.className='chat-user-note';
  note.textContent=profilePrivate
    ?'🔒 Cet admin a choisi de masquer son profil aux autres joueurs.'
    :(hasSharedStats
      ?(name+' a '+wins+' victoire'+(wins>1?'s':'')+' en '+games+' partie'+(games>1?'s':'')+' et '+moneyEarned.toLocaleString('fr-FR')+'$ gagnés.')
      :'Le joueur n’a pas encore partagé ses statistiques de profil.');
  card.appendChild(note);

  const details=document.createElement('div');
  details.className='chat-user-details';

  const detailTitle=document.createElement('div');
  detailTitle.className='chat-user-section-title';
  detailTitle.textContent='Profil complet';
  details.appendChild(detailTitle);

  const detailGrid=document.createElement('div');
  detailGrid.className='chat-user-detail-grid';
  [
    {label:'Émoji équipé',value:profile.emoji||'👤'},
    {label:'Titres débloqués',value:hasSharedStats?String(titlesCount||0):'—'},
    {label:'Émojis connus',value:hasSharedStats?String(emojiCount||1):'—'},
    {label:'Richesse cumulée',value:hasSharedStats?(moneyEarned.toLocaleString('fr-FR')+'$'):'—'}
  ].forEach(item=>{
    const box=document.createElement('div');
    box.className='chat-user-detail';
    const label=document.createElement('span');
    label.className='chat-user-detail-label';
    label.textContent=item.label;
    const value=document.createElement('strong');
    value.className='chat-user-detail-value';
    value.textContent=item.value;
    box.append(label,value);
    detailGrid.appendChild(box);
  });
  details.appendChild(detailGrid);

  const history=document.createElement('div');
  history.className='chat-user-history';
  [
    hasSharedStats?('🏁 '+wins+' victoire'+(wins>1?'s':'')+' / '+losses+' défaite'+(losses>1?'s':'')):'🔒 Historique non partagé',
    hasSharedStats?('🏠 '+propertiesBought+' propriété'+(propertiesBought>1?'s':'')+' achetée'+(propertiesBought>1?'s':'')):'👤 Profil visible uniquement via le chat',
    titleText?('🎖️ Titre équipé : '+titleText):'✨ Aucun titre affiché'
  ].forEach(text=>{
    const item=document.createElement('div');
    item.className='chat-user-history-item';
    item.textContent=text;
    history.appendChild(item);
  });
  details.appendChild(history);
  card.appendChild(details);

  const copyRow=document.createElement('div');
  copyRow.className='chat-user-menu-copy';

  const primaryAction=makeChatUserMenuButton(
    isSelf?'📋 Copier mon code':(friend?'❌ Retirer des amis':'👫 Ajouter en ami'),
    (isSelf?'btn-secondary':(friend?'btn-secondary':'btn-blue')),
    ()=>{
      if(isSelf){
        copyChatUserUid(uid);
        return;
      }
      if(!uid)return;
      if(friend){
        removeFriend(uid);
        closeChatUserMenu();
        toast('👫 Ami retiré','i');
      }else{
        addFriendFromProfile(profile,{silent:false});
        closeChatUserMenu();
      }
    }
  );
  primaryAction.classList.add('btn-wide');
  copyRow.appendChild(primaryAction);

  if(uid){
    const code=document.createElement('code');
    code.textContent=uid;
    copyRow.appendChild(code);

    if(!isSelf){
      const copyBtn=makeChatUserMenuButton('📋 Copier le code','btn-secondary',()=>copyChatUserUid(uid));
      copyBtn.classList.add('btn-wide');
      copyRow.appendChild(copyBtn);
    }
  }else{
    const code=document.createElement('code');
    code.textContent='UID indisponible';
    copyRow.appendChild(code);
  }

  const actions=document.createElement('div');
  actions.className='chat-user-menu-actions';
  const toggleDetailsBtn=makeChatUserMenuButton('👁️ Voir profil complet','btn-blue',()=>{
    const expanded=details.classList.toggle('open');
    toggleDetailsBtn.textContent=expanded?'🗕 Réduire':'👁️ Voir profil complet';
    if(expanded){
      requestAnimationFrame(()=>details.scrollIntoView({block:'nearest',behavior:'smooth'}));
    }
  });
  toggleDetailsBtn.classList.add('btn-wide');
  actions.appendChild(toggleDetailsBtn);
  if(isSelf&&P.isAdmin){
    const privacyBtn=makeChatUserMenuButton(ownPrivacyEnabled?'🌐 Rendre public':'🙈 Passer en privé',ownPrivacyEnabled?'btn-blue':'btn-secondary',()=>toggleOwnChatProfilePrivacy());
    privacyBtn.classList.add('btn-wide');
    actions.appendChild(privacyBtn);
  }
  if(isSelf){
    actions.appendChild(makeChatUserMenuButton('👤 Votre profil','btn-secondary',()=>{
      closeChatUserMenu();
      toast(ownPrivacyEnabled?'🙈 Ton profil est actuellement privé.':'Voici votre profil du chat.','i');
    }));
  }else if(uid){
    actions.appendChild(makeChatUserMenuButton(muted?'🔊 Unmute local':'🔇 Mute local','btn-secondary',()=>toggleLocalMuteUser(uid,name)));
    actions.appendChild(makeChatUserMenuButton(blocked?'✅ Débloquer':'🚫 Bloquer',blocked?'btn-blue':'btn-danger',()=>toggleBlockedUser(uid,name)));
  }else{
    const infoBtn=makeChatUserMenuButton('ℹ️ UID non disponible','btn-secondary',()=>{});
    infoBtn.disabled=true;
    infoBtn.style.opacity='.55';
    infoBtn.style.cursor='not-allowed';
    actions.appendChild(infoBtn);
  }

  const dialog=document.createElement('div');
  dialog.className='chat-user-dialog';
  dialog.addEventListener('click',ev=>ev.stopPropagation());
  dialog.appendChild(card);
  dialog.appendChild(copyRow);
  dialog.appendChild(actions);

  menu.innerHTML='';
  menu.appendChild(dialog);

  if(P.isAdmin&&uid&&!isSelf){
    const sep=document.createElement('div');
    sep.className='chat-user-menu-sep';
    menu.appendChild(sep);

    const adminActions=document.createElement('div');
    adminActions.className='chat-user-menu-actions';
    adminActions.appendChild(makeChatUserMenuButton('🎯 Cibler','btn-secondary',()=>{
      prepareModerationTarget(uid,name);
      closeChatUserMenu();
    }));
    adminActions.appendChild(makeChatUserMenuButton('Mute','btn-secondary',()=>moderateTarget('mute',uid,name)));
    adminActions.appendChild(makeChatUserMenuButton('Unmute','btn-secondary',()=>moderateTarget('unmute',uid,name)));
    adminActions.appendChild(makeChatUserMenuButton('Ban','btn-danger',()=>moderateTarget('ban',uid,name)));
    adminActions.appendChild(makeChatUserMenuButton('Unban','btn-blue',()=>moderateTarget('unban',uid,name)));
    dialog.appendChild(adminActions);
  }

  menu.classList.add('open');
  document.body.classList.add('chat-user-menu-open');
  menu.scrollTop=0;
}

document.addEventListener('click',ev=>{
  const menu=document.getElementById('chat-user-menu');
  if(menu&&menu.classList.contains('open')&&ev.target===menu)closeChatUserMenu();
});
window.addEventListener('resize',()=>closeChatUserMenu());
document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape')closeChatUserMenu();
});

function renderFriendsList(){
  const area=document.getElementById('friends-list-area');if(!area)return;
  if(!P.friends.length){
    area.innerHTML='<div style="font-size:.72rem;color:var(--muted);text-align:center;padding:10px">Aucun ami pour l\'instant.<br>Partage ton code !</div>';
    return;
  }
  area.innerHTML='';
  P.friends.forEach(f=>{
    const row=document.createElement('div');row.className='friend-row';
    const safeColor=safeCssColor(f.color,'#6b7280');
    const avatar=document.createElement('div');
    avatar.className='friend-avatar';
    avatar.style.borderColor=safeColor;
    if(f.avatarImg){
      const img=document.createElement('img');
      img.src=f.avatarImg;
      img.alt='avatar';
      avatar.appendChild(img);
    }else{
      avatar.style.background=safeColor+'22';
      avatar.style.fontSize='1rem';
      avatar.textContent=f.emoji||'👤';
    }
    const name=document.createElement('span');
    name.className='friend-name';
    name.style.color=safeColor;
    name.textContent=f.name||'Ami';
    const date=document.createElement('span');
    date.style.fontSize='.6rem';
    date.style.color='var(--muted)';
    date.style.marginRight='6px';
    date.textContent=new Date(f.addedAt).toLocaleDateString('fr-FR');
    const btn=document.createElement('button');
    btn.className='btn btn-xs btn-danger';
    btn.textContent='✕';
    btn.addEventListener('click',()=>removeFriend(f.uid));
    row.appendChild(avatar);
    row.appendChild(name);
    row.appendChild(date);
    row.appendChild(btn);
    area.appendChild(row);
  });
}

function addFriend(){
  const inp=document.getElementById('add-friend-input');
  const msg=document.getElementById('add-friend-msg');
  const code=normalizeProfileUid(inp?.value||'');
  if(!code){if(msg)msg.style.color='var(--red)';if(msg)msg.textContent='Saisis un code ami.';return;}
  const ok=addFriendFromProfile({uid:code,name:'Ami ('+code.slice(-4)+')',emoji:'👤',avatarImg:null,color:'#6b7280'},{silent:false});
  if(ok&&inp)inp.value='';
}

function removeFriend(uid){
  P.friends=P.friends.filter(f=>normalizeProfileUid(f.uid)!==normalizeProfileUid(uid));
  saveProfileData();renderFriendsList();
}

let socialWs=null,socialWsOk=false,socialWsManualClose=false,socialWsReconnectTimer=null;
const SOCIAL_ROOM_ID='social-lobby';
const SOCIAL_CHAT_AUTO_CLEAR_MS=5*60*1000;
const SOCIAL_CHAT_PRUNE_INTERVAL_MS=30*1000;
let socialChatRenderQueued=false;
let socialChatPersistTimer=null;

function pruneSocialChatLog(options){
  const opts=options&&typeof options==='object'?options:{};
  if(!Array.isArray(P.chatLog))P.chatLog=[];
  const before=P.chatLog.length;
  const now=Date.now();
  if(opts.forceAll){
    P.chatLog=[];
  }else{
    P.chatLog=P.chatLog.filter(m=>{
      const ts=Number(m&&m.ts||0);
      return ts>0&&(now-ts)<SOCIAL_CHAT_AUTO_CLEAR_MS;
    });
  }
  const changed=P.chatLog.length!==before;
  if(changed){
    queueSocialChatPersist();
    if(!opts.skipRender)queueSocialChatUiRefresh();
  }
  if(!opts.silent&&opts.reason&&(changed||opts.forceAll))toast(opts.reason,opts.tone||'i');
  return changed;
}

setInterval(()=>pruneSocialChatLog({silent:true}),SOCIAL_CHAT_PRUNE_INTERVAL_MS);

function queueSocialChatUiRefresh(){
  if(socialChatRenderQueued)return;
  socialChatRenderQueued=true;
  requestAnimationFrame(()=>{
    socialChatRenderQueued=false;
    renderSocialChat();
  });
}

function queueSocialChatPersist(){
  if(socialChatPersistTimer)clearTimeout(socialChatPersistTimer);
  socialChatPersistTimer=setTimeout(()=>{
    socialChatPersistTimer=null;
    saveProfileData();
  },120);
}

function renderSocialChat(){
  pruneSocialChatLog({silent:true,skipRender:true});
  const log=document.getElementById('social-chat-log');if(!log)return;
  log.innerHTML='';
  P.chatLog.slice(-60).forEach(m=>{
    const uid=normalizeProfileUid(m.uid);
    const isMuted=isLocallyMutedUid(uid);
    const isBlocked=isLocallyBlockedUid(uid);
    const isFriend=hasFriendUid(uid);
    const d=document.createElement('div');
    d.className='sc-msg'+(m.mine?' sc-me':'');

    const nm=document.createElement('span');
    nm.className='sc-name chat-user-link';
    nm.style.color=safeCssColor(m.color,'#22c55e');
    nm.textContent=(m.admin?'👑 ':'')+(m.name||'Joueur');
    nm.title='Cliquer pour ouvrir le profil';
    nm.addEventListener('click',ev=>openChatUserMenu(ev,{
      uid,
      name:m.name||'Joueur',
      color:m.color,
      admin:!!m.admin,
      emoji:m.emoji||'',
      avatarImg:m.avatarImg||null,
      elo:m.elo,
      rankLabel:m.rankLabel||'',
      rankClass:m.rankClass||'',
      titleLabel:m.titleLabel||'',
      gamesWon:m.gamesWon,
      gamesPlayed:m.gamesPlayed,
      gamesLost:m.gamesLost,
      propertiesBought:m.propertiesBought,
      moneyEarned:m.moneyEarned,
      titlesCount:m.titlesCount,
      emojiCount:m.emojiCount,
      profilePrivate:!!m.profilePrivate
    }));

    const tm=document.createElement('span');
    tm.className='sc-time';
    tm.textContent=new Date(m.ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});

    d.appendChild(nm);
    if(isFriend||isMuted||isBlocked){
      const badge=document.createElement('span');
      badge.className='chat-user-badge';
      badge.textContent=isBlocked?'bloqué':(isMuted?'muet local':'ami');
      d.appendChild(badge);
    }
    d.appendChild(tm);

    const line=document.createElement('div');
    if(isBlocked){
      line.style.color='var(--muted)';
      line.textContent='🚫 Utilisateur bloqué — message masqué';
    }else if(isMuted){
      line.style.color='var(--muted)';
      line.textContent='🔇 Utilisateur en sourdine — message masqué';
    }else{
      line.textContent=String(m.text||'');
    }
    d.appendChild(line);
    log.appendChild(d);
  });
  log.scrollTop=log.scrollHeight;
  syncSocialAdminUi();
}

function addSocialMsg(name,color,text,mine,meta){
  const extra=meta&&typeof meta==='object'?meta:{};
  pruneSocialChatLog({silent:true,skipRender:true});
  P.chatLog.push({
    name,
    color,
    text,
    ts:Date.now(),
    mine:!!mine,
    uid:extra.uid||null,
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
  });
  if(P.chatLog.length>200)P.chatLog.shift();
  queueSocialChatPersist();
  queueSocialChatUiRefresh();
}

function syncSocialAdminUi(){
  const status=document.getElementById('social-chat-role');
  const tools=document.getElementById('social-admin-tools');
  const input=document.getElementById('social-chat-input');
  const sendBtn=document.getElementById('social-send-btn');
  const mod=P.moderation||getDefaultModerationState();
  const blocked=!!(mod.banned||mod.muted);
  if(status){
    if(P.isAdmin){
      status.innerHTML='<span style="color:#facc15;font-weight:800">👑 Administrateur</span>';
    }else if(mod.banned){
      status.innerHTML='<span style="color:#fca5a5">⛔ Chat désactivé (banni)'+(mod.reason?' — '+escapeHtml(mod.reason):'')+'</span>';
    }else if(mod.muted){
      status.innerHTML='<span style="color:#fbbf24">🔇 Chat désactivé (mute)'+(mod.reason?' — '+escapeHtml(mod.reason):'')+'</span>';
    }else{
      status.textContent='';
    }
  }
  if(tools)tools.style.display=P.isAdmin?'block':'none';
  if(input){
    input.disabled=blocked;
    input.placeholder=mod.banned?'Chat indisponible (banni)':(mod.muted?'Chat indisponible (mute)':'Message…');
  }
  if(sendBtn)sendBtn.disabled=blocked;
}

async function refreshModerationStatus(silent=true){
  try{
    const base=getGoogleApiBase();
    if(!base)throw new Error('missing_api_base');
    const r=await fetch(base+'/api/mod/status',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uid:P.uid,sessionToken:P.googleSessionToken||''}),
    });
    const data=await r.json();
    if(!r.ok||!data||!data.ok)throw new Error(data&&data.error||'mod_status_failed');
    P.isAdmin=!!data.isAdmin;
    P.moderation=Object.assign(getDefaultModerationState(),data.moderation||{});
  }catch(_){
    P.isAdmin=false;
    if(!P.moderation||typeof P.moderation!=='object')P.moderation=getDefaultModerationState();
  }
  syncSocialAdminUi();
  renderLobbyProfileTab();
  renderSocialChat();
  if(!silent&&P.isAdmin)toast('👑 Mode admin actif','i');
}

function prepareModerationTarget(uid,name){
  const input=document.getElementById('social-mod-target');
  if(!input)return;
  input.value=String(uid||'').trim();
  input.placeholder=(name?('UID cible — '+name):'UID cible…');
  input.focus();
}

async function moderateTarget(action,targetUid,targetName){
  if(!P.isAdmin){toast('Action reservee a l admin','d');return;}
  const input=document.getElementById('social-mod-target');
  const uid=String(targetUid||input?.value||'').trim();
  if(!uid){toast('Entre un UID cible','w');return;}
  const reason=(action==='ban'||action==='mute')?(prompt('Raison (optionnelle) ?','')||''):'';
  try{
    const r=await fetch(getGoogleApiBase()+'/api/mod/action',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        action,
        adminUid:P.uid,
        sessionToken:P.googleSessionToken||'',
        targetUid:uid,
        reason,
      }),
    });
    const data=await r.json();
    if(!r.ok||!data||!data.ok)throw new Error(data&&data.error||'mod_action_failed');
    if(input)input.value=uid;
    toast('Action '+action+' appliquée à '+(targetName||uid),'a');
  }catch(e){
    toast('Erreur modération: '+String(e&&e.message||'mod_action_failed'),'d');
  }
}

function sendSocialChat(){
  const mod=P.moderation||getDefaultModerationState();
  if(mod.banned){toast('⛔ Ce compte est banni du chat','d');return;}
  if(mod.muted){toast('🔇 Ce compte est mute','w');return;}
  const inp=document.getElementById('social-chat-input');
  const text=(inp?.value||'').trim();if(!text)return;
  inp.value='';
  const chatProfile=getSharedChatProfilePayload();
  addSocialMsg(P.name,P.color,text,true,chatProfile);
  if(socialWs&&socialWsOk){
    try{socialWs.send(JSON.stringify(Object.assign({type:'social_chat',room:SOCIAL_ROOM_ID,text,sessionToken:P.googleSessionToken||''},chatProfile)));}
    catch(e){}
  }
}

function requestSocialChatClear(){
  if(!P.isAdmin){toast('Action reservee a l admin','d');return;}
  if(socialWs&&socialWsOk){
    try{
      socialWs.send(JSON.stringify({
        type:'social_clear_request',
        room:SOCIAL_ROOM_ID,
        uid:P.uid,
        sessionToken:P.googleSessionToken||'',
        name:P.name||'Admin'
      }));
      return;
    }catch(_){ }
  }
  pruneSocialChatLog({forceAll:true,silent:false,reason:'🧹 Chat effacé localement (hors ligne)'});
}

function scheduleSocialWsReconnect(){
  if(socialWsManualClose)return;
  if(socialWsReconnectTimer)clearTimeout(socialWsReconnectTimer);
  socialWsReconnectTimer=setTimeout(()=>connectSocialWs(true),2200);
}

function connectSocialWs(auto=false){
  if(socialWs||socialWsOk)return;
  const input=document.getElementById('social-ws-url');
  const requestedUrl=(input?.value||'').trim()||getDefaultWsUrl();
  if(!requestedUrl){if(!auto)toast('Entre une URL WebSocket','w');return;}
  socialWsManualClose=false;
  updateSocialWsStatus(auto?'Connexion auto...':'Connexion…');

  const startConnection=()=>{
    const urls=getWsFallbackUrls((input?.value||'').trim()||requestedUrl||getDefaultWsUrl());
    const tryConnect=(index)=>{
      const url=urls[index];
      if(!url){
        updateSocialWsStatus('❌ URL WebSocket indisponible');
        if(!socialWsManualClose)scheduleSocialWsReconnect();
        return;
      }
      let opened=false;
      try{
        socialWs=new WebSocket(url);
      }catch(_){
        socialWs=null;
        if(index+1<urls.length){
          updateSocialWsStatus('↻ Bascule vers '+urls[index+1]);
          tryConnect(index+1);
          return;
        }
        updateSocialWsStatus('❌ URL invalide');
        if(!socialWsManualClose)scheduleSocialWsReconnect();
        return;
      }
      socialWs.onopen=()=>{
        opened=true;
        socialWsOk=true;
        if(input)input.value=url;
        if(typeof rememberRenderOrigin==='function')rememberRenderOrigin(wsUrlToHttpBase(url));
        if(socialWsReconnectTimer){clearTimeout(socialWsReconnectTimer);socialWsReconnectTimer=null;}
        updateSocialWsStatus('✅ Connecté à '+url);
        document.getElementById('social-ws-btn').textContent='⛔';
        socialWs.send(JSON.stringify(Object.assign({type:'social_join',room:SOCIAL_ROOM_ID,sessionToken:P.googleSessionToken||''},getSharedChatProfilePayload())));
      };
      socialWs.onmessage=e=>{
        try{
          const m=JSON.parse(e.data);
          if(m.type==='error'&&m.code==='ADMIN_REQUIRED'){
            toast('Action reservee a l admin','d');
            return;
          }
          if(m.type==='social_clear'){
            pruneSocialChatLog({
              forceAll:true,
              silent:!!m.auto,
              reason:m.auto?'':'🧹 Chat effacé par '+String(m.by||'un admin')
            });
            return;
          }
          if(m.type==='mod_status'){
            P.moderation=Object.assign(getDefaultModerationState(),{muted:!!m.muted,banned:!!m.banned,reason:String(m.reason||''),updatedAt:Date.now()});
            syncSocialAdminUi();
            if(P.moderation.banned)toast('⛔ Compte banni du chat','d');
            else if(P.moderation.muted)toast('🔇 Compte mute du chat','w');
            return;
          }
          if(m.type==='social_chat'&&m.uid!==P.uid){
            addSocialMsg(m.name,m.color,m.text,false,{uid:m.uid||null,admin:!!m.admin,emoji:m.emoji||'',avatarImg:m.avatarImg||null,elo:m.elo,rankLabel:m.rankLabel||'',rankClass:m.rankClass||'',titleLabel:m.titleLabel||'',gamesWon:m.gamesWon,gamesPlayed:m.gamesPlayed,gamesLost:m.gamesLost,propertiesBought:m.propertiesBought,moneyEarned:m.moneyEarned,titlesCount:m.titlesCount,emojiCount:m.emojiCount});
          }
          if(m.type==='social_join'&&m.uid!==P.uid){
            const f=P.friends.find(f=>normalizeProfileUid(f.uid)===normalizeProfileUid(m.uid));
            if(f){
              f.name=m.name;
              f.color=m.color;
              f.emoji=m.emoji;
              f.avatarImg=m.avatarImg||f.avatarImg||null;
              f.elo=m.elo;
              f.rankLabel=m.rankLabel||'';
              f.titleLabel=m.titleLabel||'';
              f.gamesWon=m.gamesWon;
              f.gamesPlayed=m.gamesPlayed;
              saveProfileData();renderFriendsList();
            }
          }
        }catch(err){}
      };
      socialWs.onerror=()=>{
        if(!opened&&index+1<urls.length){
          updateSocialWsStatus('↻ Bascule vers '+urls[index+1]);
        }else{
          updateSocialWsStatus('❌ Erreur de connexion');
        }
      };
      socialWs.onclose=()=>{
        socialWsOk=false;
        socialWs=null;
        document.getElementById('social-ws-btn').textContent='🔗';
        if(socialWsManualClose){
          updateSocialWsStatus('Déconnecté');
          return;
        }
        if(!opened&&index+1<urls.length){
          updateSocialWsStatus('↻ Bascule vers '+urls[index+1]);
          tryConnect(index+1);
          return;
        }
        updateSocialWsStatus('Déconnecté');
        scheduleSocialWsReconnect();
      };
    };
    tryConnect(0);
  };

  const prep=(typeof ensurePreferredRenderOrigin==='function'&&(isRenderWsUrl(requestedUrl)||/\.onrender\.com$/i.test(String(window.location.hostname||''))))
    ?ensurePreferredRenderOrigin(auto)
    :Promise.resolve('');
  Promise.resolve(prep).catch(()=>{}).finally(startConnection);
}

function toggleSocialWs(){
  if(socialWs){
    socialWsManualClose=true;
    if(socialWsReconnectTimer){clearTimeout(socialWsReconnectTimer);socialWsReconnectTimer=null;}
    socialWs.close();socialWs=null;socialWsOk=false;
    updateSocialWsStatus('Déconnecté');
    document.getElementById('social-ws-btn').textContent='🔗';
    return;
  }
  connectSocialWs(false);
}

function updateSocialWsStatus(msg){
  const el=document.getElementById('social-ws-status');if(el)el.textContent=msg;
}
