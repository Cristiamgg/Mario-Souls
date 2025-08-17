(() => {
  // ===== Canvas & tamanho =====
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  let W=0,H=0,DPR=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  function resize(){
    const hh=document.querySelector('.hud').offsetHeight;
    const fh=document.querySelector('.foot').offsetHeight;
    W=cv.clientWidth=innerWidth;
    H=cv.clientHeight=innerHeight-hh-fh;
    cv.width=Math.floor(W*DPR); cv.height=Math.floor(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  addEventListener('resize', resize,{passive:true});

  // ===== UI =====
  const hpEl = document.getElementById('hp');
  const atkEl = document.getElementById('atk');
  const bestEl = document.getElementById('best');
  const stBar = document.getElementById('stBar');
  const muteBtn = document.getElementById('mute');
  const helpBtn = document.getElementById('help');
  const playBtn = document.getElementById('play');
  const vibeBtn = document.getElementById('vibe');
  const overlay = document.getElementById('ovl');
  const toast = document.getElementById('toast');
  bestEl.textContent = localStorage.getItem('abyss.best')||0;

  // Controles mobile
  const held={left:false,right:false,down:false,jump:false,attack:false};
  document.querySelectorAll('.key').forEach(k=>{
    const name=k.dataset.key;
    const on=()=>{ held[name]=true; if(name==='attack') doAttack(); if(name==='jump') wantJump=true; };
    const off=()=>{ held[name]=false; };
    k.addEventListener('touchstart', e=>{e.preventDefault(); on();},{passive:false});
    k.addEventListener('touchend', e=>{e.preventDefault(); off();},{passive:false});
    k.addEventListener('mousedown', on); k.addEventListener('mouseup', off); k.addEventListener('mouseleave', off);
  });

  // Teclado (desktop)
  addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k==='arrowleft'||k==='a') held.left=true;
    if(k==='arrowright'||k==='d') held.right=true;
    if(k==='arrowdown'||k==='s') held.down=true;
    if(k===' '||k==='k'||k==='x'){ held.attack=true; doAttack(); }
    if(k==='arrowup'||k==='w'||k==='j'){ held.jump=true; wantJump=true; }
    if(k==='escape'){ togglePause(); }
  });
  addEventListener('keyup',e=>{
    const k=e.key.toLowerCase();
    if(k==='arrowleft'||k==='a') held.left=false;
    if(k==='arrowright'||k==='d') held.right=false;
    if(k==='arrowdown'||k==='s') held.down=false;
    if(k===' '||k==='k'||k==='x') held.attack=false;
    if(k==='arrowup'||k==='w'||k==='j') held.jump=false;
  });

  // ===== Áudio minimal =====
  let ac=null, soundOn=true, vibrate=false;
  function bootAC(){ try{ if(!ac){ ac=new (window.AudioContext||window.webkitAudioContext)(); } }catch{} }
  function tone(f=220,d=.08,type='sine',vol=.06){
    if(!soundOn||!ac) return;
    const t=ac.currentTime; const o=ac.createOscillator(); const g=ac.createGain();
    o.type=type; o.frequency.value=f; g.gain.value=vol; o.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t+d);
  }
  const sfx={ hit(){tone(200,.06,'square',.09); tone(120,.08,'sawtooth',.05)},
              pickup(){tone(660,.06,'sine',.07); tone(990,.09,'sine',.05)},
              bonfire(){tone(440,.12,'triangle',.08); tone(660,.18,'triangle',.04)}};
  muteBtn.onclick=()=>{ soundOn=!soundOn; muteBtn.textContent=soundOn?'🔊':'🔇'; };
  helpBtn.onclick=()=>{ overlay.classList.remove('hidden'); paused=true; };
  playBtn.onclick=start;
  vibeBtn.onclick=()=>{ vibrate=!vibrate; showToast(vibrate?'Vibração: ON':'Vibração: OFF'); if(vibrate && navigator.vibrate) navigator.vibrate(20); };

  // ===== Mundo =====
  const T=24; // tile
  const level = [
    "################################################################################################",
    "#..............................................................................................#",
    "#.............................................E................................................#",
    "#......................####.....................####.......................O...................#",
    "#............................................................####..............................#",
    "#..........B..................####....................E........................................#",
    "#.......................####.............................................####.................#",
    "#.............................................O................................................#",
    "#......####.....................................................####..........................#",
    "#....................................####..............B.......................................#",
    "#....................E.............................O..........................................#",
    "#............................................................E.................................#",
    "#..............####....................................................####....................#",
    "#.......................................................O......................................#",
    "#...........B.................................................................E................#",
    "#...............................................####...........................................#",
    "#..............................................................................................#",
    "################################################################################################",
  ];
  const ROW=level.length, COL=level[0].length;

  // ===== Estado do jogo =====
  const player = {x:2*T,y:(ROW-3)*T,w:16,h:20,vx:0,vy:0,dir:1,onGround:false,atk:1,hp:5,maxhp:5,stam:100,maxStam:100,dead:false,checkpoint:{x:2*T,y:(ROW-3)*T}};
  const enemies=[], orbs=[], fires=[];
  function spawnLevel(){
    enemies.length=0; orbs.length=0; fires.length=0;
    for(let r=0;r<ROW;r++) for(let c=0;c<COL;c++){
      const ch=level[r][c]; const x=c*T, y=r*T;
      if(ch==='E') enemies.push({x,y:y-1,w:16,h:20,dir:Math.random()<.5?-1:1,vy:0,hp:2,alive:true});
      if(ch==='O') orbs.push({x:x+12,y:y-12,r:6});
      if(ch==='B') fires.push({x:x+12,y:y-8,lit:false});
    }
  }

  // ===== Helpers =====
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  function solidAt(px,py,w,h){
    const x1=Math.floor(px/T), y1=Math.floor(py/T);
    const x2=Math.floor((px+w-1)/T), y2=Math.floor((py+h-1)/T);
    for(let yy=y1; yy<=y2; yy++) for(let xx=x1; xx<=x2; xx++){
      if(level[yy] && level[yy][xx]==='#') return true;
    }
    return false;
  }
  function rects(x,y,w,h, X,Y,W,H){ return !(x+w<X||x>X+W||y+h<Y||y>Y+H); }
  function showToast(msg,danger=false){ toast.textContent=msg; toast.classList.remove('hidden'); toast.style.borderColor = danger? 'rgba(255,107,107,.6)':'rgba(255,255,255,.08)'; setTimeout(()=>toast.classList.add('hidden'), 1100); }

  // ===== Powers Roguelike =====
  function givePowerUp(){
    const choices=[
      {name:'Forja Sombria (+1 ATK)', run:()=>{player.atk++; atkEl.textContent=player.atk;}},
      {name:'Botas de Névoa (+20% Vel)', run:()=>{player.speedBoost=(player.speedBoost||1)*1.2;}},
      {name:'Pulmões Antigos (+1 pulo)', run:()=>{player.extraJumps=(player.extraJumps||0)+1;}},
      {name:'Vitalidade (+2 HP máx)', run:()=>{player.maxhp+=2; player.hp+=2; hpEl.textContent=player.hp;}},
      {name:'Lâmina Vampírica (roubo de vida)', run:()=>{player.lifesteal=true;}},
      {name:'Passo Veloz (dash barato)', run:()=>{player.dashCost=10;}}
    ];
    const pick = choices[(Math.random()*choices.length)|0];
    pick.run(); sfx.pickup(); showToast('Power-up: '+pick.name);
  }

  // ===== Ações =====
  function attackHitbox(){
    const range=20;
    const ax = player.dir>0 ? player.x+player.w : player.x-range;
    const ay = player.y+4, aw=range, ah=14;
    for(const e of enemies){
      if(!e.alive) continue;
      if(rects(ax,ay,aw,ah, e.x,e.y,e.w,e.h)){
        e.hp -= player.atk; sfx.hit();
        if(player.lifesteal){ player.hp=Math.min(player.maxhp, player.hp+1); hpEl.textContent=player.hp; }
        if(e.hp<=0){ e.alive=false; if(Math.random()<0.45) givePowerUp(); else sfx.pickup(); }
      }
    }
  }
  function doAttack(){
    if(player.dead||paused) return;
    if((player.stam||0)<15) return;
    player.stam -= 15;
    stBar.style.width = Math.max(0, (player.stam/player.maxStam)*100)+'%';
    attackHitbox();
  }
  function lightBonfire(f){
    if(!f.lit){
      f.lit=true; player.checkpoint={x:f.x-8, y:f.y-12};
      sfx.bonfire(); showToast('Bonfire aceso! Checkpoint salvo.');
      const best = Math.max(Number(localStorage.getItem('abyss.best')||0), Date.now());
      localStorage.setItem('abyss.best', String(best));
      bestEl.textContent = localStorage.getItem('abyss.best');
    }
  }

  // ===== Loop =====
  const G=800, MAXVX=110, JUMP=260;
  let paused=true, last=0, wantJump=false;
  function start(){ paused=false; overlay.classList.add('hidden'); bootAC(); reset(); loop(performance.now()); }
  function reset(){ player.x=player.checkpoint.x; player.y=player.checkpoint.y; player.vx=0; player.vy=0; player.dead=false; }
  function die(){ if(player.dead) return; player.dead=true; showToast('YOU DIED',true); tone(80,.25,'sawtooth',.08); paused=true; setTimeout(()=>{ paused=false; reset(); },900); }
  function togglePause(){ paused=!paused; if(paused) overlay.classList.remove('hidden'); else overlay.classList.add('hidden'); }

  function loop(ts){
    if(paused){ last=ts; requestAnimationFrame(loop); return; }
    const dt=Math.min(32, ts-last)/1000; last=ts;
    update(dt); draw(); requestAnimationFrame(loop);
  }

  function update(dt){
    const spd = (player.speedBoost||1) * 90;
    const maxvx = (player.speedBoost||1) * MAXVX;

    // Regen stamina
    player.stam = Math.min(player.maxStam, (player.stam||player.maxStam) + 20*dt);
    stBar.style.width = Math.floor((player.stam/player.maxStam)*100)+'%';

    // Input
    let ax=0; if(held.left) ax=-1; if(held.right) ax=held.left?0:1; player.dir = ax!==0? ax : player.dir;
    player.vx += ax*spd*dt; player.vx *= 0.86; player.vx = clamp(-maxvx, player.vx, maxvx);

    // Jump
    if(wantJump){
      if(player.onGround && player.stam>=20){ player.vy=-JUMP; player.onGround=false; player.stam-=20; wantJump=false; tone(320,.07,'triangle',.06); }
      else if((player.extraJumps||0)>0 && player.stam>=25){ player.vy=-JUMP*0.9; player.extraJumps--; player.stam-=25; wantJump=false; tone(380,.07,'triangle',.06); }
      else wantJump=false;
    }

    // Gravidade
    player.vy += G*dt;

    // Move X
    let nx = player.x + player.vx*dt;
    if(!solidAt(nx, player.y, player.w, player.h)) player.x=nx;
    else { while(!solidAt(player.x+Math.sign(player.vx), player.y, player.w, player.h)) player.x+=Math.sign(player.vx); player.vx=0; }

    // Move Y
    let ny = player.y + player.vy*dt;
    if(!solidAt(player.x, ny, player.w, player.h)){ player.y=ny; player.onGround=false; }
    else { if(player.vy>0) player.onGround=true; while(!solidAt(player.x, player.y+Math.sign(player.vy), player.w, player.h)) player.y+=Math.sign(player.vy); player.vy=0; }

    // Inimigos
    for(const e of enemies){
      if(!e.alive) continue;
      e.vx = 30*e.dir;
      const ex = e.x + e.vx*dt;
      if(!solidAt(ex, e.y, e.w, e.h)) e.x=ex; else e.dir*=-1;
      const ey = e.y + (e.vy||0)*dt + 200*dt;
      if(!solidAt(e.x, ey, e.w, e.h)) e.y=ey; else e.vy=0;
      if(rects(player.x,player.y,player.w,player.h, e.x,e.y,e.w,e.h)){
        player.hp--; hpEl.textContent=player.hp; tone(110,.06,'sawtooth',.07);
        if(player.hp<=0) die();
      }
    }

    for(let i=orbs.length-1;i>=0;i--){
      const o=orbs[i];
      if(rects(player.x,player.y,player.w,player.h, o.x-4,o.y-4,8,8)){
        sfx.pickup(); orbs.splice(i,1);
      }
    }

    for(const f of fires){
      if(Math.abs(player.x-(f.x-8))<14 && Math.abs(player.y-(f.y-12))<18) lightBonfire(f);
    }

    if(player.y>H*2){ player.hp=0; hpEl.textContent=0; die(); }
  }

  // ===== Render =====
  let scale=3;
  function worldToScreen(x){return Math.floor(x*scale);}
  function computeScale(){ scale = Math.max(2, Math.min(4, Math.floor(innerWidth/(T*12)))); }

  function draw(){
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'#0e1322'); grad.addColorStop(1,'#090b12');
    ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);

    const camX = Math.floor(Math.max(0, Math.min(player.x - W/2/scale, COL*T - W/scale)));

    ctx.fillStyle='rgba(180,200,255,0.04)';
    for(let i=0;i<6;i++){ const y=i*40+((performance.now()/40+i*17)%H); ctx.fillRect(0,y,W,2); }

    ctx.fillStyle='#1d2742';
    for(let r=0;r<ROW;r++){
      for(let c=0;c<COL;c++){
        if(level[r][c]==='#'){
          const x=c*T, y=r*T;
          const sx=worldToScreen(x-camX), sy=worldToScreen(y);
          if(sx>-T*scale && sx<W+T*scale) ctx.fillRect(sx, sy, T*scale, T*scale);
        }
      }
    }

    for(const f of fires){
      const sx=worldToScreen(f.x-8-camX), sy=worldToScreen(f.y-16);
      if(sx>-40&&sx<W+40){
        ctx.fillStyle=f.lit?'#f5b342':'#555';
        ctx.fillRect(sx, sy, 16*scale, 16*scale);
        if(f.lit){ ctx.fillStyle='rgba(245,179,66,0.25)'; ctx.fillRect(sx-8, sy-6, 32*scale, 8*scale); }
      }
    }

    for(const o of orbs){
      const sx=worldToScreen(o.x-camX), sy=worldToScreen(o.y);
      if(sx>-16&&sx<W+16){ ctx.beginPath(); ctx.arc(sx, sy, 4*scale, 0, Math.PI*2); ctx.fillStyle='rgba(140,255,107,0.85)'; ctx.fill(); }
    }

    for(const e of enemies){
      if(!e.alive) continue;
      const sx=worldToScreen(e.x-camX), sy=worldToScreen(e.y);
      if(sx>-32&&sx<W+32){
        ctx.fillStyle='rgba(255,107,107,0.9)';
        ctx.fillRect(sx, sy, e.w*scale, e.h*scale);
      }
    }

    const px=worldToScreen(player.x-camX), py=worldToScreen(player.y);
    ctx.fillStyle='rgba(100,140,255,0.15)';
    ctx.fillRect(px-4, py+player.h*scale, player.w*scale+8, 4);
