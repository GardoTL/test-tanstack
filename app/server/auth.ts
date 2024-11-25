import { PrismaClient } from "@prisma/client";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import { Discord } from "arctic";
import { deleteCookie, getCookie, setCookie } from "vinxi/http";

const prisma = new PrismaClient();

export const SESSION_COOKIE_NAME = "session";

export const generateSessionToken = (): string => {
  const bytes = new Uint8Array(20);

  crypto.getRandomValues(bytes);

  return encodeBase32LowerCaseNoPadding(bytes);
};

export const createSession = async (token: string, userId: number) => {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

  const session = await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
    },
  });

  return session;
};

export const validateSessionToken = async (token: string) => {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          setupAt: true,
        },
      },
    },
  });

  if (!session) {
    return {
      session: null,
      user: null,
    };
  }

  if (Date.now() >= session.expiresAt.getTime()) {
    await prisma.session.delete({
      where: {
        id: session.id,
      },
    });

    return {
      session: null,
      user: null,
    };
  }

  // Extend the session if it is near expiration
  if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
    session.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        expiresAt: session.expiresAt,
      },
    });
  }

  return {
    session,
    user: session.user,
  };
};

export const invalidateSession = async (sessionId: string) => {
  await prisma.session.delete({
    where: {
      id: sessionId,
    },
  });
};

export const setSessionTokenCookie = (token: string, expiresAt: Date) => {
  setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
};

// OAuth2 Providers
export const discord = new Discord(
  process.env.DISCORD_CLIENT_ID as string,
  process.env.DISCORD_CLIENT_SECRET as string,
  process.env.DISCORD_REDIRECT_URI as string,
);

/**
 * Retrieves the session and user data if valid.
 * Can be used in API routes and server functions.
 */
export const getAuthSession = async (refreshCookie = true) => {
  const token = getCookie(SESSION_COOKIE_NAME);

  if (!token) {
    return {
      session: null,
      user: null,
    };
  }

  const { session, user } = await validateSessionToken(token);
  if (session === null) {
    deleteCookie(SESSION_COOKIE_NAME);

    return {
      session: null,
      user: null,
    };
  }

  if (refreshCookie) {
    setSessionTokenCookie(token, session.expiresAt);
  }

  return {
    session,
    user,
  };
};
