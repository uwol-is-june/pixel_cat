# pixel_cat 🐱

VSCode 안에서 픽셀 고양이를 키우는 익스텐션.

고양이 **Nabi**는 에디터 옆 패널에서 스스로 걷고, 앉고, 그루밍하며 생활한다.
커맨드로 밥을 주거나 쓰다듬거나 재울 수 있다.

---

## 설치 (개발 모드)

1. 이 폴더를 VSCode에서 열기
2. **F5** → Extension Development Host 창이 열림
3. 상태바 왼쪽 하단 `=^･ω･^=` 클릭하거나 커맨드 팔레트에서 "Pixel Cat" 검색

---

## 커맨드

| 커맨드 팔레트 | 설명 |
|--------------|------|
| `🐱 Pixel Cat: Show` | 고양이 패널 열기 |
| `🐟 Pixel Cat: /food` | 먹이 주기 → 생선 먹는 애니메이션 + ✦ 파티클 |
| `🤚 Pixel Cat: /pet` | 쓰다듬기 → happy 애니메이션 + ♥ 파티클 |
| `💤 Pixel Cat: /sleep` | 재우기 / 깨우기 (토글) → Zzz 파티클 |

> 팔레트 단축키: `Ctrl+Shift+P` / `Cmd+Shift+P`  
> 패널 내 버튼으로도 동일하게 조작 가능

---

## 고양이 행동

- **자율 이동** — 패널을 열면 알아서 걷고, 앉고, 그루밍함
- **캔버스 클릭** — 고양이를 직접 클릭하면 meow + happy 반응
- **파티클** — 상호작용 시 하트·반짝·Zzz 이펙트
- **상태바 애니메이션** — `=^･ω･^=` / `=^♥♥^=` / `=^･ー･^=` 순환

---

## 스크린샷

> 준비 중 (v0.3에서 추가 예정)

---

## 개발

```bash
# 디버그 실행: F5 (launch.json 포함됨)

# 패키징 (vsce 필요)
npm run package
# → pixel-cat-x.x.x.vsix 생성
# Extensions 패널 → ... → Install from VSIX 로 설치
```

- 언어: JavaScript (TypeScript 아님, 빌드 스텝 없음)
- 렌더링: HTML Canvas — zero dependencies
- VSCode API: `^1.80.0`

---

## 버전 히스토리

### v0.1.1 — 2026-04-16 · Prototype Integration

**프로토타입 기반으로 전면 교체. 정적 스프라이트 → 자율 행동 고양이.**

- 고양이 자율 행동: sit → walk → groom 자동 순환
- 배경: 별 + 바닥 타일 픽셀아트 룸
- 파티클 시스템: ♥ (pet), z (sleep), ✦ (food)
- 상태바 텍스트 애니메이션 (`=^･ω･^=` → `=^♥♥^=` → `=^･ー･^=`)
- 캔버스 내 버튼으로 직접 커맨드 실행
- `/sleep` 토글 (재실행 시 깨움)
- 캔버스 고양이 클릭 → meow + happy 상태
- 커맨드 ID `pixelCat.*` 로 통일
- `.vscode/launch.json` 추가 (F5 디버그 설정)

---

### v0.1.0 — 2026-04-16 · MVP

**기본 기능 전체 구현.**

- 16×16 픽셀아트 스프라이트 (팔레트 7색)
- 6종 애니메이션: idle / walking / sitting / grooming / sleeping / eating
- `/food` `/pet` `/sleep` 커맨드 (커맨드 중복 방지 포함)
- 상태 영속성: `ExtensionContext.globalState`
- 상태별 상태바 이모지 자동 업데이트

---

### v0.0.1 — 2026-04-16 · Project Scaffolding

**초기 프로젝트 세팅. 코드 뼈대 + 문서 구조.**

- `package.json` — VSCode 익스텐션 기본 구조
- `extension.js` — activate/deactivate 뼈대, placeholder Canvas
- `CLAUDE.md` — 프로젝트 개요·아키텍처·컨벤션·체크리스트
- `docs/PLAN.md` — v0.1~v0.3 로드맵
- `docs/features/` — animation / commands / statusbar 설계 문서

---

## 라이선스

MIT © uwol-is-june
