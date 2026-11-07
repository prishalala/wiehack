import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/teacher/homework")({
  component: () => <Outlet />,
});
