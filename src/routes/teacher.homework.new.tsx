import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PdfUploadField } from "@/components/teacher/PdfUploadField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createHomework, listClasses } from "@/services/teacherPortalData";
import type { SchoolClass } from "@/types/teacherPortal";

export const Route = createFileRoute("/teacher/homework/new")({
  head: () => ({ meta: [{ title: "Create homework — ClassBridge" }] }),
  component: CreateHomework,
});

function CreateHomework() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [classId, setClassId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [totalMarks, setTotalMarks] = useState("20");
  const [tasks, setTasks] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listClasses().then((c) => {
      setClasses(c);
      if (c[0]) setClassId(c[0].id);
    });
  }, []);

  function validate() {
    const next: Record<string, string> = {};
    if (!title.trim()) next["title"] = "Title is required.";
    if (!topic.trim()) next["topic"] = "Topic is required.";
    if (!classId) next["classId"] = "Create a class first, then select it.";
    if (!dueAt) next["dueAt"] = "Due date is required.";
    if (!Number(totalMarks) || Number(totalMarks) <= 0) next["totalMarks"] = "Enter total marks.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(status: "draft" | "published") {
    if (!validate()) return;
    setBusy(true);
    try {
      const taskLines = tasks
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const hw = await createHomework({
        classId,
        title,
        subject,
        topic,
        description,
        instructions,
        dueAt,
        totalMarks: Number(totalMarks),
        status,
        tasks: taskLines.map((prompt, i) => ({
          id: `t${i + 1}`,
          prompt,
          marks: Math.max(1, Math.round(Number(totalMarks) / Math.max(1, taskLines.length))),
        })),
        pdf,
      });
      toast.success(status === "draft" ? "Draft saved" : "Homework published");
      void navigate({ to: "/teacher/homework/$id", params: { id: hw.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save homework");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Create homework</h1>
        <p className="mt-1 text-sm text-muted-foreground">Published homework appears for enrolled students (and their parents once graded and released).</p>
      </div>
      {classes.length === 0 && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          No classes yet.{" "}
          <Link to="/teacher/classes" className="font-medium text-primary hover:underline">
            Create a class
          </Link>{" "}
          before assigning homework.
        </p>
      )}
      <div className="surface space-y-4 p-6">
        <Field label="Homework title" {...(errors["title"] ? { error: errors["title"] } : {})}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy} />
          </Field>
          <Field label="Topic" {...(errors["topic"] ? { error: errors["topic"] } : {})}>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} disabled={busy} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={busy} />
        </Field>
        <Field label="Instructions">
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} disabled={busy} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Class" {...(errors["classId"] ? { error: errors["classId"] } : {})}>
            <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)} disabled={busy || !classes.length}>
              {!classes.length && <option value="">No classes</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date" {...(errors["dueAt"] ? { error: errors["dueAt"] } : {})}>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} disabled={busy} />
          </Field>
        </div>
        <Field label="Total marks" {...(errors["totalMarks"] ? { error: errors["totalMarks"] } : {})}>
          <Input type="number" min={1} value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} disabled={busy} />
        </Field>
        <Field label="Questions / tasks (one per line)">
          <Textarea value={tasks} onChange={(e) => setTasks(e.target.value)} rows={5} placeholder="Task 1&#10;Task 2" disabled={busy} />
        </Field>
        <PdfUploadField label="Homework PDF (optional)" file={pdf} onChange={setPdf} disabled={busy} />
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void save("draft")}>
            Save draft
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save("published")}>
            Publish
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link to="/teacher/homework">Cancel</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
