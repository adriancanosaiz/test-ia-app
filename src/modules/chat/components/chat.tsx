"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  addUserMessage,
  startChatResponse,
  cancelChatResponse,
  regenerateChatResponse,
} from "../actions";
import type { ChatMessage as ChatMessageType } from "@prisma/client";
import type { ChatSource } from "../types";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import {
  Send,
  Loader2,
  Bot,
  User,
  AlertCircle,
  Copy,
  Check,
  RotateCcw,
  Square,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

interface ChatProps {
  sessionId: string;
  initialMessages: ChatMessageType[];
  sourceDocumentId?: string | null;
  hasIndexedDocuments?: boolean;
}

const SUGGESTION_KEYS = [
  "suggestionSummary",
  "suggestionQuestion",
  "suggestionExplain",
] as const;

function getSources(message: ChatMessageType): ChatSource[] {
  return Array.isArray(message.sources)
    ? (message.sources as unknown as ChatSource[])
    : [];
}

function linkCitations(
  content: string,
  messageId: string,
  sourceCount: number
): string {
  return content.replace(/\[(\d+)\]/g, (match, num) => {
    const index = Number.parseInt(num, 10);
    if (Number.isNaN(index) || index < 1 || index > sourceCount) {
      return match;
    }
    return `[${index}](#source-${messageId}-${index})`;
  });
}

const AutoResizeTextarea = forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<typeof Textarea>
>(function AutoResizeTextarea({ value, onChange, ...props }, ref) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight, value]);

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        adjustHeight();
      }}
      rows={1}
      {...props}
    />
  );
});

function SourcesList({
  sources,
  messageId,
}: {
  sources: ChatSource[];
  messageId: string;
}) {
  const t = useTranslations("chat");

  return (
    <details className="mt-3 rounded-lg border bg-muted/30">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50">
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        {t("sources", { count: sources.length })}
      </summary>
      <ul className="space-y-2 px-3 pb-3 pt-1">
        {sources.map((source, index) => {
          const number = index + 1;
          return (
            <li
              key={index}
              id={`source-${messageId}-${number}`}
              className="text-xs"
            >
              <span className="font-medium text-foreground">
                {t("sourceItem", {
                  number,
                  documentTitle: source.documentTitle,
                  subjectName: source.subjectName,
                  similarity: (source.similarity * 100).toFixed(0),
                })}
              </span>
              {source.pageNumber ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {t("pageLabel", { pageNumber: source.pageNumber })}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function Chat({
  sessionId,
  initialMessages,
  sourceDocumentId,
  hasIndexedDocuments = false,
}: ChatProps) {
  const t = useTranslations("chat");
  const tc = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [messages, setMessages] =
    useState<ChatMessageType[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const processingMessage = messages.find(
    (message) =>
      message.role === "assistant" && message.status === "PROCESSING"
  );
  const processingMessageId = processingMessage?.id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!processingMessageId) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      return;
    }

    eventSourceRef.current?.close();

    const eventSource = new EventSource(
      `/api/chat/${sessionId}/progress?messageId=${processingMessageId}`
    );
    eventSourceRef.current = eventSource;

    function closeEventSource(): void {
      eventSource.close();
      eventSourceRef.current = null;
    }

    function updateMessage(
      data: Partial<Pick<ChatMessageType, "content" | "status" | "sources">>
    ): void {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === processingMessageId ? { ...message, ...data } : message
        )
      );
    }

    eventSource.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as {
          id: string;
          content: string;
          status: string | null;
          sources: unknown;
        };

        updateMessage({
          content: data.content,
          status: data.status,
          sources: data.sources as ChatMessageType["sources"],
        });

        if (data.status === "READY" || data.status === "ERROR") {
          closeEventSource();
          router.refresh();
        }
      } catch {
        // Ignore malformed events.
      }
    });

    eventSource.addEventListener("complete", () => {
      closeEventSource();
      router.refresh();
    });

    eventSource.addEventListener("error", (event) => {
      if (event instanceof MessageEvent && typeof event.data === "string") {
        try {
          const data = JSON.parse(event.data) as { message: string; code?: string };
          if (typeof data.message === "string") {
            updateMessage({ status: "ERROR", content: data.message });
          }
        } catch {
          // Ignore malformed error events.
        }
      }
      closeEventSource();
      router.refresh();
    });

    eventSource.onerror = () => {
      closeEventSource();
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [processingMessageId, sessionId, router]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const question = input.trim();
    if (!question || isLoading || processingMessage) return;

    setInput("");
    setError(null);
    setIsLoading(true);

    const userMessageResult = await addUserMessage(
      sessionId,
      question,
      sourceDocumentId ?? undefined
    );

    if (!userMessageResult.success) {
      setError(getErrorMessage(userMessageResult.error));
      setIsLoading(false);
      textareaRef.current?.focus();
      return;
    }

    const currentSessionId = userMessageResult.data.sessionId;

    const userMessage: ChatMessageType = {
      id: `temp-${Date.now()}`,
      sessionId: currentSessionId,
      role: "user",
      content: question,
      status: null,
      sources: null,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const result = await startChatResponse(currentSessionId);

      if (!result.success) {
        setError(getErrorMessage(result.error));
        return;
      }

      const assistantMessage: ChatMessageType = {
        id: result.data.assistantMessageId,
        sessionId: currentSessionId,
        role: "assistant",
        content: "",
        status: "PROCESSING",
        sources: null,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }

  async function handleCancel() {
    if (!processingMessage) return;

    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    const result = await cancelChatResponse(sessionId, processingMessage.id);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("cancelError"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.id === processingMessage.id
          ? {
              ...message,
              content: t("generationCancelled"),
              status: "ERROR",
            }
          : message
      )
    );
  }

  async function handleRegenerate(messageId: string) {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? { ...message, content: "", status: "PROCESSING", sources: null }
          : message
      )
    );

    const result = await regenerateChatResponse(sessionId, messageId);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("regenerateError"),
        description: getErrorMessage(result.error),
      });
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                status: "ERROR",
                content: t("generationRegenerateFailed"),
              }
            : message
        )
      );
    }
  }

  async function handleCopy(text: string, messageId: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({
        variant: "destructive",
        title: t("copyError"),
        description: t("copyErrorDescription"),
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <section
        ref={scrollContainerRef}
        aria-label={t("messagesAria")}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="flex-1 overflow-y-auto space-y-6 pr-2 scroll-smooth"
      >
        {messages.length === 0 && (
          <EmptyState
            icon={Bot}
            title={t("emptyChatTitle")}
            description={t("emptyChatDescription")}
            className="h-full border-0 bg-transparent"
          >
            {hasIndexedDocuments && (
              <div className="mt-2 w-full max-w-md">
                <p className="text-sm font-medium text-foreground mb-3 flex items-center justify-center gap-2">
                  <Lightbulb
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  {t("suggestionsTitle")}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTION_KEYS.map((key) => {
                    const suggestion = t(key);
                    return (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setInput(suggestion);
                          textareaRef.current?.focus();
                        }}
                        aria-label={t("suggestionAria", { suggestion })}
                      >
                        {suggestion}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </EmptyState>
        )}

        {messages.map((message, index) => {
          const sources = getSources(message);
          const isLatestAssistant =
            message.role === "assistant" && index === messages.length - 1;

          return (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-1"
                  aria-hidden="true"
                >
                  <Bot className="h-4 w-4" aria-hidden="true" />
                </div>
              )}
              <div
                role="article"
                aria-roledescription={t("messageRoleDescription")}
                aria-label={
                  message.role === "user"
                    ? t("yourMessage")
                    : t("assistantMessage")
                }
                className={cn(
                  "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md border",
                  message.role === "assistant" &&
                    message.status === "ERROR" &&
                    "border-red-200 bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-100 dark:border-red-900"
                )}
              >
                {message.role === "user" ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {message.status === "ERROR" ? (
                      <div
                        role="alert"
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-2 rounded-lg border border-red-200 bg-red-100/50 px-3 py-2 dark:bg-red-900/20 dark:border-red-900"
                      >
                        <AlertCircle
                          className="h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="flex-1">
                          {message.content.startsWith(
                            t("generationCancelled")
                          )
                            ? message.content
                            : t("generationFailed")}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRegenerate(message.id)}
                          className="shrink-0"
                        >
                          {tc("retry")}
                        </Button>
                      </div>
                    ) : message.content ? (
                      <ReactMarkdown
                        rehypePlugins={[rehypeSanitize]}
                        components={{
                          h1: "h3",
                          h2: "h3",
                          h3: "h4",
                          h4: "h5",
                          h5: "h6",
                          h6: "p",
                          a: ({
                            href,
                            children,
                            ...props
                          }: React.JSX.IntrinsicElements["a"]) => {
                            if (href?.startsWith("#source-")) {
                              return (
                                <a
                                  href={href}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const id = href.slice(1);
                                    const element =
                                      document.getElementById(id);
                                    element?.scrollIntoView({
                                      behavior: "smooth",
                                      block: "nearest",
                                    });
                                    const details = element?.closest(
                                      "details"
                                    );
                                    if (details) {
                                      details.open = true;
                                    }
                                  }}
                                  className="inline-flex items-center justify-center min-w-[1.25rem] rounded bg-primary/10 px-1 text-xs font-medium text-primary hover:bg-primary/20"
                                  {...props}
                                >
                                  {children}
                                </a>
                              );
                            }
                            return (
                              <a href={href} {...props}>
                                {children}
                              </a>
                            );
                          },
                        }}
                      >
                        {linkCitations(
                          message.content,
                          message.id,
                          sources.length
                        )}
                      </ReactMarkdown>
                    ) : (
                      message.status === "PROCESSING" && (
                        <span className="sr-only">
                          {t("assistantThinking")}
                        </span>
                      )
                    )}
                    {message.status === "PROCESSING" && (
                      <div className="mt-2 flex items-center gap-2 text-muted-foreground">
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                        <span className="text-xs">{t("thinking")}</span>
                      </div>
                    )}
                  </div>
                )}

                {message.role === "assistant" &&
                  message.status !== "PROCESSING" &&
                  message.status !== "ERROR" && (
                    <>
                      {sources.length > 0 && (
                        <SourcesList sources={sources} messageId={message.id} />
                      )}
                      <div className="mt-3 flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={t("copyResponse")}
                          onClick={() => handleCopy(message.content, message.id)}
                        >
                          {copiedId === message.id ? (
                            <Check
                              className="h-3.5 w-3.5 text-green-600"
                              aria-hidden="true"
                            />
                          ) : (
                            <Copy
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          )}
                        </Button>
                        {isLatestAssistant && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={t("regenerateResponse")}
                            onClick={() => handleRegenerate(message.id)}
                          >
                            <RotateCcw
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </Button>
                        )}
                      </div>
                    </>
                  )}
              </div>
              {message.role === "user" && (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground mt-1"
                  aria-hidden="true"
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                </div>
              )}
            </div>
          );
        })}

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-4 py-3 rounded-xl"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </section>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 items-end border rounded-xl p-2 bg-card shadow-sm"
        aria-label={t("sendMessage")}
      >
        <AutoResizeTextarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("writeQuestion")}
          disabled={isLoading || !!processingMessage}
          aria-label={t("writeQuestion")}
          aria-busy={isLoading || !!processingMessage}
          className="border-0 shadow-none focus-visible:ring-0 resize-none min-h-[44px] max-h-[200px]"
        />
        {processingMessage ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={t("cancelGeneration")}
            className="h-10 w-10 shrink-0 rounded-lg"
            onClick={() => handleCancel()}
          >
            <Square className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="icon"
            aria-label={t("sendMessage")}
            className="h-10 w-10 shrink-0 rounded-lg"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        )}
      </form>
    </div>
  );
}
