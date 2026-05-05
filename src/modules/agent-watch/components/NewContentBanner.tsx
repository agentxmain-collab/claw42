"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";

interface NewContentBannerProps {
  visible: boolean;
  onDismiss: () => void;
  onJumpToLatest: () => void;
}

export function NewContentBanner({ visible, onDismiss, onJumpToLatest }: NewContentBannerProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(onDismiss, 30_000);
    return () => window.clearTimeout(id);
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <div className="sticky top-2 z-30 flex justify-center" aria-live="polite">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 backdrop-blur-md"
          >
            <button
              type="button"
              onClick={onJumpToLatest}
              className="text-white/78 flex items-center gap-2 rounded-l-full px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-35" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white/70" />
              </span>
              {t.agentWatch.banner.newContent}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t.agentWatch.banner.dismissAriaLabel}
              className="rounded-r-full px-3 py-1.5 text-xs text-white/50 transition-colors hover:text-white/80"
            >
              ×
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
