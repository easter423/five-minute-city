'use strict';
/* ============================================================
   5분 도시 — main.js
   부트 · 입력 · 상호작용 · HUD · 메인 루프
   ============================================================ */

const cv = document.getElementById('scene');
const ctx = cv.getContext('2d');

/* ---------- HUD refs ---------- */
const $ = id => document.getElementById(id);
const elClock=$('clock'), elPhase=$('phase'),
      elWish=$('wishcount'), elCan=$('cancount'),
      elHint=$('hint'), elToast=$('toast');

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
  '현관문 앞에서 ↑ 를 누르면 불이 켜져요',
  '벤치에 앉으면 시간이 빨리 흘러요',
  '밤하늘을 클릭하면 별똥별이 떨어져요',
  '지붕 위를 잘 살펴보세요',
  '길고양이를 만나면 인사해 주세요',
  '숫자키 1–4 로 시간대를 바꿀 수 있어요',
];
let hintIdx=0;
function cycleHint(){
  elHint.style.opacity=0;
  setTimeout(()=>{ elHint.textContent=HINTS[hintIdx++%HINTS.length];
    elHint.style.opacity=.85; },1300);
}
setTimeout(cycleHint,2200); setInterval(cycleHint,13000);

/* ---------- 상호작용 ---------- */
const VEND_LINES=[
  ['따뜻한 캔커피를 뽑았다 ☕',true],
  ['달칵. 밀크티가 나왔다',true],
  ['차가운 사이다가 나왔다',true],
  ['꽝. 동전만 삼켰다…',false],
];
const BUS_LINES=['버스는 오지 않는다','막차는 이미 떠났다','노선표가 빛바래 있다'];
let benchHintShown=false, catToasts=0;

function tryInteract(){
  /* 앉아 있으면 일어난다 */
  if(player.sitting){ playerStand(); sfxBlip(490); return; }

  /* 길고양이 */
  if(streetCat.active){
    const d=Math.abs(wrapDelta(streetCat.x - player.x, WLOOP));
    if(d<12){
      spawnHeart(worldToScreen(streetCat.x), SIDEWALK_Y-12);
      toast(catToasts++===0?'야옹.':'…야옹?');
      sfxBlip(880); return;
    }
  }

  const hit=findInteract(player.x);
  if(!hit) return;

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
    if(ok){ GS.cans++; elCan.textContent=GS.cans; sfxBlip(980); }
    else sfxBlip(220);
  }
  else if(p.kind==='bus'){
    toast(BUS_LINES[(Math.random()*BUS_LINES.length)|0]); sfxBlip(390);
  }
}

/* ---------- 키보드 ---------- */
addEventListener('keydown',e=>{
  switch(e.code){
    case 'ArrowLeft':  input.left=true;  e.preventDefault(); break;
    case 'ArrowRight': input.right=true; e.preventDefault(); break;
    case 'ArrowUp': case 'KeyZ':
      if(!e.repeat) tryInteract(); e.preventDefault(); break;
    case 'Space':
      if(!e.repeat) playerJump(); e.preventDefault(); break;
    case 'KeyR':
      GS.rain=!GS.rain; if(AC) setRainAudio(GS.rain); break;
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

/* ---------- 터치 컨트롤 ---------- */
if(matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window)
  document.body.classList.add('is-touch');
document.querySelectorAll('.tbtn').forEach(b=>{
  const k=b.dataset.k;
  const down=e=>{ e.preventDefault();
    if(k==='left')input.left=true;
    else if(k==='right')input.right=true;
    else if(k==='interact')tryInteract();
    else if(k==='jump')playerJump();
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

/* ---------- 캔버스 클릭: 밤하늘 소원 · 지붕 고양이 ---------- */
function toScene(e){
  const r=cv.getBoundingClientRect();
  return { x:(e.clientX-r.left)/r.width*W, y:(e.clientY-r.top)/r.height*H };
}
cv.addEventListener('pointerdown',e=>{
  const p=toScene(e);
  const rc=roofCatScreenPos();
  if(rc && Math.abs(p.x-rc.sx)<10 && Math.abs(p.y-(rc.sy-3))<10){
    spawnHeart(rc.sx, rc.sy-8);
    toast(catToasts++===0?'야옹.':'…야옹?'); sfxBlip(880);
    return;
  }
  if(p.y<HORIZON-30 && GS.pal && GS.pal.night>.55){
    spawnShot(p.x,p.y);
    GS.wishes++; elWish.textContent=GS.wishes; sfxBlip(1200);
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

/* ---------- 메인 루프 ---------- */
GS.pal = palette(GS.tOff);
let last=performance.now(), dayToastDone=false;
function frame(now){
  const dt=Math.min((now-last)/1000,.05); last=now;
  GS.now=now; GS.dt=dt;
  GS.elapsed+=dt;
  GS.dayTime+=dt*GS.timeScale;
  GS.t=(GS.dayTime/DAY+GS.tOff)%1;
  const pal=GS.pal=palette(GS.t);

  updatePlayer(dt);

  /* HUD 시계: t=0 → 06:00 */
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
  drawProps(ctx,pal,now);
  updateDrawStreetCat(ctx,pal,now,dt);
  drawPlayer(ctx,pal,now);
  updateDrawHearts(ctx,dt);

  /* 상호작용 말풍선 */
  if(player.sitting){
    drawInteractBubble(ctx, player.sitting.x, SIDEWALK_Y-6, now);
  } else {
    let shown=false;
    if(streetCat.active){
      const d=Math.abs(wrapDelta(streetCat.x-player.x,WLOOP));
      if(d<12){ drawInteractBubble(ctx,streetCat.x,SIDEWALK_Y+14,now); shown=true; }
    }
    if(!shown){
      const hit=findInteract(player.x);
      if(hit) drawInteractBubble(ctx, hit.wx,
        hit.type==='door'?HORIZON+4:SIDEWALK_Y+2, now);
    }
  }

  if(GS.rain) drawRain(dt);

  /* 비네트 */
  const v=ctx.createRadialGradient(W/2,H/2,H*.55,W/2,H/2,H*1.05);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,10,.35)');
  ctx.fillStyle=v; ctx.fillRect(0,0,W,H);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
