import { createFileRoute, Outlet, Link, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, LayoutDashboard, ListTree, Upload, Brain, Download, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [displayName, setDisplayName] = useState<string>("");
  const { t } = useLanguage();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle();
      setDisplayName(p?.display_name || data.user.email?.split("@")[0] || "");
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  const links = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/review", label: t("nav.review"), icon: Brain },
    { to: "/words", label: t("nav.words"), icon: ListTree },
    { to: "/import", label: t("nav.import"), icon: Upload },
    { to: "/export", label: t("nav.export"), icon: Download },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-paper/60 p-4 md:flex md:flex-col">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <BookOpen className="size-5 text-primary" />
          <span className="font-serif text-xl font-semibold">{t("app.name")}</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {links.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <Link key={to} to={to} className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}>
                <Icon className="size-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-border/60 pt-4 space-y-3">
          <div>
            <p className="px-2 text-xs text-muted-foreground">{t("nav.signedInAs")}</p>
            <p className="truncate px-2 text-sm font-medium">{displayName}</p>
          </div>
          <div className="px-2">
            <LanguageSwitcher variant="compact" className="w-full [&>button]:w-full" />
          </div>
          <Button onClick={signOut} variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
            <LogOut className="size-4" /> {t("nav.signOut")}
          </Button>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-border/60 bg-paper/50 px-4 py-3 md:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" />
            <span className="font-serif text-lg font-semibold">{t("app.name")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="compact" />
            <Button onClick={signOut} variant="ghost" size="sm" aria-label={t("nav.signOut")}><LogOut className="size-4" /></Button>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border/60 bg-paper/30 px-2 py-2 md:hidden">
          {links.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link key={to} to={to} className={cn(
                "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}>
                <Icon className="size-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <main className="mx-auto max-w-6xl p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
