import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Play, Square, Users } from "lucide-react";
import { toast } from "sonner";
import { PdfAttachmentLink } from "@/components/teacher/PdfAttachmentLink";
import { PdfUploadField } from "@/components/teacher/PdfUploadField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSession, setSessionStatus } from "@/api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAppState } from "@/lib/store";
import { getSessionLessonPlan, listClasses, setSessionLessonPlan } from "@/services/teacherPortalData";
import type { SchoolClass } from "@/types/teacherPortal";

export const Route = createFileRoute("/teacher/sessions")({
  head: () => ({
    meta: [
      { title: "Classroom Sessions — ClassBridge" },
      { name: "description", content: "Start a live lesson for one of your courses." },
      { property: "og:title", content: "Classroom Sessions — ClassBridge" },
      { property: "og:description", content: "Start a live lesson for one of your courses." },
    ],
  }),
  component: Sessions,
});

function Sessions() {
  const { session, students } = useAppState();
  const [form, setForm] = useState({ title: "", subject: "", notes: "" });
  const [courses, setCourses] = useState<SchoolClass[]>([]);
  const [courseId, setCourseId] = useState("");
  const [lessonPdf, setLessonPdf] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<"title" | "subject" | "notes", string>>>({});
  const [busy, setBusy] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [lessonPlan, setLessonPlan] = useState<{ lessonPlanFileId: string; lessonPlanName: string } | null>(null);
  const [attachPdf, setAttachPdf] = useState<File | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    listClasses()
      .then((c) => {
        setCourses(c);
        setCourseId((prev) => prev || c[0]?.id || "");
      })
      .catch((e: Error) => toast.error(e.message));
  }, []);

  const course = courses.find((c) => c.id === courseId);
  const sessionCourse = courses.find((c) => c.id === session.courseId);

  useEffect(() => {
    if (!session.id) {
      setLessonPlan(null);
      return;
    }
    void getSessionLessonPlan(session.id).then(setLessonPlan);
  }, [session.id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<"title" | "subject" | "notes", string>> = {};
    if (form.title.trim().length < 3) errs.title = "Give the lesson a title (at least 3 characters).";
    if (!courseId) errs.subject = "Choose the course this lesson is for.";
    if (form.notes.length > 4000) errs.notes = "Notes must be under 4000 characters.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!configured) {
      toast.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env first");
      return;
    }
    setBusy(true);
    try {
      const s = await createSession({ courseId, title: form.title.trim(), subject: course?.subject ?? "", notes: form.notes.trim() });
      if (lessonPdf) {
        const saved = await setSessionLessonPlan(s.id, lessonPdf);
        setLessonPlan({ lessonPlanFileId: saved.fileId, lessonPlanName: saved.name });
      }
      setForm({ title: "", subject: "", notes: "" });
      setLessonPdf(null);
      toast.success(`Lesson created for ${course?.name ?? "your course"}. Start it when you're ready.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create session");
    } finally {
      setBusy(false);
    }
  }

  async function attachToCurrent() {
    if (!session.id || !attachPdf) return;
    setAttaching(true);
    try {
      const saved = await setSessionLessonPlan(session.id, attachPdf);
      setLessonPlan({ lessonPlanFileId: saved.fileId, lessonPlanName: saved.name });
      setAttachPdf(null);
      toast.success("Lesson plan PDF saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save PDF");
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Classroom sessions</h1>
        <p className="text-muted-foreground">Create a lesson for a course and start it. Enrolled students see a "Join live lesson" button on that course.</p>
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
            <Label htmlFor="course">Course</Label>
            <select
              id="course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              aria-invalid={!!errors.subject}
            >
              {courses.length === 0 && <option value="">No courses assigned</option>}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
            {course && <p className="text-xs text-muted-foreground">{course.studentIds.length} enrolled student(s) will be able to join.</p>}
            {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Lesson notes</Label>
            <Textarea id="notes" rows={6} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What students will read during the lesson…" />
            <p className="text-right text-xs text-muted-foreground">{form.notes.length}/4000</p>
            {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
          </div>
          <PdfUploadField label="Lesson plan PDF (optional)" hint="Upload a PDF lesson plan with this session." file={lessonPdf} onChange={setLessonPdf} disabled={busy} />
          <p className="text-xs text-muted-foreground">Notes are stored, then AI-translated into each student’s language when they join or switch languages.</p>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Create session</Button>
        </form>

        <div className="surface h-fit p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current session</p>
          <h2 className="mt-2 font-display text-xl font-semibold">{session.title}</h2>
          <p className="text-sm text-muted-foreground">{sessionCourse ? `${sessionCourse.name} (${sessionCourse.code})` : session.subject || "—"}</p>
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-muted p-4 text-sm">
            <Users className="h-5 w-5 shrink-0 text-primary" />
            <span>{sessionCourse ? `Students enrolled in ${sessionCourse.name} join from their course page once you start.` : "Students join from their course page once you start."}</span>
          </div>
          {session.notesLocalized && (
            <p className="mt-3 text-center text-xs text-success">
              Notes cached in {Object.keys(session.notesLocalized).length} language(s)
            </p>
          )}
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lesson plan PDF</p>
            {lessonPlan ? (
              <PdfAttachmentLink fileId={lessonPlan.lessonPlanFileId} fileName={lessonPlan.lessonPlanName} />
            ) : (
              <p className="text-xs text-muted-foreground">No PDF attached yet.</p>
            )}
            {session.id && (
              <div className="space-y-2">
                <PdfUploadField label="Attach / replace PDF" file={attachPdf} onChange={setAttachPdf} disabled={attaching} />
                <Button type="button" size="sm" variant="outline" disabled={!attachPdf || attaching} onClick={() => void attachToCurrent()}>
                  {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save lesson plan PDF
                </Button>
              </div>
            )}
          </div>
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">{session.status === "live" ? <span className="live-dot" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}<span className="capitalize">{session.status === "draft" ? "Not started" : session.status}</span></span>
            <span className="text-muted-foreground">{students.length} joined</span>
          </div>
          <div className="mt-4 grid gap-2">
            {!session.id ? (
              <p className="text-sm text-muted-foreground">Create a lesson for one of your courses first.</p>
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
