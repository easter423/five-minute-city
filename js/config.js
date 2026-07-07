'use strict';
/* ============================================================
   5분 도시 — config.js
   공용 상수 · 전역 상태 · 유틸
   ============================================================ */

const W = 480, H = 270;          // 내부 해상도 (픽셀아트 기준)
const DAY = 300;                 // 하루 길이(초) = 5분
const HORIZON   = 232;           // 건물 밑변
const SIDEWALK_Y = 246;          // 인도(캐릭터 발) 높이
const ROAD_Y    = 250;           // 차도 시작
const WLOOP = 1920;              // 거리(월드) 한 바퀴 길이 = W*4

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 랜드마크 월드 좌표 (거리 곳곳에 하나씩) */
const LM = {
  board:  120,     // 게시판
  scooter: 560,    // 배달 스쿠터 (배달 알바 시작점)
  stall:  1040,    // 붕어빵 포장마차 (밤에만 열림)
  odeng:  1450,    // 오뎅 포장마차 (밤에만 열림)
};
const STORE_KEY = 'fmc.notes.v1';   // 플레이어가 남긴 쪽지 저장

/* 전역 게임 상태 — main.js 루프에서 갱신 */
const GS = {
  elapsed: 0,        // 실제 경과(초)
  dayTime: 0,        // 하루 시간 누적(벤치에 앉으면 빨라짐)
  tOff: 0.55,        // 노을에서 시작
  t: 0.55,           // 현재 하루 위상 0..1
  pal: null,
  camX: 0,
  now: 0, dt: 0,
  timeScale: 1,
  rain: false,
  wishes: 0, cans: 0,
  fish: 0,                 // 구운 붕어빵 수
  odengSold: 0,            // 오뎅바에서 받은 손님 수
  deliveries: 0,           // 완료한 배달 수
  coins: 0,                // 알바로 모은 돈(원)
  constellations: [],      // 완성한 별자리 이름들
  readNotes: 0,            // 읽은 쪽지 수
  mode: 'roam',            // roam | stall | odeng | sky | board | writing (배달은 roam 중 진행)
};

/* ---------- seeded rng ---------- */
function rng(seed){ let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

/* ---------- color utils ---------- */
const hex = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const css = c => `rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;
const mix = (a,b,t) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];

/* ---------- math utils ---------- */
const clamp = (v,a,b) => v<a?a:v>b?b:v;

/* 루프 월드에서 a→b 최단 부호 거리 (-loop/2 .. loop/2) */
function wrapDelta(d, loop){
  d = ((d % loop) + loop) % loop;
  return d > loop/2 ? d - loop : d;
}

/* 월드 x → 화면 x (가장 가까운 랩 위치) */
function worldToScreen(wx){
  return W/2 + wrapDelta(wx - (GS.camX + W/2), WLOOP);
}
