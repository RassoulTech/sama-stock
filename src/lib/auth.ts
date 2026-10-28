import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { resetPasswordEmail, sendMail } from "@/server/mail";
import { pinSignIn } from "./auth-pin";
import { TRUSTED_ORIGINS } from "./domains";

export const isGoogleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const isLocal = (process.env.BETTER_AUTH_URL ?? "").includes("localhost");

export const auth = betterAuth({
  appName: "Sama Stock",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  // En ligne : sama-stock.com, l'adresse de chaque boutique (nom.sama-stock.com) et l'ancienne adresse Vercel.
  // En local, autorise aussi l'accès depuis un téléphone du même réseau Wi-Fi (ex. http://192.168.1.4:3000)
  trustedOrigins: isLocal ? ["http://192.168.*:3000", "http://10.*:3000", "http://172.*:3000"] : TRUSTED_ORIGINS,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    // « Mot de passe oublié » : lien valable 1 heure envoyé par e-mail ; les autres appareils sont déconnectés
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({ to: user.email, ...resetPasswordEmail({ name: user.name, url }) });
    },
  },
  socialProviders: isGoogleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          prompt: "select_account",
        },
      }
    : {},
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // nextCookies doit rester en dernier : il recopie les cookies posés par les autres modules
  plugins: [pinSignIn(), nextCookies()],
});
