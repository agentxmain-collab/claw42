# dependency-policy.md

> **Auto-loaded by Claude / Codex on session start**. 改任何依赖文件前必走 [DEPENDENCY-CHANGE-REQUEST] sync 块（v2.2 协议）。

---

project_id: claw42
business_identity: OpenClaw / S 级 Agent 代码主线（Dan 2026-04-27 裁决）
level: **A**
sca_required: true
sca_tool: 墨菲 SCA
package_manager: npm
package_files:

- package.json
- package-lock.json
  known_baseline:
  scan_date: 2026-04-27
  high: 4
  moderate: 1
  low: 0
  posthog-js: "^1.372.3 (added 2026-04-30 by Dan directive; covered by ADR 0002; pending Dan 墨菲 scan)"
  recharts: "^2.15.4 (added for task-15 StrategyMiniChart; covered by ADR 0005; pending Dan 墨菲 scan)"
  "@vercel/og": "^0.6.8 (added for task-15 share image route; covered by ADR 0006; pending Dan 墨菲 scan)"
  notes: "next / glob 类。存量不强升级（v2.2 'A 级存量不强改' 原则）"
  github_remote: agentxmain-collab/claw42 (https)
  worktrees:
- /Users/dannybrown/Claude/职业规划/web-dev/claw42
  notes: |
- 公开品牌：Claw 42
- 技术名 / handle：Claw42
- 路径 / repo / package：claw42
- package.json name 字段已改为 `claw42`
  last_updated: 2026-04-30

---

## 工作流（v2.2 协议 § 三方依赖安全合规）

依赖变更触发 11 步流程：

1-3. Codex 改 → sync 块 → Dan yes/no
4-5. Codex npm audit 自查 → commit + push
6-11. Dan 在 Cursor 跑墨菲 → 复制告警给 Codex → 修 → 重扫至全绿

**A 级硬要求**：上线前墨菲扫描必须 0 高危 / 0 严重，否则禁止 push 到 main 分支。
