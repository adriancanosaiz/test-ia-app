"use server";

import { ActionResult } from "@/lib/errors";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import {
  getIndexedDocuments as getIndexedDocumentsQuery,
  getDocumentsBySubject as getDocumentsBySubjectQuery,
  getDocument as getDocumentQuery,
} from "./queries";
import {
  uploadDocument as uploadDocumentMutation,
  processDocument as processDocumentMutation,
  cancelDocumentProcessing as cancelDocumentProcessingMutation,
  updateDocumentTitle as updateDocumentTitleMutation,
  deleteDocument as deleteDocumentMutation,
} from "./mutations";

export async function getIndexedDocuments() {
  return getIndexedDocumentsQuery();
}

export async function getDocumentsBySubject(subjectId: string) {
  return getDocumentsBySubjectQuery(subjectId);
}

export async function getDocument(id: string) {
  return getDocumentQuery(id);
}

export async function uploadDocument(
  formData: FormData
): Promise<ActionResult<{ id: string; title: string; mimeType: string; status: string }>> {
  const ip = await getClientIp();
  const limit = checkRateLimit(
    ip,
    "uploadDocument",
    RATE_LIMITS.uploadDocument.windowMs,
    RATE_LIMITS.uploadDocument.maxRequests
  );

  if (!limit.success) {
    return limit;
  }

  return uploadDocumentMutation(formData);
}

export async function processDocument(documentId: string) {
  return processDocumentMutation(documentId);
}

export async function cancelDocumentProcessing(documentId: string) {
  return cancelDocumentProcessingMutation(documentId);
}

export async function updateDocumentTitle(id: string, title: string) {
  return updateDocumentTitleMutation(id, title);
}

export async function deleteDocument(id: string) {
  return deleteDocumentMutation(id);
}
