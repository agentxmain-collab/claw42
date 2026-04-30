type HeroSpeechMessage = {
  content?: string;
};

type HeroSpeechResponse = {
  content?: string;
};

type HeroSpeechEntry = {
  kind?: string;
  content?: string;
  triggerSignalId?: string;
  primaryResponse?: HeroSpeechResponse;
  echoResponses?: HeroSpeechResponse[];
  responses?: HeroSpeechResponse[];
};

type HeroSpeechPayload = {
  source?: string;
  stream?: HeroSpeechMessage[];
  streamEntries?: HeroSpeechEntry[];
};

export function cleanRobotAnalysisLine(content: string): string {
  const cleaned = content
    .replace(/\s+/g, " ")
    .replace(/^(触发|失效|趋势|动作|极端|边界)[：:]\s*/g, "")
    .trim();
  const [firstClause] = cleaned.split(/[。；;]/);
  const line = (firstClause || cleaned).trim();
  return Array.from(line).slice(0, 42).join("");
}

function uniqueUsableLines(lines: string[]): string[] {
  return Array.from(
    new Set(
      lines
        .map(cleanRobotAnalysisLine)
        .filter((line) => line.length >= 8),
    ),
  );
}

function signalBackedEntryLines(entry: HeroSpeechEntry): string[] {
  if (entry.kind === "agent_message" && entry.triggerSignalId && entry.content) {
    return [entry.content];
  }

  if (entry.kind === "collective_event") {
    return [entry.primaryResponse, ...(entry.echoResponses ?? [])]
      .map((response) => response?.content)
      .filter((content): content is string => Boolean(content));
  }

  if (entry.kind === "focus_event") {
    return entry.primaryResponse?.content ? [entry.primaryResponse.content] : [];
  }

  if (entry.kind === "conflict_event") {
    return (entry.responses ?? [])
      .map((response) => response.content)
      .filter((content): content is string => Boolean(content));
  }

  return [];
}

export function buildHeroSpeechLines(
  data: HeroSpeechPayload | null | undefined,
  isZh: boolean,
): string[] | undefined {
  if (!isZh || !data) return undefined;

  const signalBackedLines = uniqueUsableLines(
    (data.streamEntries ?? []).flatMap(signalBackedEntryLines),
  );
  if (signalBackedLines.length > 0) return signalBackedLines;

  if (data.source === "static-fallback") return undefined;

  const streamLines = uniqueUsableLines((data.stream ?? []).map((message) => message.content ?? ""));
  return streamLines.length > 0 ? streamLines : undefined;
}
