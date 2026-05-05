export type FearGreedData = {
  value: number;
  classification: string;
  classificationZh: string;
};

const FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=1&format=json";

const CLASSIFICATION_ZH: Record<string, string> = {
  "Extreme Fear": "极度恐慌",
  Fear: "恐慌",
  Neutral: "中性",
  Greed: "贪婪",
  "Extreme Greed": "极度贪婪",
};

export async function fetchFearGreed(): Promise<FearGreedData | null> {
  try {
    const response = await fetch(FEAR_GREED_URL, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) throw new Error(`fear-greed ${response.status}`);

    const payload = (await response.json()) as {
      data?: Array<{
        value?: string;
        value_classification?: string;
      }>;
    };
    const item = payload.data?.[0];
    const value = Number(item?.value);
    const classification = item?.value_classification?.trim() || "Neutral";

    if (!Number.isFinite(value)) return null;

    return {
      value,
      classification,
      classificationZh: CLASSIFICATION_ZH[classification] ?? classification,
    };
  } catch (error) {
    console.warn("[fearGreed] fetch failed", error instanceof Error ? error.message : error);
    return null;
  }
}
