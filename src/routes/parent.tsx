import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Heart, Languages, Loader2, LogOut } from "lucide-react";
import { Logo } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ParentAuthProvider, useParentAuth } from "@/context/ParentAuthContext";
import { ParentLangProvider, useParentLang } from "@/context/ParentLangContext";
import { isRtl, PARENT_LANGUAGES, pt } from "@/i18n/parent";

export const Route = createFileRoute("/parent")({
  component: ParentPortalRoot,
});

function ParentPortalRoot() {
  return (
    <ParentAuthProvider>
      <ParentLangProvider>
        <ParentGate />
      </ParentLangProvider>
    </ParentAuthProvider>
  );
}

function ParentGate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLogin = pathname === "/parent/login";
  const { parent, loading } = useParentAuth();
  const navigate = useNavigate();
  const { lang } = useParentLang();

  useEffect(() => {
    if (!loading && !parent && !isLogin) void navigate({ to: "/parent/login" });
  }, [loading, parent, isLogin, navigate]);

  if (isLogin) return <Outlet />;
  if (loading || !parent) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        {loading ? "Checking your sign-in…" : "Redirecting to sign in…"}
      </div>
    );
  }
  return <ParentLayout lang={lang} />;
}

function ParentLayout({ lang }: { lang: string }) {
  const { parent, signOut } = useParentAuth();
  const { setLang, labelsReady } = useParentLang();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" dir={isRtl(lang) ? "rtl" : "ltr"} lang={lang}>
      <header className="sticky top-0 z-20 border-b bg-card/80 shadow-soft backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/parent" aria-label={pt(lang, "portal")}>
            <Logo />
          </Link>
          <span className="hidden items-center gap-1.5 rounded-full bg-alert-soft px-2.5 py-1 text-xs font-semibold text-alert-foreground sm:flex">
            <Heart className="h-3 w-3" /> {pt(lang, "portal")}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!labelsReady && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label={pt(lang, "loading")} />}
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger className="h-9 w-auto min-w-[150px] gap-2 bg-card" aria-label={pt(lang, "language")}>
                <Languages className="h-4 w-4 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {PARENT_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.native}
                    <span className="ml-1 text-xs text-muted-foreground">· {l.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="hidden text-right text-sm md:block">
              <span className="block font-medium leading-tight">{parent?.fullName}</span>
              <span className="text-xs text-muted-foreground">{parent?.email}</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={pt(lang, "signOut")}
              onClick={() => void signOut().then(() => navigate({ to: "/parent/login" }))}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
