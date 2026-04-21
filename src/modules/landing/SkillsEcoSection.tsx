"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { fadeUp } from "@/lib/motion";

export function SkillsEcoSection() {
  const { t } = useI18n();
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
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="card-glow bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col"
          >
            {/* Icon placeholder */}
            <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-white/10 flex items-center justify-center mb-4 text-2xl">
              {card.icon}
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-3">{card.title}</h3>
            <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-5 flex-1">
              {card.desc}
            </p>
            <a
              href="#"
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
