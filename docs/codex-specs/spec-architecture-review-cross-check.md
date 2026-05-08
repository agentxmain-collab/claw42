# Spec — Codex 交叉评审 F 对两份架构评审稿的初评意见

## 目标

不写代码，只产出一份 markdown 评审文件。

任务有两层：

1. **Meta-review F 的初评**：对 F 提的每一条意见，判断是成立 / 部分成立 / 不成立，给理由 + 建议如何修订或删除
2. **独立扫两份原文档**：作为有 CoinW API 集成实操经验的工程师视角，提 F 漏掉的问题（不重复 F 已经提过的）

最终融合成一份 v1 cross-review 文件，给 Dan 拿到 CoinW 评审会上用。

## 输出文件

唯一产出：

```
claw42/docs/reviews/architecture-review-cross-check-by-codex.md
```

不修改其他文件。**不要动**两份原文档（`docs/claw42-agent-service-architecture.md` / `docs/coinw-integration-requirements.md`），**不要动** F 的评审文件（`docs/reviews/architecture-review-by-f.md`）。

## 输入文件（必读，按顺序）

1. `docs/claw42-agent-service-architecture.md` — 架构评审稿原文 v1.0
2. `docs/coinw-integration-requirements.md` — CoinW 集成需求清单原文 v1.0
3. `docs/reviews/architecture-review-by-f.md` — F 的初评意见

读完三份再动手写。**不要凭记忆**——每条评审都要回到原文档确认上下文。

## 分支策略

```
git fetch origin
git checkout main
git pull origin main
git checkout -b docs/architecture-review-cross-check-01
# 实现
git push origin docs/architecture-review-cross-check-01
# 开 PR 到 main
```

PR 目标 main，无 staging preview 需求（纯文档 PR）。

## 输出文件结构

```
# Codex 对 F 评审意见的交叉评审 + 独立补充

> 评审者：Codex（OpenAI Codex）
> 评审日期：YYYY-MM-DD
> 评审输入：
> - docs/claw42-agent-service-architecture.md v1.0
> - docs/coinw-integration-requirements.md v1.0
> - docs/reviews/architecture-review-by-f.md（F 初评）

---

## Part A — 对 F 评审的逐条交叉评审

### Doc 1 部分

#### F-D1-P0-1. [F 提的标题]
- F 的判断：[一句话复述 F 的意见]
- Codex 判断：成立 / 部分成立 / 不成立
- 理由：[为什么]
- 建议修订：[如果需要修订 F 的意见，怎么改；如果删除，为什么]

（对 F 评审里的每一条 F-D1-P0-1 到 F-X-3、写作层面、自检条目都做同样处理）

### Doc 2 部分

（同上结构）

### 跨文档一致性部分

（同上结构）

---

## Part B — Codex 独立补充

不重复 F 已经提过的。从 CoinW API 集成实操经验角度，列出 F 漏掉的问题。

每条同样按 P0 / P1 / P2 分级，并标注：
- 位置（哪份文档哪一节）
- 问题
- 建议
- 为什么 F 可能漏掉了这条

### Doc 1 补充
（C-D1-P0-1, C-D1-P1-N, C-D1-P2-N）

### Doc 2 补充
（C-D2-P0-1, C-D2-P1-N, C-D2-P2-N）

### 跨文档补充
（C-X-N）

---

## Part C — 最终合并意见（Codex 给 Dan）

3-5 条最高优先级处理建议，融合 F 评审 + Codex 补充。

每条：
- 标题
- 涉及的 F / Codex 编号
- 一句话说为什么 ROI 最高
```

## 具体要求

### Part A 评审纪律（最重要）

**禁止附和**。F 是有偏见的（见 F 文档"F 自检"那一节自报的盲点）。Codex 对每一条意见必须独立判断，不能因为 F 写得详细就默认成立。

具体反 anti-rationalization：

- F 写"P0 必须解决"——Codex 看完原文后觉得不至于 P0 → 改判 P1，写明为什么不至于 P0
- F 写"建议这样改"——Codex 觉得 F 的改法不对 / 不够 / 过头 → 给替代方案
- F 提的"问题"在原文档里其实有一笔带过的 mitigation → 明确指出 F 漏读了哪一句
- F 自检里说"我可能漏掉 X"——Codex 要么补上 X 的具体内容，要么说"X 实际不需要补，因为 ..."

**禁止泛泛肯定**。"这条建议合理"是无效评审。要给出具体的：

- 这条意见生效后会改变什么具体行为
- 不采纳的代价是什么

### Part B 独立补充纪律

**不重复 F 已提的**。如果某个角度 F 已经提到了，即使 Codex 觉得 F 提得不够深，也应该归到 Part A 改进 F 的意见，而不是 Part B 重复。

**重点扫这些 F 自检里坦白的盲点**（F 说自己可能漏的方向）：

1. 合约语义精确性（cross-margin / isolated-margin / hedge mode）
2. CoinW 实际 API 风格 vs 文档里的"必需接口"列表的差距
3. 国际化合规（俄罗斯央行限制等）
4. 数据库容量预估
5. 用户冷启动 UI 流程

每个角度至少看一遍原文档，要么确认 F 担心成立并补具体问题，要么说"这个方向其实文档已经覆盖 / 不影响 v1"。

**额外建议扫**（F 自检没列但容易漏的）：

- WebSocket / 实时行情订阅是否在 v1 范围（架构文档没提，但 Agent 对话场景里"BTC 涨到 65000 我帮你下单"暗示需要某种实时性）
- 时区处理（用户 timezone vs 服务器 UTC vs CoinW 返回时间戳格式）
- 国际化字符集（合约名称里的特殊符号、订单备注栏长度）
- 错误日志里 PII（Personally Identifiable Information）泄漏的合规风险
- 对 v1 切流策略（先 1% 用户灰度还是直接全量）

### Part C 最终合并意见

不超过 5 条。每条说清楚：

- 标题
- 编号引用（哪些 F 编号 + 哪些 Codex 编号被合并）
- ROI 论证

避免"P0 全列上来"——Part C 是 Codex 个人判断的"必须先做"。

## 验收标准

- [ ] 输出文件 `docs/reviews/architecture-review-cross-check-by-codex.md` 存在
- [ ] Part A 覆盖 F 文档里**每一条**编号意见（F-D1-P0-1 到 F-X-3 + 写作 + 自检），无遗漏
- [ ] Part A 每条有明确"成立 / 部分成立 / 不成立"判断（不能模糊）
- [ ] Part B 至少 5 条独立补充（涵盖 F 自检的 5 个盲点方向各至少回应一句，加上额外扫的方向至少补 2 条）
- [ ] Part B 没有和 F 已提条目重复
- [ ] Part C 3-5 条，每条引用具体编号
- [ ] 不修改两份原文档
- [ ] 不修改 F 评审文件
- [ ] `git diff --name-only main..HEAD` 只显示 1 个新文件
- [ ] 没有创建多余文件（spec / 临时文件 / log）

## 写作纪律

- 用中文（评审输入是中文，输出对齐）
- 短句多于长句，节奏感
- 下判断要明确——"成立 / 部分成立 / 不成立"三选一，不要"在某种意义上可能"这种 hedge
- 禁用词：值得注意的是 / 综上所述 / 赋能 / leverage 等 AI 味词全部禁用
- 禁止给名词加引号 / 书名号做强调
- 别用"首先 / 其次 / 最后"连续段落开头

## 约束

- 不修改原文档（两份评审稿 + F 文件）
- 不写代码
- 不引用外部资料（评审只基于三份输入文件）
- 不动 i18n / 不动 src/
- 不新建 git submodule 或修改 .gitignore
- 文件名严格按 spec：`architecture-review-cross-check-by-codex.md`

## 提交与 PR

1. 从 main 拉 `docs/architecture-review-cross-check-01`
2. 写完 cross-review 文件
3. Commit message：

   ```
   docs(review): cross-check F's review of architecture + integration drafts

   - Part A: meta-review of F's findings (agree / partial / disagree per item)
   - Part B: Codex's independent additions covering F's blind spots
   - Part C: top 3-5 priority items merged from both
   ```

4. Push + 开 PR 到 `main`

## 有疑问不要猜

- F 的某条编号在原文档里找不到对应位置 → 在 Part A 里写明"无法定位 §X，需要 F 补具体行号"
- 原文档某个术语不确定（如"仓位模式"具体指什么）→ 标注为"待 CoinW 确认"，不自行解释
- 评审到一半发现两份原文档自相矛盾 → 标注矛盾点放到 Part C，不替任何一边背书

---

_维护者: F_
_创建: 2026-04-26_
_执行者: Codex_
_基于: main（最新 HEAD，merge 完 PR #9 之后的状态）_
