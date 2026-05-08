export type MetricPropertyValue = string | number | boolean | null | undefined;
export type MetricProperties = Record<string, MetricPropertyValue>;

export interface MetricRecord {
  name: string;
  properties: MetricProperties;
  timestamp: string;
  value?: number;
}

export interface MetricSink {
  emit(name: string, properties?: MetricProperties, value?: number): void;
}

function shouldWriteDevMetrics(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_ENV === "preview"
  );
}

function shouldWarnOnMetricError(): boolean {
  return process.env.NODE_ENV === "development";
}

function buildMetricRecord(
  name: string,
  properties: MetricProperties = {},
  value?: number
): MetricRecord {
  return {
    name,
    properties,
    timestamp: new Date().toISOString(),
    ...(value === undefined ? {} : { value }),
  };
}

export const metricSink: MetricSink = {
  emit(name, properties = {}, value) {
    try {
      if (!shouldWriteDevMetrics()) return;

      const record = buildMetricRecord(name, properties, value);

      void import("./dev-jsonl-sink")
        .then(({ appendDevMetric }) => appendDevMetric(record))
        .catch((error: unknown) => {
          if (shouldWarnOnMetricError()) {
            console.warn("metricSink.emit failed", error);
          }
        });
    } catch (error) {
      if (shouldWarnOnMetricError()) {
        console.warn("metricSink.emit failed", error);
      }
    }
  },
};
