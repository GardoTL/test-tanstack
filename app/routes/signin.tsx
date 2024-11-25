import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";

const AuthPage = () => {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-8 rounded-xl border bg-card p-10">
        Logo here
        <form method="GET" className="flex flex-col gap-2">
          <Button
            formAction="/api/auth/discord"
            type="submit"
            variant="outline"
            size="lg"
          >
            Sign in with Discord
          </Button>
          <Link to="/signin"></Link>
        </form>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/signin")({
  component: AuthPage,
  beforeLoad: async ({ context }) => {
    if (context.user) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
});
