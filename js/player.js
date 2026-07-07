'use strict';
/* ============================================================
   5분 도시 — player.js
   방향키 캐릭터: ←→ 걷기 · SPACE 점프 · ↑/Z 살펴보기
   비가 오면 우산을 씀. 벤치에 앉으면 시간이 빨리 흐름.
   ============================================================ */

const player = {
  x: 240,            // 월드 좌표 (WLOOP 루프)
  y: 0,              // 지면 기준 오프셋 (점프 시 음수)
  vy: 0,
  dir: 1,
  walking: false,
  sitting: null,     // 앉아있는 벤치 prop 또는 null
  anim: 0,
  dashV: 0,          // 대시 잔여 속도
  dashCd: 0,         // 대시 쿨다운
  dashGhost: [],     // 잔상 (월드x, dir, life)
};

const input = { left:false, right:false };

const PLAYER_SPEED = 62;             // 기본 걷기 (조금 빠르게)
const JUMP_V = -88, GRAV = 340;
const DASH_V = 210, DASH_TIME = 0.22, DASH_CD = 0.5;

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

function playerDash(){
  if(player.sitting || player.dashCd>0 || GS.mode!=='roam') return;
  player.dashV = DASH_V * player.dir;
  player.dashCd = DASH_TIME + DASH_CD;
  sfxDash();
}

function updatePlayer(dt){
  const dir = (input.right?1:0) - (input.left?1:0);
  let moveV = 0;

  if(dir!==0){
    playerStand();
    player.dir = dir;
    moveV = dir * PLAYER_SPEED;
    player.walking = true;
    player.anim += dt*10;
  } else player.walking = false;

  /* 대시 */
  if(player.dashCd>0) player.dashCd -= dt;
  if(player.dashV!==0){
    moveV = player.dashV;
    player.dashV *= Math.pow(0.3, dt/DASH_TIME);    // DASH_TIME 동안 서서히 감쇠
    if(Math.abs(player.dashV)<PLAYER_SPEED) player.dashV=0;
    // 잔상
    if(Math.random()<0.6)
      player.dashGhost.push({x:player.x, dir:player.dir, life:1});
  }
  player.dashGhost = player.dashGhost.filter(g=>(g.life-=dt*4)>0);

  if(moveV!==0)
    player.x = ((player.x + moveV*dt) % WLOOP + WLOOP) % WLOOP;

  if(player.y<0 || player.vy<0){
    player.vy += GRAV*dt;
    player.y  += player.vy*dt;
    if(player.y>=0){ player.y=0; player.vy=0; }
  }

  GS.timeScale = player.sitting ? 6 : 1;

  /* 카메라: 진행 방향을 살짝 앞서 봄 (대시 중엔 더 빠르게 따라감) */
  const lead = player.dashV!==0 ? 40 : 18;
  const target = player.x - W/2 + player.dir*lead;
  const follow = player.dashV!==0 ? 8 : 4;
  GS.camX += wrapDelta(target - GS.camX, WLOOP) * clamp(dt*follow, 0, 1);
}

/* ---------- 스프라이트 ----------
   렉트 조합 약 7x14px. 머스터드 후드티가 밤 팔레트에 잘 뜬다. */
const C_HOOD='#e6b455', C_PANTS='#3a4666', C_SKIN='#f2c9a0',
      C_HAIR='#2a2438', C_SHOE='#1c2036';

function drawPlayer(ctx, pal, now){
  const sx = (worldToScreen(player.x))|0;
  const d = player.dir;

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
    ctx.fillStyle=C_HAIR;  ctx.fillRect(bx-2,by-16,5,2);
    ctx.fillStyle=C_SKIN;  ctx.fillRect(bx-2,by-14,5,3);
    ctx.fillStyle=C_HOOD;  ctx.fillRect(bx-3,by-11,7,5);
    ctx.fillStyle=C_PANTS; ctx.fillRect(bx-3,by-6,7,2);
    ctx.fillRect(bx-3,by-4,2,3); ctx.fillRect(bx+2,by-4,2,3);
    ctx.fillStyle=C_SHOE;  ctx.fillRect(bx-4,by-1,3,1); ctx.fillRect(bx+2,by-1,3,1);
    if(GS.rain) drawUmbrella(ctx,bx,by-18);
    return;
  }

  const fy = (SIDEWALK_Y + player.y)|0;   // 발 위치
  const step = player.walking ? (Math.sin(player.anim)>0?1:-1) : 0;
  const air = player.y<0;

  /* 다리 */
  ctx.fillStyle=C_PANTS;
  if(air){ ctx.fillRect(sx-2,fy-5,2,4); ctx.fillRect(sx+1,fy-4,2,3); }
  else if(step>=0){ ctx.fillRect(sx-2,fy-5,2,5); ctx.fillRect(sx+1,fy-5,2,5); }
  else{ ctx.fillRect(sx-3,fy-5,2,5); ctx.fillRect(sx+2,fy-5,2,5); }
  ctx.fillStyle=C_SHOE;
  if(air){ ctx.fillRect(sx-3,fy-2,3,1); ctx.fillRect(sx+1,fy-1,3,1); }
  else if(step>=0){ ctx.fillRect(sx-3,fy-1,3,1); ctx.fillRect(sx+1,fy-1,3,1); }
  else{ ctx.fillRect(sx-4,fy-1,3,1); ctx.fillRect(sx+2,fy-1,3,1); }

  /* 몸통(후드) + 팔 */
  ctx.fillStyle=C_HOOD;
  ctx.fillRect(sx-3,fy-11,7,6);
  ctx.fillRect(sx+(d>0?3:-4),fy-10,2,4);              // 앞팔
  /* 머리 */
  ctx.fillStyle=C_SKIN; ctx.fillRect(sx-2,fy-14,5,3);
  ctx.fillStyle=C_HAIR; ctx.fillRect(sx-3,fy-16,7,3);
  ctx.fillRect(sx+(d>0?-3:2),fy-14,2,2);              // 옆머리
  /* 눈 */
  ctx.fillStyle=C_HAIR; ctx.fillRect(sx+(d>0?1:-1)+1,fy-13,1,1);

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
