import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { applySM2, getStage } from "@/lib/sm2";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

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

  if (loading) return <div className="text-center text-muted-foreground">Loading review…</div>;

  if (!current) {
    return (
      <div className="paper-card mx-auto max-w-xl p-10 text-center">
        <CheckCircle2 className="mx-auto mb-4 size-12 text-success" />
        <h1 className="font-serif text-3xl font-semibold">All done for now</h1>
        <p className="mt-2 text-muted-foreground">
          {done > 0
            ? `You reviewed ${done} ${done === 1 ? "word" : "words"}. Come back when the next batch is due.`
            : "Nothing is due yet. Add more words or wait for the next review."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild><Link to="/dashboard">Back to dashboard</Link></Button>
          <Button asChild variant="outline"><Link to="/words">My words</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{idx + 1} / {queue.length} due</span>
        <span className={"inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium " + getStage(current.repetitions).className}>
          <span className="size-1.5 rounded-full" style={{ background: getStage(current.repetitions).swatch }} />
          {getStage(current.repetitions).label}
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
          <Button onClick={() => setReveal(true)} className="mt-10" size="lg">Show meaning</Button>
        ) : (
          <div className="mt-8 space-y-4 text-left">
            {current.definition && (
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Definition</div>
                <p className="mt-1 text-lg">{current.definition}</p>
              </div>
            )}
            {current.translation && (
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Translation</div>
                <p className="mt-1 text-lg">{current.translation}</p>
              </div>
            )}
            {current.example && (
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Example</div>
                <p className="mt-1 italic text-muted-foreground">"{current.example}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      {reveal && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <GradeButton onClick={() => grade(0)} variant="destructive" label="Again" sub="< 1 day" />
          <GradeButton onClick={() => grade(3)} variant="outline" label="Hard" sub="short" />
          <GradeButton onClick={() => grade(4)} variant="default" label="Good" sub="normal" />
          <GradeButton onClick={() => grade(5)} variant="secondary" label="Easy" sub="longer" />
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
