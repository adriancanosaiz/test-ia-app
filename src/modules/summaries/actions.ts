"use server";

import {
  getSummariesByDocument as getSummariesByDocumentQuery,
  getSummary as getSummaryQuery,
} from "./queries";
import {
  generateSummary as generateSummaryMutation,
  cancelSummaryGeneration as cancelSummaryGenerationMutation,
  retrySummary as retrySummaryMutation,
  deleteSummary as deleteSummaryMutation,
} from "./mutations";

export async function getSummariesByDocument(documentId: string) {
  return getSummariesByDocumentQuery(documentId);
}

export async function getSummary(id: string) {
  return getSummaryQuery(id);
}

export async function generateSummary(documentId: string) {
  return generateSummaryMutation(documentId);
}

export async function cancelSummaryGeneration(id: string) {
  return cancelSummaryGenerationMutation(id);
}

export async function retrySummary(id: string) {
  return retrySummaryMutation(id);
}

export async function deleteSummary(id: string) {
  return deleteSummaryMutation(id);
}
