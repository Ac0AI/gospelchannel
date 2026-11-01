// Decides whether the search box received a question for the church chat or a
// plain lookup (a place or a church name) that the directory search handles
// faster. Real queries from 2026-08..10 were almost all lookups: "toronto",
// "Simi valley, ca", "37918", "Kings church Frodsham". Those must keep going to
// /church?q=. Sentences and fit requests ("English church in Madrid with kids
// ministry") go to the chat.

const QUESTION_START =
  /^(what|which|where|when|how|who|why|is|are|can|could|do|does|should|would|will|find|show|recommend|suggest|looking|i'?m|i am|i want|i need|i'd|we'?re|we are|we want|help|any|tell|vad|var|hur|finns|kan|jag|vilken|vilka|wo|was|gibt|quel|quelle|où|dónde|donde|qué|busco|cuál|cual|onde|qual)\b/i;

// Words that describe fit or intent and rarely appear in church names.
const FIT_WORDS =
  /\b(english|spanish|german|french|portuguese|korean|chinese|speaking|contemporary|traditional|modern|charismatic|kids|children|family|families|young adults?|students?|expats?|near me|nearby|close to me|first visit|first time|service times?|this sunday|today|tonight|tomorrow|with|that|for|near|where)\b/i;

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

export function isConversationalQuery(raw: string): boolean {
  const query = raw.trim();
  if (query.length < 3) return false;
  if (query.includes("?")) return true;
  if (QUESTION_START.test(query)) return true;

  const words = wordCount(query);
  if (words >= 5) return true;
  if (words >= 3 && FIT_WORDS.test(query)) return true;
  return false;
}

export function wantsNearbyChurches(raw: string): boolean {
  return /\b(near me|nearby|close to me|around me|near here)\b/i.test(raw);
}
