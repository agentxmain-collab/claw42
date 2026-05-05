"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { LOCALES, LOCALE_LABELS } from "@/i18n/locales";
import type { Locale } from "@/i18n/types";
import { trackEvent } from "@/lib/analytics";
import { AGENT_WATCH_LOCALES } from "@/modules/agent-watch/locale";

export function LocaleDropdown() {
  const { locale, switchLocale } = useI18n();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const isAgentWatchRoute = pathname.split("/").filter(Boolean)[1] === "agent";
  const localeOptions: readonly Locale[] = isAgentWatchRoute ? AGENT_WATCH_LOCALES : LOCALES;
  const [isOpen, setIsOpen] = useState(false);
  const [activeLocale, setActiveLocale] = useState<Locale>(locale);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!isOpen) return;

    setActiveLocale(localeOptions.includes(locale) ? locale : localeOptions[0]);
    requestAnimationFrame(() => listboxRef.current?.focus());
  }, [isOpen, locale, localeOptions]);

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

  const activeIndex = localeOptions.findIndex((item) => item === activeLocale);

  const handleSelect = (nextLocale: Locale) => {
    setIsOpen(false);
    buttonRef.current?.focus();

    if (nextLocale !== locale) {
      trackEvent("locale_select", { from: locale, to: nextLocale });
      switchLocale(nextLocale);
    }
  };

  const moveActive = (offset: number) => {
    const nextIndex = (activeIndex + offset + localeOptions.length) % localeOptions.length;
    setActiveLocale(localeOptions[nextIndex]);
  };

  const handleButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveLocale(localeOptions.includes(locale) ? locale : localeOptions[0]);
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
      setActiveLocale(localeOptions[0]);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveLocale(localeOptions[localeOptions.length - 1]);
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
        className="relative inline-flex h-11 cursor-pointer items-center rounded-full border border-white/[0.12] bg-white/[0.08] pl-4 pr-9 text-sm font-semibold text-white/90 transition-all hover:bg-white/[0.15] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#7c5cff]/50"
      >
        <span>{LOCALE_LABELS[locale].native}</span>
        <svg
          className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70 transition-transform ${
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
            className="absolute right-0 top-[calc(100%+8px)] z-50 max-h-[360px] min-w-[240px] overflow-y-auto rounded-xl border border-white/10 bg-[#111] py-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)] focus:outline-none"
          >
            {localeOptions.map((item) => {
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
                  className={`flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap border-l-2 px-4 py-2.5 text-sm transition-colors ${
                    isSelected
                      ? "border-[#7c5cff] bg-[#7c5cff]/15 text-[#c4b0ff]"
                      : "border-transparent text-white/80 hover:bg-white/5 hover:text-white"
                  } ${isActive && !isSelected ? "bg-white/5 text-white" : ""}`}
                >
                  <span className="font-medium">{LOCALE_LABELS[item].native}</span>
                  <span className="shrink-0 text-xs text-white/40">{LOCALE_LABELS[item].en}</span>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
