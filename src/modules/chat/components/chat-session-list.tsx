"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NewChatDialog } from "./new-chat-dialog";
import { deleteChatSession } from "../actions";
import { MessageSquare, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatSessionListProps {
  sessions: {
    id: string;
    title: string;
    sourceDocument: { title: string } | null;
    _count: { messages: number };
    updatedAt: Date;
  }[];
  activeSessionId?: string;
  documents?: {
    id: string;
    title: string;
    subject: {
      name: string;
      folder: { name: string };
    };
  }[];
}

export function ChatSessionList({
  sessions,
  activeSessionId,
  documents,
}: ChatSessionListProps) {
  const t = useTranslations("chat");
  const tc = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<
    ChatSessionListProps["sessions"][number] | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleDeleteRequest(
    session: ChatSessionListProps["sessions"][number]
  ) {
    setSessionToDelete(session);
    setIsDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!sessionToDelete) return;

    setIsDeleting(true);
    const result = await deleteChatSession(sessionToDelete.id);
    setIsDeleting(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("deleteError"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    setIsDeleteDialogOpen(false);
    router.push("/chat");
    router.refresh();
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      >
        {documents && (
          <NewChatDialog documents={documents}>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("newChat")}
            </Button>
          </NewChatDialog>
        )}
      </EmptyState>
    );
  }

  return (
    <>
      <ul className="space-y-1" aria-label={t("conversations")}>
        {sessions.map((session) => (
          <li key={session.id}>
            <div
              className={cn(
                "group flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm hover:-translate-y-0.5",
                session.id === activeSessionId
                  ? "bg-primary/5 border-primary/30"
                  : "border-transparent hover:bg-muted/60"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  session.id === activeSessionId
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
              </div>
              <Link
                href={`/chat/${session.id}`}
                className="flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                aria-current={session.id === activeSessionId ? "true" : undefined}
              >
                <p className="font-medium truncate text-sm">{session.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("messages", { count: session._count.messages })}
                  {session.sourceDocument && ` · ${session.sourceDocument.title}`}
                </p>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100"
                aria-label={t("deleteSessionAria", { title: session.title })}
                onClick={() => handleDeleteRequest(session)}
              >
                <Trash2
                  className="h-4 w-4 text-muted-foreground hover:text-destructive"
                  aria-hidden="true"
                />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={t("deleteDialogTitle")}
        description={
          sessionToDelete
            ? t("deleteDialogDescription", { title: sessionToDelete.title })
            : t("deleteDialogDescriptionFallback")
        }
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        variant="destructive"
        isPending={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
