"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { fadeUp, motionViewport } from "@/lib/motion";

const STEP_ICON_SLUGS = ["step-key", "step-authorize", "step-launch"] as const;

function UserChipIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0"
      />
    </svg>
  );
}

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
      className="relative py-14 md:py-20 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto"
    >
      <div className="rounded-[28px] border border-white/8 bg-[#111111] px-5 py-6 md:px-8 md:py-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-4 mb-8">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-white/80">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7c5cff]/20 text-[#b49cff]">
              <UserChipIcon />
            </span>
            <span className="text-sm md:text-[15px] font-semibold tracking-[0.01em]">
              {t.startTrade.eyebrow}
            </span>
          </div>

          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              {t.startTrade.title}
            </h2>
            <p className="text-gray-400 text-base md:text-lg leading-relaxed">
              {t.startTrade.subtitle}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {t.startTrade.cards.map((card, index) => (
            <motion.div
              key={card.step}
              {...cardVariants(index)}
              whileHover={prefersReducedMotion ? undefined : { y: -4 }}
              className="relative rounded-2xl border border-white/8 bg-[#171717] p-5 md:p-6 min-h-[196px] overflow-hidden"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,92,255,0.16),transparent_38%)] pointer-events-none" />

              <div className="relative flex items-start justify-between gap-4 mb-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-white text-sm font-bold border border-white/10">
                  {card.step}
                </span>
                <div className="h-11 w-11 rounded-xl bg-[#1b1b1b] border border-white/8 flex items-center justify-center shrink-0">
                  <Image
                    src={`/images/icons/${STEP_ICON_SLUGS[index] ?? STEP_ICON_SLUGS[0]}.png`}
                    alt=""
                    aria-hidden="true"
                    width={40}
                    height={40}
                    className="w-8 h-8 object-contain"
                  />
                </div>
              </div>

              <h3 className="relative text-xl font-bold text-white mb-3">{card.title}</h3>
              <p className="relative text-sm md:text-[15px] text-gray-400 leading-relaxed">
                {card.desc}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 md:mt-7">
          <div className="inline-flex max-w-full flex-wrap md:flex-nowrap items-center gap-2 rounded-full bg-[#7c5cff]/14 border border-[#7c5cff]/20 px-4 py-2 text-[#d4ccff]">
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
