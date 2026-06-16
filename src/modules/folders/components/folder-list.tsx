"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderForm } from "./folder-form";
import { deleteFolder } from "../actions";
import { Folder, BookOpen, Pencil, Trash2, Search, ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SelectField, AccessibleSelectTrigger } from "@/components/ui/select-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

interface FolderListProps {
  folders: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { documents: number };
  }[];
}

type SortOption = "name-asc" | "name-desc" | "created-desc" | "created-asc" | "updated-desc" | "updated-asc";

export function FolderList({ folders }: FolderListProps) {
  const t = useTranslations("folders");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<
    FolderListProps["folders"][number] | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated-desc");

  const filteredFolders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = folders;
    if (query.length > 0) {
      result = result.filter(
        (folder) =>
          folder.name.toLowerCase().includes(query) ||
          (folder.description &&
            folder.description.toLowerCase().includes(query))
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
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
  }, [folders, searchQuery, sortBy]);

  function handleDeleteRequest(folder: FolderListProps["folders"][number]) {
    setFolderToDelete(folder);
    setIsDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!folderToDelete) return;

    setIsDeleting(true);
    const result = await deleteFolder(folderToDelete.id);
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
    router.refresh();
  }

  if (folders.length === 0) {
    return (
      <EmptyState
        icon={Folder}
        title={t("emptyStateTitle")}
        description={t("emptyStateDescription")}
      >
        <FolderForm>
          <Button className="gap-2">
            <Folder className="h-4 w-4" aria-hidden="true" />
            {t("emptyStateCta")}
          </Button>
        </FolderForm>
      </EmptyState>
    );
  }

  const isSearchEmpty =
    filteredFolders.length === 0 && searchQuery.trim().length > 0;

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
            aria-label={t("searchAriaLabel")}
          />
        </div>
        <SelectField label={t("sortByLabel")} className="sm:w-56">
          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as SortOption)}
          >
            <AccessibleSelectTrigger>
              <SelectValue placeholder={t("sortPlaceholder")} />
            </AccessibleSelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">
                <span className="flex items-center gap-2">
                  <ArrowDownAZ
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  {t("sortNameAsc")}
                </span>
              </SelectItem>
              <SelectItem value="name-desc">
                <span className="flex items-center gap-2">
                  <ArrowUpAZ className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("sortNameDesc")}
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
          title={t("searchEmptyTitle")}
          description={t("searchEmptyDescription", { query: searchQuery.trim() })}
        />
      ) : (
        <ul
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          aria-label={t("listAriaLabel")}
        >
      {filteredFolders.map((folder) => (
        <li key={folder.id}>
          <Card
            className="group overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 h-full border-l-4 animate-fade-in"
            style={{ borderLeftColor: folder.color ?? undefined }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                    style={{
                      backgroundColor: folder.color
                        ? `${folder.color}20`
                        : undefined,
                      color: folder.color ?? undefined,
                    }}
                  >
                    <Folder className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle as="h2" className="text-lg flex items-center gap-2">
                      <Link
                        href={`/folders/${folder.id}`}
                        className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      >
                        {folder.name}
                      </Link>
                    </CardTitle>
                    {folder.description && (
                      <CardDescription className="line-clamp-1">
                        {folder.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                <span>
                  {t("documentCount", { count: folder._count.documents })}
                </span>
              </div>
              <div className="flex gap-2">
                <FolderForm folder={folder}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    aria-label={t("editAriaLabel", { name: folder.name })}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    {tCommon("edit")}
                  </Button>
                </FolderForm>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1"
                  aria-label={t("deleteAriaLabel", { name: folder.name })}
                  onClick={() => handleDeleteRequest(folder)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {tCommon("delete")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
      )}

    <ConfirmDialog
      isOpen={isDeleteDialogOpen}
      onOpenChange={setIsDeleteDialogOpen}
      title={t("confirmDeleteTitle")}
      description={
        folderToDelete
          ? t("confirmDeleteDescription", { name: folderToDelete.name })
          : t("confirmDeleteDescriptionFallback")
      }
      confirmLabel={tCommon("delete")}
      cancelLabel={tCommon("cancel")}
      variant="destructive"
      isPending={isDeleting}
      onConfirm={handleConfirmDelete}
    />
    </>
  );
}
