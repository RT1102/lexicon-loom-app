import { Languages } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { LANGUAGES, type Language } from "@/i18n/translations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  variant?: "default" | "compact";
  className?: string;
}

export function LanguageSwitcher({ variant = "default", className }: Props) {
  const { language, setLanguage, t } = useLanguage();
  const compact = variant === "compact";

  return (
    <div className={"flex items-center gap-2 " + (className ?? "")}>
      {!compact && <Languages className="size-4 text-muted-foreground" aria-hidden />}
      <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
        <SelectTrigger
          aria-label={t("langSwitcher.label")}
          className={compact ? "h-8 w-[130px] text-sm" : "h-9 w-[150px] text-sm"}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((l) => (
            <SelectItem key={l.code} value={l.code}>
              {l.nativeLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
