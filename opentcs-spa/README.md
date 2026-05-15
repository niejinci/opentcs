# opentcs-spa

> openTCS 单页前端（Single-Page Application）。MVP 目标：地图三件套上传 → 画布编辑工厂模型 → 发布到 openTCS Kernel → 创建运输订单 → 通过 BFF 的 SSE 实时观察 AGV 状态。

**当前状态：S1（项目脚手架 + Hello World）已完成；本目录已具备最小可运行的 Vue 3 + TypeScript + Vite 工程。**

## 文档入口

- 主时间线：[`/docs/spa-frontend-roadmap.md`](../docs/spa-frontend-roadmap.md)
- 架构 / 技术栈 / 目录 / 接口契约 / ADR：[`/docs/spa-frontend-architecture.md`](../docs/spa-frontend-architecture.md)
- 配套 BFF 模块：[`/opentcs-bff`](../opentcs-bff)
- 共识基线：[`/chat-with-ai/20-agv地图适配到opentcs.md`](../chat-with-ai/20-agv地图适配到opentcs.md)

## 技术栈一句话

Vue 3 + TypeScript + Vite + Pinia + vue-konva + Element Plus + js-yaml + openapi-typescript / openapi-fetch + Vitest。

## Quickstart

> 前置：Node.js ≥ 20.10、pnpm 9（`corepack enable && corepack prepare pnpm@9.12.3 --activate`）。

```bash
# 1. 安装依赖（pnpm-lock.yaml 已提交，锁定版本）
pnpm install

# 2. 启动 dev-server，浏览器自动打开 http://localhost:5173
pnpm dev
# 看到页面标题 "openTCS SPA" 即 S1 完成

# 3. 其他常用脚本
pnpm typecheck     # vue-tsc 严格类型检查
pnpm build         # 产出到 dist/
pnpm preview       # 本地预览生产构建
pnpm lint          # ESLint 9（flat config）
pnpm format        # Prettier --write
```

### 与 BFF 联调

dev-server 在 `vite.config.ts` 中通过 `server.proxy` 把以下路径反代到 `opentcs-bff`（默认 `http://localhost:8090`），保持同源避免 CORS：

| 路径         | 用途                                                           |
| :----------- | :------------------------------------------------------------- |
| `/api/*`     | BFF REST 接口（车辆 / 运输订单 / 后续工程接口）                |
| `/health`    | BFF 联通性自检（S1/S2 验收）                                   |
| `/openapi/*` | BFF OpenAPI 原始 spec（S2 起 `openapi-typescript` codegen 源） |

启动顺序建议：先在另一个终端跑 `opentcs-bff`（`./gradlew :opentcs-bff:run`），再 `pnpm dev`。

### 环境变量

复制 `.env.example` 为 `.env.local`（已被 git 忽略）按需覆盖：

- `VITE_BFF_BASE_URL` — 生产部署若不走 nginx 同源反代时填 BFF 绝对 URL；dev 留空走 Vite proxy。
- `VITE_BFF_ACCESS_KEY` — 对应 BFF 配置 `bff.security.accessKey`，留空表示鉴权关闭（MVP dev 默认）。S2 起由 `src/api/client.ts` 注入 `X-Api-Access-Key` header。
