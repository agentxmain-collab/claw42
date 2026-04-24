"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { LOCALES, LOCALE_LABELS } from "@/i18n/locales";
import type { Locale } from "@/i18n/types";
import { trackEvent } from "@/lib/analytics";

export function LocaleDropdown() {
  const { locale, switchLocale } = useI18n();
  const reduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [activeLocale, setActiveLocale] = useState<Locale>(locale);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!isOpen) return;

    setActiveLocale(locale);
    requestAnimationFrame(() => listboxRef.current?.focus());
  }, [isOpen, locale]);

  useEffect(() => {
    if (!isOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const activeIndex = LOCALES.findIndex((item) => item === activeLocale);

  const handleSelect = (nextLocale: Locale) => {
    setIsOpen(false);
    buttonRef.current?.focus();

    if (nextLocale !== locale) {
      trackEvent("locale_select", { from: locale, to: nextLocale });
      switchLocale(nextLocale);
    }
  };

  const moveActive = (offset: number) => {
    const nextIndex = (activeIndex + offset + LOCALES.length) % LOCALES.length;
    setActiveLocale(LOCALES[nextIndex]);
  };

  const handleButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveLocale(locale);
      if (!isOpen) trackEvent("locale_dropdown_open", { locale });
      setIsOpen(true);
    }
  };

  const handleListboxKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveLocale(LOCALES[0]);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveLocale(LOCALES[LOCALES.length - 1]);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect(activeLocale);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() =>
          setIsOpen((value) => {
            const nextIsOpen = !value;
            if (nextIsOpen) trackEvent("locale_dropdown_open", { locale });
            return nextIsOpen;
          })
        }
        onKeyDown={handleButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select language"
        aria-controls={isOpen ? listboxId : undefined}
        className="h-11 pl-4 pr-9 rounded-full bg-white/[0.08] border border-white/[0.12] hover:bg-white/[0.15] transition-all text-white/90 hover:text-white text-sm font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7c5cff]/50 relative inline-flex items-center"
      >
        <span>{LOCALE_LABELS[locale].native}</span>
        <svg
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70 transition-transform ${
            isOpen ? "rotate-180" : ""
          } ${reduceMotion ? "transition-none" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-label="Available languages"
            aria-activedescendant={`${listboxId}-${activeLocale}`}
            onKeyDown={handleListboxKeyDown}
            initial={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
            className="absolute right-0 top-[calc(100%+8px)] min-w-[200px] max-h-[360px] overflow-y-auto py-2 rounded-xl bg-[#111] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-50 focus:outline-none"
          >
            {LOCALES.map((item) => {
              const isSelected = item === locale;
              const isActive = item === activeLocale;

              return (
                <li
                  key={item}
                  id={`${listboxId}-${item}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setActiveLocale(item)}
                  className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between gap-3 border-l-2 ${
                    isSelected
                      ? "bg-[#7c5cff]/15 text-[#c4b0ff] border-[#7c5cff]"
                      : "text-white/80 hover:bg-white/5 hover:text-white border-transparent"
                  } ${isActive && !isSelected ? "bg-white/5 text-white" : ""}`}
                >
                  <span className="font-medium">{LOCALE_LABELS[item].native}</span>
                  <span className="text-xs text-white/40 shrink-0">
                    {LOCALE_LABELS[item].en}
                  </span>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
