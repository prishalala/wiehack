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
import { useTeacherAuth } from "@/context/TeacherAuthContext";

export const Route = createFileRoute("/teacher/login")({
  head: () => ({
    meta: [
      { title: "Teacher Login — ClassBridge" },
      { name: "description", content: "Sign in to the ClassBridge teacher portal." },
    ],
  }),
  component: TeacherLogin,
});

function TeacherLogin() {
  const { signIn, authAvailable, teacher } = useTeacherAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (teacher) void navigate({ to: "/teacher" });
  }, [teacher, navigate]);

  function validate() {
    const next: Record<string, string> = {};
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next["email"] = "Enter a valid email.";
    if (!password) next["password"] = "Password is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!authAvailable) {
      toast.error("Configure Supabase in .env to enable teacher login.");
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password);
      toast.success("Signed in");
      void navigate({ to: "/teacher" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Teacher sign in"
      subtitle="Sign in with your school or university email to open your courses, live lessons and Misconception Radar."
      footer={
        <>
          Accounts are issued by your institution. No account? Contact your school administrator.
          <br />
          Are you a student?{" "}
          <Link to="/student/login" className="font-medium text-primary hover:underline">
            Student sign in
          </Link>
        </>
      }
    >
      {!authAvailable && (
        <div className="mb-4 rounded-lg border border-dashed bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Auth is not configured in this environment. Set <code className="font-mono">VITE_SUPABASE_*</code> to enable real teacher login (no fake sessions).
        </div>
      )}
      {authAvailable && <PrototypeAccounts role="teacher" />}
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
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
        <div className="flex justify-end">
          <Link to="/teacher/forgot-password" className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
