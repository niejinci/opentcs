# openTCS SPA 前端 Roadmap (R0 产物)

> 本文件是 SPA 前端 MVP 开发的「主时间线」。
> 配套：[`spa-frontend-architecture.md`](./spa-frontend-architecture.md)（技术栈/目录/接口契约/ADR）、[`bff-roadmap.md`](./bff-roadmap.md)（BFF 侧 M1–M5 已完成）。
>
> **强约束（本 Roadmap 全程遵守）：**
> 1. 严格遵循 `chat-with-ai/20-agv地图适配到opentcs.md` 与 `docs/bff-roadmap.md` 已达成的共识，**不擅自变更架构**。
> 2. 与已落地的 `opentcs-bff` 模块的 REST + SSE 契约（`opentcs-bff/src/main/resources/openapi/bff.yaml`）一一对齐。
> 3. MVP 阶段 **不引入 DB**，BFF 侧工程数据落到本地文件（约定见架构文档「文件存储约定」一节）。
> 4. 面向 C++ 后端零前端基础读者，文档少用前端黑话；遇到必须出现的术语在首次出现处做 C++ 类比。
> 5. 一个里程碑（S）= 一段长期 feature 分支，内部可拆多个子 PR；合并 main 时 squash 成单条提交（详见架构文档「分支与 PR 策略」）。

---

## 0. 总目标（MVP 验收信号）

打开浏览器，能在同一个 SPA 内一气呵成完成下面这条端到端链路：

1. 上传扫描三件套 `.png / .pgm / .yaml`；
2. 在画布上画 Point / Path / Location / Block / Vehicle，并保存为草稿（落到 BFF 文件存储）；
3. 点「发布」，把草稿转成 openTCS `PlantModelCreationTO` 并通过 BFF 推到 Kernel；
4. 在订单面板上手工创建一个运输订单（A→B→顶升→A→B→下降）并提交；
5. 在地图上实时看到 AGV 的位置/状态变化（来源：BFF 的 `/api/v1/sse`，事件类型 `/events/vehicles` / `/events/transportOrders`）。

---

## 1. 里程碑总览（S0–S10）

| 编号 | 主题 | 一句话产出 | 关联 BFF 接口 | 验收信号 |
| :--- | :--- | :--- | :--- | :--- |
| **S0** | 技术栈 & 架构定型（本轮） | 三份文档：roadmap、architecture、README 占位 | — | 读完文档能回答"用什么框架/目录长啥样/S1 起手做哪个文件" |
| **S1** | 项目脚手架 + Hello World | `opentcs-spa/` 模块可 `npm run dev` 启动空白页 | `GET /health`（联通性自检） | 浏览器打开能看到 "openTCS SPA"，控制台无报错 |
| **S2** | 基础设施层（HTTP / SSE / 全局错误 / 配置） | `src/api/` HTTP client、SSE client、统一错误/Toast、运行时配置（BFF baseUrl、accessKey） | 全部 BFF 接口 | 在调试页能成功调 `/health`、能打开 `/api/v1/sse` 收到一条心跳/事件 |
| **S3** | 地图导入：三件套上传 + yaml 解析 + 仿射映射 | 「导入页」：上传 png/pgm/yaml，解析 `resolution`/`origin`，建立"像素↔米"映射，PNG 作为 Canvas 只读底图 | （MVP 暂走前端解析；S7 起 BFF 兜底） | 上传 SS27 三件套后，画布显示底图，鼠标悬停状态栏显示 `(米_x, 米_y)` |
| **S4** | 画布编辑器框架 | 多图层（底图/标注/选择/Hover）、缩放/平移、坐标互换工具、工具栏切换 | — | 工具栏点"选择/画点/画路径"切换，鼠标滚轮缩放，按住空格拖动平移 |
| **S5** | Point + Path 绘制 + 属性面板 | 在 S4 上落第一批实体：Point 增/删/拖动，Path 连接两个 Point，右侧属性面板编辑 name / type / 坐标 / 长度 / maxVelocity | — | 画 3 个点 2 条路径，刷新页面草稿不丢（自动写 `localStorage`） |
| **S6** | Location + Block + Vehicle | 站点（带 LocationType）、Block（禁区/资源块）、Vehicle 初始位姿；属性面板补齐 | — | 五种实体都能在画布上画出、改属性、删除 |
| **S7** | 草稿持久化（BFF 文件存储） | 工程列表/新建/打开/重命名/另存；草稿以 SPA 中间态 JSON 落到 BFF `data/projects/<id>/draft.json`；三件套资产落 `assets/` | 新增 BFF 接口（见架构文档「接口契约 · 待新增」一节） | 草稿可在两台浏览器之间共享；服务重启不丢 |
| **S8** | 发布到 Kernel | 「中间态 JSON → `PlantModelCreationTO` 镜像 JSON」转换 + 调 BFF 发布接口；失败回滚提示与差异预览 | 新增 BFF 接口 `POST /api/v1/plant-models/publish` | 发布成功后 openTCS Kernel `data/model.xml` 更新，`/api/v1/vehicles` 出现编辑里画的车 |
| **S9** | 运输订单创建 + SSE 实时状态可视化 | 表单：选车 / 多目的地 / 操作（含顶升 LIFT、下降 DROP）；SSE 订阅 `/events/vehicles` & `/events/transportOrders`，AGV 位置/颜色实时更新 | `POST /api/v1/transport-orders`、`GET /api/v1/sse?vehicles=true&transportOrders=true` | 提交"A→B→顶升→A→B→下降"订单，地图上车实时跑完整条路径 |
| **S10** | 收尾：README、最小 e2e、Docker 化、文档截图 | `opentcs-spa/README.md` 写完整 Quickstart；Vitest 跑通若干 store/util 单测；Dockerfile + 加入 `docker-compose.yml`（与 BFF/Kernel 同栈） | — | `docker compose up` 后浏览器能跑通 §0 的全链路 |

> **里程碑 ≠ 单个 PR**：S 内部按"功能切片"拆 2~4 个子 PR，详见架构文档「分支与 PR 策略」。

---

## 2. 每个里程碑的"对话提问模板"

S1~S10 每一轮，请按下面模板提问（直接套用，把 `<…>` 替换掉即可）：

```
进入 S{N}：<主题>。

【背景】当前进度：S{N-1} 已合并到 main，opentcs-spa 当前状态见最新 main。
【本轮目标】<一句话目标，例：实现 Point 在 Canvas 上的创建/拖动/删除>。
【输入约束】
  - 沿用 R0 选定技术栈与目录结构，不新增依赖；如必须，先列候选 + 理由 + advisory 检查
  - 复用 S2 封装的 api/sse client，禁止新增 axios 实例
  - 与 BFF OpenAPI（opentcs-bff/src/main/resources/openapi/bff.yaml）字段一一对齐，不擅自改契约
【验收标准】（可执行命令或可点击操作）
  1. ...
  2. ...
【不要做】（明确边界，防止 PR 失控）
  - 不要重构 ...
  - 不要新增 ...
【交付】改动清单 + 关键文件思路 + 验证步骤 + 更新 spa-frontend-roadmap.md 的"已完成"行
```

---

## 3. 风险登记 & 应对

| 风险 | 触发场景 | 应对 |
| :--- | :--- | :--- |
| MVP 范围漂移 | 用户在 S5 中途要求加协同编辑/多人光标 | 写入"延后清单"放到 S10 之后的 v2；当轮严格按"不要做"清单 |
| 中间态 JSON 与 `PlantModelCreationTO` 漂移 | openTCS 升级、字段增删 | 中间态 JSON 字段名/单位严格对齐 TO（mm、Triple 等），见 ADR-0001；S8 的转换层只做"打包/校验"不做"翻译" |
| 三件套尺寸过大导致 BFF 上传 OOM | 用户上传 50MB+ PNG | S3 在前端做尺寸提示；S7 BFF 文件接口走流式（`InputStream` → `Files.copy`），不全量入内存 |
| SSE 长连接被反向代理切断 | docker-compose 起 caddy/nginx | S2 的 SSE client 必须实现"断线 + 指数退避重连"；S10 在 docker-compose 的反代中关闭 buffer + 调高超时 |
| 鉴权 access-key 泄漏到前端 bundle | 把 key 编进 SPA 源码 | access-key 由用户登录后从 BFF 拿（即便 MVP 是固定 key，也通过运行时配置注入，绝不写死在源码） |

---

## 4. 已完成 / 进行中 / 待办

- [x] **S0**（本轮）：技术栈与架构定型 → 三份文档
- [x] **S1**：项目脚手架 + Hello World（Vue 3 + TS 5 + Vite 5 + ESLint 9 + Prettier；`pnpm dev` 可启动空白页，dev-server `/api`、`/health`、`/openapi` 反代到 BFF 8090）
- [x] **S2**：基础设施层（`src/api/{client,sse,errors,types/bff,endpoints/{health,vehicles}}`、`src/config/runtime`、`src/ui/toast/*`、`src/views/DebugView.vue`；`X-Api-Access-Key` 自动注入；`HttpError` / `NetworkError` / `ParseError` 区分；SSE 指数退避重连 + 状态机；零新依赖）
- [x] **S3**：地图导入：三件套上传 + ROS yaml 解析 + 像素↔米仿射映射（`src/domain/yaml/parseRosMapYaml.ts` 兼容 `%YAML:1.0` 旧版指令；`src/domain/geometry/affine.ts` 纯函数；`src/views/ImportView.vue` 三个 `<input type="file">` + 原生 `<canvas>` 只读底图 + 鼠标悬停状态栏显示米制坐标；首次引入 vue-router 4 与 js-yaml 4，加入 `opentcs-spa/docs/data-model.md` 占位）
- [x] **S4**：画布编辑器框架（首次引入 konva 9 + vue-konva 3；`src/composables/useBackgroundMap.ts` 充当 S5 起被 Pinia 接管前的轻量共享态；`src/components/canvas/{MapStage,BackgroundLayer,AnnotationLayer,HoverLayer,EditorToolbar}.vue` 三图层 Stage + 滚轮聚焦缩放 + 空格按住拖动平移 + 工具栏切换 select/point/path；`src/views/EditorView.vue` + 路由 `/editor`；S4 边界严格 —— 工具点击只 toast 回显像素+世界坐标，不创建任何实体）
- [ ] S5：Point + Path
- [ ] S6：Location + Block + Vehicle
- [ ] S7：草稿持久化（BFF 文件存储）
- [ ] S8：发布到 Kernel
- [ ] S9：订单 + SSE 实时可视化
- [ ] S10：收尾

每完成一个 S，请在本节做 `[ ]` → `[x]`，并在 `spa-frontend-architecture.md` 末尾追加一段「S{N} 完工备忘」（≤30 行：已完成模块、已知坑、下一阶段入口文件）——这是跨对话上下文的持久化锚点。
