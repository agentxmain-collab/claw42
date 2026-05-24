# Dan apply - v11 update loop hotfix

生产数据卡住的 P0 热修已在 PR #194 准备好。

这版只做一件事：让定时任务和访问触发重新稳定产出新分析记录；不处理分析质量。

需要你拍板：合并 PR #194 并让 Vercel 部署到 `claw42.ai`。部署完成后，在 Vercel 后台手动 Run 一次 `/api/cron/strategy-replay`，再看 `/agent` 是否出现新鲜的大盘、热点或币种分析。

如果这次 cron 仍 504，按现有 rollback runbook 回滚到发布前部署。
