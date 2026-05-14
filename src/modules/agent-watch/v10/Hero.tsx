import React from "react";
import type { DispatchV10Dict } from "@/i18n/types";
import type { DispatchView } from "../v9/types";
import { Constellation } from "./Constellation";
import { WatchTabs } from "./WatchTabs";

export function Hero({
  dict,
  activeView,
  onViewChange,
}: {
  dict: DispatchV10Dict;
  activeView: DispatchView;
  onViewChange: (view: DispatchView) => void;
}) {
  const accentParts = dict.hero.titleAccent
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  const primaryAccent = accentParts[0] ?? dict.hero.titleAccent;
  const secondaryAccent = accentParts.slice(1).join(" · ");

  return (
    <section className="hero" aria-label={dict.hero.ariaLabel}>
      <div className="hero-left">
        <div className="hero-eyebrow">
          <span className="p" />
          {dict.hero.eyebrow}
        </div>
        <h1 className="hero-title">
          <span className="title-prefix">{dict.hero.titlePrefix}</span>
          <span className="accent accent-stack">
            <span className="accent-line">{primaryAccent}</span>
            {secondaryAccent ? (
              <span className="accent-line accent-line-secondary">{secondaryAccent}</span>
            ) : null}
          </span>
          <span className="title-suffix">{dict.hero.titleSuffix}</span>
        </h1>
        <p
          className="hero-sub"
          dangerouslySetInnerHTML={{
            __html: dict.hero.subtitle,
          }}
        />

        <div className="hero-meta" aria-label={dict.hero.metaAriaLabel}>
          {dict.hero.meta.map((item, index) => (
            <div className="cell" key={item.label}>
              <span
                className={[
                  "v",
                  index === 1 && "lime",
                  index === 2 && "purple",
                  index === 3 && "lime",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {item.value}
              </span>
              <span className="k">{item.label}</span>
            </div>
          ))}
        </div>

        <WatchTabs
          activeView={activeView}
          onViewChange={onViewChange}
          flowLabel={dict.tabs.flow}
          marketLabel={dict.tabs.market}
          liveLabel={dict.tabs.live}
        />
      </div>

      <Constellation dict={dict} active={activeView === "flow"} />
    </section>
  );
}
