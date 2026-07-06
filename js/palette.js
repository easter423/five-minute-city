'use strict';
/* ============================================================
   5분 도시 — palette.js
   하루 주기 팔레트 키프레임 + 보간
   t: 0 새벽 · .25 낮 · .5 노을 · .75 밤 · 1 새벽
   ============================================================ */

const KEYS = [
  {t:0.00, skyTop:'#33305e', skyMid:'#8d5f8e', skyBot:'#f2a17c',
   L:['#8a7bb5','#5f5490','#3a3263'], cloud:'#e8b7a8', night:0.35},
  {t:0.25, skyTop:'#6fb7e0', skyMid:'#a9d9ef', skyBot:'#e9f6fb',
   L:['#a3b9d9','#7590bd','#4c6791'], cloud:'#ffffff', night:0.0},
  {t:0.50, skyTop:'#453a7d', skyMid:'#c75b8f', skyBot:'#ff9660',
   L:['#7b4d8f','#54306e','#301b46'], cloud:'#f0a58c', night:0.35},
  {t:0.75, skyTop:'#060a1c', skyMid:'#101733', skyBot:'#1c2450',
   L:['#242b4f','#171e3c','#0c1128'], cloud:'#2a3358', night:1.0},
  {t:1.00, skyTop:'#33305e', skyMid:'#8d5f8e', skyBot:'#f2a17c',
   L:['#8a7bb5','#5f5490','#3a3263'], cloud:'#e8b7a8', night:0.35},
];
KEYS.forEach(k => { k.skyTop=hex(k.skyTop); k.skyMid=hex(k.skyMid);
  k.skyBot=hex(k.skyBot); k.cloud=hex(k.cloud); k.L=k.L.map(hex); });

function palette(t){
  let a=KEYS[0], b=KEYS[1];
  for(let i=0;i<KEYS.length-1;i++)
    if(t>=KEYS[i].t && t<=KEYS[i+1].t){ a=KEYS[i]; b=KEYS[i+1]; break; }
  const f=(t-a.t)/(b.t-a.t||1), u=f*f*(3-2*f); // smoothstep
  return {
    skyTop:mix(a.skyTop,b.skyTop,u), skyMid:mix(a.skyMid,b.skyMid,u),
    skyBot:mix(a.skyBot,b.skyBot,u), cloud:mix(a.cloud,b.cloud,u),
    L:[0,1,2].map(i=>mix(a.L[i],b.L[i],u)),
    night:a.night+(b.night-a.night)*u,
  };
}

function phaseName(t, night){
  if(night>.75) return '밤';
  if(t<.13||t>.9) return '새벽';
  if(t<.4)  return '낮';
  if(t<.65) return '노을';
  return '저녁';
}
