import React from "react";
import styles from "./HistoryWall.module.css";

export function IntensityHeatMap({ values, ariaLabel }: { values: number[]; ariaLabel: string }) {
  const width = Math.max(values.length * 14, 42);
  const height = 28;
  return (
    <svg
      className={styles.heatMap}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {values.map((value, index) => {
        const clamped = Math.max(0, Math.min(100, value));
        const barHeight = Math.max(4, (clamped / 100) * (height - 4));
        return (
          <rect
            key={`${value}-${index}`}
            x={index * 14}
            y={height - barHeight}
            width="9"
            height={barHeight}
            rx="3"
            fill={`rgba(209, 255, 85, ${0.22 + (clamped / 100) * 0.58})`}
          />
        );
      })}
    </svg>
  );
}
