import { z } from "zod";
import { createSessionSchema } from "./schemas";

export type CreateSessionData = z.infer<typeof createSessionSchema>;

export interface ChatSource {
  documentId: string;
  documentTitle: string;
  subjectName: string;
  similarity: number;
  pageNumber?: number | null;
}
