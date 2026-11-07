import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/teacher/AuthShell";
import { PasswordField } from "@/components/teacher/PasswordField";
import { PrototypeAccounts } from "@/components/PrototypeAccounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useParentAuth } from "@/context/ParentAuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { pt } from "@/i18n/parent";
import { useParentLang } from "@/context/ParentLangContext";

export const Route = createFileRoute("/parent/login")({
  head: () => ({
    meta: [
      { title: "Parent sign in — ClassBridge" },
      { name: "description", content: "Sign in to see your child's grades, homework and support areas." },
    ],
  }),
  component: ParentLogin,
});

function ParentLogin() {
  const { signIn, parent } = useParentAuth();
  const { lang } = useParentLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (parent) void navigate({ to: "/parent" });
  }, [parent, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next["email"] = "Enter your institution email.";
    if (!password) next["password"] = "Password is required.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await signIn(email, password);
      void navigate({ to: "/parent" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={pt(lang, "signInTitle")}
      subtitle={pt(lang, "signInSub")}
      footer={
        <>
          Accounts are issued by your institution. Need access? Ask the school office to link you to your child.
          <br />
          <Heart className="mr-1 inline h-3.5 w-3.5 text-alert" />
          Are you a student?{" "}
          <Link to="/student/login" className="font-medium text-primary hover:underline">
            Student sign in
          </Link>
          {" · "}
          <Link to="/teacher/login" className="font-medium text-primary hover:underline">
            Teacher sign in
          </Link>
        </>
      }
    >
      {!configured && (
        <div className="mb-4 rounded-lg border border-dashed bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Sign-in isn't configured. Set <code className="font-mono">VITE_SUPABASE_*</code> in .env.
        </div>
      )}
      {configured && <PrototypeAccounts role="parent" />}
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
        <p className="text-xs text-muted-foreground">{pt(lang, "privacyNote")}</p>
        <Button type="submit" className="w-full" disabled={busy || !configured}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Signing in…" : pt(lang, "send")}
        </Button>
      </form>
    </AuthShell>
  );
}
