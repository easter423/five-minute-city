'use strict';
/* ============================================================
   5분 도시 — odeng.js
   이자카야풍 오뎅 포장마차 (밤에만 열림) + 오뎅 판매 미니게임
   - 홍등 3개 · 빨간 네온 간판 · 오뎅바(카운터/스툴/냄비)
   - 미니게임: 90초 동안 손님 주문(숫자 1~4 / 냄비 칸 클릭)을
     제한 인내심 안에 서빙. 주문 완수 시 팁, 시간 종료 후 정산.
   ============================================================ */

const ODENG_TIME = 90;          // 장사 시간(초)
const ODENG_MENU = [
  {name:'부산 어묵꼬치', short:'어묵', price:700,  col:'#d9a05a',
   desc:'접어 꽂은 정통파. 국물이 깊게 배었다'},
  {name:'물떡꼬치',     short:'물떡', price:500,  col:'#f0ead8',
   desc:'말랑한 가래떡. 간장에 콕 찍어 먹는다'},
  {name:'곤약꼬치',     short:'곤약', price:500,  col:'#8a96a8',
   desc:'탱글탱글, 칼집 사이로 국물이 스민다'},
  {name:'유부주머니',   short:'유부', price:1000, col:'#d8b04a',
   desc:'속이 꽉 찬 금색 복주머니. 젓가락 필수'},
];

let odeng = {
  phase:'idle',    // idle | play | result
  timeLeft:0,
  customers:[],    // {order[], pat, patMax, hue, inT, out:null|'happy'|'angry', outT}
  spawnT:0,
  served:0, missed:0, coins:0,
  resultT:0,
  shakeT:0,        // 오답 시 앞 손님 진동
  steam:[],
};

function odengIsOpen(pal){ return pal.night>.5; }

/* ============================================================
   진입 · 메뉴 오버레이
   ============================================================ */
function odengEnter(){
  if(!GS.pal || !odengIsOpen(GS.pal)){
    toast('오뎅바는 밤에 열려요'); return false;
  }
  renderOdengMenu();
  openOverlay('odengOv');
  sfxBlip(620);
  return true;
}

function renderOdengMenu(){
  const body=document.getElementById('odengMenuBody');
  if(!body) return;
  body.innerHTML =
    ODENG_MENU.map((m,i)=>
      `<div class="row"><span>[${i+1}] ${m.name}<br>`+
      `<small style="opacity:.6">${m.desc}</small></span>`+
      `<b>${m.price}원</b></div>`).join('')+
    `<div class="row"><span>따끈한 국물</span><b>서비스</b></div>`;
}

/* 시작 버튼 배선 (요소는 index.html 쪽에서 제공) */
(function(){
  const bind=()=>{
    const b=document.getElementById('odengStartBtn');
    if(b) b.addEventListener('click',()=>{ closeOverlay('odengOv'); odengStart(); });
  };
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',bind);
  else bind();
})();

/* ============================================================
   미니게임 흐름
   ============================================================ */
function odengStart(){
  if(!GS.pal || !odengIsOpen(GS.pal)){ toast('오뎅바는 밤에 열려요'); return; }
  GS.mode='odeng';
  player.x=LM.odeng; player.sitting=null;
  odeng.phase='play';
  odeng.timeLeft=ODENG_TIME;
  odeng.customers=[]; odeng.spawnT=1.1;
  odeng.served=0; odeng.missed=0; odeng.coins=0;
  odeng.resultT=0; odeng.shakeT=0; odeng.steam=[];
  toast('숫자 1~4 또는 냄비 칸 클릭으로 서빙');
  sfxBlip(660);
}

/* 장사 마감(중도 포함) — result에서 이미 정산했으면 이중 정산 금지 */
function odengExit(){
  if(odeng.phase==='play'){
    GS.odengSold=(GS.odengSold||0)+odeng.served;
    GS.coins=(GS.coins||0)+odeng.coins;
    refreshStats();
  }
  if(odeng.phase!=='idle' && odeng.served>0)
    toast(`오늘 손님 ${odeng.served}명 · ${odeng.coins}원 벌었다`);
  odeng.phase='idle';
  GS.mode='roam';
}

function odengFront(){
  for(const c of odeng.customers) if(!c.out) return c;
  return null;
}

/* i = 서빙할 메뉴 인덱스 (0..3) */
function odengServe(i){
  if(odeng.phase!=='play') return;
  const c=odengFront();
  if(!c || c.inT<1) return;
  if(c.order[0]===i){
    c.order.shift();
    odeng.coins+=ODENG_MENU[i].price;
    c.pat=Math.min(c.patMax, c.pat+1.2);
    const z=potZone(i);
    for(let k=0;k<3;k++)
      odeng.steam.push({x:z.x+6+Math.random()*(z.w-12), y:z.y+4, life:1});
    if(c.order.length===0){
      odeng.served++;
      if(c.pat>c.patMax*.5) odeng.coins+=300;   // 팁
      c.out='happy'; c.outT=0;
      sfxBlip(1150);
    } else sfxBlip(900);
  } else {
    c.pat-=2; odeng.shakeT=.3; sfxBlip(200);
  }
}

/* 키 라우팅 (main에서 호출) — 처리했으면 true */
function odengKey(code){
  if(GS.mode!=='odeng') return false;
  if(odeng.phase==='result'){
    if(code==='Space'||code==='Enter'||code==='ArrowUp'||code==='Escape'){
      odengExit(); return true;
    }
    return true;
  }
  const m=/^(Digit|Numpad)([1-4])$/.exec(code);
  if(m){ odengServe(+m[2]-1); return true; }
  if(code==='Escape'){ odengExit(); return true; }
  return false;
}

/* 캔버스 클릭/터치 (main에서 호출) — 처리했으면 true */
function odengClick(x,y){
  if(GS.mode!=='odeng') return false;
  if(odeng.phase==='result'){ odengExit(); return true; }
  for(let i=0;i<4;i++){
    const z=potZone(i);
    if(x>=z.x && x<=z.x+z.w && y>=z.y && y<=z.y+z.h){ odengServe(i); return true; }
  }
  return true;   // 모드 중 다른 클릭은 삼킴
}

function updateOdeng(dt){
  const o=odeng;
  if(o.phase==='idle') return;
  if(o.shakeT>0) o.shakeT-=dt;

  /* 김 파티클 */
  if(o.phase==='play' && Math.random()<.25){
    const z=potZone((Math.random()*4)|0);
    o.steam.push({x:z.x+6+Math.random()*(z.w-12), y:z.y+4, life:1});
  }
  o.steam=o.steam.filter(p=>{ p.y-=dt*16; p.x+=Math.sin(p.y/5)*dt*4; p.life-=dt*.8; return p.life>0; });

  if(o.phase==='play'){
    o.timeLeft-=dt;

    /* 손님 스폰 — 시간이 갈수록 간격이 짧아짐 */
    o.spawnT-=dt;
    const waiting=o.customers.filter(c=>!c.out).length;
    if(o.spawnT<=0 && waiting<4){
      const cnt=1+((Math.random()*3)|0);                 // 주문 1~3개
      const order=[]; for(let k=0;k<cnt;k++) order.push((Math.random()*4)|0);
      const patMax=9+cnt*2.5;
      o.customers.push({order, pat:patMax, patMax,
        hue:(Math.random()*360)|0, inT:0, out:null, outT:0});
      o.spawnT=(3+Math.random()*3.5)*(.55+.45*o.timeLeft/ODENG_TIME);
    }

    /* 손님 갱신 — 인내심은 맨 앞 손님만(입장 애니 후) 감소 */
    const front=odengFront();
    for(const c of o.customers){
      if(c.inT<1) c.inT=Math.min(1, c.inT+dt/.5);
      if(c.out){ c.outT+=dt; continue; }
      if(c===front && c.inT>=1){
        c.pat-=dt;
        if(c.pat<=0){ c.out='angry'; c.outT=0; o.missed++; sfxBlip(170); }
      }
    }
    o.customers=o.customers.filter(c=>!c.out||c.outT<.6);

    /* 장사 종료 → 정산은 이 시점 한 번만 */
    if(o.timeLeft<=0){
      o.timeLeft=0; o.phase='result'; o.resultT=0;
      GS.odengSold=(GS.odengSold||0)+o.served;
      GS.coins=(GS.coins||0)+o.coins;
      refreshStats(); sfxBlip(880);
    }
  }
  else if(o.phase==='result'){
    o.resultT+=dt;
    if(o.resultT>6) odengExit();
  }
}

/* ============================================================
   월드 구조물 — 이자카야풍 오뎅 포장마차
   ============================================================ */
function drawOdengStall(ctx, pal, now){
  const sx=worldToScreen(LM.odeng)|0;
  if(sx<-60||sx>W+60) return;
  const gy=SIDEWALK_Y;
  const open=odengIsOpen(pal);

  /* 바닥으로 퍼지는 은은한 붉은 글로우 */
  if(open){
    const g=ctx.createRadialGradient(sx,gy-14,4,sx,gy-14,46);
    g.addColorStop(0,'rgba(255,90,60,.16)'); g.addColorStop(1,'rgba(255,90,60,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(sx,gy-14,46,0,7); ctx.fill();
  }

  /* 수레 몸통 (붕어빵집보다 큼) */
  ctx.fillStyle='#5a3a24';
  ctx.fillRect(sx-30,gy-18,60,16);
  ctx.fillStyle='#402816';
  ctx.fillRect(sx-30,gy-18,60,2);
  ctx.fillRect(sx-30,gy-9,60,1);       // 널빤지 이음새
  /* 바퀴 */
  ctx.fillStyle='rgba(20,16,30,.9)';
  ctx.fillRect(sx-22,gy-2,5,3); ctx.fillRect(sx+17,gy-2,5,3);
  /* 천막 기둥 */
  ctx.fillStyle='#3a2a1a';
  ctx.fillRect(sx-30,gy-46,2,28); ctx.fillRect(sx+28,gy-46,2,28);

  /* 천막 (빨강/미색 줄무늬, 폭 60) */
  for(let i=0;i<12;i++){
    ctx.fillStyle = i%2 ? '#c94f4f' : '#e8dcc0';
    ctx.fillRect(sx-30+i*5, gy-52, 5, 6);
  }
  ctx.fillStyle='#8a3a3a'; ctx.fillRect(sx-30,gy-46,60,1);

  /* 노렌 (암적색 천 조각) */
  if(open){
    ctx.fillStyle='#7a2828';
    for(let i=0;i<5;i++) ctx.fillRect(sx-26+i*12, gy-45, 8, 6);
    ctx.fillStyle='rgba(0,0,0,.2)';
    for(let i=0;i<5;i++) ctx.fillRect(sx-26+i*12, gy-41, 8, 2);
  }

  /* 오뎅바 카운터 널빤지 + 스툴 3개 */
  ctx.fillStyle='#6a4a2c';
  ctx.fillRect(sx-36,gy-24,72,3);
  ctx.fillStyle='#4a3420';
  ctx.fillRect(sx-36,gy-22,72,1);
  for(let i=-1;i<=1;i++){
    const stx=sx+i*20;
    ctx.fillStyle='#8a5a34';
    ctx.fillRect(stx-4,gy-12,8,3);                       // 둥근 좌판
    ctx.fillRect(stx-3,gy-13,6,1);
    ctx.fillStyle='#3a2a1a';
    ctx.fillRect(stx-1,gy-9,2,9);                        // 다리
  }

  /* 스테인리스 오뎅 냄비 + 칸막이 + 꼬치 + 김 */
  ctx.fillStyle='#9aa2ac';
  ctx.fillRect(sx-16,gy-30,32,7);
  ctx.fillStyle='#6a727c';
  ctx.fillRect(sx-16,gy-30,32,1);
  ctx.fillRect(sx-1,gy-29,1,5); ctx.fillRect(sx-9,gy-29,1,5); ctx.fillRect(sx+7,gy-29,1,5);
  if(open){
    ctx.fillStyle='#caa46a';                             // 국물
    ctx.fillRect(sx-15,gy-29,14,2); ctx.fillRect(sx+1,gy-29,14,2);
    for(let i=0;i<4;i++){                                // 솟은 꼬치
      const kx=sx-12+i*8;
      ctx.fillStyle='#c8a060'; ctx.fillRect(kx,gy-36,1,7);
      ctx.fillStyle=ODENG_MENU[i%4].col; ctx.fillRect(kx-1,gy-38,3,3);
    }
    ctx.fillStyle='rgba(255,255,255,.28)';               // 모락모락 김
    for(let i=0;i<4;i++){
      const yy=gy-34-((now/200+i*35)%18);
      ctx.fillRect((sx-11+i*8)|0, yy|0, 2,2);
    }
  }

  if(open){
    /* 홍등 3개 — 살랑 흔들림 + 붉은 글로우 + 플리커 */
    for(let i=0;i<3;i++){
      const ax=sx-18+i*18;
      const sway=Math.sin(now/650+i*1.9)*1.6;
      const lx=(ax+sway)|0, ly=gy-45;
      const flick=.72+.22*Math.sin(now/115+i*2.3)+.06*Math.sin(now/23+i*7);
      const g=ctx.createRadialGradient(lx,ly+7,1,lx,ly+7,15);
      g.addColorStop(0,`rgba(255,80,60,${.32*flick})`);
      g.addColorStop(1,'rgba(255,80,60,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(lx,ly+7,15,0,7); ctx.fill();
      ctx.fillStyle='rgba(40,20,20,.8)'; ctx.fillRect(lx,ly,1,3);     // 줄
      ctx.fillStyle=`rgba(220,50,40,${.75+.25*flick})`;
      ctx.fillRect(lx-2,ly+3,5,7);                                    // 몸통
      ctx.fillStyle=`rgba(255,170,90,${.5*flick})`;
      ctx.fillRect(lx-1,ly+5,3,3);                                    // 속불
      ctx.fillStyle='rgba(0,0,0,.25)';
      ctx.fillRect(lx-2,ly+5,5,1); ctx.fillRect(lx-2,ly+8,5,1);       // 골
      ctx.fillStyle='#e8c060'; ctx.fillRect(lx,ly+10,1,2);            // 술
    }

    /* 세로형 빨간 네온 간판 '오뎅' */
    const neon=.65+.3*Math.sin(now/140)+.05*Math.sin(now/31);
    ctx.fillStyle='#1a0d12';
    ctx.fillRect(sx+31,gy-46,10,22);
    ctx.fillStyle=`rgba(255,70,60,${.5+.4*neon})`;
    ctx.fillRect(sx+31,gy-46,10,1); ctx.fillRect(sx+31,gy-25,10,1);
    ctx.fillRect(sx+31,gy-46,1,22); ctx.fillRect(sx+40,gy-46,1,22);
    const ng=ctx.createRadialGradient(sx+36,gy-35,2,sx+36,gy-35,18);
    ng.addColorStop(0,`rgba(255,60,50,${.2*neon})`); ng.addColorStop(1,'rgba(255,60,50,0)');
    ctx.fillStyle=ng; ctx.beginPath(); ctx.arc(sx+36,gy-35,18,0,7); ctx.fill();
    ctx.fillStyle=`rgba(255,120,110,${.55+.45*neon})`;
    ctx.font="8px 'Mulmaru Mono', monospace"; ctx.textAlign='center';
    ctx.fillText('오', sx+36, gy-37);
    ctx.fillText('뎅', sx+36, gy-28);
    ctx.textAlign='left';

    /* 카운터 위 은은한 붉은 기운 */
    const cg=ctx.createRadialGradient(sx,gy-26,2,sx,gy-26,26);
    cg.addColorStop(0,'rgba(255,110,70,.12)'); cg.addColorStop(1,'rgba(255,110,70,0)');
    ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(sx,gy-26,26,0,7); ctx.fill();
  } else {
    /* 낮: 천막 내려진 어두운 모습 */
    ctx.fillStyle='rgba(30,26,40,.65)';
    ctx.fillRect(sx-30,gy-45,60,43);
    ctx.fillStyle='rgba(20,16,30,.5)';
    for(let i=0;i<5;i++) ctx.fillRect(sx-28+i*12, gy-45, 1, 43);   // 접힌 주름
  }
}

/* ============================================================
   미니게임 화면
   ============================================================ */

/* 냄비 4칸 클릭 히트박스 — 좌표 일원화 */
function potZone(i){
  const w=54;
  return { x:(W/2 - w*2 - 6) + i*(w+4), y:H-80, w:w, h:48 };
}

/* 꼬치 픽셀 아이콘 — y는 꼬치 바닥 기준 */
function odengSkewerIcon(ctx,x,y,type){
  x|=0; y|=0;
  ctx.fillStyle='#c8a060'; ctx.fillRect(x,y-10,1,10);            // 꼬치 살
  if(type===0){                    // 어묵: 접힌 물결
    ctx.fillStyle='#d9a05a';
    ctx.fillRect(x-2,y-16,4,2); ctx.fillRect(x-1,y-14,4,2); ctx.fillRect(x-2,y-12,4,2);
    ctx.fillStyle='rgba(120,70,30,.5)';
    ctx.fillRect(x-2,y-15,1,1); ctx.fillRect(x+1,y-13,1,1);
  } else if(type===1){             // 물떡: 흰 원통
    ctx.fillStyle='#f0ead8';
    ctx.fillRect(x-1,y-17,3,8);
    ctx.fillStyle='rgba(255,255,255,.7)'; ctx.fillRect(x-1,y-17,1,8);
    ctx.fillStyle='rgba(140,130,110,.35)'; ctx.fillRect(x+1,y-16,1,6);
  } else if(type===2){             // 곤약: 회청 사다리꼴 + 칼집
    ctx.fillStyle='#8a96a8';
    ctx.fillRect(x-2,y-15,5,4); ctx.fillRect(x-1,y-16,3,1);
    ctx.fillStyle='rgba(40,50,66,.6)';
    ctx.fillRect(x-1,y-14,1,2); ctx.fillRect(x+1,y-14,1,2);
  } else {                         // 유부주머니: 금색 주머니 + 끈
    ctx.fillStyle='#d8b04a';
    ctx.fillRect(x-2,y-15,5,5); ctx.fillRect(x-1,y-16,3,1);
    ctx.fillStyle='#8a6a20'; ctx.fillRect(x-1,y-17,3,1);          // 묶은 끈
    ctx.fillStyle='rgba(255,230,150,.55)'; ctx.fillRect(x-1,y-14,1,2);
  }
}

/* 정면 뷰 손님 — cy는 발 위치, face: 'wait'|'happy'|'angry' */
function odengCustomerSprite(ctx, cx, cy, hue, face){
  cx|=0; cy|=0;
  ctx.fillStyle='#2a2438';                                        // 다리
  ctx.fillRect(cx-4,cy-8,3,8); ctx.fillRect(cx+1,cy-8,3,8);
  ctx.fillStyle=`hsl(${hue},42%,50%)`;                            // 몸통·팔
  ctx.fillRect(cx-6,cy-20,12,12);
  ctx.fillRect(cx-8,cy-19,2,8); ctx.fillRect(cx+6,cy-19,2,8);
  ctx.fillStyle='#e8c49a';                                        // 얼굴
  ctx.fillRect(cx-5,cy-31,10,11);
  ctx.fillStyle=`hsl(${(hue+140)%360},22%,20%)`;                  // 머리카락
  ctx.fillRect(cx-5,cy-31,10,4);
  ctx.fillRect(cx-5,cy-27,2,2); ctx.fillRect(cx+3,cy-27,2,2);
  if(face==='happy'){                                             // ^^ + 입
    ctx.fillStyle='#3a2a20';
    ctx.fillRect(cx-4,cy-24,1,1); ctx.fillRect(cx-3,cy-25,1,1); ctx.fillRect(cx-2,cy-24,1,1);
    ctx.fillRect(cx+1,cy-24,1,1); ctx.fillRect(cx+2,cy-25,1,1); ctx.fillRect(cx+3,cy-24,1,1);
    ctx.fillRect(cx-1,cy-22,2,1);
  } else if(face==='angry'){                                      // 눈썹 + 부릅
    ctx.fillStyle='#b03434';
    ctx.fillRect(cx-4,cy-26,3,1); ctx.fillRect(cx+1,cy-26,3,1);
    ctx.fillStyle='#3a2a20';
    ctx.fillRect(cx-3,cy-24,2,2); ctx.fillRect(cx+1,cy-24,2,2);
    ctx.fillRect(cx-1,cy-21,2,1);
  } else {
    ctx.fillStyle='#3a2a20';
    ctx.fillRect(cx-3,cy-25,2,2); ctx.fillRect(cx+1,cy-25,2,2);
  }
}

function drawOdengUI(ctx, now){
  if(GS.mode!=='odeng') return;
  const o=odeng;

  /* 어두운 실내 + 붉은 무드 글로우 */
  ctx.fillStyle='rgba(14,8,12,.93)'; ctx.fillRect(0,0,W,H);
  const mg=ctx.createRadialGradient(W/2,H*.62,20,W/2,H*.62,W*.55);
  mg.addColorStop(0,'rgba(200,60,40,.14)'); mg.addColorStop(1,'rgba(200,60,40,0)');
  ctx.fillStyle=mg; ctx.fillRect(0,0,W,H);

  /* 천막 안쪽 줄무늬 */
  for(let i=0;i<W/10;i++){
    ctx.fillStyle = i%2 ? 'rgba(140,50,50,.8)' : 'rgba(120,105,85,.8)';
    ctx.fillRect(i*10,0,10,8);
  }
  ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(0,7,W,2);

  /* 홍등 4개 */
  for(let i=0;i<4;i++){
    const ax=W*(.14+.24*i);
    const sway=Math.sin(now/620+i*1.7)*2;
    const lx=(ax+sway)|0, ly=9;
    const flick=.72+.22*Math.sin(now/120+i*2.1)+.06*Math.sin(now/24+i*5);
    const g=ctx.createRadialGradient(lx,ly+9,2,lx,ly+9,22);
    g.addColorStop(0,`rgba(255,80,60,${.3*flick})`); g.addColorStop(1,'rgba(255,80,60,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(lx,ly+9,22,0,7); ctx.fill();
    ctx.fillStyle='rgba(60,30,26,.9)'; ctx.fillRect(lx,ly,1,4);
    ctx.fillStyle=`rgba(220,50,40,${.7+.3*flick})`; ctx.fillRect(lx-3,ly+4,7,9);
    ctx.fillStyle=`rgba(255,170,90,${.5*flick})`; ctx.fillRect(lx-1,ly+6,3,4);
    ctx.fillStyle='rgba(0,0,0,.25)';
    ctx.fillRect(lx-3,ly+6,7,1); ctx.fillRect(lx-3,ly+10,7,1);
    ctx.fillStyle='#e8c060'; ctx.fillRect(lx,ly+13,1,2);
  }

  ctx.font="8px 'Mulmaru Mono', monospace";

  /* ---------- 상단 HUD ---------- */
  const frac=clamp(o.timeLeft/ODENG_TIME,0,1);
  const bw=140, bx=W/2-bw/2, by=22;
  ctx.fillStyle='rgba(255,255,255,.14)'; ctx.fillRect(bx,by,bw,5);
  const low = o.timeLeft<10 && Math.sin(now/90)>0;
  ctx.fillStyle = low ? '#e05050' : (o.timeLeft<10 ? '#a03838' : '#e8c878');
  ctx.fillRect(bx,by,(bw*frac)|0,5);
  ctx.fillStyle='rgba(255,255,255,.85)';
  ctx.textAlign='left';  ctx.fillText(`판매 ${o.served}`, 12, 28);
  ctx.textAlign='right'; ctx.fillText(`${o.coins}원`, W-12, 28);
  ctx.textAlign='left';

  /* ---------- 손님 ---------- */
  const feetY=H-86, frontX=W/2-70;
  const front=odengFront();
  let qi=0;
  for(const c of o.customers){
    if(c.out){
      /* 퇴장 슬라이드 & 페이드 */
      const t=c.outT/.6;
      ctx.globalAlpha=1-t;
      const ex = c.out==='happy' ? frontX+t*110 : frontX-t*130;
      odengCustomerSprite(ctx, ex, feetY, c.hue, c.out);
      if(c.out==='angry'){
        ctx.fillStyle=`rgba(255,80,60,${(1-t)*.8})`;
        ctx.fillRect((ex+6)|0, feetY-38, 2,2); ctx.fillRect((ex+9)|0, feetY-41, 2,2);
      }
      ctx.globalAlpha=1;
      continue;
    }
    if(c===front){
      /* 입장 슬라이드 + 오답 진동 */
      const slide=(1-c.inT)*(1-c.inT)*90;
      const shake = o.shakeT>0 ? Math.sin(now/18)*2 : 0;
      const fx=frontX+slide+shake;
      ctx.globalAlpha=Math.min(1,.3+c.inT*.7);
      const ratio=c.pat/c.patMax;
      odengCustomerSprite(ctx, fx, feetY, c.hue, ratio<.25?'angry':'wait');
      ctx.globalAlpha=1;

      if(c.inT>=1){
        /* 주문 말풍선 — 남은 주문 아이콘, 첫 아이콘 하이라이트 */
        const n=c.order.length, bw2=n*12+10, bx2=(fx-bw2/2)|0, by2=feetY-58;
        ctx.fillStyle='rgba(245,240,232,.94)';
        ctx.fillRect(bx2,by2,bw2,22);
        ctx.fillRect(bx2+1,by2-1,bw2-2,24);
        ctx.fillStyle='rgba(245,240,232,.94)';                     // 꼬리
        ctx.fillRect((fx-1)|0,by2+22,3,2); ctx.fillRect(fx|0,by2+24,2,1);
        ctx.fillStyle='rgba(255,200,90,.6)';
        ctx.fillRect(bx2+3,by2+2,10,18);                           // 다음 서빙 하이라이트
        for(let k=0;k<n;k++)
          odengSkewerIcon(ctx, bx2+8+k*12, by2+19, c.order[k]);

        /* 인내심 게이지 (초록→노랑→빨강) */
        const pw=30, px=(fx-pw/2)|0, py=feetY+5;
        ctx.fillStyle='rgba(255,255,255,.14)'; ctx.fillRect(px,py,pw,3);
        ctx.fillStyle = ratio>.5 ? '#7ad17a' : ratio>.25 ? '#e8c860' :
          (Math.sin(now/80)>0 ? '#e05050' : '#a03838');
        ctx.fillRect(px,py,(pw*ratio)|0,3);
      }
    } else {
      /* 대기열 — 옆에 흐리게 */
      const slide=(1-c.inT)*(1-c.inT)*60;
      ctx.globalAlpha=.3;
      odengCustomerSprite(ctx, frontX+52+qi*26+slide, feetY, c.hue, 'wait');
      ctx.globalAlpha=1;
      qi++;
    }
  }

  /* ---------- 카운터 + 오뎅 냄비 4칸 ---------- */
  ctx.fillStyle='#5a3a24'; ctx.fillRect(96,H-32,W-192,10);
  ctx.fillStyle='#7a5434'; ctx.fillRect(96,H-32,W-192,2);
  ctx.fillStyle='#402816'; ctx.fillRect(96,H-23,W-192,1);

  const z0=potZone(0), z3=potZone(3);
  ctx.fillStyle='#9aa2ac';                                         // 스테인리스 틀
  ctx.fillRect(z0.x-4,H-82,(z3.x+z3.w+4)-(z0.x-4),40);
  ctx.fillStyle='#6a727c';
  ctx.fillRect(z0.x-4,H-82,(z3.x+z3.w+4)-(z0.x-4),2);

  for(let i=0;i<4;i++){
    const z=potZone(i), m=ODENG_MENU[i];
    ctx.fillStyle='#b89055';                                       // 국물
    ctx.fillRect(z.x,H-78,z.w,28);
    ctx.fillStyle='rgba(255,235,180,.25)';
    ctx.fillRect(z.x,H-78,z.w,3);
    for(let k=0;k<3;k++)                                           // 꼬치 2~3개
      odengSkewerIcon(ctx, z.x+12+k*15, H-60+((k%2)*3), i);
    ctx.fillStyle='rgba(20,14,18,.7)';                             // 숫자 라벨
    ctx.fillRect(z.x+2,H-78,9,9);
    ctx.fillStyle='#ffd27f'; ctx.textAlign='left';
    ctx.fillText(String(i+1), z.x+4, H-71);
    ctx.textAlign='center';
    ctx.fillStyle='rgba(255,255,255,.8)';
    ctx.fillText(m.short, z.x+z.w/2, H-40);
  }
  ctx.textAlign='left';

  /* 김 */
  for(const p of o.steam){
    ctx.fillStyle=`rgba(255,255,255,${p.life*.4})`;
    ctx.fillRect(p.x|0,p.y|0,2,2);
  }

  /* ---------- 결과 화면 ---------- */
  if(o.phase==='result'){
    ctx.fillStyle='rgba(6,4,8,.55)'; ctx.fillRect(0,0,W,H);
    const pw=200, ph=96, px=W/2-pw/2, py=H/2-ph/2-8;
    ctx.fillStyle='rgba(16,10,14,.95)'; ctx.fillRect(px,py,pw,ph);
    ctx.fillStyle='rgba(220,70,60,.8)';
    ctx.fillRect(px,py,pw,1); ctx.fillRect(px,py+ph-1,pw,1);
    ctx.fillRect(px,py,1,ph); ctx.fillRect(px+pw-1,py,1,ph);
    ctx.textAlign='center';
    ctx.fillStyle='#ff8878';
    ctx.fillText('— 영업 종료 —', W/2, py+16);
    ctx.fillStyle='rgba(255,255,255,.9)';
    ctx.fillText(`판매 ${o.served}명 · 놓침 ${o.missed}명`, W/2, py+34);
    ctx.fillStyle='#ffd27f';
    ctx.fillText(`매출 ${o.coins}원`, W/2, py+48);
    const grade =
      o.served>=8 && o.missed===0 ? '전설의 오뎅 장인!' :
      o.served>=6 ? '제법 그럴싸한 사장님' :
      o.served>=3 ? '수줍은 첫 장사' : '국물만 팔았다…';
    ctx.fillStyle='rgba(255,200,150,.9)';
    ctx.fillText(grade, W/2, py+66);
    if(Math.sin(now/300)>-.4){
      ctx.fillStyle='rgba(255,255,255,.6)';
      ctx.fillText('SPACE / 클릭으로 돌아가기', W/2, py+84);
    }
    ctx.textAlign='left';
  }
}
