# opentcs-spa

> openTCS 单页前端（Single-Page Application）。MVP 目标：地图三件套上传 → 画布编辑工厂模型 → 发布到 openTCS Kernel → 创建运输订单 → 通过 BFF 的 SSE 实时观察 AGV 状态。

**当前状态：S0（技术栈与架构定型）已完成；本目录尚无源码，由 S1（项目脚手架）创建。**

## 文档入口

- 主时间线：[`/docs/spa-frontend-roadmap.md`](../docs/spa-frontend-roadmap.md)
- 架构 / 技术栈 / 目录 / 接口契约 / ADR：[`/docs/spa-frontend-architecture.md`](../docs/spa-frontend-architecture.md)
- 配套 BFF 模块：[`/opentcs-bff`](../opentcs-bff)
- 共识基线：[`/chat-with-ai/20-agv地图适配到opentcs.md`](../chat-with-ai/20-agv地图适配到opentcs.md)

## 技术栈一句话

Vue 3 + TypeScript + Vite + Pinia + vue-konva + Element Plus + js-yaml + openapi-typescript / openapi-fetch + Vitest。

## Quickstart

> 占位 —— 由 **S1（项目脚手架）** 补全：`pnpm install` → `pnpm dev` → 浏览器打开 `http://localhost:5173`，dev-server 自动把 `/api/*` 反代到 `http://localhost:8090`（`opentcs-bff`）。
