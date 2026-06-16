// SM-2 spaced repetition algorithm
// quality: 0=Again, 3=Hard, 4=Good, 5=Easy
export interface SM2State {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string; // ISO
  last_reviewed_at: string;
}

export function applySM2(
  prev: { ease_factor: number; interval_days: number; repetitions: number },
  quality: number,
  now: Date = new Date(),
): SM2State {
  let { ease_factor, interval_days, repetitions } = prev;

  if (quality < 3) {
    repetitions = 0;
    interval_days = 1;
  } else {
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease_factor);
    repetitions += 1;
  }

  ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease_factor < 1.3) ease_factor = 1.3;

  const due = new Date(now);
  due.setDate(due.getDate() + interval_days);

  return {
    ease_factor: Math.round(ease_factor * 100) / 100,
    interval_days,
    repetitions,
    due_date: due.toISOString(),
    last_reviewed_at: now.toISOString(),
  };
}

export function masteryLevel(repetitions: number, ease: number): string {
  if (repetitions === 0) return "New";
  if (repetitions < 3) return "Learning";
  if (repetitions < 6) return "Familiar";
  if (ease >= 2.5) return "Mastered";
  return "Reviewing";
}
