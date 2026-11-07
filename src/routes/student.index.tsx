import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BookOpen, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { t } from "@/i18n";
import { listMyCourses, type StudentCourse } from "@/services/studentPortalData";
import { JoinLiveButton } from "@/components/student/JoinLiveButton";

export const Route = createFileRoute("/student/")({
  head: () => ({ meta: [{ title: "My courses — ClassBridge" }] }),
  component: MyCourses,
});

function MyCourses() {
  const { lang } = useLanguage();
  const [courses, setCourses] = useState<StudentCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listMyCourses()
      .then((c) => {
        setCourses(c);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 10000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t(lang, "myCourses")}</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">{t(lang, "coursesHint")}</p>
      </div>

      {error && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      {courses === null && !error ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t(lang, "loading")}
        </p>
      ) : courses?.length === 0 ? (
        <EmptyState icon={BookOpen} title={t(lang, "noCourses")} body="" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses?.map((c) => (
            <div
              key={c.id}
              className={`surface flex flex-col p-5 transition-shadow duration-200 ${c.liveSession ? "border-success/40 shadow-lift ring-1 ring-success/20" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{c.code}</p>
                  <h2 className="font-display text-xl font-semibold leading-snug">{c.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {c.subject}
                    {c.teacherName ? ` · ${c.teacherName}` : ""}
                  </p>
                </div>
                {c.liveSession && (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-foreground">
                    <span className="live-dot" /> {t(lang, "liveNow")}
                  </span>
                )}
              </div>
              {c.liveSession && (
                <p className="mt-3 rounded-lg bg-success-soft/60 px-3 py-2 text-sm font-medium text-success-foreground">
                  {c.liveSession.title}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2 pt-1">
                {c.liveSession && <JoinLiveButton sessionId={c.liveSession.id} />}
                <Button asChild variant={c.liveSession ? "outline" : "default"} size="sm">
                  <Link to="/student/course/$courseId" params={{ courseId: c.id }}>
                    {t(lang, "openCoursework")} <ArrowRight className="h-3.5 w-3.5" />
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
