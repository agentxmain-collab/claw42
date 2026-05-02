# claw42

加密货币 AI Agent 竞技养成生态对外产品站。

🌐 **Production**: https://claw42.ai

## 技术栈

- Next.js 14.2 (App Router) + React 18 + TypeScript 5
- Tailwind CSS 3.4 + framer-motion
- 部署：Vercel

## 开发

### 前置

- Node.js >= 20.0.0（见 `.nvmrc`）
- npm 10.x（见 `package.json` packageManager）

### 启动

```bash
nvm use
npm install
cp .env.local.example .env.local
npm run dev
```

开发服务器默认运行在 http://localhost:3000。

### Env 变量

`.env.local` 必填（见 `.env.local.example`）：

- `DEEPSEEK_API_KEY` — 主 LLM provider
- `MINIMAX_API_KEY` — 备用 LLM provider
- `ANTHROPIC_API_KEY` — 第三 fallback
- `COINGECKO_API_KEY` — 行情数据（demo key 即可）

### 验证

```bash
npm run verify
```

PR 提交前必须 verify 通过。

## 目录结构

见 `ARCHITECTURE.md`。

## 文档

- `ARCHITECTURE.md` — 架构 + 禁止路径
- `dependency-policy.md` — 依赖变更流程
- `docs/adr/` — 架构决策记录
- `docs/airy-tasks/` — 任务 spec（按 task-NN 命名）
- `docs/codex-specs/` — Codex 派发 spec
- `docs/reviews/` — 评审记录

## 协作

本项目代码主要由 AI（Claude/Codex）写，Dan 路由 + 验收。
AI 不允许触碰 `ARCHITECTURE.md § 9` 列出的禁止路径，必须显式 Dan 批准。

## License

Private. Owned by Dan.
