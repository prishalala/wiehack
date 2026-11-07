import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/common";
import { LanguageSwitcher } from "@/components/student/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { StudentAuthProvider, useStudentAuth } from "@/context/StudentAuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { t } from "@/i18n";

export const Route = createFileRoute("/student")({
  component: StudentPortalRoot,
});

function StudentPortalRoot() {
  return (
    <StudentAuthProvider>
      <StudentGate />
    </StudentAuthProvider>
  );
}

function StudentGate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Only guard routes under /student — otherwise leaving login (e.g. to "/") gets yanked back.
  const inPortal = pathname === "/student" || pathname.startsWith("/student/");
  const isLogin = pathname === "/student/login";
  const { student, loading } = useStudentAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!inPortal || loading || isLogin || student) return;
    void navigate({ to: "/student/login" });
  }, [inPortal, loading, student, isLogin, navigate]);

  if (!inPortal) return <Outlet />;
  if (isLogin) return <Outlet />;
  if (loading || !student) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">{loading ? "Checking your sign-in…" : "Redirecting to sign in…"}</div>;
  }
  return <StudentLayout />;
}

function StudentLayout() {
  const { student, signOut } = useStudentAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/student" aria-label={t(lang, "myCourses")}><Logo /></Link>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-right text-sm md:block">
              <span className="block font-medium leading-tight">{student?.fullName}</span>
              <span className="text-xs text-muted-foreground">{student?.email}</span>
            </span>
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t(lang, "signOut")}
              onClick={() => void signOut().then(() => navigate({ to: "/student/login" }))}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
