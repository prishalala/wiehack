import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PdfAttachmentLink } from "@/components/teacher/PdfAttachmentLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteHomework, getHomework, listHomeworkSubmissions, saveHomeworkGrade } from "@/services/teacherPortalData";
import type { HomeworkAssignment, HomeworkSubmission } from "@/types/teacherPortal";

export const Route = createFileRoute("/teacher/homework/$id")({
  head: () => ({ meta: [{ title: "Homework detail — ClassBridge" }] }),
  component: HomeworkDetail,
});

function HomeworkDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<HomeworkAssignment | null>(null);
  const [subs, setSubs] = useState<HomeworkSubmission[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { marks: string; feedback: string }>>({});

  useEffect(() => {
    void getHomework(id).then(setAssignment);
    void listHomeworkSubmissions(id).then((rows) => {
      setSubs(rows);
      const d: Record<string, { marks: string; feedback: string }> = {};
      for (const s of rows) {
        d[s.id] = { marks: s.marks != null ? String(s.marks) : "", feedback: s.feedback ?? "" };
      }
      setDrafts(d);
    });
  }, [id]);

  if (!assignment) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground">Assignment not found.</p>
        <Button asChild variant="outline">
          <Link to="/teacher/homework">Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {assignment.subject} · {assignment.topic}
          </p>
          <h1 className="font-display text-3xl font-semibold">{assignment.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{assignment.description}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void deleteHomework(id).then(() => {
              toast.success("Assignment deleted");
              void navigate({ to: "/teacher/homework" });
            });
          }}
        >
          Delete
        </Button>
      </div>

      <div className="surface space-y-3 p-5 text-sm">
        <p>
          <span className="text-muted-foreground">Due:</span> {new Date(assignment.dueAt).toLocaleString()}
        </p>
        <p>
          <span className="text-muted-foreground">Total marks:</span> {assignment.totalMarks} · <span className="capitalize">{assignment.status}</span>
        </p>
        <p className="font-medium">Instructions</p>
        <p className="text-muted-foreground">{assignment.instructions || "—"}</p>
        {assignment.tasks.length > 0 && (
          <ul className="list-disc space-y-1 pl-5">
            {assignment.tasks.map((t) => (
              <li key={t.id}>
                {t.prompt} <span className="text-muted-foreground">({t.marks} marks)</span>
              </li>
            ))}
          </ul>
        )}
        <PdfAttachmentLink fileId={assignment.attachmentFileId} fileName={assignment.attachmentName} />
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Submissions & grading</h2>
        {subs.map((s) => (
          <div key={s.id} className="surface space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{s.studentName}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {s.status}
                  {s.submittedAt ? ` · ${new Date(s.submittedAt).toLocaleString()}` : ""}
                </p>
              </div>
              <span className="text-xs capitalize text-muted-foreground">Grade: {s.gradeState}</span>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              {Object.entries(s.answers).map(([k, v]) => (
                <p key={k} className="mt-1 first:mt-0">
                  <span className="font-medium">{k}:</span> {v}
                </p>
              ))}
              {Object.keys(s.answers).length === 0 && <p className="text-muted-foreground">No answers yet.</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
              <Input
                type="number"
                placeholder="Marks"
                value={drafts[s.id]?.marks ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: { marks: e.target.value, feedback: d[s.id]?.feedback ?? "" } }))}
              />
              <Textarea
                placeholder="Feedback"
                rows={2}
                value={drafts[s.id]?.feedback ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: { marks: d[s.id]?.marks ?? "", feedback: e.target.value } }))}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void saveHomeworkGrade({
                    submissionId: s.id,
                    marks: Number(drafts[s.id]?.marks) || 0,
                    feedback: drafts[s.id]?.feedback ?? "",
                    publish: false,
                  }).then(() => toast.success("Draft grade saved"));
                }}
              >
                Save draft grade
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  void saveHomeworkGrade({
                    submissionId: s.id,
                    marks: Number(drafts[s.id]?.marks) || 0,
                    feedback: drafts[s.id]?.feedback ?? "",
                    publish: true,
                  }).then(() => toast.success("Grade published"));
                }}
              >
                Publish grade
              </Button>
            </div>
          </div>
        ))}
        {subs.length === 0 && <p className="text-sm text-muted-foreground">No student submissions yet.</p>}
      </div>
    </div>
  );
}
