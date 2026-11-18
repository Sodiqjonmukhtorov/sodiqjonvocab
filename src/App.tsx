import {useCallback, useEffect, useMemo, useState} from 'react';
import {VOCABULARY_LIST} from './data/vocabulary';
import {
  SrsStorageState,
  applyFailure,
  applySuccess,
  computeStudyBuckets,
  createInitialProgress,
  getLocalDateKey,
  loadSrsState,
  saveSrsState,
} from './lib/srs';
import {StudyWorkspace} from './components/StudyWorkspace';
import {VocabularyListView} from './components/VocabularyListView';
import {AlgorithmView} from './components/AlgorithmView';

type ActiveTab = 'study' | 'vocabulary' | 'algorithm';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('study');
  const [srsState, setSrsState] = useState<SrsStorageState>(() => loadSrsState());
  const [now, setNow] = useState<number>(() => Date.now());

  // 1-second tick keeps 10-minute Stage 1 countdowns live and promotes due words automatically
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    saveSrsState(srsState);
  }, [srsState]);

  const buckets = useMemo(
    () => computeStudyBuckets(VOCABULARY_LIST, srsState.progressById, now),
    [srsState.progressById, now]
  );

  const todayKey = getLocalDateKey(now);
  const todayActivity = srsState.dailyActivity[todayKey];
  const todayReviewed = todayActivity?.reviewedCount ?? 0;

  const handleGradeWord = useCallback((wordId: string, remembered: boolean) => {
    const timestamp = Date.now();
    const dateKey = getLocalDateKey(timestamp);

    setSrsState((prev) => {
      const current = prev.progressById[wordId] ?? createInitialProgress(wordId);
      const updated = remembered
        ? applySuccess(current, timestamp)
        : applyFailure(current, timestamp);

      const prevDay = prev.dailyActivity[dateKey] ?? {
        dateKey,
        reviewedCount: 0,
        learnedCount: 0,
      };

      const incrementLearned = current.stage === 0 && remembered ? 1 : 0;

      return {
        progressById: {
          ...prev.progressById,
          [wordId]: updated,
        },
        dailyActivity: {
          ...prev.dailyActivity,
          [dateKey]: {
            dateKey,
            reviewedCount: prevDay.reviewedCount + 1,
            learnedCount: prevDay.learnedCount + incrementLearned,
          },
        },
      };
    });
    setNow(timestamp);
  }, []);

  const handleResetAllProgress = useCallback(() => {
    const freshProgress: SrsStorageState['progressById'] = {};
    for (const entry of VOCABULARY_LIST) {
      freshProgress[entry.id] = createInitialProgress(entry.id);
    }
    const next: SrsStorageState = {
      progressById: freshProgress,
      dailyActivity: {},
    };
    setSrsState(next);
    saveSrsState(next);
    setNow(Date.now());
  }, []);

  const totalPending = buckets.dueWords.length + buckets.newWords.length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Strict 3-Zone Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('study')}
            className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer text-left"
          >
            Sodiqjon Vocabulary
          </button>

          {/* Zone 2: Clean single-line Navigation Links */}
          <nav
            aria-label="Asosiy bo‘limlar"
            className="flex items-center gap-5 sm:gap-7 text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setActiveTab('study')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'study'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Takrorlash
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vocabulary')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'vocabulary'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Lug‘atlar
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('algorithm')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'algorithm'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Algoritm
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="hidden sm:flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'study' ? 'vocabulary' : 'study')}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer font-mono tabular-nums"
            >
              {activeTab === 'study'
                ? `Lug‘atlar (${VOCABULARY_LIST.length})`
                : `Takrorlash (${totalPending})`}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {activeTab === 'study' && (
          <StudyWorkspace
            now={now}
            buckets={buckets}
            progressById={srsState.progressById}
            todayReviewed={todayReviewed}
            onGradeWord={handleGradeWord}
          />
        )}

        {activeTab === 'vocabulary' && (
          <VocabularyListView now={now} progressById={srsState.progressById} />
        )}

        {activeTab === 'algorithm' && (
          <AlgorithmView
            progressById={srsState.progressById}
            onResetAllProgress={handleResetAllProgress}
          />
        )}
      </main>

      {/* Minimal Quiet Footer */}
      <footer className="border-t border-slate-200/80 bg-white/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Sodiqjon Vocabulary Memory</span>
          <span className="font-mono tabular-nums">
            {VOCABULARY_LIST[VOCABULARY_LIST.length - 1]?.dayNumber}-kun ·{' '}
            {VOCABULARY_LIST[VOCABULARY_LIST.length - 1]?.addedLabel} ·{' '}
            {VOCABULARY_LIST.length} ta so‘z
          </span>
        </div>
      </footer>
    </div>
  );
}
