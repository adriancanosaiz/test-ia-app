import { getTranslations } from "next-intl/server";
import { getChatSessions } from "@/modules/chat/actions";
import { getIndexedDocuments } from "@/modules/documents/actions";
import { ChatSessionList } from "@/modules/chat/components/chat-session-list";
import { NewChatDialog } from "@/modules/chat/components/new-chat-dialog";
import { SsrErrorState } from "@/components/ssr-error-state";
import { MessageSquare } from "lucide-react";

export default async function ChatPage() {
  const t = await getTranslations("chat");
  let sessions;
  let documents;

  try {
    [sessions, documents] = await Promise.all([
      getChatSessions(),
      getIndexedDocuments(),
    ]);
  } catch {
    return <SsrErrorState title={t("errorLoadingSessions")} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <NewChatDialog documents={documents}>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <MessageSquare className="h-4 w-4" />
            {t("newChat")}
          </button>
        </NewChatDialog>
      </div>

      <ChatSessionList
        sessions={sessions.map((s) => ({
          ...s,
          title: s.title ?? t("untitled"),
        }))}
        documents={documents}
      />
    </div>
  );
}
