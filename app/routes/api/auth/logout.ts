import { createAPIFileRoute } from "@tanstack/start/api";
import { deleteCookie, setHeader } from "vinxi/http";
import { getAuthSession, invalidateSession, SESSION_COOKIE_NAME } from "~/server/auth";

export const Route = createAPIFileRoute("/api/auth/logout")({
  POST: async () => {
    setHeader("Location", "/");

    const { session } = await getAuthSession(false);

    if (!session) {
      return new Response(null, {
        status: 401,
      });
    }

    deleteCookie(SESSION_COOKIE_NAME);
    await invalidateSession(session.id);

    return new Response(null, {
      status: 302,
    });
  },
});