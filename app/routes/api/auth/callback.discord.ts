import { createAPIFileRoute } from "@tanstack/start/api";
import { OAuth2RequestError } from "arctic";
import { parseCookies } from "vinxi/http";
import {
  createSession,
  discord,
  generateSessionToken,
  setSessionTokenCookie,
} from "~/server/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string;
  avatar?: string;
  email: string;
  verified: boolean;
}

export const Route = createAPIFileRoute("/api/auth/callback/discord")({
  GET: async ({ request, params }) => {
    console.log(params);

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    const cookies = parseCookies();
    const storedState = cookies.discord_oauth_state;

    if (!code || !state || !storedState || state !== storedState) {
      return new Response(null, {
        status: 400,
      });
    }

    const PROVIDER_ID = "discord";

    try {
      // Obtenir les tokens et les informations utilisateur
      const tokens = await discord.validateAuthorizationCode(code);
      const discordUserResponse = await fetch("https://discord.com/api/v10/users/@me", {
        headers: {
          Authorization: `Bearer ${tokens.accessToken()}`,
        },
      });
      const providerUser: DiscordUser = await discordUserResponse.json();

      // Vérifier si l'utilisateur existe déjà
      const existingOauthAccount = await prisma.oAuthAccount.findUnique({
        where: {
          provider_id_provider_user_id: {
            provider_id: PROVIDER_ID,
            provider_user_id: providerUser.id,
          },
        },
      });

      if (existingOauthAccount) {
        const token = generateSessionToken();
        const session = await createSession(token, existingOauthAccount.user_id);
        setSessionTokenCookie(token, session.expiresAt);
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/",
          },
        });
      }

      // Vérifier si un utilisateur avec cet email existe déjà
      const existingUserEmail = await prisma.user.findUnique({
        where: { email: providerUser.email },
      });

      if (existingUserEmail) {
        await prisma.oAuthAccount.create({
          data: {
            provider_id: PROVIDER_ID,
            provider_user_id: providerUser.id,
            user_id: existingUserEmail.id,
          },
        });

        const token = generateSessionToken();
        const session = await createSession(token, existingUserEmail.id);
        setSessionTokenCookie(token, session.expiresAt);
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/",
          },
        });
      }

      // Créer un nouvel utilisateur et un compte OAuth
      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: providerUser.email,
            name: providerUser.global_name || providerUser.username,
            avatarUrl: providerUser.avatar
              ? `https://cdn.discordapp.com/avatars/${providerUser.id}/${providerUser.avatar}.png`
              : null,
          },
        });

        await tx.oAuthAccount.create({
          data: {
            provider_id: PROVIDER_ID,
            provider_user_id: providerUser.id,
            user_id: newUser.id,
          },
        });

        return newUser;
      });

      const token = generateSessionToken();
      const session = await createSession(token, user.id);
      setSessionTokenCookie(token, session.expiresAt);
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
        },
      });
    } catch (e) {
      console.error(e);
      if (e instanceof OAuth2RequestError) {
        return new Response(null, {
          status: 400,
        });
      }
      return new Response(null, {
        status: 500,
      });
    }
  },
});
