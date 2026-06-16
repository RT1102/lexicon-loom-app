import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Brain, Upload, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lexica — Spaced Repetition Vocabulary Journal" },
      { name: "description", content: "Import words from PDF, Excel, CSV or text. Review on a smart schedule. Track your mastery over time." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" />
            <span className="font-serif text-xl font-semibold tracking-tight">Lexica</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Button asChild size="sm"><Link to="/auth">Start learning</Link></Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 text-center md:py-28">
          <p className="mb-4 inline-block rounded-full border border-border bg-paper px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            For students of every language
          </p>
          <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            A quiet place to <em className="text-primary not-italic">remember</em><br className="hidden md:block" /> every word you learn.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Lexica turns your vocabulary lists into a personal review schedule using the
            forgetting curve. Bring your own words — keep them forever.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth">Create your journal</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth">I already have an account</Link></Button>
          </div>
        </section>

        <section className="grid gap-6 pb-24 md:grid-cols-3">
          {[
            { icon: Upload, title: "Bring your words", body: "Import from PDF, Excel, CSV, or plain text. Or type them in by hand." },
            { icon: Brain, title: "Smart review schedule", body: "Built on the SM-2 spaced repetition algorithm — the same idea behind Anki." },
            { icon: BarChart3, title: "See your progress", body: "A dashboard for streaks, mastery, and daily reviews. Export anytime." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="paper-card p-6">
              <Icon className="mb-4 size-6 text-primary" />
              <h3 className="font-serif text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        Lexica · A vocabulary journal built for students
      </footer>
    </div>
  );
}
