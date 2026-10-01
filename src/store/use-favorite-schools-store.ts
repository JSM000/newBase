'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 즐겨찾기(관심 학교) — 순수 로컬 저장, 서버 전송 없음 (계획: _refs/즐겨찾기_구현계획/01_저장방식.md).
 *
 * `use-user-settings-store`와 별도 스토어로 분리한 이유: 그 스토어는 `savedAt` 기준
 * 20일 자동 만료가 걸려있는데(개인정보 성격), 즐겨찾기는 자동으로 사라지면 기능 자체가
 * 무의미해서 만료 없이 보존한다.
 */

interface FavoriteSchoolsStore {
  /** schulCode 목록. 추가한 순서를 유지(최신 추가가 배열 끝) */
  favoriteCodes: string[];
  isFavorite: (schulCode: string) => boolean;
  toggleFavorite: (schulCode: string) => void;
  clearFavorites: () => void;
}

export const useFavoriteSchoolsStore = create<FavoriteSchoolsStore>()(
  persist(
    (set, get) => ({
      favoriteCodes: [],
      isFavorite: (schulCode) => get().favoriteCodes.includes(schulCode),
      toggleFavorite: (schulCode) => {
        const { favoriteCodes } = get();
        set({
          favoriteCodes: favoriteCodes.includes(schulCode)
            ? favoriteCodes.filter((c) => c !== schulCode)
            : [...favoriteCodes, schulCode],
        });
      },
      clearFavorites: () => set({ favoriteCodes: [] }),
    }),
    {
      name: 'newbase-favorite-schools',
      // SSR와 첫 클라이언트 렌더가 항상 빈 배열로 일치하도록 자동 하이드레이션을 끄고,
      // 마운트 후(SettingsExpiryCheck) 명시적으로 rehydrate() 한다 — use-user-settings-store와 동일 패턴.
      skipHydration: true,
    },
  ),
);
