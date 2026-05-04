import type { ClientMessage } from "./types";

const ROOM_ID_RE = /^room_[A-Za-z0-9_-]{3,64}$/;
const PLAYER_ID_RE = /^player_[A-Za-z0-9_-]{1,64}$/;
const ROOM_CAPACITIES = [8, 16, 22, 30] as const;
const PLAYER_ROLES = [
  "villager",
  "werewolf",
  "seer",
  "medium",
  "madman",
  "guard",
  "common",
  "fox"
] as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateRoomId(value: string): string {
  if (!ROOM_ID_RE.test(value)) {
    throw new Error("Invalid room id");
  }
  return value;
}

export function validatePlayerId(value: string): string {
  if (!PLAYER_ID_RE.test(value)) {
    throw new Error("Invalid player id");
  }
  return value;
}

export function validateNickname(value: string): string {
  const nickname = value.trim();
  if (nickname.length === 0) {
    throw new Error("Nickname is required");
  }
  if (nickname.length > 32) {
    throw new Error("Nickname is too long");
  }
  return nickname;
}

export function validateRoomName(value: string): string {
  const roomName = value.trim();
  if (roomName.length === 0) {
    throw new Error("Room name is required");
  }
  if (roomName.length > 48) {
    throw new Error("Room name is too long");
  }
  return roomName;
}

export function validateRoomComment(value: string): string {
  const comment = value.trim();
  if (comment.length > 120) {
    throw new Error("Room comment is too long");
  }
  return comment;
}

export function validateRoomCapacity(value: unknown): number {
  const capacity = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!ROOM_CAPACITIES.some((allowed) => allowed === capacity)) {
    throw new Error("Invalid room capacity");
  }
  return capacity;
}

export function validateWishRole(value: unknown): (typeof PLAYER_ROLES)[number] | undefined {
  if (value === undefined || value === null || value === "" || value === "none") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("Invalid wished role");
  }
  const wishRole = PLAYER_ROLES.find((role) => role === value);
  if (!wishRole) {
    throw new Error("Invalid wished role");
  }
  return wishRole;
}

export function validateChatText(value: string): string {
  const text = value.trim();
  if (text.length === 0) {
    throw new Error("Chat text is required");
  }
  if (text.length > 500) {
    throw new Error("Chat text is too long");
  }
  return text;
}

export function validateLastWordsText(value: string): string {
  const text = value.trim();
  if (text.length === 0) {
    throw new Error("Last words are required");
  }
  if (text.length > 500) {
    throw new Error("Last words are too long");
  }
  return text;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function parseClientMessage(raw: string): ClientMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON");
  }

  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    throw new Error("Invalid message");
  }

  if (parsed.type === "join") {
    if (typeof parsed.playerId !== "string" || typeof parsed.nickname !== "string") {
      throw new Error("Invalid join message");
    }
    return { type: "join", playerId: parsed.playerId, nickname: parsed.nickname, wishRole: validateWishRole(parsed.wishRole) };
  }

  if (parsed.type === "chat") {
    if (typeof parsed.text !== "string") {
      throw new Error("Invalid chat message");
    }
    return { type: "chat", text: parsed.text };
  }

  if (parsed.type === "wolf_chat") {
    if (typeof parsed.text !== "string") {
      throw new Error("Invalid wolf chat message");
    }
    return { type: "wolf_chat", text: parsed.text };
  }

  if (parsed.type === "fox_chat") {
    if (typeof parsed.text !== "string") {
      throw new Error("Invalid fox chat message");
    }
    return { type: "fox_chat", text: parsed.text };
  }

  if (parsed.type === "common_chat") {
    if (typeof parsed.text !== "string") {
      throw new Error("Invalid common chat message");
    }
    return { type: "common_chat", text: parsed.text };
  }

  if (parsed.type === "lovers_chat") {
    if (typeof parsed.text !== "string") {
      throw new Error("Invalid lovers chat message");
    }
    return { type: "lovers_chat", text: parsed.text };
  }

  if (parsed.type === "dead_chat") {
    if (typeof parsed.text !== "string") {
      throw new Error("Invalid dead chat message");
    }
    return { type: "dead_chat", text: parsed.text };
  }

  if (parsed.type === "start_game") {
    return { type: "start_game" };
  }

  if (parsed.type === "vote") {
    if (typeof parsed.targetPlayerId !== "string") {
      throw new Error("Invalid vote message");
    }
    return { type: "vote", targetPlayerId: parsed.targetPlayerId };
  }

  if (parsed.type === "night_kill") {
    if (typeof parsed.targetPlayerId !== "string") {
      throw new Error("Invalid night kill message");
    }
    return { type: "night_kill", targetPlayerId: parsed.targetPlayerId };
  }

  if (parsed.type === "divine") {
    if (typeof parsed.targetPlayerId !== "string") {
      throw new Error("Invalid divine message");
    }
    return { type: "divine", targetPlayerId: parsed.targetPlayerId };
  }

  if (parsed.type === "child_fox_divine") {
    if (typeof parsed.targetPlayerId !== "string") {
      throw new Error("Invalid child fox divine message");
    }
    return { type: "child_fox_divine", targetPlayerId: parsed.targetPlayerId };
  }

  if (parsed.type === "guard") {
    if (typeof parsed.targetPlayerId !== "string") {
      throw new Error("Invalid guard message");
    }
    return { type: "guard", targetPlayerId: parsed.targetPlayerId };
  }

  if (parsed.type === "cat_revive") {
    if (typeof parsed.targetPlayerId !== "string") {
      throw new Error("Invalid cat revive message");
    }
    return { type: "cat_revive", targetPlayerId: parsed.targetPlayerId };
  }

  if (parsed.type === "set_last_words") {
    if (typeof parsed.text !== "string") {
      throw new Error("Invalid last words message");
    }
    return { type: "set_last_words", text: parsed.text };
  }

  throw new Error("Unknown message type");
}
