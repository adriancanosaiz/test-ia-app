"use server";

import { ActionResult, createUserError } from "@/lib/errors";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { detectPromptInjection } from "@/lib/prompt-guard";
import {
  getSourceName as getSourceNameQuery,
  getScopeOptions as getScopeOptionsQuery,
  getTests as getTestsQuery,
  getTest as getTestQuery,
  getAttempts as getAttemptsQuery,
  getAttempt as getAttemptQuery,
} from "./queries";
import {
  createTest as createTestMutation,
  retryGenerateTest as retryGenerateTestMutation,
  cancelTestGeneration as cancelTestGenerationMutation,
  deleteTest as deleteTestMutation,
  createAttempt as createAttemptMutation,
  gradeShortAnswer as gradeShortAnswerMutation,
} from "./mutations";
import type { CreateTestData } from "./types";
import type { UserAnswer } from "./scoring";

export async function getSourceName(
  sourceType: "FOLDER" | "SUBJECT" | "DOCUMENT",
  sourceId: string
) {
  return getSourceNameQuery(sourceType, sourceId);
}

export async function getScopeOptions(
  sourceType: "FOLDER" | "SUBJECT" | "DOCUMENT"
) {
  return getScopeOptionsQuery(sourceType);
}

export async function getTests() {
  return getTestsQuery();
}

export async function getTest(id: string) {
  return getTestQuery(id);
}

export async function getAttempts(testId: string) {
  return getAttemptsQuery(testId);
}

export async function getAttempt(id: string) {
  return getAttemptQuery(id);
}

export async function createTest(
  data: CreateTestData
): Promise<ActionResult<{ id: string; status: string; progress: number }>> {
  if (detectPromptInjection(data.title ?? "")) {
    return {
      success: false,
      error: createUserError(
        "Se ha detectado un intento de manipulación en el título. Revisa el texto.",
        "PROMPT_INJECTION"
      ),
    };
  }

  const ip = await getClientIp();
  const limit = checkRateLimit(
    ip,
    "createTest",
    RATE_LIMITS.createTest.windowMs,
    RATE_LIMITS.createTest.maxRequests
  );

  if (!limit.success) {
    return limit;
  }

  return createTestMutation(data);
}

export async function retryGenerateTest(id: string) {
  return retryGenerateTestMutation(id);
}

export async function cancelTestGeneration(id: string) {
  return cancelTestGenerationMutation(id);
}

export async function deleteTest(id: string) {
  return deleteTestMutation(id);
}

export async function createAttempt(testId: string, answers: UserAnswer[]) {
  return createAttemptMutation(testId, answers);
}

export async function gradeShortAnswer(data: {
  attemptId: string;
  answerId: string;
  isCorrect: boolean;
}) {
  return gradeShortAnswerMutation(data);
}
