export function parseLlmJsonObject(
  text: string,
  invalidMessage = "LLM provider returned invalid JSON response",
): Record<string, unknown> {
  const direct = tryParseObject(text.trim());
  if (direct) return direct;

  const withoutThinking = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const stripped = tryParseObject(withoutThinking);
  if (stripped) return stripped;

  const extracted = extractFirstJsonObject(withoutThinking) ?? extractFirstJsonObject(text);
  if (extracted) {
    const parsed = tryParseObject(extracted);
    if (parsed) return parsed;
  }

  throw new Error(invalidMessage);
}

function tryParseObject(text: string) {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as unknown;
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function extractFirstJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
