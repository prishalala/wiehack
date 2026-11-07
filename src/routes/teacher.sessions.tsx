import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy, Loader2, Play, Share2, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSession, setSessionStatus } from "@/api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/teacher/sessions")({
  head: () => ({
    meta: [
      { title: "Classroom Sessions — ClassBridge" },
      { name: "description", content: "Create a classroom session and share a join code with students." },
      { property: "og:title", content: "Classroom Sessions — ClassBridge" },
      { property: "og:description", content: "Create a classroom session and share a join code with students." },
    ],
  }),
  component: Sessions,
});

function Sessions() {
  const { session, students } = useAppState();
  const [form, setForm] = useState({ title: "", subject: "", notes: "" });
  const [errors, setErrors] = useState<Partial<Record<"title" | "subject" | "notes", string>>>({});
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const configured = isSupabaseConfigured();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<"title" | "subject" | "notes", string>> = {};
    if (form.title.trim().length < 3) errs.title = "Give the lesson a title (at least 3 characters).";
    if (!form.subject.trim()) errs.subject = "Add a subject.";
    if (form.notes.length > 4000) errs.notes = "Notes must be under 4000 characters.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!configured) {
      toast.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env first");
      return;
    }
    setBusy(true);
    try {
      const s = await createSession({ title: form.title.trim(), subject: form.subject.trim(), notes: form.notes.trim() });
      setForm({ title: "", subject: "", notes: "" });
      toast.success(`Session created · code ${s.joinCode}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create session");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!session.joinCode || session.joinCode === "------") return;
    await navigator.clipboard?.writeText(session.joinCode).catch(() => {});
    setCopied(true);
    toast.success("Join code copied");
    setTimeout(() => setCopied(false), 1500);
  }
  async function share() {
    const text = `Join my ClassBridge class "${session.title}" with code ${session.joinCode}`;
    if (navigator.share) await navigator.share({ text }).catch(() => {});
    else {
      await navigator.clipboard?.writeText(text).catch(() => {});
      toast.success("Invite message copied");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Classroom sessions</h1>
        <p className="text-muted-foreground">Create a session, share the code, and start when you're ready.</p>
      </div>
      {!configured && (
        <p className="rounded-lg border border-dashed bg-alert-soft/40 p-4 text-sm text-alert-foreground" role="status">
          Supabase is not configured. Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env</code> and add your project URL and anon key.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <form onSubmit={onSubmit} className="surface space-y-5 p-6" noValidate>
          <h2 className="font-semibold">New session</h2>
          <div className="space-y-2">
            <Label htmlFor="title">Lesson title</Label>
            <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Introduction to Fractions" aria-invalid={!!errors.title} />
            {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Mathematics · Grade 5" aria-invalid={!!errors.subject} />
            {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Lesson notes</Label>
            <Textarea id="notes" rows={6} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What students will read during the lesson…" />
            <p className="text-right text-xs text-muted-foreground">{form.notes.length}/4000</p>
            {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
          </div>
          <p className="text-xs text-muted-foreground">Notes are stored, then AI-translated into each student’s language when they join or switch languages.</p>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Create session</Button>
        </form>

        <div className="surface h-fit p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current session</p>
          <h2 className="mt-2 font-display text-xl font-semibold">{session.title}</h2>
          <p className="text-sm text-muted-foreground">{session.subject || "—"}</p>
          <div className="mt-5 rounded-xl bg-muted p-5 text-center">
            <p className="text-xs text-muted-foreground">Join code</p>
            <p className="mt-1 font-mono text-4xl font-semibold tracking-[0.25em]">{session.joinCode}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" size="sm" className="bg-card" onClick={copy} disabled={!session.id}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy</Button>
              <Button variant="outline" size="sm" className="bg-card" onClick={share} disabled={!session.id}><Share2 className="h-4 w-4" /> Share</Button>
            </div>
          </div>
          {session.notesLocalized && (
            <p className="mt-3 text-center text-xs text-success">
              Notes cached in {Object.keys(session.notesLocalized).length} language(s)
            </p>
          )}
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">{session.status === "live" ? <span className="live-dot" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}<span className="capitalize">{session.status === "draft" ? "Not started" : session.status}</span></span>
            <span className="text-muted-foreground">{students.length} joined</span>
          </div>
          <div className="mt-4 grid gap-2">
            {!session.id ? (
              <p className="text-sm text-muted-foreground">Create a session to get a join code.</p>
            ) : session.status !== "live" ? (
              <Button onClick={() => setSessionStatus("live").then(() => toast.success("Session is live")).catch((e) => toast.error(e.message))}><Play className="h-4 w-4" /> Start session</Button>
            ) : (
              <>
                <Button asChild><Link to="/teacher/live">Open live view</Link></Button>
                <Button variant="outline" onClick={() => setSessionStatus("ended").then(() => toast("Session ended")).catch((e) => toast.error(e.message))}><Square className="h-4 w-4" /> End session</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
