// Validates and trims what the browser sends to /api/church-chat.

import {
  CHURCH_CHAT_MAX_MESSAGE_CHARS,
  CHURCH_CHAT_MAX_TURNS,
  type ChurchChatRequest,
  type ChurchChatTurn,
} from "./types";

export function parseChurchChatRequest(body: unknown): ChurchChatRequest | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.messages)) return null;

  const turns: ChurchChatTurn[] = [];
  for (const raw of record.messages.slice(-CHURCH_CHAT_MAX_TURNS)) {
    if (!raw || typeof raw !== "object") return null;
    const { role, text } = raw as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof text !== "string") return null;
    const trimmed = text.trim().slice(0, CHURCH_CHAT_MAX_MESSAGE_CHARS);
    if (!trimmed) return null;
    turns.push({ role, text: trimmed });
  }
  while (turns.length > 0 && turns[0].role !== "user") turns.shift();
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") return null;

  let location: ChurchChatRequest["location"] = null;
  const loc = record.location as Record<string, unknown> | null | undefined;
  if (loc && typeof loc === "object") {
    const latitude = Number(loc.latitude);
    const longitude = Number(loc.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      // Two decimals (~1 km) is all the search needs; never keep more.
      location = { latitude: Math.round(latitude * 100) / 100, longitude: Math.round(longitude * 100) / 100 };
    }
  }

  return { messages: turns, location };
}
