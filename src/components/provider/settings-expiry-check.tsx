'use client';

import { useEffect } from 'react';
import { useUserSettingsStore } from '@/store/use-user-settings-store';

/**
 * 앱 진입 시 1회 — localStorage에서 설정을 명시적으로 rehydrate(persist middleware의
 * skipHydration: true와 짝) 하고, 보관 기한(RETENTION_DAYS)이 지났으면 전체 삭제한다.
 */
export function SettingsExpiryCheck() {
  useEffect(() => {
    useUserSettingsStore.persist.rehydrate();
    useUserSettingsStore.getState().checkExpiry();
  }, []);

  return null;
}
