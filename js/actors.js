'use strict';
/* ============================================================
   5분 도시 — actors.js
   별똥별 · 하트 · 비행기 · 전철 · 새(자동) · 고양이
   ============================================================ */

let shots = [];                          // 별똥별 (화면 좌표)
let hearts = [];                         // 하트 (화면 좌표)
let plane = null,  planeTimer = 22;
let train = null,  trainTimer = 16;
let birds = [],    birdTimer  = 12;      // 자동으로만 지나감

/* ---------- 별똥별 ---------- */
function spawnShot(x, y){
  shots.push({x, y, vx:-90-Math.random()*60, vy:55+Math.random()*35, life:1});
}
function updateDrawShots(ctx, dt){
  shots = shots.filter(s=>s.life>0);
  for(const s of shots){
    s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=dt*1.2;
    for(let i=0;i<8;i++){
      ctx.fillStyle=`rgba(255,255,230,${s.life*(1-i/8)})`;
      ctx.fillRect((s.x-s.vx*.012*i)|0,(s.y-s.vy*.012*i)|0,2,2);
    }
  }
}

/* ---------- 하트 ---------- */
function spawnHeart(sx, sy){ hearts.push({x:sx, y:sy, life:1}); }
function updateDrawHearts(ctx, dt){
  hearts = hearts.filter(h=>h.life>0);
  for(const h of hearts){
    h.y-=12*dt; h.life-=dt;
    ctx.fillStyle=`rgba(255,120,150,${h.life})`;
    ctx.fillRect(h.x|0,h.y|0,2,2); ctx.fillRect((h.x+3)|0,h.y|0,2,2);
    ctx.fillRect((h.x+1)|0,(h.y+2)|0,3,2);
  }
}

/* ---------- 비행기 (밤하늘) ---------- */
function updateDrawPlane(ctx, pal, now, dt){
  planeTimer-=dt;
  if(!plane && planeTimer<0 && pal.night>.6){
    plane={x:-10, y:20+Math.random()*35};
    planeTimer=25+Math.random()*20;
  }
  if(plane){
    plane.x+=12*dt;
    ctx.fillStyle='rgba(200,210,255,.8)'; ctx.fillRect(plane.x|0,plane.y,3,1);
    if((now/300|0)%2===0){ ctx.fillStyle='#ff6b6b'; ctx.fillRect((plane.x-2)|0,plane.y,1,1); }
    if(plane.x>W+12) plane=null;
  }
}

/* ---------- 전철 (중간 레이어 뒤) ---------- */
function updateDrawTrain(ctx, pal, dt){
  trainTimer-=dt;
  if(!train && trainTimer<0 && pal.night>.4){
    train={x:W+10, len:70};
    trainTimer=20+Math.random()*18;
  }
  if(train){
    train.x-=95*dt;
    const ty=HORIZON-42;
    ctx.fillStyle='rgba(15,18,40,.95)'; ctx.fillRect(train.x|0,ty,train.len,5);
    ctx.fillStyle='rgba(255,220,150,.9)';
    for(let i=2;i<train.len-2;i+=5) ctx.fillRect((train.x+i)|0,ty+1,3,2);
    if(train.x<-train.len-10) train=null;
  }
}

/* ---------- 새 (낮, 자동) ---------- */
function updateDrawBirds(ctx, pal, dt){
  birdTimer-=dt;
  if(birdTimer<0 && pal.night<.3){
    const dir=Math.random()<.5?1:-1, sx=dir>0?-8:W+8, sy=40+Math.random()*70;
    for(let i=0;i<5;i++)
      birds.push({x:sx-dir*i*7, y:sy+(Math.random()-.5)*14,
                  v:(28+Math.random()*10)*dir, ph:Math.random()*6.28});
    birdTimer=18+Math.random()*14;
  }
  birds=birds.filter(b=>b.x>-20&&b.x<W+20);
  for(const b of birds){
    b.x+=b.v*dt; b.ph+=dt*9;
    const f=Math.sin(b.ph)>0;
    ctx.fillStyle=pal.night>.5?'rgba(20,24,48,.9)':'rgba(30,34,60,.85)';
    ctx.fillRect(b.x|0,b.y|0,1,1);
    ctx.fillRect((b.x-2)|0,(b.y+(f?-1:0))|0,2,1);
    ctx.fillRect((b.x+1)|0,(b.y+(f?-1:0))|0,2,1);
  }
}

/* ---------- 지붕 고양이 (앞 레이어 옥상, 클릭으로 인사) ---------- */
const roofCat = { active:false, b:null, x:0, dir:1, state:'walk', t:0, wait:8 };
function roofCatRespawn(){
  let bs = FRONT.buildings.filter(b=>b.w>=34);
  if(!bs.length) bs = FRONT.buildings;   // 넓은 건물이 없으면 아무 건물이나
  if(!bs.length) return;                 // 건물 자체가 없으면 리스폰 보류
  roofCat.b = bs[(Math.random()*bs.length)|0];
  roofCat.x = 4 + Math.random()*(roofCat.b.w-12);
  roofCat.dir = Math.random()<.5?-1:1;
  roofCat.state='walk'; roofCat.t=0; roofCat.active=true;
}
function roofCatScreenPos(){
  if(!roofCat.active) return null;
  return { sx: worldToScreen(roofCat.b.x + roofCat.x),
           sy: HORIZON - roofCat.b.h };
}
function updateDrawRoofCat(ctx, pal, now, dt){
  if(!roofCat.active){
    roofCat.wait-=dt;
    if(roofCat.wait<0) roofCatRespawn();
    return;
  }
  roofCat.t+=dt;
  if(roofCat.state==='walk'){
    roofCat.x+=roofCat.dir*7*dt;
    if(roofCat.x<3||roofCat.x>roofCat.b.w-9) roofCat.dir*=-1;
    if(roofCat.t>6+Math.random()*4){ roofCat.state='sit'; roofCat.t=0; }
  } else if(roofCat.t>5){
    roofCat.active=false; roofCat.wait=10+Math.random()*14; return;
  }
  const p=roofCatScreenPos();
  if(p.sx<-10||p.sx>W+10) return;
  const {sx,sy}=p, dir=roofCat.dir;
  const bob = roofCat.state==='walk' ? (Math.sin(now/120)>0?0:1) : 0;
  ctx.fillStyle='rgba(12,14,30,.95)';
  ctx.fillRect(sx|0,(sy-4-bob)|0,6,3);
  ctx.fillRect((sx+(dir>0?5:-2))|0,(sy-6-bob)|0,3,3);
  ctx.fillRect((sx+(dir>0?5:-2))|0,(sy-7-bob)|0,1,1);
  ctx.fillRect((sx+(dir>0?7:0))|0,(sy-7-bob)|0,1,1);
  ctx.fillRect((sx+(dir>0?-1:6))|0,(sy-6-bob)|0,1,2);
  if(roofCat.state==='sit'&&pal.night>.5){
    ctx.fillStyle='#ffd27f';
    ctx.fillRect((sx+(dir>0?6:-1))|0,(sy-5)|0,1,1);
  }
}

/* ---------- 길고양이 (인도, ↑ 로 쓰다듬기) ---------- */
const streetCat = { active:false, x:0, dir:1, state:'sit', t:0, wait:14, petted:false };
function streetCatRespawn(){
  streetCat.x = (GS.camX + W/2 + 200 + Math.random()*400) % WLOOP;
  streetCat.dir = Math.random()<.5?-1:1;
  streetCat.state = 'sit'; streetCat.t=0;
  streetCat.petted=false; streetCat.active=true;
}
function updateDrawStreetCat(ctx, pal, now, dt){
  if(!streetCat.active){
    streetCat.wait-=dt;
    if(streetCat.wait<0) streetCatRespawn();
    return;
  }
  streetCat.t+=dt;
  if(streetCat.state==='walk'){
    streetCat.x=((streetCat.x+streetCat.dir*8*dt)%WLOOP+WLOOP)%WLOOP;
    if(streetCat.t>4){ streetCat.state='sit'; streetCat.t=0; }
  } else if(streetCat.t>6+Math.random()*4){
    if(Math.random()<.5){ streetCat.state='walk'; streetCat.t=0;
      streetCat.dir=Math.random()<.5?-1:1; }
    else { streetCat.active=false; streetCat.wait=18+Math.random()*16; return; }
  }
  const sx=worldToScreen(streetCat.x)|0, sy=SIDEWALK_Y;
  if(sx<-12||sx>W+12) return;
  const dir=streetCat.dir;
  const bob = streetCat.state==='walk' ? (Math.sin(now/120)>0?0:1) : 0;
  ctx.fillStyle='rgba(24,20,34,.95)';
  ctx.fillRect(sx,(sy-4-bob)|0,6,3);
  ctx.fillRect(sx+(dir>0?5:-2),(sy-6-bob)|0,3,3);
  ctx.fillRect(sx+(dir>0?5:-2),(sy-7-bob)|0,1,1);
  ctx.fillRect(sx+(dir>0?7:0),(sy-7-bob)|0,1,1);
  ctx.fillRect(sx+(dir>0?-1:6),(sy-6-bob)|0,1,2);
  ctx.fillRect(sx+1,sy-1,1,1); ctx.fillRect(sx+4,sy-1,1,1); // 다리
  if(pal.night>.5){
    ctx.fillStyle='#ffd27f';
    ctx.fillRect(sx+(dir>0?6:-1),sy-5,1,1);
  }
}
