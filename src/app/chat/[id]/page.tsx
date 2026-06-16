import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getChatSession, getChatSessions } from "@/modules/chat/actions";
import { getIndexedDocuments } from "@/modules/documents/actions";
import { Chat } from "@/modules/chat/components/chat";
import { ChatPageShell } from "@/modules/chat/components/chat-page-shell";
import { SsrErrorState } from "@/components/ssr-error-state";

interface ChatSessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatSessionPage({
  params,
}: ChatSessionPageProps) {
  const { id } = await params;
  const t = await getTranslations("chat");
  let session;
  let sessions;
  let documents;

  try {
    session = await getChatSession(id);
    if (!session) {
      notFound();
    }
    [sessions, documents] = await Promise.all([
      getChatSessions(),
      getIndexedDocuments(),
    ]);
  } catch {
    return <SsrErrorState title={t("errorLoadingSession")} />;
  }

  return (
    <ChatPageShell
      session={{
        id: session.id,
        title: session.title ?? t("untitled"),
        sourceDocument: session.sourceDocument,
      }}
      sessions={sessions.map((s) => ({
        ...s,
        title: s.title ?? t("untitled"),
      }))}
      documents={documents}
    >
      <Chat
        sessionId={session.id}
        initialMessages={session.messages}
        sourceDocumentId={session.sourceDocumentId}
        hasIndexedDocuments={documents.length > 0}
      />
    </ChatPageShell>
  );
}
