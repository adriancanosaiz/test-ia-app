import { registerJobRunner } from "./runner";
import { processDocumentJobRunner } from "@/modules/documents/job";
import { generateTestJobRunner } from "@/modules/tests/job";
import { generateSummaryJobRunner } from "@/modules/summaries/job";
import { generateChatResponseJobRunner } from "@/modules/chat/job";

registerJobRunner("document", processDocumentJobRunner);
registerJobRunner("test", generateTestJobRunner);
registerJobRunner("summary", generateSummaryJobRunner);
registerJobRunner("chat", generateChatResponseJobRunner);

export async function initializeJobs(): Promise<void> {
  const { resumePendingJobs } = await import("./runner");
  await resumePendingJobs();
}
