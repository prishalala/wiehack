import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/common";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <span className="glow -z-10 start-[10%] top-16 h-64 w-64 bg-primary/20" aria-hidden />
      <span className="glow -z-10 end-[12%] bottom-20 h-56 w-56 bg-sky/15" aria-hidden />
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-6 font-display text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className="surface p-6 shadow-lift sm:p-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="font-medium text-primary transition-colors duration-150 hover:text-accent-foreground">
            ← Back to ClassBridge
          </Link>
        </p>
      </div>
    </div>
  );
}
