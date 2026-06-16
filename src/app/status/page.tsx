import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { ollamaProvider } from "@/modules/ai/ollama";
import { validateOllamaModels } from "@/modules/ai/ollama";
import { validateEmbeddingDimensions, getEmbeddingDimensions } from "@/modules/ai/provider";
import { OllamaStatusChecker } from "./components/ollama-status-checker";

export default async function StatusPage() {
  const t = await getTranslations("status");
  const tc = await getTranslations("common");
  let dbStatus = "error";
  let ollamaStatus = "error";
  let models: string[] = [];
  let counts = {
    folders: 0,
    subjects: 0,
    documents: 0,
    chunks: 0,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  try {
    const healthy = await ollamaProvider.chat.health();
    ollamaStatus = healthy ? "ok" : "error";

    if (healthy) {
      const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/tags`);
      const data = (await response.json()) as { models?: { name: string }[] };
      models = data.models?.map((m) => m.name) ?? [];
    }
  } catch {
    ollamaStatus = "error";
  }

  try {
    const [folders, subjects, documents, chunks] = await Promise.all([
      prisma.folder.count(),
      prisma.subject.count(),
      prisma.document.count(),
      prisma.chunk.count(),
    ]);
    counts = { folders, subjects, documents, chunks };
  } catch {
    // ignore
  }

  const [modelsResult, dimensionsResult] = await Promise.all([
    validateOllamaModels(),
    validateEmbeddingDimensions(),
  ]);

  const initialStatus = {
    models:
      modelsResult.success && modelsResult.data
        ? modelsResult.data
        : {
            chatAvailable: false,
            embeddingAvailable: false,
            availableModels: models,
          },
    dimensions: {
      configured: getEmbeddingDimensions(),
      expected: 768,
      valid: dimensionsResult.success,
    },
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("database")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                dbStatus === "ok" ? "text-green-600" : "text-red-600"
              }`}
            >
              {dbStatus === "ok" ? t("connected") : tc("error")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("ollama")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                ollamaStatus === "ok" ? "text-green-600" : "text-red-600"
              }`}
            >
              {ollamaStatus === "ok" ? t("available") : t("unavailable")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("models")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {models.length === 0 ? (
                <li className="text-muted-foreground">{t("none")}</li>
              ) : (
                models.map((model) => <li key={model}>{model}</li>)
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("content")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>{t("folders", { count: counts.folders })}</li>
              <li>{t("subjects", { count: counts.subjects })}</li>
              <li>{t("documents", { count: counts.documents })}</li>
              <li>{t("chunks", { count: counts.chunks })}</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {t("requiredModels")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OllamaStatusChecker initial={initialStatus} />
        </CardContent>
      </Card>
    </div>
  );
}
