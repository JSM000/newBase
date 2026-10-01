/**
 * 한 번의 검색(confirmSearch 또는 "나머지도 계산" 한 번)에서 실제로 길찾기를 계산하는 최대
 * 학교 수. 너무 크면 서버 함수 타임아웃(동시성 6으로 순차 처리하다 보니 수십~수백 곳이면
 * 요청 하나가 오래 걸림) 위험이 있어 상한을 둔다.
 *
 * route-ranking.ts(서버, 실제 이 값만큼만 계산)와 commute-panel.tsx(안내 문구에 이 숫자를
 * 그대로 보여줌)가 숫자를 공유하려고 서버 전용 의존성 없는 이 파일로 뺐다 — commute-panel.tsx는
 * 클라이언트 컴포넌트라 route-ranking.ts(Supabase 등 서버 전용 모듈을 import)를 직접 가져올
 * 수 없다. route-ranking.ts는 ROUTE_MAX_PER_QUERY 환경변수로 이 값을 덮어쓸 수 있는데,
 * 그 경우 안내 문구는 실제 동작과 어긋날 수 있다(운영 중 비상 조정용이라 감수).
 */
export const MAX_SCHOOLS_PER_SEARCH = 150;
