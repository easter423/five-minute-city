'use strict';
/* ============================================================
   5분 도시 — main.js
   부트 · 입력(대시 포함) · 상호작용/모드 라우팅 · 오버레이 · HUD · 루프
   ============================================================ */

const cv = document.getElementById('scene');
const ctx = cv.getContext('2d');

/* ---------- HUD refs ---------- */
const $ = id => document.getElementById(id);
const elClock=$('clock'), elPhase=$('phase'),
      elWish=$('wishcount'), elCan=$('cancount'), elFish=$('fishcount'),
      elOdeng=$('odengcount'), elCoin=$('coincount'),
      elHint=$('hint'), elToast=$('toast');

function refreshStats(){
  elWish.textContent=GS.wishes; elCan.textContent=GS.cans; elFish.textContent=GS.fish;
  elOdeng.textContent=GS.odengSold; elCoin.textContent=GS.coins.toLocaleString();
}

/* ---------- 리사이즈 (cover) ---------- */
function fit(){
  const s=Math.max(innerWidth/W, innerHeight/H);
  cv.style.width=W*s+'px'; cv.style.height=H*s+'px';
}
addEventListener('resize',fit); fit();

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
setTimeout(cycleHint,2200); setInterval(cycleHint,13000);

/* ============================================================
   오버레이 관리
   ============================================================ */
function openOverlay(id){ $(id).classList.add('open'); }
function closeOverlay(id){ $(id).classList.remove('open'); }
function anyOverlayOpen(){ return document.querySelector('.overlay.open')!==null; }

document.querySelectorAll('[data-close]').forEach(b=>
  b.addEventListener('click',()=>{
    closeOverlay(b.dataset.close);
    // 오버레이가 모두 닫히면 게임 조작(roam)으로 복귀 — 안 하면 캐릭터가 멈춤
    if(!anyOverlayOpen() && (GS.mode==='board'||GS.mode==='writing')) GS.mode='roam';
  }));

/* ---------- 게시판 읽기 ---------- */
function openBoard(){
  rebuildBoard();
  boardIndex=0;
  GS.mode='board';
  renderNote();
  openOverlay('boardOv');
}
function renderNote(){
  const n=boardNotes[boardIndex] || {t:'—',mine:false};
  const view=$('noteView');
  view.className='note'+(n.mine?' mine':'');
  view.innerHTML = escapeHtml(n.t) +
    `<span class="who">— ${n.mine?'나':'이웃'}</span>`;
  $('notePos').textContent=`${boardIndex+1} / ${boardNotes.length}`;
  if(!n._seen){ n._seen=true; GS.readNotes++; }
}
$('notePrev').addEventListener('click',()=>{
  boardIndex=(boardIndex-1+boardNotes.length)%boardNotes.length; renderNote(); sfxBlip(500);
});
$('noteNext').addEventListener('click',()=>{
  boardIndex=(boardIndex+1)%boardNotes.length; renderNote(); sfxBlip(560);
});
$('writeBtn').addEventListener('click',()=>{ closeOverlay('boardOv'); openWrite(); });

/* ---------- 쪽지 작성 ---------- */
function openWrite(){
  GS.mode='writing';
  $('noteInput').value=''; $('charCount').textContent='0 / 60';
  openOverlay('writeOv');
  setTimeout(()=>$('noteInput').focus(),50);
}
$('noteInput').addEventListener('input',e=>{
  $('charCount').textContent=`${e.target.value.length} / 60`;
});
$('pinBtn').addEventListener('click',()=>{
  const v=$('noteInput').value;
  if(v.trim()){ addPlayerNote(v); sfxBlip(880); toast('게시판에 붙였어요 ✎'); }
  closeOverlay('writeOv'); openBoard();
});

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
$('collBtn').addEventListener('click',openColl);

function escapeHtml(s){ return s.replace(/[&<>"]/g,c=>
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

  /* 밤이면 하늘: 별자리 잇기 진입 */
  if(GS.pal && GS.pal.night>.5 && !findInteract(player.x)){
    if(skyEnter()) return;
  }

  const hit=findInteract(player.x);
  if(!hit){
    // 낮이면 살펴봐도 하늘엔 아무것도, 아무 반응 없이 종료
    return;
  }
  if(hit.type==='door'){
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

addEventListener('keydown',e=>{
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
      playerDash(); e.preventDefault(); break;
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
});
addEventListener('keyup',e=>{
  if(e.code==='ArrowLeft')  input.left=false;
  if(e.code==='ArrowRight') input.right=false;
});
function jumpTime(target){
  GS.tOff=(target-(GS.dayTime/DAY)%1+2)%1; sfxBlip(660);
}

/* ============================================================
   터치 컨트롤
   ============================================================ */
if(matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window)
  document.body.classList.add('is-touch');
document.querySelectorAll('.tbtn').forEach(b=>{
  const k=b.dataset.k;
  const down=e=>{ e.preventDefault();
    if(k==='left'){ const n=performance.now();
      if(n-lastTap.left<DOUBLE_MS){ player.dir=-1; playerDash(); } lastTap.left=n;
      input.left=true; }
    else if(k==='right'){ const n=performance.now();
      if(n-lastTap.right<DOUBLE_MS){ player.dir=1; playerDash(); } lastTap.right=n;
      input.right=true; }
    else if(k==='dash') playerDash();
    else if(k==='interact') actionPrimary();
    else if(k==='jump') actionJump();
  };
  const up=e=>{ e.preventDefault();
    if(k==='left')input.left=false;
    if(k==='right')input.right=false;
  };
  b.addEventListener('pointerdown',down);
  b.addEventListener('pointerup',up);
  b.addEventListener('pointercancel',up);
  b.addEventListener('pointerleave',up);
});

/* ============================================================
   캔버스 클릭: 별자리(모드) · 밤하늘 소원 · 지붕 고양이
   ============================================================ */
function toScene(e){
  const r=cv.getBoundingClientRect();
  return { x:(e.clientX-r.left)/r.width*W, y:(e.clientY-r.top)/r.height*H };
}
cv.addEventListener('pointerdown',e=>{
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
});

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
GS.pal = palette(GS.tOff);
loadPlayerNotes();
rebuildBoard();
let last=performance.now(), dayToastDone=false;

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
  drawPlayer(ctx,pal,now);
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

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
