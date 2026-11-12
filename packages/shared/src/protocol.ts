import { MAX_MESSAGE_LENGTH } from "./constants.js";

export interface JoinOptions {
  accessToken: string;
}

export interface MoveInput {
  x: number;
  z: number;
  yaw: number;
  seq?: number;
}

export interface ChatPayload {
  text: string;
}

export interface ChatEvent {
  kind: "chat" | "system";
  from: string;
  text: string;
  at: number;
}

export interface PointOfInterest {
  id: string;
  label: string;
  x: number;
  z: number;
}

export function sanitizeChat(raw: unknown): ChatPayload | null {
  const value = (raw ?? {}) as Partial<ChatPayload>;
  if (typeof value.text !== "string") {
    return null;
  }
  const text = value.text.trim().slice(0, MAX_MESSAGE_LENGTH);
  return text.length > 0 ? { text } : null;
}
