"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/* ─────────── Intersection Observer Hook ─────────── */
function useScrollFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          obs.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─────────── Section wrapper with fade ─────────── */
function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useScrollFadeIn();
  return (
    <section
      id={id}
      ref={ref}
      className={`fade-in-section relative py-20 md:py-28 px-6 md:px-12 lg:px-20 ${className}`}
    >
      {children}
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   ICONS (SVG inline)
   ═══════════════════════════════════════════════════ */
function ChevronDown({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 003 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════
   NAVBAR
   ═══════════════════════════════════════════════════ */
const navItems = [
  { label: "Buy crypto", hasDropdown: true },
  { label: "Trade", hasDropdown: true },
  { label: "Markets", hasDropdown: false },
  { label: "Copy trading", hasDropdown: false },
  { label: "Bots", hasDropdown: false, badge: "New" },
  { label: "Finance", hasDropdown: true },
  { label: "Lucky HODL", hasDropdown: false },
  { label: "More", hasDropdown: true },
  { label: "Wallet", hasDropdown: false },
];

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5 h-[72px]">
      <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-4 lg:px-6">
        {/* Logo */}
        <a href="#" className="text-white font-bold text-xl tracking-tight shrink-0">
          Claw 42
        </a>

        {/* Center nav - desktop */}
        <div className="hidden xl:flex items-center gap-1 ml-8">
          {navItems.map((item) => (
            <a
              key={item.label}
              href="#"
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors whitespace-nowrap"
            >
              {item.label}
              {item.badge && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded-full leading-none">
                  {item.badge}
                </span>
              )}
              {item.hasDropdown && <ChevronDown className="w-3 h-3 opacity-50" />}
            </a>
          ))}
        </div>

        {/* Right side - desktop */}
        <div className="hidden xl:flex items-center gap-3 shrink-0">
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
            <UserIcon />
          </button>
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
            <BellIcon />
          </button>
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
            <GlobeIcon />
          </button>
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
            <MoonIcon />
          </button>
          <button className="ml-2 px-5 py-2 bg-[#d1ff55] text-black font-semibold text-sm rounded-full hover:brightness-110 transition-all">
            Deposit
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="xl:hidden p-2 text-gray-400 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="xl:hidden bg-[#0a0a0a] border-t border-white/5 py-4 px-4 max-h-[80vh] overflow-y-auto">
          {navItems.map((item) => (
            <a
              key={item.label}
              href="#"
              className="flex items-center gap-2 py-3 px-2 text-gray-300 hover:text-white border-b border-white/5 text-sm"
            >
              {item.label}
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded-full leading-none">
                  {item.badge}
                </span>
              )}
            </a>
          ))}
          <div className="mt-4 flex items-center gap-3">
            <button className="p-2 text-gray-400"><UserIcon /></button>
            <button className="p-2 text-gray-400"><BellIcon /></button>
            <button className="p-2 text-gray-400"><GlobeIcon /></button>
            <button className="p-2 text-gray-400"><MoonIcon /></button>
          </div>
          <button className="mt-4 w-full px-5 py-3 bg-[#d1ff55] text-black font-semibold text-sm rounded-full">
            Deposit
          </button>
        </div>
      )}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════
   HERO SECTION
   ═══════════════════════════════════════════════════ */
function HeroSection() {
  return (
    <section className="relative pt-[72px]">
      {/* Hero background image */}
      <div className="relative w-full hero-fade">
        <Image
          src="/images/hero-robot-scene.png"
          alt="Claw 42 AI Trading"
          width={1440}
          height={548}
          className="w-full h-auto object-cover"
          priority
        />
      </div>

      {/* Content below hero image */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 -mt-8 md:-mt-16 pb-20">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight mb-5 text-white leading-tight">
          用 AI Agent 重新定义交易方式
        </h1>
        <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-2xl mb-10 leading-relaxed">
          从&ldquo;人操作工具&rdquo; → &ldquo;AI 直接执行交易&rdquo;。让 AI 直接连接交易能力，从分析、决策到执行，一步完成。
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button className="px-8 py-3 rounded-full bg-[#d1ff55] text-black font-semibold text-base hover:brightness-110 transition-all hover:scale-105">
            立即开始
          </button>
          <button className="px-8 py-3 rounded-full border border-white/30 text-white font-semibold text-base hover:border-white/60 transition-all hover:scale-105">
            API文档
          </button>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   QUICK START SECTION
   ═══════════════════════════════════════════════════ */
function QuickStartSection() {
  const [copied, setCopied] = useState(false);
  const command = "pip install claw42-sdk && claw42 run daily-report";

  const handleCopy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Section className="flex flex-col items-center max-w-4xl mx-auto">
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 gradient-text">
        快速开始，一键安装
      </h2>

      {/* Terminal window */}
      <div className="w-full max-w-2xl terminal-glow rounded-xl overflow-hidden border border-white/10 bg-[#1a1a1a]">
        {/* macOS title bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#111] border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-xs text-gray-500 font-mono uppercase tracking-wider">
              Quick Start Terminal
            </span>
          </div>
        </div>
        {/* Code content */}
        <div className="flex items-center justify-between p-5 font-mono text-sm md:text-base">
          <div className="leading-relaxed">
            <span className="text-gray-500">$ </span>
            <span className="text-white">pip install </span>
            <span className="text-green-400">claw42-sdk</span>
            <span className="text-white"> && </span>
            <span className="text-white">claw42 run </span>
            <span className="text-green-400">daily-report</span>
          </div>
          <button
            onClick={handleCopy}
            className="relative ml-4 p-2 text-gray-400 hover:text-white transition-colors shrink-0 copy-btn"
            title="Copy to clipboard"
          >
            {copied ? (
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <ClipboardIcon />
            )}
          </button>
        </div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════
   SCENARIOS SECTION (Bento Grid)
   ═══════════════════════════════════════════════════ */
function ScenariosSection() {
  return (
    <Section className="max-w-7xl mx-auto">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white">
          常用场景
        </h2>
        <p className="text-gray-400 text-base md:text-lg max-w-3xl mx-auto leading-relaxed">
          AI Agent 不只是执行，更是你的智能交易副驾。探索基于 Neural Architect 的多样化应用场景。
        </p>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT LARGE CARD */}
        <div className="card-glow bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col lg:row-span-2">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-xl md:text-2xl font-bold text-white">生成加密货币日报</h3>
            <span className="px-2.5 py-1 text-xs font-bold bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
              推荐场景
            </span>
          </div>
          <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-6">
            一键唤醒 AI 获取全球市场动态。AI 将自动扫描主流币种波动、热门社交媒体情绪、重要链上数据与宏观新闻，输出结构化的中文研报，助你开启每日交易。
          </p>

          {/* Input field */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-sm text-gray-500">
              点击复制内容，发送给你的 agent 即可体验
            </div>
            <button className="px-5 py-3 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 transition-colors shrink-0">
              立即试用
            </button>
          </div>

          {/* Chat preview card */}
          <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl p-5 mt-auto">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full bg-brand-purple/30 flex items-center justify-center">
                <span className="text-xs">🤖</span>
              </div>
              <span className="text-sm font-semibold text-white">Claw 42 Agent</span>
              <span className="text-xs text-gray-500 ml-auto">just now</span>
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <p className="font-semibold text-white text-sm mb-2">📊 今日加密货币市场日报</p>
              <div className="space-y-1.5 text-xs md:text-sm">
                <p>• BTC: $67,432 <span className="text-green-400">(+2.3%)</span> — 突破关键阻力位</p>
                <p>• ETH: $3,521 <span className="text-green-400">(+1.8%)</span> — Layer2 TVL 创新高</p>
                <p>• SOL: $178 <span className="text-red-400">(-0.5%)</span> — Meme 币热度回落</p>
                <p>• 市场情绪: <span className="text-green-400">贪婪 72</span></p>
                <p>• 链上大额转账: 3笔 &gt; 1000 BTC</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT TOP CARD */}
        <div className="card-glow bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col">
          <h3 className="text-xl font-bold text-white mb-2">实时行情监控</h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-5">
            24/7 监控市场行情，大涨大跌及时知晓
          </p>
          <div className="flex-1 bg-[#1a1a1a] rounded-xl min-h-[120px] flex items-center justify-center">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 text-2xl font-mono font-bold text-white mb-2">
                <span className="text-green-400">📈</span>
                <span>$67,432</span>
                <span className="text-sm text-green-400">+2.3%</span>
              </div>
              <p className="text-xs text-gray-500">BTC/USDT · Real-time</p>
            </div>
          </div>
        </div>

        {/* RIGHT BOTTOM CARD */}
        <div className="card-glow bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col">
          <h3 className="text-xl font-bold text-white mb-2">Agent自动化交易</h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-5">
            如需使用交易功能,请先创建apikey
          </p>
          <div className="flex-1 bg-[#1a1a1a] rounded-xl min-h-[120px] flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl mb-2">🔑</div>
              <p className="text-sm text-gray-400">Create API Key to start</p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════
   WHY SECTION
   ═══════════════════════════════════════════════════ */
const whyCards = [
  {
    title: "让交易能力被 AI 调用",
    desc: "将行情、交易、账户等能力模块化，开放给 AI Agent，实现深度集成。",
    highlight: false,
  },
  {
    title: "降低交易门槛",
    desc: "用户无需复杂操作，通过自然语言即可完成原本繁琐的交易与分析流程。",
    highlight: true,
  },
  {
    title: "构建开放生态",
    desc: "开发者可以构建 Skill，共同丰富 AI 交易能力，推动 Web3 智能化。",
    highlight: false,
  },
];

function WhySection() {
  return (
    <Section className="max-w-7xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-6 text-white leading-tight">
          为什么 Claw 42 要构建 AI Agent Skills？
        </h2>
        <p className="text-gray-400 text-sm md:text-base max-w-4xl mx-auto leading-relaxed">
          过去十年，数字资产交易经历了从手动交易到工具化交易的演进。从K线分析、量化策略，到自动化执行，交易效率不断提升。
          Claw 42 认为，未来的交易平台不只是撮合交易的场所，而是可被 AI 调用的&ldquo;交易基础设施&rdquo;。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
        {whyCards.map((card, i) => (
          <div
            key={i}
            className={`card-glow relative bg-[#111] border border-white/10 rounded-2xl p-8 flex flex-col overflow-hidden`}
          >
            <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-white/10 flex items-center justify-center mb-5 text-brand-purple">
              <TrendingUpIcon />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{card.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed flex-1">{card.desc}</p>
            {/* Purple gradient bar at bottom for highlighted card */}
            {card.highlight && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6c4fff] to-[#a78bfa]" />
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════
   COMPLETION / TAGLINE SECTION
   ═══════════════════════════════════════════════════ */
function CompletionSection() {
  return (
    <Section className="max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <span className="text-gray-500 font-mono text-sm whitespace-nowrap">{"// - Completion"}</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>
      <div className="font-mono text-gray-500 text-sm md:text-base lg:text-lg leading-relaxed">
        <span className="text-gray-600">important</span>{" "}
        <span className="text-gray-600">type</span>{" "}
        <span className="text-gray-600">{"{"}</span>
        <br />
        <span className="ml-4 md:ml-8 inline-block text-gray-400">
          Claw 42 正在从&ldquo;交易平台&rdquo;，进化为&ldquo;AI 原生交易基础设施&rdquo;
        </span>
        <br />
        <span className="text-gray-600">{"}"}</span>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════ */
const footerColumns = [
  {
    title: "About Us",
    links: ["News", "Claw 42 Verity", "Fee Rate", "Risk Statement"],
  },
  {
    title: "Products",
    links: ["Spot Trading", "ETF Trading", "Futures", "Copy-trading", "Claw 42 Earn", "Claw 42 Ventures"],
  },
  {
    title: "Service",
    links: ["T&C of Listing", "Become the Merchant", "VIP Program", "APIs", "Invite Friends", "Bug Bounty"],
  },
  {
    title: "Learn",
    links: ["Futures Academy", "Help Center", "Crypto Introduction"],
  },
];

function Footer() {
  return (
    <footer className="relative border-t border-white/5 pt-16 pb-8 px-6 md:px-12 lg:px-20">
      <div className="max-w-7xl mx-auto">
        {/* Top grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 mb-12">
          {/* Download column */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-2">
            <h4 className="text-white font-semibold text-sm mb-4">Download App</h4>
            <div className="flex flex-col gap-3">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-[#6c4fff] hover:bg-[#5a3de6] rounded-lg transition-colors text-white text-sm font-medium">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                App Store
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-[#6c4fff] hover:bg-[#5a3de6] rounded-lg transition-colors text-white text-sm font-medium">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                </svg>
                Google Play
              </button>
            </div>
          </div>

          {/* Link columns */}
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
                      {link}
                      {link === "Copy-trading" && (
                        <span className="ml-1.5 text-[10px] font-bold text-green-400">(New)</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10 mb-6" />

        {/* Disclaimer */}
        <p className="text-gray-600 text-xs leading-relaxed mb-8">
          Disclaimer: Cryptocurrency trading is subject to market risks. Please trade responsibly and ensure you fully understand the risks before making any investment decisions.
        </p>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright */}
          <p className="text-gray-600 text-xs">
            CopyRight © 2017 - 2025 Claw42.com. All Rights Reserved.
          </p>

          {/* Social icons */}
          <div className="flex items-center gap-4">
            {/* Facebook */}
            <a href="#" className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            {/* X/Twitter */}
            <a href="#" className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            {/* Instagram */}
            <a href="#" className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </a>
            {/* YouTube */}
            <a href="#" className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
            {/* LinkedIn */}
            <a href="#" className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
            {/* TikTok */}
            <a href="#" className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
              </svg>
            </a>
          </div>

          {/* Language */}
          <div className="flex items-center gap-1.5 text-gray-500 text-xs">
            <GlobeIcon />
            <span>English</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════ */
export default function Home() {
  return (
    <main className="bg-black min-h-screen">
      <Navbar />
      <HeroSection />
      <QuickStartSection />
      <ScenariosSection />
      <WhySection />
      <CompletionSection />
      <Footer />
    </main>
  );
}
