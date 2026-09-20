'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserSettings, SavedParsedFile } from '@/types/user-settings';
import { isExpired } from '@/lib/settings-retention';

const defaultSettings: UserSettings = {
  currentSigungu: null,
  transferPreference: null,
  desiredSigungu: null,
  homeCoords: null,
  schoolLevel: null,
  savedParsedFile: null,
  savedAt: null,
};

interface UserSettingsStore extends UserSettings {
  setCurrentSigungu: (v: string | null) => void;
  setTransferPreference: (v: UserSettings['transferPreference']) => void;
  setDesiredSigungu: (v: string | null) => void;
  setHomeCoords: (v: UserSettings['homeCoords']) => void;
  setSchoolLevel: (v: UserSettings['schoolLevel']) => void;
  saveParsedFile: (v: SavedParsedFile['data']) => void;
  clearParsedFile: () => void;
  reset: () => void;
  /** savedAt이 RETENTION_DAYS를 넘겼으면 전체 초기화. 각 페이지 진입 시 1회 호출. */
  checkExpiry: () => void;
}

export const useUserSettingsStore = create<UserSettingsStore>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      setCurrentSigungu: (currentSigungu) =>
        set({ currentSigungu, savedAt: new Date().toISOString() }),
      setTransferPreference: (transferPreference) =>
        set({ transferPreference, savedAt: new Date().toISOString() }),
      setDesiredSigungu: (desiredSigungu) =>
        set({ desiredSigungu, savedAt: new Date().toISOString() }),
      setHomeCoords: (homeCoords) =>
        set({ homeCoords, savedAt: new Date().toISOString() }),
      setSchoolLevel: (schoolLevel) =>
        set({ schoolLevel, savedAt: new Date().toISOString() }),
      saveParsedFile: (data) =>
        set({
          savedParsedFile: { data, savedAt: new Date().toISOString() },
          savedAt: new Date().toISOString(),
        }),
      clearParsedFile: () => set({ savedParsedFile: null }),
      reset: () => set({ ...defaultSettings }),
      checkExpiry: () => {
        const { savedAt } = get();
        if (savedAt && isExpired(savedAt)) set({ ...defaultSettings });
      },
    }),
    {
      name: 'newbase-user-settings',
      // SSR와 첫 클라이언트 렌더가 항상 기본값으로 일치하도록 자동 하이드레이션을 끄고,
      // 마운트 후(SettingsExpiryCheck) 명시적으로 rehydrate() 한다 — 안 그러면 클라이언트
      // 모듈 로드 시점에 동기적으로 localStorage를 읽어와 SSR 결과와 달라질 수 있다.
      skipHydration: true,
    },
  ),
);
