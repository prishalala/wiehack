import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/teacher/AuthShell";
import { PasswordField } from "@/components/teacher/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrototypeAccounts } from "@/components/PrototypeAccounts";
import { useStudentAuth } from "@/context/StudentAuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/student/login")({
  head: () => ({
    meta: [
      { title: "Student sign in — ClassBridge" },
      { name: "description", content: "Sign in with your school or university email to see your courses." },
    ],
  }),
  component: StudentLogin,
});

function StudentLogin() {
  const { signIn, student } = useStudentAuth();
  const { setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (student) void navigate({ to: "/student" });
  }, [student, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next["email"] = "Enter your institution email.";
    if (!password) next["password"] = "Password is required.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const p = await signIn(email, password);
      // Start in the student's preferred language from the directory; they can switch any time.
      if (p.preferredLanguage) setLanguage(p.preferredLanguage);
      void navigate({ to: "/student" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Student sign in"
      subtitle="Sign in with your school or university email to see your courses, live lessons, homework and quizzes."
      footer={
        <>
          Accounts are issued by your institution. Can't sign in? Ask your teacher or school office.
          <br />
          Are you a teacher?{" "}
          <Link to="/teacher/login" className="font-medium text-primary hover:underline">
            Teacher sign in
          </Link>
        </>
      }
    >
      {!configured && (
        <div className="mb-4 rounded-lg border border-dashed bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Sign-in isn't configured in this environment. Set <code className="font-mono">VITE_SUPABASE_*</code> in .env.
        </div>
      )}
      {configured && <PrototypeAccounts role="student" />}
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Institution email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            aria-invalid={Boolean(errors["email"])}
          />
          {errors["email"] ? <p className="text-xs text-destructive">{errors["email"]}</p> : null}
        </div>
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          {...(errors["password"] ? { error: errors["password"] } : {})}
          disabled={busy}
        />
        <Button type="submit" className="w-full" disabled={busy || !configured}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
