import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { joinLiveLesson } from "@/api";
import { useLanguage } from "@/context/LanguageContext";
import { t } from "@/i18n";

/** One-click join for an enrolled student — replaces the old join-by-code screen. */
export function JoinLiveButton({ sessionId }: { sessionId: string }) {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      className="bg-success text-primary-foreground hover:bg-success/90"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await joinLiveLesson({ sessionId, language: lang });
          void navigate({ to: "/classroom" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : t(lang, "error"));
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Radio className="h-4 w-4" aria-hidden />}
      {busy ? t(lang, "joining") : t(lang, "liveJoinCta")}
    </Button>
  );
}
