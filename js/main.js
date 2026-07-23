'use strict';
/* ============================================================
   5분 도시 — main.js   (로드 순서 맨 끝: … → audio → [embed] → main)
   부트 · 입력(대시 포함) · 상호작용/모드 라우팅 · 오버레이 · HUD · 루프
   ------------------------------------------------------------
   부트 사이드이펙트는 전부 fmcStart() 안에 있다.
   - 독립 실행(index.html): 파일 끝에서 자동으로 fmcStart() 호출.
   - 임베드(window.__FMC_EMBED__): 자동 부트 안 함. FMC.boot 가 DOM 주입 후 호출.
   FMC 임베드 훅: fmcConfigure / fmcPause / fmcResume / fmcDestroy /
   fmcSetRemotePlayers / fmcShowBubble / fmcSetSelfName / fmcGetSelfState.
   ============================================================ */

/* ---------- 캔버스 / HUD refs (fmcStart 에서 획득) ---------- */
let cv=null, ctx=null;
const $ = id => document.getElementById(id);
let elClock, elPhase, elWish, elCan, elFish, elOdeng, elCoin, elHint, elToast;
function grabRefs(){
  cv=$('scene'); ctx=cv.getContext('2d');
  elClock=$('clock'); elPhase=$('phase');
  elWish=$('wishcount'); elCan=$('cancount'); elFish=$('fishcount');
  elOdeng=$('odengcount'); elCoin=$('coincount');
  elHint=$('hint'); elToast=$('toast');
}

/* ---------- 임베드 상태 ---------- */
let fmcOpts = {};                 // boot opts (독립 실행은 {})
let fmcPaused = false;            // pause 중이면 입력 무시 + 루프 정지
let rafId = 0;                    // requestAnimationFrame 핸들
const fmcListeners = [];          // destroy 시 해제할 리스너
const fmcTimers = [];             // destroy 시 해제할 타이머
function reg(target, type, fn){ target.addEventListener(type, fn); fmcListeners.push({target,type,fn}); }

/* 원격 플레이어 / 이름표 / 말풍선 (임베드 멀티플레이) */
let remotePlayers = [];           // [{id,name,x,dir,walking,colors}]
let selfName = '';
const bubbles = new Map();        // id('self'|remoteId) → {text, until}

/* boot opts 주입 (embed.js 에서 fmcStart 직전에 호출) */
function fmcConfigure(opts){ fmcOpts = opts || {}; }

function refreshStats(){
  elWish.textContent=GS.wishes; elCan.textContent=GS.cans; elFish.textContent=GS.fish;
  elOdeng.textContent=GS.odengSold; elCoin.textContent=GS.coins.toLocaleString();
}

/* ---------- 리사이즈 (cover) ---------- */
function fit(){
  if(!cv) return;
  const s=Math.max(innerWidth/W, innerHeight/H);
  const cssW=W*s, cssH=H*s;
  cv.style.width=cssW+'px'; cv.style.height=cssH+'px';
  // 백킹 스토어를 실제 디바이스 픽셀로 — 저해상도 확대로 인한 텍스트 blur 방지(cafe 엔진과 동일 방식)
  const dpr=Math.min(window.devicePixelRatio||1, 2);
  const bw=Math.max(W, Math.round(cssW*dpr)), bh=Math.max(H, Math.round(cssH*dpr));
  if(cv.width!==bw||cv.height!==bh){ cv.width=bw; cv.height=bh; }
}

/* ---------- 토스트 · 힌트 ---------- */
let toastTimer=null;
function toast(msg){
  elToast.textContent=msg; elToast.style.opacity=1;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>elToast.style.opacity=0,2400);
}
const HINTS=[
  '←→ 로 도시를 걸어보세요',
  '⇧ 또는 방향키 더블탭으로 대시',
  '게시판 앞에서 ↑ 로 쪽지를 읽고 남겨요',
  '밤이 되면 포장마차가 열려요 🐟',
  '밤의 오뎅바에서 사장님이 되어보세요 🍢',
  '스쿠터 옆에서 ↑ 로 배달 알바를 시작해요 🛵',
  '밤하늘에서 ↑ 를 누르면 별자리를 이어요',
  '벤치에 앉으면 시간이 빨리 흘러요',
  '지붕 위를 잘 살펴보세요',
  'P 로 수집한 것들을 볼 수 있어요',
];
let hintIdx=0;
function cycleHint(){
  if(GS.mode!=='roam'){ return; }
  elHint.style.opacity=0;
  setTimeout(()=>{ elHint.textContent=HINTS[hintIdx++%HINTS.length];
    elHint.style.opacity=.85; },1300);
}

/* ============================================================
   오버레이 관리
   ============================================================ */
function openOverlay(id){ $(id).classList.add('open'); }
function closeOverlay(id){ $(id).classList.remove('open'); }
function anyOverlayOpen(){ return document.querySelector('.overlay.open')!==null; }

/* ---------- 게시판 읽기 ---------- */
function openBoard(){
  rebuildBoard();
  boardIndex=0;
  GS.mode='board';
  renderNote();
  openOverlay('boardOv');
}
function renderNote(){
  const n=boardNotes[boardIndex] || {t:'—',mine:false,who:null};
  const view=$('noteView');
  view.className='note'+(n.mine?' mine':'');
  const who = n.mine ? '나' : (n.who || '이웃');
  view.innerHTML = escapeHtml(n.t) +
    `<span class="who">— ${escapeHtml(who)}</span>`;
  $('notePos').textContent=`${boardIndex+1} / ${boardNotes.length}`;
  if(!n._seen){ n._seen=true; GS.readNotes++; }
}

/* ---------- 쪽지 작성 ---------- */
function openWrite(){
  GS.mode='writing';
  $('noteInput').value=''; $('charCount').textContent='0 / 60';
  openOverlay('writeOv');
  setTimeout(()=>$('noteInput').focus(),50);
}

/* ---------- 수집 패널 ---------- */
function openColl(){
  const body=$('collBody');
  const cons = GS.constellations.length
    ? GS.constellations.map(c=>`<span class="tag">✦ ${escapeHtml(c)}</span>`).join('')
    : `<span class="empty">아직 이은 별자리가 없어요</span>`;
  const mine = playerNotes.length
    ? playerNotes.slice(0,8).map(p=>`<div class="row"><span>${escapeHtml(p.t)}</span></div>`).join('')
    : `<span class="empty">남긴 쪽지가 없어요</span>`;
  body.innerHTML=
    `<div class="row"><span>소원 (별똥별)</span><b>${GS.wishes}</b></div>`+
    `<div class="row"><span>뽑은 음료</span><b>${GS.cans}</b></div>`+
    `<div class="row"><span>구운 붕어빵</span><b>${GS.fish}</b></div>`+
    `<div class="row"><span>오뎅바 손님</span><b>${GS.odengSold}</b></div>`+
    `<div class="row"><span>배달 완료</span><b>${GS.deliveries}</b></div>`+
    `<div class="row"><span>모은 돈</span><b>${GS.coins.toLocaleString()}원</b></div>`+
    `<div class="row"><span>읽은 쪽지</span><b>${GS.readNotes}</b></div>`+
    `<h4>별자리 (${GS.constellations.length}/${CONSTELLATIONS.length})</h4><div>${cons}</div>`+
    `<h4>내가 남긴 쪽지</h4>${mine}`;
  openOverlay('collOv');
}

function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ============================================================
   상호작용 (roam 모드에서 ↑)
   ============================================================ */
const VEND_LINES=[
  ['따뜻한 캔커피를 뽑았다 ☕',true],
  ['달칵. 밀크티가 나왔다',true],
  ['차가운 사이다가 나왔다',true],
  ['꽝. 동전만 삼켰다…',false],
];
const BUS_LINES=['버스는 오지 않는다','막차는 이미 떠났다','노선표가 빛바래 있다'];
let benchHintShown=false, catToasts=0;

function tryInteract(){
  if(GS.mode!=='roam') return;

  /* 앉아 있으면 일어난다 */
  if(player.sitting){ playerStand(); sfxBlip(490); return; }

  /* 배달 알바 (스쿠터 시작·픽업·문 앞 배달이 최우선) */
  if(delivTryInteract()) return;

  /* 랜드마크: 게시판 */
  if(Math.abs(wrapDelta(LM.board - player.x, WLOOP))<14){ openBoard(); sfxBlip(600); return; }
  /* 랜드마크: 포장마차 */
  if(Math.abs(wrapDelta(LM.stall - player.x, WLOOP))<16){ stallEnter(); return; }
  /* 랜드마크: 오뎅바 */
  if(Math.abs(wrapDelta(LM.odeng - player.x, WLOOP))<18){ odengEnter(); return; }

  /* 길고양이 */
  if(streetCat.active){
    const d=Math.abs(wrapDelta(streetCat.x - player.x, WLOOP));
    if(d<12){
      spawnHeart(worldToScreen(streetCat.x), SIDEWALK_Y-12);
      toast(catToasts++===0?'야옹.':'…야옹?');
      sfxBlip(880); return;
    }
  }

  /* 거리 소품 > named 가게 문(입장) > 절차생성 문(불 토글) — findInteract 우선순위 */
  const hit=findInteract(player.x);
  if(hit){
    if(hit.type==='door'){
      // named building 문: 임베드면 건물 입장 트리거, 독립 실행은 기존 불 토글로 폴백
      if(hit.obj.named && window.__FMC_EMBED__ && typeof fmcOpts.onEnterBuilding==='function'){
        fmcOpts.onEnterBuilding(hit.obj.named.id); sfxBlip(740); return;
      }
      hit.obj.boost = hit.obj.boost?0:1;
      sfxBlip(hit.obj.boost?740:490);
      return;
    }
    const p=hit.obj;
    if(p.kind==='lamp'){
      p.on = !lampIsOn(p, GS.pal); sfxBlip(p.on?660:440);
    }
    else if(p.kind==='bench'){
      player.sitting=p; player.x=p.x; sfxBlip(520);
      if(!benchHintShown){ toast('시간이 빨리 흘러요'); benchHintShown=true; }
    }
    else if(p.kind==='vend'){
      const [line, ok]=VEND_LINES[(Math.random()*VEND_LINES.length)|0];
      toast(line);
      if(ok){ GS.cans++; refreshStats(); sfxBlip(980); }
      else sfxBlip(220);
    }
    else if(p.kind==='bus'){
      toast(BUS_LINES[(Math.random()*BUS_LINES.length)|0]); sfxBlip(390);
    }
    return;
  }

  /* 위 어떤 대상도 없을 때만: 밤하늘 별자리 잇기 */
  if(GS.pal && GS.pal.night>.5){ if(skyEnter()) return; }
}

/* SPACE / ↑ 를 현재 모드에 맞게 라우팅 */
function actionPrimary(){        // ↑ / interact
  if(GS.mode==='stall'){ stallAction(); return; }
  if(GS.mode==='odeng'){ if(odeng.phase==='result') odengExit(); return; }
  if(GS.mode==='sky'){ return; } // 별자리는 클릭으로
  tryInteract();
}
function actionJump(){           // SPACE
  if(GS.mode==='stall'){ stallAction(); return; }
  if(GS.mode==='odeng'){ if(odeng.phase==='result') odengExit(); return; }
  if(GS.mode==='roam'){ playerJump(); return; }
}

/* ============================================================
   키보드 (대시: 방향키 더블탭 + Shift)
   ============================================================ */
let lastTap={left:0, right:0};
const DOUBLE_MS=260;

function onKeyDown(e){
  if(fmcPaused) return;            // pause 중 입력 무시
  // 오버레이(작성 등)가 열려 있으면 게임 조작 차단 (ESC/닫기만)
  if(anyOverlayOpen()){
    if(e.code==='Escape'){
      document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
      if(GS.mode==='board'||GS.mode==='writing') GS.mode='roam';
    }
    return;
  }

  // 오뎅 장사 중엔 미니게임이 키 입력을 가져감
  if(GS.mode==='odeng'){ odengKey(e.code); e.preventDefault(); return; }

  switch(e.code){
    case 'ArrowLeft':
      if(!input.left){ const n=performance.now();
        if(n-lastTap.left<DOUBLE_MS){ player.dir=-1; playerDash(); }
        lastTap.left=n; }
      input.left=true; e.preventDefault(); break;
    case 'ArrowRight':
      if(!input.right){ const n=performance.now();
        if(n-lastTap.right<DOUBLE_MS){ player.dir=1; playerDash(); }
        lastTap.right=n; }
      input.right=true; e.preventDefault(); break;
    case 'ShiftLeft': case 'ShiftRight':
      input.shift=true; e.preventDefault(); break;   // 홀드 스프린트 (떼면 걷기)
    case 'ArrowUp': case 'KeyZ': case 'Enter':
      if(!e.repeat) actionPrimary(); e.preventDefault(); break;
    case 'Space':
      if(!e.repeat) actionJump(); e.preventDefault(); break;
    case 'Escape':
      if(GS.mode==='sky') skyExit();
      else if(GS.mode==='stall') stallExit();
      else if(delivActive()) delivCancel();
      break;
    case 'KeyP': openColl(); break;
    case 'KeyR':
      GS.rain=!GS.rain; if(AC) setRainAudio(GS.rain);
      toast(GS.rain?'비가 내려요 ☂':'비가 그쳤어요'); break;
    case 'KeyM': toggleSound(); break;
    case 'Digit1': jumpTime(0);    break;
    case 'Digit2': jumpTime(0.25); break;
    case 'Digit3': jumpTime(0.5);  break;
    case 'Digit4': jumpTime(0.75); break;
  }
}
function onKeyUp(e){
  if(fmcPaused) return;
  if(e.code==='ArrowLeft')  input.left=false;
  if(e.code==='ArrowRight') input.right=false;
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){ input.shift=false; player.sprint=false; }
}
function jumpTime(target){
  GS.tOff=(target-(GS.dayTime/DAY)%1+2)%1; sfxBlip(660);
}

/* ============================================================
   터치 컨트롤
   ============================================================ */
function wireTouch(){
  if(matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window)
    document.body.classList.add('is-touch');
  /* #fmc-root 는 position:fixed → z-auto 스태킹 컨텍스트라 그 내부 z-index 로는
     호스트 HUD(z-40) 위로 못 올라간다. 터치 컨트롤을 #fmc-root 밖(부모=임베드
     컨테이너 / 독립 실행 body)으로 옮겨 루트 컨텍스트에서 z-60 이 먹게 한다.
     부모가 임베드 컨테이너면 건물 입장 시 display 토글도 함께 따라간다. */
  const touchEl = $('touch');
  const host = $('fmc-root') && $('fmc-root').parentNode;
  if(touchEl && host && touchEl.parentNode !== host) host.appendChild(touchEl);
  document.querySelectorAll('.tbtn').forEach(b=>{
    const k=b.dataset.k;
    const down=e=>{ e.preventDefault();
      if(fmcPaused) return;
      if(k==='left'){ const n=performance.now();
        if(n-lastTap.left<DOUBLE_MS){ player.dir=-1; playerDash(); } lastTap.left=n;
        input.left=true; }
      else if(k==='right'){ const n=performance.now();
        if(n-lastTap.right<DOUBLE_MS){ player.dir=1; playerDash(); } lastTap.right=n;
        input.right=true; }
      else if(k==='dash') input.shift=true;   // ⇧ 와 동일: 누르는 동안 스프린트 유지
      else if(k==='interact') actionPrimary();
      else if(k==='jump') actionJump();
    };
    const up=e=>{ e.preventDefault();
      if(k==='left')input.left=false;
      if(k==='right')input.right=false;
      if(k==='dash'){ input.shift=false; player.sprint=false; }
    };
    reg(b,'pointerdown',down);
    reg(b,'pointerup',up);
    reg(b,'pointercancel',up);
    reg(b,'pointerleave',up);
  });
}

/* ============================================================
   캔버스 클릭: 별자리(모드) · 밤하늘 소원 · 지붕 고양이
   ============================================================ */
function toScene(e){
  const r=cv.getBoundingClientRect();
  return { x:(e.clientX-r.left)/r.width*W, y:(e.clientY-r.top)/r.height*H };
}
function onCanvasPointer(e){
  if(fmcPaused) return;
  if(anyOverlayOpen()) return;
  const p=toScene(e);

  // 별자리 모드: 별 선택
  if(GS.mode==='sky'){ skyClick(p.x,p.y); return; }
  // 오뎅 장사 모드: 냄비 칸 서빙
  if(GS.mode==='odeng'){ odengClick(p.x,p.y); return; }
  if(GS.mode==='stall') return;

  // 오뎅바 클릭 → 메뉴 열기
  {
    const osx=worldToScreen(LM.odeng);
    if(Math.abs(p.x-osx)<38 && p.y>SIDEWALK_Y-58 && p.y<SIDEWALK_Y+4){
      odengEnter(); return;
    }
  }

  // 지붕 고양이
  const rc=roofCatScreenPos();
  if(rc && Math.abs(p.x-rc.sx)<10 && Math.abs(p.y-(rc.sy-3))<10){
    spawnHeart(rc.sx, rc.sy-8);
    toast(catToasts++===0?'야옹.':'…야옹?'); sfxBlip(880);
    return;
  }
  // 밤하늘 소원
  if(p.y<HORIZON-30 && GS.pal && GS.pal.night>.55){
    spawnShot(p.x,p.y);
    GS.wishes++; refreshStats(); sfxBlip(1200);
  }
}

/* ---------- 비 파티클 ---------- */
const drops=[];
for(let i=0;i<110;i++) drops.push({x:Math.random()*W, y:Math.random()*H, v:150+Math.random()*90});
function drawRain(dt){
  ctx.fillStyle='rgba(10,14,34,.14)'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(190,210,255,.4)'; ctx.lineWidth=1; ctx.beginPath();
  for(const d of drops){
    d.y+=d.v*dt; d.x-=d.v*.18*dt;
    if(d.y>H){ d.y=-6; d.x=Math.random()*(W+40); }
    ctx.moveTo(d.x,d.y); ctx.lineTo(d.x-1.2,d.y+6);
  }
  ctx.stroke();
}

/* ============================================================
   메인 루프
   ============================================================ */
let last=0, dayToastDone=false;

function frame(now){
  const dt=Math.min((now-last)/1000,.05); last=now;
  GS.now=now; GS.dt=dt;
  GS.elapsed+=dt;

  // sky/stall 모드나 오버레이(수집 패널 등)가 열려 있으면 이동 정지, 시간은 계속 흐름
  const roaming = GS.mode==='roam' && !anyOverlayOpen();
  // 오뎅 장사 중엔 밤이 지나가버리지 않게 시간 정지
  if(GS.mode!=='odeng') GS.dayTime+=dt*GS.timeScale;
  GS.t=(GS.dayTime/DAY+GS.tOff)%1;
  const pal=GS.pal=palette(GS.t);

  if(roaming) updatePlayer(dt);
  else GS.timeScale=1;

  updateBoard(dt);
  if(GS.mode==='stall') updateStall(dt);
  if(GS.mode==='odeng') updateOdeng(dt);
  updateDelivery(dt);

  /* HUD 시계 */
  const hrs=(6+GS.t*24)%24, hh=hrs|0, mm=((hrs-hh)*60)|0;
  const ap=hh<12?'AM':'PM', h12=((hh+11)%12)+1;
  elClock.textContent=`${ap} ${String(h12).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  elPhase.textContent=phaseName(GS.t,pal.night);

  if(!dayToastDone && GS.dayTime>DAY){
    dayToastDone=true;
    toast('이 도시의 하루가 지났어요 ✦\n머물러줘서 고마워요');
  }

  /* ----- 렌더 ----- */
  ctx.setTransform(cv.width/W, 0, 0, cv.height/H, 0, 0);
  ctx.imageSmoothingEnabled=false;
  drawSky(ctx,pal,GS.t,now);
  updateDrawShots(ctx,dt);
  updateDrawPlane(ctx,pal,now,dt);
  drawClouds(ctx,pal,dt);
  updateDrawBirds(ctx,pal,dt);

  drawBuildingLayer(ctx,layers[0],pal);
  updateDrawTrain(ctx,pal,dt);
  drawBuildingLayer(ctx,layers[1],pal);
  drawBuildingLayer(ctx,layers[2],pal);
  updateDrawRoofCat(ctx,pal,now,dt);

  drawGround(ctx,pal);
  drawBoard(ctx,pal,now);
  drawStall(ctx,pal,now);
  drawOdengStall(ctx,pal,now);
  drawScooter(ctx,pal,now);
  drawProps(ctx,pal,now);
  updateDrawStreetCat(ctx,pal,now,dt);
  drawRemotePlayers(ctx, now);        // 원격 플레이어 (내 캐릭터 직전)
  drawPlayer(ctx,pal,now);
  drawSelfOverlay(ctx, now);          // 내 이름표 + 말풍선
  updateDrawHearts(ctx,dt);
  drawDeliveryWorld(ctx,pal,now);

  /* 상호작용 말풍선 (roam 한정) */
  if(roaming){
    if(player.sitting){
      drawInteractBubble(ctx, player.sitting.x, SIDEWALK_Y-6, now);
    } else {
      let shown=false;
      // 랜드마크 우선
      if(Math.abs(wrapDelta(LM.board-player.x,WLOOP))<14){
        drawInteractBubble(ctx, LM.board, SIDEWALK_Y-50, now); shown=true;
      } else if(stallIsOpen(pal) && Math.abs(wrapDelta(LM.stall-player.x,WLOOP))<16){
        drawInteractBubble(ctx, LM.stall, SIDEWALK_Y-36, now); shown=true;
      } else if(odengIsOpen(pal) && Math.abs(wrapDelta(LM.odeng-player.x,WLOOP))<18){
        drawInteractBubble(ctx, LM.odeng, SIDEWALK_Y-52, now); shown=true;
      }
      // 스쿠터는 delivery.js가 '↑ 배달 알바' 텍스트 힌트를 직접 그림
      if(!shown && streetCat.active){
        const d=Math.abs(wrapDelta(streetCat.x-player.x,WLOOP));
        if(d<12){ drawInteractBubble(ctx,streetCat.x,SIDEWALK_Y+14,now); shown=true; }
      }
      if(!shown){
        const hit=findInteract(player.x);
        if(hit) drawInteractBubble(ctx, hit.wx,
          hit.type==='door'?HORIZON+4:SIDEWALK_Y+2, now);
        else if(pal.night>.5)   // 밤하늘 별자리 힌트
          drawInteractBubble(ctx, player.x, HORIZON-40, now);
      }
    }
  }

  if(GS.rain) drawRain(dt);

  /* 미니게임 오버레이 */
  updateDrawSky(ctx, now, dt);
  drawStallUI(ctx, now);
  drawOdengUI(ctx, now);

  /* 비네트 */
  const v=ctx.createRadialGradient(W/2,H/2,H*.55,W/2,H/2,H*1.05);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,10,.35)');
  ctx.fillStyle=v; ctx.fillRect(0,0,W,H);

  pollCounters();                    // 임베드: 수집 카운터 변경 통지/저장
  rafId = requestAnimationFrame(frame);
}

/* ============================================================
   원격 플레이어 / 이름표 / 말풍선  (임베드 멀티플레이 렌더)
   ============================================================ */
function drawRemotePlayers(ctx, now){
  if(!remotePlayers.length) return;
  for(const rp of remotePlayers){
    const sx = worldToScreen(rp.x)|0;
    if(sx<-20 || sx>W+20) continue;
    const anim = rp.walking ? now*0.01 : 0;
    drawFigure(ctx, sx, SIDEWALK_Y, rp.dir||1, !!rp.walking, anim, rp.colors, false);
    if(rp.name) drawNameTag(ctx, sx, SIDEWALK_Y-18, rp.name);
    const b = bubbles.get(rp.id);
    if(b && b.until>now) drawSpeechBubble(ctx, sx, SIDEWALK_Y-24, b.text);
  }
}
function drawSelfOverlay(ctx, now){
  const sx = worldToScreen(player.x)|0;
  const fy = SIDEWALK_Y + player.y;
  if(selfName) drawNameTag(ctx, sx, fy-18, selfName);
  const b = bubbles.get('self');
  if(b && b.until>now) drawSpeechBubble(ctx, sx, fy-24, b.text);
}
/* 이름표/말풍선/간판은 월드(480×270) 안에서 6~7px 로 그린 뒤 비정수 배율로 확대되면
   픽셀 폰트여도 뭉개진다. → 디바이스(백킹 스토어) 좌표계에서 직접, Galmuri 네이티브
   크기의 정수배로 그린다. (setTransform 초기화 후 좌표는 월드×배율, 정수 반올림) */
function drawNameTag(ctx, sx, y, name){
  const dsx=cv.width/W, dsy=cv.height/H, ds=dsx;
  const fs = 9 * Math.max(1, Math.round(ds*6/9));       // Galmuri9 정수배 (≈6px×ds)
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.font = fs+"px 'Galmuri9', monospace";
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  const px=Math.round(sx*dsx), py=Math.round(y*dsy);
  const tw=Math.ceil(ctx.measureText(name).width);
  const padX=Math.round(fs/3);                          // 원본 2px(@6px) 비율
  ctx.fillStyle='rgba(10,12,28,.55)';
  ctx.fillRect(px-((tw>>1)+padX), py-fs, tw+padX*2, Math.round(fs*4/3));
  ctx.fillStyle='rgba(255,255,255,.92)';
  ctx.fillText(name, px, py);
  ctx.restore();
}
function drawSpeechBubble(ctx, sx, y, text){
  const dsx=cv.width/W, dsy=cv.height/H, ds=dsx;
  const fs = 9 * Math.max(1, Math.round(ds*6/9));       // Galmuri9 정수배
  const bd = Math.max(1, Math.round(ds));               // 테두리 두께
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.font = fs+"px 'Galmuri9', monospace";
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  const px=Math.round(sx*dsx), y0=Math.round(y*dsy);
  const tw=Math.min(Math.ceil(ctx.measureText(text).width), Math.round(150*ds));
  const padX=Math.round(fs*2/3);                        // 원본 4px(@6px)
  const bw=tw+padX*2, bh=Math.round(fs*2);             // 원본 12px(@6px)=fs*2
  const bx=px-(bw>>1), by=y0-bh;
  ctx.fillStyle='rgba(255,255,255,.95)';
  ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle='rgba(10,12,28,.45)';                   // 픽셀 테두리
  ctx.fillRect(bx,by,bw,bd); ctx.fillRect(bx,by+bh-bd,bw,bd);
  ctx.fillRect(bx,by,bd,bh); ctx.fillRect(bx+bw-bd,by,bd,bh);
  ctx.fillStyle='rgba(255,255,255,.95)';                // 꼬리
  const tail=Math.round(2*ds);
  ctx.fillRect(px-(tail>>1),by+bh,tail,tail);
  ctx.fillStyle='#1a1e3c';
  ctx.fillText(text, px, by+Math.round(fs*4/3));        // 원본 baseline by+8(@6px)
  ctx.restore();
}

/* FMC 훅: 임베드 쪽이 호출 (embed.js 경유) */
function fmcSetRemotePlayers(list){ remotePlayers = Array.isArray(list)?list:[]; }
function fmcShowBubble(id, text){
  bubbles.set(id, { text:String(text).slice(0,40), until: performance.now()+4500 });
}
function fmcSetSelfName(name){ selfName = String(name||''); }
function fmcGetSelfState(){ return { x:player.x, dir:player.dir, walking:player.walking }; }

/* ============================================================
   수집 카운터 감시  (임베드 전용: store + onCityEvent)
   ------------------------------------------------------------
   프레임마다 스냅샷을 비교해 변경 시 즉시 onCityEvent(kind) 통지 +
   5초 디바운스로 store.saveCollections(). 독립 실행은 아무것도 안 함.
   ============================================================ */
const COUNTER_KIND = { wishes:'wish', cans:'can', fish:'fish', odengSold:'odeng',
                       deliveries:'delivery', coins:'coin', readNotes:'note' };
let prevSnap=null, countersReady=false, saveTimer=0;

function snapshotCollections(){
  return {
    wishes:GS.wishes, cans:GS.cans, fish:GS.fish, odengSold:GS.odengSold,
    deliveries:GS.deliveries, coins:GS.coins, readNotes:GS.readNotes,
    constellations: GS.constellations.slice(),
  };
}
function restoreCollections(c){
  if(!c) return;
  for(const k of Object.keys(COUNTER_KIND)) if(typeof c[k]==='number') GS[k]=c[k];
  if(Array.isArray(c.constellations)) GS.constellations = c.constellations.slice();
  if(elWish) refreshStats();
}
function scheduleSave(){
  const st=fmcOpts.store;
  if(!st || typeof st.saveCollections!=='function') return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{ try{ st.saveCollections(snapshotCollections()); }catch(e){} }, 5000);
}
function pollCounters(){
  if(!countersReady || !fmcOpts.store) return;
  const s = snapshotCollections();
  let changed=false;
  for(const k in COUNTER_KIND){
    if(s[k]!==prevSnap[k]){ changed=true;
      if(typeof fmcOpts.onCityEvent==='function') fmcOpts.onCityEvent(COUNTER_KIND[k]); }
  }
  if(s.constellations.length!==prevSnap.constellations.length){ changed=true;
    if(typeof fmcOpts.onCityEvent==='function') fmcOpts.onCityEvent('constellation'); }
  if(changed){ prevSnap=s; scheduleSave(); }
}
function applyStore(){
  const st=fmcOpts.store;
  if(!st){ return; }                 // 독립 실행: 수집 저장/통지 없음
  Promise.resolve()
    .then(()=> typeof st.loadCollections==='function' ? st.loadCollections() : null)
    .then(c=>{ restoreCollections(c); })
    .catch(()=>{})
    .then(()=>{ prevSnap = snapshotCollections(); countersReady = true; });
}

/* ============================================================
   부트 / 루프 제어 / pause / resume / destroy
   ============================================================ */
function wireHud(){
  document.querySelectorAll('[data-close]').forEach(b=>
    reg(b,'click',()=>{
      closeOverlay(b.dataset.close);
      // 오버레이가 모두 닫히면 게임 조작(roam)으로 복귀 — 안 하면 캐릭터가 멈춤
      if(!anyOverlayOpen() && (GS.mode==='board'||GS.mode==='writing')) GS.mode='roam';
    }));
  reg($('notePrev'),'click',()=>{
    boardIndex=(boardIndex-1+boardNotes.length)%boardNotes.length; renderNote(); sfxBlip(500);
  });
  reg($('noteNext'),'click',()=>{
    boardIndex=(boardIndex+1)%boardNotes.length; renderNote(); sfxBlip(560);
  });
  reg($('writeBtn'),'click',()=>{ closeOverlay('boardOv'); openWrite(); });
  reg($('noteInput'),'input',e=>{ $('charCount').textContent=`${e.target.value.length} / 60`; });
  reg($('pinBtn'),'click',()=>{
    const v=$('noteInput').value;
    if(v.trim()){ addPlayerNote(v); sfxBlip(880); toast('게시판에 붙였어요 ✎'); }
    closeOverlay('writeOv'); openBoard();
  });
  reg($('collBtn'),'click',openColl);
}

function startLoop(){
  last = performance.now();
  rafId = requestAnimationFrame(frame);
}

function fmcStart(){
  grabRefs();
  reg(window,'resize',fit); fit();
  reg(window,'keydown',onKeyDown);
  reg(window,'keyup',onKeyUp);
  reg(cv,'pointerdown',onCanvasPointer);
  wireHud();
  wireTouch();

  fmcTimers.push(setTimeout(cycleHint,2200));
  fmcTimers.push(setInterval(cycleHint,13000));

  GS.pal = palette(GS.tOff);
  loadCityImage();          // ASSET_BASE 확정 후 파사드 시트 로드 (실패 시 사각형 폴백)
  loadPlayerNotes();
  rebuildBoard();
  applyStore();

  fmcPaused = false;
  startLoop();
}

function fmcPause(){
  if(fmcPaused) return;
  fmcPaused = true;
  if(rafId){ cancelAnimationFrame(rafId); rafId=0; }
  input.left=false; input.right=false; input.shift=false; player.sprint=false;   // 눌린 키/스프린트 고착 방지
}
function fmcResume(){
  if(!fmcPaused) return;
  fmcPaused = false;
  startLoop();
}
function fmcDestroy(){
  fmcPaused = true;
  if(rafId){ cancelAnimationFrame(rafId); rafId=0; }
  clearTimeout(saveTimer);
  for(const t of fmcTimers){ clearTimeout(t); clearInterval(t); }
  fmcTimers.length=0;
  for(const l of fmcListeners){ try{ l.target.removeEventListener(l.type,l.fn); }catch(e){} }
  fmcListeners.length=0;
  // wireTouch 가 #fmc-root 밖으로 옮긴 터치 컨트롤 정리(#fmc-root 제거만으론 안 지워짐)
  const te=$('touch'); if(te && te.parentNode){ te.parentNode.removeChild(te); }
}

/* 독립 실행(index.html)은 여기서 자동 부트. 임베드는 FMC.boot 가 호출. */
if(!window.__FMC_EMBED__) fmcStart();
