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
| ⇧(Shift) 또는 방향키 더블탭 | 대시 |
| ↑ 또는 Z | 살펴보기 · 상호작용 |
| Space | 점프 (굽기 중엔 진행) |
| P | 수집 패널 열기 |
| R | 비 켜기/끄기 (비가 오면 우산을 씁니다) |
| M | 로파이 사운드 켜기/끄기 |
| 1 2 3 4 | 새벽 / 낮 / 노을 / 밤으로 시간 이동 |
| Esc | 미니게임·패널 닫기 |
| 밤하늘 클릭 | 별똥별 · 소원 +1 |

터치 기기에서는 화면에 방향·대시·상호작용 버튼이 나타납니다.


## 할 수 있는 것들

- **동네 게시판**: 게시판 앞에서 ↑. 이웃(NPC)들이 시간대·날씨에 맞춰 남긴
  쪽지를 넘겨보고, 직접 쪽지를 남길 수 있습니다. 남긴 쪽지는 브라우저에
  저장되어 다음에 와도 게시판에 붙어 있어요.
- **별자리 잇기** (밤): 하늘에서 ↑ 를 누르면 밝은 별들이 나타납니다.
  강조된 별을 순서대로 이어 별자리를 완성하면 이름이 붙고 수집됩니다.
- **붕어빵 포장마차** (밤): 포장마차 앞에서 ↑. 반죽을 붓고, 굽는 게이지가
  GOOD 구간일 때 뒤집고 꺼내면 노릇하게 완성됩니다. 타이밍이 어긋나면 타요.
- **소소한 것들**: 벤치에 앉으면 시간이 6배로 흐르고, 자판기에서 캔을 뽑고
  (가끔 꽝), 현관문·가로등을 켜고, 지붕과 인도의 고양이와 인사합니다.
  밤에는 전철과 비행기가 지나갑니다.

수집 항목(소원·음료·붕어빵·읽은 쪽지·별자리·내 쪽지)은 P 로 볼 수 있습니다.


## 로컬 실행

빌드 과정이 없습니다. `index.html`을 브라우저로 열면 끝.
(모듈 번들러 없이 일반 스크립트를 순서대로 로드하므로 `file://`로도 동작합니다.)


## GitHub Pages 배포

1. 새 저장소를 만들고 이 폴더 **내용물**(index.html이 루트에 오도록)을 푸시:
   ```bash
   git init
   git add .
   git commit -m "five minute city"
   git branch -M main
   git remote add origin https://github.com/<유저명>/<저장소명>.git
   git push -u origin main
   ```
2. **Settings → Pages → Build and deployment**에서
   Source **Deploy from a branch**, Branch **main / (root)** 선택 후 Save.
3. 1~2분 뒤 `https://<유저명>.github.io/<저장소명>/` 에서 열립니다.

> 쪽지 저장은 브라우저 localStorage를 씁니다. 배포 주소별로 따로 저장되고,
> 시크릿 모드에서는 세션 동안만 유지됩니다.


## 구조

```
index.html          진입점 (스크립트 로드 순서가 곧 의존 순서)
css/style.css       폰트 선언 · HUD · 터치 컨트롤 · 오버레이/패널
js/config.js        상수 · 전역 상태(GS) · 랜드마크 좌표 · 유틸
js/palette.js       하루 주기 팔레트 키프레임 + 보간
js/world.js         스카이라인 · 하늘 · 거리 · 소품 · 상호작용 판정
js/board.js         게시판: NPC 쪽지 풀 · 플레이어 쪽지(localStorage)
js/stars.js         별자리 잇기 미니게임
js/stall.js         붕어빵 포장마차 굽기 시퀀스
js/actors.js        별똥별 · 비행기 · 전철 · 새 · 고양이 두 마리
js/player.js        캐릭터 (이동 · 대시 · 점프 · 앉기 · 우산 · 스프라이트)
js/audio.js         WebAudio 로파이 패드 · 크래클 · 빗소리 · 효과음
js/main.js          부트 · 입력 · 모드 라우팅 · 오버레이 · 메인 루프
assets/fonts/       Mulmaru Mono (물마루 Mono)
```

배경·캐릭터·소품은 이미지 없이 코드로 그립니다. 다만 거리의 named building
8동 외관만은 픽셀 에셋(`assets/city/CITY_MEGA.png`)에서 파사드를 잘라 그립니다
(`world.js`의 `drawNamedSprite()`). 에셋이 아직 로드되지 않았거나 로드에
실패하면(`file://`·임베드 초기 프레임 등) 기존 사각형+간판 렌더로 자동
폴백합니다.

### 임베드 시 에셋 경로 (`assetBase`)

`index.html` 직접 실행(독립 실행)에서는 `assets/city/CITY_MEGA.png` 를 상대
경로로 로드합니다. 다른 호스트에 임베드할 때는 정적 파일 위치가 다를 수 있어
`FMC.boot({ assetBase })` 로 베이스 경로를 넘깁니다.

```js
window.__FMC_EMBED__ = true;        // 자동 부트 방지 (스크립트 로드 전에 설정)
// config → palette → world → board → stars → stall → odeng
// → delivery → actors → player → audio → embed → main  순으로 주입 후:
FMC.boot({
  container: document.getElementById('host'),
  assetBase: '/city/',              // → /city/assets/city/CITY_MEGA.png 로드
  // ...buildings, onEnterBuilding, playerColors, store, onCityEvent
});
```

`assetBase` 를 생략하면 `''`(상대경로) 가 기본입니다. 값은 `config.js` 의 전역
`ASSET_BASE` 에 반영되고, `fmcStart()` 안에서 `loadCityImage()` 가 이 값을 사용해
파사드 시트를 로드합니다.


## 크레딧

- 폰트: [물마루 Mono (Mulmaru Mono)](https://github.com/mushsooni/mulmaru) © Mushsooni,
  [SIL Open Font License 1.1](assets/fonts/OFL-LICENSE.txt)
- 거리 파사드: [City Mega Pack](https://opengameart.org/content/city-mega-pack)
  © GrafxKid, **CC0 1.0 (Public Domain)** — [assets/city/CREDITS.md](assets/city/CREDITS.md)
