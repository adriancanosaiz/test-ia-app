"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import {
  deleteDocument,
  processDocument,
  cancelDocumentProcessing,
  updateDocumentTitle,
} from "../actions";
import { generateSummary } from "@/modules/summaries/actions";
import { DocumentStatus } from "@prisma/client";
import {
  FileText,
  File,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  Trash2,
  RefreshCw,
  Play,
  Pencil,
  ScrollText,
  X,
  Search,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowDown01,
  ArrowUp01,
} from "lucide-react";
import { SelectField, AccessibleSelectTrigger } from "@/components/ui/select-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface DocumentItem {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  status: DocumentStatus;
  errorMessage: string | null;
  chunkCount: number;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

type StatusFilter = "ALL" | DocumentStatus;
type SortOption =
  | "title-asc"
  | "title-desc"
  | "created-desc"
  | "created-asc"
  | "updated-desc"
  | "updated-asc";



interface DocumentListProps {
  documents: DocumentItem[];
}

const statusConfig: Record<
  DocumentStatus,
  {
    icon: typeof Clock;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  PENDING: { icon: Clock, variant: "secondary" },
  PROCESSING: { icon: Loader2, variant: "default" },
  READY: { icon: CheckCircle2, variant: "default" },
  ERROR: { icon: AlertCircle, variant: "destructive" },
};

function getStatusLabel(status: DocumentStatus, t: (key: string) => string) {
  switch (status) {
    case "PENDING":
      return t("statusPending");
    case "PROCESSING":
      return t("statusProcessing");
    case "READY":
      return t("statusReady");
    case "ERROR":
      return t("statusError");
  }
}

function getStatusFilterLabel(
  status: StatusFilter,
  t: (key: string) => string
) {
  if (status === "ALL") return t("statusAll");
  return getStatusLabel(status, t);
}

function DocumentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "application/pdf") {
    return <FileText className="h-6 w-6 text-red-500" aria-hidden="true" />;
  }
  if (mimeType === "text/markdown") {
    return <FileText className="h-6 w-6 text-blue-500" aria-hidden="true" />;
  }
  return <File className="h-6 w-6 text-primary" aria-hidden="true" />;
}

function DocumentListItem({ initialDoc }: { initialDoc: DocumentItem }) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [localDoc, setLocalDoc] = useState<DocumentItem>(initialDoc);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(initialDoc.title);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const sseCleanupRef = useRef<() => void>(() => {});

  const doc = useMemo<DocumentItem>(() => {
    if (localDoc.status !== "PENDING") {
      return localDoc;
    }
    return initialDoc;
  }, [initialDoc, localDoc]);

  useEffect(() => {
    if (doc.status !== "PROCESSING") return;

    let eventSource: EventSource | null = null;
    let retryCount = 0;
    let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const maxRetries = 5;
    const baseDelay = 1000;
    let isCancelled = false;

    function cleanup() {
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
      eventSource?.close();
      eventSource = null;
    }

    function isServerErrorEvent(event: Event): event is MessageEvent {
      return (
        event instanceof MessageEvent &&
        typeof event.data === "string" &&
        event.data.trim().length > 0
      );
    }

    function connect() {
      if (isCancelled) return;

      eventSource = new EventSource(`/api/documents/${doc.id}/progress`);

      eventSource.addEventListener("progress", (event) => {
        try {
          const data = JSON.parse(event.data) as {
            status: DocumentStatus;
            progress: number;
            errorMessage: string | null;
          };

          setLocalDoc((prev) => ({ ...prev, ...data }));
          retryCount = 0;

          if (data.status === "READY" || data.status === "ERROR") {
            cleanup();
            router.refresh();
          }
        } catch {
          // Ignorar eventos malformados
        }
      });

      eventSource.addEventListener("complete", () => {
        cleanup();
        router.refresh();
      });

      eventSource.addEventListener("error", (event) => {
        if (isServerErrorEvent(event)) {
          try {
            const data = JSON.parse(event.data) as {
              message: string;
              code?: string;
            };
            if (typeof data.message === "string") {
              setLocalDoc((prev) => ({
                ...prev,
                status: "ERROR",
                errorMessage: data.message,
              }));
              cleanup();
              return;
            }
          } catch {
            // Error malformado: tratar como error de transporte.
          }
        }

        cleanup();
        if (isCancelled) return;

        if (retryCount < maxRetries) {
          const delay = Math.min(baseDelay * 2 ** retryCount, 30000);
          retryCount++;
          reconnectTimeoutId = setTimeout(connect, delay);
        } else {
          setLocalDoc((prev) => ({
            ...prev,
            status: "ERROR",
            errorMessage: t("processingConnectionLost"),
          }));
        }
      });
    }

    sseCleanupRef.current = () => {
      isCancelled = true;
      cleanup();
    };

    connect();

    return cleanup;
  }, [doc.id, doc.status, router, t]);

  useEffect(() => {
    if (isEditing) {
      titleInputRef.current?.focus();
    }
  }, [isEditing]);

  async function handleProcess(id: string) {
    const result = await processDocument(id);

    if (!result.success) {
      toast({
        title: t("toastProcessError"),
        description: getErrorMessage(result.error),
        variant: "destructive",
      });
      return;
    }

    setLocalDoc((prev) => ({
      ...prev,
      status: "PROCESSING",
      progress: 0,
      errorMessage: null,
    }));
    router.refresh();
    toast({
      title: t("toastProcessStarted"),
      description: t("toastProcessStartedDescription"),
      variant: "success",
    });
  }

  async function handleGenerateSummary(id: string, title: string) {
    const result = await generateSummary(id);
    if (!result.success) {
      toast({
        title: t("toastSummaryError"),
        description: getErrorMessage(result.error),
        variant: "destructive",
      });
      return;
    }
    toast({
      title: t("toastSummaryStarted"),
      description: t("toastSummaryStartedDescription", { title }),
      variant: "success",
    });
    router.push(`/documents/${id}/summaries`);
  }

  function handleDeleteRequest(document: DocumentItem) {
    setDocToDelete(document);
    setIsDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!docToDelete) return;

    setIsDeleting(true);
    const result = await deleteDocument(docToDelete.id);
    setIsDeleting(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("toastDeleteError"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    setIsDeleteDialogOpen(false);
    router.refresh();
  }

  function startEditing() {
    cancelRef.current = false;
    setEditTitle(doc.title);
    setIsEditing(true);
  }

  function cancelEditing() {
    cancelRef.current = true;
    setEditTitle(doc.title);
    setIsEditing(false);
  }

  async function saveTitle() {
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }

    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === doc.title) {
      cancelEditing();
      return;
    }

    setIsSavingTitle(true);
    const result = await updateDocumentTitle(doc.id, trimmed);
    setIsSavingTitle(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("toastSaveError"),
        description: getErrorMessage(result.error),
      });
      setEditTitle(doc.title);
      setIsEditing(false);
      return;
    }

    setLocalDoc((prev) => ({ ...prev, title: result.data.title }));
    setIsEditing(false);
    router.refresh();
  }

  function handleTitleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveTitle();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  }

  const status = statusConfig[doc.status];
  const StatusIcon = status.icon;

  return (
    <li key={doc.id}>
      <Card className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-in">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
              <DocumentIcon mimeType={doc.mimeType} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  {isEditing ? (
                    <Input
                      ref={titleInputRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => void saveTitle()}
                      onKeyDown={handleTitleKeyDown}
                      disabled={isSavingTitle}
                      aria-label={t("editTitleAriaLabel")}
                      className="h-8"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">
                        {doc.title}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={startEditing}
                        aria-label={t("editTitleOfAriaLabel", { title: doc.title })}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {doc.fileName} ·{" "}
                    {new Intl.DateTimeFormat(locale, {
                      day: "numeric",
                      month: "short",
                    }).format(new Date(doc.createdAt))}
                  </p>
                </div>
                <Badge
                  variant={status.variant}
                  className={cn(
                    "shrink-0 gap-1.5",
                    doc.status === "PROCESSING" && "animate-pulse"
                  )}
                >
                  <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {getStatusLabel(doc.status, t)}
                  {doc.status === "READY" && ` · ${t("chunkCount", { count: doc.chunkCount })}`}
                </Badge>
              </div>

              {doc.status === "PROCESSING" && (
                <div className="mt-3 space-y-2">
                  <Progress
                    value={doc.progress}
                    max={100}
                    label={t("processingProgress", { progress: doc.progress })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    aria-label={t("cancelProcessingAriaLabel", { title: doc.title })}
                    onClick={async () => {
                      sseCleanupRef.current();
                      const result = await cancelDocumentProcessing(doc.id);
                      if (!result.success) {
                        toast({
                          variant: "destructive",
                          title: t("toastDeleteError"),
                          description: getErrorMessage(result.error),
                        });
                        return;
                      }
                      setLocalDoc((prev) => ({
                        ...prev,
                        status: "ERROR",
                        errorMessage: t("processingCancelled"),
                      }));
                    }}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    {tc("cancel")}
                  </Button>
                </div>
              )}

              {doc.status === "ERROR" && doc.errorMessage && (
                <p
                  role="alert"
                  className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-2 rounded-md"
                >
                  {doc.errorMessage}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {doc.status === "PENDING" && (
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => handleProcess(doc.id)}
                    aria-label={t("processAriaLabel", { title: doc.title })}
                  >
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("process")}
                  </Button>
                )}
                {doc.status === "ERROR" && (
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => handleProcess(doc.id)}
                    aria-label={t("retryProcessAriaLabel", { title: doc.title })}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("retry")}
                  </Button>
                )}
                {doc.status === "READY" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1"
                    aria-label={t("generateSummaryAriaLabel", { title: doc.title })}
                    onClick={() => handleGenerateSummary(doc.id, doc.title)}
                  >
                    <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("generateSummary")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1"
                  aria-label={t("deleteDocumentAriaLabel", { title: doc.title })}
                  onClick={() => handleDeleteRequest(doc)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {tc("delete")}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={t("deleteDocumentTitle")}
        description={
          docToDelete
            ? t("deleteDocumentDescription", { title: docToDelete.title })
            : t("deleteDocumentDescriptionFallback")
        }
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        variant="destructive"
        isPending={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </li>
  );
}

export function DocumentList({ documents }: DocumentListProps) {
  const t = useTranslations("documents");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("updated-desc");

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = documents;

    if (query.length > 0) {
      result = result.filter(
        (doc) =>
          doc.title.toLowerCase().includes(query) ||
          doc.fileName.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "ALL") {
      result = result.filter((doc) => doc.status === statusFilter);
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        case "created-asc":
          return a.createdAt.getTime() - b.createdAt.getTime();
        case "created-desc":
          return b.createdAt.getTime() - a.createdAt.getTime();
        case "updated-asc":
          return a.updatedAt.getTime() - b.updatedAt.getTime();
        case "updated-desc":
        default:
          return b.updatedAt.getTime() - a.updatedAt.getTime();
      }
    });

    return result;
  }, [documents, searchQuery, statusFilter, sortBy]);

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={t("documentListEmptyTitle")}
        description={t("documentListEmptyDescription")}
      />
    );
  }

  const isSearchEmpty =
    filteredDocuments.length === 0 &&
    (searchQuery.trim().length > 0 || statusFilter !== "ALL");

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchDocuments")}
            className="pl-9"
            aria-label={t("searchDocumentsAriaLabel")}
          />
        </div>
        <SelectField label={t("status")} className="lg:w-48">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <AccessibleSelectTrigger>
              <SelectValue placeholder={t("filterByStatus")} />
            </AccessibleSelectTrigger>
            <SelectContent>
              {(["ALL", ...Object.keys(statusConfig)] as StatusFilter[]).map(
                (status) => (
                  <SelectItem key={status} value={status}>
                    {getStatusFilterLabel(status, t)}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </SelectField>
        <SelectField label={t("sortBy")} className="lg:w-56">
          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as SortOption)}
          >
            <AccessibleSelectTrigger>
              <SelectValue placeholder={t("sortBy")} />
            </AccessibleSelectTrigger>
            <SelectContent>
              <SelectItem value="title-asc">
                <span className="flex items-center gap-2">
                  <ArrowDownAZ
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  {t("sortTitleAsc")}
                </span>
              </SelectItem>
              <SelectItem value="title-desc">
                <span className="flex items-center gap-2">
                  <ArrowUpAZ className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("sortTitleDesc")}
                </span>
              </SelectItem>
              <SelectItem value="created-desc">
                <span className="flex items-center gap-2">
                  <ArrowDown01
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  {t("sortCreatedDesc")}
                </span>
              </SelectItem>
              <SelectItem value="created-asc">
                <span className="flex items-center gap-2">
                  <ArrowUp01 className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("sortCreatedAsc")}
                </span>
              </SelectItem>
              <SelectItem value="updated-desc">
                <span className="flex items-center gap-2">
                  <ArrowDown01
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  {t("sortUpdatedDesc")}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </SelectField>
      </div>

      {isSearchEmpty ? (
        <EmptyState
          icon={Search}
          title={t("documentsNotFound")}
          description={t("documentsNotFoundDescription")}
        />
      ) : (
        <ul className="space-y-3" aria-label={t("documentsListAriaLabel")}>
          {filteredDocuments.map((doc) => (
            <DocumentListItem key={doc.id} initialDoc={doc} />
          ))}
        </ul>
      )}
    </div>
  );
}
