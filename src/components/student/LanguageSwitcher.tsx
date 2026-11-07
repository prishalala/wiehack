import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES } from "@/i18n";
import { useLanguage } from "@/context/LanguageContext";
import type { Lang } from "@/types";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLanguage } = useLanguage();
  return (
    <Select value={lang} onValueChange={(v) => setLanguage(v as Lang)}>
      <SelectTrigger className={`h-9 w-[200px] bg-card ${className ?? ""}`} aria-label="Interface language">
        <Languages className="h-4 w-4 shrink-0 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="max-h-72">
        {LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            {l.native}
            <span className="ml-1 text-xs text-muted-foreground">· {l.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
