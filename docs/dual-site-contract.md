# 内外站契约（dual-site contract）

> 权威定义文档。所有 spec / 派单 / 部署引用本文术语和差异清单。
> 创建：2026-06-03（Dan 拍板术语 + 同步模型）。变更需 Dan 确认后更新本文。

## 1. 术语（Dan 拍板 @ 2026-06-03）

| 术语     | 站点                  | 链路                                                           | 部署人      |
| -------- | --------------------- | -------------------------------------------------------------- | ----------- |
| **外站** | `claw42.ai`           | Vercel（agentx 线），Codex deploy 候选 -> Dan 字符级 promote   | Codex + Dan |
| **内站** | `ai.coinw.com/claw42` | CoinW GitLab + Jenkins，Codex 本地打包 -> Dan 专用电脑人工部署 | Dan（人工） |

## 2. 开发与发布流（单向：外站先行）

```text
所有开发/迭代 -> 外站 staging/preview -> 外站 prod（Dan promote 确认）
-> 切内站差异项（variant=coinw）-> Codex 本地打包 -> Dan 另一台电脑人工部署内站
```

- **外站 = 唯一开发主线**。内站不做独立开发，只消费外站已确认的版本。
- **每次外站 prod 更新后，内站需要重新打包 + 人工部署跟进**，否则内站落后（落后是预期状态，由 Dan 决定何时跟进）。
- 内站部署的 env / 库 / cron 配置见 `coinw-deploy-guide-dan-2026-06-01.md` + Dan 手上的 env 配置清单。

## 3. 差异清单（divergence registry）——内外站仅允许以下差异

| #   | 差异项                             | 外站                              | 内站                                                      | 机制                                                                                        |
| --- | ---------------------------------- | --------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | header / footer                    | Claw42 原生 SiteHeader，无 footer | CoinwGlobalHeader + CoinwGlobalFooter                     | `SITE_SHELL_VARIANT`（claw42 / coinw）                                                      |
| 2   | **hero 区域**（2026-06-07 已实现） | 现行机器人环绕图                  | 多 Agent 组队分析示意图（6 阶段区卡 + 11 Agent + 结论条） | 同一开关 `SITE_SHELL_VARIANT` 驱动；只替换右侧视觉区，左侧文案 / 数字 / tabs / CTA 保持一致 |
| 3   | 路径 / 站点地址                    | 根路径 / claw42.ai                | `/claw42` 前缀 / ai.coinw.com                             | `NEXT_PUBLIC_BASE_PATH` + `NEXT_PUBLIC_SITE_URL`                                            |
| 4   | 数据库（缓存库）                   | 外站自己的 Upstash 库             | 内站独立 Upstash 库（不共享，各 50 万额度）               | env 注入                                                                                    |
| 5   | 定时任务                           | Vercel cron                       | CoinW 运维每小时 job                                      | 基建侧                                                                                      |

**除上表外，功能 / 数据模型 / 行为 / 文案一律一致。**

## 4. 维护规则

1. **单一开关原则**：所有“内外站界面差异”统一由 `SITE_SHELL_VARIANT` 一个开关驱动（coinw = 内站全套差异；claw42 = 外站）。不引入第二个差异开关。
2. **新增任何内外差异 = 先登记本表 + Dan 拍板**，再实现。未登记的差异 = drift = bug。
3. **同步检查**：内站每次打包前，对照本表确认“只有登记过的差异”，其余与外站 prod commit 完全一致（同一 commit 构建，仅 env / variant 不同）。

---

_v1.1 @ 2026-06-07。差异 #2（hero）已按 DS1 内站多 Agent 组队分析示意图实现。_
