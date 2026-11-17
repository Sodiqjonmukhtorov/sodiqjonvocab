import React, {useMemo, useState} from 'react';
import {Search, Volume2} from 'lucide-react';
import {VOCABULARY_LIST, VocabEntry} from '../data/vocabulary';
import {
  STAGE_META,
  SrsStage,
  WordProgress,
  createInitialProgress,
  formatRemainingTime,
  isWordDue,
  speakEnglishWord,
} from '../lib/srs';

interface VocabularyListViewProps {
  now: number;
  progressById: Record<string, WordProgress>;
}

export const VocabularyListView: React.FC<VocabularyListViewProps> = ({
  now,
  progressById,
}) => {
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | SrsStage>('all');

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return VOCABULARY_LIST.filter((entry) => {
      const prog = progressById[entry.id] ?? createInitialProgress(entry.id);
      if (stageFilter !== 'all' && prog.stage !== stageFilter) {
        return false;
      }
      if (!q) return true;
      return (
        entry.word.toLowerCase().includes(q) ||
        entry.translation.toLowerCase().includes(q)
      );
    });
  }, [query, stageFilter, progressById]);

  // Group by dayNumber & addedLabel so future code-added days appear cleanly in sections
  const groupedByDay = useMemo(() => {
    const map = new Map<
      number,
      {dayNumber: number; addedLabel: string; entries: VocabEntry[]}
    >();
    for (const entry of filteredEntries) {
      const existing = map.get(entry.dayNumber);
      if (existing) {
        existing.entries.push(entry);
      } else {
        map.set(entry.dayNumber, {
          dayNumber: entry.dayNumber,
          addedLabel: entry.addedLabel,
          entries: [entry],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.dayNumber - a.dayNumber);
  }, [filteredEntries]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Lug‘atlar ro‘yxati
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Barcha so‘zlar kod ichidagi bazadan yuklanadi · Jami{' '}
            <span className="font-mono tabular-nums">{VOCABULARY_LIST.length}</span> ta so‘z
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="So‘z yoki tarjima qidirish..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Stage Filter Segmented Control */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-fit">
        <button
          type="button"
          onClick={() => setStageFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            stageFilter === 'all'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Barchasi
        </button>
        {([0, 1, 2, 3, 4, 5] as SrsStage[]).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStageFilter(st)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              stageFilter === st
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {STAGE_META[st].shortTitle}
          </button>
        ))}
      </div>

      {/* Grouped Word Lists */}
      {groupedByDay.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
          Qidiruv bo‘yicha hech qanday so‘z topilmadi.
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByDay.map((group) => (
            <section
              key={group.dayNumber}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/60">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-display font-semibold text-slate-900">
                    {group.dayNumber}-kun
                  </span>
                  <span aria-hidden="true" className="text-slate-400">
                    ·
                  </span>
                  <span className="text-slate-600">{group.addedLabel}</span>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {group.entries.length} ta so‘z
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-500">
                      <th className="py-3 pl-6 pr-3 font-medium w-12">#</th>
                      <th className="py-3 px-3 font-medium">English</th>
                      <th className="py-3 px-3 font-medium">O‘zbekcha</th>
                      <th className="py-3 px-3 font-medium">Bosqich</th>
                      <th className="py-3 pl-3 pr-6 font-medium text-right">
                        Keyingi takrorlash
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {group.entries.map((entry, idx) => {
                      const prog =
                        progressById[entry.id] ?? createInitialProgress(entry.id);
                      const due = isWordDue(prog, now);
                      const meta = STAGE_META[prog.stage];

                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3.5 pl-6 pr-3 font-mono tabular-nums text-xs text-slate-400">
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => speakEnglishWord(entry.word)}
                                aria-label={`${entry.word} talaffuzi`}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer shrink-0"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-semibold text-slate-900">
                                {entry.word}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-slate-700">
                            {entry.translation}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className={`text-xs font-medium ${meta.accentText}`}>
                              {meta.shortTitle}
                            </span>
                          </td>
                          <td className="py-3.5 pl-3 pr-6 text-right font-mono tabular-nums text-xs">
                            {prog.stage === 0 ? (
                              <span className="text-slate-400">Yodlanmagan</span>
                            ) : due ? (
                              <span className="font-semibold text-amber-700">
                                Vaqti keldi
                              </span>
                            ) : prog.nextReviewAt ? (
                              <span className="text-slate-600">
                                {formatRemainingTime(prog.nextReviewAt, now)}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
