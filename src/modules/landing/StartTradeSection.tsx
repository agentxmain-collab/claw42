"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { fadeUp, motionViewport } from "@/lib/motion";

const STEP_ICON_SRCS = [
  "/images/icons/step-key.png",
  "/images/icons/step-authorize.png",
  "/images/icons/step-launch.png",
] as const;

export function StartTradeSection() {
  const { t } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const sectionVariants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        whileInView: { opacity: 1 },
        viewport: motionViewport,
        transition: { duration: 0.6 },
      }
    : fadeUp;

  const cardVariants = (index: number) =>
    prefersReducedMotion
      ? {
          initial: { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport: motionViewport,
          transition: { duration: 0.5, delay: index * 0.08 },
        }
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: motionViewport,
          transition: { duration: 0.55, ease: "easeOut", delay: index * 0.08 },
        };

  return (
    <motion.section
      {...sectionVariants}
      className="relative mx-auto max-w-7xl px-6 py-16 md:px-12 md:py-20 lg:px-20"
    >
      <div className="relative">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <div className="max-w-2xl">
            <h2 className="mb-4 text-3xl font-bold text-fg-primary md:text-4xl lg:text-5xl">
              {t.startTrade.title}
            </h2>
            <p className="text-base leading-relaxed text-fg-secondary md:text-lg">
              {t.startTrade.subtitle}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {t.startTrade.cards.map((card, index) => (
            <motion.div
              key={card.step}
              {...cardVariants(index)}
              whileHover={prefersReducedMotion ? undefined : { y: -8, scale: 1.01 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              className="card-glow relative min-h-[196px] overflow-hidden rounded-card border border-border-token-primary bg-bg-fill-card1 p-6 md:p-8"
            >
              <div className="relative mb-5 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-panel border border-border-token-primary bg-bg-fill-card2 text-sm font-bold text-fg-primary">
                  {card.step}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={STEP_ICON_SRCS[index] ?? STEP_ICON_SRCS[0]}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="pointer-events-none h-10 w-10 select-none object-contain"
                />
              </div>

              <h3 className="relative mb-3 text-xl font-bold text-fg-primary md:text-2xl">
                {card.title}
              </h3>
              <p className="relative text-sm leading-relaxed text-fg-secondary md:text-base">
                {card.desc}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-brand-purple-bright/20 bg-brand-purple-bright/15 px-4 py-2 text-fg-secondary md:flex-nowrap">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-purple-bright/20 text-xs text-fg-primary">
              i
            </span>
            <span className="text-xs leading-relaxed md:text-sm">{t.startTrade.helper}</span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
