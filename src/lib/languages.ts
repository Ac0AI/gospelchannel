type LanguageDefinition = {
  label: string;
  aliases: string[];
};

const LANGUAGE_DEFINITIONS: LanguageDefinition[] = [
  { label: "English", aliases: ["en", "eng", "english"] },
  { label: "Spanish", aliases: ["es", "spa", "spanish", "espanol"] },
  { label: "French", aliases: ["fr", "fra", "fre", "french", "francais"] },
  { label: "German", aliases: ["de", "deu", "ger", "german", "deutsch"] },
  { label: "Italian", aliases: ["it", "ita", "italian", "italiano"] },
  { label: "Portuguese", aliases: ["pt", "por", "portuguese", "portugues"] },
  { label: "Swedish", aliases: ["sv", "swe", "swedish", "svenska"] },
  { label: "Norwegian", aliases: ["no", "nor", "norwegian", "norsk"] },
  { label: "Danish", aliases: ["da", "dan", "danish", "dansk"] },
  { label: "Finnish", aliases: ["fi", "fin", "finnish", "suomi"] },
  { label: "Dutch", aliases: ["nl", "nld", "dut", "dutch", "nederlands"] },
  { label: "Korean", aliases: ["ko", "kor", "korean"] },
  { label: "Japanese", aliases: ["ja", "jpn", "japanese"] },
  { label: "Chinese", aliases: ["zh", "zho", "chi", "chinese", "mandarin"] },
  { label: "Arabic", aliases: ["ar", "ara", "arabic"] },
  { label: "Polish", aliases: ["pl", "pol", "polish", "polski"] },
];

function normalizeLanguageValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getLanguageDefinition(value: string): LanguageDefinition | undefined {
  const normalized = normalizeLanguageValue(value);
  return LANGUAGE_DEFINITIONS.find((definition) => (
    normalizeLanguageValue(definition.label) === normalized
    || definition.aliases.includes(normalized)
  ));
}

export function splitLanguageValues(value: string): string[] {
  return value
    .split(/\s*[,;/]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatLanguageLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return getLanguageDefinition(trimmed)?.label
    ?? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}`;
}

export function getLanguageMatchValues(value: string): string[] {
  const definition = getLanguageDefinition(value);
  if (definition) {
    return Array.from(new Set([
      normalizeLanguageValue(definition.label),
      ...definition.aliases,
    ]));
  }
  const normalized = normalizeLanguageValue(value);
  return normalized ? [normalized] : [];
}

export function getKnownLanguageDefinitions(): Array<{ label: string; values: string[] }> {
  return LANGUAGE_DEFINITIONS.map((definition) => ({
    label: definition.label,
    values: Array.from(new Set([
      normalizeLanguageValue(definition.label),
      ...definition.aliases,
    ])),
  }));
}

export function languageValueMatches(value: string, requestedLanguage: string): boolean {
  const accepted = new Set(getLanguageMatchValues(requestedLanguage));
  return splitLanguageValues(value).some((part) => accepted.has(normalizeLanguageValue(part)));
}
