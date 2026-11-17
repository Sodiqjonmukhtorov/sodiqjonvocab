import {VOCABULARY_LIST, VocabEntry} from '../data/vocabulary';

export type SrsStage = 0 | 1 | 2 | 3 | 4 | 5;

export interface WordProgress {
  wordId: string;
  stage: SrsStage;
  nextReviewAt: number | null;
  lastReviewedAt: number | null;
  successCount: number;
  lapseCount: number;
}

export interface DailyActivity {
  dateKey: string; // YYYY-MM-DD
  reviewedCount: number;
  learnedCount: number;
}

export interface SrsStorageState {
  progressById: Record<string, WordProgress>;
  dailyActivity: Record<string, DailyActivity>;
}

export const STORAGE_KEY = 'sodiqjon_vocab_memory_srs_v1';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const STAGE_INTERVAL_MS: Record<Exclude<SrsStage, 0>, number> = {
  1: 10 * MINUTE_MS, // 1-bosqich — 10 daqiqa
  2: 24 * HOUR_MS, // 2-bosqich — 24 soat
  3: 3 * DAY_MS, // 3-bosqich — 3 kun
  4: 7 * DAY_MS, // 4-bosqich — 7 kun
  5: 3 * DAY_MS, // 5-bosqich — doimiy takrorlash (har 3 kunda)
};

export interface StageMetadata {
  stage: SrsStage;
  title: string;
  shortTitle: string;
  intervalLabel: string;
  description: string;
  accentText: string;
  barColor: string;
}

export const STAGE_META: Record<SrsStage, StageMetadata> = {
  0: {
    stage: 0,
    title: 'Yangi so‘zlar',
    shortTitle: 'Yangi',
    intervalLabel: 'Boshlang‘ich',
    description: 'Hali birinchi marta yodlanmagan so‘zlar.',
    accentText: 'text-slate-700',
    barColor: 'bg-slate-400',
  },
  1: {
    stage: 1,
    title: '1-bosqich — 10 daqiqa',
    shortTitle: '1-bosqich',
    intervalLabel: '10 daqiqa',
    description: 'Yangi so‘zlarni birinchi marta yodlagandan 10 daqiqa keyin qayta so‘raladi.',
    accentText: 'text-amber-700',
    barColor: 'bg-amber-500',
  },
  2: {
    stage: 2,
    title: '2-bosqich — 24 soat',
    shortTitle: '2-bosqich',
    intervalLabel: '24 soat',
    description: 'Birinchi bosqichdan muvaffaqiyatli o‘tgan so‘zlar ertasi kuni takrorlanadi.',
    accentText: 'text-sky-700',
    barColor: 'bg-sky-500',
  },
  3: {
    stage: 3,
    title: '3-bosqich — 3 kun',
    shortTitle: '3-bosqich',
    intervalLabel: '3 kun',
    description: 'Keyingi takrorlash 3 kundan keyin belgilanadi.',
    accentText: 'text-indigo-700',
    barColor: 'bg-indigo-500',
  },
  4: {
    stage: 4,
    title: '4-bosqich — 7 kun',
    shortTitle: '4-bosqich',
    intervalLabel: '7 kun',
    description: 'Keyingi takrorlash 7 kundan keyin bo‘ladi.',
    accentText: 'text-teal-700',
    barColor: 'bg-teal-500',
  },
  5: {
    stage: 5,
    title: '5-bosqich — Doimiy takrorlash',
    shortTitle: '5-bosqich',
    intervalLabel: 'Har 3 kunda',
    description: '7 kunlik bosqichdan o‘tgan so‘zlar har 3 kunda qayta tekshiriladi va hech qachon yo‘qolmaydi.',
    accentText: 'text-emerald-700',
    barColor: 'bg-emerald-600',
  },
};

export function createInitialProgress(wordId: string): WordProgress {
  return {
    wordId,
    stage: 0,
    nextReviewAt: null,
    lastReviewedAt: null,
    successCount: 0,
    lapseCount: 0,
  };
}

export function getLocalDateKey(timestamp: number = Date.now()): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function loadSrsState(): SrsStorageState {
  const base: SrsStorageState = {
    progressById: {},
    dailyActivity: {},
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SrsStorageState>;
      if (parsed.progressById && typeof parsed.progressById === 'object') {
        base.progressById = {...parsed.progressById};
      }
      if (parsed.dailyActivity && typeof parsed.dailyActivity === 'object') {
        base.dailyActivity = {...parsed.dailyActivity};
      }
    }
  } catch {
    // Fallback cleanly if storage is unavailable or corrupted
  }

  for (const entry of VOCABULARY_LIST) {
    if (!base.progressById[entry.id]) {
      base.progressById[entry.id] = createInitialProgress(entry.id);
    }
  }

  return base;
}

export function saveSrsState(state: SrsStorageState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
}

export function getNextStageOnSuccess(currentStage: SrsStage): Exclude<SrsStage, 0> {
  switch (currentStage) {
    case 0:
      return 1;
    case 1:
      return 2;
    case 2:
      return 3;
    case 3:
      return 4;
    case 4:
    case 5:
      return 5;
  }
}

export function applySuccess(progress: WordProgress, now: number = Date.now()): WordProgress {
  const nextStage = getNextStageOnSuccess(progress.stage);
  const intervalMs = STAGE_INTERVAL_MS[nextStage];
  return {
    ...progress,
    stage: nextStage,
    nextReviewAt: now + intervalMs,
    lastReviewedAt: now,
    successCount: progress.successCount + 1,
  };
}

export function applyFailure(progress: WordProgress, now: number = Date.now()): WordProgress {
  if (progress.stage === 0) {
    return {
      ...progress,
      lastReviewedAt: now,
      lapseCount: progress.lapseCount + 1,
    };
  }

  return {
    ...progress,
    stage: 1,
    nextReviewAt: now + STAGE_INTERVAL_MS[1],
    lastReviewedAt: now,
    lapseCount: progress.lapseCount + 1,
  };
}

export function isWordDue(progress: WordProgress, now: number = Date.now()): boolean {
  if (progress.stage === 0 || progress.nextReviewAt === null) {
    return false;
  }
  return now >= progress.nextReviewAt;
}

export function formatRemainingTime(targetMs: number, now: number = Date.now()): string {
  const diff = targetMs - now;
  if (diff <= 0) {
    return 'Hozir tayyor';
  }

  const totalSeconds = Math.ceil(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return hours > 0 ? `${days} kun ${hours} soat` : `${days} kun`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours} soat ${minutes} daq` : `${hours} soat`;
  }
  if (minutes > 0) {
    return `${minutes} daq ${String(seconds).padStart(2, '0')} son`;
  }
  return `${seconds} soniya`;
}

export function getNextIntervalDescription(currentStage: SrsStage): string {
  const nextStage = getNextStageOnSuccess(currentStage);
  if (nextStage === 5 && currentStage === 5) {
    return '3 kun (doimiy)';
  }
  return STAGE_META[nextStage].intervalLabel;
}

export interface StudyBuckets {
  dueWords: VocabEntry[];
  newWords: VocabEntry[];
  scheduledWords: Array<{entry: VocabEntry; progress: WordProgress}>;
}

export function computeStudyBuckets(
  entries: VocabEntry[],
  progressById: Record<string, WordProgress>,
  now: number = Date.now()
): StudyBuckets {
  const dueWords: VocabEntry[] = [];
  const newWords: VocabEntry[] = [];
  const scheduledWords: Array<{entry: VocabEntry; progress: WordProgress}> = [];

  for (const entry of entries) {
    const progress = progressById[entry.id] ?? createInitialProgress(entry.id);
    if (progress.stage === 0) {
      newWords.push(entry);
    } else if (isWordDue(progress, now)) {
      dueWords.push(entry);
    } else {
      scheduledWords.push({entry, progress});
    }
  }

  dueWords.sort((a, b) => {
    const pa = progressById[a.id];
    const pb = progressById[b.id];
    return (pa?.nextReviewAt ?? 0) - (pb?.nextReviewAt ?? 0);
  });

  scheduledWords.sort((a, b) => {
    return (a.progress.nextReviewAt ?? Infinity) - (b.progress.nextReviewAt ?? Infinity);
  });

  return {dueWords, newWords, scheduledWords};
}

export function speakEnglishWord(word: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis errors
  }
}
