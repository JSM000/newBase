> 상위 목차: [00_개요.md](00_개요.md)

# 3. 길찾기 API·서버 (`src/app/api/*`, `src/lib/route-ranking.ts`)

## C1. 재시도 모드가 1회 150곳 상한을 우회 🟠 {#c1}

**위치**: `src/lib/route-ranking.ts:131-136`, `src/app/api/route-ranking/route.ts:40`

일반 모드는 `offset ~ offset+150`만 계산하지만, `retryCodes`가 있으면 **그 목록 전체**를 한 번에 계산한다.
`retryCodes`는 524개까지 받는다. 즐겨찾기 모드 + 재시도 코드 524개면:

- 길찾기 524건을 초당 8건으로 페이싱 → 약 65초 → `maxDuration = 60` 초과로 **요청이 중간에 끊기고**
  예산은 이미 524건 예약된 채 롤백도 안 됨.
- 실패분 롤백 주석(`:167` "batch.length ≤ MAX_PER_QUERY")의 전제가 깨짐.

또 `retryCodes`가 "이전에 실패한 학교"인지 서버가 확인하지 않아, 아무 학교 코드나 넣으면 offset 순서를
건너뛰고 계산할 수 있다.

**수정안**: 재시도 배치도 `slice(0, MAX_PER_QUERY)`로 자르기. (`includes` → `Set`으로 바꾸면 자잘한 O(n²)도 정리됨, `:114`·`:135`)

## C2. IP별 요청 제한 없음 🟠 {#c2}

`/api/route-ranking`·`/api/geocode`의 남용 방어는 (1) 브라우저 localStorage 쿨다운(`commute-rate-limit.ts`,
지우면 우회), (2) 서버 **전역** 일일 예산(`api_budget`)뿐이다. 스크립트로 직접 POST하면 1회 150건씩, 60번이면
일일 예산 9,000건이 다 차서 **그날 다른 사용자 전원이 길찾기를 못 쓴다**.

**수정안(가벼운 순)**:
- Vercel 방화벽(WAF)의 Rate Limiting 규칙을 `/api/route-ranking`에 설정 — 코드 변경 없음.
- 또는 Supabase에 `(ip, date)` 단위 카운터를 두고 기존 `reserve_api_budget`과 같이 확인
  (IP는 `x-forwarded-for` 첫 값, 해시해서 저장).

## C3. 카카오 응답 JSON 파싱 실패 시 요청 전체 실패 🟡 {#c3}

**위치**: `src/lib/kakao-directions.ts:58`

`await res.json()`이 try 밖이라, 카카오가 200에 깨진 본문을 주면 예외가 `mapPool`의 `Promise.all`까지 올라가
**150곳 전체가 500 에러**가 되고 예산 롤백(`route-ranking.ts:165-170`)도 실행되지 않는다.
`res.json()`을 try로 감싸 `{ retryable: true }`를 돌려주면 그 학교 하나만 실패로 끝난다.

## C4. 자잘한 정리 🟡

- `src/app/api/route-path/route.ts` — 410만 돌려주는 제거된 엔드포인트. 주석에도 "디렉터리 삭제 가능"이라 적혀
  있음. 호출하는 곳 없음 → 삭제.
- `route-ranking.ts:23` 주석 "클라 30초 제한" → 실제 쿨다운은 1분(`commute-rate-limit.ts`).
- `route-ranking/route.ts` — 즐겨찾기 분기와 일반 분기가 `computeRanking` 호출·에러 처리를 두 번 반복함.
  입력만 분기하고 호출은 한 번으로 합칠 수 있다.
- `/api/school-social`이 집계 3개 테이블을 매번 전체 조회 — 지금 학교 수(524)에선 문제없음. 학교가 늘어
  1,000행을 넘으면 Supabase 기본 행 제한에 걸리니 그때 `range`/뷰 통합 검토.
