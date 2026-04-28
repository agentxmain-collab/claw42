"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_ORDER } from "./agents";
import { useAgentAnalysis } from "./hooks/useAgentAnalysis";
import type { AgentId, AgentWatchMessage } from "./types";
import { AgentSidebar } from "./components/AgentSidebar";
import { CoinTickerStrip } from "./components/CoinTickerStrip";
import { MessageStream } from "./components/MessageStream";
import { TopicHeader } from "./components/TopicHeader";

function keepFivePerAgent(messages: AgentWatchMessage[]) {
  const kept = new Set<string>();
  for (const agentId of AGENT_ORDER) {
    messages
      .filter((message) => message.agentId === agentId)
      .slice(-5)
      .forEach((message) => kept.add(message.id));
  }
  return messages.filter((message) => kept.has(message.id));
}

export function AgentWatchBoard() {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const { data, isLoading } = useAgentAnalysis({ enabled: true });
  const processedGeneratedAtRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const [messages, setMessages] = useState<AgentWatchMessage[]>([]);
  const [typingAgent, setTypingAgent] = useState<AgentId | null>(null);
  const [speakingAgent, setSpeakingAgent] = useState<AgentId | null>(null);

  useEffect(() => {
    if (!data || processedGeneratedAtRef.current === data.generatedAt) return;
    processedGeneratedAtRef.current = data.generatedAt;

    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];

    data.stream.forEach((item, index) => {
      const typingTimer = window.setTimeout(() => {
        setTypingAgent(item.agentId);
      }, index * 1600);
      const appendTimer = window.setTimeout(() => {
        setTypingAgent(null);
        setSpeakingAgent(item.agentId);
        setMessages((current) =>
          keepFivePerAgent([
            ...current,
            {
              id: `${data.generatedAt}-${item.agentId}-${index}`,
              agentId: item.agentId,
              content: item.content,
              timestamp: data.generatedAt,
            },
          ]),
        );
      }, index * 1600 + 800);
      const clearSpeakingTimer = window.setTimeout(() => {
        setSpeakingAgent((current) => (current === item.agentId ? null : current));
      }, index * 1600 + 1900);
      timersRef.current.push(typingTimer, appendTimer, clearSpeakingTimer);
    });

    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, [data]);

  return (
    <section
      data-agent-watch-board
      className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-7xl px-4 pb-16 pt-24 md:px-8 md:pt-28"
    >
      <div className="space-y-5">
        <CoinTickerStrip tickers={data?.tickers} isStale={data?.degraded} />
        <TopicHeader t={t} />

        <div className="grid gap-4 md:flex md:items-stretch">
          <AgentSidebar
            activeAgent={typingAgent}
            speakingAgent={speakingAgent}
            labels={t.agentWatch.sidebarStatus}
          />
          <MessageStream messages={messages} typingAgent={typingAgent} />
        </div>

        {isLoading && messages.length === 0 && (
          <p className="text-center text-sm text-white/35">正在连接 Agent 观察席...</p>
        )}

        <motion.a
          href="#"
          title="敬请期待"
          whileHover={reduceMotion ? undefined : { y: -3 }}
          className="card-glow flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/10 bg-[#111] p-5 md:flex-row md:items-center md:p-6"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#b49cff]">
              Claw 42 Agent
            </p>
            <h2 className="mt-2 text-xl font-bold text-white md:text-2xl">
              {t.agentWatch.bottomCta}
            </h2>
          </div>
          <span className="text-2xl text-white/55">→</span>
        </motion.a>
      </div>
    </section>
  );
}
