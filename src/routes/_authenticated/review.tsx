import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { applySM2, getStage } from "@/lib/sm2";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({ meta: [{ title: "Review — Lexica" }] }),
  component: ReviewPage,
});

interface Word {
  id: string; word: string; definition: string | null; translation: string | null;
  part_of_speech: string | null; example: string | null;
  ease_factor: number; interval_days: number; repetitions: number;
  due_date: string; review_count: number; correct_count: number;
}

function ReviewPage() {
  const { t } = useLanguage();
  const [queue, setQueue] = useState<Word[]>([]);
  const [idx, setIdx] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [done, setDone] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("words").select("*")
        .lte("due_date", new Date().toISOString())
        .order("due_date", { ascending: true })
        .limit(50);
      setQueue((data as Word[]) || []);
      setLoading(false);
    })();
  }, []);

  const current = queue[idx];

  async function grade(quality: number) {
    if (!current) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const next = applySM2(current, quality);
    const correct = quality >= 3 ? 1 : 0;
    const { error } = await supabase.from("words").update({
      ease_factor: next.ease_factor,
      interval_days: next.interval_days,
      repetitions: next.repetitions,
      due_date: next.due_date,
      last_reviewed_at: next.last_reviewed_at,
      review_count: current.review_count + 1,
      correct_count: current.correct_count + correct,
    }).eq("id", current.id);
    if (error) return toast.error(error.message);
    await supabase.from("review_logs").insert({ user_id: u.user.id, word_id: current.id, quality });
    setReveal(false);
    setDone(done + 1);
    setIdx(idx + 1);
  }

  if (loading) return <div className="text-center text-muted-foreground">{t("review.loading")}</div>;

  if (!current) {
    return (
      <div className="paper-card mx-auto max-w-xl p-10 text-center">
        <CheckCircle2 className="mx-auto mb-4 size-12 text-success" />
        <h1 className="font-serif text-3xl font-semibold">{t("review.allDoneTitle")}</h1>
        <p className="mt-2 text-muted-foreground">
          {done > 0
            ? (done === 1 ? t("review.reviewedOne") : t("review.reviewedN", { n: done }))
            : t("review.nothingDue")}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild><Link to="/dashboard">{t("review.backDashboard")}</Link></Button>
          <Button asChild variant="outline"><Link to="/words">{t("review.myWords")}</Link></Button>
        </div>
      </div>
    );
  }

  const stage = getStage(current.repetitions);
  const stageLabel = t(stage.labelKey);
  const intervalLabel = stage.intervalDays != null
    ? t(stage.intervalKey, { n: stage.intervalDays })
    : t(stage.intervalKey);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{t("review.dueProgress", { i: idx + 1, n: queue.length })}</span>
        <span
          className={"inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium " + stage.className}
          title={intervalLabel}
        >
          <span className="size-1.5 rounded-full" style={{ background: stage.swatch }} />
          {stageLabel}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${(idx / queue.length) * 100}%` }} />
      </div>

      <div className="paper-card p-10 text-center">
        {current.part_of_speech && (
          <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground italic">{current.part_of_speech}</div>
        )}
        <h2 className="font-serif text-5xl font-semibold tracking-tight">{current.word}</h2>

        {!reveal ? (
          <Button onClick={() => setReveal(true)} className="mt-10" size="lg">{t("review.showMeaning")}</Button>
        ) : (
          <div className="mt-8 space-y-4 text-left">
            {current.definition && (
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("review.definition")}</div>
                <p className="mt-1 text-lg">{current.definition}</p>
              </div>
            )}
            {current.example && (
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("review.example")}</div>
                <p className="mt-1 italic text-muted-foreground">"{current.example}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      {reveal && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <GradeButton onClick={() => grade(0)} variant="destructive" label={t("review.gradeAgain")} sub={t("review.subLtDay")} />
          <GradeButton onClick={() => grade(3)} variant="outline" label={t("review.gradeHard")} sub={t("review.subShort")} />
          <GradeButton onClick={() => grade(4)} variant="default" label={t("review.gradeGood")} sub={t("review.subNormal")} />
          <GradeButton onClick={() => grade(5)} variant="secondary" label={t("review.gradeEasy")} sub={t("review.subLonger")} />
        </div>
      )}
    </div>
  );
}

function GradeButton({ onClick, label, sub, variant }: { onClick: () => void; label: string; sub: string; variant: any }) {
  return (
    <Button onClick={onClick} variant={variant} size="lg" className="flex h-auto flex-col gap-0.5 py-4">
      <span className="font-semibold">{label}</span>
      <span className="text-xs opacity-70">{sub}</span>
    </Button>
  );
}
