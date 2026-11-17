import React, {useState} from 'react';
import {RotateCcw, Check} from 'lucide-react';
import {VOCABULARY_LIST} from '../data/vocabulary';
import {STAGE_META, SrsStage, WordProgress, createInitialProgress} from '../lib/srs';

interface AlgorithmViewProps {
  progressById: Record<string, WordProgress>;
  onResetAllProgress: () => void;
}

export const AlgorithmView: React.FC<AlgorithmViewProps> = ({
  progressById,
  onResetAllProgress,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  const stageCounts: Record<SrsStage, number> = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
  for (const entry of VOCABULARY_LIST) {
    const p = progressById[entry.id] ?? createInitialProgress(entry.id);
    stageCounts[p.stage] += 1;
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Spaced Repetition — 5 bosqichli takrorlash tizimi
        </h1>
        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
          Har bir yangi so‘z qisqa muddatli xotiradan uzoq muddatli xotiraga o‘tishi uchun quyidagi aniq jadval asosida avtomatik takrorlanadi.
        </p>
      </div>

      {/* 5-Stage Pipeline Cards */}
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-xs">
        {([1, 2, 3, 4, 5] as Exclude<SrsStage, 0>[]).map((stage) => {
          const meta = STAGE_META[stage];
          const count = stageCounts[stage];

          return (
            <div
              key={stage}
              className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums text-xs font-semibold text-slate-400">
                    0{stage}.
                  </span>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    {meta.title}
                  </h2>
                </div>
                <p className="text-sm text-slate-600 pl-7">{meta.description}</p>
              </div>

              <div className="pl-7 sm:pl-0 flex sm:flex-col items-baseline sm:items-end justify-between gap-1 shrink-0">
                <span className="font-mono tabular-nums text-lg font-bold text-slate-900">
                  {count} ta so‘z
                </span>
                <span className={`text-xs font-medium ${meta.accentText}`}>
                  Interval: {meta.intervalLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lapse & Permanence Rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-2">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Unutilgan so‘zlar qoidasi
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Agar takrorlash paytida so‘zni eslay olmasangiz («Esla olmadim»), u avtomatik ravishda{' '}
            <strong className="font-semibold text-slate-900">1-bosqichga (10 daqiqa)</strong>{' '}
            qaytariladi. Shu tariqa zaif so‘zlar darhol mustahkamlanadi.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-2">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Doimiy saqlash (5-bosqich)
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            7 kunlik bosqichdan muvaffaqiyatli o‘tgan so‘zlar bazadan butunlay yo‘qolib ketmaydi — ular{' '}
            <strong className="font-semibold text-slate-900">har 3 kunda</strong>{' '}
            qayta tekshirilib turiladi.
          </p>
        </div>
      </div>

      {/* Safe Progress Reset */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            O‘quv jarayonini noldan boshlash
          </h3>
          <p className="text-xs text-slate-500">
            Barcha so‘zlarni qayta «Yangi» holatiga o‘tkazadi. Lug‘atlar bazasi o‘chirilmaydi.
          </p>
        </div>

        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Progressni tiklash</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={() => {
                onResetAllProgress();
                setConfirmReset(false);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Ha, tiklash</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
