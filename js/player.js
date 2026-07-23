'use strict';
/* ============================================================
   5분 도시 — player.js   (로드 순서: … → actors → player → audio → main)
   방향키 캐릭터: ←→ 걷기 · SPACE 점프 · ↑/Z 살펴보기
   비가 오면 우산을 씀. 벤치에 앉으면 시간이 빨리 흐름.
   drawFigure()는 원격 플레이어 렌더에도 재사용된다(colors 만 교체).
   ============================================================ */

const player = {
  x: 240,            // 월드 좌표 (WLOOP 루프)
  y: 0,              // 지면 기준 오프셋 (점프 시 음수)
  vy: 0,
  dir: 1,
  walking: false,
  sitting: null,     // 앉아있는 벤치 prop 또는 null
  anim: 0,
  sprint: false,     // 홀드 스프린트 중 (방향키/⇧/» 를 떼면 해제)
  dashCd: 0,         // 스프린트 진입 쿨다운
  dashGhost: [],     // 잔상 (월드x, dir, life)
  colors: {          // 기본 캐릭터 색 (임베드에서 boot opts.playerColors 로 주입)
    hood:'#e6b455', pants:'#3a4666', skin:'#f2c9a0', hair:'#2a2438',
  },
};

/* 임베드 boot 에서 캐릭터 색 주입 (누락 키는 기본색 유지) */
function setPlayerColors(c){
  if(!c) return;
  const cur = player.colors;
  player.colors = {
    hood:  c.hood  || cur.hood,
    pants: c.pants || cur.pants,
    skin:  c.skin  || cur.skin,
    hair:  c.hair  || cur.hair,
  };
}

const input = { left:false, right:false, shift:false };

const PLAYER_SPEED = 62;             // 기본 걷기 (조금 빠르게)
const JUMP_V = -88, GRAV = 340;
const DASH_V = 210, DASH_CD = 0.5;   // 스프린트 속도 / 진입 쿨다운

function playerStand(){
  if(player.sitting){
    player.x = player.sitting.x + 10; // 벤치 옆으로 일어남
    player.sitting = null;
  }
}

function playerJump(){
  if(player.sitting){ playerStand(); return; }
  if(player.y===0){ player.vy = JUMP_V; sfxBlip(700); }
}

/* 스프린트 진입(더블탭·⇧·» 홀드). 방향키를 계속 누르는 동안 대시 속도 유지,
   떼면 멈춘다. 쿨다운은 '진입'에만 적용 — 유지 중에는 재적용하지 않는다. */
function playerDash(){
  if(player.sitting || GS.mode!=='roam') return;
  if(player.sprint) return;          // 이미 스프린트 중 → 재적용 없음
  if(player.dashCd>0) return;        // 쿨다운 중엔 진입 불가
  player.sprint = true;
  player.dashCd = DASH_CD;
  sfxDash();
}

function updatePlayer(dt){
  const dir = (input.right?1:0) - (input.left?1:0);

  /* ⇧(또는 터치 ») 홀드: 이동 중이면 스프린트 진입 시도(쿨다운 존중) */
  if(input.shift && dir!==0) playerDash();
  /* 방향키를 떼면 스프린트 종료 → 그 자리에서 멈춘다 */
  if(dir===0) player.sprint=false;

  let moveV = 0;
  if(dir!==0){
    playerStand();
    player.dir = dir;
    player.walking = true;
    player.anim += dt*10;
    moveV = dir * (player.sprint ? DASH_V : PLAYER_SPEED);
    /* 스프린트 중 잔상 유지 */
    if(player.sprint && Math.random()<0.6)
      player.dashGhost.push({x:player.x, dir:player.dir, life:1});
  } else player.walking = false;

  if(player.dashCd>0) player.dashCd -= dt;
  player.dashGhost = player.dashGhost.filter(g=>(g.life-=dt*4)>0);

  if(moveV!==0)
    player.x = ((player.x + moveV*dt) % WLOOP + WLOOP) % WLOOP;

  if(player.y<0 || player.vy<0){
    player.vy += GRAV*dt;
    player.y  += player.vy*dt;
    if(player.y>=0){ player.y=0; player.vy=0; }
  }

  GS.timeScale = player.sitting ? 6 : 1;

  /* 카메라: 진행 방향을 살짝 앞서 봄 (스프린트 중엔 더 빠르게 따라감) */
  const lead = player.sprint ? 40 : 18;
  const target = player.x - W/2 + player.dir*lead;
  const follow = player.sprint ? 8 : 4;
  GS.camX += wrapDelta(target - GS.camX, WLOOP) * clamp(dt*follow, 0, 1);
}

/* ---------- 스프라이트 ----------
   렉트 조합 약 7x14px. 머스터드 후드티가 밤 팔레트에 잘 뜬다. */
const C_SHOE='#1c2036';

/* 서 있는/걷는 캐릭터 한 명을 그린다 — 내 캐릭터와 원격 플레이어 공용.
   sx: 화면 x, fy: 발 위치 y, dir: -1|1, walking: bool,
   anim: 걷기 위상, colors: {hood,pants,skin,hair}, air: 점프 중 여부 */
function drawFigure(ctx, sx, fy, dir, walking, anim, colors, air){
  const C = colors || player.colors;
  const d = dir;
  const step = walking ? (Math.sin(anim)>0?1:-1) : 0;

  /* 다리 */
  ctx.fillStyle=C.pants;
  if(air){ ctx.fillRect(sx-2,fy-5,2,4); ctx.fillRect(sx+1,fy-4,2,3); }
  else if(step>=0){ ctx.fillRect(sx-2,fy-5,2,5); ctx.fillRect(sx+1,fy-5,2,5); }
  else{ ctx.fillRect(sx-3,fy-5,2,5); ctx.fillRect(sx+2,fy-5,2,5); }
  ctx.fillStyle=C_SHOE;
  if(air){ ctx.fillRect(sx-3,fy-2,3,1); ctx.fillRect(sx+1,fy-1,3,1); }
  else if(step>=0){ ctx.fillRect(sx-3,fy-1,3,1); ctx.fillRect(sx+1,fy-1,3,1); }
  else{ ctx.fillRect(sx-4,fy-1,3,1); ctx.fillRect(sx+2,fy-1,3,1); }

  /* 몸통(후드) + 팔 */
  ctx.fillStyle=C.hood;
  ctx.fillRect(sx-3,fy-11,7,6);
  ctx.fillRect(sx+(d>0?3:-4),fy-10,2,4);              // 앞팔
  /* 머리 */
  ctx.fillStyle=C.skin; ctx.fillRect(sx-2,fy-14,5,3);
  ctx.fillStyle=C.hair; ctx.fillRect(sx-3,fy-16,7,3);
  ctx.fillRect(sx+(d>0?-3:2),fy-14,2,2);              // 옆머리
  /* 눈 */
  ctx.fillStyle=C.hair; ctx.fillRect(sx+(d>0?1:-1)+1,fy-13,1,1);
}

function drawPlayer(ctx, pal, now){
  const sx = (worldToScreen(player.x))|0;
  const C = player.colors;

  /* 대시 잔상 */
  for(const g of player.dashGhost){
    const gx = worldToScreen(g.x)|0, fy = SIDEWALK_Y|0;
    ctx.fillStyle=`rgba(230,180,85,${g.life*0.28})`;
    ctx.fillRect(gx-3,fy-11,7,6);
    ctx.fillRect(gx-2,fy-14,5,3);
  }

  if(player.sitting){
    const bx = worldToScreen(player.sitting.x)|0, by = SIDEWALK_Y;
    /* 벤치에 앉은 포즈 */
    ctx.fillStyle=C.hair;  ctx.fillRect(bx-2,by-16,5,2);
    ctx.fillStyle=C.skin;  ctx.fillRect(bx-2,by-14,5,3);
    ctx.fillStyle=C.hood;  ctx.fillRect(bx-3,by-11,7,5);
    ctx.fillStyle=C.pants; ctx.fillRect(bx-3,by-6,7,2);
    ctx.fillRect(bx-3,by-4,2,3); ctx.fillRect(bx+2,by-4,2,3);
    ctx.fillStyle=C_SHOE;  ctx.fillRect(bx-4,by-1,3,1); ctx.fillRect(bx+2,by-1,3,1);
    if(GS.rain) drawUmbrella(ctx,bx,by-18);
    return;
  }

  const fy = (SIDEWALK_Y + player.y)|0;   // 발 위치
  drawFigure(ctx, sx, fy, player.dir, player.walking, player.anim, C, player.y<0);

  if(GS.rain) drawUmbrella(ctx,sx,fy-18);
}

function drawUmbrella(ctx, sx, topY){
  ctx.fillStyle='#d95f76';
  ctx.fillRect(sx-6,topY,13,2);
  ctx.fillRect(sx-4,topY-2,9,2);
  ctx.fillRect(sx-1,topY-3,3,1);
  ctx.fillStyle='rgba(20,22,44,.95)';
  ctx.fillRect(sx,topY+2,1,6);
}
