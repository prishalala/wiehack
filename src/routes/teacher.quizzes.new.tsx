import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PdfUploadField } from "@/components/teacher/PdfUploadField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createQuiz, listClasses } from "@/services/teacherPortalData";
import type { AssessmentQuestion, SchoolClass } from "@/types/teacherPortal";

export const Route = createFileRoute("/teacher/quizzes/new")({
  head: () => ({ meta: [{ title: "Create quiz — ClassBridge" }] }),
  component: CreateQuiz,
});

function emptyMc(): AssessmentQuestion {
  return {
    id: crypto.randomUUID(),
    type: "multiple_choice",
    prompt: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    marks: 1,
    topic: "",
  };
}

function emptySa(): AssessmentQuestion {
  return { id: crypto.randomUUID(), type: "short_answer", prompt: "", marks: 2, topic: "" };
}

function CreateQuiz() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [kind, setKind] = useState<"quiz" | "test">("quiz");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("");
  const [classId, setClassId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([emptyMc()]);
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listClasses().then((c) => {
      setClasses(c);
      if (c[0]) setClassId(c[0].id);
    });
  }, []);

  async function publish() {
    if (!title.trim() || !topic.trim() || questions.some((q) => !q.prompt.trim())) {
      toast.error("Fill title, topic, and every question prompt.");
      return;
    }
    if (!classId) {
      toast.error("Create a class first.");
      return;
    }
    setBusy(true);
    try {
      await createQuiz({
        classId,
        kind,
        title: title.trim(),
        subject: subject.trim(),
        topic: topic.trim(),
        status: "published",
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
        questions,
        pdf,
      });
      toast.success("Assessment published");
      void navigate({ to: "/teacher/quizzes" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save assessment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Create {kind}</h1>
        <p className="mt-1 text-sm text-muted-foreground">MC items include answer keys for auto-grading. Optional PDF worksheet supported.</p>
      </div>
      {classes.length === 0 && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          No classes yet.{" "}
          <Link to="/teacher/classes" className="font-medium text-primary hover:underline">
            Create a class
          </Link>{" "}
          first.
        </p>
      )}
      <div className="surface space-y-4 p-6">
        <div className="flex gap-2">
          {(["quiz", "test"] as const).map((k) => (
            <Button key={k} type="button" size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)} className="capitalize" disabled={busy}>
              {k}
            </Button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy} />
          </div>
          <div className="space-y-1.5">
            <Label>Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} disabled={busy} />
          </div>
          <div className="space-y-1.5">
            <Label>Class</Label>
            <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)} disabled={busy || !classes.length}>
              {!classes.length && <option value="">No classes</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Due / available until</Label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} disabled={busy} />
          </div>
        </div>
        <PdfUploadField label="Assessment PDF (optional)" file={pdf} onChange={setPdf} disabled={busy} />
      </div>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="surface space-y-3 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Question {i + 1} · <span className="capitalize text-muted-foreground">{q.type.replace("_", " ")}</span>
              </p>
              <Button type="button" size="icon" variant="ghost" onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))} aria-label="Remove question" disabled={busy}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input placeholder="Prompt" value={q.prompt} onChange={(e) => setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, prompt: e.target.value } : x)))} disabled={busy} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Topic tag" value={q.topic ?? ""} onChange={(e) => setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, topic: e.target.value } : x)))} disabled={busy} />
              <Input type="number" min={1} value={q.marks} onChange={(e) => setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, marks: Number(e.target.value) || 1 } : x)))} disabled={busy} />
            </div>
            {q.type === "multiple_choice" && (
              <div className="space-y-2">
                {(q.options ?? []).map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={q.correctIndex === oi}
                      onChange={() => setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, correctIndex: oi } : x)))}
                      aria-label={`Mark option ${oi + 1} correct`}
                      disabled={busy}
                    />
                    <Input
                      value={opt}
                      placeholder={`Option ${oi + 1}`}
                      disabled={busy}
                      onChange={(e) =>
                        setQuestions((qs) =>
                          qs.map((x) => {
                            if (x.id !== q.id) return x;
                            const options = [...(x.options ?? [])];
                            options[oi] = e.target.value;
                            return { ...x, options };
                          }),
                        )
                      }
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Selected radio = correct answer for auto-grading.</p>
              </div>
            )}
            {q.type === "short_answer" && <p className="text-xs text-muted-foreground">Short answers require teacher review.</p>}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setQuestions((q) => [...q, emptyMc()])} disabled={busy}>
            <Plus className="h-4 w-4" /> Multiple choice
          </Button>
          <Button type="button" variant="outline" onClick={() => setQuestions((q) => [...q, emptySa()])} disabled={busy}>
            <Plus className="h-4 w-4" /> Short answer
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={() => void publish()} disabled={busy}>
          Publish
        </Button>
        <Button asChild type="button" variant="ghost">
          <Link to="/teacher/quizzes">Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
