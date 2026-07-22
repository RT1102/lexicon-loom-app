// Forgetting-curve staged scheduler (Ebbinghaus-style).
// Six stages with fixed review intervals: 1, 2, 4, 7, 15, 30 days.
// We reuse the existing `repetitions` column as the stage counter (0..6),
// `interval_days` as the last applied interval, and `ease_factor` is unused
// but kept for backward compat with the existing schema.
//
// Grading:
//   0 Again → reset to stage 0 (next review tomorrow)
//   3 Hard  → repeat the same stage
//   4 Good  → advance by one stage
//   5 Easy  → advance by two stages

export const STAGE_INTERVALS = [1, 2, 4, 7, 15, 30] as const;
export const TOTAL_STAGES = STAGE_INTERVALS.length;

export interface Stage {
  index: number;            // 0 = New, 1..6 = learning stages, 7 = Mastered
  label: string;            // English fallback; UI should call useStageLabel()
  short: string;
  intervalLabel: string;
  className: string;
  swatch: string;
  labelKey: string;         // i18n key under `stage.*`
  intervalKey: string;      // i18n key under `stage.*`
  intervalDays?: number;    // used by `stage.intDays` interpolation
}

export const STAGES: Stage[] = [
  { index: 0, label: "New",              short: "New",      intervalLabel: "Not started",       className: "bg-stone-200 text-stone-800 border-stone-300",       swatch: "#a8a29e", labelKey: "stage.new",       intervalKey: "stage.intNotStarted" },
  { index: 1, label: "First Impression", short: "Stage 1",  intervalLabel: "Review in 1 day",   className: "bg-rose-100 text-rose-700 border-rose-200",         swatch: "#fb7185", labelKey: "stage.s1",        intervalKey: "stage.intOneDay" },
  { index: 2, label: "Fuzzy Memory",     short: "Stage 2",  intervalLabel: "Review in 2 days",  className: "bg-orange-100 text-orange-700 border-orange-200",   swatch: "#fb923c", labelKey: "stage.s2",        intervalKey: "stage.intDays", intervalDays: 2 },
  { index: 3, label: "Basic Mastery",    short: "Stage 3",  intervalLabel: "Review in 4 days",  className: "bg-amber-100 text-amber-800 border-amber-200",      swatch: "#fbbf24", labelKey: "stage.s3",        intervalKey: "stage.intDays", intervalDays: 4 },
  { index: 4, label: "Proficient",       short: "Stage 4",  intervalLabel: "Review in 7 days",  className: "bg-lime-100 text-lime-800 border-lime-200",         swatch: "#a3e635", labelKey: "stage.s4",        intervalKey: "stage.intDays", intervalDays: 7 },
  { index: 5, label: "Deep Memory",      short: "Stage 5",  intervalLabel: "Review in 15 days", className: "bg-emerald-100 text-emerald-800 border-emerald-200", swatch: "#34d399", labelKey: "stage.s5",        intervalKey: "stage.intDays", intervalDays: 15 },
  { index: 6, label: "Long-term Memory", short: "Stage 6",  intervalLabel: "Review in 30 days", className: "bg-teal-100 text-teal-800 border-teal-200",         swatch: "#2dd4bf", labelKey: "stage.s6",        intervalKey: "stage.intDays", intervalDays: 30 },
  { index: 7, label: "Mastered",         short: "Mastered", intervalLabel: "Complete",          className: "bg-indigo-100 text-indigo-800 border-indigo-200",   swatch: "#818cf8", labelKey: "stage.mastered",  intervalKey: "stage.intComplete" },
];

export function getStage(repetitions: number): Stage {
  const i = Math.max(0, Math.min(STAGES.length - 1, repetitions));
  return STAGES[i];
}

// Legacy export — kept so existing imports keep compiling.
export function masteryLevel(repetitions: number, _ease?: number): string {
  return getStage(repetitions).label;
}

export interface SchedulerState {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string;
  last_reviewed_at: string;
}

export function applySM2(
  prev: { ease_factor: number; interval_days: number; repetitions: number },
  quality: number,
  now: Date = new Date(),
): SchedulerState {
  let stage = prev.repetitions;

  if (quality < 3) {
    stage = 0;
  } else if (quality === 3) {
    // Hard — stay on the same stage, but at least move past "New".
    if (stage === 0) stage = 1;
  } else if (quality === 4) {
    stage += 1;
  } else {
    stage += 2;
  }
  if (stage < 0) stage = 0;
  if (stage > TOTAL_STAGES) stage = TOTAL_STAGES; // 7 = Mastered

  // Determine next interval. Mastered = no due date in the near future.
  const intervalDays =
    stage === 0
      ? 1
      : stage >= TOTAL_STAGES
        ? 365
        : STAGE_INTERVALS[stage - 1];

  const due = new Date(now);
  due.setDate(due.getDate() + intervalDays);

  return {
    ease_factor: prev.ease_factor, // unused, preserved
    interval_days: intervalDays,
    repetitions: stage,
    due_date: due.toISOString(),
    last_reviewed_at: now.toISOString(),
  };
}
