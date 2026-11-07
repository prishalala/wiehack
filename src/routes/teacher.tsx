import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Menu,
  Presentation,
  Radar,
  Settings,
  Users,
  GraduationCap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TeacherAuthProvider, useTeacherAuth } from "@/context/TeacherAuthContext";
import { useSessionPoll } from "@/hooks/use-session-poll";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAppState } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teacher")({
  component: TeacherPortalRoot,
});

const AUTH_PATHS = new Set(["/teacher/login", "/teacher/forgot-password"]);

const nav = [
  { to: "/teacher", label: "Overview", icon: LayoutGrid, exact: true },
  { to: "/teacher/classes", label: "My Classes", icon: Users },
  { to: "/teacher/sessions", label: "Live Sessions", icon: Presentation },
  { to: "/teacher/homework", label: "Homework", icon: ClipboardList },
  { to: "/teacher/quizzes", label: "Quizzes & Tests", icon: BookOpenCheck },
  { to: "/teacher/radar", label: "Misconception Radar", icon: Radar },
  { to: "/teacher/performance", label: "Student Performance", icon: BarChart3 },
  { to: "/teacher/settings", label: "Settings", icon: Settings },
] as const;

function TeacherPortalRoot() {
  return (
    <TeacherAuthProvider>
      <TeacherGate />
    </TeacherAuthProvider>
  );
}

function TeacherGate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Only guard routes under /teacher — otherwise leaving login (e.g. to "/") gets yanked back.
  const inPortal = pathname === "/teacher" || pathname.startsWith("/teacher/");
  const isAuthPage = AUTH_PATHS.has(pathname);
  const { teacher, loading, authAvailable } = useTeacherAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!inPortal || loading || isAuthPage) return;
    if (authAvailable && !teacher) {
      void navigate({ to: "/teacher/login" });
    }
  }, [inPortal, loading, isAuthPage, authAvailable, teacher, navigate]);

  if (!inPortal || isAuthPage) return <Outlet />;

  if (authAvailable && (loading || !teacher)) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        {loading ? "Checking teacher session…" : "Redirecting to sign in…"}
      </div>
    );
  }

  return <TeacherLayout />;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {nav.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={onNavigate}
          activeOptions={{ exact: "exact" in n && n.exact }}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-background/65 transition-colors hover:bg-background/10 hover:text-background"
          activeProps={{ className: "!bg-primary !text-primary-foreground shadow-soft" }}
        >
          <n.icon className="h-4 w-4" /> {n.label}
        </Link>
      ))}
    </nav>
  );
}

function TeacherLayout() {
  const { session, students } = useAppState();
  const { teacher, authAvailable, signOut } = useTeacherAuth();
  const [open, setOpen] = useState(false);
  useSessionPoll(4000, Boolean(session.id));
  const live = isSupabaseConfigured();
  const displayName = teacher?.fullName ?? "Teacher";
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-hidden bg-foreground p-4 text-background lg:flex">
        <span className="glow -left-16 top-1/3 h-48 w-48 bg-primary/40" aria-hidden />
        <Logo className="relative px-2 text-background [&>span:first-child]:bg-primary [&>span:first-child]:text-primary-foreground" />
        <p className="relative mt-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-background/40">Teacher portal</p>
        <div className="relative mt-2 flex-1 overflow-y-auto"><NavLinks /></div>
        <Button
          variant="ghost"
          size="sm"
          className="relative justify-start text-background/60 hover:bg-background/10 hover:text-background"
          onClick={() => {
            void signOut()
              .then(() => {
                toast.success(authAvailable ? "Signed out" : "Signed out");
                if (authAvailable) window.location.href = "/teacher/login";
              })
              .catch((e: Error) => toast.error(e.message));
          }}
        >
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-none bg-foreground text-background">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Logo className="text-background [&>span:first-child]:bg-primary [&>span:first-child]:text-primary-foreground" />
          <div className="mt-8"><NavLinks onNavigate={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/teacher/live" className="flex min-w-0 items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm shadow-soft hover:bg-muted">
            {session.status === "live" ? <span className="live-dot" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
            <span className="truncate font-medium">{session.title}</span>
            <span className="hidden text-muted-foreground sm:inline">· {students.length} students</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            {!authAvailable && <span className="hidden text-xs text-muted-foreground sm:inline">Auth off</span>}
            {live && authAvailable && (
              <span className={cn("hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex")}>
                <GraduationCap className="h-3.5 w-3.5" /> Live backend
              </span>
            )}
            <span className="hidden text-right text-sm sm:block">
              <span className="block font-medium leading-tight">{displayName}</span>
              <span className="text-xs text-muted-foreground">{teacher?.email ?? "Local session"}</span>
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-label="Account">
              {initials || "T"}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
