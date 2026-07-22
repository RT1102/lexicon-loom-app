import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Brain, Upload, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

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
  const { t } = useLanguage();
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" />
            <span className="font-serif text-xl font-semibold tracking-tight">{t("app.name")}</span>
          </Link>
          <nav className="flex items-center gap-3">
            <LanguageSwitcher variant="compact" />
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">{t("landing.signIn")}</Link>
            <Button asChild size="sm"><Link to="/auth">{t("landing.startLearning")}</Link></Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 text-center md:py-28">
          <p className="mb-4 inline-block rounded-full border border-border bg-paper px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            {t("landing.eyebrow")}
          </p>
          <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            {t("landing.headline1")} <em className="text-primary not-italic">{t("landing.headlineEm")}</em><br className="hidden md:block" /> {t("landing.headline2")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            {t("landing.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth">{t("landing.ctaPrimary")}</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth">{t("landing.ctaSecondary")}</Link></Button>
          </div>
        </section>

        <section className="grid gap-6 pb-24 md:grid-cols-3">
          {[
            { icon: Upload, title: t("landing.feature1Title"), body: t("landing.feature1Body") },
            { icon: Brain, title: t("landing.feature2Title"), body: t("landing.feature2Body") },
            { icon: BarChart3, title: t("landing.feature3Title"), body: t("landing.feature3Body") },
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
        {t("landing.footer")}
      </footer>
    </div>
  );
}
