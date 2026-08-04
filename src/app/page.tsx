import { ChatShell } from "@/components/chat/chat-shell";
import { getSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

/**
 * Chat home.
 *
 * A Server Component that resolves the session on the server and passes the result
 * into one Client Component boundary. Reading identity here rather than in the
 * browser means the page never renders as though signed in before a check
 * completes, and admin status is decided from the database rather than from
 * anything the client could assert.
 *
 * Not redirected when signed out: the interface stays visible and explains that
 * signing in is needed, which is friendlier than bouncing a first-time visitor
 * straight to a form.
 */
export default async function HomePage() {
  const session = await getSession();
  const database = getDatabase();

  return (
    <ChatShell
      isSignedIn={session !== null}
      userEmail={session?.email}
      isAdmin={session?.profile.role === "admin"}
      persistenceKind={database.kind}
    />
  );
}
