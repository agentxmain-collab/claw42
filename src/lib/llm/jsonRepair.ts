export function parseJsonObjectWithRepair(text: string): Record<string, unknown> {
  const source = extractObjectSource(text);
  for (const candidate of candidateJsonObjects(source)) {
    try {
      return assertJsonObject(JSON.parse(candidate));
    } catch {
      // Try the next increasingly conservative repair candidate.
    }
  }
  return assertJsonObject(JSON.parse(source));
}

function extractObjectSource(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const firstBrace = trimmed.indexOf("{");
  if (firstBrace < 0) return trimmed;
  const lastBrace = trimmed.lastIndexOf("}");
  return lastBrace > firstBrace
    ? trimmed.slice(firstBrace, lastBrace + 1)
    : trimmed.slice(firstBrace);
}

function candidateJsonObjects(source: string) {
  const trimmed = source.trim();
  return [
    trimmed,
    balanceJsonObject(trimmed),
    trimToLastCompletePair(trimmed),
    balanceJsonObject(trimToLastCompletePair(trimmed)),
  ].filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
}

function balanceJsonObject(source: string) {
  let output = source.trim().replace(/,\s*$/g, "");
  let inString = false;
  let escaped = false;
  let objectDepth = 0;
  let arrayDepth = 0;

  for (const char of output) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") objectDepth += 1;
    if (char === "}") objectDepth = Math.max(0, objectDepth - 1);
    if (char === "[") arrayDepth += 1;
    if (char === "]") arrayDepth = Math.max(0, arrayDepth - 1);
  }

  if (escaped) output = output.slice(0, -1);
  if (inString) output += '"';
  while (arrayDepth > 0) {
    output += "]";
    arrayDepth -= 1;
  }
  while (objectDepth > 0) {
    output += "}";
    objectDepth -= 1;
  }
  return output.replace(/,\s*([}\]])/g, "$1");
}

function trimToLastCompletePair(source: string) {
  const lastComma = source.lastIndexOf(",");
  if (lastComma < 0) return source;
  return source.slice(0, lastComma);
}

function assertJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("LLM output must be a JSON object");
  }
  return value as Record<string, unknown>;
}
