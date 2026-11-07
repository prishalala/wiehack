import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Building2, Loader2, Users } from "lucide-react";
import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { listClasses, subscribeTeacherPortal } from "@/services/teacherPortalData";
import type { SchoolClass } from "@/types/teacherPortal";

export const Route = createFileRoute("/teacher/classes")({
  head: () => ({ meta: [{ title: "My Classes — ClassBridge" }] }),
  component: MyClasses,
});

function MyClasses() {
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listClasses()
      .then((c) => {
        setClasses(c);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    refresh();
    return subscribeTeacherPortal(refresh);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">My Classes</h1>
        <p className="mt-1 text-muted-foreground">Courses and rosters assigned to you by your institution.</p>
      </div>

      <p className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 shrink-0" />
        Courses and enrollments are managed by your school. Ask your administrator to add a course or change a roster.
      </p>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      {classes === null && !error ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading courses…</p>
      ) : classes?.length === 0 ? (
        <EmptyState icon={Users} title="No courses assigned" body="Your institution hasn't assigned you any courses yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes?.map((c) => (
            <div key={c.id} className="surface p-5">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{c.code}</p>
                <h2 className="font-semibold">{c.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {c.subject}{c.grade ? ` · Grade ${c.grade}` : ""}
                </p>
              </div>
              <p className="mt-4 text-sm">
                <span className="font-display text-2xl font-semibold">{c.studentIds.length}</span> enrolled
              </p>
              {c.roster && c.roster.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                  {c.roster.map((s) => (
                    <li key={s.id} className="truncate">{s.fullName} <span className="text-xs">· {s.email}</span></li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/teacher/sessions">Start live lesson</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/teacher/homework">Homework</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/teacher/performance">
                    Performance <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
