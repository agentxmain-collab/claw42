"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { URLS } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";
import { fadeUp } from "@/lib/motion";

// 按卡片位置绑定品牌图标：0 → eco-contract（合约）, 1 → eco-spot（现货）
// card.icon 字段保留在 i18n dict 中以避免 breaking change，但此处改用 PNG 图标而非 emoji
const ECO_ICON_SLUGS = ["eco-contract", "eco-spot"] as const;
const ECO_HREFS = [URLS.CLAW42_SKILLS_REPO_CONTRACT, URLS.CLAW42_SKILLS_REPO_SPOT] as const;
const ECO_CARD_IDS = ["contract", "spot"] as const;

export function SkillsEcoSection() {
  const { t, locale } = useI18n();
  const cards = t.skillsEco.cards;
  const prefersReducedMotion = useReducedMotion();

  const sectionVariants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        whileInView: { opacity: 1 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.6 },
      }
    : fadeUp;

  const cardVariants = (i: number) =>
    prefersReducedMotion
      ? {
          initial: { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport: { once: true },
          transition: { duration: 0.6, delay: i * 0.08 },
        }
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true },
          transition: { duration: 0.6, ease: "easeOut", delay: i * 0.08 },
        };

  return (
    <motion.section
      {...sectionVariants}
      className="relative mx-auto max-w-7xl px-6 py-16 md:px-12 md:py-20 lg:px-20"
    >
      <div className="mb-10 text-center">
        <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl lg:text-5xl">
          {t.skillsEco.title}
        </h2>
        <p className="mx-auto max-w-3xl text-base leading-relaxed text-gray-400 md:text-lg">
          {t.skillsEco.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            {...cardVariants(i)}
            whileHover={prefersReducedMotion ? undefined : { y: -8, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="card-glow flex flex-col rounded-2xl border border-white/10 bg-[#111] p-6 md:p-8"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a]">
              <Image
                src={`/images/icons/${ECO_ICON_SLUGS[i] ?? ECO_ICON_SLUGS[0]}.png`}
                alt=""
                aria-hidden="true"
                width={48}
                height={48}
                className="h-10 w-10 object-contain"
              />
            </div>
            <h3 className="mb-3 text-xl font-bold text-white md:text-2xl">{card.title}</h3>
            <p className="mb-5 flex-1 text-sm leading-relaxed text-gray-400 md:text-base">
              {card.desc}
            </p>
            <a
              href={ECO_HREFS[i] ?? URLS.CLAW42_SKILLS_REPO}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackEvent("skill_card_click", {
                  card_id: ECO_CARD_IDS[i] ?? "unknown",
                  locale,
                  skill: card.title,
                  index: i,
                })
              }
              className="self-start text-sm font-semibold text-[#d1ff55] transition-colors hover:brightness-110"
            >
              {card.cta} →
            </a>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
