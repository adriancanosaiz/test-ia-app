import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getFolders } from "@/modules/folders/actions";
import { FolderForm } from "@/modules/folders/components/folder-form";
import { FolderList } from "@/modules/folders/components/folder-list";
import { getStats } from "@/lib/stats";
import { SsrErrorState } from "@/components/ssr-error-state";
import {
  Folder,
  FileText,
  FlaskConical,
  MessageSquare,
  Plus,
  Rocket,
  CheckCircle2,
  Upload,
  BrainCircuit,
  ArrowRight,
} from "lucide-react";

interface StatItem {
  label: string;
  value: React.ReactNode;
  description: string;
  icon: typeof Folder;
  iconColor: string;
  href?: string;
}

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatScore(score: number | null, locale: string): string {
  if (score === null) return "—";
  return score.toLocaleString(locale, {
    maximumFractionDigits: 1,
  });
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tNav = await getTranslations("navigation");
  const locale = await getLocale();

  let folders;
  let stats;

  try {
    [folders, stats] = await Promise.all([getFolders(), getStats()]);
  } catch {
    return <SsrErrorState />;
  }

  const hasFolders = folders.length > 0;
  const hasAttempts = stats.attemptsCount > 0;

  const statItems: StatItem[] = [
    {
      label: t("statFoldersLabel"),
      value: stats.folders,
      description: t("statFoldersDescription"),
      icon: Folder,
      iconColor: "text-primary",
      href: "#folders",
    },
    {
      label: t("statDocumentsLabel"),
      value: `${stats.documentsReady} / ${stats.documents}`,
      description: t("statDocumentsDescription"),
      icon: FileText,
      iconColor: "text-info",
    },
    {
      label: t("statTestsLabel"),
      value: stats.tests,
      description: t("statTestsDescription"),
      icon: FlaskConical,
      iconColor: "text-warning",
      href: "/tests",
    },
    {
      label: t("statScoreLabel"),
      value: hasAttempts ? formatScore(stats.averageScore, locale) : "—",
      description: hasAttempts
        ? t("statScoreDescription", { count: stats.attemptsCount })
        : t("statScoreEmpty"),
      icon: CheckCircle2,
      iconColor: hasAttempts ? "text-success" : "text-muted-foreground",
      href: hasAttempts ? "/tests" : undefined,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tNav("dashboard")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <FolderForm>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t("newFolder")}
          </Button>
        </FolderForm>
      </div>

      {!hasFolders ? (
        <>
          <h2 className="sr-only">{t("onboardingSectionTitle")}</h2>
          <EmptyState
            icon={Rocket}
            title={t("onboardingTitle")}
            description={t("onboardingDescription")}
          >
          <ol className="grid gap-4 sm:grid-cols-3 text-left w-full max-w-3xl">
            <li className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Folder className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-medium">{t("onboardingStep1Title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("onboardingStep1Description")}
              </p>
            </li>
            <li className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-info/10 text-info">
                <Upload className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-medium">{t("onboardingStep2Title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("onboardingStep2Description")}
              </p>
            </li>
            <li className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
                <BrainCircuit className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-medium">{t("onboardingStep3Title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("onboardingStep3Description")}
              </p>
            </li>
          </ol>
          <FolderForm>
            <Button className="mt-6 gap-2">
              <Plus className="h-4 w-4" />
              {t("createFirstFolder")}
            </Button>
          </FolderForm>
        </EmptyState>
      </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statItems.map((item) => (
              <article key={item.label}>
                <Card
                  className={
                    item.href
                      ? "transition-all hover:shadow-md hover:-translate-y-0.5"
                      : undefined
                  }
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle
                      as="h2"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      {item.label}
                    </CardTitle>
                    <item.icon
                      className={`h-4 w-4 ${item.iconColor}`}
                      aria-hidden="true"
                    />
                  </CardHeader>
                  <CardContent>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="block text-3xl font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      >
                        {item.value}
                      </Link>
                    ) : (
                      <span className="text-3xl font-bold">{item.value}</span>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              </article>
            ))}
          </div>

          <section aria-labelledby="activity-heading" className="space-y-4">
            <h2
              id="activity-heading"
              className="text-xl font-semibold tracking-tight"
            >
              {t("recentActivityTitle")}
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle as="h3" className="text-base">
                    {t("recentDocumentsTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.recentDocuments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("recentDocumentsEmpty")}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {stats.recentDocuments.map((document) => (
                        <li key={document.id}>
                          <Link
                            href={`/subjects/${document.subject.id}`}
                            className="group flex items-start justify-between gap-2 rounded-lg p-2 -mx-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {document.title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {document.subject.folder.name} →{" "}
                                {document.subject.name}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(document.createdAt, locale)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle as="h3" className="text-base">
                    {t("recentTestsTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.recentTests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("recentTestsEmpty")}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {stats.recentTests.map((test) => (
                        <li key={test.id}>
                          <Link
                            href={`/tests/${test.id}`}
                            className="group flex items-center justify-between gap-2 rounded-lg p-2 -mx-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {test.title}
                              </p>
                              <StatusBadge status={test.status} />
                            </div>
                            <ArrowRight
                              className="h-4 w-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle as="h3" className="text-base">
                    {t("recentChatsTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.recentChats.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("recentChatsEmpty")}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {stats.recentChats.map((chat) => (
                        <li key={chat.id}>
                          <Link
                            href={`/chat/${chat.id}`}
                            className="group flex items-center justify-between gap-2 rounded-lg p-2 -mx-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {chat.title ?? t("untitledChat")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t("messageCount", { count: chat._count.messages })}
                              </p>
                            </div>
                            <MessageSquare
                              className="h-4 w-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      )}

      <div id="folders" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">{t("foldersSectionTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("foldersCount", { count: folders.length })}
          </p>
        </div>
        <FolderList folders={folders} />
      </div>
    </div>
  );
}
