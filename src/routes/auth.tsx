import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — Lexica" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) nav({ to: "/dashboard" });
    });
  }, [nav]);

  async function signIn(email: string, password: string) {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    nav({ to: "/dashboard" });
  }

  async function signUp(email: string, password: string, displayName: string) {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { display_name: displayName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("auth.accountCreated"));
    nav({ to: "/dashboard" });
  }


  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" />
            <span className="font-serif text-xl font-semibold">{t("app.name")}</span>
          </Link>
          <LanguageSwitcher variant="compact" />
        </div>

        <div className="paper-card p-8">
          <Tabs defaultValue="signin">
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t("auth.signInTab")}</TabsTrigger>
              <TabsTrigger value="signup">{t("auth.createTab")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <SignInForm onSubmit={signIn} loading={loading} />
            </TabsContent>
            <TabsContent value="signup">
              <SignUpForm onSubmit={signUp} loading={loading} />
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t("auth.emailHint")}
          </p>
        </div>
      </div>
    </div>
  );
}

function SignInForm({ onSubmit, loading }: { onSubmit: (e: string, p: string) => void; loading: boolean }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(email, password); }} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="si-email">{t("auth.email")}</Label>
        <Input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="si-pw">{t("auth.password")}</Label>
        <Input id="si-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>{t("auth.signInBtn")}</Button>
    </form>
  );
}

function SignUpForm({ onSubmit, loading }: { onSubmit: (e: string, p: string, n: string) => void; loading: boolean }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(email, password, name); }} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="su-name">{t("auth.yourName")}</Label>
        <Input id="su-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-email">{t("auth.email")}</Label>
        <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-pw">{t("auth.password")}</Label>
        <Input id="su-pw" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>{t("auth.createBtn")}</Button>
    </form>
  );
}
