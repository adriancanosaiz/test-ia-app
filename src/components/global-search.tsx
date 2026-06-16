"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Folder, GraduationCap, FileText, FlaskConical, MessageSquare, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchItem, SearchItemType } from "@/lib/search";

interface GlobalSearchProps {
  items: SearchItem[];
}

type TabValue = SearchItemType | "all";

const typeConfig: Record<
  SearchItemType,
  { labelKey: string; icon: typeof Folder }
> = {
  folder: { labelKey: "folders", icon: Folder },
  subject: { labelKey: "subjects", icon: GraduationCap },
  document: { labelKey: "documents", icon: FileText },
  test: { labelKey: "tests", icon: FlaskConical },
  chat: { labelKey: "chat", icon: MessageSquare },
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function GlobalSearch({ items }: GlobalSearchProps) {
  const router = useRouter();
  const t = useTranslations("navigation");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      const timeoutId = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timeoutId);
    }
  }, [open]);

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setQuery("");
      setActiveTab("all");
    }
  }

  const normalizedQuery = normalize(query.trim());

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeTab !== "all") {
      result = result.filter((item) => item.type === activeTab);
    }
    if (normalizedQuery.length > 0) {
      result = result.filter(
        (item) =>
          normalize(item.title).includes(normalizedQuery) ||
          (item.subtitle && normalize(item.subtitle).includes(normalizedQuery))
      );
    }
    return result;
  }, [items, activeTab, normalizedQuery]);

  const groupedItems = useMemo(() => {
    const groups: Record<SearchItemType, SearchItem[]> = {
      folder: [],
      subject: [],
      document: [],
      test: [],
      chat: [],
    };
    for (const item of filteredItems) {
      groups[item.type].push(item);
    }
    return groups;
  }, [filteredItems]);

  const totalCount = filteredItems.length;
  const hasResults = totalCount > 0;

  function handleSelect(item: SearchItem) {
    setOpen(false);
    router.push(item.href);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2 text-muted-foreground"
          aria-label={t("openGlobalSearch")}
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{tc("search")}</span>
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
            <Command className="h-3 w-3" aria-hidden="true" />
            <span>K</span>
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg gap-0 p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("globalSearch")}</DialogTitle>
          <DialogDescription>
            {t("globalSearchDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("globalSearchPlaceholder")}
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            aria-label={t("searchTerm")}
            aria-controls="search-results"
          />
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
          <div className="border-b px-2">
            <TabsList className="w-full justify-start rounded-none bg-transparent p-0 h-9">
              <TabsTrigger value="all">{t("all")}</TabsTrigger>
              {(Object.keys(typeConfig) as SearchItemType[]).map((type) => {
                const { labelKey } = typeConfig[type];
                return (
                  <TabsTrigger key={type} value={type}>
                    {t(labelKey)}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div
            id="search-results"
            role="status"
            aria-live="polite"
            aria-atomic="false"
            className="max-h-[60vh] overflow-y-auto p-2"
          >
            <TabsContent value={activeTab} className="mt-0 focus-visible:ring-0">
              {!hasResults ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {normalizedQuery.length > 0
                    ? t("noResultsFor", { query: query.trim() })
                    : t("startTyping")}
                </div>
              ) : (
                <div className="space-y-4">
                  {(Object.keys(groupedItems) as SearchItemType[]).map((type) => {
                    const group = groupedItems[type];
                    if (group.length === 0) return null;
                    const { labelKey, icon: Icon } = typeConfig[type];
                    const groupLabel = t(labelKey);
                    return (
                      <section key={type} aria-label={groupLabel}>
                        <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {groupLabel}
                        </h3>
                        <ul className="space-y-0.5">
                          {group.map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => handleSelect(item)}
                                className={cn(
                                  "w-full flex items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                )}
                              >
                                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{item.title}</p>
                                  {item.subtitle && (
                                    <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                                  )}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                  <p className="sr-only">{t("resultsFound", { count: totalCount })}</p>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex items-center justify-between border-t bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">↵</kbd>
            <span>{t("toNavigate")}</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">Esc</kbd>
            <span>{t("toClose")}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
