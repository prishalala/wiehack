import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/common";
import { LANGUAGES, setLang, useLang } from "@/i18n";
import { joinSession } from "@/api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Lang } from "@/types";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join a Class — ClassBridge" },
      { name: "description", content: "Enter your classroom code, your name and your language to join a ClassBridge lesson." },
      { property: "og:title", content: "Join a Class — ClassBridge" },
      { property: "og:description", content: "Enter your classroom code, your name and your language to join a ClassBridge lesson." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Join,
});

function Join() {
  const navigate = useNavigate();
  const current = useLang();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [lang, setL] = useState<Lang>(current);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.trim().length !== 6) return setError("The class code has 6 characters.");
    if (!name.trim()) return setError("Please enter the name you'd like to show.");
    if (!isSupabaseConfigured()) {
      setError("Classroom backend is not configured. Ask your teacher to set up Supabase.");
      return;
    }
    setBusy(true);
    try {
      setLang(lang);
      await joinSession({ code, name, language: lang });
      navigate({ to: "/classroom" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div className="dot-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <form onSubmit={onSubmit} className="surface space-y-6 p-7 shadow-lift" noValidate>
          <div className="text-center">
            <h1 className="font-display text-2xl font-semibold">Join your class</h1>
            <p className="mt-1 text-sm text-muted-foreground">No account needed. Ask your teacher for the code.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Class code</Label>
            <Input id="code" value={code} maxLength={6} autoComplete="off" autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="ABC123" className="h-14 text-center font-mono text-2xl tracking-[0.4em] uppercase" />
            <p className="text-xs text-muted-foreground">Ask your teacher for today’s 6-character code.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aarav" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lang">Language</Label>
            <Select value={lang} onValueChange={(v) => setL(v)}>
              <SelectTrigger id="lang" className="h-11">
                <SelectValue placeholder="Choose a language" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.native} <span className="text-muted-foreground">· {l.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Lesson notes and answers will be translated into this language by AI. You can change it anytime.</p>
          </div>
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Join classroom</Button>
        </form>
      </div>
    </div>
  );
}
