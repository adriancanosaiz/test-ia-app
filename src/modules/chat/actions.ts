"use server";

import { ActionResult, createUserError } from "@/lib/errors";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { detectPromptInjection } from "@/lib/prompt-guard";
import {
  getChatSessions as getChatSessionsQuery,
  getChatSession as getChatSessionQuery,
} from "./queries";
import {
  createChatSession as createChatSessionMutation,
  deleteChatSession as deleteChatSessionMutation,
  addUserMessage as addUserMessageMutation,
  addAssistantMessage as addAssistantMessageMutation,
  startChatResponse as startChatResponseMutation,
  cancelChatResponse as cancelChatResponseMutation,
  regenerateChatResponse as regenerateChatResponseMutation,
} from "./mutations";
import type { CreateSessionData } from "./types";

export async function getChatSessions() {
  return getChatSessionsQuery();
}

export async function getChatSession(id: string) {
  return getChatSessionQuery(id);
}

export async function createChatSession(data: CreateSessionData) {
  return createChatSessionMutation(data);
}

export async function deleteChatSession(id: string) {
  return deleteChatSessionMutation(id);
}

export async function addUserMessage(
  sessionId: string | null,
  question: string,
  sourceDocumentId?: string
): Promise<ActionResult<{ sessionId: string; sourceDocumentId: string | null }>> {
  if (detectPromptInjection(question)) {
    return {
      success: false,
      error: createUserError(
        "Se ha detectado un intento de manipulación del asistente. Revisa tu mensaje.",
        "PROMPT_INJECTION"
      ),
    };
  }

  const ip = await getClientIp();
  const limit = checkRateLimit(
    ip,
    "addUserMessage",
    RATE_LIMITS.addUserMessage.windowMs,
    RATE_LIMITS.addUserMessage.maxRequests
  );

  if (!limit.success) {
    return limit;
  }

  return addUserMessageMutation(sessionId, question, sourceDocumentId);
}

export async function addAssistantMessage(
  sessionId: string,
  content: string,
  sources?: unknown
) {
  return addAssistantMessageMutation(sessionId, content, sources);
}

export async function startChatResponse(sessionId: string) {
  return startChatResponseMutation(sessionId);
}

export async function cancelChatResponse(
  sessionId: string,
  assistantMessageId: string
) {
  return cancelChatResponseMutation(sessionId, assistantMessageId);
}

export async function regenerateChatResponse(
  sessionId: string,
  assistantMessageId: string
) {
  return regenerateChatResponseMutation(sessionId, assistantMessageId);
}
