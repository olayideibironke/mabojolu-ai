import { ChatShell } from "@/components/chat/chat-shell";

/**
 * Chat home.
 *
 * A Server Component that renders one Client Component boundary. The page
 * itself ships no client JavaScript; interactivity begins inside `ChatShell`.
 * This replaces the previous 540-line single-file implementation, which mixed
 * icons, state, transport, and layout in one client module.
 */
export default function HomePage() {
  return <ChatShell />;
}
