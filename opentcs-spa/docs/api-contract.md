# opentcs-spa · BFF API contract

> 配套：[`opentcs-bff/src/main/resources/openapi/bff.yaml`](../../opentcs-bff/src/main/resources/openapi/bff.yaml)（接口契约的**唯一真相**）。
> 本文件只补充：① SPA 侧封装位置；② mock / 联调示例；③ 字段使用注意点。
> 当 `bff.yaml` 与本文件出现差异，**以 `bff.yaml` 为准**；并在同一 PR 内更新本文件。

## 1. SPA 端调用入口（强约束）

| 位置                     | 用途                                                               |
| :----------------------- | :----------------------------------------------------------------- |
| `src/api/client.ts`      | 唯一 `fetch` 包装器；任何组件 / store **禁止直接 `fetch()`**       |
| `src/api/sse.ts`         | 唯一 `EventSource` 包装器；带指数退避重连                          |
| `src/api/endpoints/*.ts` | 每个 BFF endpoint 一个函数；返回类型严格匹配 OpenAPI               |
| `src/api/types/bff.ts`   | OpenAPI schema 的手写 TS 镜像（S2 暂不引 `openapi-typescript`）    |
| `src/config/runtime.ts`  | `bffBaseUrl` / `bffAccessKey` 运行时配置（来自 `import.meta.env`） |

错误处理：所有失败抛 `ApiError` 子类（`HttpError` / `NetworkError` / `ParseError`），并默认弹一条 `toastError`（可用 `RequestOptions.toastOnError = false` 关闭）。

## 2. S2 已封装的 endpoints

| HTTP | 路径                                             | 函数                                                | 用途                      |
| :--- | :----------------------------------------------- | :-------------------------------------------------- | :------------------------ |
| GET  | `/health`                                        | `endpoints.health.getHealth()`                      | BFF 联通性自检（S1 / S2） |
| GET  | `/api/v1/vehicles`                               | `endpoints.vehicles.listVehicles()`                 | 列出车辆（S6 / S9 复用）  |
| GET  | `/api/v1/vehicles/{name}`                        | `endpoints.vehicles.getVehicleByName(name)`         | 单车详情（S9 复用）       |
| GET  | `/api/v1/sse?vehicles=true&transportOrders=true` | `new SseClient({ vehicles, transportOrders, ... })` | 实时车辆 / 订单事件流     |

> S9 才会落 `POST /api/v1/transport-orders`，本文件届时追加；S7+ 接口同。

## 3. 鉴权 / Header

- 所有 HTTP 请求自动注入 `X-Api-Access-Key: ${VITE_BFF_ACCESS_KEY}`，空字符串时省略 header。
- `Accept: application/json`、`Content-Type: application/json`（仅有 body 时）。
- BFF 在响应头 `X-Trace-Id` 中回传请求关联 id；错误对象同时把它放在 `HttpError.traceId` 与 `BffErrorResponse.traceId` 上，方便贴到 issue。

**SSE 鉴权坑**：浏览器 `EventSource` 不能加 header。MVP dev `bff.security.accessKey=""` 鉴权关闭；prod 启用鉴权前需 BFF 侧补 `?accessKey=` query 支持，或前端改用 `@microsoft/fetch-event-source`（详见 architecture §3.1）。

## 4. 错误响应（`ErrorResponse`）

```json
{ "code": "kernel.unavailable", "message": "Cannot reach kernel", "traceId": "abc-123" }
```

`HttpError` 字段：

- `status` / `statusText`：HTTP 状态。
- `payload`：解析得到的 `BffErrorResponse`，body 不是合法 JSON 时为 `null`。
- `bodyText`：原始响应体（用于 `payload === null` 时排查）。
- `traceId`：取自 `X-Trace-Id` 响应头。

## 5. 本地联调示例（curl）

```bash
# 启 BFF
./gradlew :opentcs-bff:run

# 联通性自检
curl -i http://localhost:8090/health
# -> 200 {"status":"UP"}

# 列车辆（无 Kernel 时 503）
curl -i http://localhost:8090/api/v1/vehicles

# SSE
curl -N "http://localhost:8090/api/v1/sse?vehicles=true&transportOrders=true"
```

dev-server 同源代理（在 SPA 一侧）：

```bash
# 终端 1
cd opentcs-spa && pnpm dev          # 5173
# 终端 2
./gradlew :opentcs-bff:run          # 8090
# 浏览器
open http://localhost:5173/         # → 看到 S2 Debug 页
```

## 6. Mock 数据（联调或单测用）

> S2 暂不引 vitest / msw；以下 JSON 字面量可在控制台或后续 mock 服务里复用。

```jsonc
// /api/v1/vehicles 单条
{
  "name": "Vehicle-001",
  "state": "IDLE",
  "procState": "IDLE",
  "integrationLevel": "TO_BE_UTILIZED",
  "paused": false,
  "energyLevel": 87,
  "currentPosition": "Point-0001"
}

// /api/v1/sse `/events/vehicles` data 字段
{
  "currentObjectState": { /* Vehicle ↑ */ },
  "previousObjectState": { /* Vehicle ↑ with state="EXECUTING" */ }
}
```
