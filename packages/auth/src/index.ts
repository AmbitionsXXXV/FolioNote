import { expo } from "@better-auth/expo"
import { USER_ADDITIONAL_FIELDS_SCHEMA } from "@folionote/constants"
import { db } from "@folionote/db"
import {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification
} from "@folionote/db/schema/auth"
import { ResetPasswordEmail } from "@folionote/transactional"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import "dotenv/config"
import { Resend } from "resend"

// Initialize Resend client
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const trustedOrigins = process.env.CORS_ORIGIN?.split(",")
  .map((origin: string) => origin.trim())
  .filter((origin: string) => origin.length > 0)

const cookieDomainFromBaseUrl = (() => {
  const baseUrl = process.env.BETTER_AUTH_URL
  if (!baseUrl) {
    return null
  }

  try {
    const { hostname } = new URL(baseUrl)
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      return null
    }

    const hostnameParts = hostname.split(".")
    if (hostnameParts.length < 2) {
      return null
    }

    // For e.g. api.folionote.xyz -> folionote.xyz
    return hostnameParts.slice(-2).join(".")
  } catch {
    return null
  }
})()

// The server process supplies BETTER_AUTH_URL. The web SSR process imports this
// module (via the oRPC context) but loads none of the server's env, so fall
// back to the local server URL in development to avoid Better Auth warning that
// it must derive the origin per-request. In production, leave it unset so the
// origin is request-derived rather than pinned to a wrong default.
const LOCAL_AUTH_URL = "http://localhost:3000"
const baseURL =
  process.env.BETTER_AUTH_URL ??
  process.env.VITE_SERVER_URL ??
  (process.env.NODE_ENV === "production" ? undefined : LOCAL_AUTH_URL)

interface SocialProviderCredentials {
  clientId: string
  clientSecret: string
}

// Only register an OAuth provider when both halves of its credentials are
// present. The web SSR process has none, so it skips them silently instead of
// warning; the server process supplies them and enables the providers.
function readSocialCredentials(
  clientId: string | undefined,
  clientSecret: string | undefined
): SocialProviderCredentials | null {
  if (clientId && clientSecret) {
    return { clientId, clientSecret }
  }
  return null
}

const githubCredentials = readSocialCredentials(
  process.env.GITHUB_CLIENT_ID,
  process.env.GITHUB_CLIENT_SECRET
)
const googleCredentials = readSocialCredentials(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)

const socialProviders = {
  ...(githubCredentials ? { github: githubCredentials } : {}),
  ...(googleCredentials
    ? {
        google: {
          ...googleCredentials,
          prompt: "select_account" as const,
          // Google only issues a refresh token for offline access; without
          // it Docs import (drive.file, linked later) dies after ~1 hour.
          accessType: "offline" as const
        }
      }
    : {})
}

/**
 * Send password reset email to user using Resend with React Email template.
 * Falls back to console logging in development or when RESEND_API_KEY is not set.
 */
async function sendResetPasswordEmail({
  user: targetUser,
  url
}: {
  user: { email: string; name: string }
  url: string
}): Promise<void> {
  // If Resend is not configured, log to console (development mode)
  if (!resend) {
    console.log("=".repeat(60))
    console.log("[Password Reset] RESEND_API_KEY not set, logging to console")
    console.log("[Password Reset] Email would be sent to:", targetUser.email)
    console.log("[Password Reset] Reset URL:", url)
    console.log("=".repeat(60))
    return
  }

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "FolioNote <onboarding@resend.dev>",
    to: targetUser.email,
    subject: "Reset your FolioNote password",
    react: ResetPasswordEmail({
      userName: targetUser.name,
      resetUrl: url
    })
  })

  if (error) {
    console.error("[Password Reset] Failed to send email:", error)
    throw new Error(`Failed to send password reset email: ${error.message}`)
  }

  console.log("[Password Reset] Email sent successfully to:", targetUser.email)
}

/**
 * Send an email-verification link using Resend. Falls back to console logging in
 * development or when RESEND_API_KEY is not set. The display name is escaped
 * before interpolation to avoid HTML injection into the email body.
 */
async function sendVerificationEmail({
  user: targetUser,
  url
}: {
  user: { email: string; name: string }
  url: string
}): Promise<void> {
  if (!resend) {
    console.log("=".repeat(60))
    console.log(
      "[Email Verification] RESEND_API_KEY not set, logging to console"
    )
    console.log(
      "[Email Verification] Email would be sent to:",
      targetUser.email
    )
    console.log("[Email Verification] Verification URL:", url)
    console.log("=".repeat(60))
    return
  }

  const safeName = (targetUser.name || "there").replace(/[&<>"']/g, "")
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "FolioNote <onboarding@resend.dev>",
    to: targetUser.email,
    subject: "Verify your FolioNote email",
    html: `<p>Hi ${safeName},</p><p>Confirm your email address to finish setting up FolioNote.</p><p><a href="${url}">Verify email</a></p><p>If you didn't create this account, you can ignore this message.</p>`
  })

  if (error) {
    console.error("[Email Verification] Failed to send email:", error)
    throw new Error(`Failed to send verification email: ${error.message}`)
  }

  console.log(
    "[Email Verification] Email sent successfully to:",
    targetUser.email
  )
}

export const auth = betterAuth({
  // account: { skipStateCookieCheck: true },
  baseURL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      userRelations,
      session,
      sessionRelations,
      account,
      accountRelations,
      verification
    }
  }),
  user: {
    additionalFields: {
      no: {
        ...USER_ADDITIONAL_FIELDS_SCHEMA.no,
        input: false
      }
    }
  },
  trustedOrigins: [
    ...(trustedOrigins ?? []),
    "http://localhost:3001",
    "http://localhost:3000",
    "http://localhost:7890",
    "exp://",
    "folio-note://"
  ],
  // Throttle credential endpoints to blunt brute-force / credential stuffing.
  // NOTE: default storage is in-memory, so in the 2-instance PM2 cluster the
  // effective limit is per-process (≈2×). Move to database/secondary storage
  // for a cluster-wide limit.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/forget-password": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 }
    }
  },
  socialProviders,
  // Let a verified Google/GitHub sign-in link into a pre-existing same-email
  // account instead of failing with `account_not_linked`.
  //
  // Better Auth 1.6.x's implicit-link gate rejects the link when EITHER the
  // incoming provider's email is unverified, OR `requireLocalEmailVerified`
  // (default true) is set and the *existing local* account is unverified.
  // Google/GitHub always return verified emails, so the first check passes on
  // its own — but every email/password account is unverified while
  // REQUIRE_EMAIL_VERIFICATION is off, so the second check fires and blocks the
  // link. That is the bug users hit. `trustedProviders` does NOT help here: it
  // only waives the incoming-provider check (never the local one) and would let
  // an *unverified* GitHub primary email force-link — an account-takeover
  // vector — so it is deliberately omitted.
  //
  // Interim fix: waive the local-verification requirement. Durable fix: turn on
  // REQUIRE_EMAIL_VERIFICATION, get existing users verified, then drop this
  // override to restore verified-only linking.
  // https://better-auth.com/docs/concepts/users-accounts#account-linking
  account: {
    accountLinking: {
      enabled: true,
      requireLocalEmailVerified: false
    }
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // Off by default so signups keep working until verification email delivery
    // is confirmed in production. Set REQUIRE_EMAIL_VERIFICATION=true to enforce.
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail({ user, url })
    }
  },
  emailVerification: {
    sendOnSignUp: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ user, url })
    }
  },
  advanced: {
    // CSRF protection is enabled by default. DISABLE_CSRF=true is an escape hatch
    // for the cross-origin cookie flow; prefer fixing trustedOrigins + CORS.
    disableCSRFCheck: process.env.DISABLE_CSRF === "true",
    ...(cookieDomainFromBaseUrl
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: cookieDomainFromBaseUrl
          }
        }
      : {}),
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true
      // partitioned: true,
    }
  },
  plugins: [expo()]
})
