# pixel_cat — 태스크 목록

> 기획/버전 로드맵은 `PLAN.md` 참고.  
> 여기서는 실제 구현 순서대로 태스크를 관리한다. 하나씩 완료 후 체크.

---

## Task 1 — globalState 기반 데이터 구조 정의

상태 저장 구조를 먼저 잡아야 이후 모든 기능이 올바르게 붙는다.

- [x] `globalState`에 저장할 키 구조 확정
  ```js
  {
    catType: null,        // 'fire' | 'water' | 'grass'
    xp: 0,
    level: 1,
    totalMinutes: 0       // XP 계산용 누적 코딩 시간
  }
  ```
- [x] `extension.js` activate 시 `globalState`에서 위 값을 읽어 webview로 전달
- [x] webview → extension `postMessage`로 변경사항 저장하는 채널 정리

---

## Task 2 — 알 선택 화면

최초 실행 (`catType === null`) 시 고양이 대신 알 3개를 표시한다.

- [x] webview 초기화 시 `catType` 값 체크 — null이면 알 선택 모드로 진입
- [x] Canvas에 알 3개 그리기 (procedural)
  - 불 알: 붉은 계열, 크랙 무늬
  - 물 알: 파란 계열, 물결 무늬
  - 풀 알: 초록 계열, 점박이 무늬
- [x] 마우스 호버 → 알 흔들리는 애니메이션 (±2px 진동)
- [x] 알 이름 레이블 표시 (`🔴 불`, `🔵 물`, `🟢 풀`)
- [x] 알 클릭 → 부화 연출
  - 금 파티클 폭발
  - 알 흔들림 가속 → 페이드아웃
  - 새끼 고양이 등장 (줌인 효과)
- [x] 선택한 `catType`을 extension으로 postMessage → `globalState` 저장

---

## Task 3 — 속성별 팔레트 시스템

`drawCat()` 함수가 `catType`을 받아 색상을 분기하도록 리팩터.

- [x] 속성별 팔레트 객체 정의
  ```js
  const PALETTES = {
    fire:  { body: '#e8521a', stripe: '#b03010', eye: '#ff4400', ... },
    water: { body: '#4a90d9', stripe: '#2860a8', eye: '#00ccff', ... },
    grass: { body: '#5ab84a', stripe: '#3a8030', eye: '#aaff44', ... },
  };
  ```
- [x] `applyPalette(catType)` 함수로 OG/LT/GR/ST 전역 변수 교체 (drawCat 호출 직전)
- [x] 스프라이트 내 하드코딩된 색상값을 팔레트 참조로 교체
- [x] 속성별 커맨드 파티클 분기
  - 불: 🔥 불꽃 파티클
  - 물: 💧 물방울 파티클
  - 풀: 🍃 잎사귀 파티클

---

## Task 4 — XP 누적 & 레벨 계산

- [ ] VSCode `onDidChangeTextDocument` 또는 1분 인터벌 타이머로 활성 코딩 감지
  - 파일 편집 이벤트 발생 시 해당 분을 "활성"으로 카운트
  - 1분마다 체크 → XP +1 → globalState 업데이트 → webview에 전달
- [ ] `/food`, `/pet` 커맨드 실행 시 XP +5 보너스
- [ ] 레벨 계산 함수
  ```js
  function calcLevel(xp) {
    if (xp >= 7000) return 5;
    if (xp >= 3500) return 4;
    if (xp >= 1500) return 3;
    if (xp >= 500)  return 2;
    return 1;
  }
  ```
- [ ] XP 변경 시 레벨 재계산 → 레벨업 감지 → 레벨업 이벤트 트리거

---

## Task 5 — 레벨업 연출

- [ ] 레벨업 시 webview에 `levelUp` 메시지 전달
- [ ] webview: 레벨업 파티클 폭발 (속성 파티클 대량 발생)
- [ ] extension: VSCode 알림 메시지 표시
  ```
  🎉 Nabi가 Lv.3으로 성장했어요!
  ```
- [ ] 레벨업 후 스프라이트 즉시 갱신

---

## Task 6 — 레벨별 외형 진화

`drawCat(state, frame, catType, level)` 에 레벨 분기 추가.

- [ ] **Lv.1** — 현재 스프라이트 기반, 속성 팔레트만 적용. 눈 크고 머리 비율 큼
- [ ] **Lv.2** — 전체 비율 소폭 성장, 줄무늬 1~2개 추가
- [ ] **Lv.3** — 성묘 비율, 귀 상단에 털 픽셀 추가
- [ ] **Lv.4** — 속성 악세서리 그리기
  - 불: 머리 위 작은 불꽃 왕관
  - 물: 목 부분 물방울 목걸이
  - 풀: 귀 사이 잎사귀 머리띠
- [ ] **Lv.5** — 오라 파티클 상시 발생 + 특별 색상
  - 불: 몸통 금빛 (`#ffd700`)
  - 물: 몸통 은빛 (`#c0e8ff`)
  - 풀: 몸통 황금잎 (`#d4ff70`)

---

## Task 7 — 상태바 업데이트

- [ ] 상태바 텍스트에 속성 이모지 + 레벨 포함
  ```
  🔴 =^･ω･^= Lv.3
  ```
- [ ] XP/레벨 변경 시 상태바 텍스트 즉시 갱신
- [ ] 4프레임 애니메이션은 유지 (레벨·이모지 부분은 고정, 고양이 얼굴 부분만 변환)

---

## Task 8 — 데이터 복원 (재시작)

- [ ] webview 로드 시 extension이 `globalState`의 `catType`·`xp`·`level` 전달
- [ ] webview: 받은 데이터로 초기 상태 세팅 (알 선택 화면 vs 고양이 화면 분기)
- [ ] 애니메이션 상태는 복원 안 해도 됨 — 항상 `sit`으로 시작

---

## Task 9 — 마켓플레이스 준비

- [ ] README에 진화 단계 비교 스크린샷 추가
- [ ] `CHANGELOG.md` 작성 (v0.1 ~ v0.2 변경 내역)
- [ ] `vsce package` 빌드 테스트
- [ ] 버전 번프 (0.1.5 → 0.2.0) 후 배포
