# 5분 도시 — five minute city 🏙️

하루가 5분에 흘러가는 픽셀 도시를 걷는 앰비언트 웹 토이입니다.  
노을에서 시작해 밤 → 새벽 → 낮이 지나가고, 5분을 머물면 작은 인사가 나옵니다.


## 기여자들

<div align="center">

| <a href="https://github.com/coitloz88"><img src="https://github.com/coitloz88.png" width="100"/></a> | <a href="https://github.com/easter423"><img src="https://github.com/easter423.png" width="100"/></a> | <a href="https://github.com/anthropics"><img src="https://github.com/anthropics.png" width="100"/></a> |
| :---: | :---: | :---: |
| [coitloz88](https://github.com/coitloz88) | [easter423](https://github.com/easter423) | [claude code](https://github.com/anthropics) |
| 잡도리 전문가 | 간장종지 | 일꾼(a.k.a. 돌쇠) |

</div>


## 조작

| 입력 | 동작 |
|---|---|
| ← → | 걷기 |
| ↑ 또는 Z | 살펴보기 (현관문·가로등·벤치·자판기·버스 정류장·고양이) |
| Space | 점프 |
| R | 비 켜기/끄기 (비가 오면 우산을 씁니다) |
| M | 로파이 사운드 켜기/끄기 |
| 1 2 3 4 | 새벽 / 낮 / 노을 / 밤으로 시간 이동 |
| 밤하늘 클릭 | 별똥별 · 소원 +1 |

소소한 것들: 벤치에 앉으면 시간이 6배로 흐릅니다. 자판기에서 캔을 뽑을 수
있고 가끔 꽝이 나옵니다. 지붕 위와 인도에 고양이가 삽니다. 밤에는 전철과
비행기가 지나갑니다. 터치 기기에서는 화면 버튼이 나타납니다.


## 로컬 실행

빌드 과정이 없습니다. `index.html`을 브라우저로 열면 끝.
(모듈 번들러 없이 일반 스크립트를 순서대로 로드하므로 `file://`로도 동작합니다.)


## 구조

```
index.html          진입점 (스크립트 로드 순서가 곧 의존 순서)
css/style.css       폰트 선언 · HUD · 터치 컨트롤
js/config.js        상수 · 전역 상태(GS) · 유틸(rng, 색, 루프 좌표)
js/palette.js       하루 주기 팔레트 키프레임 + 보간
js/world.js         스카이라인 생성 · 하늘 · 거리 · 소품 · 상호작용 판정
js/actors.js        별똥별 · 비행기 · 전철 · 새 · 고양이 두 마리
js/player.js        캐릭터 (이동 · 점프 · 앉기 · 우산 · 스프라이트)
js/audio.js         WebAudio 로파이 패드 · 크래클 · 빗소리 · 효과음
js/main.js          부트 · 입력 · HUD · 메인 루프
assets/fonts/       Mulmaru Mono (물마루 Mono)
```

배경은 이미지 없이 시드 기반으로 매번 같은 스카이라인을 그립니다.
이미지 에셋으로 바꾸고 싶다면 `world.js`의 `drawBuildingLayer()`를
`ctx.drawImage(img, -off, ...)` 랩어라운드 두 번 호출로 교체하면 됩니다.

## 크레딧

- 폰트: [물마루 Mono (Mulmaru Mono)](https://github.com/mushsooni/mulmaru) © Mushsooni,
  [SIL Open Font License 1.1](assets/fonts/OFL-LICENSE.txt)
