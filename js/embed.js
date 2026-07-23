'use strict';
/* ============================================================
   5분 도시 — embed.js   (임베드 전용 · index.html 에는 로드하지 않음)
   ------------------------------------------------------------
   로드 순서(임베드 호스트가 주입):
     config → palette → world → board → stars → stall → odeng
     → delivery → actors → player → audio → embed → main
   embed.js 가 main.js 보다 먼저 로드돼도 동작하도록,
   FMC.boot 내부에서 fmcStart 존재를 확인한 뒤 호출한다.

   window.FMC = { boot, pause, resume, destroy,
                  setRemotePlayers, showBubble, setSelfName, getSelfState }

   boot(opts) 주요 필드:
     container, buildings, onEnterBuilding, playerColors, store, onCityEvent,
     assetBase?  — 정적 에셋 베이스 경로. 설정 시 전역 ASSET_BASE 에 반영되어
                   named building 파사드 시트를 (assetBase + 'assets/city/CITY_MEGA.png')
                   에서 로드한다. 생략 시 '' (index.html 기준 상대경로, 독립 실행 기본).
   ============================================================ */

(function(){
  /* index.html #fmc-root 내부와 동일한 HUD/오버레이 마크업.
     (classic script 임베드라 템플릿이 없어 문자열로 유지 — index.html 과 동기 유지할 것) */
  const FMC_HTML = `
<div id="stage"><canvas id="scene" width="480" height="270"></canvas></div>

<div class="hud chip" id="clockbox">
  <span id="clock">PM 07:12</span><span id="phase">노을</span>
</div>
<div class="hud chip" id="statbox">
  <span class="stat">✦ <b id="wishcount">0</b></span>
  <span class="stat">☕ <b id="cancount">0</b></span>
  <span class="stat">🐟 <b id="fishcount">0</b></span>
  <span class="stat">🍢 <b id="odengcount">0</b></span>
  <span class="stat">🪙 <b id="coincount">0</b></span>
  <button class="stat-btn" id="collBtn" aria-label="수집 보기">✧ 수집</button>
</div>
<div class="hud" id="hint"></div>
<div class="hud" id="legend">←→ 걷기 · ⇧/더블탭 대시 · ↑ 살펴보기 · SPACE 점프 · P 수집 · R 비 · M 소리</div>
<div class="hud chip" id="toast"></div>

<div id="touch">
  <div class="tgroup actions">
    <button class="tbtn" data-k="interact" aria-label="살펴보기">↑</button>
    <button class="tbtn" data-k="jump"     aria-label="점프">✦</button>
    <button class="tbtn" data-k="dash"     aria-label="대시(홀드 스프린트)">»</button>
  </div>
  <div class="tgroup move">
    <button class="tbtn" data-k="left"  aria-label="왼쪽으로 걷기">◀</button>
    <button class="tbtn" data-k="right" aria-label="오른쪽으로 걷기">▶</button>
  </div>
</div>

<div class="overlay" id="boardOv">
  <div class="panel">
    <div class="panel-head"><span>동네 게시판</span><button class="x" data-close="boardOv">✕</button></div>
    <div id="noteView" class="note"></div>
    <div class="note-nav">
      <button id="notePrev" aria-label="이전">◀</button>
      <span id="notePos">1 / 1</span>
      <button id="noteNext" aria-label="다음">▶</button>
    </div>
    <div class="panel-foot">
      <button id="writeBtn" class="wide">✎ 쪽지 남기기</button>
    </div>
  </div>
</div>

<div class="overlay" id="writeOv">
  <div class="panel">
    <div class="panel-head"><span>쪽지 남기기</span><button class="x" data-close="writeOv">✕</button></div>
    <textarea id="noteInput" maxlength="60" rows="2"
      placeholder="이 도시에 한마디 남겨보세요 (최대 60자)"></textarea>
    <div class="panel-foot">
      <span id="charCount" class="muted">0 / 60</span>
      <button id="pinBtn" class="wide">게시판에 붙이기</button>
    </div>
  </div>
</div>

<div class="overlay" id="odengOv">
  <div class="panel">
    <div class="panel-head"><span>밤의 오뎅바</span><button class="x" data-close="odengOv">✕</button></div>
    <div id="odengMenuBody" class="coll"></div>
    <div class="panel-foot">
      <span class="muted">국물은 언제나 서비스</span>
      <button id="odengStartBtn" class="wide">🍢 장사 시작 (90초)</button>
    </div>
  </div>
</div>

<div class="overlay" id="collOv">
  <div class="panel">
    <div class="panel-head"><span>수집</span><button class="x" data-close="collOv">✕</button></div>
    <div id="collBody" class="coll"></div>
  </div>
</div>`;

  let rootEl = null;

  function buildDOM(container){
    rootEl = document.createElement('div');
    rootEl.id = 'fmc-root';
    rootEl.innerHTML = FMC_HTML;
    container.appendChild(rootEl);
    return rootEl;
  }

  function call(name, ...args){
    const fn = window[name];
    return typeof fn==='function' ? fn(...args) : undefined;
  }

  window.FMC = {
    boot(opts){
      opts = opts || {};
      const container = opts.container || document.body;
      buildDOM(container);

      // odeng.js IIFE 는 DOM 주입 전에 실행돼 버튼을 못 찾으므로 여기서 배선.
      const ob = document.getElementById('odengStartBtn');
      if(ob) ob.addEventListener('click', ()=>{
        if(typeof closeOverlay==='function') closeOverlay('odengOv');
        if(typeof odengStart==='function') odengStart();
      });

      // 에셋 베이스 경로 (예: cafe-bb7 는 '/city/' 주입 → assets 는 /city/assets/city/…)
      // config.js 의 전역 ASSET_BASE 에 반영. fmcStart → loadCityImage 가 이 값을 사용.
      if(typeof opts.assetBase === 'string') ASSET_BASE = opts.assetBase;

      // 색 · 게시판 스토어 · opts 주입
      if(opts.playerColors) call('setPlayerColors', opts.playerColors);
      if(opts.store)        call('setNoteStore', opts.store);
      call('fmcConfigure', opts);

      // 엔진 부트 (fmcStart 는 main.js. embed 가 먼저 로드돼도 여기선 이미 존재)
      if(typeof window.fmcStart==='function') window.fmcStart();
      else console.error('[FMC] fmcStart 없음 — main.js 가 embed.js 뒤에 로드됐는지 확인');
    },
    pause(){ call('fmcPause'); },
    resume(){ call('fmcResume'); },
    destroy(){
      call('fmcDestroy');
      if(rootEl && rootEl.parentNode){ rootEl.parentNode.removeChild(rootEl); rootEl=null; }
    },
    setRemotePlayers(players){ call('fmcSetRemotePlayers', players); },
    showBubble(id, text){ call('fmcShowBubble', id, text); },
    setSelfName(name){ call('fmcSetSelfName', name); },
    getSelfState(){
      const s = call('fmcGetSelfState');
      return s || { x:0, dir:1, walking:false };
    },
  };
})();
