import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Check,
  Clock,
  Eye,
  RotateCcw,
  Volume2,
  X,
  ArrowRight,
  Layers,
} from 'lucide-react';
import {VOCABULARY_LIST, VocabEntry} from '../data/vocabulary';
import {
  STAGE_META,
  SrsStage,
  StudyBuckets,
  WordProgress,
  createInitialProgress,
  formatRemainingTime,
  getNextIntervalDescription,
  speakEnglishWord,
} from '../lib/srs';

type StudyMode = 'flashcard' | 'quiz';
type Direction = 'en-uz' | 'uz-en';
type QueueFilter = 'all-due' | 'due-only' | 'practice';

interface StudyWorkspaceProps {
  now: number;
  buckets: StudyBuckets;
  progressById: Record<string, WordProgress>;
  todayReviewed: number;
  onGradeWord: (wordId: string, remembered: boolean) => void;
}

const POS_LABELS: Record<VocabEntry['partOfSpeech'], string> = {
  verb: "fe'l",
  noun: 'ot',
  adjective: 'sifat',
  adverb: 'ravish',
};

function buildQuizOptions(
  target: VocabEntry,
  allEntries: VocabEntry[],
  direction: Direction
): VocabEntry[] {
  const others = allEntries.filter((item) => item.id !== target.id);
  // Deterministic-feeling shuffle seeded slightly by word id + current target
  const pool = [...others].sort((a, b) => {
    const hashA = (a.word.charCodeAt(0) * 31 + a.word.length * 17) % 97;
    const hashB = (b.word.charCodeAt(0) * 31 + b.word.length * 17) % 97;
    return hashA - hashB;
  });

  // Prefer same part of speech for better distractors
  const samePos = pool.filter((item) => item.partOfSpeech === target.partOfSpeech);
  const diffPos = pool.filter((item) => item.partOfSpeech !== target.partOfSpeech);
  const distractors = [...samePos, ...diffPos].slice(0, 3);

  const combined = [target, ...distractors];
  // Shuffle combined based on target id + direction so position varies cleanly
  const seed = target.word.length + (direction === 'en-uz' ? 3 : 7);
  return combined.sort((a, b) => {
    const ka = (a.word.charCodeAt(0) + seed * 13) % 29;
    const kb = (b.word.charCodeAt(0) + seed * 13) % 29;
    return ka - kb;
  });
}

export const StudyWorkspace: React.FC<StudyWorkspaceProps> = ({
  now,
  buckets,
  progressById,
  todayReviewed,
  onGradeWord,
}) => {
  const [mode, setMode] = useState<StudyMode>('flashcard');
  const [direction, setDirection] = useState<Direction>('en-uz');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all-due');

  const [revealed, setRevealed] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [deferredNewIds, setDeferredNewIds] = useState<string[]>([]);

  // Active queue computation
  const activeQueue = useMemo(() => {
    if (queueFilter === 'practice') {
      return VOCABULARY_LIST;
    }
    if (queueFilter === 'due-only') {
      return buckets.dueWords;
    }
    // 'all-due': Due words come FIRST (priority), then New words (with deferred new words pushed to end)
    const deferredSet = new Set(deferredNewIds);
    const primaryNew = buckets.newWords.filter((w) => !deferredSet.has(w.id));
    const deferredNew = buckets.newWords.filter((w) => deferredSet.has(w.id));
    return [...buckets.dueWords, ...primaryNew, ...deferredNew];
  }, [queueFilter, buckets.dueWords, buckets.newWords, deferredNewIds]);

  const currentEntry: VocabEntry | undefined = useMemo(() => {
    if (activeQueue.length === 0) return undefined;
    if (queueFilter === 'practice') {
      return activeQueue[practiceIndex % activeQueue.length];
    }
    return activeQueue[0];
  }, [activeQueue, queueFilter, practiceIndex]);

  const currentProgress: WordProgress | undefined = currentEntry
    ? progressById[currentEntry.id] ?? createInitialProgress(currentEntry.id)
    : undefined;

  const quizOptions = useMemo(() => {
    if (!currentEntry || mode !== 'quiz') return [];
    return buildQuizOptions(currentEntry, VOCABULARY_LIST, direction);
  }, [currentEntry, mode, direction]);

  // Reset reveal/selection when current word or mode changes
  useEffect(() => {
    setRevealed(false);
    setSelectedQuizId(null);
  }, [currentEntry?.id, mode, direction, queueFilter]);

  const handleFlashcardDecision = useCallback(
    (remembered: boolean) => {
      if (!currentEntry) return;

      if (queueFilter === 'practice') {
        setRevealed(false);
        setPracticeIndex((prev) => (prev + 1) % VOCABULARY_LIST.length);
        return;
      }

      const prog = progressById[currentEntry.id] ?? createInitialProgress(currentEntry.id);
      if (!remembered && prog.stage === 0) {
        // Defer new word to the back of the new-word queue so learner retries it shortly
        setDeferredNewIds((prev) => [
          ...prev.filter((id) => id !== currentEntry.id),
          currentEntry.id,
        ]);
      } else {
        setDeferredNewIds((prev) => prev.filter((id) => id !== currentEntry.id));
      }

      onGradeWord(currentEntry.id, remembered);
      setRevealed(false);
    },
    [currentEntry, queueFilter, progressById, onGradeWord]
  );

  const handleQuizSelect = useCallback(
    (chosenId: string) => {
      if (!currentEntry || selectedQuizId !== null) return;
      setSelectedQuizId(chosenId);
    },
    [currentEntry, selectedQuizId]
  );

  const handleQuizNext = useCallback(() => {
    if (!currentEntry || selectedQuizId === null) return;
    const isCorrect = selectedQuizId === currentEntry.id;

    if (queueFilter === 'practice') {
      setSelectedQuizId(null);
      setPracticeIndex((prev) => (prev + 1) % VOCABULARY_LIST.length);
      return;
    }

    const prog = progressById[currentEntry.id] ?? createInitialProgress(currentEntry.id);
    if (!isCorrect && prog.stage === 0) {
      setDeferredNewIds((prev) => [
        ...prev.filter((id) => id !== currentEntry.id),
        currentEntry.id,
      ]);
    } else {
      setDeferredNewIds((prev) => prev.filter((id) => id !== currentEntry.id));
    }

    onGradeWord(currentEntry.id, isCorrect);
    setSelectedQuizId(null);
  }, [currentEntry, selectedQuizId, queueFilter, progressById, onGradeWord]);

  // Keyboard shortcuts for crisp study speed
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (!currentEntry) return;

      if (mode === 'flashcard') {
        if ((e.code === 'Space' || e.code === 'Enter') && !revealed) {
          e.preventDefault();
          setRevealed(true);
        } else if (revealed) {
          if (e.key === '1') {
            e.preventDefault();
            handleFlashcardDecision(false);
          } else if (e.key === '2') {
            e.preventDefault();
            handleFlashcardDecision(true);
          }
        }
      } else if (mode === 'quiz') {
        if (selectedQuizId === null) {
          const idx = ['1', '2', '3', '4'].indexOf(e.key);
          if (idx !== -1 && quizOptions[idx]) {
            e.preventDefault();
            handleQuizSelect(quizOptions[idx].id);
          }
        } else if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          handleQuizNext();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    currentEntry,
    mode,
    revealed,
    selectedQuizId,
    quizOptions,
    handleFlashcardDecision,
    handleQuizSelect,
    handleQuizNext,
  ]);

  // Stage counts for right deck
  const stageCounts = useMemo(() => {
    const counts: Record<SrsStage, number> = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    for (const entry of VOCABULARY_LIST) {
      const p = progressById[entry.id] ?? createInitialProgress(entry.id);
      counts[p.stage] += 1;
    }
    return counts;
  }, [progressById]);

  const totalWords = VOCABULARY_LIST.length;
  const nextScheduled = buckets.scheduledWords[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)] gap-8 items-start">
      {/* LEFT / PRIMARY STAGE */}
      <section className="space-y-5">
        {/* Session Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Queue selector */}
          <div
            role="tablist"
            aria-label="Navbat turi"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80"
          >
            <button
              type="button"
              onClick={() => setQueueFilter('all-due')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                queueFilter === 'all-due'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Navbatdagilar ({buckets.dueWords.length + buckets.newWords.length})
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter('due-only')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                queueFilter === 'due-only'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Takrorlash ({buckets.dueWords.length})
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter('practice')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                queueFilter === 'practice'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Erkin mashq ({totalWords})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode switch */}
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => setMode('flashcard')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === 'flashcard'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kartochka
              </button>
              <button
                type="button"
                onClick={() => setMode('quiz')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === 'quiz'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Test
              </button>
            </div>

            {/* Direction switch */}
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => setDirection('en-uz')}
                className={`px-2.5 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  direction === 'en-uz'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN → UZ
              </button>
              <button
                type="button"
                onClick={() => setDirection('uz-en')}
                className={`px-2.5 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  direction === 'uz-en'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                UZ → EN
              </button>
            </div>
          </div>
        </div>

        {/* MAIN FOCUS CARD */}
        {currentEntry && currentProgress ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-xs">
            {/* Unboxed Metadata Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-6 border-b border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>{currentEntry.dayNumber}-kun</span>
                <span aria-hidden="true">·</span>
                <span>{currentEntry.addedLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{POS_LABELS[currentEntry.partOfSpeech]}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`font-medium ${STAGE_META[currentProgress.stage].accentText}`}>
                  {STAGE_META[currentProgress.stage].title}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-500">
                  {queueFilter === 'practice'
                    ? `${(practiceIndex % activeQueue.length) + 1} / ${activeQueue.length}`
                    : `${activeQueue.length} ta qoldi`}
                </span>
              </div>
            </div>

            {queueFilter === 'practice' && (
              <div className="mt-4 text-xs text-sky-700 font-medium">
                Erkin mashq rejimi — takrorlash taymerlari o‘zgarmaydi
              </div>
            )}

            {/* Prompt Area */}
            <div className="py-10 sm:py-12 text-center space-y-4">
              {direction === 'en-uz' ? (
                <div className="flex items-center justify-center gap-3">
                  <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
                    {currentEntry.word}
                  </h2>
                  <button
                    type="button"
                    onClick={() => speakEnglishWord(currentEntry.word)}
                    aria-label={`${currentEntry.word} talaffuzini eshitish`}
                    title="Talaffuzni eshitish"
                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 text-slate-600 hover:text-sky-700 hover:border-sky-300 hover:bg-sky-50/60 transition-colors cursor-pointer shrink-0"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance max-w-xl mx-auto">
                  {currentEntry.translation}
                </h2>
              )}

              {/* FLASHCARD MODE CONTENT */}
              {mode === 'flashcard' && (
                <div className="pt-4">
                  {!revealed ? (
                    <div className="pt-4 flex flex-col items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setRevealed(true)}
                        className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>
                          {direction === 'en-uz' ? 'Tarjimasini ko‘rish' : 'Inglizchasini ko‘rish'}
                        </span>
                      </button>
                      <span className="text-xs text-slate-400 font-mono">
                        Klaviatura: Space
                      </span>
                    </div>
                  ) : (
                    <div className="pt-5 border-t border-slate-100 max-w-lg mx-auto space-y-8 transition-opacity duration-150">
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-400">
                          {direction === 'en-uz' ? 'O‘zbekcha ma’nosi' : 'Inglizcha so‘z'}
                        </p>
                        {direction === 'en-uz' ? (
                          <p className="text-2xl sm:text-3xl font-semibold text-sky-900">
                            {currentEntry.translation}
                          </p>
                        ) : (
                          <div className="flex items-center justify-center gap-3">
                            <p className="font-display text-3xl sm:text-4xl font-bold text-sky-900">
                              {currentEntry.word}
                            </p>
                            <button
                              type="button"
                              onClick={() => speakEnglishWord(currentEntry.word)}
                              aria-label={`${currentEntry.word} talaffuzini eshitish`}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:text-sky-700 hover:border-sky-300 transition-colors cursor-pointer"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Recall Grading Buttons */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => handleFlashcardDecision(false)}
                          className="flex flex-col items-center justify-center gap-1 px-5 py-3.5 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100/80 transition-colors cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-2 text-sm font-semibold">
                            <RotateCcw className="w-4 h-4" />
                            <span>Esla olmadim</span>
                          </span>
                          <span className="text-xs text-amber-700 font-mono tabular-nums">
                            {queueFilter === 'practice'
                              ? 'Keyingi so‘z · [1]'
                              : currentProgress.stage === 0
                              ? 'Keyinroq qayta so‘raladi · [1]'
                              : '1-bosqich: 10 daqiqa · [1]'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleFlashcardDecision(true)}
                          className="flex flex-col items-center justify-center gap-1 px-5 py-3.5 rounded-xl border border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-2 text-sm font-semibold">
                            <Check className="w-4 h-4" />
                            <span>
                              {currentProgress.stage === 0 ? 'Yodladim' : 'Esla oldim'}
                            </span>
                          </span>
                          <span className="text-xs text-emerald-100 font-mono tabular-nums">
                            {queueFilter === 'practice'
                              ? 'Keyingi so‘z · [2]'
                              : `Keyingi: ${getNextIntervalDescription(currentProgress.stage)} · [2]`}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* QUIZ MODE CONTENT */}
              {mode === 'quiz' && (
                <div className="pt-6 max-w-xl mx-auto space-y-5 text-left">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quizOptions.map((option, idx) => {
                      const isAnswered = selectedQuizId !== null;
                      const isCorrectOption = option.id === currentEntry.id;
                      const isChosen = option.id === selectedQuizId;

                      let btnStyle =
                        'border-slate-200 bg-white text-slate-800 hover:border-sky-300 hover:bg-sky-50/40';
                      if (isAnswered) {
                        if (isCorrectOption) {
                          btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950';
                        } else if (isChosen && !isCorrectOption) {
                          btnStyle = 'border-rose-400 bg-rose-50 text-rose-950';
                        } else {
                          btnStyle = 'border-slate-200 bg-slate-50/60 text-slate-400';
                        }
                      }

                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={isAnswered}
                          onClick={() => handleQuizSelect(option.id)}
                          className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium transition-colors cursor-pointer disabled:cursor-default ${btnStyle}`}
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-xs text-slate-400 shrink-0 tabular-nums">
                              {idx + 1}.
                            </span>
                            <span className="truncate">
                              {direction === 'en-uz' ? option.translation : option.word}
                            </span>
                          </span>
                          {isAnswered && isCorrectOption && (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          {isAnswered && isChosen && !isCorrectOption && (
                            <X className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedQuizId !== null && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                      <div className="text-sm font-medium">
                        {selectedQuizId === currentEntry.id ? (
                          <span className="inline-flex items-center gap-2 text-emerald-700">
                            <Check className="w-4 h-4" />
                            <span>
                              To‘g‘ri!{' '}
                              {queueFilter === 'practice'
                                ? ''
                                : `(${getNextIntervalDescription(currentProgress.stage)}ga belgilandi)`}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-rose-700">
                            <X className="w-4 h-4" />
                            <span>
                              Noto‘g‘ri — to‘g‘ri javob:{' '}
                              <strong className="font-semibold">
                                {direction === 'en-uz'
                                  ? currentEntry.translation
                                  : currentEntry.word}
                              </strong>
                            </span>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleQuizNext}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <span>Keyingi so‘z</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ALL CAUGHT UP / WAITING STATE */
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center shadow-xs space-y-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 mx-auto">
              <Check className="w-6 h-6" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h2 className="font-display text-2xl font-bold text-slate-900">
                {queueFilter === 'due-only'
                  ? 'Hozircha vaqti kelgan takrorlash yo‘q'
                  : 'Navbatdagi barcha so‘zlar yakunlandi'}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {buckets.newWords.length > 0 && queueFilter === 'due-only'
                  ? `Sizda hali ${buckets.newWords.length} ta yangi so‘z bor. "Navbatdagilar" bo‘limiga o‘tib ularni yodlashingiz mumkin.`
                  : 'Spaced Repetition taymerlari ishlayapti. Keyingi bosqich vaqti kelganda so‘zlar avtomatik ravishda shu yerda paydo bo‘ladi.'}
              </p>
            </div>

            {nextScheduled && nextScheduled.progress.nextReviewAt && (
              <div className="inline-flex flex-col items-center gap-1 px-6 py-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500">
                  Keyingi takrorlash ({nextScheduled.entry.word} ·{' '}
                  {STAGE_META[nextScheduled.progress.stage].shortTitle})
                </span>
                <span className="font-mono tabular-nums text-2xl font-semibold text-sky-700">
                  {formatRemainingTime(nextScheduled.progress.nextReviewAt, now)}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {queueFilter === 'due-only' && buckets.newWords.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQueueFilter('all-due')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <span>Yangi so‘zlarni boshlash ({buckets.newWords.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setPracticeIndex(0);
                  setQueueFilter('practice');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>Erkin mashq qilish</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* RIGHT / PROGRESS & SCHEDULE DECK */}
      <aside className="space-y-6">
        {/* Today Summary Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Bugungi holat
            </h3>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Jami {totalWords} ta so‘z
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs text-slate-500">Vaqti kelgan</div>
              <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-amber-700">
                {buckets.dueWords.length}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs text-slate-500">Yangi</div>
              <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-sky-700">
                {buckets.newWords.length}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs text-slate-500">Bugun</div>
              <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-emerald-700">
                {todayReviewed}
              </div>
            </div>
          </div>
        </div>

        {/* 5-Stage Distribution Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="font-display text-base font-semibold text-slate-900">
            5 bosqichli xotira xaritasi
          </h3>

          <div className="space-y-3">
            {([0, 1, 2, 3, 4, 5] as SrsStage[]).map((stage) => {
              const meta = STAGE_META[stage];
              const count = stageCounts[stage];
              const pct = totalWords > 0 ? Math.round((count / totalWords) * 100) : 0;

              return (
                <div key={stage} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {stage === 0 ? 'Yangi' : `${stage}-bosqich · ${meta.intervalLabel}`}
                    </span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {count} / {totalWords}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${meta.barColor}`}
                      style={{width: `${pct}%`}}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Scheduled Reviews */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Yaqinlashayotgan takrorlashlar
            </h3>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>

          {buckets.scheduledWords.length === 0 ? (
            <p className="text-xs text-slate-500 leading-relaxed">
              Hozircha rejalashtirilgan takrorlash yo‘q. Yangi so‘zlarni yodlaganingizda 10 daqiqalik taymer ishga tushadi.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {buckets.scheduledWords.slice(0, 6).map(({entry, progress}) => (
                <li
                  key={entry.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{entry.word}</div>
                    <div className="text-xs text-slate-500">
                      {STAGE_META[progress.stage].shortTitle}
                    </div>
                  </div>
                  <span className="font-mono tabular-nums text-xs font-medium text-sky-700 shrink-0">
                    {progress.nextReviewAt
                      ? formatRemainingTime(progress.nextReviewAt, now)
                      : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
};
