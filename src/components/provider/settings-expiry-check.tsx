'use client';

import { useEffect } from 'react';
import { useUserSettingsStore } from '@/store/use-user-settings-store';
import { useFavoriteSchoolsStore } from '@/store/use-favorite-schools-store';

/**
 * 앱 진입 시 1회 — localStorage에서 설정을 명시적으로 rehydrate(persist middleware의
 * skipHydration: true와 짝) 하고, 보관 기한(RETENTION_DAYS)이 지났으면 전체 삭제한다.
 * 즐겨찾기 스토어(만료 없음)도 같은 이유로 여기서 같이 rehydrate — persist skipHydration을
 * 쓰는 모든 로컬 스토어의 공용 부트스트랩 지점.
 */
export function SettingsExpiryCheck() {
  useEffect(() => {
    useUserSettingsStore.persist.rehydrate();
    useUserSettingsStore.getState().checkExpiry();
    useFavoriteSchoolsStore.persist.rehydrate();
  }, []);

  return null;
}
