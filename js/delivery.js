'use strict';
/* ============================================================
   5분 도시 — delivery.js
   배달 알바 미니게임 (roam 모드 그대로 진행 — 별도 모드 없음)
   1) 주차된 스쿠터 옆에서 ↑ → 90초 알바 시작 (첫 주문 자동 픽업)
   2) 말풍선이 뜬 건물 문 앞에서 ↑ → 배달 (빠르면 팁 +300원)
   3) 스쿠터로 돌아와 ↑ → 다음 주문 픽업
   인내심(28초)이 다 하면 주문이 식어버림. Escape 로 알바 중단.
   ============================================================ */

const DELIV_TIME     = 90;   // 알바 총 시간(초)
const DELIV_PATIENCE = 28;   // 주문 인내심(초)
const DELIV_PAY      = 500;  // 기본 배달료(원)
const DELIV_TIP      = 300;  // 인내심 50% 이상 남았을 때 팁(원)

/* 배달 음식 4종 */
const DELIV_FOODS = [
  { name:'붕어빵',    col:'#e8b45a' },
  { name:'오뎅 꼬치', col:'#ead9ae' },
  { name:'캔커피',    col:'#8a5a30' },
  { name:'주먹밥',    col:'#f2f0e8' },
];

const DELIV_THANKS = [
  '감사합니다! 잘 먹을게요',
  '와, 아직 따끈해요!',
  '기다렸어요! 고마워요',
  '오늘도 수고하세요 🛵',
];

/* 게임 상태 */
const deliv = {
  active:false,
  timeLeft:0,
  carrying:null,   // 들고 있는 음식 인덱스 | null
  target:null,     // {wx, bldg, food, patience, patMax} | null
  done:0,          // 이번 알바 배달 건수
  missed:0,        // 식어버린 주문 수
  coins:0,         // 이번 알바 수입(원)
};

function delivActive(){ return deliv.active; }

/* ---------- 주문 생성 ---------- */
/* 문 있는 건물 중 플레이어에서 140~700px 떨어진 곳 랜덤 (없으면 완화) */
function delivPickTarget(){
  const near=[], any=[];
  for(const b of FRONT.buildings){
    if(!b.door) continue;
    const wx = b.x + b.door.x + b.door.w/2;
    const d = Math.abs(wrapDelta(wx - player.x, WLOOP));
    if(d>=140 && d<=700) near.push({wx,b});
    else if(d>=40) any.push({wx,b});
  }
  const pool = near.length ? near : any;
  if(!pool.length) return null;
  const pick = pool[(Math.random()*pool.length)|0];
  return { wx:pick.wx, bldg:pick.b,
           food:(Math.random()*DELIV_FOODS.length)|0,
           patience:DELIV_PATIENCE, patMax:DELIV_PATIENCE };
}

function delivNewOrder(){
  const t = delivPickTarget();
  if(!t){ toast('지금은 들어온 주문이 없다…'); return false; }
  deliv.target = t;
  deliv.carrying = t.food;
  toast(`${DELIV_FOODS[t.food].name} 주문!\n말풍선이 뜬 건물로!`);
  return true;
}

/* ---------- ↑ 입력 (main.js tryInteract 최상단에서 호출) ----------
   입력을 소비했으면 true */
function delivTryInteract(){
  const nearScooter =
    Math.abs(wrapDelta(LM.scooter - player.x, WLOOP)) < 14;

  /* 비활성: 스쿠터 옆에서 알바 시작 */
  if(!deliv.active){
    if(!nearScooter) return false;
    deliv.active=true; deliv.timeLeft=DELIV_TIME;
    deliv.done=0; deliv.missed=0; deliv.coins=0;
    deliv.carrying=null; deliv.target=null;
    sfxBlip(760);
    toast('배달 알바 시작!');
    delivNewOrder();   // 주문 toast(음식 이름)가 위 안내를 이어서 덮음
    return true;
  }

  /* 배달 완료: 음식 들고 목표 문 앞 */
  if(deliv.carrying!==null && deliv.target &&
     Math.abs(wrapDelta(deliv.target.wx - player.x, WLOOP)) < 12){
    const tip = deliv.target.patience > deliv.target.patMax*.5;
    const pay = DELIV_PAY + (tip?DELIV_TIP:0);
    deliv.coins += pay; deliv.done++;
    sfxBlip(1040);
    toast(DELIV_THANKS[(Math.random()*DELIV_THANKS.length)|0]
          + (tip?`\n(팁 +${DELIV_TIP}원!)`:''));
    deliv.carrying=null; deliv.target=null;
    return true;
  }

  /* 새 주문 픽업: 빈손으로 스쿠터 앞 */
  if(deliv.carrying===null && nearScooter){
    if(delivNewOrder()) sfxBlip(700);
    return true;
  }
  return false;
}

/* ---------- 정산 · 종료 ---------- */
function delivFinish(cancel){
  deliv.active=false;
  GS.deliveries += deliv.done;
  GS.coins += deliv.coins;
  refreshStats();
  if(cancel)
    toast(`알바를 접었다\n배달 ${deliv.done}건 · ${deliv.coins}원`);
  else if(deliv.done>0)
    toast(`알바 끝! 배달 ${deliv.done}건 · ${deliv.coins}원 벌었다 🛵`);
  else
    toast('알바 끝… 오늘은 공쳤다 🛵');
  deliv.carrying=null; deliv.target=null;
}

/* Escape — main.js가 연결 */
function delivCancel(){
  if(deliv.active) delivFinish(true);
}

/* ---------- 매 프레임 갱신 ---------- */
function updateDelivery(dt){
  if(!deliv.active) return;
  deliv.timeLeft -= dt;

  if(deliv.target){
    deliv.target.patience -= dt;
    if(deliv.target.patience<=0){
      deliv.missed++;
      deliv.carrying=null; deliv.target=null;   // 들고 있던 것 폐기
      sfxBlip(200);
      toast('주문이 식어버렸다…\n스쿠터에서 새 주문을 받으세요');
    }
  }
  if(deliv.timeLeft<=0) delivFinish(false);
}

/* ============================================================
   그리기
   ============================================================ */

/* ---------- 음식 픽셀 아이콘 (x,y = 좌상단, 약 12×10) ---------- */
function delivFoodIcon(ctx, x, y, i){
  x|=0; y|=0;
  if(i===0){                       // 붕어빵
    ctx.fillStyle='#e8b45a';
    ctx.fillRect(x+1,y+3,7,4);                   // 몸통
    ctx.fillRect(x,y+4,2,2);                     // 머리
    ctx.fillRect(x+8,y+2,2,2); ctx.fillRect(x+8,y+6,2,2);
    ctx.fillRect(x+9,y+3,2,4);                   // 꼬리
    ctx.fillStyle='rgba(60,40,20,.8)';
    ctx.fillRect(x+2,y+4,1,1);                   // 눈
    ctx.fillStyle='rgba(0,0,0,.15)';
    ctx.fillRect(x+4,y+3,1,4); ctx.fillRect(x+6,y+3,1,4); // 무늬
  }
  else if(i===1){                  // 오뎅 꼬치
    ctx.fillStyle='#a07040';
    ctx.fillRect(x+5,y,2,10);                    // 꼬치
    ctx.fillStyle='#ead9ae';
    ctx.fillRect(x+3,y+1,6,2);                   // 어묵 (물결 접기)
    ctx.fillRect(x+2,y+4,8,2);
    ctx.fillRect(x+3,y+7,6,2);
    ctx.fillStyle='rgba(160,100,50,.5)';
    ctx.fillRect(x+4,y+2,4,1); ctx.fillRect(x+4,y+8,4,1); // 국물 자국
  }
  else if(i===2){                  // 캔커피
    ctx.fillStyle='#8a5a30';
    ctx.fillRect(x+3,y+1,6,9);                   // 캔
    ctx.fillStyle='#c8ccd8';
    ctx.fillRect(x+3,y,6,2);                     // 뚜껑
    ctx.fillStyle='#e8c060';
    ctx.fillRect(x+3,y+4,6,3);                   // 라벨
    ctx.fillStyle='rgba(255,255,255,.35)';
    ctx.fillRect(x+4,y+2,1,7);                   // 하이라이트
  }
  else{                            // 주먹밥
    ctx.fillStyle='#f2f0e8';
    ctx.fillRect(x+4,y+1,4,2);                   // 삼각 밥
    ctx.fillRect(x+3,y+3,6,2);
    ctx.fillRect(x+2,y+5,8,4);
    ctx.fillStyle='#2a3828';
    ctx.fillRect(x+4,y+6,4,3);                   // 김
  }
}

/* 스쿠터 미니 아이콘 (화살표 HUD용, x,y = 좌상단, 약 12×8) */
function delivScooterIcon(ctx, x, y){
  x|=0; y|=0;
  ctx.fillStyle='#d95f76';
  ctx.fillRect(x+2,y+2,7,3);                     // 차체
  ctx.fillRect(x+8,y,2,3);                       // 핸들
  ctx.fillStyle='#e8dcc0';
  ctx.fillRect(x,y,3,4);                         // 배달통
  ctx.fillStyle='rgba(20,16,30,.9)';
  ctx.fillRect(x+1,y+5,3,3); ctx.fillRect(x+8,y+5,3,3); // 바퀴
}

/* ---------- 스쿠터 구조물 (거리에 주차) ---------- */
function drawScooter(ctx, pal, now){
  const sx = worldToScreen(LM.scooter)|0;
  if(sx<-40||sx>W+40) return;
  const gy = SIDEWALK_Y;

  // 바퀴 (앞 오른쪽)
  ctx.fillStyle='rgba(20,16,30,.9)';
  ctx.fillRect(sx+6,gy-4,4,4); ctx.fillRect(sx-10,gy-4,4,4);
  ctx.fillStyle='rgba(120,120,140,.8)';
  ctx.fillRect(sx+7,gy-3,2,2); ctx.fillRect(sx-9,gy-3,2,2);   // 휠

  // 차체 (발판 + 시트)
  ctx.fillStyle='#d95f76';
  ctx.fillRect(sx-6,gy-8,13,4);                  // 발판/몸체
  ctx.fillRect(sx-6,gy-11,6,3);                  // 시트 받침
  ctx.fillStyle='#2a2233';
  ctx.fillRect(sx-7,gy-12,8,2);                  // 시트

  // 핸들 기둥 + 핸들
  ctx.fillStyle='#b34a60';
  ctx.fillRect(sx+6,gy-14,2,7);
  ctx.fillStyle='#2a2233';
  ctx.fillRect(sx+4,gy-15,6,2);
  // 헤드라이트
  ctx.fillStyle='#ffd27f';
  ctx.fillRect(sx+8,gy-13,2,2);
  if(pal.night>.5){                              // 밤 헤드라이트 글로우
    const g=ctx.createRadialGradient(sx+9,gy-12,1,sx+9,gy-12,14);
    g.addColorStop(0,'rgba(255,210,127,.3)'); g.addColorStop(1,'rgba(255,210,127,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(sx+9,gy-12,14,0,7); ctx.fill();
  }

  // 뒤 배달통 (알바 중엔 뚜껑 열림 + 김)
  ctx.fillStyle='#e8dcc0';
  ctx.fillRect(sx-15,gy-17,9,9);
  ctx.fillStyle='#c94f4f';
  ctx.fillRect(sx-14,gy-13,7,2);                 // 띠 무늬
  if(deliv.active){
    ctx.fillStyle='#d8cbaa';
    ctx.fillRect(sx-17,gy-20,9,2);               // 열린 뚜껑 (뒤로 젖힘)
    ctx.fillStyle='rgba(30,26,40,.7)';
    ctx.fillRect(sx-14,gy-16,7,2);               // 열린 입구
    ctx.fillStyle='rgba(255,255,255,.3)';        // 모락모락 김
    for(let i=0;i<3;i++){
      const yy = gy-19 - ((now/240+i*40)%16);
      ctx.fillRect((sx-14+i*3)|0, yy|0, 2,2);
    }
  } else {
    ctx.fillStyle='#d8cbaa';
    ctx.fillRect(sx-16,gy-18,11,2);              // 닫힌 뚜껑
  }
}

/* ---------- 말풍선 (건물 지붕 위 주문) ---------- */
function delivDrawBubble(ctx, bx, by, food, patRatio){
  // 그림자 테두리
  ctx.fillStyle='rgba(20,16,30,.4)';
  ctx.fillRect(bx-12,by-1,24,17);
  // 흰 둥근 몸통
  ctx.fillStyle='rgba(255,255,255,.95)';
  ctx.fillRect(bx-11,by,22,15);
  ctx.fillRect(bx-12,by+2,24,11);
  // 꼬리
  ctx.fillRect(bx-2,by+15,4,2);
  ctx.fillRect(bx-1,by+17,2,2);
  // 음식 아이콘
  delivFoodIcon(ctx, bx-6, by+3, food);
  // 인내심 게이지 (초록→빨강)
  ctx.fillStyle='rgba(10,12,28,.55)';
  ctx.fillRect(bx-9,by+21,18,3);
  ctx.fillStyle=css(mix(hex('#e05555'), hex('#7fd08a'), patRatio));
  ctx.fillRect(bx-8,by+22,(16*patRatio)|0,1);
}

/* ---------- 화면 밖 목표 방향 화살표 (좌/우 가장자리) ---------- */
function delivDrawArrow(ctx, wx, now, isScooter, food){
  const sx = worldToScreen(wx);
  if(sx>=-6 && sx<=W+6) return;                  // 화면 안이면 스킵
  if(((now/350)|0)%2===0) return;                // 깜빡임
  const right = wrapDelta(wx - player.x, WLOOP) > 0;
  const ax = right ? W-8 : 8, ay = (H*.45)|0;

  ctx.fillStyle='rgba(255,255,255,.9)';
  if(right){                                     // ▶
    ctx.fillRect(ax-4,ay-3,2,7); ctx.fillRect(ax-2,ay-2,2,5);
    ctx.fillRect(ax,ay-1,2,3);   ctx.fillRect(ax+2,ay,1,1);
  } else {                                       // ◀
    ctx.fillRect(ax+2,ay-3,2,7); ctx.fillRect(ax,ay-2,2,5);
    ctx.fillRect(ax-2,ay-1,2,3); ctx.fillRect(ax-3,ay,1,1);
  }
  // 옆에 미니 아이콘
  const ix = right ? ax-19 : ax+8;
  if(isScooter) delivScooterIcon(ctx, ix, ay-4);
  else delivFoodIcon(ctx, ix, ay-5, food);
}

/* ---------- 월드/HUD 그리기 (매 프레임) ---------- */
function drawDeliveryWorld(ctx, pal, now){
  ctx.font="8px 'Galmuri9', monospace";

  if(!deliv.active){
    // 비활성: 스쿠터 근처면 작은 힌트
    if(Math.abs(wrapDelta(LM.scooter - player.x, WLOOP))<14){
      const sx = worldToScreen(LM.scooter)|0;
      ctx.textAlign='center';
      ctx.fillStyle=`rgba(255,255,255,${.5+Math.sin(now/300)*.25})`;
      ctx.fillText('↑ 배달 알바', sx, SIDEWALK_Y-24);
      ctx.textAlign='left';
    }
    return;
  }

  /* 주문 말풍선 (건물 지붕 위, 둥실둥실) */
  if(deliv.target){
    const t=deliv.target;
    const bx = worldToScreen(t.wx)|0;
    if(bx>-30 && bx<W+30){
      const by = (HORIZON - t.bldg.h - 24 + Math.sin(now/300)*2)|0;
      delivDrawBubble(ctx, bx, clamp(by,4,H), t.food,
                      clamp(t.patience/t.patMax,0,1));
    }
  }

  /* 방향 화살표 HUD: 목표 (빈손이면 스쿠터) */
  if(deliv.carrying!==null && deliv.target)
    delivDrawArrow(ctx, deliv.target.wx, now, false, deliv.target.food);
  else if(deliv.carrying===null)
    delivDrawArrow(ctx, LM.scooter, now, true, 0);

  /* 들고 있는 음식: 머리 위 배달가방 + 김 */
  if(deliv.carrying!==null && !player.sitting){
    const px = worldToScreen(player.x)|0;
    const py = (SIDEWALK_Y + player.y - 28 + Math.sin(now/280))|0;
    ctx.fillStyle='#e8dcc0';
    ctx.fillRect(px-4,py,9,7);                   // 가방 상자
    ctx.fillStyle='#c94f4f';
    ctx.fillRect(px-4,py+3,9,2);                 // 띠
    ctx.fillStyle='#d8cbaa';
    ctx.fillRect(px-5,py-1,11,2);                // 뚜껑
    ctx.fillStyle='rgba(255,255,255,.35)';       // 김
    for(let i=0;i<2;i++){
      const yy = py-3 - ((now/260+i*60)%12);
      ctx.fillRect((px-2+i*4)|0, yy|0, 2,2);
    }
  }

  /* 타이머 HUD (상단 중앙) */
  const bw=200, bx=(W-bw)/2, by=8;
  const ratio = clamp(deliv.timeLeft/DELIV_TIME,0,1);
  const low = deliv.timeLeft<10;
  ctx.fillStyle='rgba(6,8,22,.5)';
  ctx.fillRect(bx-3,by-3,bw+6,10);
  ctx.fillStyle='rgba(255,255,255,.15)';
  ctx.fillRect(bx,by,bw,4);
  ctx.fillStyle = low
    ? (((now/250)|0)%2 ? '#e05050' : '#8a2f2f')  // 10초 미만 빨간 깜빡
    : '#ffd27f';
  ctx.fillRect(bx,by,(bw*ratio)|0,4);
  ctx.fillStyle='rgba(255,255,255,.75)';
  ctx.textAlign='left';
  ctx.fillText(`배달 ${deliv.done}건`, bx, by+15);
  ctx.textAlign='right';
  ctx.fillText(`${deliv.coins}원`, bx+bw, by+15);
  ctx.textAlign='left';
}
