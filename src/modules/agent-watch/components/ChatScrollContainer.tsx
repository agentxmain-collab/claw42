"use client";

import { useReducedMotion } from "framer-motion";
import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const NEAR_BOTTOM_THRESHOLD_PX = 100;

export interface ChatScrollContainerHandle {
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

interface ChatScrollContainerProps {
  children: ReactNode;
  dependencyKey: string;
  className?: string;
  contentClassName?: string;
  newMessagesLabel: string;
}

export const ChatScrollContainer = forwardRef<ChatScrollContainerHandle, ChatScrollContainerProps>(
  function ChatScrollContainer(
    { children, dependencyKey, className = "", contentClassName = "", newMessagesLabel },
    forwardedRef,
  ) {
    const reduceMotion = useReducedMotion();
    const containerRef = useRef<HTMLDivElement>(null);
    const isNearBottomRef = useRef(true);
    const [hasNewMessages, setHasNewMessages] = useState(false);

    const setNearBottom = useCallback((near: boolean) => {
      isNearBottomRef.current = near;
    }, []);

    const scrollToBottom = useCallback(
      (behavior: ScrollBehavior = "smooth") => {
        const el = containerRef.current;
        if (!el) return;
        el.scrollTo({
          top: el.scrollHeight,
          behavior: reduceMotion ? "auto" : behavior,
        });
        setNearBottom(true);
        setHasNewMessages(false);
      },
      [reduceMotion, setNearBottom],
    );

    useImperativeHandle(forwardedRef, () => ({ scrollToBottom }), [scrollToBottom]);

    useEffect(() => {
      if (isNearBottomRef.current) {
        const frame = window.requestAnimationFrame(() => scrollToBottom("smooth"));
        return () => window.cancelAnimationFrame(frame);
      }
      setHasNewMessages(true);
    }, [dependencyKey, scrollToBottom]);

    return (
      <div className={`relative overflow-hidden ${className}`}>
        <div
          ref={containerRef}
          onScroll={() => {
            const el = containerRef.current;
            if (!el) return;
            const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            const near = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;
            setNearBottom(near);
            if (near) setHasNewMessages(false);
          }}
          className={contentClassName}
        >
          {children}
        </div>

        {hasNewMessages && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[#7650ff]/35 bg-[#17131f]/90 px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_34px_rgba(118,80,255,0.28)] backdrop-blur-md transition hover:border-[#7650ff]/70"
          >
            {newMessagesLabel}
          </button>
        )}
      </div>
    );
  },
);
