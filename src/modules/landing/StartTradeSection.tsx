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
      className="relative py-16 md:py-20 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto"
    >
      <div className="relative">
        <div className="flex flex-col items-center text-center gap-4 mb-10">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              {t.startTrade.title}
            </h2>
            <p className="text-gray-400 text-base md:text-lg leading-relaxed">
              {t.startTrade.subtitle}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {t.startTrade.cards.map((card, index) => (
            <motion.div
              key={card.step}
              {...cardVariants(index)}
              whileHover={prefersReducedMotion ? undefined : { y: -8, scale: 1.01 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              className="card-glow relative rounded-2xl border border-white/10 bg-[#111] p-6 md:p-8 min-h-[196px] overflow-hidden"
            >
              <div className="relative mb-5 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/8 text-white text-sm font-bold border border-white/10">
                  {card.step}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={STEP_ICON_SRCS[index] ?? STEP_ICON_SRCS[0]}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="h-10 w-10 object-contain select-none pointer-events-none"
                />
              </div>

              <h3 className="relative text-xl md:text-2xl font-bold text-white mb-3">
                {card.title}
              </h3>
              <p className="relative text-gray-400 text-sm md:text-base leading-relaxed">
                {card.desc}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <div className="inline-flex max-w-full flex-wrap md:flex-nowrap items-center justify-center gap-2 rounded-full bg-[#7c5cff]/14 border border-[#7c5cff]/20 px-4 py-2 text-[#d4ccff] shadow-[0_12px_30px_rgba(124,92,255,0.12)]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7c5cff]/20 text-[#b49cff] text-xs shrink-0">
              i
            </span>
            <span className="text-xs md:text-sm leading-relaxed">
              {t.startTrade.helper}
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
