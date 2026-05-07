**User:**
"我要启动 openTCS 的 SPA 后端项目。这是第 0 个会话，目标是定方案不写代码。请：

阅读本仓库 opentcs-modeleditor、opentcs-kernel-extension-http-services、根 build.gradle、settings.gradle，搞清楚现有 Java 版本、Gradle 版本、依赖管理方式；
在 `` 标签里给我一份 BFF 技术选型表，包含：模块放仓库内还是另起 repo、构建工具、Web 框架、连 Kernel 通道（RMI/HTTP）、API 文档、测试、日志、配置、容器化方案；每项给推荐 + 1~2 个备选 + 一句话理由；
末尾列出 5 个后续里程碑的建议拆分。 不要创建任何文件，不要 report_progress。"

---

### openTCS SPA BFF 技术选型表（第 0 次会话产物，不写代码）

| # | 维度 | 推荐 | 备选 1 | 备选 2 | 一句话理由 |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | 代码放置 | **本仓库内新增模块 `opentcs-bff`**（与 `opentcs-kernel-extension-http-services` 平级） | 本仓库内但放 `opentcs-extension-bff`（作为 Kernel 扩展进程内运行） | 另起 repo `opentcs-spa` | 复用 version catalog / Spotless / CI / Gradle 公共脚本，零成本接入；和 Kernel 的版本演进同步发布。另起 repo 会丢失统一构建/版本/license-report 的红利。 |
| 2 | 构建工具 | **Gradle 8.14.4**（沿用根 wrapper） | Maven | — | 本仓库 100% Gradle + Version Catalog，新模块只要加一行 `include 'opentcs-bff'` + 一个 `build.gradle` 即可继承所有规则；混入 Maven 会破坏 subDists 等聚合任务。 |
| 3 | Web 框架 | **Javalin 7.1.0**（已在 libs.versions.toml） | Spring Boot 3.x | Quarkus 3.x | Kernel 的 HTTP 扩展就是 Javalin，handler 模式、JsonBinder、Authenticator、SSE 都已有可参照实现；Spring Boot 会带 Spring DI / Boot 配置 / Logback 三套与现有栈冲突的子系统，对 C++ 背景的人反而更难理解多套并存的"魔法"。 |
| 4 | 依赖注入 / 容器 | **Guice 7**（沿用 `gradle/guice-project.gradle`） | Spring Context | Dagger 2 | 本仓库唯一在用的 DI 容器就是 Guice；Javalin 与 Guice 组合在 `opentcs-kernel-extension-http-services` 已验证。 |
| 5 | 连 Kernel 通道 | **RMI，通过 `KernelServicePortal`** | Kernel 自带 HTTP 扩展（`servicewebapi`） | 双通道（读用 HTTP/SSE，写用 RMI） | RMI 暴露的是完整的 `*Service`（Plant / Vehicle / TransportOrder / Dispatcher / Router…），HTTP 扩展只是子集；`opentcs-modeleditor` 已是 RMI 客户端的活样本，可直接照搬连接、重连、portal 生命周期。等接入需求出现后再考虑 SSE 订阅事件。 |
| 6 | DTO ↔ 模型映射 | **ModelMapper 3.2.5**（已用于 HTTP 扩展） | 手写 converter（HTTP 扩展里 converter/ 包就是手写） | MapStruct | 仓库已经在用 ModelMapper + 手写 converter 双轨；BFF 优先复用 HTTP 扩展里的 `binding/` DTO 包（已有 PlantModel/Vehicle/TransportOrder 全套），避免重写。 |
| 7 | API 文档 | **OpenAPI 3 + org.openapi.generator Gradle 插件 + swagger-ui webjar**（全部已在 catalog） | springdoc-openapi（仅 Spring Boot 路线） | 手写 openapi.yaml + Redoc | 设计优先（design-first）：把 `openapi.yaml` 放 `src/main/resources/openapi/`，插件生成 DTO/接口骨架，再让 Javalin handler 实现。这是仓库已有的 swagger-generator 工具链，零新依赖。 |
| 8 | 测试 | **JUnit Jupiter 6 + Mockito + AssertJ + ApprovalTests**（沿用 `java-project.gradle` 默认依赖） | + Testcontainers（跑真 Kernel 镜像） | + REST Assured（端到端 HTTP） | 单元测试零额外配置就能跑（继承 `useJUnitPlatform()`）；集成测试推荐 Javalin 的 `JavalinTest`（轻量，启停快），等真要跨进程联调时再引入 Testcontainers。 |
| 9 | 日志 | **SLF4J 2 + slf4j-jdk14（JUL）** | Logback | Log4j2 | 全仓库统一 JUL 后端，`opentcs-modeleditor/run` 任务还专门通过 `java.util.logging.config.file` 配置；换 Logback 会出现两套日志配置文件，运维痛苦。 |
| 10 | 配置 | **Gestalt（`opentcs-impl-configuration-gestalt`）+ `@ConfigurationPrefix` 接口** | application.yml + 手写 POJO | Typesafe Config | 仓库其它模块的运行时配置全走 Gestalt（看 modeleditor 的 `opentcs.configuration.provider=gestalt`），保持一致才能复用 Kernel 的配置 reload 机制。 |
| 11 | 代码风格检查 | **Spotless + Eclipse 4.38 formatter**（apply from `java-codequality.gradle` 自动继承） | + Checkstyle | + ErrorProne | 一行 apply 就拿到 `-Werror -Xlint:all` + 统一格式化，CI 已对此敏感；不要再叠新工具。 |
| 12 | CORS / 鉴权 | **Javalin 内置 CORS plugin + 仿 Authenticator.java 的 access-key header** | JWT (java-jwt 库) | OAuth2 (Keycloak) | SPA 走同源部署时只需 dev 环境放开 CORS；鉴权先抄 HTTP 扩展的简单 access-key，避免一上来就引入 Keycloak/JWT 学习成本。等到多用户场景再升级。 |
| 13 | 打包 / 容器化 | **Gradle application 插件 + installDist → Dockerfile（distroless-java21）** | Spring Boot fat-jar（仅 Spring 路线） | jlink 自定义运行时 | 这是仓库 Kernel/ModelEditor 等已用的打包方式（看根 `build.gradle` 的 `subDists`），产出 `bin/` + `lib/`，Docker 里 CMD `["./bin/opentcs-bff"]` 即可；同时给 `docker-compose.yml` 同时起 kernel + bff + 反向代理方便本地联调。 |
| 14 | CI | **复用 `.gitlab-ci.yml`**（仓库已有 GitLab CI） | 新增 GitHub Actions | 不动 | 先让新模块自动被 `./gradlew build` 拉进现有 pipeline；GitHub Actions 等真有 fork 工作流再加。 |

#### 决策摘要（一句话）
**沿用本仓库现有的 Javalin + Guice + Jackson + Gestalt + JUL + Spotless + Gradle 栈，新增一个 `opentcs-bff` 子模块；BFF 通过 RMI 调 KernelServicePortal，对外按 design-first 用 OpenAPI 生成接口给 SPA 用。** 不引入 Spring Boot——会破坏栈一致性，且学习曲线对你反而更陡。

#### 后续 5 个里程碑建议拆分（每个 = 一个会话 = 一个 PR）

| M# | 目标 | 关键交付物 | 验收信号 |
| :- | :--- | :--- | :--- |
| **M1** | **脚手架 + 健康检查** | 新增 `opentcs-bff` 子模块；include 进 `settings.gradle`；继承 `java-project.gradle` + `guice-project.gradle`；一个 BffApplication Guice + Javalin 启动类；`GET /health` 返回 `{status:"UP"}`；`BffApplicationTest` 用 JavalinTest 覆盖。 | `./gradlew :opentcs-bff:test` 绿；`./gradlew :opentcs-bff:run` 后 curl `localhost:8090/health` 返回 200。 |
| **M2** | **接入 Kernel（只读）** | KernelClient 组件（封装 KernelServicePortal 的连/重连/断线）；`GET /api/v1/plant-model/summary`（点/路径/车辆数量）；`application.gestalt` 里加 `bff.kernel.host/port/userName/password`；Mockito 单测 + 一个用 JavalinTest 跑的契约测试（mock 掉 portal）。 | 本机起 opentcs-kernel 后，BFF curl `/api/v1/plant-model/summary` 拿到非空 JSON。 |
| **M3** | **OpenAPI 工具链 + 第一组 CRUD** | 引入 `org.openapi.generator` 插件，建 `src/main/resources/openapi/bff.yaml`；定义 Vehicle 资源；让插件生成 DTO 接口，handler 实现之；`/swagger-ui` 路径挂 swagger-ui webjar。 | 浏览器打开 `/swagger-ui` 能看到接口、能 Try it out 调用成功。 |
| **M4** | **写操作 + 鉴权 + 错误模型** | `POST /api/v1/transport-orders`（包装 `TransportOrderCreationTO`）；统一 ErrorResponse `{code,message,traceId}` + Javalin exceptionHandler；access-key header 鉴权；输入校验失败 400、Kernel 不可用 503、未鉴权 401。 | 测试覆盖 200/400/401/404/503 五条路径；OpenAPI schema 同步更新。 |
| **M5** | **事件推送 + 容器化 + 一键起栈** | `GET /api/v1/events`（SSE，桥接 Kernel 的事件流，可参照 `V1SseHandler`）；新增 Dockerfile；`docker-compose.yml` 同时起 opentcs-kernel + opentcs-bff + caddy 反向代理；README 给 SPA 团队的"如何 5 分钟跑起来"指引。 | docker compose up 后浏览器同时能看 Kernel 日志、BFF Swagger UI、SSE 事件流。 |

后续按业务（路由、订单序列、外设作业、车辆派遣……）每加一组资源 = 一个 M{n}，都是 M3+M4 模式的复制粘贴。
