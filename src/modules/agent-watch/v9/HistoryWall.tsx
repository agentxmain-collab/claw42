import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import type { DecisionOutcome } from "@/lib/team/strategyDecisionRecord";
import type { DecisionHistoryItem } from "@/lib/watch/decisionHistory";
import { IntensityHeatMap } from "./IntensityHeatMap";
import styles from "./HistoryWall.module.css";

export interface HistoryWallDict {
  wall_title: string;
  outcome_label: string;
  expand: string;
  collapse: string;
  close_aria: string;
  more: string;
  empty: string;
  loading: string;
  error: string;
  symbols_label: string;
  heatmap_label: string;
  intensity: string;
  confidence: string;
  entry: string;
  stop_loss: string;
  take_profit: string;
  pending: string;
  hit_tp: string;
  hit_sl: string;
  expired: string;
  manual_close: string;
}

export type HistoryWallItem = DecisionHistoryItem;

export function HistoryWall({
  open,
  symbols,
  selectedSymbol,
  locale,
  dict,
  items,
  hasMore,
  loading,
  error,
  onOpen,
  onClose,
  onMore,
  onSelectSymbol,
}: {
  open: boolean;
  symbols: string[];
  selectedSymbol: string | null;
  locale: string;
  dict: HistoryWallDict;
  items: HistoryWallItem[];
  hasMore: boolean;
  loading: boolean;
  error?: string | null;
  onOpen?: () => void;
  onClose: () => void;
  onMore: () => void;
  onSelectSymbol: (symbol: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return (
      <button className={styles.launcher} type="button" onClick={onOpen}>
        {dict.expand}
      </button>
    );
  }

  const heatValues = items
    .map((item) => item.intensity)
    .slice(0, 24)
    .reverse();

  const overlay = (
    <aside className={styles.overlay} aria-label={dict.wall_title}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>{selectedSymbol ?? "--"}</p>
            <h2>{dict.wall_title}</h2>
          </div>
          <button
            className={styles.close}
            type="button"
            onClick={onClose}
            aria-label={dict.close_aria}
          >
            <span aria-hidden="true">×</span>
            <span className={styles.closeText}>{dict.collapse}</span>
          </button>
        </header>

        {symbols.length > 0 ? (
          <div className={styles.symbols} aria-label={dict.symbols_label}>
            {symbols.map((symbol) => (
              <button
                key={symbol}
                className={symbol === selectedSymbol ? styles.symbolActive : styles.symbol}
                type="button"
                onClick={() => onSelectSymbol(symbol)}
              >
                {symbol}
              </button>
            ))}
          </div>
        ) : null}

        {heatValues.length > 0 ? (
          <IntensityHeatMap values={heatValues} ariaLabel={dict.heatmap_label} />
        ) : null}

        <div className={styles.list}>
          {items.map((item) => (
            <article className={styles.item} key={item.recordId}>
              <div className={styles.itemTop}>
                <span className={styles.direction}>{item.direction}</span>
                <span className={styles.time}>{formatDateTime(item.createdAt, locale)}</span>
              </div>
              <div className={styles.outcome}>
                <span>{dict.outcome_label}</span>
                <strong>{formatOutcome(item.outcome, dict)}</strong>
              </div>
              <div className={styles.metrics}>
                <span>
                  {dict.intensity} {item.intensity}
                </span>
                <span>
                  {dict.confidence} {Math.round(item.confidence * 100)}%
                </span>
              </div>
              <div className={styles.trade}>
                <span>
                  {dict.entry} {item.entry}
                </span>
                <span>
                  {dict.stop_loss} {item.stopLoss}
                </span>
                <span>
                  {dict.take_profit} {item.takeProfit}
                </span>
              </div>
            </article>
          ))}
        </div>

        {loading ? <p className={styles.state}>{dict.loading}</p> : null}
        {error ? <p className={styles.state}>{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className={styles.state}>{dict.empty}</p>
        ) : null}

        {hasMore ? (
          <button className={styles.more} type="button" onClick={onMore} disabled={loading}>
            {dict.more}
          </button>
        ) : null}
      </div>
    </aside>
  );

  return typeof document === "undefined" ? overlay : createPortal(overlay, document.body);
}

function formatOutcome(outcome: DecisionOutcome, dict: HistoryWallDict) {
  if (!outcome) return dict.pending;
  return dict[outcome];
}

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale.replace("_", "-"), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
