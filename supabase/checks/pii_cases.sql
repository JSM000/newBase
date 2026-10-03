-- 서버 개인정보 패턴(_contains_blocked_pii) 점검 — 0006 마이그레이션 실행 후 SQL Editor에서 실행.
-- 결과가 0행이면 정상. 행이 나오면 그 입력에서 기대와 다르게 판정된 것.
--
-- scripts/check-pii-detect.mjs 의 케이스 중 차단(block) 등급 여부만 옮긴 것이다 —
-- 경고 등급(이름·주소·직위)은 서버에서 막지 않으므로 false 가 기대값.
-- 케이스를 추가하면 두 파일에 같이 추가할 것.

select input, expected, public._contains_blocked_pii(input) as actual
from (values
  ('연락은 010-1234-5678로', true),
  ('01012345678', true),
  ('010 1234 5678', true),
  ('043-123-4567', true),
  ('02-123-4567', true),
  ('900101-1234567', true),
  ('900101-1******', true),
  ('9001011234567', true),
  ('메일 abc@school.go.kr 로', true),
  ('국민은행 123456-01-123456', true),
  ('계좌 110-123-456789', true),
  ('김철수 선생님 좋아요', false),
  ('박민 부장님이 친절', false),
  ('청주대로 123', false),
  ('101동 1203호', false),
  ('교감 선생님이 깐깐함', false),
  ('행정실장님 친절', false),
  ('2026년 3월 24학급 학생 612명', false),
  ('주 20시간, 1시간 10분', false),
  ('출근길 30분 걸려요', false),
  ('단재교-초-직무-2007-682', false),
  ('충북교육연수원-초-직무-2023-01012345', false),
  ('S110000924', false),
  ('익명고양이', false),
  ('정말 좋은 학교', false),
  ('부장교사 수가 많음', false),
  ('교과전담 3명, 담임 20학급', false)
) as t(input, expected)
where public._contains_blocked_pii(input) is distinct from expected;
