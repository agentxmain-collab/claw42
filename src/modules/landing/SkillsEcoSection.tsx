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
const ECO_HREFS = [
  URLS.CLAW42_SKILLS_REPO_CONTRACT,
  URLS.CLAW42_SKILLS_REPO_SPOT,
] as const;
const ECO_CARD_IDS = ["contract", "spot"] as const;

export function SkillsEcoSection() {
  const { t, locale } = useI18n();
  const cards = t.skillsEco.cards;
  const prefersReducedMotion = useReducedMotion();

  const sectionVariants = prefersReducedMotion
    ? { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true, amount: 0.2 }, transition: { duration: 0.6 } }
    : fadeUp;

  const cardVariants = (i: number) =>
    prefersReducedMotion
      ? { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, transition: { duration: 0.6, delay: i * 0.08 } }
      : { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.6, ease: "easeOut", delay: i * 0.08 } };

  return (
    <motion.section
      {...sectionVariants}
      className="relative py-16 md:py-20 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto"
    >
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white">
          {t.skillsEco.title}
        </h2>
        <p className="text-gray-400 text-base md:text-lg max-w-3xl mx-auto leading-relaxed">
          {t.skillsEco.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            {...cardVariants(i)}
            whileHover={prefersReducedMotion ? undefined : { y: -8, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="card-glow bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col"
          >
            <div className="w-14 h-14 rounded-xl bg-[#1a1a1a] border border-white/10 flex items-center justify-center mb-4 overflow-hidden">
              <Image
                src={`/images/icons/${ECO_ICON_SLUGS[i] ?? ECO_ICON_SLUGS[0]}.png`}
                alt=""
                aria-hidden="true"
                width={48}
                height={48}
                className="w-10 h-10 object-contain"
              />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-3">{card.title}</h3>
            <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-5 flex-1">
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
              className="text-[#d1ff55] text-sm font-semibold hover:brightness-110 transition-colors self-start"
            >
              {card.cta} →
            </a>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
