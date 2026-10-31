// NextAuth v4 configuration (staff only; credentials: email + password).
//
// Rules:
// - The token carries the user id and loginAt (when this session signed in).
//   Role and active state are NOT trusted from the token: validation/auth.ts
//   loads them live per request, and uses loginAt for D-9 (sessions issued
//   before the latest password change are signed out).
// - session.user.id is always our database User id.
// - The login rules (active user, invite accepted, rate limits AUTH-R6 /
//   ACC-R7, audit events) live in the user service, not here.

import type { DefaultSession, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyLogin, recordLogout } from "@/server/modules/access/user/user.service";
import { metaFromHeaders } from "@/server/validation/request";
import { AUTH_PATHS } from "@/server/validation/auth-paths";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    loginAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    loginAt?: number;
  }
}

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const h = new Headers();
        for (const [k, v] of Object.entries(req?.headers ?? {})) if (typeof v === "string") h.set(k, v);
        const result = await verifyLogin(credentials ?? {}, metaFromHeaders(h));
        // Never return the password hash; null = "Invalid email or password."
        if (!result.ok) {
          if (result.reason === "RATE_LIMITED") throw new Error("RATE_LIMITED");
          return null;
        }
        return { id: result.user.id, email: result.user.email, name: result.user.name };
      },
    }),
  ],

  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },

  callbacks: {
    // `user` is only present at sign in. Store our database id and the time.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.loginAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (typeof token.loginAt === "number") session.loginAt = token.loginAt;
      return session;
    },
  },

  events: {
    async signOut({ token }) {
      if (token?.id) await recordLogout(token.id);
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: AUTH_PATHS.signIn },
};
