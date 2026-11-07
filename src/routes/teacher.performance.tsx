import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  listClasses,
  listGradesForStudent,
  listTopicPerformance,
  subscribeTeacherPortal,
} from "@/services/teacherPortalData";
import type { Grade, SchoolClass, TopicPerformance } from "@/types/teacherPortal";
import { Users } from "lucide-react";

export const Route = createFileRoute("/teacher/performance")({
  head: () => ({ meta: [{ title: "Student Performance — ClassBridge" }] }),
  component: PerformancePage,
});

function PerformancePage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicPerformance[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);

  const refresh = useCallback(() => {
    void listClasses().then((c) => {
      setClasses(c);
      setClassId((prev) => prev || c[0]?.id || "");
    });
  }, []);

  useEffect(() => {
    refresh();
    return subscribeTeacherPortal(refresh);
  }, [refresh]);

  useEffect(() => {
    if (!classId) {
      setTopics([]);
      return;
    }
    void listTopicPerformance(classId).then(setTopics);
  }, [classId]);

  useEffect(() => {
    if (!selectedId) {
      setGrades([]);
      return;
    }
    void listGradesForStudent(selectedId).then(setGrades);
  }, [selectedId]);

  // Roster comes from the institution's enrollments for the selected course.
  const roster = (classes.find((c) => c.id === classId)?.roster ?? []).map((s) => ({ id: s.id, name: s.fullName }));
  const selected = roster.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Student Performance</h1>
        <p className="mt-1 text-muted-foreground">Live session roster plus published grades and topic stats from your assessments.</p>
      </div>

      {classes.length === 0 ? (
        <EmptyState icon={Users} title="No classes yet" body="Create a class, then run quizzes or join a live session to see performance." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={classId === c.id ? "default" : "outline"}
                onClick={() => {
                  setClassId(c.id);
                  setSelectedId(null);
                }}
              >
                {c.name}
              </Button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="surface overflow-hidden p-0">
              <div className="border-b px-4 py-3 text-sm font-semibold">Students in live session</div>
              <ul className="max-h-[480px] divide-y overflow-y-auto">
                {roster.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted ${selectedId === s.id ? "bg-primary-soft" : ""}`}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-semibold">{s.name.slice(0, 2)}</span>
                      {s.name}
                    </button>
                  </li>
                ))}
                {roster.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">No students are enrolled in this course.</li>}
              </ul>
            </div>

            <div className="space-y-4">
              {!selected ? (
                <div className="surface p-8 text-sm text-muted-foreground">Select a student to view assessment history and topic strengths.</div>
              ) : (
                <>
                  <div className="surface p-5">
                    <h2 className="font-display text-2xl font-semibold">{selected.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{grades.length} published grade(s)</p>
                  </div>
                  <div className="surface p-5">
                    <h3 className="font-semibold">Assessment history</h3>
                    <ul className="mt-3 divide-y text-sm">
                      {grades.map((g) => (
                        <li key={g.id} className="flex justify-between gap-3 py-3">
                          <div>
                            <p className="font-medium">{g.title}</p>
                            <p className="text-xs capitalize text-muted-foreground">
                              {g.source} · {g.publishState}
                              {g.feedback ? ` · ${g.feedback}` : ""}
                            </p>
                          </div>
                          <span className="font-semibold">
                            {g.marks}/{g.totalMarks}
                          </span>
                        </li>
                      ))}
                      {grades.length === 0 && <li className="py-4 text-muted-foreground">No published grades for this student yet.</li>}
                    </ul>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="surface p-5">
                      <h3 className="text-sm font-semibold text-success">Strengths</h3>
                      <ul className="mt-2 space-y-2 text-sm">
                        {topics
                          .filter((t) => t.strength === "strong")
                          .map((t) => (
                            <li key={t.topic} className="rounded-lg bg-success-soft/50 px-3 py-2">
                              {t.topic}
                              <span className="block text-xs text-muted-foreground">{t.evidence}</span>
                            </li>
                          ))}
                        {topics.filter((t) => t.strength === "strong").length === 0 && (
                          <li className="text-muted-foreground">No strong topics yet — need graded quiz attempts.</li>
                        )}
                      </ul>
                    </div>
                    <div className="surface p-5">
                      <h3 className="text-sm font-semibold text-alert-foreground">Needs improvement</h3>
                      <ul className="mt-2 space-y-2 text-sm">
                        {topics
                          .filter((t) => t.strength === "attention")
                          .map((t) => (
                            <li key={t.topic} className="rounded-lg bg-alert-soft/50 px-3 py-2">
                              {t.topic}
                              <span className="block text-xs text-muted-foreground">{t.evidence}</span>
                            </li>
                          ))}
                        {topics.filter((t) => t.strength === "attention").length === 0 && (
                          <li className="text-muted-foreground">No weak topics identified yet.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
