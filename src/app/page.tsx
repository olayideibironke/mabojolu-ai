import { GuestSessionBootstrap } from "@/components/auth/guest-session-bootstrap";
import { ChatShell } from "@/components/chat/chat-shell";
import { getSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { inspectServerEnv } from "@/lib/env";

/**
 * Mabojolu chat home.
 *
 * Identity is resolved on the server so the browser cannot decide whether a
 * visitor is a guest, registered user, or administrator.
 *
 * In Supabase mode, a completely signed-out visitor receives an anonymous
 * session automatically. The page then reloads with a secure guest identity
 * that can own conversations and usage records.
 */
export default async function HomePage() {
  const session =
    await getSession();

  const database =
    getDatabase();

  const envResult =
    inspectServerEnv();

  const shouldBootstrapGuest =
    session === null &&
    envResult.ok &&
    envResult.env.AUTH_MODE ===
      "supabase";

  return (
    <>
      <GuestSessionBootstrap
        enabled={
          shouldBootstrapGuest
        }
      />

      <ChatShell
        isSignedIn={
          session !== null
        }
        isGuest={
          session?.isAnonymous ===
          true
        }
        userEmail={
          session?.email ||
          undefined
        }
        isAdmin={
          session?.profile.role ===
          "admin"
        }
        persistenceKind={
          database.kind
        }
      />
    </>
  );
}