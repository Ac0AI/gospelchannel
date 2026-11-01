// Shared between the /api/church-chat route and the client panel. Church facts
// on cards come from the directory, never from model text.

export type ChurchChatTurn = {
  role: "user" | "assistant";
  text: string;
};

export type ChurchChatCard = {
  slug: string;
  name: string;
  href: string;
  place: string | null;
  denomination: string | null;
  styles: string[];
  language: string | null;
  serviceTime: string | null;
  distanceKm: number | null;
};

export type ChurchChatGuide = {
  key: string;
  title: string;
  href: string;
};

export type ChurchChatAnswer = {
  reply: string;
  churches: ChurchChatCard[];
  guide: ChurchChatGuide | null;
  // Where to continue with a normal directory search when the answer is thin.
  searchHref: string | null;
};

export type ChurchChatRequest = {
  messages: ChurchChatTurn[];
  location?: { latitude: number; longitude: number } | null;
};

export const CHURCH_CHAT_MAX_MESSAGE_CHARS = 400;
export const CHURCH_CHAT_MAX_TURNS = 6;
