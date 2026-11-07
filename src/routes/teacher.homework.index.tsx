import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listClasses, listHomework, listHomeworkSubmissions, subscribeTeacherPortal } from "@/services/teacherPortalData";
import type { HomeworkAssignment, SchoolClass } from "@/types/teacherPortal";

export const Route = createFileRoute("/teacher/homework/")({
  head: () => ({ meta: [{ title: "Homework — ClassBridge" }] }),
  component: HomeworkPage,
});

function HomeworkPage() {
  const [rows, setRows] = useState<HomeworkAssignment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState<Record<string, { submitted: number; pending: number }>>({});

  const refresh = useCallback(() => {
    void listHomework().then(async (hw) => {
      setRows(hw);
      const classList = await listClasses();
      setClasses(classList);
      const map: Record<string, { submitted: number; pending: number }> = {};
      for (const h of hw) {
        const subs = await listHomeworkSubmissions(h.id);
        const submitted = subs.filter((s) => s.status === "submitted" || s.status === "graded" || s.status === "returned").length;
        const classSize = classList.find((c) => c.id === h.classId)?.studentIds.length ?? 0;
        map[h.id] = { submitted, pending: Math.max(0, classSize - submitted) };
      }
      setCounts(map);
    });
  }, []);

  useEffect(() => {
    refresh();
    return subscribeTeacherPortal(refresh);
  }, [refresh]);

  const filtered = useMemo(() => {
    return rows.filter((h) => {
      if (classId !== "all" && h.classId !== classId) return false;
      if (status !== "all" && h.status !== status) return false;
      if (query && !`${h.title} ${h.topic}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [rows, classId, status, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Homework</h1>
          <p className="mt-1 text-muted-foreground">Create, assign, attach PDFs, and grade submissions.</p>
        </div>
        <Button asChild>
          <Link to="/teacher/homework/new">
            <Plus className="h-4 w-4" /> Create homework
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search title or topic" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="h-9 rounded-md border bg-background px-3 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="all">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="h-9 rounded-md border bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No homework yet" body="Create an assignment and optionally attach a PDF worksheet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Assignment</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">PDF</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((h) => {
                const cls = classes.find((c) => c.id === h.classId);
                const c = counts[h.id];
                return (
                  <tr key={h.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to="/teacher/homework/$id" params={{ id: h.id }} className="font-medium text-primary hover:underline">
                        {h.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{h.topic}</p>
                    </td>
                    <td className="px-4 py-3">{cls?.name ?? "—"}</td>
                    <td className="px-4 py-3">{new Date(h.dueAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{h.attachmentName ? "Yes" : "—"}</td>
                    <td className="px-4 py-3">{c?.submitted ?? 0}</td>
                    <td className="px-4 py-3 capitalize">{h.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
