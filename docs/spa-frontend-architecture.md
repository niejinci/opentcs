# openTCS SPA 前端 架构定型 (R0 产物)

> 配套：[`spa-frontend-roadmap.md`](./spa-frontend-roadmap.md)
> 受众：C++ 后端背景、零前端基础的开发者。文中第一次出现的前端术语都给一个 C++ 类比。

---

## 1. 技术栈选型对比表

每一项给「推荐 / 备选 1 / 备选 2 / 一句话理由」。MVP 强约束：**学习曲线平缓 / 生态成熟 / 有 TS 支持 / Canvas 库成熟 / 与现有 BFF 调试友好**。

| # | 维度 | 推荐 | 备选 1 | 备选 2 | 一句话理由 |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | 仓库放置 | **本仓库内新模块 `opentcs-spa/`**（与 `opentcs-bff` 平级） | 独立 repo `opentcs-spa` | 放进 `opentcs-bff/frontend/` 子目录 | 与 BFF 同仓便于跨端契约改动一次提交、CI 一次跑完；不放 BFF 子目录是因为 SPA 用 npm 体系，混在 Gradle 模块里污染构建拓扑 |
| 2 | 语言 | **TypeScript 5.x** | JavaScript (ES2022) | ReScript / Elm | C++ 出身的人对"显式类型 + 编译期检查"零阻力；BFF 已有 OpenAPI，TS 可一键 codegen 出强类型客户端 |
| 3 | UI 框架 | **Vue 3 + 组合式 API（`<script setup>`）** | React 18 + Hooks | Svelte 5 | Vue 学习曲线最平：单文件 `.vue` ≈ "一个组件一个 .h+.cpp"；模板语法接近 HTML；中文资料最丰富；Konva 与 Vue 集成成熟（vue-konva） |
| 4 | 构建工具 | **Vite 5** | Webpack 5 | Rspack | 零配置开箱、热更新毫秒级、对 Vue/TS/PNG/YAML 都内置支持；C++ 类比 = 不用写 CMake 直接 `cmake --build` 就跑 |
| 5 | 包管理 | **pnpm 9** | npm | yarn | 磁盘占用最小、`pnpm-workspace` 后续接多包友好；C++ 类比 = 像 vcpkg 用硬链接共享缓存 |
| 6 | 路由 | **vue-router 4** | （无） | — | SPA 多页面切换标准件；MVP 至少需要 /import、/editor、/orders、/dashboard 四个路由 |
| 7 | 状态管理 | **Pinia 2** | Vuex 4 | 仅用 ref/provide-inject | Vue 官方推荐替代 Vuex；store 写法接近"普通 TS class"，C++ 类比 = 进程内单例服务 |
| 8 | Canvas 绘图 | **Konva 9 + vue-konva 3** | Fabric.js | PixiJS | Konva 抽象 = "图层 Layer + 形状 Shape + 事件"，与本场景（底图层 + 标注层 + 选择层）天然契合；vue-konva 用 Vue 模板写图形；PixiJS 偏游戏 / WebGL 重，超 MVP 范围 |
| 9 | YAML 解析 | **js-yaml 4** | yaml | — | 解析 ROS map.yaml（resolution / origin / image）的事实标准库，零学习成本 |
| 10 | HTTP 客户端 | **fetch + 自封 wrapper** | axios | ky | 浏览器原生 fetch + TS 类型从 OpenAPI 生成，足够；不引 axios 减少依赖 |
| 11 | SSE 客户端 | **浏览器原生 `EventSource` + 自封重连** | sse.js | @microsoft/fetch-event-source | 与 BFF `/api/v1/sse` 完全兼容；MVP 用 GET + Header 鉴权（access-key 走 query 或 cookie，详见「接口契约」一节）；`fetch-event-source` 仅在需要自定义 header 时才引 |
| 12 | OpenAPI 客户端代码生成 | **openapi-typescript + openapi-fetch** | swagger-codegen-cli | 手写类型 | `openapi-typescript` 把 `bff.yaml` → 一份 `.d.ts` 类型；`openapi-fetch` 用这份类型给 fetch 加端到端类型安全；与 BFF 已用的 `org.openapi.generator` Java 侧对称 |
| 13 | UI 组件库 | **Element Plus 2**（Vue 3 生态） | Naive UI | Ant Design Vue | 表单/表格/对话框/通知齐全、中文文档、与 Vue 3 + TS 兼容好；只用必要组件、按需引入避免包体爆炸 |
| 14 | 样式 | **CSS + CSS Variables**（必要时引 UnoCSS） | Tailwind CSS | SCSS | MVP 不需要复杂设计系统；Element Plus 主题用 CSS 变量覆盖即可 |
| 15 | 测试 | **Vitest + @vue/test-utils** | Jest + Vue Test Utils | Cypress (e2e) | Vitest 由 Vite 团队出，与构建一致；store/util 单测优先；e2e 留 S10 视情况引 Playwright |
| 16 | 代码风格 | **ESLint 9 (flat config) + @vue/eslint-config-typescript + Prettier** | Biome | StandardJS | 与 BFF 的 Spotless 哲学一致：CI 强制风格；Prettier 管格式、ESLint 管错误模式 |
| 17 | 国际化 | **vue-i18n 9（仅装文案表，MVP 默认 zh-CN）** | （无） | — | 留扩展位但不展开；所有文案抽常量便于后续翻 |
| 18 | 容器化 | **Vite build → Nginx alpine 静态托管** | Caddy | 直接由 BFF 静态托管 | 前后端分离最干净；S10 的 docker-compose 里 nginx 反代 `/api/*` & `/api/v1/sse` → BFF（关闭 buffering 以兼容 SSE） |
| 19 | 与 BFF 联调 | **Vite dev-server `server.proxy`** 把 `/api` 反代到 `localhost:8090` | nginx | 浏览器 CORS + BFF 放开 | dev 模式同源避免 CORS；prod 由 nginx 同样反代 |

### 1.1 决策摘要（一句话）

**Vue 3 + TypeScript + Vite + Pinia + vue-konva + Element Plus + js-yaml + openapi-typescript/fetch + Vitest + ESLint/Prettier；与 BFF 通过 Vite proxy / nginx 同源调用，SSE 用浏览器原生 EventSource。**

不选 React 是为了把"零基础后端开发者"这条主约束拉满（Vue 模板 ≈ HTML，比 JSX 直观）；不选 Spring Boot 风格的全家桶（Nuxt/Quasar）是为了把"可控、能 review"放在"开箱即用"前面。

---

## 2. 目录结构（S1 起的脚手架基线）

```
opentcs-spa/
├── README.md                      ← 占位 (R0 已交付)，S1 起补 Quickstart
├── package.json                   ← S1 创建
├── pnpm-lock.yaml                 ← S1 由 pnpm install 生成
├── tsconfig.json
├── tsconfig.node.json             ← Vite 配置文件用
├── vite.config.ts                 ← 含 server.proxy → BFF 8090
├── index.html                     ← 单 HTML 入口（SPA 只有这一个 .html）
├── .env.example                   ← VITE_BFF_BASE_URL / VITE_BFF_ACCESS_KEY
├── .eslintrc.cjs / eslint.config.ts
├── .prettierrc.json
├── public/                        ← 不经构建直接拷贝的静态资源
│   └── favicon.svg
├── docs/                          ← 模块内部文档
│   ├── data-model.md              ← S5 起：SPA 中间态 JSON Schema（核心活文档）
│   └── api-contract.md            ← S2 起：调 BFF 的接口清单 + mock 示例
└── src/
    ├── main.ts                    ← 应用入口（C++ 类比：main()）
    ├── App.vue                    ← 根组件
    ├── router/
    │   └── index.ts               ← 路由定义：/import /editor /orders /dashboard
    ├── api/                       ← S2 重点
    │   ├── client.ts              ← 自封 fetch wrapper（注入 X-Api-Access-Key、统一错误）
    │   ├── sse.ts                 ← EventSource 封装 + 重连
    │   ├── generated/             ← openapi-typescript 输出的 .d.ts，不手改
    │   └── endpoints/
    │       ├── vehicles.ts
    │       ├── transportOrders.ts
    │       ├── projects.ts        ← S7 新增：草稿/工程
    │       └── plantModels.ts     ← S8 新增：发布
    ├── stores/                    ← Pinia store
    │   ├── editor.ts              ← 当前画布状态、撤销重做栈
    │   ├── project.ts             ← 当前工程草稿、保存/打开
    │   ├── vehicles.ts            ← SSE 实时车队
    │   └── orders.ts
    ├── views/                     ← 页面级组件（路由出口）
    │   ├── ImportView.vue         ← S3
    │   ├── EditorView.vue         ← S4–S6
    │   ├── OrdersView.vue         ← S9
    │   └── DashboardView.vue
    ├── components/                ← 可复用 UI
    │   ├── canvas/
    │   │   ├── MapStage.vue       ← Konva 根 Stage
    │   │   ├── BackgroundLayer.vue← 底图（PNG）
    │   │   ├── AnnotationLayer.vue← 用户标注
    │   │   └── tools/             ← PointTool / PathTool / SelectTool …
    │   ├── property/              ← 右侧属性面板
    │   └── common/                ← 通用 UI（Toolbar / StatusBar / FileDrop）
    ├── domain/                    ← 与 UI 解耦的纯逻辑（无 DOM/无 Vue）
    │   ├── geometry/
    │   │   ├── affine.ts          ← 像素↔米 仿射 (S3)
    │   │   └── bbox.ts
    │   ├── yaml/
    │   │   └── parseRosMapYaml.ts ← S3
    │   ├── model/                 ← SPA 中间态类型 + 校验
    │   │   ├── types.ts           ← Point/Path/Location/Block/Vehicle 中间态接口
    │   │   └── validate.ts
    │   └── publish/
    │       └── toPlantModelTO.ts  ← S8：中间态 → PlantModelCreationTO 镜像 JSON
    ├── i18n/
    │   └── zh-CN.ts
    ├── styles/
    │   └── global.css
    └── env.d.ts                   ← Vite + import.meta.env 类型补丁

tests/                             ← 与 src/ 同级的纯单测目录
├── domain/
│   ├── geometry/affine.spec.ts
│   └── yaml/parseRosMapYaml.spec.ts
└── stores/
    └── editor.spec.ts
```

**目录设计 3 条原则**：
1. `domain/` 完全不依赖 Vue/DOM —— C++ 类比：把"业务模型 + 算法"和"GUI"分离，便于纯函数单测。
2. `api/` 是 BFF 通信唯一入口 —— 任何组件不准 `fetch(...)`，必须经 `api/endpoints/`。
3. `stores/` 是跨组件状态唯一入口 —— 组件内只放 UI 局部状态（`ref`/`reactive`），跨组件共享统一上 Pinia。

---

## 3. 与 BFF 的接口契约清单

### 3.1 现有 BFF 接口（已落地，参见 `opentcs-bff/src/main/resources/openapi/bff.yaml`）

| 方法 | 路径 | 用途 | 出现在哪个 S |
| :--- | :--- | :--- | :--- |
| GET | `/health` | BFF 健康检查 | S1 / S2 联通性自检 |
| GET | `/api/v1/vehicles` | 列出 Kernel 中所有车辆 | S6（编辑器选车下拉）/ S9（订单选车）/ Dashboard |
| GET | `/api/v1/vehicles/{name}` | 单车详情 | S9 |
| POST | `/api/v1/transport-orders` | 创建运输订单（body = `TransportOrderRequest`，含 `destinations[].operation` 字符串，可填 `LIFT` / `DROP`） | S9 |
| GET | `/api/v1/sse?vehicles=true&transportOrders=true` | SSE 长连接，事件名 `/events/vehicles` 和 `/events/transportOrders`，data 为 `SseEventEnvelope` JSON | S9（实时车辆/订单可视化） |
| GET | `/openapi/bff.yaml` | OpenAPI 原始 spec | S2（codegen 源） |
| GET | `/swagger-ui` | Swagger UI | 联调辅助 |

**鉴权**：`X-Api-Access-Key` header（`bff.security.accessKey`）。当配置为空字符串时鉴权关闭，MVP dev 默认空。SPA 在 `client.ts` 统一注入；EventSource 不能加 header，因此 SSE 在 BFF 启用鉴权时需走 query（如 `?accessKey=…`）—— **此点在 S2 启动前先与 BFF 侧确认是否需要补一个 SSE accessKey query 参数**（如 BFF 当前未支持，按"MVP dev 鉴权关闭"原则规避）。

### 3.2 待新增 BFF 接口（在对应 S 启动当轮，由 BFF 侧先加）

> 以下都是 SPA 端发起的需求，需要在每个 S 起手 PR 之前在 BFF 侧补好；先列契约草案，最终以当时实际合并的 `bff.yaml` 为准。

| 出现 S | 方法 | 路径 | 用途 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| S7 | GET | `/api/v1/projects` | 列出本机所有工程草稿 | 按 BFF 文件存储约定（见 §6） |
| S7 | POST | `/api/v1/projects` | 创建新工程（body：`{name}`） | 返回工程 id |
| S7 | GET | `/api/v1/projects/{id}` | 取工程元数据 + 草稿 JSON | |
| S7 | PUT | `/api/v1/projects/{id}/draft` | 全量保存草稿 JSON | MVP 用 PUT，不做 PATCH 增量 |
| S7 | DELETE | `/api/v1/projects/{id}` | 删工程 | |
| S7 | POST | `/api/v1/projects/{id}/assets` | 上传三件套（multipart：png/pgm/yaml） | 流式写入 `data/projects/{id}/assets/` |
| S7 | GET | `/api/v1/projects/{id}/assets/{name}` | 读取资产（前端用作 PNG 底图源） | |
| S8 | POST | `/api/v1/plant-models/publish` | body：发布请求 `{projectId, plantModel: PlantModelTO 镜像 JSON}`；BFF 反序列化为 `PlantModelCreationTO` 经 RMI `KernelServicePortal.getPlantModelService().createPlantModel(...)` 写入 Kernel | 失败返回 400/503 + ErrorResponse |
| S8 | GET | `/api/v1/plant-models/current` | 拉当前 Kernel 中工厂模型（用于发布前 diff 预览） | |

### 3.3 中间态 JSON ↔ `PlantModelCreationTO` 的对齐原则（强约束）

来源于 `chat-with-ai/20-agv地图适配到opentcs.md` §3 共识：**SPA 中间态 JSON 字段名/单位/嵌套结构 = `PlantModelCreationTO` 的镜像**。即 Point 用 mm `Triple`、Path 用 mm 的 length 与 mm/s 的 maxVelocity、name 在编辑期就生成合法值。S8 的转换层只做"反序列化 + 校验 + 调 RMI"，**不做字段翻译**。详细 schema 在 S5 起的 `opentcs-spa/docs/data-model.md` 中演进维护，并标记每个字段对应的 TO 类与字段。

---

## 4. 分支与 PR 策略

参考"长期 feature 分支 + squash merge"模型（详见上一轮回答）：

| 层级 | 颗粒 | 大小目标 | 合并策略 |
| :--- | :--- | :--- | :--- |
| L0 基线 PR | 脚手架（S1）/ 大版本依赖升级 | 一次性大 PR | squash → main |
| L1 里程碑 PR | 一个 S 的最终汇总 | 500–1500 行 | squash → main，标题 `feat(spa): S{N} <主题>` |
| L2 子任务 PR | L1 内部一步 | < 500 行 | merge 到 `feat/spa-s{N}-<主题>` 分支 |
| L3 修复 PR | bugfix / 文档 / 样式 | < 100 行 | 直连 main |

**4 条工程纪律**：
1. PR 描述强制三段式：① 关联里程碑 / 上一 PR 号；② 本 PR 引入/修改的设计决策；③ 留给下一 PR 的 TODO。
2. 设计决策走 ADR（`docs/adr/NNNN-标题.md`，10 行内）。
3. `store_memory` 仅记工具/约定（lint/构建命令、Konva 坑等），**业务设计走 ADR + 仓库文档**。
4. 每个 S 结束追加 ≤30 行的"S{N} 完工备忘"到本文件末尾（已完成模块、已知坑、下一阶段入口文件）。

---

## 5. 关键设计决策

### ADR-0001：选用 Vue 3 + TypeScript + Konva 作为 SPA 主栈

- **状态**：Accepted（2026-05-14，R0 定型）
- **背景**：MVP 必须 ① 让零前端基础的后端开发者能 review；② Canvas 编辑（点/线/区域 + 缩放平移）成熟；③ 与已落地的 Javalin BFF（OpenAPI + SSE）契合；④ 不依赖 DB，工程数据走文件。
- **决策**：前端使用 Vue 3 (`<script setup>` + 组合式 API) + TypeScript 5；构建用 Vite 5；状态用 Pinia；画布用 Konva 9 + vue-konva 3；UI 组件用 Element Plus；HTTP 类型由 `openapi-typescript` 从 BFF 的 `bff.yaml` 生成，运行时用浏览器原生 `fetch` / `EventSource` 并自封 client。
- **替代方案**：
  - **React 18 + Konva**：生态最大，但 JSX + Hook 闭包陷阱对零基础读者不友好；
  - **Svelte 5**：写法最简，但中文资料少、Konva 集成弱；
  - **Spring 全家桶 SSR (Thymeleaf)**：与"SPA + 独立后台 = 方案 A"主架构冲突，已在 §2 共识中排除；
  - **Nuxt / Quasar 全家桶**：自动化好但黑盒多，不利于"能 review、能续接"。
- **后果**：
  - 正面：模板语法接近 HTML，C++ 出身上手快；vue-konva 让画布元素也能用模板表达；BFF 改 openapi 后跑一次 codegen 即得 TS 类型；与 BFF 同源部署 = 零 CORS。
  - 负面：Element Plus 全量包体偏大（按需引入缓解）；vue-konva 在大量节点（>10k）有性能上限（MVP 远不到）；Konva 没有内置撤销/重做（自己用 Pinia + immer 维护栈，工作量可控）。
- **撤销条件**：若进入 v2 需要协同编辑/CRDT/复杂动画/3D，重新评估 React + Yjs 或 PixiJS。

### ADR-0002：MVP 工程数据存为 BFF 本地文件，不引 DB

- **状态**：Accepted（2026-05-14，R0 定型）
- **决策**：草稿 JSON 与三件套资产由 BFF 写本地文件系统（路径见 §6），不引入 MySQL/PG。
- **替代**：① SQLite（部署仍简单但加 schema 维护成本）；② BFF 直接放 SPA 的 `localStorage`（无法多端共享）。
- **后果**：MVP 启动成本最低；多人协作受限（v2 引 DB 时按工程目录批量迁移）；没有事务，靠"全量 PUT 草稿"避开并发覆盖问题。

### ADR-0003：SPA 中间态 JSON = `PlantModelCreationTO` 的镜像

见 §3.3，遵循 `chat-with-ai/20-agv地图适配到opentcs.md` §3 共识。

---

## 6. 文件存储约定（BFF 侧）

约定 BFF 配置项 `bff.workspace.dir`（默认 `./data/bff-workspace/`）：

```
${bff.workspace.dir}/
└── projects/
    └── {projectId}/                  ← UUID 或用户起的 slug
        ├── meta.json                 ← {id, name, createdAt, updatedAt}
        ├── draft.json                ← SPA 中间态（PlantModelCreationTO 镜像 + 编辑期辅助字段如像素坐标）
        ├── publishHistory/           ← 每次发布留档（按 ISO 时间命名）
        │   └── 2026-05-14T10-00-00.json
        └── assets/
            ├── SS27.png
            ├── SS27.pgm
            └── SS27.yaml
```

S7 BFF 接口实现要点：① 全部走流式 IO；② `meta.json` 写入用 "写临时文件 + 原子 rename"；③ projectId 校验为 `[a-z0-9_-]{1,64}` 防路径穿越。

---

## 7. 跨对话上下文持久化机制

为了对抗"PR 合并后上下文丢失"，下面三类信息**全部沉淀在仓库内**而非聊天记录里：

| 信息类型 | 落点 |
| :--- | :--- |
| 里程碑节奏 / 验收 | `docs/spa-frontend-roadmap.md`（本文件配套） |
| 技术栈 / 目录 / 设计决策 | `docs/spa-frontend-architecture.md`（本文件） |
| ADR | `docs/adr/NNNN-*.md` |
| 中间态 JSON Schema | `opentcs-spa/docs/data-model.md`（S5 起） |
| BFF 接口实际形态 | `opentcs-bff/src/main/resources/openapi/bff.yaml` + `opentcs-spa/docs/api-contract.md` |
| 每个 S 的"完工备忘" | 本文件末尾 §9 追加 |

下一轮对话开始时，模型先读这些文件就能完整恢复上下文，不依赖之前的聊天历史。

---

## 8. S1 起手清单（验收用）

读完本文件你应该能立即回答：

| 问题 | 答案 |
| :--- | :--- |
| 用什么框架？ | Vue 3 + TypeScript + Vite + Pinia + vue-konva + Element Plus |
| 模块放哪？ | 仓库根目录 `opentcs-spa/`，与 `opentcs-bff/` 平级 |
| 目录结构？ | 见 §2，关键三层：`api/` 通信、`stores/` 跨组件状态、`domain/` 纯逻辑 |
| **S1 起手做哪个文件？** | 第一步 `opentcs-spa/package.json`（声明 Vue / Vite / TS 依赖）；第二步 `vite.config.ts`（含 `server.proxy: { '/api': 'http://localhost:8090', '/health': 'http://localhost:8090' }`）；第三步 `index.html` + `src/main.ts` + `src/App.vue` 三件套，跑通 `pnpm dev` 浏览器看到 "openTCS SPA"；第四步 `.env.example` + `vite-env.d.ts` 把 `VITE_BFF_BASE_URL` 类型化。这一组共构成 S1 的 L0 基线 PR。 |
| 与 BFF 怎么联调？ | dev 用 Vite proxy 走同源；prod 由 nginx 反代。SSE 在反代要关 buffering。 |
| 鉴权怎么注入？ | `client.ts` 统一加 `X-Api-Access-Key`；MVP dev 默认空字符串=关闭。 |
| 中间态 JSON 是啥？ | `PlantModelCreationTO` 的镜像（mm + Triple + 合法 name），加少量编辑期辅助字段。详见 ADR-0003 与 §3.3。 |

---

## 9. 阶段完工备忘（每个 S 完成后追加）

> 模板：
> ### S{N}（YYYY-MM-DD）<主题>
> - 已完成模块：…
> - 已知坑 / 待办：…
> - 下一阶段入口文件：…
> - 按照 docs/spa-frontend-roadmap.md 中 `2. 每个里程碑的"对话提问模板"` 输出下一轮对话(阶段)的提示词：…

### S0（2026-05-14）技术栈与架构定型
- 已完成：本文件 + `spa-frontend-roadmap.md` + `opentcs-spa/README.md` 占位
- 已知坑：BFF SSE 鉴权当前依赖 header（`X-Api-Access-Key`），EventSource 不能带 header；若 prod 启用鉴权，S2 之前需让 BFF 支持 `?accessKey=…` query 形式，或改用 `@microsoft/fetch-event-source`
- 下一阶段入口文件：`opentcs-spa/package.json`（S1 起手）

### S1（2026-05-14）项目脚手架 + Hello World
- 已完成模块：
  - `opentcs-spa/package.json`（vue 3.5、vite 5.4、typescript 5.6、vue-tsc 2.2、eslint 9 flat、prettier 3、@vitejs/plugin-vue；`packageManager` 锁 pnpm 9.12.3，`engines.node` ≥ 20.10）
  - `vite.config.ts`：`server.proxy` 反代 `/api`、`/health`、`/openapi` → `http://localhost:8090`，`@/* → src/*` alias，`build.target=es2022`
  - `tsconfig.json` + `tsconfig.node.json`（strict + noUnused* + Bundler 解析 + project references）
  - `index.html` + `src/main.ts` + `src/App.vue` + `src/styles/global.css` + `src/env.d.ts` + `public/favicon.svg`：`pnpm dev` 浏览器看到 "openTCS SPA"
  - `.env.example`（`VITE_BFF_BASE_URL` / `VITE_BFF_ACCESS_KEY` 占位 + 注释）
  - `eslint.config.js`（flat config：`eslint-plugin-vue/flat/recommended` + `@vue/eslint-config-typescript` + `@vue/eslint-config-prettier/skip-formatting`）+ `.prettierrc.json` + `.prettierignore` + `opentcs-spa/.gitignore`
  - `opentcs-spa/README.md` 更新 Quickstart（`pnpm install / dev / build / typecheck / lint / format`）与 BFF 联调说明
- 已验证命令（沙箱内全部成功）：`pnpm install` → `pnpm typecheck` → `pnpm build`（产出 `dist/index.html` + `assets/index-*.js` 61.6 kB gzip 24.8 kB）→ `pnpm lint` → `pnpm format:check` → `pnpm dev`（5173 端口起服务，`curl /` 200，`curl /api/v1/vehicles` 经代理转发，BFF 未起返回 500——证明代理已生效）
- 已知坑 / 待办：
  - **未引入** vue-router / Pinia / Element Plus / vue-konva / openapi-typescript / vitest，留给 S2+ 按需引入；S1 不写 `<RouterView />`，避免空路由配置噪音
  - sandbox 默认 `npm` 但本工程钉死 `pnpm 9`；新机器需先 `corepack enable && corepack prepare pnpm@9.12.3 --activate`，已写进 README
  - lockfile（`pnpm-lock.yaml`）已提交，遵循"L0 基线 PR 一次性大 PR"约定；S2+ 任何依赖新增/升级走单独 PR 评审
- 下一阶段入口文件：`opentcs-spa/src/api/client.ts`（S2 起手 —— HTTP wrapper + `X-Api-Access-Key` 注入 + 统一错误）

### S2（2026-05-15）BFF 接口对接基础设施
- 已完成模块：
  - `src/config/runtime.ts`：集中读取 `VITE_BFF_BASE_URL` / `VITE_BFF_ACCESS_KEY`，`bffUrl(path)` 同时兼容"dev 同源 + Vite proxy" 与 "prod 绝对地址"
  - `src/api/types/bff.ts`：手写 OpenAPI schema 镜像（`HealthResponse` / `Vehicle` / `Destination` / `TransportOrder` / `SseEventEnvelope<T>` / `BffErrorResponse` + 常量 `SSE_EVENT_VEHICLES` `SSE_EVENT_TRANSPORT_ORDERS`）；S2 不引 `openapi-typescript` 以保持基础设施层零新依赖，留给后续 sub-PR
  - `src/api/errors.ts`：`ApiError` / `HttpError`(含 `payload: BffErrorResponse | null` + `traceId`) / `NetworkError` / `ParseError` + `isApiError`
  - `src/api/client.ts`：唯一 `fetch` 包装；自动 `X-Api-Access-Key`、`Accept: application/json`；2xx 解析 JSON、非 2xx 解析 BFF `ErrorResponse` 抛 `HttpError`、`fetch` 自身失败抛 `NetworkError`；尊重 `AbortError` 透传；默认 `toastOnError: true`，可关闭
  - `src/api/sse.ts`：`SseClient` 状态机 `idle / connecting / open / reconnecting / closed`；按事件名（`/events/vehicles` / `/events/transportOrders`）分发并解析 `SseEventEnvelope`；指数退避 1→2→4→…→30s ±20% 抖动；`close()` 后不再重连
  - `src/api/endpoints/{health,vehicles}.ts` + `src/api/index.ts` 集中再导出
  - `src/ui/toast/{toastBus,ToastContainer.vue}`：极简 reactive 实现（无 Element Plus 依赖），分级 info/success/warning/error，`error` 默认粘性
  - `src/views/DebugView.vue`：`/health` 调用按钮 + SSE 连接/断开 + 实时事件日志 + 运行时配置展示，`App.vue` 挂载 DebugView 与 ToastContainer
  - `opentcs-spa/docs/api-contract.md`：S2 已封装 endpoint 清单 + curl 示例 + mock JSON
- 已验证命令（沙箱内全部成功）：`pnpm typecheck` → `pnpm lint`（0 errors / 0 warnings）→ `pnpm format:check` → `pnpm build`（产出 `dist/index.html` + `assets/index-*.js` 71.99 kB gzip 28.79 kB；CSS 3.82 kB gzip 1.29 kB）→ `pnpm dev`（5173 端口，`curl /` 200，`curl /api/v1/vehicles` 与 `curl /health` 经代理转发，BFF 未起返回 500/ECONNREFUSED——证明 client + 代理链路通）
- 已知坑 / 待办：
  - 仍未引 vue-router / Pinia / Element Plus / vitest；S3 起按需补
  - SSE 鉴权 query 参数 BFF 侧未支持，MVP dev 默认鉴权关闭；上 prod 前需 BFF 补 `?accessKey=` 或 SPA 改用 `@microsoft/fetch-event-source`
  - `BffErrorResponse` 等 schema 当前手写镜像，BFF 侧 `bff.yaml` 改动需在同一 PR 内同步本仓 `src/api/types/bff.ts`；S6+ 引入 `openapi-typescript` 后此约束消失
  - SSE 客户端尚无单测（`Math.random` 注入与 `EventSource` mock 留给 vitest 落地后补）
- 下一阶段入口文件：`opentcs-spa/src/views/ImportView.vue`（S3 起手 —— 三件套上传 + `parseRosMapYaml` + 仿射映射 + Konva 只读底图）

### S3（2026-05-20）地图导入：三件套上传 + yaml 解析 + 仿射映射
- 已完成模块：
  - `src/domain/yaml/parseRosMapYaml.ts`：ROS `map.yaml` 纯函数解析器（resolution / origin / image / negate / occupied_thresh / free_thresh），`RosMapYamlError` 统一报错，未知 key 与 `theta ≠ 0` 作软警告；**兼容 SS27 实际样本的非标准 `%YAML:1.0` 指令**（js-yaml 4 会拒绝，预处理时整行剥离，YAML 语义不受影响）
  - `src/domain/geometry/affine.ts`：`AffineMapping` + `pixelToWorld` / `worldToPixel` / `buildAffine`；遵循 ROS 约定（origin = 图像左下角的世界坐标，y 轴向上；image 像素系 y 轴向下），公式 `world = origin + (px, H - py) * resolution`；MVP 仅支持 theta = 0
  - `src/router/index.ts`：首次引入 vue-router 4（`createWebHistory`），路由 `/import`（默认）+ `/debug`，catch-all 回退到 `/import`；其余视图（editor / orders / dashboard）留给 S4+ 注册
  - `src/views/ImportView.vue`：三个 `<input type="file">` 分别接 png / pgm / yaml；PNG 通过 `URL.createObjectURL` + `<img>` 解码后绘制到原生 `<canvas>`（imageSmoothingEnabled = false，最长边自适应 ≤ 800 CSS px，不影响仿射数学）；mousemove 监听把 CSS 像素映射回自然像素再走 `pixelToWorld`；状态栏实时显示 `(px) → (m)`；文件名前缀对不上时弹软警告（`yaml.image` ↔ pgm 名、png ↔ pgm 名）；PNG 超 50 MiB 走 toastWarning 提醒（roadmap S3 风险行）；`onBeforeUnmount` 必 `revokeObjectURL` 防泄漏
  - `src/App.vue` 改为顶部导航 + `<RouterView />`；`src/main.ts` 接入 `router`
  - `opentcs-spa/docs/data-model.md`：中间态活文档占位，先描述 `BackgroundMap`（S3 唯一落地结构），后续 S5/S6/S7/S8 按表追加
- 已新增依赖（首次有 advisory 检查）：
  - `vue-router@^4.4.5`（GitHub advisory DB 无漏洞）
  - `js-yaml@^4.1.0` + `@types/js-yaml@^4.0.9`（无漏洞）
- 已验证命令（沙箱内全部成功）：
  - `pnpm typecheck` → 0 错；`pnpm lint` → 0 错；`pnpm format:check` → 全部符合；`pnpm build`（49 modules，`ImportView` chunk 49.10 kB gzip 17.52 kB；index chunk 92.09 kB gzip 36.27 kB）
  - 用 `tsx` 直接跑解析器 + 仿射对 `SS27/SS27.yaml` 做了正确性自检：`resolution=0.05, origin=(-195.2, -33.6)`；H=2000 时像素 (0, 2000) → 世界 (-195.2, -33.6)（左下角），像素 (0, 0) → 世界 (-195.2, 66.4)（左上角，y 翻转正确）；world↔pixel 往返误差 < 1e-13
- 已知坑 / 待办：
  - 仍未引 Konva / vue-konva（S4 起手再引）、Pinia（S5 起手）、Element Plus、vitest；S3 用原生 `<canvas>` 仅画一张图就够，避免提前架构化
  - 仿射 theta ≠ 0 当前只软警告并按 0 处理；rotated map 留 v2
  - PGM 不在前端渲染（浏览器无原生 P5 解码）；目前仅记录文件名 + 体积，留待 S7 与 png/yaml 一起 multipart 上 BFF
  - 三件套尚未上传到 BFF（草稿持久化是 S7 任务）；浏览器刷新即丢
  - SS27 实际样本里 origin 数值非常大（-195.2 m），上 S4 缩放/平移时要注意默认视口要居中或自适应，否则用户打开就看不到图
  - vue-router catch-all 在 SPA 静态托管下需要 nginx `try_files $uri /index.html;`（已在 S1 备忘 / S10 docker-compose 待办里）
- 下一阶段入口文件：`opentcs-spa/src/components/canvas/MapStage.vue`（S4 起手 —— 引入 vue-konva 9 / Konva 9，多图层 Stage + 缩放/平移 + 工具栏切换，从 `ImportView` 把原生 `<canvas>` 升级为 Konva BackgroundLayer）

### S4（2026-05-20）画布编辑器框架
- 已完成模块：
  - `src/composables/useBackgroundMap.ts`：模块级单例（`shallowRef<BackgroundMapState | null>` + `version` 计数）。S4 暂代 Pinia 充当 ImportView ↔ EditorView 的共享态；导出 `background`（`shallowReadonly`）/ `hasBackground` / `setBackgroundMap` / `clearBackgroundMap`。S5 起手将被 `useProjectStore()` 替换，API 形状刻意保持小以便机械迁移
  - `src/domain/editor/tools.ts`：编辑器工具枚举（`select` / `point` / `path`）+ `EditorToolMeta`（label / hotkey V/P/L / cursor / hint / milestone）+ `editorToolForHotkey()`，工具数据全部冻结
  - `src/components/canvas/MapStage.vue`：根 `<v-stage>`，**核心约定 Stage 局部坐标 ≡ 自然 PNG 像素坐标**（BackgroundLayer 始终在 (0,0) × imageWidth/Height 绘制；缩放/平移通过 Stage 的 scale + position 完成）。滚轮聚焦光标缩放（`[MIN_SCALE=0.05, MAX_SCALE=20]`，ZOOM_STEP=1.1）；按住 `Space` 把 `draggable=true` 翻成 `true` 触发 Konva 原生拖拽，`dragend` 同步回 `stageX/Y` ref；`ResizeObserver` 让 Stage 自适应容器；`fitToContainer()`（首次度量 + 图像换源时自动重拟，向外通过 `defineExpose` 暴露为 `resetView`）；`#status` 作用域插槽向父组件提供 `scale / pixel / world / panning`
  - `src/components/canvas/BackgroundLayer.vue`：单 `<v-image>` 渲染 PNG，`listening: false` 杜绝事件穿透
  - `src/components/canvas/AnnotationLayer.vue`：空 `<v-layer>` 占位，S5+ 在此挂 Point/Path 形状（保住图层栈顺序）
  - `src/components/canvas/HoverLayer.vue`：创建型工具激活时画 12px 十字光标（`strokeWidth` / `halfSize` 反比缩放，保持屏上恒定大小）
  - `src/components/canvas/EditorToolbar.vue`：左侧竖向工具按钮组，纯展示，向上 emit `switch-tool`
  - `src/views/EditorView.vue`：3 列布局（工具栏 / Stage / 信息侧栏），全局热键 V/P/L 切换工具（`<input>/<textarea>/contentEditable` 时屏蔽）；S4 严格边界 —— `tool-fire` 事件只 `toastInfo` 回显「像素 → 世界 m」，**不创建任何实体**；未导入底图时回退 CTA 跳 `/import`
  - `src/views/ImportView.vue` 增量改造：解码完 PNG + 解析完 yaml 后通过 `setBackgroundMap()` 推到共享态；导入就绪时在状态栏下方追加「打开画布编辑器」绿色 CTA；`resetMappingState()` 同步 `clearBackgroundMap()`
  - `src/router/index.ts`：新增 `/editor` 路由（lazy import）；`src/App.vue` 顶导补 `画布编辑器` 链接；`src/main.ts` 多 `.use(VueKonva)` 注册全局 `<v-stage>/<v-layer>/<v-image>/<v-line>` 等组件
- 已新增依赖（advisory 检查无漏洞）：
  - `konva@^9.3.20`（实装 9.3.22）
  - `vue-konva@^3.2.1`（实装 3.4.0）
- 已验证命令（沙箱内全部成功）：
  - `pnpm typecheck`（0 错；坑：`readonly()` 会把 `HTMLImageElement` 也 DeepReadonly 化，必须改用 `shallowReadonly()`）→ `pnpm lint`（0 错 0 警）→ `pnpm format:check`（全部符合）→ `pnpm build`（238 modules：index chunk 291.19 kB gzip 96.10 kB，**konva+vue-konva 全量进 index 是已知后果**，EditorView chunk 9.25 kB gzip 4.13 kB；ImportView chunk 49.11 kB 不变）
  - `pnpm dev`：`curl /editor → 200`，`curl /src/views/EditorView.vue` 经 vite transform 返回有效 ESM
- 已知坑 / 待办：
  - vue-konva 全局注册 = konva 整包进 index 主 chunk（gzip 96 kB）；S10 收尾可改 `app.use(VueKonva)` 走动态 `import()` + EditorView 路由级懒加载分包，目前 MVP 体积可接受
  - 共享态用 `shallowRef + shallowReadonly`，**不**用 `readonly()`：后者会让 DOM 元素被 DeepReadonly 化，传入 `MapStage.image: HTMLImageElement` 时类型不兼容
  - S4 不引 Pinia / Element Plus / vitest，全部留 S5+；S5 起手第一步是把 `useBackgroundMap()` 升级为 `useProjectStore()`（包住 background + points + paths 等）
  - 工具点击仅 `toastInfo` 回显，**未**任何模型变更；S5 落地后把 `tool-fire` handler 替换成实际创建动作并把 toast 降级为 dev-only 调试输出
  - `HoverLayer` 仅画十字，未做 path 工具的"上一锚点 → 鼠标"橡皮筋预览（S5 起补，连同 path 拖拽预览一起）
  - SS27 实际样本 origin = (-195.2, -33.6) m，对应像素坐标范围在 (0..imageWidth, 0..imageHeight)；`fitToContainer()` 已在首次度量与 `image` 换源时自动重拟，首次打开看得到全图
  - Konva 的 `imageSmoothingEnabled` 未关闭，深度放大时 PNG 会被插值；MVP 不修，S6+ 视效果再决定
- 下一阶段入口文件：`opentcs-spa/src/stores/project.ts`（S5 起手 —— 引入 Pinia 2，把 `useBackgroundMap` 并入新建的 `useProjectStore()`，并新增 `points` / `paths` 数组 + 自动落 `localStorage`；同时新增 `src/components/canvas/tools/PointTool.vue` 把 EditorView 的 `tool-fire` 真正转成 PointCreationTO 镜像）

### S5（2026-05-20）Point + Path 绘制 + 属性面板
- 已完成模块：
  - `src/domain/model/types.ts`：`DraftPoint` / `DraftPath` / `PointType` / `Triple` / `Pose` / `SelectionRef` —— 字段名与单位严格镜像 `PointCreationTO` / `PathCreationTO` / `PoseCreationTO` / `TripleCreationTO`（mm + degrees + locked + maxReverseVelocity；编辑期辅助字段仅 `DraftPoint.layout.pixelXY`，S8 转换层会丢弃）
  - `src/domain/model/naming.ts`：`nextAutoName('Point', existing)` 跳过被占用的 N；`isValidEntityName` 拒空白 / 斜杠 / 控制字符（为 S7 BFF 文件存储路径段做前置防御）
  - `src/domain/model/path.ts`：`distanceMm(Triple,Triple)` 整数 mm 欧氏距离（`PathCreationTO.length` 是 `long`）
  - `src/stores/project.ts`：Pinia store。`background` 仍是 `shallowRef`（`HTMLImageElement` 不能 deep-reactive）；`points/paths/selection` 通过 `watch([...], deep:true)` 防抖 200ms 落 `localStorage`，key=`opentcs-spa.draftV1`，envelope=`{v:1, points, paths, selection}`。Actions：`addPoint(pixel)` / `movePoint` / `renamePoint`（级联改 Path src/dest 名）/ `updatePointFields` / `setPointWorldMeters` / `startPath` + `completePath` + `cancelPathDraft` / `renamePath` / `updatePathFields` / `select` / `deleteSelected`（删 Point 级联删其相关 Path） / `clearAll`
  - `src/composables/useBackgroundMap.ts`：退化为 thin compat 层，内部 `storeToRefs(useProjectStore())`，对外 API 完全不变，让 ImportView / EditorView 的 S3/S4 调用点零改动
  - `src/components/canvas/AnnotationLayer.vue`：从空 placeholder 升级为真正渲染层。Point=圆 + name 标签，select 工具下 `draggable=true`，PARK_POSITION 用绿色 / 选中用品红 / path 工具半态高亮 path 起点为橙色；Path=`<v-arrow>` 带方向箭头，`locked` 时虚线 + 灰色；通过 `entity-click` 事件向 MapStage 抑制 stage-level "create / deselect" 反应
  - `src/components/canvas/HoverLayer.vue`：path 工具拾起源 Point 后，从源点到鼠标画橙色虚线橡皮筋
  - `src/components/canvas/MapStage.vue`：增加 `entityClickPending` flag（AnnotationLayer 命中实体时置位，下一次 stage click 吞掉）；`onStageClick` 不再对 select 工具早返回 —— 空白处 click 也会 `tool-fire`，由 EditorView 翻成 `store.select(null)`
  - `src/components/property/PropertyPanel.vue`：按选中实体类型分支。所有 input 用 `@change`（blur / Enter）提交而非 `@input`，避免半路输入触发 `recomputeAttachedPathLengths`；非法值（空名 / 重名 / 非数字 / 负数）走 `toastError` 并回滚字段；提供「删除此 Point（级联）」/「删除此 Path」按钮
  - `src/views/EditorView.vue`：把右侧栏换成 `<PropertyPanel>`，底图信息与快捷键收进 `<details>`；新加全局键 `Delete` / `Backspace` 删除选中、`Esc` 取消 path 半态 / 取消选中；`onToolFire` 真正派发 `addPoint` / `select(null)` / 通知用户「请点击一个 Point 作为路径起点」
  - `src/main.ts`：注册 `createPinia()`（在 router 之前安装，确保 lazy-loaded EditorView 在 setup 期可拿到 store）
  - `src/domain/editor/tools.ts`：把 tool 的 `hint` 文案从「S5 起生效」改成实际操作说明
  - `opentcs-spa/docs/data-model.md`：追加 §3 S5 节，列出 `DraftPoint` / `DraftPath` TS shape + 与 `PointCreationTO` / `PathCreationTO` 的字段映射、`layout.pixelXY` 是编辑期辅助、localStorage envelope 约定
- 已新增依赖（advisory 检查无漏洞）：
  - `pinia@^2.2.6`（实装 2.3.1）
- 已验证命令（沙箱内全部成功）：
  - `pnpm typecheck` → 0 错（坑：Vue template 内联箭头函数的 Konva event 参数必须显式 `: KonvaEventObject<MouseEvent>` / `<DragEvent>`，否则 `noImplicitAny` 触发 TS7006）
  - `pnpm lint` → 0 错 0 警；`pnpm format:check` → 全部符合；`pnpm build`（246 modules：index 298.95 kB gzip 99.16 kB；**EditorView chunk 涨到 20.17 kB gzip 7.52 kB**；ImportView 49.14 kB / DebugView 8.27 kB 基本不变；CSS 在 EditorView 5.19 kB）
  - `pnpm dev` → `curl /editor → 200`，`curl /import → 200`，`curl /src/stores/project.ts` 经 vite transform 返回有效 ESM（已 import pinia）
  - 纯函数自检（`tsx`-style 临时脚本）：`nextAutoName` 跳号正确；`isValidEntityName` 拒非法；`distanceMm` 3-4-5 直角三角形=5000；`pixelToWorld`/`worldToPixel` 往返误差 < 1e-9
- 已知坑 / 待办：
  - **手动改了 Path.length 后，端点 Point 一旦再移动，长度会被自动重算覆盖**——MVP 显式权衡（避免长度悄悄与几何不一致）；若需要"手动覆盖"语义，S6 起补 `lengthOverridden:boolean` 字段
  - localStorage 持久化只在用户**当前浏览器+域名**下不丢；跨浏览器 / 跨机器要等 S7 BFF 持久化；超出 ~5 MB 浏览器配额会静默丢弃（捕获异常但不告警），目前画 3 点 2 路径只占数百字节，留 S7 解决
  - Pinia store 暂未做撤销/重做栈；MVP 之外项，v2 上 immer + 命令栈
  - `Backspace` 全局拦截了删除，输入框聚焦时通过 `isEditableTarget` 短路，避免误删字符；若未来 PropertyPanel 引入复杂富文本组件需扩展短路条件
  - Konva `v-arrow` 的 `hitStrokeWidth` 必须显式调大，否则 1.5 px 的 path 线太细很难点中；当前用 `Math.max(8, pathStroke * 4)` 做下限，已实测可用
  - 渲染层 `safeScale = max(scale, 1e-4)` 防止极小缩放下尺寸除以 0 爆 Infinity；MIN_SCALE=0.05 实际不会触发，但留 belt-and-braces
  - vue-router 切换路由后 Pinia store 仍单例，跨页面 selection 会保留——目前观感正常（用户切回 editor 看到上次选中），需要时再加 `router.afterEach` 清理
- 下一阶段入口文件：`opentcs-spa/src/components/property/LocationForm.vue`（S6 起手 —— 在 PropertyPanel 中新增 Location/LocationType/Block/Vehicle 分支；同步在 `src/domain/model/types.ts` 补 `DraftLocation` / `DraftLocationType` / `DraftBlock` / `DraftVehicle` 镜像；AnnotationLayer 加方块 / 矩形 / 车辆 icon 渲染）

### S6（2026-05-20）Location + Block + Vehicle

- 已完成：
  - `src/domain/model/types.ts`：新增 `DraftLocationType / DraftLocation / DraftBlock / DraftVehicle` TS 镜像 + `LocationRepresentation` (14 值) / `BlockType` 枚举；`EntityKind` 由 `'point' | 'path'` 扩展到 6 种
  - `src/stores/project.ts`：在 S5 的 store 上追加 `locationTypes / locations / blocks / vehicles` 四个数组 + 全套 add/move/rename/updateFields/delete + `toggleLocationLink / setLocationLinkOperations / toggleBlockMember` action；`nameTaken` 改为对所有六类实体去重；`blockMemberCandidates()` 帮 BlockForm 列出可勾选成员
  - `localStorage` envelope 升级到 v2（key 仍是 `opentcs-spa.draftV1`）；`loadPersisted` 同时接受 v=1 与 v=2 的 payload，对缺失的 S6 数组以空数组兜底——已有 S5 草稿无缝迁移
  - 删除 / 重命名级联：删 Point → 同时清理引用它的 Path / Location.links / Block.members；删 Path / Location → 同时清理 Block.members；改 LocationType 名称 → 所有 Location.typeName 跟随；删 LocationType 时若仍被 Location 引用则软失败（属性面板拦截并提示）
  - `src/domain/editor/tools.ts`：加 `location(O) / block(B) / vehicle(K)` 三种工具；既有 `select(V) / point(P) / path(L)` 的 cursor/hint 文案小幅更新
  - `src/components/canvas/AnnotationLayer.vue`：渲染 Location 方块（紫色，可拖动）+ Vehicle 带朝向矩形（按 routeColor 着色，可拖动）+ Location ↔ Point 虚线 link；选中 Block 时画 member 包络框 + 高亮成员描边；保留 Point / Path / Path 橡皮筋的全部 S5 行为
  - `src/components/property/{LocationTypeForm,LocationForm,BlockForm,VehicleForm}.vue` 四个子组件按 `selection.kind` 分发；`PropertyPanel.vue` 改为顶部计数 + `+ LocationType / + Block` 快捷按钮 + 6 路 branch
  - `src/views/EditorView.vue` 标题升级为 S6，`onToolFire` 分发到新三个工具（Block 直接在空白处 click 新建空 Block；Vehicle 在 click 落点放置；Location 复用 `addLocation` 的首类型自动 bootstrap）
  - 文档：`opentcs-spa/docs/data-model.md` 追加 §5 S6 节（四类 Draft 与 TO 字段映射表 + envelope v2 约定）；`docs/spa-frontend-roadmap.md` S6 行打勾
- 已知坑 / 显式权衡：
  - VehicleCreationTO 本身没有位姿字段，SPA 为画布显示新增 `layout.pixelX/Y/orientationDeg` 三个**编辑期辅助字段**；S8 publish 转换器必须显式丢弃，否则 RMI 会被 Jackson 拒（已在 data-model §5.4 标注）
  - Block 没有几何，画布上仅在**选中时**画虚线包络框；非选中 Block 完全靠属性面板里"成员勾选"管理——刻意保持 MVP 简单，v2 起再考虑右键菜单/直接框选
  - `LocationRepresentation` 暴露的 14 个值是 `LocationRepresentationTO` 的全集；后续若 openTCS 升级新增值，需要同步 `LOCATION_REPRESENTATIONS` 与 TS 联合类型（一处即可）
  - `links.allowedOperations` 留空 = "继承 LocationType 的 allowedOperations"——这是 SPA 的语义习惯，S8 publish 转换器要按这条规则做兜底
  - Block / Vehicle 的颜色用 `#RRGGBB`（小写），不带 alpha；S8 转换器直接 `Integer.parseInt(rgb.substring(1), 16)` 即可喂给 `java.awt.Color`
  - 拖动 Vehicle 当前只改 `layout.pixelXY`，不改 orientation；orientation 仍靠 VehicleForm 数字输入框编辑，无旋转控柄（v2）
- 下一阶段入口文件：`opentcs-bff/src/main/java/org/opentcs/bff/projects/`（S7 起手 —— 在 BFF 新建工程目录服务，落 `data/projects/<id>/draft.json` + `assets/`，并新增 `GET/PUT /api/v1/projects/{id}/draft` 与 OpenAPI；SPA 同步在 `src/api/endpoints/projects.ts` 引契约，把 `useProjectStore()` 的 `localStorage` 持久化改为远程读写，envelope schema 保持 v2 不变以便机械迁移）
