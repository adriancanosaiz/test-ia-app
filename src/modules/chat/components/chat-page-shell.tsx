"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ChatSessionList } from "./chat-session-list";
import { NewChatDialog } from "./new-chat-dialog";
import { ArrowLeft, MessageSquare, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatPageShellProps {
  session: {
    id: string;
    title: string | null;
    sourceDocument: { title: string } | null;
  };
  sessions: {
    id: string;
    title: string;
    sourceDocument: { title: string } | null;
    _count: { messages: number };
    updatedAt: Date;
  }[];
  documents: {
    id: string;
    title: string;
    subject: {
      name: string;
      folder: { name: string };
    };
  }[];
  children: React.ReactNode;
}

export function ChatPageShell({
  session,
  sessions,
  documents,
  children,
}: ChatPageShellProps) {
  const t = useTranslations("chat");
  const tc = useTranslations("common");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100dvh-8rem)] relative">
      <aside
        className={cn(
          "flex-col gap-4 overflow-hidden absolute inset-0 z-20 bg-background md:static md:bg-transparent md:flex md:col-span-4 lg:col-span-3",
          sidebarOpen ? "flex" : "hidden md:flex"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="md:hidden gap-1"
            aria-label={t("closeSidebar")}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
            {tc("close")}
          </Button>
          <Link href="/chat" className="hidden md:inline-flex">
            <Button variant="outline" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {tc("back")}
            </Button>
          </Link>
          <NewChatDialog documents={documents}>
            <Button size="sm" className="gap-1">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              {t("newChatShort")}
            </Button>
          </NewChatDialog>
        </div>
        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          <ChatSessionList
            sessions={sessions.map((s) => ({
              ...s,
              title: s.title ?? t("untitled"),
            }))}
            activeSessionId={session.id}
            documents={documents}
          />
        </div>
      </aside>

      <main className="md:col-span-8 lg:col-span-9 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="md:hidden gap-1"
            aria-label={t("openSidebar")}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
            {t("conversations")}
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {session.title ?? t("untitled")}
            </h1>
            {session.sourceDocument && (
              <p className="text-sm text-muted-foreground">
                {t("filteredBy", { title: session.sourceDocument.title })}
              </p>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0">{children}</div>
      </main>
    </div>
  );
}
