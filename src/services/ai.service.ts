// src\services\ai.service.ts

import { api } from "./api";
import { ENDPOINTS } from "./endpoints";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  reply?: string;
  error?: string;
};

export const AIService = {
  sendMessage(messages: ChatMessage[]) {
    return api<ChatResponse>(ENDPOINTS.AI.CHAT, {
      method: "POST",
      body: JSON.stringify({ messages }),
    });
  },
};