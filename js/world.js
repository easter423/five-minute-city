'use strict';
/* ============================================================
   5분 도시 — world.js   (로드 순서: config → palette → world → …)
   스카이라인 · 하늘 · 거리(인도/차도) · 거리 소품 · named building
   * named building 파사드는 City Mega Pack(CC0) 시트에서 drawNamedSprite() 로
     그린다(랩어라운드 두 위치). 시트 미로딩/실패 시 사각형+간판 폴백.
   ============================================================ */

/* ---------- 건물 레이어 ----------
   f: 시차 계수 (1.0 = 거리와 같은 깊이) */

/* 건물 한 채(지붕 디테일 + 창문)를 만든다. door/named 는 호출부가 채운다. */
function buildingBody(r, x, w, h, o){
  const b = { x, w, h, wins:[], roof:[], boost:0, door:null, named:null };
  // 지붕 디테일
  if(o.detail && r()<.75){
    const kind = r();
    if(kind<.4)      b.roof.push({t:'ant', x:(w*(.2+r()*.6))|0, h:(4+r()*8)|0});
    else if(kind<.7) b.roof.push({t:'box', x:(w*(.15+r()*.5))|0, w:(5+r()*6)|0, h:(3+r()*3)|0});
    else             b.roof.push({t:'tank',x:(w*(.2+r()*.5))|0, w:(6+r()*3)|0, h:(5+r()*3)|0});
  }
  // 창문
  if(o.windows){
    const cw=2, ch=3, gx=4, gy=6;
    for(let wy=5; wy<h-6; wy+=gy)
      for(let wx=3; wx<w-4; wx+=gx)
        if(r()<.85) b.wins.push({x:wx,y:wy,w:cw,h:ch,r:r(),fl:r()});
  }
  return b;
}

function makeBuildingLayer(seed, o){
  const r = rng(seed);
  if(o.named && o.named.length) return makeNamedFrontLayer(r, o);

  const buildings = [];
  let x = 0;
  while(x < o.loop){
    const w = (o.wMin + r()*(o.wMax-o.wMin)) | 0;
    const h = (o.hMin + r()*(o.hMax-o.hMin)) | 0;
    const b = buildingBody(r, x, w, h, o);
    // 현관문 (앞 레이어만) — ↑ 로 건물 불을 켜고 끔
    if(o.doors && w>=22){
      b.door = { x:(w*(.25+r()*.5))|0, w:5, h:9 };
    }
    buildings.push(b);
    x += w + (r()<.3 ? (2+r()*8)|0 : 0);
  }
  return { buildings, f:o.f, loop:o.loop, idx:o.idx };
}

/* named building 고정 배치 + 사이 공백만 절차 생성으로 채운 front 레이어.
   named building: 문 world x(nb.x)는 §2 계약 고정, 건물 좌측 = nb.x - doorOffset,
   폭 = nb.w(파사드 실폭). 스프라이트가 있으면 높이 = sprite.sh, 없으면 폴백 높이.
   간판(한글 label)은 파사드 위에. seed 는 그대로 유지. */
const NAMED_DOOR_W = 5;
const NAMED_HEIGHTS = { cafe:64, korean:52, chinese:46, japanese:46,
                        western:56, cinema:60, boardgame:54, office:50 };
function namedHeight(id){
  const h = NAMED_HEIGHTS[id];
  return clamp(h==null ? 52 : h, 40, 72);
}

function makeNamedFrontLayer(r, o){
  const named = o.named.slice().sort((a,b)=>a.x-b.x);
  const buildings = [];
  let cursor = 0;

  const fillGap = (from, to)=>{
    let x = from;
    while(x < to-8){
      let w = (o.wMin + r()*(o.wMax-o.wMin)) | 0;
      if(x+w > to) w = to-x;            // 남은 공백에 맞게 마지막 폭 축소
      if(w < 14) break;                 // 너무 좁으면 공백으로 남김
      const h = (o.hMin + r()*(o.hMax-o.hMin)) | 0;
      const b = buildingBody(r, x, w, h, o);
      if(o.doors && w>=22) b.door = { x:(w*(.25+r()*.5))|0, w:5, h:9 };
      buildings.push(b);
      x += w + (r()<.3 ? (2+r()*8)|0 : 0);
    }
  };

  for(const nb of named){
    const w = nb.w|0;
    const sp = nb.sprite || null;
    const doorOffset = nb.doorOffset!=null ? (nb.doorOffset|0) : (w>>1);
    const left = nb.x - doorOffset;        // 문 world x 를 nb.x 에 고정
    fillGap(cursor, left);
    const h = sp ? sp.sh : namedHeight(nb.id);
    const b = buildingBody(r, left, w, h, o);
    // door.x: 문 중앙이 정확히 nb.x 가 되도록 (center = left + door.x + door.w/2)
    b.door = { x: doorOffset - NAMED_DOOR_W/2, w:NAMED_DOOR_W, h:9 };
    b.named = { id:nb.id, label:nb.label };
    b.sprite = sp;
    buildings.push(b);
    cursor = left + w;
  }
  fillGap(cursor, o.loop);

  return { buildings, f:o.f, loop:o.loop, idx:o.idx };
}

const layers = [
  makeBuildingLayer(11,{loop:960,  f:.15, idx:0, wMin:26,wMax:60,hMin:60,hMax:130,windows:false,detail:false}),
  makeBuildingLayer(23,{loop:960,  f:.4,  idx:1, wMin:24,wMax:52,hMin:46,hMax:100,windows:true, detail:true }),
  makeBuildingLayer(47,{loop:WLOOP,f:1.0, idx:2, wMin:28,wMax:64,hMin:34,hMax:80, windows:true, detail:true, doors:true,
                        named:(typeof CITY_BUILDINGS!=='undefined'?CITY_BUILDINGS:null)}),
];
const FRONT = layers[2];

/* ---------- named building 파사드 스프라이트 (City Mega Pack, CC0) ----------
   ASSET_BASE + 'assets/city/CITY_MEGA.png' 를 로드. 로드 전/실패 시 cityImg=null
   → drawBuildingLayer 가 기존 사각형+간판 폴백으로 그린다(file:// · 임베드 초기 프레임 안전).
   ASSET_BASE 가 확정된 뒤(fmcStart) 호출되도록 loadCityImage() 로 분리. */
let cityImg = null;
/* custom 파사드(cafe/korean)는 CC0 원본을 픽셀 편집한 facades_custom.png 에서 크롭.
   sprite.custom:true → customImg 사용. 로드 전/실패 시 null → 해당 동만 사각형 폴백. */
let customImg = null;
function loadCityImage(){
  const base = (typeof ASSET_BASE==='string' ? ASSET_BASE : '');
  const img = new Image();
  img.onload  = ()=>{ cityImg = img; };
  img.onerror = ()=>{ cityImg = null; };   // 실패 시 폴백 유지
  img.src = base + 'assets/city/CITY_MEGA.png';
  loadCustomCityImage(base);
}
function loadCustomCityImage(base){
  const img = new Image();
  img.onload  = ()=>{ customImg = img; };
  img.onerror = ()=>{ customImg = null; };  // 실패 시 폴백 유지
  img.src = base + 'assets/city/facades_custom.png';
}

/* ---------- 별 · 구름 ---------- */
const stars = (()=>{ const r=rng(7), a=[];
  for(let i=0;i<90;i++) a.push({x:r()*W, y:r()*(HORIZON-70), s:r()<.15?2:1, tw:r()*6.28});
  return a; })();
const clouds = (()=>{ const r=rng(99), a=[];
  for(let i=0;i<6;i++) a.push({x:r()*W, y:12+r()*65, w:26+r()*40, v:.9+r()*1.4});
  return a; })();

/* ---------- 거리 소품 ----------
   kind: lamp / bench / vend / bus  (월드 좌표, WLOOP 루프) */
const props = (()=>{
  const r = rng(2026), a = [];
  for(let i=0;i<9;i++)                       // 가로등
    a.push({kind:'lamp', x:(i*213 + r()*60)|0, on:null}); // on:null=자동(밤)
  a.push({kind:'bench', x:320  + (r()*40|0)});
  a.push({kind:'bench', x:1250 + (r()*40|0)});
  a.push({kind:'vend',  x:660  + (r()*40|0)});
  a.push({kind:'vend',  x:1620 + (r()*40|0)});
  a.push({kind:'bus',   x:980  + (r()*40|0)});
  // named 가게 문 앞(±16px)에 소품이 놓이면 소품 우선 규칙 때문에 입장이 막힌다 → 문 반경 밖으로 밀어냄
  const doorXs = (typeof CITY_BUILDINGS !== 'undefined' ? CITY_BUILDINGS : []).map(b => b.x);
  for(const p of a){
    for(const dx of doorXs){
      const d = wrapDelta(p.x - dx, WLOOP);
      if(Math.abs(d) < 16) p.x = (((dx + (d >= 0 ? 16 : -16)) % WLOOP) + WLOOP) % WLOOP;
    }
  }
  return a;
})();

function lampIsOn(p, pal){ return p.on===null ? pal.night>.45 : p.on; }

/* ---------- 상호작용 대상 찾기 ----------
   반환: {type:'prop'|'door', obj, wx} 또는 null
   우선순위(계약): 거리 소품 > named 가게 문(입장) > 절차생성 건물 문(불 토글).
   (앉기해제·배달·랜드마크·길고양이·별자리는 main.js tryInteract 에서 별도 처리) */
function findInteract(px){
  // 1) 거리 소품 우선 — 같은 위치에 소품이 있으면 소품이 이긴다
  let best=null, bestD=13;
  for(const p of props){
    const d = Math.abs(wrapDelta(p.x - px, WLOOP));
    const reach = p.kind==='bench'?11:9;
    if(d < Math.min(bestD, reach)){ best={type:'prop',obj:p,wx:p.x}; bestD=d; }
  }
  if(best) return best;

  // 2) named 가게 문 — 인식 범위를 파사드 폭까지 넓힘(주인공 뒤에 가게가 있으면 입장)
  let namedBest=null, namedD=Infinity;
  for(const b of FRONT.buildings){
    if(!b.door || !b.named) continue;
    const dx = b.x + b.door.x + b.door.w/2;
    const reach = Math.max(b.w/2, 12);
    const d = Math.abs(wrapDelta(dx - px, WLOOP));
    if(d < reach && d < namedD){ namedBest={type:'door',obj:b,wx:dx}; namedD=d; }
  }
  if(namedBest) return namedBest;

  // 3) 절차생성 건물 문 — 불 토글
  let procBest=null, procD=8;
  for(const b of FRONT.buildings){
    if(!b.door || b.named) continue;
    const dx = b.x + b.door.x + b.door.w/2;
    const d = Math.abs(wrapDelta(dx - px, WLOOP));
    if(d < procD){ procBest={type:'door',obj:b,wx:dx}; procD=d; }
  }
  return procBest;
}

/* ============================================================
   그리기
   ============================================================ */

function drawSky(ctx, pal, t, now){
  const g=ctx.createLinearGradient(0,0,0,HORIZON+10);
  g.addColorStop(0,css(pal.skyTop)); g.addColorStop(.55,css(pal.skyMid));
  g.addColorStop(1,css(pal.skyBot));
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  if(pal.night>.15){
    for(const s of stars){
      const tw=.55+.45*Math.sin(now/900+s.tw);
      ctx.fillStyle=`rgba(255,255,255,${(pal.night-.15)*tw})`;
      ctx.fillRect(s.x|0,s.y|0,s.s,s.s);
    }
  }
  /* 해 / 달 */
  const arc = p => ({ x:W*.12+p*W*.76, y:HORIZON-30-Math.sin(p*Math.PI)*150 });
  if(t>.02&&t<.62){
    const p=arc((t-.02)/.6);
    ctx.fillStyle='rgba(255,240,200,.35)';
    ctx.beginPath(); ctx.arc(p.x,p.y,16,0,7); ctx.fill();
    ctx.fillStyle=t<.15||t>.45?'#ffb36b':'#fff3c4';
    ctx.fillRect(p.x-6,p.y-6,12,12); ctx.fillRect(p.x-8,p.y-4,16,8); ctx.fillRect(p.x-4,p.y-8,8,16);
  }
  if(t>.6||t<.06){
    const p=arc(((t+(t<.5?1:0))-.6)/.48);
    ctx.fillStyle='#f4f6ff';
    ctx.fillRect(p.x-5,p.y-5,10,10); ctx.fillRect(p.x-7,p.y-3,14,6); ctx.fillRect(p.x-3,p.y-7,6,14);
    ctx.fillStyle=css(pal.skyTop);
    ctx.fillRect(p.x-1,p.y-5,8,8);
  }
}

function drawClouds(ctx, pal, dt){
  for(const c of clouds){
    c.x-=(reduceMotion?.2:1)*c.v*dt; if(c.x<-c.w)c.x=W+10;
    ctx.fillStyle=`rgba(${pal.cloud[0]|0},${pal.cloud[1]|0},${pal.cloud[2]|0},.5)`;
    ctx.fillRect(c.x|0,c.y|0,c.w,4);
    ctx.fillRect((c.x+5)|0,(c.y-3)|0,c.w*.55,3);
    ctx.fillRect((c.x+3)|0,(c.y+4)|0,c.w*.7,3);
  }
}

function drawBuildingLayer(ctx, L, pal){
  const col = pal.L[L.idx];
  const off = ((GS.camX*L.f)%L.loop + L.loop)%L.loop;
  const litFrac = .04 + pal.night*.5;
  const winDim = 'rgba(120,110,140,.35)';

  for(const b of L.buildings){
    for(const base of [b.x-off, b.x-off+L.loop]){
      if(base>W||base+b.w<0) continue;
      const y=HORIZON-b.h;

      /* named building + 스프라이트 시트 로드 완료 → 이미지 파사드
         custom:true 파사드는 facades_custom.png(customImg), 그 외엔 CITY_MEGA(cityImg). */
      const spImg = (b.named && b.sprite) ? (b.sprite.custom ? customImg : cityImg) : null;
      if(spImg){
        drawNamedSprite(ctx, base, b, pal, spImg);
        drawBuildingSign(ctx, base, (HORIZON - b.sprite.sh) - 14, b, pal);  // 파사드 위 한글 간판
        continue;
      }

      ctx.fillStyle=css(col);
      ctx.fillRect(base|0, y, b.w, b.h);
      for(const rf of b.roof){
        if(rf.t==='ant'){ ctx.fillRect((base+rf.x)|0, y-rf.h, 1, rf.h);
          if(pal.night>.5 && (GS.elapsed*1.5|0)%2===0){
            ctx.fillStyle='rgba(255,80,80,.9)';
            ctx.fillRect((base+rf.x)|0,y-rf.h-1,1,1); ctx.fillStyle=css(col); } }
        else if(rf.t==='box') ctx.fillRect((base+rf.x)|0, y-rf.h, rf.w, rf.h);
        else { ctx.fillRect((base+rf.x)|0, y-rf.h, rf.w, rf.h);
               ctx.fillRect((base+rf.x+1)|0, y-rf.h-2, rf.w-2, 2); }
      }
      for(const wn of b.wins){
        const lit = b.boost || wn.r < litFrac;
        if(lit){
          const fl = wn.fl<.06 ? (Math.sin(GS.elapsed*2+wn.fl*99)>.2?1:.25) : 1;
          ctx.fillStyle=`rgba(255,210,127,${.85*fl})`;
        } else if(pal.night<.3){
          ctx.fillStyle=winDim;
        } else continue;
        ctx.fillRect((base+wn.x)|0, HORIZON-b.h+wn.y, wn.w, wn.h);
      }
      if(b.door){
        ctx.fillStyle = b.boost ? 'rgba(255,210,127,.9)' : 'rgba(10,12,28,.85)';
        ctx.fillRect((base+b.door.x)|0, HORIZON-b.door.h, b.door.w, b.door.h);
        ctx.fillStyle='rgba(255,255,255,.25)';
        ctx.fillRect((base+b.door.x+b.door.w-2)|0, HORIZON-5, 1, 1); // 손잡이
      }
      if(b.named) drawBuildingSign(ctx, base, y, b, pal);
    }
  }
}

/* named building 파사드를 시트에서 잘라 그린다(1:1) + 밤낮 톤.
   바닥은 HORIZON 에 맞춘다(drawGround 가 이후 인도/차도를 덮음). */
function drawNamedSprite(ctx, base, b, pal, img){
  const sp = b.sprite;
  const dx = base|0, dy = HORIZON - sp.sh;
  ctx.drawImage(img, sp.sx, sp.sy, sp.sw, sp.sh, dx, dy, sp.sw, sp.sh);
  // 밤 어둠 오버레이 (파사드 위에 반투명 남색)
  if(pal.night > 0.02){
    ctx.fillStyle = `rgba(10,12,40,${(pal.night*0.45).toFixed(3)})`;
    ctx.fillRect(dx, dy, sp.sw, sp.sh);
  }
  // 밤엔 문/1층 부근 은은한 창문 불빛 글로우
  if(pal.night > 0.4){
    const gx = base + b.door.x + b.door.w/2;
    const g = ctx.createRadialGradient(gx, HORIZON-4, 1, gx, HORIZON-4, 22);
    g.addColorStop(0, `rgba(255,214,140,${(0.24*pal.night).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(dx, HORIZON-26, sp.sw, 26);
  }
}

/* named building 간판 — 건물 상단에 라벨을 픽셀 폰트로.
   월드 배율(비정수)로 확대되면 뭉개지므로 디바이스 좌표계에서 Galmuri11 정수배로 그린다. */
function drawBuildingSign(ctx, base, y, b, pal){
  const dsx=cv.width/W, dsy=cv.height/H, ds=dsx;
  const fs = 11 * Math.max(1, Math.round(ds*7/11));     // Galmuri11 정수배 (≈7px×ds)
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.font = fs+"px 'Galmuri11', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const label = b.named.label;
  const cx = Math.round((base + b.w/2)*dsx);
  const plateY = Math.round((y + 2)*dsy);
  const tw = Math.ceil(ctx.measureText(label).width);
  const padX = Math.round(fs*3/7);                       // 원본 plateW=tw+6(@7px)
  const plateW = tw + padX*2, plateX = cx - (plateW>>1);
  const plateH = Math.round(fs*10/7);
  const hl = Math.max(1, Math.round(dsy));
  // 간판 판
  ctx.fillStyle = 'rgba(10,12,28,.82)';
  ctx.fillRect(plateX, plateY, plateW, plateH);
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  ctx.fillRect(plateX, plateY, plateW, hl);
  // 라벨 (밤엔 따뜻한 색, 낮엔 밝은 미색)
  ctx.fillStyle = pal.night>.4 ? '#ffd27f' : '#f2eee4';
  ctx.fillText(label, cx, plateY + Math.round(fs*8/7));  // 원본 baseline plateY+8(@7px)
  ctx.restore();
}

function drawGround(ctx, pal){
  const dark = mix(pal.L[2],[0,0,0],.35);
  /* 인도 */
  ctx.fillStyle=css(mix(pal.L[2],[255,255,255],.12));
  ctx.fillRect(0,HORIZON,W,ROAD_Y-HORIZON);
  ctx.fillStyle='rgba(0,0,0,.25)';
  ctx.fillRect(0,ROAD_Y-2,W,1);                       // 연석
  /* 인도 보도블럭 줄눈 */
  ctx.fillStyle='rgba(0,0,0,.12)';
  const seam0 = -(((GS.camX%16)+16)%16);
  for(let sx=seam0; sx<W; sx+=16) ctx.fillRect(sx|0,HORIZON,1,ROAD_Y-2-HORIZON);
  /* 차도 */
  ctx.fillStyle=css(dark);
  ctx.fillRect(0,ROAD_Y,W,H-ROAD_Y);
  ctx.fillStyle='rgba(255,255,255,.22)';
  const dash0 = -(((GS.camX%28)+28)%28);
  for(let sx=dash0; sx<W; sx+=28) ctx.fillRect(sx|0,ROAD_Y+9,12,2);
}

function drawProps(ctx, pal, now){
  for(const p of props){
    const sx = worldToScreen(p.x)|0;
    if(sx<-30||sx>W+30) continue;
    const gy = SIDEWALK_Y;

    if(p.kind==='lamp'){
      const on = lampIsOn(p,pal);
      ctx.fillStyle='rgba(16,18,38,.95)';
      ctx.fillRect(sx,gy-26,2,26);                    // 기둥
      ctx.fillRect(sx-3,gy-27,8,2);                   // 팔
      if(on){
        ctx.fillStyle='#ffe8a8';
        ctx.fillRect(sx+3,gy-25,3,2);                 // 전구
        const g=ctx.createRadialGradient(sx+4,gy-24,1,sx+4,gy-24,22);
        g.addColorStop(0,'rgba(255,220,140,.30)'); g.addColorStop(1,'rgba(255,220,140,0)');
        ctx.fillStyle=g;
        ctx.beginPath(); ctx.arc(sx+4,gy-24,22,0,7); ctx.fill();
      } else {
        ctx.fillStyle='rgba(90,95,130,.9)';
        ctx.fillRect(sx+3,gy-25,3,2);
      }
    }
    else if(p.kind==='bench'){
      ctx.fillStyle='rgba(20,22,44,.95)';
      ctx.fillRect(sx-8,gy-6,16,2);                   // 좌판
      ctx.fillRect(sx-8,gy-11,16,2);                  // 등받이
      ctx.fillRect(sx-7,gy-4,2,4); ctx.fillRect(sx+5,gy-4,2,4);
    }
    else if(p.kind==='vend'){
      ctx.fillStyle='rgba(20,22,44,.95)';
      ctx.fillRect(sx-5,gy-16,11,16);
      const glow = pal.night>.4;
      ctx.fillStyle = glow ? '#8fd7ff' : 'rgba(160,190,220,.6)';
      ctx.fillRect(sx-3,gy-14,7,6);                   // 진열창
      ctx.fillStyle=glow?'#ffd27f':'rgba(200,180,140,.6)';
      ctx.fillRect(sx-3,gy-6,3,2);                    // 배출구
      if(glow){
        const g=ctx.createRadialGradient(sx,gy-10,1,sx,gy-10,14);
        g.addColorStop(0,'rgba(140,215,255,.22)'); g.addColorStop(1,'rgba(140,215,255,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(sx,gy-10,14,0,7); ctx.fill();
      }
    }
    else if(p.kind==='bus'){
      ctx.fillStyle='rgba(20,22,44,.95)';
      ctx.fillRect(sx,gy-22,2,22);
      ctx.fillStyle=pal.night>.5?'#ffd27f':'rgba(230,210,160,.9)';
      ctx.fillRect(sx-4,gy-24,10,6);                  // 표지판
      ctx.fillStyle='rgba(20,22,44,.9)';
      ctx.fillRect(sx-2,gy-22,6,1); ctx.fillRect(sx-2,gy-20,6,1);
    }
  }
}

/* ↑ 상호작용 말풍선 */
function drawInteractBubble(ctx, wx, y, now){
  const sx = worldToScreen(wx)|0;
  const bob = Math.sin(now/280)>0?0:1;
  const by = y - 34 - bob;
  ctx.fillStyle='rgba(255,255,255,.92)';
  ctx.fillRect(sx-4,by,9,9);
  ctx.fillStyle='#1a1e3c';
  ctx.fillRect(sx,by+2,1,5);
  ctx.fillRect(sx-1,by+3,3,1);
  ctx.fillRect(sx-2,by+4,1,1); ctx.fillRect(sx+2,by+4,1,1);
  ctx.fillStyle='rgba(255,255,255,.92)';
  ctx.fillRect(sx,by+9,1,2);
}
