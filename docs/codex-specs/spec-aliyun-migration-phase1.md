# Spec: claw42 阿里云迁移 Phase 1（迁当前 prod 版本）

## 目标

把当前 claw42.ai 生产环境（Vercel 跑的那个 commit）迁到阿里云 ECS + 公司 GitLab + 公司域名。**不影响**正在 GitHub + Vercel 上推进的 v2.0 开发主线（sweep-2 / Batch 2/3/4 等照常跑）。

迁移完成后：

- prod 域名（公司提供的域名）→ 阿里云 SLB → ECS（标准 Node 部署）
- claw42.ai （Vercel）→ 退役（保留为 staging 给后续开发用 / 或完全关闭，按公司决定）
- 后续 v2.0 batch 完成后再次走 release flow 部署阿里云

**Phase 2（后续）** 不在本 spec 范围 —— 等 Phase 1 跑稳后再决定开发流是否完全迁公司 GitLab。

---

## § 0. 共同约束

继承 `spec-batch1a-signalengine-internalization.md`：worktree 模式 / 临时 GitHub 账号切换 / 不动 dirty state。新增：

- 涉及公司 GitLab / 阿里云 ECS 的操作 → Codex **不直接操作**（这些是运维侧），Codex 只**生成需求清单**给 Dan 转发
- Codex **可以做的**：代码改造（GitHub repo 上做）、Vercel API audit、写 GitLab CI 配置文件、写 Dockerfile、写 deploy script

---

## § 1. Phase 1.0 — 当前 prod commit audit（Codex 立即可做）

### 目标

确定 claw42.ai 当前 Vercel prod 部署的具体 commit hash，作为迁移基线。

### 实施

```bash
# Method 1: Vercel CLI（如有访问权限）
vercel ls --prod claw42-site

# Method 2: GitHub API（看 deployments）
gh api repos/agentxmain-collab/claw42/deployments --paginate \
  | jq '.[] | select(.environment == "Production") | {sha, ref, created_at}' \
  | head -5

# Method 3: 看 main 上最近的 production tag（如有）
git tag --list 'prod-*' --sort=-creatordate | head -5

# Method 4: 直接看 Vercel deployments
gh api repos/agentxmain-collab/claw42/deployments?environment=production --paginate \
  | jq '.[0]'
```

### 输出

```
Current prod commit:
  - SHA: <hash>
  - Branch: <branch name>
  - Deployed at: <timestamp>
  - Commit message: <message>

Compared to current main HEAD:
  - main HEAD: <hash>
  - Diff: <main HEAD ahead of prod by N commits>
```

把这个信息贴给 Session C，**作为迁移目标 commit 的锚点**。

### 备份分支

```bash
# 创建 prod-snapshot 分支锁定当前 prod 状态
git branch prod-snapshot-2026-05-08 <prod-commit-sha>
git push origin prod-snapshot-2026-05-08
```

后续阿里云部署都基于这个分支，与 main（继续推进 v2.0）解耦。

---

## § 2. Phase 1.1 — Code 改造（Codex 在 prod-snapshot-2026-05-08 分支做）

### 改造清单

| Task     | 内容                                                                                                                     | 关键文件                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| **T-A1** | KV 抽象层：从 `@vercel/kv` 切到 `ioredis` 客户端                                                                         | `src/lib/storage/kv-*.ts` 全部 |
| **T-A2** | Cron 抽象：去掉 `/api/cron/*` 的 Vercel Cron 假设，改成可被外部 EventBridge / 标准 HTTP 调用的 endpoint                  | `src/app/api/cron/*`           |
| **T-A3** | env config 化：grep `process.env.VERCEL_*`，去除 Vercel 特有 env，改为通用 env（`NEXT_PUBLIC_BASE_URL` / `NODE_ENV` 等） | 全 codebase                    |
| **T-A4** | `@vercel/og` 验证：在标准 Node Runtime 跑 `@vercel/og` 是否 OK；如不能跑，替换为 `satori` + `resvg`                      | `src/app/api/og/*`             |
| **T-A5** | Next.js standalone build 配置：`next.config.js` 加 `output: 'standalone'`，让 build 输出可独立运行的 server bundle       | `next.config.js`               |
| **T-A6** | Health check endpoint：`/api/health` 返回 `{ status: 'ok', commit: <sha>, redis: 'ok'/'fail' }`                          | `src/app/api/health/route.ts`  |
| **T-A7** | Logging interface：去除 Vercel 特有 console pattern，改为标准 stdout（让阿里云 SLS 收集）                                | `src/lib/logger.ts`（如有）    |

### T-A1 详细：KV 抽象层重写

当前抽象层（Batch 1B 时设计的）：

```typescript
// src/lib/storage/kv-lock.ts (现状，用 @vercel/kv)
import { kv } from "@vercel/kv";
// ...
```

改造为：

```typescript
// src/lib/storage/kv-client.ts (新建：统一客户端)
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
export const kv = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

// 接口适配（和 @vercel/kv 兼容）
// kv.set(key, value, { ex: 3600, nx: true })
// kv.get(key)
// kv.del(key)
// kv.incr(key)
// kv.expire(key, seconds)
// kv.lpush(key, value)
// kv.eval(script, keys, args)  ← Lua 支持，ioredis 原生支持

// 所有现有 src/lib/storage/kv-*.ts 改 import:
//   旧：import { kv } from '@vercel/kv';
//   新：import { kv } from './kv-client';
```

ioredis 的 API 接口与 `@vercel/kv` 大致兼容（都是 Redis-compatible），但有些细节差异：

- `kv.set(key, value, { ex, nx })` ioredis 写法不同 → 用 `kv.set(key, value, 'EX', 3600, 'NX')`
- `kv.get<T>(key)` 返回 string，需要自己 JSON.parse → 抽象层做适配

### T-A2 详细：Cron 抽象

当前 Vercel Cron 配置在 `vercel.json`：

```json
{
  "crons": [{ "path": "/api/cron/strategy-replay", "schedule": "*/3 * * * *" }]
}
```

改造：

1. **删除 vercel.json 中 cron 配置**（Vercel 不再触发）
2. **改 `/api/cron/*` endpoint**：去掉 Vercel Cron 鉴权（`x-vercel-cron-signature`），改为 secret token 鉴权（让 EventBridge 带 token 调用）
3. **生成阿里云 EventBridge 配置**：

```yaml
# tooling/aliyun/eventbridge-cron.yml
event_rules:
  - name: strategy-replay
    schedule: cron(0 */3 * * *)
    target:
      type: HTTP
      url: https://${PROD_DOMAIN}/api/cron/strategy-replay
      headers:
        Authorization: Bearer ${CRON_SECRET}
```

运维拿这份 yml 去阿里云 EventBridge 控制台配置（或用 aliyun-cli 自动化）。

### T-A4 详细：@vercel/og 验证

`@vercel/og` 实际上是封装 `satori` + `resvg-js`，在标准 Node 22+ 应该能跑。但有几个潜在问题：

- Edge Runtime 限制：claw42 的 og endpoint 用 `runtime: 'edge'`，要改 `runtime: 'nodejs'`
- Font 加载：edge 是 fetch 内置 font，nodejs 要 fs 读

实施步骤：

1. 写一个测试 endpoint `/api/og/health-check` 用 nodejs runtime 生成 OG image
2. 跑测试：`curl localhost:3000/api/og/health-check > test.png && file test.png` 看是否真的是 PNG
3. 如失败 → 替换为 `satori` + `@resvg/resvg-js` 直接调用（绕过 @vercel/og 包装）

### 实施流程

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42

# 切账号 + worktree（基于 prod-snapshot-2026-05-08）
ORIGINAL_GH_USER=$(gh auth status 2>&1 | awk '/Active account: true/{found=1} found && /account /{print $NF; exit}')
gh auth switch --user agentxmain-collab

git fetch origin
git worktree add /tmp/claw42-aliyun-migration -b feature/aliyun-migration-phase1 origin/prod-snapshot-2026-05-08

cd /tmp/claw42-aliyun-migration
npm install
npm install --save ioredis @resvg/resvg-js satori
npm uninstall @vercel/kv  # 不再需要，但保留也无害

# 逐 task 改造（T-A1 ~ T-A7）
# 每改一个 task tsc + lint + build 验证

# 全套验证
npx tsc --noEmit
npm run lint
MINIMAX_API_KEY=dummy DEEPSEEK_API_KEY=dummy REDIS_URL=redis://localhost:6379 npm run build

# Test against local Redis（dev 环境装一个 redis）
docker run -d -p 6379:6379 --name claw42-test-redis redis:7-alpine
REDIS_URL=redis://localhost:6379 npm run start &
curl localhost:3000/api/health  # 应返回 status: ok, redis: ok

# 全套既有 verify（确保改造没破坏既有功能）
npm run verify:chat-v3-final
npm run test:signal-engine
npm run test:kv-lock
npm run test:kv-rate-limiter
npm run test:kv-quota
npm run verify:metrics
npm run verify:a11y

# Push + 开 PR
git push -u origin feature/aliyun-migration-phase1
gh pr create --base prod-snapshot-2026-05-08 --head feature/aliyun-migration-phase1 \
  --title "feat(aliyun): code changes for ECS migration (Phase 1.1)" \
  --body "T-A1 ~ T-A7. Replaces @vercel/kv with ioredis, removes Vercel-specific assumptions, adds Next.js standalone build, health endpoint, OG image fallback."
```

### 验收标准

- [ ] `npm run build` 输出 `.next/standalone/` 目录（standalone build）
- [ ] `REDIS_URL=...` 启动后 `/api/health` 返回 `{ status: 'ok', redis: 'ok' }`
- [ ] grep `@vercel/kv` 在 src/ 下 0 引用
- [ ] grep `process.env.VERCEL_*` 在 src/ 下 0 引用（除非保留兼容 Vercel staging）
- [ ] 所有既有 verify 全绿
- [ ] OG image 用 nodejs runtime 跑通
- [ ] vercel.json 删除 cron 配置（保留其他配置如有）

---

## § 3. Phase 1.2 — 公司侧资源需求清单（Dan 转发给负责人）

### 给 DevOps（GitLab）的清单

```
项目：claw42 阿里云迁移 Phase 1

需要 DevOps 提供：

1. GitLab 仓库
   - 创建 claw42 仓库（建议路径：infra/claw42 或 frontend/claw42，按公司命名规则）
   - Master/Maintainer 权限给 Dan
   - 仓库 URL（HTTPS + SSH 都给）
   - 访问凭证（SSH key / Personal Access Token）

2. CI/CD 集成
   - GitLab Runner 是否可用？（如要自建，告诉我们规格）
   - 是否已有 ACR（阿里云容器镜像服务）账号 + 推送权限？
   - .gitlab-ci.yml 模板（如公司有标准）

3. 镜像同步
   - GitHub agentxmain-collab/claw42 → 公司 GitLab 同步方案：
     a. webhook + 镜像 cron job
     b. 手动 push（每次 release）
     c. 完全切（GitHub 不再用）
   - 公司倾向哪种？
```

### 给运维（阿里云）的清单

```
项目：claw42 阿里云迁移 Phase 1

需要运维分配阿里云资源：

阿里云账号
- 是否使用 CoinW 已有阿里云账号子账号？还是单独申请？
- Region：建议跟公司主 infra 相同 region（华东1 / 华北2 / 香港 任选）
- VPC：使用公司已有 VPC 或新建？

ECS 实例（建议规格）
- 规格：ecs.g7.large（2vCPU / 8GB）—— 起步够用，按需升级
- 镜像：Ubuntu 22.04 LTS / Aliyun Linux 3
- 系统盘：100GB ESSD
- 数量：2 台（主备 / 灰度）
- 公网带宽：5Mbps（按 SLB 进，ECS 内网即可）
- 安全组：仅开 SSH（运维白名单）+ 内网 80/443 给 SLB

Tair Redis
- 实例规格：1G 内存 / 主从双副本
- 用途：替代 Vercel KV（claw42 业务 cache + lock + rate-limit + budget tracker）
- 内网访问 only（不暴露公网）
- 持久化：开启 RDB（每日备份）

SLB（负载均衡）
- 类型：CLB 或 ALB（按公司标准）
- 监听：HTTPS 443（→ ECS 80）+ HTTP 80 转 443
- 健康检查路径：/api/health
- SSL 证书：从公司提供的域名申请阿里云 SSL（或 Let's Encrypt）

CDN（可选）
- 阿里云 CDN
- 加速静态资源（_next/static/*）
- 源站：SLB IP / 域名

域名解析
- 公司提供的域名 → 加 A 记录指向 SLB 公网 IP
- 或 CNAME 到 SLB 域名

监控 + 日志
- SLS（日志服务）：ECS stdout 收集
- ARMS（应用监控）：Node.js Agent 接入
- 告警：钉钉群（公司用什么用什么）
- 备份：ECS 系统盘 + Tair RDB

防火墙 / WAF
- WAF：CC 防护 + SQL 注入（按公司标准）
- DDoS 防护（按公司标准）
```

### 给 Dan 的工作清单（你自己做的）

```
1. 给 DevOps 提需求 → 拿到 GitLab 仓库地址 + 凭证
2. 给运维提需求 → 拿到 ECS 公网 IP / SLB IP / Tair 内网地址 / 阿里云 region
3. 给 Codex 拿到的资源信息 → 我（Session C）整合进 deploy 脚本
4. 提供公司给的域名（具体什么域名）
```

---

## § 4. Phase 1.3 — CICD Pipeline 配置

### 文件

```
.gitlab-ci.yml                      # 新建：build + push + deploy
Dockerfile                          # 新建：基于 node:22-alpine
docker-compose.yml                  # 可选，dev 用
deploy/                             # 新建目录
├── ecs-deploy.sh                   # ECS 部署脚本（pull image + restart service）
├── healthcheck.sh                  # 部署后 health 验证
└── rollback.sh                     # 回滚脚本
```

### `.gitlab-ci.yml`（标准模板，运维或 Dan 按公司 GitLab Runner 调整）

```yaml
stages:
  - build
  - test
  - deploy

variables:
  NODE_VERSION: "22"
  ACR_REGISTRY: "registry.cn-hangzhou.aliyuncs.com/coinw-claw42" # 待运维确认
  IMAGE_NAME: "$ACR_REGISTRY/claw42:$CI_COMMIT_SHORT_SHA"

build:
  stage: build
  image: node:$NODE_VERSION-alpine
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - .next/standalone/
      - .next/static/

docker-build:
  stage: build
  needs: [build]
  image: docker:24
  services: [docker:24-dind]
  script:
    - docker build -t $IMAGE_NAME -f Dockerfile .
    - docker login $ACR_REGISTRY -u "$ACR_USER" -p "$ACR_PASS"
    - docker push $IMAGE_NAME

verify:
  stage: test
  image: node:$NODE_VERSION-alpine
  services: [redis:7-alpine]
  variables:
    REDIS_URL: "redis://redis:6379"
  script:
    - npm ci
    - npx tsc --noEmit
    - npm run lint
    - npm run verify:chat-v3-final
    - npm run test:signal-engine
    - npm run test:kv-lock
    - npm run test:kv-rate-limiter
    - npm run test:kv-quota
    - npm run verify:metrics

deploy:
  stage: deploy
  image: alpine:latest
  only: [main] # 仅 main 分支自动部署
  script:
    - apk add --no-cache openssh-client bash
    - eval $(ssh-agent -s)
    - echo "$ECS_SSH_KEY" | tr -d '\r' | ssh-add -
    - ssh -o StrictHostKeyChecking=no $ECS_USER@$ECS_HOST "bash deploy/ecs-deploy.sh $IMAGE_NAME"
    - ssh -o StrictHostKeyChecking=no $ECS_USER@$ECS_HOST "bash deploy/healthcheck.sh"
```

### `Dockerfile`

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### `deploy/ecs-deploy.sh`

```bash
#!/bin/bash
set -e
IMAGE=$1

# Pull new image
docker login registry.cn-hangzhou.aliyuncs.com -u "$ACR_USER" -p "$ACR_PASS"
docker pull "$IMAGE"

# Stop + remove old container
docker stop claw42 || true
docker rm claw42 || true

# Start new container
docker run -d \
  --name claw42 \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /etc/claw42/.env \
  "$IMAGE"

# Wait for health
sleep 5
echo "Deploy completed: $IMAGE"
```

### `deploy/healthcheck.sh`

```bash
#!/bin/bash
set -e
for i in {1..30}; do
  status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
  if [ "$status" = "200" ]; then
    echo "Health check passed"
    exit 0
  fi
  sleep 2
done
echo "Health check failed after 60s"
exit 1
```

### `deploy/rollback.sh`

```bash
#!/bin/bash
set -e
# Rollback to previous image (从 docker images 找 second latest claw42 image)
PREVIOUS=$(docker images --format '{{.Tag}}' registry.cn-hangzhou.aliyuncs.com/coinw-claw42/claw42 \
  | grep -v latest | head -2 | tail -1)

bash deploy/ecs-deploy.sh "registry.cn-hangzhou.aliyuncs.com/coinw-claw42/claw42:$PREVIOUS"
echo "Rolled back to $PREVIOUS"
```

### 验收标准

- [ ] GitLab CI pipeline 成功 build + push image to ACR
- [ ] verify stage 全绿
- [ ] deploy stage 成功 SSH 到 ECS + 启动新 container
- [ ] healthcheck 通过

---

## § 5. Phase 1.4 — 部署 + 切换 + 退役

### 部署顺序

```
Day 1（公司侧资源到位后）：
  1. 公司 GitLab 仓库 init + push prod-snapshot 代码
  2. ACR 推送测试镜像
  3. ECS 拉取 + 启动 → 内网测试 health endpoint

Day 2-3（运维 + Dan 联调）：
  4. SLB 配置 + SSL 证书安装
  5. Tair Redis 联通测试
  6. EventBridge cron 配置
  7. SLS 日志接入

Day 4（DNS 切换）：
  8. 公司域名 DNS A/CNAME → 阿里云 SLB
  9. 等待 DNS TTL 生效（一般 5-30 min）
  10. curl 公司域名 → 应该到 ECS

Day 5-11（观察期 7 天）：
  11. 监控阿里云流量 + 错误率
  12. 监控 Vercel 流量是否还有残留请求（DNS 缓存未刷新的）
  13. 对比阿里云 vs Vercel 数据一致性

Day 12（Vercel 退役）：
  14. Vercel claw42-site 项目降级（保留为 staging URL，关闭 prod）
  15. 或完全删除（按公司决定）
```

### 切换风险点

| 风险                       | 应对                                                                     |
| -------------------------- | ------------------------------------------------------------------------ |
| DNS 切换时 prod 短暂不可用 | 选业务低峰期切；TTL 提前降低到 60s                                       |
| ECS 出问题                 | 快速 rollback 到 Vercel（DNS 切回）                                      |
| Tair 数据丢失              | RDB 每日备份 + 可从 Vercel KV 重新构造（cache 是冗余数据，丢了也不致命） |
| 公司域名 SSL 证书过期      | 用阿里云免费 SSL + auto-renew                                            |
| EventBridge cron 不触发    | health check + alert，第 1 周人肉巡检                                    |

---

## § 6. 总体验收

### Phase 1.1 完成（Code 改造）

- [ ] PR `feature/aliyun-migration-phase1` 通过 review + merge 到 `prod-snapshot-2026-05-08`
- [ ] 该分支可以独立 Docker build 跑起来 + 全套 verify 绿

### Phase 1.2 完成（公司侧资源）

- [ ] GitLab 仓库地址 + 凭证（Dan collect）
- [ ] ECS / Tair / SLB / 域名 / SSL 全配置完毕（运维 collect）

### Phase 1.3 完成（CICD）

- [ ] GitLab CI 跑通 build + push + deploy
- [ ] healthcheck 通过

### Phase 1.4 完成（切换）

- [ ] DNS 切到阿里云
- [ ] 7 天观察期错误率 < 1%
- [ ] Vercel prod 退役

---

## § 7. 失败处理 + 回滚

任何 Phase 失败 → **DNS 切回 Vercel**（保 prod 可用）+ Codex / 运维定位问题 + 重 deploy。

回滚命令：

```bash
# 在公司域名 DNS 控制台
A/CNAME 改回 Vercel 提供的 IP/CNAME
# TTL 60s 内生效
```

Vercel prod 在 Phase 1.4 第 7 天才退役，**期间始终可作为 fallback**。

---

## § 8. 文档元信息

- **创建**：2026-05-08 by Session C
- **基础**：Dan 拍板 ECS + CICD + 公司提供域名/GitLab/运维 + 迁第一个版本
- **决策版本**：phase-1-locked
- **下次允许变更**：(a) Phase 1.1 实施暴露 Vercel-specific 隐藏依赖 / (b) 阿里云资源到位后实测发现规格不够 / (c) Phase 2 启动时回写

---
