'use strict';
/* ============================================================
   5분 도시 — audio.js
   로파이 패드 + 바이닐 크래클 + 빗소리 (전부 WebAudio 생성)
   ============================================================ */

let AC=null, master=null, rainGain=null, soundOn=false;

function audioInit(){
  AC = new (window.AudioContext||window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value=.13; master.connect(AC.destination);

  const len=AC.sampleRate*2;

  /* 빗소리 */
  const buf=AC.createBuffer(1,len,AC.sampleRate), d=buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  const noise=AC.createBufferSource(); noise.buffer=buf; noise.loop=true;
  const bp=AC.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1600; bp.Q.value=.6;
  rainGain=AC.createGain(); rainGain.gain.value=GS.rain?.5:0;
  noise.connect(bp).connect(rainGain).connect(master); noise.start();

  /* 바이닐 크래클 */
  const cb=AC.createBuffer(1,len,AC.sampleRate), cd=cb.getChannelData(0);
  for(let i=0;i<len;i++) cd[i]=Math.random()<.0015?(Math.random()*2-1)*.5:0;
  const crk=AC.createBufferSource(); crk.buffer=cb; crk.loop=true;
  const cg=AC.createGain(); cg.gain.value=.25;
  crk.connect(cg).connect(master); crk.start();

  /* 로파이 코드 진행 */
  const prog=[[220,261.6,329.6,392],[174.6,220,261.6,349.2],
              [130.8,196,246.9,329.6],[146.8,220,293.7,370]];
  let ci=0;
  const playChord=()=>{
    if(!soundOn) return;
    const now=AC.currentTime;
    prog[ci%prog.length].forEach((f,i)=>{
      const o=AC.createOscillator(); o.type='triangle';
      o.frequency.value=f*(1+(Math.random()-.5)*.004);
      const g=AC.createGain();
      g.gain.setValueAtTime(0,now);
      g.gain.linearRampToValueAtTime(.05-i*.008,now+2.2);
      g.gain.linearRampToValueAtTime(0,now+7.6);
      const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=750;
      o.connect(g).connect(lp).connect(master);
      o.start(now); o.stop(now+8);
    });
    ci++;
  };
  playChord(); setInterval(playChord,8000);
}

function toggleSound(){
  soundOn=!soundOn;
  if(soundOn&&!AC) audioInit();
  if(AC){ AC.resume();
    master.gain.linearRampToValueAtTime(soundOn?.13:0,AC.currentTime+.5); }
  return soundOn;
}

function setRainAudio(on){
  if(rainGain) rainGain.gain.linearRampToValueAtTime(on?.5:0,AC.currentTime+1);
}

function sfxBlip(f){
  if(!soundOn||!AC) return;
  const now=AC.currentTime, o=AC.createOscillator(), g=AC.createGain();
  o.type='square'; o.frequency.value=f;
  g.gain.setValueAtTime(.06,now); g.gain.exponentialRampToValueAtTime(.001,now+.12);
  o.connect(g).connect(master); o.start(now); o.stop(now+.13);
}
