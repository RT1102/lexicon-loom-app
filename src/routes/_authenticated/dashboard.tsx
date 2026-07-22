import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2, Clock, TrendingUp, Flame } from "lucide-react";
import { getStage, STAGES } from "@/lib/sm2";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Lexica" }] }),
  component: Dashboard,
});

interface Word {
  id: string; word: string; ease_factor: number; repetitions: number;
  due_date: string; review_count: number; correct_count: number; last_reviewed_at: string | null;
}
interface ReviewLog { quality: number; reviewed_at: string; }

function Dashboard() {
  const { t, language } = useLanguage();
  const [words, setWords] = useState<Word[]>([]);
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [w, l] = await Promise.all([
        supabase.from("words").select("id, word, ease_factor, repetitions, due_date, review_count, correct_count, last_reviewed_at"),
        supabase.from("review_logs").select("quality, reviewed_at").gte("reviewed_at", new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);
      setWords((w.data as Word[]) || []);
      setLogs((l.data as ReviewLog[]) || []);
      setLoading(false);
    })();
  }, []);

  const now = new Date();
  const dueToday = words.filter((w) => new Date(w.due_date) <= now).length;
  const totalWords = words.length;
  const mastered = words.filter((w) => w.repetitions >= 7).length;
  const totalReviews = words.reduce((s, w) => s + w.review_count, 0);
  const accuracy = totalReviews > 0 ? Math.round(100 * words.reduce((s, w) => s + w.correct_count, 0) / totalReviews) : 0;

  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const reviewDays = new Set(logs.map((l) => dayKey(new Date(l.reviewed_at))));
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (reviewDays.has(dayKey(d))) streak++; else if (i > 0) break;
  }

  const locale = language === "zh" ? "zh-CN" : undefined;
  const chartData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const key = dayKey(d);
    const count = logs.filter((l) => dayKey(new Date(l.reviewed_at)) === key).length;
    return { day: d.toLocaleDateString(locale, { month: "short", day: "numeric" }), reviews: count };
  });

  // Bucket by stage index so labels stay stable across locales.
  const buckets: Record<number, number> = {};
  for (const s of STAGES) buckets[s.index] = 0;
  for (const w of words) buckets[getStage(w.repetitions).index]++;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <Button asChild size="lg"><Link to="/review">{t("dashboard.startReview")} · {dueToday}</Link></Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat icon={BookOpen} label={t("dashboard.totalWords")} value={totalWords} />
        <Stat icon={Clock} label={t("dashboard.dueNow")} value={dueToday} accent />
        <Stat icon={CheckCircle2} label={t("dashboard.mastered")} value={mastered} />
        <Stat icon={TrendingUp} label={t("dashboard.accuracy")} value={accuracy + "%"} />
        <Stat icon={Flame} label={t("dashboard.dayStreak")} value={streak} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="paper-card p-6 lg:col-span-2">
          <h2 className="font-serif text-xl font-semibold">{t("dashboard.reviewsLast14")}</h2>
          {loading ? <Skeleton /> : (
            <div className="mt-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Bar dataKey="reviews" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="paper-card p-6">
          <h2 className="font-serif text-xl font-semibold">{t("dashboard.memoryStages")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.stagesHint")}</p>
          <div className="mt-5 space-y-3">
            {STAGES.map((s) => {
              const n = buckets[s.index] || 0;
              const pct = totalWords ? (n / totalWords) * 100 : 0;
              return (
                <div key={s.index}>
                  <div className="flex justify-between text-sm">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: s.swatch }} />
                      {t(s.labelKey)}
                    </span>
                    <span className="text-muted-foreground">{n}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full" style={{ width: pct + "%", background: s.swatch }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {totalWords === 0 && !loading && (
        <div className="paper-card p-10 text-center">
          <h3 className="font-serif text-2xl font-semibold">{t("dashboard.emptyTitle")}</h3>
          <p className="mt-2 text-muted-foreground">{t("dashboard.emptyBody")}</p>
          <div className="mt-5 flex justify-center gap-3">
            <Button asChild><Link to="/words">{t("dashboard.addWord")}</Link></Button>
            <Button asChild variant="outline"><Link to="/import">{t("dashboard.importFile")}</Link></Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={"paper-card p-4 " + (accent ? "ring-1 ring-primary/30" : "")}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-2 font-serif text-3xl font-semibold">{value}</div>
    </div>
  );
}

function Skeleton() { return <div className="mt-6 h-64 animate-pulse rounded bg-muted" />; }
