'use client';

import { create } from 'zustand';
import { ParsedFile, UserInputs, CalculationResult } from '@/types/score';
import { calculateScore } from '@/lib/score-calculator';
import {
  TransferEligibilityInputs,
  defaultEligibilityInputs,
} from '@/lib/transfer-eligibility';

export type TabType =
  | 'eligibility'
  | 'score'
  | 'career'
  | 'awards'
  | 'research'
  | 'training'
  | 'supplementary';

const defaultInputs: UserInputs = {
  teacherType: 'elementary',
  schoolZone: 'none',
  preferentialBonus: 'none',
  preferentialBonusMonths: 0,
  headTeacherSchoolZone: 'urban',
  sportsAwards: [],
  specialRoleType: 'none',
  specialRoleMonths: 0,
};

interface ScoreStore {
  step: 'upload' | 'result';
  parsed: ParsedFile | null;
  inputs: UserInputs;
  result: CalculationResult | null;
  activeTab: TabType;
  eligibilityInputs: TransferEligibilityInputs;
  /** 이번 결과가 업로드 직후가 아니라 저장된 로컬 설정에서 자동으로 불러온 것인지 */
  loadedFromSaved: boolean;

  setStep: (step: 'upload' | 'result') => void;
  setParsed: (parsed: ParsedFile | null) => void;
  updateInput: <K extends keyof UserInputs>(key: K, value: UserInputs[K]) => void;
  setResult: (result: CalculationResult | null) => void;
  setActiveTab: (tab: TabType) => void;
  recalculate: () => void;
  updateEligibilityInput: <K extends keyof TransferEligibilityInputs>(
    key: K,
    value: TransferEligibilityInputs[K],
  ) => void;
  setLoadedFromSaved: (v: boolean) => void;
  reset: () => void;
}

export const useScoreStore = create<ScoreStore>((set, get) => ({
  step: 'upload',
  parsed: null,
  inputs: defaultInputs,
  result: null,
  activeTab: 'eligibility',
  eligibilityInputs: defaultEligibilityInputs,
  loadedFromSaved: false,

  setStep: (step) => set({ step }),
  setParsed: (parsed) => set({ parsed }),
  updateInput: (key, value) =>
    set((state) => ({ inputs: { ...state.inputs, [key]: value } })),
  setResult: (result) => set({ result }),
  setActiveTab: (activeTab) => set({ activeTab }),
  recalculate: () => {
    const { parsed, inputs } = get();
    if (parsed) set({ result: calculateScore(parsed, inputs) });
  },
  updateEligibilityInput: (key, value) =>
    set((state) => ({
      eligibilityInputs: { ...state.eligibilityInputs, [key]: value },
    })),
  setLoadedFromSaved: (loadedFromSaved) => set({ loadedFromSaved }),
  reset: () =>
    set({
      step: 'upload',
      parsed: null,
      result: null,
      activeTab: 'eligibility',
      eligibilityInputs: defaultEligibilityInputs,
      inputs: defaultInputs,
      loadedFromSaved: false,
    }),
}));
