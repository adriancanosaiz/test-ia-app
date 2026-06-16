"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField, AccessibleSelectTrigger } from "@/components/ui/select-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { SubjectForm } from "./subject-form";
import { deleteSubject } from "../actions";
import {
  GraduationCap,
  FileText,
  Pencil,
  Trash2,
  Search,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowDown01,
  ArrowUp01,
} from "lucide-react";

interface SubjectListProps {
  folderId: string;
  subjects: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { documents: number };
  }[];
}

type SortOption =
  | "name-asc"
  | "name-desc"
  | "created-desc"
  | "created-asc"
  | "updated-desc"
  | "updated-asc";

export function SubjectList({ folderId, subjects }: SubjectListProps) {
  const t = useTranslations("subjects");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<
    SubjectListProps["subjects"][number] | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated-desc");

  const filteredSubjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = subjects;
    if (query.length > 0) {
      result = result.filter(
        (subject) =>
          subject.name.toLowerCase().includes(query) ||
          (subject.description &&
            subject.description.toLowerCase().includes(query))
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
  }, [subjects, searchQuery, sortBy]);

  function handleDeleteRequest(subject: SubjectListProps["subjects"][number]) {
    setSubjectToDelete(subject);
    setIsDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!subjectToDelete) return;

    setIsDeleting(true);
    const result = await deleteSubject(subjectToDelete.id);
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

  if (subjects.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title={t("emptyStateTitle")}
        description={t("emptyStateDescription")}
      >
        <SubjectForm folderId={folderId}>
          <Button className="gap-2">
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            {t("emptyStateCta")}
          </Button>
        </SubjectForm>
      </EmptyState>
    );
  }

  const isSearchEmpty =
    filteredSubjects.length === 0 && searchQuery.trim().length > 0;

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
      {filteredSubjects.map((subject) => (
        <li key={subject.id}>
          <Card className="group overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 h-full animate-fade-in">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <GraduationCap className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <CardTitle as="h2" className="text-lg truncate">
                    <Link
                      href={`/subjects/${subject.id}`}
                      className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    >
                      {subject.name}
                    </Link>
                  </CardTitle>
                  {subject.description && (
                    <CardDescription className="line-clamp-1">
                      {subject.description}
                    </CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <FileText className="h-4 w-4" aria-hidden="true" />
                <span>
                  {t("documentCount", { count: subject._count.documents })}
                </span>
              </div>
              <div className="flex gap-2">
                <SubjectForm folderId={folderId} subject={subject}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    aria-label={t("editAriaLabel", { name: subject.name })}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    {tCommon("edit")}
                  </Button>
                </SubjectForm>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1"
                  aria-label={t("deleteAriaLabel", { name: subject.name })}
                  onClick={() => handleDeleteRequest(subject)}
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
        subjectToDelete
          ? t("confirmDeleteDescription", { name: subjectToDelete.name })
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
