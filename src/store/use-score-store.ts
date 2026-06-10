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
};

interface ScoreStore {
  step: 'upload' | 'result';
  parsed: ParsedFile | null;
  inputs: UserInputs;
  result: CalculationResult | null;
  activeTab: TabType;
  eligibilityInputs: TransferEligibilityInputs;

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
  reset: () => void;
}

export const useScoreStore = create<ScoreStore>((set, get) => ({
  step: 'upload',
  parsed: null,
  inputs: defaultInputs,
  result: null,
  activeTab: 'eligibility',
  eligibilityInputs: defaultEligibilityInputs,

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
  reset: () =>
    set({
      step: 'upload',
      parsed: null,
      result: null,
      activeTab: 'eligibility',
      eligibilityInputs: defaultEligibilityInputs,
    }),
}));
