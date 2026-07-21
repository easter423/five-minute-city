'use strict';
/* ============================================================
   5분 도시 — stall.js
   붕어빵 포장마차 (밤에만 열림)
   앉으면 굽기 시퀀스 진행:
   1) SPACE/↑ 로 반죽 붓기
   2) 굽는 게이지가 'GOOD' 구간일 때 뒤집기
   3) 다시 게이지가 GOOD일 때 꺼내기
   완벽 타이밍이면 노릇, 늦으면 탐. 다 구우면 캐릭터가 먹음(김).
   ============================================================ */

let stall = {
  open:false,
  phase:'idle',    // idle | pour | grill1 | flip | grill2 | done | eat
  g:0,             // 게이지 0..1
  gdir:1,
  quality:1,       // 1=노릇, .5=탐
  eatT:0,
  phaseT:0,        // 현재 phase 경과(초) — flip/done 자동 전이용
  steam:[],
};

function stallIsOpen(pal){ return pal.night>.5; }

function stallEnter(){
  if(!GS.pal || !stallIsOpen(GS.pal)){
    toast('포장마차는 밤에 열려요'); return false;
  }
  GS.mode='stall';
  stall.phase='pour'; stall.g=0; stall.gdir=1; stall.quality=1; stall.phaseT=0;
  player.x = LM.stall; player.sitting=null;
  toast('붕어빵 굽기!\nSPACE 로 반죽을 부어요');
  return true;
}
function stallExit(){ GS.mode='roam'; stall.phase='idle'; }

/* SPACE/↑ 입력 (main에서 라우팅) */
function stallAction(){
  const s=stall;
  if(s.phase==='pour'){
    s.phase='grill1'; s.g=0; s.gdir=1; s.phaseT=0; sfxBlip(520);
  }
  else if(s.phase==='grill1'){
    if(s.g>=.55 && s.g<=.82){ sfxBlip(720); }   // GOOD
    else { s.quality*=.5; sfxBlip(240); }
    s.phase='flip'; s.phaseT=0;                  // grill2로는 updateStall이 넘김
  }
  else if(s.phase==='grill2'){
    if(!(s.g>=.55 && s.g<=.82)) s.quality*=.5;
    s.phase='done'; s.phaseT=0; sfxBlip(980);    // eat으로는 updateStall이 넘김
  }
  else if(s.phase==='eat'){
    stallExit();                                 // 스킵
  }
}

function startEat(){
  stall.phase='eat'; stall.eatT=0; stall.steam=[];
  GS.fish++;
  const msg = stall.quality>=1 ? '노릇하게 잘 구웠다 🐟' :
              stall.quality>=.5 ? '살짝 탔지만 맛있다' : '숯이 됐다… 그래도 먹는다';
  toast(msg);
}

function updateStall(dt){
  const s=stall;
  s.phaseT+=dt;
  if(s.phase==='grill1'||s.phase==='grill2'){
    s.g += s.gdir*dt*0.55;
    if(s.g>=1){ s.g=1; s.gdir=-1; }
    if(s.g<=0){ s.g=0; s.gdir=1; }
  }
  else if(s.phase==='flip' && s.phaseT>0.35){
    s.phase='grill2'; s.g=0; s.gdir=1; s.phaseT=0;
  }
  else if(s.phase==='done' && s.phaseT>0.5){
    startEat();
  }
  else if(s.phase==='eat'){
    s.eatT+=dt;
    if(Math.random()<.3)
      s.steam.push({x:(Math.random()-.5)*6, y:0, life:1});
    s.steam=s.steam.filter(p=>{ p.y-=dt*14; p.life-=dt; return p.life>0; });
    if(s.eatT>2.4) stallExit();
  }
}

/* ---------- 포장마차 구조물 (밤에 등불 켜짐) ----------
   작은 수레: 아래 초록 몸통 + 위 노란 천막 */
function drawStall(ctx, pal, now){
  const sx = worldToScreen(LM.stall)|0;
  if(sx<-50||sx>W+50) return;
  const gy = SIDEWALK_Y;
  const open = stallIsOpen(pal);

  // 수레 몸통 (초록)
  ctx.fillStyle='#2f7a4a';
  ctx.fillRect(sx-16,gy-13,32,11);
  ctx.fillStyle='#1e5432';
  ctx.fillRect(sx-16,gy-13,32,2);
  ctx.fillRect(sx-16,gy-4,32,2);
  // 바퀴
  ctx.fillStyle='rgba(20,16,30,.9)';
  ctx.fillRect(sx-11,gy-2,4,3); ctx.fillRect(sx+7,gy-2,4,3);
  // 천막 기둥
  ctx.fillStyle='#3a2a1a';
  ctx.fillRect(sx-16,gy-32,2,19); ctx.fillRect(sx+14,gy-32,2,19);
  // 천막 (노랑 두 톤 줄무늬)
  for(let i=0;i<9;i++){
    ctx.fillStyle = i%2 ? '#f2c94c' : '#d9a832';
    ctx.fillRect(sx-18+i*4, gy-36, 4, 5);
  }
  ctx.fillStyle='#a8791e'; ctx.fillRect(sx-18,gy-32,36,1);
  // 김 나는 냄비 / 철판
  ctx.fillStyle='#2a2233';
  ctx.fillRect(sx-8,gy-16,16,3);
  if(open){
    // 등불
    ctx.fillStyle='#ffcf6b';
    ctx.fillRect(sx-1,gy-30,2,3);
    const g=ctx.createRadialGradient(sx,gy-24,2,sx,gy-24,20);
    g.addColorStop(0,'rgba(255,200,110,.28)'); g.addColorStop(1,'rgba(255,200,110,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(sx,gy-24,20,0,7); ctx.fill();
    // 모락모락 김
    ctx.fillStyle='rgba(255,255,255,.28)';
    for(let i=0;i<3;i++){
      const yy = gy-18 - ((now/220+i*40)%16);
      ctx.fillRect((sx-5+i*5)|0, yy|0, 2,2);
    }
    // 간판 글자 대신 붕어빵 아이콘
    ctx.fillStyle='#e8b45a';
    ctx.fillRect(sx-12,gy-10,5,3); ctx.fillRect(sx-11,gy-11,3,1);
  } else {
    // 닫힘: 천막 내려짐 표현
    ctx.fillStyle='rgba(30,26,40,.6)';
    ctx.fillRect(sx-18,gy-13,36,11);
  }
}

/* ---------- 굽기 UI 오버레이 (stall 모드) ---------- */
function drawStallUI(ctx, now){
  if(GS.mode!=='stall') return;
  const s=stall;
  ctx.fillStyle='rgba(6,8,22,.55)'; ctx.fillRect(0,0,W,H);

  const cx=W/2, cy=H/2-10;

  // 붕어빵 그림 (품질에 따라 색)
  const baked = s.phase==='done'||s.phase==='eat';
  const flip2 = s.phase==='grill2'||s.phase==='flip';
  let col = '#f0d9a0';
  if(baked) col = s.quality>=1 ? '#e8b45a' : s.quality>=.5 ? '#b07838' : '#5a4020';
  else if(flip2) col = '#e8c078';
  drawTaiyaki(ctx, cx, cy, col);

  // 안내 텍스트
  ctx.fillStyle='rgba(255,255,255,.85)';
  ctx.textAlign='center';
  ctx.font="8px 'Galmuri9', monospace";
  let label='';
  if(s.phase==='pour')   label='SPACE / ↑ : 반죽 붓기';
  if(s.phase==='grill1') label='굽는 중… GOOD 일 때 뒤집기!';
  if(s.phase==='flip')   label='뒤집는 중…';
  if(s.phase==='grill2') label='한 번 더! GOOD 일 때 꺼내기';
  if(s.phase==='done')   label='완성!';
  if(s.phase==='eat')    label='냠…';
  ctx.fillText(label, cx, cy+34);

  // 타이밍 게이지
  if(s.phase==='grill1'||s.phase==='grill2'){
    const bw=120, bx=cx-bw/2, by=cy+42;
    ctx.fillStyle='rgba(255,255,255,.15)'; ctx.fillRect(bx,by,bw,6);
    // GOOD 존
    ctx.fillStyle='rgba(120,220,140,.5)';
    ctx.fillRect(bx+bw*.55, by, bw*.27, 6);
    // 커서
    ctx.fillStyle='#ffd27f';
    ctx.fillRect(bx+bw*s.g-1, by-1, 2, 8);
  }

  // 김 (eat)
  if(s.phase==='eat'){
    for(const p of s.steam){
      ctx.fillStyle=`rgba(255,255,255,${p.life*.5})`;
      ctx.fillRect((cx+p.x)|0,(cy-14+p.y)|0,2,2);
    }
  }
  ctx.textAlign='left';
}

function drawTaiyaki(ctx, cx, cy, col){
  ctx.fillStyle=col;
  // 몸통
  ctx.fillRect(cx-10,cy-5,18,10);
  ctx.fillRect(cx-12,cy-3,4,6);      // 머리쪽 둥글게
  // 꼬리
  ctx.fillRect(cx+8,cy-4,3,3); ctx.fillRect(cx+8,cy+1,3,3);
  ctx.fillRect(cx+10,cy-6,2,12);
  // 눈
  ctx.fillStyle='rgba(60,40,20,.8)';
  ctx.fillRect(cx-9,cy-2,1,1);
  // 무늬(격자)
  ctx.fillStyle='rgba(0,0,0,.12)';
  for(let i=-6;i<8;i+=4) ctx.fillRect(cx+i,cy-4,1,8);
}
