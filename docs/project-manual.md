[toc]
***

2026-06-16

# dd-opentcs 开发运维手册

## 章节1：系统架构与模块划分

### 1.1 系统总体定位

dd-opentcs 是基于 openTCS 二次开发的汽车工厂 AGV 调度系统。系统以 openTCS Kernel 为调度核心，通过 BFF 层向浏览器 SPA 暴露面向前端的 HTTP/SSE 接口，通过 VDA5050 通信适配器将内核中的运输订单、车辆状态和路线信息转换为 VDA5050 2.0.0 MQTT 报文，与厂区 AGV 车载客户端完成双向通信。

整体链路如下：

```text
opentcs-spa（浏览器 Vue3 + TypeScript）
  -> HTTP/REST + SSE
opentcs-bff（前后端缓冲适配层）
  -> Java RMI
opentcs-kernel（调度内核）
  <-> opentcs-commadapter-vda5050（VDA5050 通信适配器）
  -> MQTT / VDA5050 2.0.0 JSON
Mosquitto MQTT Broker
  -> 工业 Wi-Fi / 5G 专网
AGV 车载 VDA5050 客户端
```

### 1.2 四大核心模块定位

| 模块 | 本地路径 | 定位 | 核心能力 |
| :--- | :--- | :--- | :--- |
| `opentcs-kernel` | `D:\byd_agv_njc\opentcs\opentcs-kernel` | 调度内核服务进程 | 维护工厂模型、车辆对象、运输订单、调度状态；执行路径规划、交通管制、任务分配；通过 RMI 扩展向外提供内核服务访问能力。 |
| `opentcs-bff` | `D:\byd_agv_njc\opentcs\opentcs-bff` | 面向 SPA 的后端缓冲层 | 对前端提供 HTTP REST、SSE、OpenAPI/Swagger；向下通过 Java RMI 连接 Kernel；封装车辆、运输订单、工程草稿、地图资产等前端所需接口。 |
| `opentcs-spa` | `D:\byd_agv_njc\opentcs\opentcs-spa` | 操作员可视化前端 | 提供工厂地图导入、画布编辑、工程管理、模型发布、运输订单创建、车辆实时状态和订单生命周期展示。 |
| `opentcs-commadapter-vda5050` | `D:\byd_agv_njc\opentcs-commadapter-vda5050` | VDA5050 车辆通信适配器 | 内置 MQTT 客户端；处理 VDA5050 2.0.0 JSON 报文；完成 openTCS 内部对象与 AGV order/state/connection 等 MQTT 主题报文之间的双向转换。 |

### 1.3 模块上下游依赖与通信方式

| 上游 | 下游 | 通信协议 / 方式 | 数据载体 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `opentcs-spa` | `opentcs-bff` | HTTP REST | JSON | 前端发起车辆查询、订单创建、工程草稿保存、模型发布等请求。开发环境通过 Vite proxy 反代到 BFF 默认地址 `http://localhost:8090`。 |
| `opentcs-bff` | `opentcs-spa` | SSE | `text/event-stream`，事件 data 为 JSON | BFF 将车辆状态、运输订单变化等实时事件推送给浏览器，SPA 订阅后刷新监控界面。 |
| `opentcs-bff` | `opentcs-kernel` | Java RMI | openTCS Java 服务对象 / Transfer Object | BFF 使用 Kernel 暴露的 RMI 服务读取车辆、工厂模型、订单等对象，并提交写操作。默认连接参数在 `opentcs-bff-defaults-baseline.properties` 中配置：host `localhost`、port `1099`。 |
| `opentcs-kernel` | `opentcs-commadapter-vda5050` | openTCS 通信适配器 SPI / Java 进程内集成 | `TransportOrder`、`Route`、车辆通信状态等 Java 对象 | Kernel 根据车辆适配器状态分配任务，VDA5050 适配器负责将内核调度意图转换为标准车辆通信报文。 |
| `opentcs-commadapter-vda5050` | Mosquitto MQTT Broker | MQTT | VDA5050 2.0.0 JSON | 适配器发布 order 等指令报文，订阅 AGV 上报的 state、connection、order 相关主题。 |
| Mosquitto MQTT Broker | AGV 车载 VDA5050 客户端 | MQTT | VDA5050 2.0.0 JSON | AGV 订阅调度系统下发的订单，周期性或事件触发上报车辆状态、连接状态和订单执行信息。 |

### 1.4 模块边界原则

1. `opentcs-kernel` 保持车型无关，负责通用调度、路径规划、交通管制和订单生命周期管理。
2. `opentcs-commadapter-vda5050` 负责协议适配，不承载前端业务语义，不直接处理浏览器请求。
3. `opentcs-bff` 负责前端友好的接口聚合和数据格式转换，不重新实现 Kernel 调度逻辑。
4. `opentcs-spa` 只通过 BFF 访问系统后端，不直接连接 Kernel RMI、MQTT Broker 或 VDA5050 适配器。

## 章节2：项目技术栈与顶层目录结构

### 2.1 模块技术栈

| 模块 | 语言 | 主要框架 / 运行库 | 构建 / 打包工具 | 关键依赖与说明 |
| :--- | :--- | :--- | :--- | :--- |
| `opentcs-kernel` | Java 21 | openTCS Kernel、Guice、Gestalt 配置、RMI 扩展、HTTP services 扩展 | Gradle 8.14.4，`application` / `distribution` 插件 | 依赖 `opentcs-api-injection`、`opentcs-common`、`opentcs-strategies-default`、`opentcs-kernel-extension-rmi-services`、`opentcs-kernel-extension-http-services`，并通过复合构建依赖本地 VDA5050 适配器。 |
| `opentcs-bff` | Java 21 | Javalin 7.1.0、Guice、Jackson、Gestalt、OpenAPI Generator、Swagger UI | Gradle 8.14.4，OpenAPI 设计优先生成 DTO，`installDist` 生成运行分发包 | 对外提供 REST/SSE；通过 RMI 连接 Kernel；`bff.yaml` 是 HTTP API 契约来源；运行时使用 JUL/SLF4J 日志后端。 |
| `opentcs-spa` | TypeScript 5.x / Vue SFC | Vue 3、Vue Router、Pinia、Konva、vue-konva、js-yaml、浏览器原生 `fetch` / `EventSource` | pnpm 9.12.3、Vite 5、vue-tsc、ESLint、Prettier、Vitest | `pnpm dev` 启动开发服务器；`pnpm build` 先执行类型检查再打包到 `dist/`；开发环境将 `/api`、`/health`、`/openapi` 代理到 BFF `localhost:8090`。 |
| `opentcs-commadapter-vda5050` | Java 21 | openTCS 通信适配器 API、Jackson、Everit JSON Schema、Eclipse Paho MQTT v3 | 独立 Gradle 8.14.4 工程；主仓库通过 `includeBuild('../opentcs-commadapter-vda5050')` 纳入复合构建 | 负责 VDA5050 2.0.0 JSON 序列化、校验和 MQTT 收发；可独立构建，也可随主仓库 Kernel 构建被源码替换引用。 |

### 2.2 构建基础约定

| 项目 | 约定 |
| :--- | :--- |
| Java 版本 | 主仓库与 VDA5050 适配器均使用 Java 21 编译，Gradle 脚本中 `options.release = 21`。 |
| Gradle 版本 | 主仓库和 VDA5050 适配器均使用 Gradle Wrapper `8.14.4`。 |
| Java 代码质量 | 主仓库 Java 模块统一使用 Spotless、Eclipse formatter、`-Xlint:all`，主仓库 Java 编译启用 `-Werror`。 |
| 依赖管理 | Java 依赖集中在 `gradle/libs.versions.toml`；SPA 依赖由 `package.json` 和 `pnpm-lock.yaml` 管理。 |
| 分发方式 | Java 应用模块通过 Gradle `installDist` 产出 `build/install/<模块名>/`，包含 `bin/`、`lib/`、`config/` 等运行文件。 |
| 配置方式 | Java 服务运行时使用 `opentcs.configuration.provider=gestalt`，默认配置随 distribution 进入 `config/`。 |

### 2.3 dd-opentcs 顶层目录结构

以下仅展示主仓库 `D:\byd_agv_njc\opentcs` 的一级目录，已忽略构建产物、第三方依赖、测试目录和 IDE 临时目录。

```text
opentcs/
├── chat-with-ai
├── config
├── docs
├── gradle
├── opentcs-api-base
├── opentcs-api-injection
├── opentcs-bff
├── opentcs-commadapter-loopback
├── opentcs-common
├── opentcs-documentation
├── opentcs-impl-configuration-gestalt
├── opentcs-kernel
├── opentcs-kernel-extension-http-services
├── opentcs-kernel-extension-rmi-services
├── opentcs-kernelcontrolcenter
├── opentcs-modeleditor
├── opentcs-operationsdesk
├── opentcs-peripheralcommadapter-loopback
├── opentcs-plantoverview-base
├── opentcs-plantoverview-common
├── opentcs-plantoverview-panel-loadgenerator
├── opentcs-plantoverview-panel-resourceallocation
├── opentcs-plantoverview-themes-default
├── opentcs-spa
├── opentcs-strategies-default
├── src
└── SS27
```

VDA5050 适配器位于主仓库相邻目录 `D:\byd_agv_njc\opentcs-commadapter-vda5050`，一级目录如下：

```text
opentcs-commadapter-vda5050/
├── bin
├── config
├── doc
├── gradle
└── src
```

## 章节3：全模块编译与运行规范

### 3.1 启动依赖顺序

标准本地联调建议按以下顺序启动：

1. 启动 Mosquitto MQTT Broker。
2. 启动 `opentcs-kernel`。
3. 确认 Kernel 已启用 RMI 服务，并监听 BFF 配置的 RMI 地址，默认 `localhost:1099`。
4. 启动 `opentcs-bff`，默认监听 `0.0.0.0:8090`，并向下连接 Kernel RMI。
5. 启动 `opentcs-spa` 开发服务器，默认端口 `5173`，通过 Vite proxy 调用 BFF。
6. AGV 车载 VDA5050 客户端连接 MQTT Broker，开始订阅 order 主题并上报 state/connection/order 相关报文。

依赖关系说明：

| 模块 | 启动前置条件 | 原因 |
| :--- | :--- | :--- |
| Mosquitto MQTT Broker | 无 | VDA5050 适配器和 AGV 客户端的 MQTT 通信基础设施。 |
| `opentcs-kernel` | Java 21；本地配置目录可用；需要联车时 MQTT Broker 已可用 | Kernel 是调度核心，BFF 必须先有可连接的 RMI 服务。 |
| `opentcs-bff` | Java 21；Kernel RMI 可访问 | BFF 启动后需要通过 RMI 读取 Kernel 对象、提交订单和订阅事件。 |
| `opentcs-spa` | Node.js `>=20.10.0`；pnpm `9.12.3`；BFF 可访问 | SPA 的 REST/SSE 请求全部经 BFF，开发环境代理目标默认为 `http://localhost:8090`。 |
| AGV 车载客户端 | MQTT Broker 可访问；Kernel 中车辆与通信适配器配置正确 | AGV 需要通过 MQTT 接收调度订单并上报状态。 |

### 3.2 主仓库整体编译命令

在 `D:\byd_agv_njc\opentcs` 执行：

```powershell
.\gradlew.bat build
```

Linux / macOS 终端：

```bash
./gradlew build
```

该命令会构建主仓库 Gradle 子模块，并触发 `installDist` 生成 Java 应用分发包。由于 `settings.gradle` 中配置了 `includeBuild('../opentcs-commadapter-vda5050')`，Kernel 依赖的 VDA5050 适配器会优先使用相邻源码工程参与构建。

### 3.3 `opentcs-kernel` 编译与运行

Windows PowerShell：

```powershell
cd D:\byd_agv_njc\opentcs
.\gradlew.bat :opentcs-kernel:build
.\gradlew.bat :opentcs-kernel:run
```

Linux / macOS 终端：

```bash
cd /path/to/opentcs
./gradlew :opentcs-kernel:build
./gradlew :opentcs-kernel:run
```

生成分发包：

```powershell
.\gradlew.bat :opentcs-kernel:installDist
```

分发产物目录：

```text
D:\byd_agv_njc\opentcs\opentcs-kernel\build\install\opentcs-kernel
```

### 3.4 `opentcs-bff` 编译与运行

Windows PowerShell：

```powershell
cd D:\byd_agv_njc\opentcs
.\gradlew.bat :opentcs-bff:build
.\gradlew.bat :opentcs-bff:run
```

Linux / macOS 终端：

```bash
cd /path/to/opentcs
./gradlew :opentcs-bff:build
./gradlew :opentcs-bff:run
```

生成分发包：

```powershell
.\gradlew.bat :opentcs-bff:installDist
```

默认运行参数：

| 配置项 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `bff.bindAddress` | `0.0.0.0` | BFF HTTP 服务绑定地址。 |
| `bff.bindPort` | `8090` | BFF HTTP 服务端口。 |
| `bff.kernel.host` | `localhost` | Kernel RMI 主机。 |
| `bff.kernel.port` | `1099` | Kernel RMI 端口。 |
| `bff.kernel.userName` | `Alice` | 连接 Kernel 的默认用户名。 |
| `bff.kernel.password` | `xyz` | 连接 Kernel 的默认密码。 |
| `bff.security.accessKey` | 空字符串 | 为空表示开发环境默认关闭静态 access-key 鉴权。 |

### 3.5 `opentcs-spa` 编译与运行

首次安装依赖：

```powershell
cd D:\byd_agv_njc\opentcs\opentcs-spa
pnpm install
```

启动开发服务器：

```powershell
pnpm dev
```

类型检查：

```powershell
pnpm typecheck
```

生产构建：

```powershell
pnpm build
```

本地预览生产构建：

```powershell
pnpm preview
```

默认开发访问地址：

```text
http://localhost:5173
```

开发代理规则：

| SPA 路径 | 代理目标 | 用途 |
| :--- | :--- | :--- |
| `/api/*` | `http://localhost:8090` | BFF REST/SSE API。 |
| `/health` | `http://localhost:8090` | BFF 健康检查。 |
| `/openapi/*` | `http://localhost:8090` | BFF OpenAPI 文档资源。 |

### 3.6 `opentcs-commadapter-vda5050` 编译规范

适配器可作为独立 Gradle 工程构建：

Windows PowerShell：

```powershell
cd D:\byd_agv_njc\opentcs-commadapter-vda5050
.\gradlew.bat build
```

Linux / macOS 终端：

```bash
cd /path/to/opentcs-commadapter-vda5050
./gradlew build
```

生成分发包：

```powershell
.\gradlew.bat installDist
```

在 dd-opentcs 主仓库中，通常不需要单独手工发布适配器 jar。主仓库 `settings.gradle` 已通过 Gradle composite build 引入相邻源码：

```groovy
includeBuild('../opentcs-commadapter-vda5050')
```

因此执行主仓库 Kernel 或整体构建时，Gradle 会使用本地 VDA5050 适配器源码满足 Kernel 的适配器依赖。

### 3.7 Gradle Wrapper 与常用 Kernel 命令

`gradlew` 是 Gradle Wrapper。可以把它理解为 Java/Gradle 项目的“自带构建入口脚本”：项目提交了 `gradlew.bat`、`gradlew` 和 `gradle/wrapper/*` 后，开发者不需要先全局安装 Gradle，只要本机有合适的 JDK，Wrapper 会按项目指定版本下载并运行 Gradle。

在 Windows PowerShell 中使用：

```powershell
.\gradlew.bat <task>
```

在 Linux / macOS 终端中使用：

```bash
./gradlew <task>
```

#### 3.7.1 命令语法

dd-opentcs 是 Gradle 多模块工程。常见命令格式为：

```powershell
.\gradlew.bat :模块名:任务名
```

示例：

```powershell
.\gradlew.bat :opentcs-kernel:build
```

含义：

| 片段 | 说明 |
| :--- | :--- |
| `.\gradlew.bat` | Windows 下执行项目自带 Gradle Wrapper。 |
| `:opentcs-kernel` | 指定只对 `opentcs-kernel` 子模块执行任务。 |
| `:build` | 执行该模块的 `build` 任务。 |

如果省略模块名，例如：

```powershell
.\gradlew.bat build
```

则表示在整个多模块工程上执行 `build`，会涉及更多子模块，耗时和副作用都更大。开发 Kernel 时通常优先使用 `:opentcs-kernel:<task>`。

#### 3.7.2 常用 Kernel 命令

| 命令 | 作用 | 主要副作用 |
| :--- | :--- | :--- |
| `.\gradlew.bat :opentcs-kernel:build` | 编译 Kernel 模块，并执行该模块构建生命周期内绑定的检查、测试、打包任务。 | 生成 `opentcs-kernel\build\` 目录；编译 Java 源码；运行测试；生成 jar/分发相关产物；如果测试失败则构建失败。 |
| `.\gradlew.bat :opentcs-kernel:run` | 启动 Kernel 进程，用于本地联调 BFF、SPA、VDA5050 适配器。 | 会编译运行所需代码；启动一个前台 Java 进程；占用 Kernel/RMI 等端口；终端关闭或 `Ctrl+C` 后进程停止；通常不会生成完整安装目录。 |
| `.\gradlew.bat :opentcs-kernel:test` | 只运行 Kernel 模块测试。 | 生成/更新 `opentcs-kernel\build\test-results\` 和 `opentcs-kernel\build\reports\tests\`；不启动 Kernel；测试失败时命令失败。 |
| `.\gradlew.bat :opentcs-kernel:installDist` | 生成可直接运行的本地安装目录。 | 生成 `opentcs-kernel\build\install\opentcs-kernel\`；复制运行脚本、依赖 jar、配置和资源；适合验证“打包后如何运行”。 |
| `.\gradlew.bat :opentcs-kernel:clean` | 清理 Kernel 模块的构建产物。 | 删除 `opentcs-kernel\build\`；不会删除源码、配置、Gradle缓存、数据库或运行时外部数据；下一次 build/run 需要重新编译。 |

#### 3.7.3 常用命令差异

`build` 与 `test` 的差异：

1. `test` 只关注测试任务。
2. `build` 是完整构建生命周期，通常包含 `compileJava`、`processResources`、`classes`、`test`、`jar`、质量检查或分发相关任务。
3. 如果只是快速验证单元测试，优先用 `test`；如果要确认模块能完整交付，使用 `build`。

`run` 与 `installDist` 的差异：

1. `run` 是开发态启动，适合本地调试和联调。
2. `installDist` 不启动程序，只生成一个本地安装目录。
3. `run` 的副作用是启动进程和占用端口；`installDist` 的副作用是生成 `build\install\...` 目录。

`build` 与 `installDist` 的差异：

1. `build` 偏向“编译、测试、检查、产物是否能构建成功”。
2. `installDist` 偏向“把程序和运行依赖按可运行目录结构铺好”。
3. 当前工程的一些模块可能让 `build` 依赖 `installDist`，因此执行 `build` 时也可能顺带生成安装目录。

`clean` 与其他命令的差异：

1. `clean` 是清理动作，不编译、不测试、不启动服务。
2. `clean build` 常用于排除旧构建产物影响：

```powershell
.\gradlew.bat :opentcs-kernel:clean :opentcs-kernel:build
```

3. `clean` 会让后续构建变慢，因为增量编译缓存被清掉。

#### 3.7.4 对 C++ 后端开发者的类比

| Java / Gradle | C++ 常见类比 | 说明 |
| :--- | :--- | :--- |
| `gradlew.bat` | 项目自带的 `build.bat` / `cmake --build` 包装脚本 | 固定构建工具版本，减少本机环境差异。 |
| `build.gradle` | `CMakeLists.txt` / 构建脚本 | 描述插件、依赖、源码集、任务关系。 |
| `:opentcs-kernel:build` | 构建某个 target | 编译并执行该 target 的验证流程。 |
| `:opentcs-kernel:test` | 运行某个 target 的测试 | 只跑测试，不启动服务。 |
| `:opentcs-kernel:run` | 启动本地调试进程 | 类似运行编译出的 server binary。 |
| `:opentcs-kernel:installDist` | 安装到本地 staging 目录 | 类似 `cmake --install --prefix build/install`。 |
| `:opentcs-kernel:clean` | 清理 build 目录 | 删除生成产物，保留源码。 |

#### 3.7.5 使用建议

日常改 Kernel 代码：

```powershell
.\gradlew.bat :opentcs-kernel:test
.\gradlew.bat :opentcs-kernel:run
```

提交前做完整验证：

```powershell
.\gradlew.bat :opentcs-kernel:clean :opentcs-kernel:build
```

验证打包目录：

```powershell
.\gradlew.bat :opentcs-kernel:installDist
```

查看有哪些任务可用：

```powershell
.\gradlew.bat :opentcs-kernel:tasks
```

## 章节4：opentcs-bff 专项深度解析

### 4.1 模块定位

`opentcs-bff` 是面向 `opentcs-spa` 的后端缓冲适配层。它不承载 Kernel 调度算法，也不直接处理 MQTT/VDA5050 报文，而是负责：

1. 对前端提供 HTTP REST、SSE、OpenAPI、Swagger UI。
2. 将前端 JSON 请求转换为 Kernel RMI 可接受的 openTCS Java 对象。
3. 将 Kernel 返回的车辆、订单、工厂模型等对象转换为前端 DTO。
4. 持久化 SPA 工程草稿和地图资产文件。
5. 将 SPA 草稿中的工厂模型 payload 转换为 `PlantModelCreationTO` 并发布到 Kernel。

核心技术栈：

| 类别 | 技术 |
| :--- | :--- |
| 语言 | Java 21 |
| Web 框架 | Javalin 7.1.0 |
| 依赖注入 | Guice |
| 配置 | Gestalt 配置绑定 |
| JSON | Jackson + `JavaTimeModule` |
| API 契约 | OpenAPI 3.0.3，`org.openapi.generator` 生成 Java DTO |
| API 文档 | Swagger UI webjar |
| Kernel 通道 | Java RMI，`KernelServicePortal` |
| 日志 | SLF4J + `slf4j-jdk14` |
| 构建 | Gradle 8.14.4 |

### 4.2 编译、启动命令与前置依赖

前置依赖：

| 依赖 | 要求 |
| :--- | :--- |
| JDK | Java 21 |
| Gradle | 使用仓库内 `gradlew.bat` / `gradlew`，版本 `8.14.4` |
| Kernel | 调用 `/api/v1/*` 中依赖 Kernel 的接口前，需先启动 `opentcs-kernel` 并开放 RMI |
| RMI 默认地址 | `bff.kernel.host=localhost`，`bff.kernel.port=1099` |
| RMI 默认账号 | `bff.kernel.userName=Alice`，`bff.kernel.password=xyz` |
| BFF HTTP 默认地址 | `0.0.0.0:8090` |
| 工作目录 | Gradle `run` 任务会先执行 `installDist`，再以 `opentcs-bff/build/install/opentcs-bff` 作为运行工作目录 |

Windows PowerShell：

```powershell
cd D:\byd_agv_njc\opentcs
.\gradlew.bat :opentcs-bff:build
.\gradlew.bat :opentcs-bff:run
```

Linux 终端：

```bash
cd /path/to/opentcs
./gradlew :opentcs-bff:build
./gradlew :opentcs-bff:run
```

生成分发包：

```powershell
.\gradlew.bat :opentcs-bff:installDist
```

分发产物目录：

```text
D:\byd_agv_njc\opentcs\opentcs-bff\build\install\opentcs-bff
```

默认配置文件：

```text
opentcs-bff/src/main/resources/org/opentcs/bff/distribution/config/opentcs-bff-defaults-baseline.properties
```

运行时配置加载顺序由 `RunBff` 指定：

1. `${opentcs.base}/config/opentcs-bff-defaults-baseline.properties`
2. `${opentcs.base}/config/opentcs-bff-defaults-custom.properties`
3. `${opentcs.home}/config/opentcs-bff.properties`

常用配置项：

| 配置项 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `bff.bindAddress` | `0.0.0.0` | HTTP 服务绑定地址。 |
| `bff.bindPort` | `8090` | HTTP 服务端口。 |
| `bff.security.accessKey` | 空字符串 | 为空表示关闭 API access-key 鉴权；非空时 `/api/*` 必须携带 `X-Api-Access-Key`。 |
| `bff.kernel.host` | `localhost` | Kernel RMI 主机。 |
| `bff.kernel.port` | `1099` | Kernel RMI 端口。 |
| `bff.kernel.userName` | `Alice` | Kernel 登录用户名。 |
| `bff.kernel.password` | `xyz` | Kernel 登录密码。 |
| `bff.workspace.dir` | `./data/bff-workspace` | SPA 工程草稿和地图资产存储根目录。 |
| `bff.workspace.assetMaxBytes` | `52428800` | 单个上传资产大小限制，默认 50 MiB。 |

### 4.3 对外 HTTP API 清单

`BffApplication` 中实际注册的路由如下。`/health`、`/openapi/bff.yaml`、`/swagger-ui/*` 不走 access-key 鉴权；`/api/*` 统一经过 `AccessKeyAuthenticator`。

| 方法 | 路径 | 鉴权 | Handler / 处理入口 | 下游依赖 | 用途 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | 否 | `HealthHandler#handle` | 无 | BFF 存活探针，返回 `{"status":"UP"}`。 |
| `GET` | `/openapi/bff.yaml` | 否 | `OpenApiSpecHandler#handle` | classpath 资源 | 返回 OpenAPI YAML。 |
| `GET` | `/swagger-ui/*` | 否 | Javalin static files | Swagger UI webjar | 浏览器 API 文档页面。 |
| `GET` | `/api/v1/plant-model/summary` | 是 | `PlantModelSummaryHandler#handle` | Kernel RMI | 返回当前 Kernel 工厂模型名称及点、路径、库位、车辆等数量。 |
| `GET` | `/api/v1/vehicles` | 是 | `ListVehiclesHandler#handle` | Kernel RMI | 查询 Kernel 中全部车辆，按名称排序返回。 |
| `GET` | `/api/v1/vehicles/{name}` | 是 | `GetVehicleHandler#handle` | Kernel RMI | 查询单车详情。 |
| `PUT` | `/api/v1/vehicles/{name}/integrationLevel` | 是 | `UpdateVehicleIntegrationLevelHandler#handle` | Kernel RMI | 更新车辆 integration level。 |
| `POST` | `/api/v1/vehicles/{name}/rerouteRequest?forced=false` | 是 | `RerouteVehicleHandler#handle` | Kernel RMI | 请求车辆重新规划路线，`forced=true` 时使用强制重路由。 |
| `POST` | `/api/v1/transport-orders` | 是 | `CreateTransportOrderHandler#handle` | Kernel RMI | 创建运输订单。 |
| `GET` | `/api/v1/sse?vehicles=true&transportOrders=true` | 是 | `SseEventBridge#register` | Kernel RMI 事件轮询 | 建立 SSE 长连接，接收车辆和订单变化事件。 |
| `GET` | `/api/v1/sse/ping` | 是 | `SsePingHandler#handle` | 内存状态 | 返回 SSE 当前连接数、支持事件类型和服务器时间。 |
| `GET` | `/api/v1/projects` | 是 | `ProjectsHandler#list` | 本地磁盘 | 列出 BFF workspace 中所有 SPA 工程。 |
| `POST` | `/api/v1/projects` | 是 | `ProjectsHandler#create` | 本地磁盘 | 创建新工程，返回 `201` 和 `Location`。 |
| `GET` | `/api/v1/projects/{id}` | 是 | `ProjectsHandler#get` | 本地磁盘 | 获取工程元数据。 |
| `PATCH` | `/api/v1/projects/{id}` | 是 | `ProjectsHandler#rename` | 本地磁盘 | 重命名工程显示名称。 |
| `DELETE` | `/api/v1/projects/{id}` | 是 | `ProjectsHandler#delete` | 本地磁盘 | 删除工程目录。 |
| `POST` | `/api/v1/projects/{id}/copy` | 是 | `ProjectsHandler#copy` | 本地磁盘 | 另存为工程，复制草稿和资产，不复制发布历史。 |
| `GET` | `/api/v1/projects/{id}/draft` | 是 | `ProjectsHandler#getDraft` | 本地磁盘 | 读取工程 `draft.json`。 |
| `PUT` | `/api/v1/projects/{id}/draft` | 是 | `ProjectsHandler#putDraft` | 本地磁盘 | 全量替换工程草稿，要求 body 包含整数 `version` 字段。 |
| `GET` | `/api/v1/projects/{id}/assets` | 是 | `ProjectAssetsHandler#list` | 本地磁盘 | 列出工程资产。 |
| `POST` | `/api/v1/projects/{id}/assets` | 是 | `ProjectAssetsHandler#upload` | 本地磁盘 | 上传一个或多个地图资产文件。 |
| `GET` | `/api/v1/projects/{id}/assets/{name}` | 是 | `ProjectAssetsHandler#download` | 本地磁盘 | 下载资产文件。 |
| `DELETE` | `/api/v1/projects/{id}/assets/{name}` | 是 | `ProjectAssetsHandler#delete` | 本地磁盘 | 删除资产文件。 |
| `POST` | `/api/v1/plant-models/publish` | 是 | `PublishHandler#handle` | 本地磁盘 + Kernel RMI | 读取工程草稿，转换为 `PlantModelCreationTO`，发布到 Kernel。 |

说明：

1. `src/main/resources/openapi/bff.yaml` 是 OpenAPI 契约文件，列出了主要前端接口。
2. `GET /api/v1/plant-model/summary` 已在 `BffApplication` 注册，但当前 OpenAPI YAML 中未声明；以实际路由为准。
3. API 错误响应统一使用 `ErrorResponse`，字段包括 `code`、`message`、`traceId`，发布校验错误还可能带 `fieldPath`。
4. BFF 会在所有匹配请求中写回 `X-Trace-Id` 响应头，用于前端、日志和故障排查关联。

### 4.4 API 文档查看方式

启动 BFF 后访问：

```text
http://localhost:8090/swagger-ui/
```

OpenAPI 原始 YAML：

```text
http://localhost:8090/openapi/bff.yaml
```

Swagger UI 初始化脚本位于：

```text
opentcs-bff/src/main/resources/swagger-ui-overrides/swagger-initializer.js
```

该脚本将 Swagger UI 的 spec URL 固定为 `/openapi/bff.yaml`。

### 4.5 API 测试示例

以下示例默认 BFF 运行在 `http://localhost:8090`。如果 `bff.security.accessKey` 为空，可以省略 `X-Api-Access-Key`；如果已配置 access key，所有 `/api/*` 请求都需要携带该 header。

#### 4.5.1 Windows PowerShell

健康检查：

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8090/health"
```

查看 OpenAPI YAML：

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8090/openapi/bff.yaml"
```

查询车辆列表：

```powershell
$headers = @{ "X-Api-Access-Key" = "dev-key" }
Invoke-RestMethod -Method Get `
  -Uri "http://localhost:8090/api/v1/vehicles" `
  -Headers $headers

# 不带 api-Access-key
Invoke-RestMethod -Method Get -Uri "http://localhost:8090/api/v1/vehicles"
```

查询单车：

```powershell
Invoke-RestMethod -Method Get `
  -Uri "http://localhost:8090/api/v1/vehicles/Vehicle-01" `
  -Headers $headers
```

更新车辆 integration level：

```powershell
$body = @{ integrationLevel = "TO_BE_UTILIZED" } | ConvertTo-Json
Invoke-RestMethod -Method Put `
  -Uri "http://localhost:8090/api/v1/vehicles/Vehicle-01/integrationLevel" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

请求车辆重路由：

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8090/api/v1/vehicles/Vehicle-01/rerouteRequest?forced=false" `
  -Headers $headers
```

创建运输订单：

```powershell
$order = @{
  name = "order-demo-001"
  incompleteName = $false
  dispensable = $false
  intendedVehicle = $null
  type = "-"
  destinations = @(
    @{ locationName = "Point-1"; operation = "MOVE" },
    @{ locationName = "Location-2"; operation = "pick" },
    @{ locationName = "Point-3"; operation = "MOVE" },
    @{ locationName = "Location-4"; operation = "drop" }
  )
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8090/api/v1/transport-orders" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $order
```

SSE 订阅建议使用 `curl.exe`，避免 PowerShell 的 `curl` 别名行为差异：

```powershell
curl.exe -N `
  -H "X-Api-Access-Key: dev-key" `
  -H "Accept: text/event-stream" `
  "http://localhost:8090/api/v1/sse?vehicles=true&transportOrders=true"
```

说明：

1. `Accept: text/event-stream` 明确告诉 BFF 客户端期望接收 SSE 流。BFF 的 `/api/v1/sse` 是 Javalin SSE 路由，带该请求头时服务端会按 SSE 长连接处理，响应 `Content-Type: text/event-stream`，连接保持打开并持续输出事件。
2. 不带 `Accept: text/event-stream` 时，部分服务端框架、代理或路由匹配逻辑可能不会把请求识别为 SSE 协议请求，可能直接返回非流式响应或结束连接，表现为 curl 命令立即退出。
3. `-N` 是 curl 的 `--no-buffer` 简写，表示关闭 curl 输出缓冲。SSE 是小块、持续到达的数据流；不加 `-N` 时，curl 可能攒够缓冲区后才打印，导致车辆或订单事件看起来没有实时输出。

创建工程：

```powershell
$project = @{ name = "SS27 地图工程" } | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8090/api/v1/projects" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $project
```

上传地图资产：

```powershell
curl.exe -X POST `
  -H "X-Api-Access-Key: dev-key" `
  -F "file=@D:\tmp\SS27.png" `
  -F "file=@D:\tmp\SS27.yaml" `
  "http://localhost:8090/api/v1/projects/ss27-demo/assets"
```

保存工程草稿：

```powershell
$draft = @{
  version = 2
  savedAt = (Get-Date).ToUniversalTime().ToString("o")
  payload = @{
    points = @()
    paths = @()
    locationTypes = @()
    locations = @()
    blocks = @()
    vehicles = @()
  }
} | ConvertTo-Json -Depth 20

Invoke-RestMethod -Method Put `
  -Uri "http://localhost:8090/api/v1/projects/ss27-demo/draft" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $draft
```

发布前 dry-run：

```powershell
$publish = @{ projectId = "ss27-demo"; dryRun = $true } | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8090/api/v1/plant-models/publish" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $publish
```

#### 4.5.2 Linux 终端

健康检查：

```bash
curl -s http://localhost:8090/health
```

查询车辆：

```bash
curl -s \
  -H 'X-Api-Access-Key: dev-key' \
  http://localhost:8090/api/v1/vehicles
```

创建运输订单：

```bash
curl -s -X POST \
  -H 'X-Api-Access-Key: dev-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "order-demo-001",
    "incompleteName": false,
    "dispensable": false,
    "type": "-",
    "destinations": [
      {"locationName": "Point-1", "operation": "MOVE"},
      {"locationName": "Location-2", "operation": "pick"},
      {"locationName": "Point-3", "operation": "MOVE"},
      {"locationName": "Location-4", "operation": "drop"}
    ]
  }' \
  http://localhost:8090/api/v1/transport-orders
```

订阅 SSE：

```bash
curl -N \
  -H 'X-Api-Access-Key: dev-key' \
  -H 'Accept: text/event-stream' \
  'http://localhost:8090/api/v1/sse?vehicles=true&transportOrders=true'
```

说明：

1. `Accept: text/event-stream` 用于声明客户端要建立 SSE 流式订阅。
2. `-N` / `--no-buffer` 用于关闭 curl 输出缓冲，确保每条 SSE 事件到达后尽快显示。

创建工程并上传资产：

```bash
curl -s -X POST \
  -H 'X-Api-Access-Key: dev-key' \
  -H 'Content-Type: application/json' \
  -d '{"name":"SS27 地图工程","id":"ss27-demo"}' \
  http://localhost:8090/api/v1/projects

curl -s -X POST \
  -H 'X-Api-Access-Key: dev-key' \
  -F 'file=@/tmp/SS27.png' \
  -F 'file=@/tmp/SS27.yaml' \
  http://localhost:8090/api/v1/projects/ss27-demo/assets
```

保存草稿：

```bash
curl -s -X PUT \
  -H 'X-Api-Access-Key: dev-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "version": 2,
    "payload": {
      "points": [],
      "paths": [],
      "locationTypes": [],
      "locations": [],
      "blocks": [],
      "vehicles": []
    }
  }' \
  http://localhost:8090/api/v1/projects/ss27-demo/draft
```

发布工程模型：

```bash
curl -s -X POST \
  -H 'X-Api-Access-Key: dev-key' \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"ss27-demo","dryRun":true}' \
  http://localhost:8090/api/v1/plant-models/publish
```

#### 4.5.3 SSE 介绍

##### 4.5.3.1 名词解释

SSE 是 Server-Sent Events 的缩写，中文通常称为服务端事件推送。它是一种基于 HTTP 的单向实时通信机制：浏览器或命令行客户端向服务端发起一次 HTTP 请求，服务端保持连接不关闭，并持续向客户端推送事件数据。

在本项目中，SSE 用于 BFF 向 opentcs-spa 推送实时变化数据，典型数据包括：

1. AGV 车辆状态变化，例如车辆位置、运行状态、能量状态、集成级别、是否在线等。
2. 运输订单状态变化，例如订单创建、调度、执行中、完成、失败、撤销等。

SSE 与普通 REST API 的区别如下：

| 对比项 | 普通 REST API | SSE |
| --- | --- | --- |
| 通信方式 | 客户端请求一次，服务端响应一次 | 客户端请求一次，服务端持续推送 |
| 连接生命周期 | 响应完成后立即关闭 | 长连接，通常保持打开 |
| 数据方向 | 客户端主动拉取 | 服务端主动推送到客户端 |
| 典型用途 | 查询、创建、修改、删除资源 | 实时状态刷新、事件通知 |
| HTTP 响应类型 | 通常为 `application/json` | `text/event-stream` |

##### 4.5.3.2 工作原理

BFF 的 SSE 接口路径为：

```text
GET /api/v1/sse?vehicles=true&transportOrders=true
```

该接口的核心工作过程如下：

1. 客户端携带 `X-Api-Access-Key` 调用 `/api/v1/sse`。
2. 客户端通过 `Accept: text/event-stream` 声明自己希望建立 SSE 流式连接。
3. BFF 校验访问密钥，通过后建立 SSE 长连接。
4. BFF 根据查询参数决定订阅哪些事件类型：
   - `vehicles=true`：订阅车辆状态变化。
   - `transportOrders=true`：订阅运输订单状态变化。
5. BFF 下游通过 RMI 或内部服务读取 kernel 侧状态，并在状态变化时组织为 SSE 事件。
6. 服务端按 `text/event-stream` 格式持续写出事件，客户端收到后实时更新界面或打印到终端。

SSE 数据在 HTTP 响应体中的典型格式如下：

```text
event: /events/vehicles
data: {"currentObjectState":{"name":"Vehicle-1","state":"UNKNOWN","procState":"IDLE","integrationLevel":"TO_BE_RESPECTED","paused":false,"energyLevel":100,"currentPosition":null,"precisePosition":null,"orientationAngle":null},"previousObjectState":{"name":"Vehicle-1","state":"UNKNOWN","procState":"IDLE","integrationLevel":"TO_BE_RESPECTED","paused":false,"energyLevel":100,"currentPosition":null,"precisePosition":null,"orientationAngle":null}}

event: /events/transportOrders
data: {"currentObjectState":null,"previousObjectState":{"name":"spa-178166620206201KV9S9GHB1708PQGFESHGVK42","type":"-","state":"RAW","intendedVehicle":"Vehicle-1","processingVehicle":null,"destinations":[{"locationName":"Point-49","operation":"MOVE","properties":null},{"locationName":"Point-34","operation":"PARK","properties":null}]}}
```

其中：

1. `event` 表示事件名称，客户端可按事件类型做不同处理。
2. `data` 表示事件数据，通常为 JSON 字符串。
3. 每个事件之间通过空行分隔。

##### 4.5.3.3 测试注意事项

测试 SSE 时需要注意以下几点：

1. 必须使用支持流式输出的客户端。推荐使用 `curl.exe` 或 Linux/macOS 原生 `curl`。
2. PowerShell 中的 `curl` 可能是 `Invoke-WebRequest` 的别名，不一定等价于真正的 curl；Windows 下建议显式使用 `curl.exe`。
3. 建议增加请求头 `Accept: text/event-stream`，明确告诉 BFF 当前请求期望建立 SSE 流式连接。
4. 建议增加 `-N` 参数。`-N` 是 curl 的 `--no-buffer` 简写，用于关闭 curl 输出缓冲，避免事件已经到达但终端暂时不打印。
5. SSE 命令正常情况下不会像普通 REST 请求一样立即退出；只要连接未断开，它会持续挂起等待服务端推送事件。
6. 如果命令立即退出，优先检查请求头、访问密钥、BFF 日志、接口路径、查询参数和服务端是否实际注册了 SSE 路由。
7. 如果连接保持打开但没有输出，不一定代表接口异常，可能只是车辆和订单状态暂时没有变化。可以通过创建运输订单、切换车辆集成级别或触发车辆状态上报来制造事件。
8. SSE 长连接经过代理、网关或负载均衡时，需要确认中间层没有强制缓冲响应或提前关闭空闲连接。

推荐测试命令如下：

```powershell
curl.exe -N `
  -H "X-Api-Access-Key: dev-key" `
  -H "Accept: text/event-stream" `
  "http://localhost:8090/api/v1/sse?vehicles=true&transportOrders=true"
```

```bash
curl -N \
  -H 'X-Api-Access-Key: dev-key' \
  -H 'Accept: text/event-stream' \
  'http://localhost:8090/api/v1/sse?vehicles=true&transportOrders=true'
```

##### 4.5.3.4 与 WebSocket、轮询的区别

SSE、WebSocket 和轮询都可以用于前端实时刷新，但适用场景不同：

| 方案 | 特点 | 适用场景 |
| --- | --- | --- |
| 轮询 | 前端定时请求服务端，简单但会产生大量重复请求 | 低频状态刷新、实现成本优先的页面 |
| SSE | 基于 HTTP，服务端单向推送，浏览器原生支持自动重连 | 车辆状态、订单状态、告警通知等服务端主动事件 |
| WebSocket | 双向长连接，客户端和服务端都可主动发送消息 | 即时通信、远程控制、高频双向交互 |

本项目的车辆状态和订单状态主要是服务端向前端单向推送，前端只需要接收并渲染，不需要通过同一条连接反向发送控制指令，因此使用 SSE 比 WebSocket 更轻量，也更符合当前 BFF 的接口职责。

##### 4.5.3.5 故障排查建议

SSE 测试异常时可按以下顺序排查：

1. 确认 BFF 已启动，并且 `/health` 返回正常。
2. 确认请求中携带正确的 `X-Api-Access-Key`。
3. 确认请求中携带 `Accept: text/event-stream`。
4. 确认 curl 使用了 `-N`，避免输出被客户端缓冲。
5. 确认查询参数至少打开一个订阅类型，例如 `vehicles=true` 或 `transportOrders=true`。
6. 查看 BFF 日志，确认 SSE 连接是否建立、是否被鉴权拦截、是否发生异常断开。
7. 查看 kernel 和通信适配器状态，确认下游是否有车辆或订单状态变化。
8. 如果通过 Nginx、网关或代理访问，检查是否开启了响应缓冲或连接超时限制。

### 4.6 BFF 核心业务数据流

#### 4.6.1 启动数据流

```text
RunBff#main
  -> GestaltConfigurationBindingProvider 读取配置
  -> 创建 BffConfiguration / BffKernelConfiguration / BffSecurityConfiguration / BffWorkspaceConfiguration
  -> Guice.createInjector(new BffModule(...))
  -> injector.getInstance(BffApplication)
  -> BffApplication#start
  -> Javalin.start
  -> KernelEventPoller#start
  -> SseHeartbeatScheduler#start
```

说明：

1. `RunBff` 位于 `opentcs-bff/src/guiceConfig/java/org/opentcs/bff/RunBff.java`。
2. `BffModule` 将配置对象绑定到 Guice，并将 `KernelServicePortalFactory` 绑定到 `DefaultKernelServicePortalFactory`。
3. `BffApplication` 负责 Javalin 初始化、JSON mapper、静态 Swagger UI、路由注册、鉴权过滤器和异常映射。
4. JVM shutdown hook 会调用 `BffApplication#stop` 和 `KernelClient#close`，关闭 SSE、后台线程和 RMI portal。

#### 4.6.2 统一请求处理流

```text
HTTP request
  -> Javalin 路由匹配
  -> beforeMatched 生成 / 回写 X-Trace-Id
  -> 若路径以 /api/ 开头，AccessKeyAuthenticator 校验 X-Api-Access-Key
  -> 对应 Handler 读取 path/query/body
  -> 调用 ProjectStore / KernelClient / Publish 转换器等内部服务
  -> 返回 JSON、SSE、文件流或空响应
  -> 异常由 BffApplication 统一映射为 ErrorResponse
```

鉴权规则：

1. `bff.security.accessKey` 为空时，`/api/*` 允许无 header 访问。
2. `bff.security.accessKey` 非空时，请求必须携带 `X-Api-Access-Key`，且值完全匹配配置值。
3. 鉴权失败返回 HTTP `401`，body 为统一 `ErrorResponse`。

#### 4.6.3 Kernel RMI 访问流

```text
业务 Handler
  -> KernelClient
  -> KernelClient#ensureConnected
  -> DefaultKernelServicePortalFactory#create
  -> KernelServicePortalBuilder(userName, password).build()
  -> portal.login(host, port)
  -> portal.getPlantModelService / getVehicleService / getTransportOrderService / getDispatcherService
  -> Kernel 返回 openTCS domain object
  -> Converter 转为 BFF DTO
  -> HTTP JSON response
```

`KernelClient` 是长生命周期单例，内部缓存一个 `KernelServicePortal`。当 Kernel 抛出 `CredentialsException` 时，`KernelClient` 会丢弃缓存 portal 并重试一次，用于处理 Kernel 清理空闲 client 后的临时失效问题。

#### 4.6.4 车辆查询与控制流

车辆列表：

```text
GET /api/v1/vehicles
  -> ListVehiclesHandler#handle
  -> KernelClient#listVehicles
  -> VehicleService#fetch(Vehicle.class)
  -> VehicleConverter#toDto
  -> 按 name 排序
  -> JSON array response
```

单车查询：

```text
GET /api/v1/vehicles/{name}
  -> GetVehicleHandler#handle
  -> KernelClient#findVehicle
  -> VehicleService#fetch(Vehicle.class, name)
  -> VehicleConverter#toDto
  -> JSON response 或 404 VEHICLE_NOT_FOUND
```

integration level 更新：

```text
PUT /api/v1/vehicles/{name}/integrationLevel
  -> UpdateVehicleIntegrationLevelHandler#handle
  -> 解析 VehicleIntegrationLevelUpdate
  -> KernelClient#updateVehicleIntegrationLevel
  -> VehicleService#fetch 当前车辆
  -> VehicleService#updateVehicleIntegrationLevel
  -> 再次 fetch 更新后的车辆
  -> VehicleConverter#toDto
  -> JSON response
```

重路由：

```text
POST /api/v1/vehicles/{name}/rerouteRequest?forced=false
  -> RerouteVehicleHandler#handle
  -> forced=false 映射为 ReroutingType.REGULAR
  -> forced=true 映射为 ReroutingType.FORCED
  -> KernelClient#rerouteVehicle
  -> DispatcherService#reroute
  -> HTTP 200
```

#### 4.6.5 运输订单创建流

```text
POST /api/v1/transport-orders
  -> CreateTransportOrderHandler#handle
  -> Jackson 反序列化 TransportOrderRequest
  -> TransportOrderConverter#toCreationTO
  -> 校验 name、destinations、locationName、operation
  -> DestinationCreationTO 列表
  -> TransportOrderCreationTO
  -> KernelClient#createTransportOrder
  -> TransportOrderService#createTransportOrder
  -> TransportOrderConverter#toDto
  -> JSON response
```

`TransportOrderConverter#toCreationTO` 的主要转换规则：

| 前端字段 | Kernel 对象字段 |
| :--- | :--- |
| `name` | `TransportOrderCreationTO(name, destinations)` |
| `destinations[].locationName` | `DestinationCreationTO(locationName, operation)` |
| `destinations[].operation` | `DestinationCreationTO(locationName, operation)` |
| `destinations[].properties` | `DestinationCreationTO#withProperties` |
| `incompleteName` | `TransportOrderCreationTO#withIncompleteName` |
| `dispensable` | `TransportOrderCreationTO#withDispensable` |
| `intendedVehicle` | `TransportOrderCreationTO#withIntendedVehicleName` |
| `dependencies` | `TransportOrderCreationTO#withDependencyNames` |
| `deadline` | `TransportOrderCreationTO#withDeadline`，未填时为 `Instant.MAX` |
| `type` | `TransportOrderCreationTO#withType`，未填时为 `OrderConstants.TYPE_NONE` |
| `properties` | `TransportOrderCreationTO#withProperties` |

#### 4.6.6 SSE 实时事件流

```text
GET /api/v1/sse?vehicles=true&transportOrders=true
  -> SseEventBridge#register
  -> 根据 query 参数记录订阅事件类型
  -> 发送 connected comment
  -> client.keepAlive

BffApplication#start
  -> KernelEventPoller#start
  -> 后台线程检测存在 SSE client
  -> KernelClient#fetchEvents(1000ms)
  -> KernelServicePortal#fetchEvents
  -> 过滤 TCSObjectEvent
  -> SseEventBridge#dispatch
  -> VehicleConverter / TransportOrderConverter
  -> client.sendEvent("/events/vehicles" 或 "/events/transportOrders", payload)

BffApplication#start
  -> SseHeartbeatScheduler#start
  -> 每 20 秒 SseEventBridge#broadcastHeartbeat
  -> 向所有 SSE client 发送 keepalive comment
```

SSE 支持的事件名：

| query 参数 | SSE event 字段 |
| :--- | :--- |
| `vehicles=true` | `/events/vehicles` |
| `transportOrders=true` | `/events/transportOrders` |

事件 payload 为 `SseEventEnvelope`：

| 字段 | 说明 |
| :--- | :--- |
| `currentObjectState` | 变化后的对象；删除事件中可能为 `null`。 |
| `previousObjectState` | 变化前的对象；创建事件中可能为 `null`。 |

#### 4.6.7 SPA 工程与资产持久化流

工程根目录：

```text
${bff.workspace.dir}/
└── projects/
    └── {projectId}/
        ├── meta.json
        ├── draft.json
        └── assets/
            ├── *.png
            ├── *.pgm
            ├── *.yaml
            └── *.yml
```

创建工程：

```text
POST /api/v1/projects
  -> ProjectsHandler#create
  -> ProjectStore#create
  -> ProjectId.fromName 或 ProjectId.of
  -> 创建 projects/{id}/assets
  -> 写 meta.json
  -> HTTP 201 + Location
```

保存草稿：

```text
PUT /api/v1/projects/{id}/draft
  -> ProjectsHandler#putDraft
  -> ProjectStore#writeDraft
  -> 校验 envelope.version 为整数
  -> draft.json 写临时文件
  -> atomic move 替换 draft.json
  -> 更新 meta.json 的 updatedAt / hasDraft / assets
  -> HTTP 204
```

上传资产：

```text
POST /api/v1/projects/{id}/assets
  -> ProjectAssetsHandler#upload
  -> 读取 multipart uploadedFiles
  -> ProjectStore#writeAsset
  -> 校验文件名匹配 ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}\.(png|pgm|yaml|yml)$
  -> 流式写入 .upload-*.tmp
  -> 检查大小不超过 bff.workspace.assetMaxBytes
  -> atomic move 到 assets/{name}
  -> 更新 meta.json
  -> HTTP 201
```

路径安全约束：

1. `ProjectId` 必须匹配 `^[a-z0-9][a-z0-9_-]{0,63}$`，禁止 `.`、`..`、`/`、`\`、`:` 等路径逃逸字符。
2. 资产文件名只允许 `png`、`pgm`、`yaml`、`yml`。
3. 写入和读取前会校验解析后的目标路径仍在项目目录或 assets 目录下。

#### 4.6.8 工厂模型发布流

```text
POST /api/v1/plant-models/publish
  -> PublishHandler#handle
  -> 解析 PublishRequest(projectId, modelName, dryRun)
  -> ProjectStore#find 校验工程存在
  -> ProjectStore#readDraft 读取 draft.json
  -> 取 draft.payload
  -> IntermediateJsonToPlantModelConverter#toCreationTO(payload, modelName)
  -> 生成 PlantModelCreationTO
  -> 统计 points / paths / locationTypes / locations / blocks / vehicles 形成 diff
  -> dryRun=true：直接返回 PublishResponse，不连接 Kernel
  -> dryRun=false：创建临时 KernelServicePortal
  -> portal.login(host, port)
  -> PlantModelService#createPlantModel(to)
  -> portal.logout
  -> ProjectStore#markPublished 写 lastPublishedAt
  -> 返回 PublishResponse
```

发布转换器规则：

| SPA payload 数组 | Kernel TO |
| :--- | :--- |
| `points[]` | `PointCreationTO` |
| `paths[]` | `PathCreationTO` |
| `locationTypes[]` | `LocationTypeCreationTO` |
| `locations[]` | `LocationCreationTO` |
| `blocks[]` | `BlockCreationTO` |
| `vehicles[]` | `VehicleCreationTO` |

`IntermediateJsonToPlantModelConverter` 不做单位转换、不做枚举重命名，要求 SPA 草稿 payload 已经对齐 openTCS `*CreationTO` 字段。转换过程中会校验：

1. 必填字段是否存在，例如 `name`、`pose.position`、`srcPointName`、`destPointName`、`typeName`。
2. 路径引用的源点、目标点是否存在。
3. 库位类型、库位 link point 是否存在。
4. block member 是否引用已知 point、location 或 path。
5. 枚举值是否合法。
6. 颜色字段是否符合 `#RRGGBB`。
7. 当 path 属性 `vda5050:vehicleOrientation` 为 `BACKWARD` 或 `REVERSE` 时，`maxReverseVelocity` 必须大于 0。

### 4.7 BFF 核心业务类与关键函数清单

#### 4.7.1 启动与路由

| 类 | 关键函数 | 职责 |
| :--- | :--- | :--- |
| `org.opentcs.bff.RunBff` | `main` | BFF 进程入口；读取 Gestalt 配置；创建 Guice injector；启动应用；注册 shutdown hook。 |
| `BffModule` | `configure` | 绑定 BFF、Kernel、安全、workspace 配置；绑定 `KernelServicePortalFactory`。 |
| `BffApplication` | 构造函数 | 初始化 Javalin、Jackson、Swagger UI 静态资源、路由、鉴权过滤器和异常映射。 |
| `BffApplication` | `start` | 启动 HTTP 服务、Kernel 事件轮询线程、SSE 心跳线程。 |
| `BffApplication` | `stop` | 停止事件轮询、心跳、SSE client 和 HTTP 服务。 |

#### 4.7.2 配置与安全

| 类 | 关键函数 / 字段 | 职责 |
| :--- | :--- | :--- |
| `BffConfiguration` | `bindAddress`、`bindPort` | BFF HTTP 绑定配置。 |
| `BffKernelConfiguration` | `host`、`port`、`userName`、`password` | Kernel RMI 连接配置。 |
| `BffSecurityConfiguration` | `accessKey` | API 静态 access-key 配置。 |
| `BffWorkspaceConfiguration` | `dir`、`assetMaxBytes` | 工程草稿和资产存储配置。 |
| `AccessKeyAuthenticator` | `isEnabled`、`isAuthenticated` | 校验 `X-Api-Access-Key`。 |
| `ErrorResponses` | `write`、`traceIdFor` | 统一错误响应和 trace id 生成。 |

#### 4.7.3 Kernel 访问

| 类 | 关键函数 | 职责 |
| :--- | :--- | :--- |
| `KernelClient` | `ensureConnected` | 懒加载并登录 `KernelServicePortal`。 |
| `KernelClient` | `getPlantModel` | 读取当前 Kernel 工厂模型。 |
| `KernelClient` | `listVehicles`、`findVehicle` | 读取车辆集合或单车。 |
| `KernelClient` | `updateVehicleIntegrationLevel` | 更新车辆 integration level。 |
| `KernelClient` | `rerouteVehicle` | 调用 DispatcherService 请求重路由。 |
| `KernelClient` | `createTransportOrder` | 调用 TransportOrderService 创建运输订单。 |
| `KernelClient` | `fetchEvents` | 拉取 Kernel 为当前 RMI client 缓冲的事件。 |
| `KernelClient` | `close` | 登出并清理缓存 portal。 |
| `DefaultKernelServicePortalFactory` | `create` | 使用 `KernelServicePortalBuilder` 创建非 SSL RMI portal。 |

#### 4.7.4 车辆与订单

| 类 | 关键函数 | 职责 |
| :--- | :--- | :--- |
| `ListVehiclesHandler` | `handle` | 查询全部车辆并返回 DTO 列表。 |
| `GetVehicleHandler` | `handle` | 查询单车，未找到时返回 `VEHICLE_NOT_FOUND`。 |
| `UpdateVehicleIntegrationLevelHandler` | `handle` | 解析 integration level 更新请求并转发 Kernel。 |
| `RerouteVehicleHandler` | `handle` | 解析 `forced` 参数并请求 Kernel 重路由。 |
| `VehicleConverter` | `toDto` | 将 Kernel `Vehicle` 转换为 BFF `Vehicle` DTO，包含状态、能量、当前位置、精确位姿和朝向。 |
| `CreateTransportOrderHandler` | `handle` | 解析订单创建请求并提交 Kernel。 |
| `TransportOrderConverter` | `toCreationTO` | 将 `TransportOrderRequest` 转换为 `TransportOrderCreationTO`。 |
| `TransportOrderConverter` | `toDto` | 将 Kernel `TransportOrder` 转换为 BFF `TransportOrder` DTO。 |

#### 4.7.5 SSE 事件

| 类 | 关键函数 | 职责 |
| :--- | :--- | :--- |
| `KernelEventPoller` | `start`、`stop` | 管理 Kernel 事件轮询后台线程。 |
| `KernelEventPoller` | `pollLoop` | 有 SSE client 时调用 `KernelClient#fetchEvents` 并转交 bridge。 |
| `SseEventBridge` | `register` | 注册 SSE client，解析订阅参数。 |
| `SseEventBridge` | `dispatch` | 将 Kernel `TCSObjectEvent` 转换为车辆或订单 SSE 事件。 |
| `SseEventBridge` | `broadcastHeartbeat` | 向所有 SSE client 发送 keepalive comment。 |
| `SseHeartbeatScheduler` | `start`、`stop` | 每 20 秒触发 SSE 心跳。 |
| `SsePingHandler` | `handle` | 返回 SSE 通道状态。 |
| `SseEventTypes` | `SUPPORTED_EVENTS`、`QUERY_PARAM_TO_EVENT_TYPE` | 定义支持的 SSE 事件名和 query 参数映射。 |

#### 4.7.6 工程草稿与资产

| 类 | 关键函数 | 职责 |
| :--- | :--- | :--- |
| `ProjectsHandler` | `list`、`create`、`get`、`rename`、`delete`、`copy` | 工程 CRUD 和另存为接口。 |
| `ProjectsHandler` | `getDraft`、`putDraft` | 读取和保存工程草稿。 |
| `ProjectAssetsHandler` | `list`、`upload`、`download`、`delete` | 工程资产列表、上传、下载、删除。 |
| `ProjectStore` | `list`、`find`、`create`、`rename`、`delete`、`copy` | 基于文件系统的工程元数据管理。 |
| `ProjectStore` | `readDraft`、`writeDraft` | 读取和原子写入 `draft.json`。 |
| `ProjectStore` | `listAssets`、`writeAsset`、`resolveAsset`、`deleteAsset` | 资产文件管理、大小限制和路径安全检查。 |
| `ProjectStore` | `markPublished` | 发布成功后写入 `lastPublishedAt`。 |
| `ProjectId` | `of`、`fromName` | 工程 id 校验与从显示名称生成安全 id。 |

#### 4.7.7 工厂模型发布

| 类 | 关键函数 | 职责 |
| :--- | :--- | :--- |
| `PublishHandler` | `handle` | 处理发布请求，读取草稿，转换模型，dry-run 或发布到 Kernel。 |
| `PublishHandler` | `sendToKernel` | 创建临时 portal，登录 Kernel，调用 `createPlantModel`，最后登出。 |
| `IntermediateJsonToPlantModelConverter` | `toCreationTO` | 将 SPA payload 转为 `PlantModelCreationTO`。 |
| `IntermediateJsonToPlantModelConverter` | `convertPoint`、`convertPath`、`convertLocationType`、`convertLocation`、`convertBlock`、`convertVehicle` | 分别转换工厂模型各类对象。 |
| `PublishValidationException` | `fieldPath` | 表示发布校验失败，并携带前端可定位的 JSON 字段路径。 |
| `KernelUnreachableException` | 构造函数 | 表示发布过程中 Kernel 不可达或拒绝 `createPlantModel`。 |

### 4.8 故障排查要点

| 现象 | 常见原因 | 排查方式 |
| :--- | :--- | :--- |
| `/health` 正常，但 `/api/v1/vehicles` 返回 `503 KERNEL_UNAVAILABLE` | Kernel 未启动、RMI 端口不通、账号密码错误 | 检查 `bff.kernel.host`、`bff.kernel.port`、Kernel 日志和 BFF 日志中的 trace id。 |
| `/api/*` 返回 `401 UNAUTHORIZED` | 配置了 `bff.security.accessKey` 但请求未带或带错 `X-Api-Access-Key` | 对照 BFF 配置文件，确认请求 header。 |
| 上传资产返回 `413 ASSET_TOO_LARGE` | 单文件超过 `bff.workspace.assetMaxBytes` | 调大配置或压缩地图资产。 |
| 上传资产返回 `400 BAD_REQUEST` | 文件名不符合白名单正则，或扩展名不是 `png/pgm/yaml/yml` | 重命名文件，只保留允许字符和扩展名。 |
| 发布返回 `400 PUBLISH_VALIDATION` | 草稿 payload 缺必填字段、引用不存在或枚举非法 | 查看响应中的 `fieldPath` 定位前端草稿对象。 |
| 发布返回 `502 KERNEL_UNREACHABLE` | Kernel 不可达，或 Kernel 拒绝 `createPlantModel` | 检查 Kernel 是否处于可写入模型的运行状态，并用 dry-run 先排除 BFF 侧校验问题。 |
| SSE 无事件 | 未加 `vehicles=true` 或 `transportOrders=true`，或 Kernel 无对象变化事件 | 先调用 `/api/v1/sse/ping`，再用 `curl -N` 观察原始 SSE 流。 |

### 4.9 openTCS-BFF 配置加载机制源码全解析

#### 4.9.1 本节先给结论

`opentcs-bff` 的配置不是 Spring Boot 的 `application.yml`，也不是代码里手写 `Properties.load()` 后到处传 `Map`。它沿用 openTCS 主仓库的 Gestalt 配置体系：

```text
.properties 配置文件
  -> GestaltConfigurationBindingProvider
  -> 按 prefix 绑定成 Java 配置接口代理对象
  -> RunBff 把配置对象交给 Guice
  -> 业务类通过构造函数注入配置对象
  -> 启动期或首次使用时读取字段
```

从 C++ 视角看，它更像“启动时读取多份 ini/properties 文件，合并成一个强类型配置对象，然后把这个对象注册到全局对象工厂里”。业务代码不用关心文件 IO，只调用 `configuration.bindPort()`、`configuration.host()` 这类强类型函数。

当前 BFF 涉及四组配置接口：

| 配置接口 | 源码位置 | prefix | 主要字段 | 使用场景 |
| :--- | :--- | :--- | :--- | :--- |
| `BffConfiguration` | `opentcs-bff/src/main/java/org/opentcs/bff/BffConfiguration.java` | `bff` | `bindAddress`、`bindPort` | Javalin HTTP 服务监听地址和端口 |
| `BffKernelConfiguration` | `opentcs-bff/src/main/java/org/opentcs/bff/kernel/BffKernelConfiguration.java` | `bff.kernel` | `host`、`port`、`userName`、`password` | BFF 通过 RMI 登录 Kernel |
| `BffSecurityConfiguration` | `opentcs-bff/src/main/java/org/opentcs/bff/security/BffSecurityConfiguration.java` | `bff.security` | `accessKey` | `/api/*` 静态访问密钥鉴权 |
| `BffWorkspaceConfiguration` | `opentcs-bff/src/main/java/org/opentcs/bff/project/BffWorkspaceConfiguration.java` | `bff.workspace` | `dir`、`assetMaxBytes` | SPA 工程草稿和资产文件存储 |

#### 4.9.2 配置文件内容规范、默认位置与自定义路径规则

BFF 使用 Java `.properties` 格式，规则接近 C++ 项目常见的 `key=value` 配置文件：

```properties
bff.bindAddress = 0.0.0.0
bff.bindPort = 8090
bff.security.accessKey =
bff.kernel.host = localhost
bff.kernel.port = 1099
bff.kernel.userName = Alice
bff.kernel.password = xyz
bff.workspace.dir = ./data/bff-workspace
bff.workspace.assetMaxBytes = 52428800
```

默认配置模板在源码中：

```text
opentcs-bff/src/main/resources/org/opentcs/bff/distribution/config/opentcs-bff-defaults-baseline.properties
```

`opentcs-bff/build.gradle` 的 `distributions.main.contents` 会把 `src/main/resources/org/opentcs/bff/distribution` 复制进安装包。所以执行 `:opentcs-bff:installDist` 后，运行目录中会出现：

```text
opentcs-bff/build/install/opentcs-bff/config/opentcs-bff-defaults-baseline.properties
```

BFF 启动入口 `RunBff#gestaltConfigurationBindingProvider()` 固定组织三份文件：

```java
new GestaltConfigurationBindingProvider(
    Paths.get(System.getProperty("opentcs.base", "."), "config", "opentcs-bff-defaults-baseline.properties"),
    Paths.get(System.getProperty("opentcs.base", "."), "config", "opentcs-bff-defaults-custom.properties"),
    Paths.get(System.getProperty("opentcs.home", "."), "config", "opentcs-bff.properties")
);
```

对应实际规则如下：

| 文件 | 是否必须存在 | 默认路径表达式 | 作用 |
| :--- | :--- | :--- | :--- |
| `opentcs-bff-defaults-baseline.properties` | 必须 | `${opentcs.base}/config/opentcs-bff-defaults-baseline.properties` | BFF 发布包自带默认值，不建议现场修改 |
| `opentcs-bff-defaults-custom.properties` | 可选 | `${opentcs.base}/config/opentcs-bff-defaults-custom.properties` | 默认值层面的定制覆盖，可用于厂商或项目级打包定制 |
| `opentcs-bff.properties` | 可选 | `${opentcs.home}/config/opentcs-bff.properties` | 现场运行配置覆盖，最适合部署环境修改 |

`opentcs.base` 和 `opentcs.home` 是 JVM system property，不是 properties 文件里的普通 key。Gradle `run` 任务在 `opentcs-bff/build.gradle` 中设置了：

```groovy
run {
  systemProperties([
    'opentcs.base': '.',
    'opentcs.home': '.',
    'opentcs.configuration.reload.interval': '10000',
    'opentcs.configuration.provider': 'gestalt'
  ])
}
```

同时 `gradle/guice-application.gradle` 会让 `run` 的工作目录变成：

```text
opentcs-bff/build/install/opentcs-bff
```

所以开发态执行 `.\gradlew.bat :opentcs-bff:run` 时，`.` 实际指向 BFF 安装目录，配置文件默认从该目录的 `config/` 下读。

自定义路径有两种常用方式：

1. 保持启动参数不变，直接在安装目录下创建或修改：

```text
build/install/opentcs-bff/config/opentcs-bff.properties
```

2. 启动 Java 进程时改 JVM 参数：

```powershell
-Dopentcs.base=D:\byd_agv_njc\opentcs\opentcs-bff\build\install\opentcs-bff
-Dopentcs.home=D:\deploy\opentcs-bff-site-a
```

这样 baseline 仍可来自程序安装目录，而现场覆盖文件可来自独立的 home 目录：

```text
D:\deploy\opentcs-bff-site-a\config\opentcs-bff.properties
```

配置 key 的命名规则来自接口 prefix 加方法名：

```text
BffKernelConfiguration.PREFIX = "bff.kernel"
方法 host()      -> bff.kernel.host
方法 port()      -> bff.kernel.port
方法 userName()  -> bff.kernel.userName
方法 password()  -> bff.kernel.password
```

注意这里使用 camelCase，所以用户名 key 是 `bff.kernel.userName`，不是 `bff.kernel.username`，也不是 `bff.kernel.user`。

#### 4.9.3 加载时机、底层加载流程、解析方式与核心工具

配置加载发生在 BFF 进程启动早期，入口是：

```text
org.opentcs.bff.RunBff#main
```

源码流程如下：

```text
RunBff#main
  -> configurationBindingProvider()
  -> gestaltConfigurationBindingProvider()
  -> new GestaltConfigurationBindingProvider(三份配置文件路径)
  -> GestaltConfigurationBindingProvider 构造函数 buildGestalt()
  -> buildSources() 组装配置源
  -> GestaltBuilder.addSources(...).build()
  -> provider.loadConfigs()
  -> bindingProvider.get(prefix, Interface.class)
  -> Guice.createInjector(new BffModule(...))
  -> BffApplication#start()
```

核心工具链如下：

| 工具 / 类 | 所属模块 | 作用 |
| :--- | :--- | :--- |
| `RunBff` | `opentcs-bff` | BFF 进程入口，决定配置 provider，读取四组配置接口 |
| `ConfigurationBindingProvider` | `opentcs-api-base` | openTCS 自定义的配置读取抽象，只有一个 `get(prefix, type)` 方法 |
| `GestaltConfigurationBindingProvider` | `opentcs-impl-configuration-gestalt` | 对 Gestalt 的项目级封装，负责加载文件、系统属性和插件配置源 |
| `Gestalt` / `GestaltBuilder` | 第三方库 | 真正执行配置源合并、类型转换、接口代理绑定 |
| `FileConfigSourceBuilder` | Gestalt | 从 `.properties` 文件读取配置 |
| `SystemPropertiesConfigSourceBuilder` | Gestalt | 从 JVM `-Dkey=value` 读取覆盖值 |
| `TimedConfigReloadStrategy` | Gestalt | 定时重新加载配置源，BFF 当前业务对象不依赖它实现热更新 |
| Guice | `com.google.inject` | 把配置对象绑定到依赖注入容器，供业务类构造函数注入 |

`GestaltConfigurationBindingProvider#buildGestalt()` 里有两个关键配置：

```java
gestaltConfig.setTreatMissingValuesAsErrors(true);
gestaltConfig.setProxyDecoderMode(ProxyDecoderMode.PASSTHROUGH);
```

含义可以这样理解：

1. `setTreatMissingValuesAsErrors(true)`：配置接口声明了字段，但最终合并结果里没有对应 key，启动读取时会报错。这类似 C++ 程序启动校验必填配置，避免服务跑起来后才发现端口、密码、目录不存在。
2. `ProxyDecoderMode.PASSTHROUGH`：Gestalt 给接口生成代理对象。业务代码调用 `configuration.bindPort()` 时，看起来像普通 Java 方法，底层由 Gestalt 代理返回配置值。

`buildSources()` 会先检查 baseline 文件：

```java
checkState(defaultsPath.toFile().isFile(), "Required default configuration file {} does not exist.", ...);
```

所以 `opentcs-bff-defaults-baseline.properties` 缺失会导致 BFF 启动失败。两个 supplementary 文件不存在只会打印 warning 并跳过。

解析方式是 properties 文件的扁平 key。Gestalt 按 prefix 截取子树，再按接口方法名取值并转换类型：

```text
bff.bindPort = 8090
get("bff", BffConfiguration.class)
BffConfiguration#bindPort() -> int 8090
```

当前 BFF 字段类型只用到了 `String`、`int`、`long`。Gestalt 封装模块的测试 `SampleConfigurationTest` 还验证了 boolean、integer、enum、list、map、对象列表、classpath 等类型，但 BFF 当前没有用这些复杂类型。

#### 4.9.4 业务代码读取、绑定、使用配置字段的完整实现方式

BFF 不是在业务类里直接读取文件，而是分三步：定义接口、启动读取、Guice 注入。

第一步，定义配置接口。例如 `BffConfiguration`：

```java
@ConfigurationPrefix(BffConfiguration.PREFIX)
public interface BffConfiguration {
  String PREFIX = "bff";

  @ConfigurationEntry(... changesApplied = ON_APPLICATION_START ...)
  String bindAddress();

  @ConfigurationEntry(... changesApplied = ON_APPLICATION_START ...)
  int bindPort();
}
```

这里的 `@ConfigurationPrefix` 和 `@ConfigurationEntry` 在运行绑定中不是最核心的读取逻辑，真正读取靠 `bindingProvider.get(prefix, type)`。这些注解更多用于 openTCS 配置文档生成、元数据描述和说明“修改何时生效”。但它们仍然是项目约定：新增配置接口或字段时应保持这种写法。

第二步，`RunBff#main` 启动时读取：

```java
BffConfiguration bffConfig
    = bindingProvider.get(BffConfiguration.PREFIX, BffConfiguration.class);
BffKernelConfiguration kernelConfig
    = bindingProvider.get(BffKernelConfiguration.PREFIX, BffKernelConfiguration.class);
BffSecurityConfiguration securityConfig
    = bindingProvider.get(BffSecurityConfiguration.PREFIX, BffSecurityConfiguration.class);
BffWorkspaceConfiguration workspaceConfig
    = bindingProvider.get(BffWorkspaceConfiguration.PREFIX, BffWorkspaceConfiguration.class);
```

第三步，`BffModule` 把这些配置对象绑定为 Guice 单例实例：

```java
bind(BffConfiguration.class).toInstance(configuration);
bind(BffKernelConfiguration.class).toInstance(kernelConfiguration);
bind(BffSecurityConfiguration.class).toInstance(securityConfiguration);
bind(BffWorkspaceConfiguration.class).toInstance(workspaceConfiguration);
```

之后业务类通过构造函数拿配置。

`BffApplication` 使用 `BffConfiguration` 设置 HTTP 监听地址和端口：

```java
cfg.jetty.host = configuration.bindAddress();
cfg.jetty.port = configuration.bindPort();
```

这一步发生在 `BffApplication` 构造函数中，也就是 Javalin 对象创建时。服务启动后再改 `bff.bindPort`，已经创建好的 Jetty/Javalin 不会自动换端口。

`KernelClient` 使用 `BffKernelConfiguration` 连接 Kernel：

```java
KernelServicePortal newPortal
    = portalFactory.create(configuration.userName(), configuration.password());
newPortal.login(configuration.host(), configuration.port());
```

这里还有一个重要细节：`KernelClient` 是 `@Singleton`，并且 portal 是懒连接。BFF 启动时会读取 kernel 配置对象，但不一定立刻连接 Kernel；第一次调用车辆、模型、订单、SSE 轮询等接口时，`ensureConnected()` 才会使用 `host/port/userName/password` 登录。

`AccessKeyAuthenticator` 使用 `BffSecurityConfiguration` 做鉴权：

```java
public boolean isEnabled() {
  String configured = configuration.accessKey();
  return configured != null && !configured.isEmpty();
}

public boolean isAuthenticated(Context ctx) {
  if (!isEnabled()) {
    return true;
  }
  return configuration.accessKey().equals(ctx.header("X-Api-Access-Key"));
}
```

`BffApplication` 的 `beforeMatched` 过滤器只保护 `/api/` 开头路径：

```text
/health、/openapi/bff.yaml、/swagger-ui/* 不受 accessKey 保护
/api/* 受 accessKey 保护
```

`ProjectStore` 使用 `BffWorkspaceConfiguration` 初始化磁盘工作区：

```java
public ProjectStore(BffWorkspaceConfiguration configuration) {
  this(Paths.get(configuration.dir()), configuration.assetMaxBytes());
}
```

随后构造函数会：

```text
workspaceRoot = Paths.get(dir).toAbsolutePath().normalize()
projectsRoot = workspaceRoot.resolve("projects")
Files.createDirectories(projectsRoot)
```

也就是说 `bff.workspace.dir = ./data/bff-workspace` 是相对进程工作目录解析的。开发态 `run` 的工作目录是 `build/install/opentcs-bff`，所以默认工作区通常落在：

```text
opentcs-bff/build/install/opentcs-bff/data/bff-workspace/projects
```

#### 4.9.5 多份配置文件优先级、覆盖机制与底层实现原理

当前 BFF 配置源添加顺序来自 `GestaltConfigurationBindingProvider#buildSources()`：

```text
1. baseline defaults 文件
2. supplementary files，按 RunBff 传入顺序逐个追加
3. ServiceLoader 发现的 SupplementaryConfigSource
4. JVM system properties
```

对 BFF 来说，文件层面的顺序就是：

```text
低优先级
  ${opentcs.base}/config/opentcs-bff-defaults-baseline.properties
  ${opentcs.base}/config/opentcs-bff-defaults-custom.properties
  ${opentcs.home}/config/opentcs-bff.properties
  ServiceLoader 额外配置源
  JVM -Dkey=value
高优先级
```

举例：

```properties
# opentcs-bff-defaults-baseline.properties
bff.bindPort = 8090
bff.kernel.host = localhost
```

```properties
# opentcs-bff.properties
bff.bindPort = 18090
```

启动时最终结果是：

```text
bff.bindPort -> 18090
bff.kernel.host -> localhost
```

也就是“后面的配置源覆盖前面的同名 key；没有覆盖的 key 沿用低优先级默认值”。这和 C++ 中多层 ini 合并很像：先加载 default，再加载 site override，再加载命令行 `--key=value`。

最高优先级的 JVM system property 可以直接覆盖单个业务配置，例如：

```powershell
-Dbff.bindPort=18090
-Dbff.kernel.host=192.168.10.20
-Dbff.security.accessKey=dev-key
```

这里要区分两类 JVM system property：

| 类型 | 示例 | 作用 |
| :--- | :--- | :--- |
| 配置框架控制参数 | `-Dopentcs.base=...`、`-Dopentcs.home=...`、`-Dopentcs.configuration.reload.interval=10000` | 决定去哪读配置、多久检查配置源 |
| 业务配置覆盖参数 | `-Dbff.bindPort=18090`、`-Dbff.kernel.host=192.168.10.20` | 直接覆盖 BFF 业务配置 key |

`opentcs.configuration.provider` 当前也在 `RunBff#configurationBindingProvider()` 中读取：

```java
String chosenProvider = System.getProperty("opentcs.configuration.provider", "gestalt");
switch (chosenProvider) {
  case "gestalt":
  default:
    return gestaltConfigurationBindingProvider();
}
```

当前代码只有 Gestalt 一个实际 provider。即使传入其他值，也会走 default 分支继续使用 Gestalt。

#### 4.9.6 配置修改后是否需要重启，是否支持热更新

结论：对当前 BFF 业务来说，修改配置后应重启 BFF 进程。不要依赖热更新。

原因要分两层看。

第一层，Gestalt provider 本身确实配置了 reload strategy：

```java
.addConfigReloadStrategy(new TimedConfigReloadStrategy(reloadInterval))
```

`reloadInterval` 来自：

```text
-Dopentcs.configuration.reload.interval
```

Gradle `run` 默认设置为 `10000` 毫秒。没有设置时，`GestaltConfigurationBindingProvider` 默认也是 `10000` 毫秒。

第二层，BFF 的业务对象不是“每次请求都重新从配置中心拿新对象”。当前 `RunBff#main` 只在启动时执行一次：

```text
bindingProvider.get(...)
new BffModule(配置对象...)
Guice.createInjector(...)
```

随后这些配置对象被 `BffModule#toInstance()` 固定绑定到 Guice。业务类已经基于这些对象完成初始化：

| 配置项 | 使用位置 | 为什么需要重启 |
| :--- | :--- | :--- |
| `bff.bindAddress`、`bff.bindPort` | `BffApplication` 构造 Javalin/Jetty 时设置 | HTTP server 已经绑定 socket，改文件不会自动 stop/start server |
| `bff.workspace.dir` | `ProjectStore` 构造时解析成 `Path` 并创建目录 | `workspaceRoot/projectsRoot` 已存为字段，后续不会自动换目录 |
| `bff.workspace.assetMaxBytes` | `ProjectStore` 构造时存成 `assetMaxBytes` 字段 | 上传限制已保存在对象字段中 |
| `bff.kernel.host/port/userName/password` | `KernelClient#ensureConnected()` 登录时使用 | 如果 portal 已连接，会继续复用旧 portal；改文件不会自动 logout/reconnect |
| `bff.security.accessKey` | `AccessKeyAuthenticator` 请求时读取配置对象 | 这项理论上最接近可动态读取，但当前项目没有围绕它设计、测试或声明热更新行为 |

更关键的是，四个配置接口的 `@ConfigurationEntry` 都声明了：

```java
changesApplied = ConfigurationEntry.ChangesApplied.ON_APPLICATION_START
```

这就是源码层面对使用者的明确提示：这些配置变更在应用启动时生效。换句话说，Gestalt 的底层 reload 能力存在，但当前 BFF 配置字段按项目约定都属于“重启生效”。

现场运维建议：

1. 修改 `config/opentcs-bff.properties` 后重启 BFF。
2. 修改端口、工作区、Kernel 地址、access key 后都按重启处理。
3. 如果怀疑配置没生效，优先看 BFF 启动日志中 `Using default configuration file ...`、`Using overrides from supplementary configuration file ...`、`Supplementary configuration file ... not found, skipped.` 这些日志，确认实际读取的是哪几个文件。

#### 4.9.7 Gestalt 在本项目中的标准使用流程

在 dd-opentcs/openTCS 这套代码里，Gestalt 的标准使用范式可以总结为六步。

第一步，写默认配置文件：

```properties
bff.kernel.host = localhost
bff.kernel.port = 1099
```

第二步，写配置接口，prefix 对应 key 前缀，方法名对应 key 后半段：

```java
@ConfigurationPrefix(BffKernelConfiguration.PREFIX)
public interface BffKernelConfiguration {
  String PREFIX = "bff.kernel";
  String host();
  int port();
}
```

第三步，启动入口创建 provider，并传入默认文件和覆盖文件路径：

```java
ConfigurationBindingProvider provider = new GestaltConfigurationBindingProvider(
    baselinePath,
    defaultsCustomPath,
    runtimeOverridePath
);
```

第四步，用 prefix + interface class 获取强类型配置对象：

```java
BffKernelConfiguration kernelConfig
    = provider.get(BffKernelConfiguration.PREFIX, BffKernelConfiguration.class);
```

第五步，把配置对象交给 Guice：

```java
bind(BffKernelConfiguration.class).toInstance(kernelConfig);
```

第六步，业务类通过构造函数注入并使用：

```java
@Inject
public KernelClient(BffKernelConfiguration configuration, KernelServicePortalFactory portalFactory) {
  this.configuration = configuration;
}
```

这个模式的好处是：

1. 业务代码拿到的是强类型接口，不需要到处写字符串 key。
2. 配置缺失能在启动读取阶段暴露，不容易拖到运行时请求失败。
3. 文件、JVM `-D`、额外配置源可以统一合并，覆盖规则集中在 provider 中。
4. openTCS 各模块风格一致，BFF 没有引入 Spring Boot 配置体系，避免和现有 Guice/Gestalt 架构混用。

它背后的设计模式可以按 C++ 经验这样类比：

| Java/Gestalt 机制 | C++ 类比 | 说明 |
| :--- | :--- | :--- |
| `BffKernelConfiguration` 接口 | 纯虚接口 / 强类型配置视图 | 只声明“需要哪些配置字段” |
| Gestalt 代理对象 | 动态生成的接口实现类 | 调用 `host()` 时从配置树取值并转换类型 |
| `ConfigurationBindingProvider` | 配置工厂 / provider 抽象 | 屏蔽底层到底从文件、系统属性还是别的源读取 |
| Guice `bind(...).toInstance(...)` | 把单例对象注册进对象容器 | 业务类构造时自动拿到同一份配置对象 |
| 多配置源覆盖 | default.ini + local.ini + 命令行参数 | 越靠后的来源优先级越高 |

#### 4.9.8 新增或修改 BFF 配置项的实战步骤

如果后续要给 BFF 增加一个配置项，例如 SSE 心跳间隔，可以按当前源码风格做：

1. 在合适的配置接口中新增方法，或者新建一个带 `@ConfigurationPrefix` 的配置接口。
2. 给方法补 `@ConfigurationEntry`，明确 `type`、`description`、`changesApplied` 和 `orderKey`。
3. 在 `opentcs-bff-defaults-baseline.properties` 中增加默认值，保证 baseline 完整。
4. 如果是新配置接口，在 `RunBff#main` 中调用 `bindingProvider.get(...)` 读取。
5. 在 `BffModule` 中 `bind(...).toInstance(...)`。
6. 在业务类构造函数中注入配置接口并使用。
7. 增加类似 `BffKernelConfigurationTest` 的测试，验证 properties 能绑定到接口字段。
8. 修改后用 `:opentcs-bff:test` 或至少相关测试确认绑定没有破坏。

最容易踩的坑：

| 问题 | 典型表现 | 排查点 |
| :--- | :--- | :--- |
| baseline 缺少 key | BFF 启动时配置读取失败 | 检查默认 properties 是否包含接口所有方法对应 key |
| key 拼错大小写 | 启动失败或值未覆盖 | 方法 `userName()` 对应 `userName`，不是 `username` |
| 改了源码 resources，但运行目录旧文件没更新 | 修改看似不生效 | 重新执行 `:opentcs-bff:installDist` 或 `:opentcs-bff:run` |
| 改了 `opentcs-bff-defaults-baseline.properties` 做现场配置 | 下次构建/升级容易被覆盖 | 现场值应放 `opentcs-bff.properties` |
| 期望热更新端口或 workspace | 文件改了但服务行为不变 | 当前配置声明和对象生命周期都是重启生效 |

#### 4.9.9 用一条完整链路串起来

以 `bff.bindPort` 为例，完整链路是：

```text
opentcs-bff-defaults-baseline.properties
  bff.bindPort = 8090

RunBff#gestaltConfigurationBindingProvider
  组织 baseline/custom/runtime 三份路径

GestaltConfigurationBindingProvider#buildSources
  添加 FileConfigSource + SystemPropertiesConfigSource

GestaltConfigurationBindingProvider#get("bff", BffConfiguration.class)
  生成/返回 BffConfiguration 代理对象

BffModule#configure
  bind(BffConfiguration.class).toInstance(configuration)

BffApplication 构造函数
  cfg.jetty.port = configuration.bindPort()

BffApplication#start
  javalin.start()
  实际监听 8090
```

以 `bff.kernel.host` 为例，完整链路是：

```text
properties: bff.kernel.host = localhost
  -> provider.get("bff.kernel", BffKernelConfiguration.class)
  -> BffModule 绑定 BffKernelConfiguration
  -> KernelClient 构造函数注入该配置
  -> 第一次调用 KernelClient#ensureConnected()
  -> newPortal.login(configuration.host(), configuration.port())
```

以 `bff.workspace.dir` 为例，完整链路是：

```text
properties: bff.workspace.dir = ./data/bff-workspace
  -> provider.get("bff.workspace", BffWorkspaceConfiguration.class)
  -> BffModule 绑定 BffWorkspaceConfiguration
  -> ProjectStore(BffWorkspaceConfiguration)
  -> Paths.get(configuration.dir()).toAbsolutePath().normalize()
  -> 创建 ${workspaceRoot}/projects
  -> 工程草稿、meta.json、assets 都落到该目录树下
```

最终可以把 BFF 配置机制记成一句话：

```text
文件只是输入，Gestalt 负责合并和类型绑定，RunBff 负责启动期取出配置对象，Guice 负责把配置对象送到业务类，业务类按启动期配置运行；当前 BFF 配置修改统一按重启生效处理。
```

## 章节5：opentcs-spa 前端专项深度解析

### 5.1 模块定位

`opentcs-spa` 是操作员使用的浏览器单页应用。它通过 BFF 暴露的 HTTP REST 与 SSE 接口完成工程管理、地图导入、画布编辑、模型发布、运输订单创建、车辆实时状态渲染和订单生命周期展示。

SPA 不直接访问 Kernel RMI、VDA5050 适配器或 MQTT Broker。所有后端交互均通过 `src/api/*` 封装后访问 `opentcs-bff`。

### 5.2 编译、启动命令与依赖条件

依赖条件：

| 依赖 | 要求 |
| :--- | :--- |
| Node.js | `>=20.10.0` |
| pnpm | `9.12.3`，`package.json` 中声明 `packageManager=pnpm@9.12.3` |
| BFF | 联调时默认运行在 `http://localhost:8090` |
| 浏览器 | 支持 Vue 3、ES2022、Canvas、`fetch`、`EventSource`、`localStorage` |

安装依赖：

```powershell
cd D:\byd_agv_njc\opentcs\opentcs-spa
pnpm install
```

启动开发服务器：

```powershell
pnpm dev
```

默认访问地址：

```text
http://localhost:5173
```

类型检查：

```powershell
pnpm typecheck
```

生产构建：

```powershell
pnpm build
```

本地预览生产构建：

```powershell
pnpm preview
```

代码检查与格式化：

```powershell
pnpm lint
pnpm format:check
```

开发代理规则定义在 `vite.config.ts`：

| SPA 请求路径 | 代理目标 | 用途 |
| :--- | :--- | :--- |
| `/api/*` | `http://localhost:8090` | BFF REST 与 SSE API |
| `/health` | `http://localhost:8090` | BFF 健康检查 |
| `/openapi/*` | `http://localhost:8090` | BFF OpenAPI 资源 |

运行时环境变量：

| 变量 | 说明 |
| :--- | :--- |
| `VITE_BFF_BASE_URL` | BFF 基础 URL。开发环境通常留空，走 Vite proxy；生产同源反代时也可留空。 |
| `VITE_BFF_ACCESS_KEY` | BFF `X-Api-Access-Key`。为空时不发送该 header。 |

`src/config/runtime.ts` 统一读取环境变量，`src/api/client.ts` 统一构造 BFF URL、注入 access-key header、解析错误响应和 `X-Trace-Id`。

### 5.3 顶层路由与页面职责

路由定义在 `src/router/index.ts`：

| 路径 | 页面组件 | 职责 |
| :--- | :--- | :--- |
| `/` | redirect | 重定向到 `/projects`。 |
| `/projects` | `ProjectsView.vue` | 工程列表、新建、打开、重命名、另存为、删除、进入发布、进入订单页面。 |
| `/import` | `ImportView.vue` | 导入 `.png/.pgm/.yaml` 三件套，解析 ROS map yaml，建立像素与世界坐标仿射关系。 |
| `/editor/:projectId?` | `EditorView.vue` | 画布编辑器，编辑 Point、Path、LocationType、Location、Block、Vehicle，并自动同步草稿到 BFF。 |
| `/debug` | `DebugView.vue` | BFF 调试入口，用于联通性和 SSE 调试。 |
| `/projects/:projectId/publish` | `PublishView.vue` | 读取项目草稿，dry-run 校验或发布模型到 Kernel。 |
| `/projects/:projectId/orders` | `OrdersView.vue` | 基于工程草稿选择目标点位/库位，创建运输订单。 |

根组件 `App.vue` 挂载全局导航、`RouterView`、Toast 容器，并在应用生命周期内启动唯一的实时状态 store：

```text
App.vue onMounted
  -> useLiveStatusStore().start()
  -> REST 预加载车辆列表
  -> 建立 SSE 连接

App.vue onBeforeUnmount
  -> useLiveStatusStore().stop()
```

### 5.4 前端 API 分层

| 文件 | 职责 |
| :--- | :--- |
| `src/config/runtime.ts` | 读取 `VITE_BFF_BASE_URL`、`VITE_BFF_ACCESS_KEY`，生成 BFF URL。 |
| `src/api/client.ts` | 统一封装 `fetch`，处理 JSON body、header、HTTP 错误、网络错误、traceId 和全局 toast。 |
| `src/api/sse.ts` | 封装浏览器 `EventSource`，处理事件分发、连接状态、指数退避重连。 |
| `src/api/types/bff.ts` | 手写 BFF OpenAPI DTO 的 TypeScript 镜像类型。 |
| `src/api/endpoints/projects.ts` | 工程 CRUD、草稿读写、资产上传/下载 URL 封装。 |
| `src/api/endpoints/publish.ts` | `POST /api/v1/plant-models/publish` 发布接口封装。 |
| `src/api/endpoints/transportOrders.ts` | `POST /api/v1/transport-orders` 订单创建接口封装。 |
| `src/api/endpoints/vehicles.ts` | 车辆列表、单车查询、integration level 更新、重路由接口封装。 |
| `src/api/endpoints/sseEvents.ts` | 创建实时状态 SSE client。 |

### 5.5 前端状态管理

| Store / Composable | 文件 | 职责 |
| :--- | :--- | :--- |
| `useProjectStore` | `src/stores/project.ts` | 当前编辑器草稿。保存背景图、Point、Path、LocationType、Location、Block、Vehicle、选择状态、撤销重做栈。 |
| `useProjectsStore` | `src/stores/projects.ts` | BFF 工程目录、当前工程元数据、工程 CRUD、草稿读写。 |
| `useLiveStatusStore` | `src/stores/liveStatus.ts` | 全局唯一 SSE 实时状态 store。保存车辆 map、订单 map、订单时间线、SSE 状态。 |
| `useEditorSettingsStore` | `src/stores/editorSettings.ts` | 编辑器 UI 设置，包括工具栏宽度、右侧面板高度、网格吸附、缩略图、容差圆等。 |
| `useCloudDraftSync` | `src/composables/useCloudDraftSync.ts` | 在编辑器中监听草稿变化，500 ms 防抖后调用 BFF 保存草稿。 |
| `useBackgroundMap` | `src/composables/useBackgroundMap.ts` | 背景地图共享状态兼容层，实际读写 `useProjectStore().background`。 |
| `useLiveVehicleOverlay` | `src/composables/useLiveVehicleOverlay.ts` | 将草稿中的 `DraftVehicle` 与 Kernel 实时 `Vehicle` DTO 合成为画布渲染用车辆叠加数据。 |

### 5.6 工厂地图三件套上传流程、后端处理逻辑、文件存储位置

当前代码中的三件套导入页面是 `src/views/ImportView.vue`。页面接受：

| 文件 | 前端处理 |
| :--- | :--- |
| `.png` | 浏览器解码为 `HTMLImageElement`，获取自然宽高，绘制到 `<canvas>` 预览，并生成 `data:image/png;base64,...` 用于刷新后本地恢复背景图。 |
| `.pgm` | 仅记录文件名和大小，不在浏览器中渲染。代码注释说明 PGM 用于归档和后续 BFF 存储。 |
| `.yaml` / `.yml` | 使用 `src/domain/yaml/parseRosMapYaml.ts` 解析 ROS map yaml，读取 `image`、`resolution`、`origin`、`negate`、`occupied_thresh`、`free_thresh`。 |

导入流程：

```text
用户打开 /import
  -> 选择 PNG
  -> ImportView#onPngChange
  -> 校验 .png 后缀
  -> URL.createObjectURL(file)
  -> FileReader.readAsDataURL(file)
  -> new Image() 解码
  -> 获取 naturalWidth / naturalHeight
  -> paintImage 绘制只读预览 canvas

用户选择 PGM
  -> ImportView#onPgmChange
  -> 校验 .pgm 后缀
  -> 记录文件名和大小

用户选择 YAML
  -> ImportView#onYamlChange
  -> File.text()
  -> parseRosMapYaml(text)
  -> buildAffine(resolution, origin, imageWidth, imageHeight)
  -> recomputeFileNameWarnings
  -> publishBackgroundIfReady
  -> useBackgroundMap().setBackgroundMap(...)
  -> useProjectStore().setBackground(...)
```

坐标转换规则在 `src/domain/geometry/affine.ts`：

```text
world_x = origin.x + pixel_x * resolution
world_y = origin.y + (imageHeight - pixel_y) * resolution
```

当前代码状态：

1. `ImportView.vue` 当前没有调用 BFF 的 `uploadAssets`，三件套不会在导入页面直接上传到后端。
2. PNG 背景会通过 `useProjectStore#setBackground` 保存到前端内存，并尝试写入 `localStorage['opentcs-spa.bgV1']`。
3. 编辑器草稿中的 Point、Path、Location、Block、Vehicle 会通过 `useCloudDraftSync` 保存到 BFF 的 `draft.json`，但背景图二进制本身不在草稿 payload 中。
4. `src/api/endpoints/projects.ts` 已提供 `uploadAssets(id, files)`、`listAssets(id)`、`deleteAsset(id, name)`、`assetUrl(id, name)` 封装，对应 BFF 的 `/api/v1/projects/{id}/assets` 接口；当前 `ImportView.vue` 未接入这些函数。

如果后续接入资产上传，后端存储位置按 BFF 约定为：

```text
${bff.workspace.dir}/projects/{projectId}/assets/
```

默认配置下等价于：

```text
opentcs-bff/build/install/opentcs-bff/data/bff-workspace/projects/{projectId}/assets/
```

允许的资产扩展名由 BFF 约束为：

```text
png / pgm / yaml / yml
```

### 5.7 画布编辑器模型编辑流程、工厂模型文件格式、存储路径

画布编辑入口是 `src/views/EditorView.vue`。核心组件：

| 组件 | 职责 |
| :--- | :--- |
| `MapStage.vue` | Konva Stage 根组件，负责缩放、平移、鼠标坐标、空白画布点击和工具事件。 |
| `BackgroundLayer.vue` | 绘制底图 PNG。 |
| `GridLayer.vue` | 绘制网格吸附辅助层。 |
| `AnnotationLayer.vue` | 绘制和交互 Point、Path、Location、Block、Vehicle、AGV 实测点。 |
| `HoverLayer.vue` | 绘制工具悬停反馈。 |
| `MiniMap.vue` | 缩略图和视口定位。 |
| `EditorToolbar.vue` | 工具切换、撤销重做、网格吸附、容差圆、对齐/分布。 |
| `ResourceTree.vue` | 左侧资源树，展示草稿对象并支持选择。 |
| `PropertyPanel.vue` | 右侧属性面板，编辑当前选中对象。 |
| `VehicleStatusPanel.vue` | 车辆实时状态表。 |
| `OrderStatusSidebar.vue` | 订单生命周期时间线。 |

编辑流程：

```text
用户打开 /editor/{projectId}
  -> EditorView#activateProjectFromRoute
  -> useProjectsStore#setCurrent(projectId)
  -> GET /api/v1/projects/{id}
  -> useProjectsStore#loadCurrentDraft
  -> GET /api/v1/projects/{id}/draft
  -> useProjectStore#hydrateDraftPayload(payload)
  -> MapStage 渲染背景与 AnnotationLayer

用户选择工具并在画布操作
  -> MapStage 计算 pixel/world 坐标
  -> EditorView#onToolFire
  -> useProjectStore addPoint / addLocation / addBlock / addVehicle
  -> 或 AnnotationLayer 点击 Point 后 completePath
  -> Pinia 状态更新
  -> 200 ms 防抖写 localStorage
  -> 500 ms 防抖 PUT /api/v1/projects/{id}/draft
```

前端草稿格式由 `src/domain/model/types.ts` 定义，是 openTCS `*CreationTO` 的 TypeScript 镜像。主结构由 `useProjectStore#serializeDraftPayload` 生成：

```json
{
  "v": 2,
  "points": [],
  "paths": [],
  "locationTypes": [],
  "locations": [],
  "blocks": [],
  "vehicles": [],
  "selection": null
}
```

BFF 保存时外层再包一层 `DraftEnvelope`：

```json
{
  "version": 1,
  "savedAt": "2026-06-16T00:00:00.000Z",
  "payload": {
    "v": 2,
    "points": [],
    "paths": [],
    "locationTypes": [],
    "locations": [],
    "blocks": [],
    "vehicles": [],
    "selection": null
  }
}
```

主要实体格式：

| 实体 | 前端类型 | 对齐的 Kernel TO | 单位与说明 |
| :--- | :--- | :--- | :--- |
| Point | `DraftPoint` | `PointCreationTO` | `pose.position` 为 mm；`layout.pixelX/Y` 是编辑器专用字段，发布时丢弃。 |
| Path | `DraftPath` | `PathCreationTO` | `srcPointName`、`destPointName` 引用 Point；`length` 为 mm；速度为 mm/s。 |
| LocationType | `DraftLocationType` | `LocationTypeCreationTO` | `allowedOperations` 用于订单目的地操作约束。 |
| Location | `DraftLocation` | `LocationCreationTO` | `position` 为 mm；`links` 连接 Point 与允许操作。 |
| Block | `DraftBlock` | `BlockCreationTO` | `memberNames` 引用 Point、Path、Location；`layout.colorRgb` 用于显示和发布 layout。 |
| Vehicle | `DraftVehicle` | `VehicleCreationTO` | bounding box 为 mm；速度为 mm/s；`layout.pixelX/Y/orientationDeg` 为编辑器专用。 |

本地缓存路径：

| 数据 | 存储位置 |
| :--- | :--- |
| 当前草稿快照 | `localStorage['opentcs-spa.draftV1']` |
| 背景图和 affine 信息 | `localStorage['opentcs-spa.bgV1']` |
| 当前工程 id | `localStorage['opentcs-spa.currentProjectId']` |
| 最近订单 | `localStorage['opentcs-spa:recent-orders:{projectId}:v1']` |

后端草稿存储路径：

```text
${bff.workspace.dir}/projects/{projectId}/draft.json
```

后端工程元数据路径：

```text
${bff.workspace.dir}/projects/{projectId}/meta.json
```

### 5.8 工厂模型新建、重命名、另存为、删除完整逻辑

入口页面：`src/views/ProjectsView.vue`。

工程列表加载：

```text
ProjectsView onMounted
  -> useProjectsStore#refresh
  -> listProjects()
  -> GET /api/v1/projects
  -> projects.list 更新
```

新建工程：

```text
用户输入工程名和可选 ID
  -> ProjectsView#create
  -> useProjectsStore#create(name, id)
  -> createProject(name, id)
  -> POST /api/v1/projects
  -> BFF 创建 projects/{id}/meta.json 和 assets/
  -> 前端追加到 projects.list
  -> open(meta.id)
  -> useProjectsStore#setCurrent(id)
  -> GET /api/v1/projects/{id}
  -> router.push('/editor/{id}')
```

打开工程：

```text
ProjectsView#open(id)
  -> useProjectsStore#setCurrent(id)
  -> GET /api/v1/projects/{id}
  -> 保存 currentId 到 localStorage
  -> router.push({ name: 'editor', params: { projectId: id } })
  -> EditorView 加载 draft
```

重命名工程：

```text
ProjectsView#startRename
  -> 弹出 dialog
  -> ProjectsView#confirmRename
  -> useProjectsStore#setCurrent(id)
  -> useProjectsStore#renameCurrent(name)
  -> renameProject(id, name)
  -> PATCH /api/v1/projects/{id}
  -> currentMeta 和 projects.list 同步更新
```

另存为：

```text
ProjectsView#startCopy
  -> 默认名称 "{原名称} 副本"
  -> ProjectsView#confirmCopy
  -> useProjectsStore#setCurrent(id)
  -> useProjectsStore#copyCurrent(newName)
  -> copyProject(id, newName)
  -> POST /api/v1/projects/{id}/copy
  -> BFF 复制 meta、draft、assets
  -> 前端追加新工程到 projects.list
```

删除工程：

```text
ProjectsView#remove(id, name)
  -> window.confirm
  -> useProjectsStore#deleteById(id)
  -> deleteProject(id)
  -> DELETE /api/v1/projects/{id}
  -> 前端从 projects.list 移除
  -> 若删除的是 currentId，则 clearCurrent
```

### 5.9 工厂模型发布流程与调用后端接口明细

入口页面：`src/views/PublishView.vue`，路由 `/projects/:projectId/publish`。

加载发布页面：

```text
PublishView onMounted
  -> getProject(projectId)
  -> GET /api/v1/projects/{id}
  -> 显示工程名
  -> getDraft(projectId)
  -> GET /api/v1/projects/{id}/draft
  -> 统计 payload 中 points / paths / locations / locationTypes / blocks / vehicles 数量
  -> collectLocalIssues 做本地轻量校验
```

本地轻量校验内容：

1. 检查 `points`、`paths`、`locations`、`blocks`、`vehicles` 中是否有未命名条目。
2. 检查跨实体名称是否重复。
3. 检查 Path 的 `srcPointName`、`destPointName` 是否引用已有 Point。

dry-run 试运行：

```text
用户点击 "先试运行（dryRun）"
  -> PublishView#tryDryRun
  -> publishPlantModel({ projectId, dryRun: true })
  -> POST /api/v1/plant-models/publish
  -> BFF 读取 draft.json
  -> BFF 将 payload 转换为 PlantModelCreationTO
  -> BFF 不连接 Kernel
  -> 返回 PublishResponse(diff)
  -> 前端展示本地数量与服务端 dryRun diff
```

确认发布：

```text
用户点击 "确认发布"
  -> PublishView#doPublish
  -> publishPlantModel({ projectId, dryRun: false })
  -> POST /api/v1/plant-models/publish
  -> BFF 读取 draft.json
  -> BFF 转换 PlantModelCreationTO
  -> BFF 通过 RMI 调 Kernel PlantModelService#createPlantModel
  -> BFF 写 meta.json#lastPublishedAt
  -> 返回 PublishResponse
  -> 前端 toast 提示发布成功
```

发布接口请求体：

```json
{
  "projectId": "ss27-demo",
  "modelName": "可选模型名",
  "dryRun": false
}
```

发布接口响应体关键字段：

| 字段 | 说明 |
| :--- | :--- |
| `ok` | 发布或 dry-run 是否成功。 |
| `modelName` | 发布到 Kernel 的模型名。 |
| `publishedAt` | 非 dry-run 成功时返回发布时间。 |
| `diff` | 服务端转换后统计数量。 |

发布失败时，`PublishView#handlePublishError` 会读取 BFF `ErrorResponse`，展示 `code`、`message` 和可选 `fieldPath`。当存在 `fieldPath` 时，页面提供跳转回编辑器的入口：

```text
router.push({
  name: 'editor',
  params: { projectId },
  query: { focus: fieldPath }
})
```

### 5.10 前端创建运输订单全链路

入口页面：`src/views/OrdersView.vue`，路由 `/projects/:projectId/orders`。

页面初始化：

```text
OrdersView onMounted
  -> getProject(projectId)
  -> GET /api/v1/projects/{id}
  -> 读取 projectName 和 lastPublishedAt
  -> loadDraftTargets
  -> getDraft(projectId)
  -> GET /api/v1/projects/{id}/draft
  -> resolveOrderTargetInfos
  -> 从草稿中提取 Point / Location 作为目的地下拉候选
  -> loadRecentOrders
  -> 从 localStorage 读取最近 5 条订单
```

目标与操作约束：

| 目标类型 | 操作来源 |
| :--- | :--- |
| Point | 固定允许 `MOVE`、`PARK`。 |
| Location | `LocationType.allowedOperations`，如 Location link 中配置了 allowedOperations，则取交集；额外允许 `NOP`。 |
| 未知目标 | 前端允许 `NOP`、`MOVE`、`PARK`，最终由 BFF/Kernel 校验。 |

车辆选择：

```text
useLiveStatusStore.start()
  -> listVehicles()
  -> GET /api/v1/vehicles
  -> vehicleOptions 下拉立即可用
  -> openLiveStatusStream()
  -> GET /api/v1/sse?vehicles=true&transportOrders=true
  -> 后续车辆变化由 SSE 更新
```

更新车辆集成等级：

```text
用户选择 intendedVehicle
  -> OrdersView 显示当前 integrationLevel
  -> 用户选择新等级并点击应用
  -> updateVehicleIntegrationLevel(name, next)
  -> PUT /api/v1/vehicles/{name}/integrationLevel
  -> BFF 转发到 Kernel VehicleService
  -> 返回更新后的 Vehicle
  -> 前端乐观更新 live.vehicles[name]
```

提交运输订单：

```text
用户配置目的地序列
  -> OrdersView#submit
  -> 构造 TransportOrderRequest
  -> createTransportOrder(request)
  -> POST /api/v1/transport-orders
  -> BFF 转换为 TransportOrderCreationTO
  -> Kernel TransportOrderService#createTransportOrder
  -> 返回 TransportOrder DTO
  -> live.recordCreatedOrder(order)
  -> rememberRecentOrder 写 localStorage
  -> router.push('/editor/{projectId}')
  -> 编辑器中订单状态侧栏继续由 SSE 更新
```

订单请求体示例：

```json
{
  "name": "spa-1780000000000",
  "incompleteName": true,
  "intendedVehicle": "Vehicle-01",
  "destinations": [
    { "locationName": "Point-1", "operation": "MOVE" },
    { "locationName": "Location-2", "operation": "pick" },
    { "locationName": "Point-3", "operation": "MOVE" },
    { "locationName": "Location-4", "operation": "drop" }
  ]
}
```

失败提示逻辑：

1. `OrdersView#submit` 捕获 `HttpError`。
2. 读取 `err.payload.code`、`message`、`fieldPath`。
3. 当 code 为 `NOT_FOUND` 时，`orderErrorHint` 会判断可能是工程未发布或草稿新增/重命名后未重新发布，并提示用户回到画布重新发布。

### 5.11 AGV 车辆实时状态渲染

数据获取通道：

| 阶段 | 通道 | 前端入口 |
| :--- | :--- | :--- |
| 初始车辆快照 | REST | `listVehicles()` -> `GET /api/v1/vehicles` |
| 后续车辆变化 | SSE | `openLiveStatusStream()` -> `GET /api/v1/sse?vehicles=true&transportOrders=true` |

启动流程：

```text
App.vue onMounted
  -> useLiveStatusStore#start
  -> listVehicles({ toastOnError: false })
  -> 填充 vehicles map
  -> openLiveStatusStream
  -> SseClient.connect
  -> EventSource('/api/v1/sse?vehicles=true&transportOrders=true')
```

BFF 返回的 Vehicle DTO 内容：

| 字段 | 说明 |
| :--- | :--- |
| `name` | 车辆名称。 |
| `state` | `UNKNOWN`、`UNAVAILABLE`、`ERROR`、`IDLE`、`EXECUTING`、`CHARGING`。 |
| `procState` | `IDLE`、`AWAITING_ORDER`、`PROCESSING_ORDER`。 |
| `integrationLevel` | `TO_BE_IGNORED`、`TO_BE_NOTICED`、`TO_BE_RESPECTED`、`TO_BE_UTILIZED`。 |
| `paused` | 是否暂停。 |
| `energyLevel` | 电量百分比。 |
| `currentPosition` | Kernel 解析出的当前 Point 名称，可能为 `null`。 |
| `precisePosition` | 通信适配器上报的实测坐标，单位 mm，可能为 `null`。 |
| `orientationAngle` | 通信适配器上报的实测朝向角，单位度，可能为 `null`。 |

车辆面板渲染：

```text
VehicleStatusPanel.vue
  -> useLiveStatusStore().vehicleList
  -> 表格显示 name / state / procState / integrationLevel / currentPosition / energyLevel / paused
  -> 支持普通重路由和强制重路由按钮
  -> rerouteVehicle(name, forced)
  -> POST /api/v1/vehicles/{name}/rerouteRequest?forced=true|false
```

画布车辆叠加渲染：

```text
AnnotationLayer.vue
  -> useLiveVehicleOverlay()
  -> 读取 useProjectStore().vehicles 草稿车辆
  -> 读取 useLiveStatusStore().vehicles Kernel 实时车辆
  -> 按车辆 name 合并
  -> 若 Kernel currentPosition 存在且草稿中有同名 Point，则车辆图标渲染在该 Point 像素位置
  -> 否则使用草稿 Vehicle.layout.pixelX/Y
  -> 根据 Vehicle.state 映射车辆颜色
  -> precisePosition(mm) 通过 background.affine 转为像素，渲染红色“实测点”标记
```

实时性判断：

```text
src/domain/vehicles/live.ts
  -> UNKNOWN / UNAVAILABLE 视为非实时
  -> 其他 state 视为实时
```

### 5.12 订单生命周期状态展示

数据获取通道：

| 阶段 | 通道 | 前端入口 |
| :--- | :--- | :--- |
| 创建成功后的立即显示 | REST 响应 | `POST /api/v1/transport-orders` 返回 `TransportOrder` 后调用 `live.recordCreatedOrder(order)` |
| 后续状态变化 | SSE | `/api/v1/sse?vehicles=true&transportOrders=true` 中的 `/events/transportOrders` 事件 |

BFF 返回的 TransportOrder DTO 内容：

| 字段 | 说明 |
| :--- | :--- |
| `name` | 订单名称。 |
| `type` | 订单类型，未指定时通常为 `-`。 |
| `state` | 生命周期状态。 |
| `intendedVehicle` | 指定执行车辆，可能为 `null`。 |
| `processingVehicle` | 当前实际处理车辆，可能为 `null`。 |
| `destinations` | 目的地数组，包含 `locationName`、`operation`、可选 `properties`。 |

订单生命周期状态枚举：

```text
RAW
ACTIVE
DISPATCHABLE
BEING_PROCESSED
WITHDRAWN
FINISHED
FAILED
UNROUTABLE
```

SSE 订单事件流：

```text
BFF SSE event: /events/transportOrders
  -> data: SseEventEnvelope<TransportOrder>
  -> SseClient#dispatchTransportOrder
  -> useLiveStatusStore#applyTransportOrderEnvelope
  -> 更新 transportOrders[name]
  -> 若状态变化则 pushTimelineEntry
  -> OrderStatusSidebar 响应式刷新
```

`useLiveStatusStore` 的订单状态处理规则：

1. `transportOrders` 是以订单名为 key 的最新状态 map。
2. `orderTimeline` 是订单状态变化时间线，新事件在前。
3. 只有状态真正变化时才追加时间线，避免属性变更事件刷屏。
4. `recordCreatedOrder` 会在订单创建 REST 成功后立即插入一条记录，避免等待 SSE 延迟。
5. 终态订单会在 30 秒后自动清理，也可在 UI 中手动清除。

终态集合：

```text
FINISHED
FAILED
WITHDRAWN
UNROUTABLE
```

订单侧栏渲染：

```text
OrderStatusSidebar.vue
  -> 显示 SSE 状态：未连接 / 连接中 / 已连接 / 重连中 / 已关闭
  -> 显示 activeOrders 数量
  -> 展示最近 50 条 orderTimeline
  -> 支持“仅显示进行中”、“清除已完成”、“清空”
```

### 5.13 当前实现边界与注意事项

1. `ImportView.vue` 的三件套导入当前仍是浏览器内流程，未把 PNG/PGM/YAML 上传到 BFF；资产接口封装已存在但页面未调用。
2. 草稿自动保存以 BFF `draft.json` 为准，同时保留本地 `localStorage` 缓存作为刷新和 BFF 异常时的兜底。
3. `EventSource` 无法发送自定义 header。当前 SSE client 未附加 access-key query 参数，因此当 BFF 开启 `bff.security.accessKey` 后，SSE 鉴权需要后端和前端另行约定 query/cookie 方案。
4. 前端草稿中的 `layout.*` 字段是编辑器专用字段，发布到 Kernel 时由 BFF 转换器丢弃。
5. 前端订单页面的目的地和操作下拉来自草稿，不代表 Kernel 中一定已存在；必须先发布模型到 Kernel，再创建依赖这些 Point/Location 的运输订单。
6. 车辆实时渲染按车辆名称关联草稿 `DraftVehicle` 和 Kernel `Vehicle`；名称不一致时无法在画布上叠加实时状态。

## 章节6：opentcs-commadapter-vda5050 适配器专项深度解析

### 6.1 模块定位

`opentcs-commadapter-vda5050` 是 Kernel 侧车辆通信适配器库，不是独立常驻服务进程。Kernel 启动后加载 `VehicleCommAdapterFactory`，为满足 VDA5050 车辆属性的 `Vehicle` 创建通信适配器实例；车辆启用适配器后，`CommAdapterImpl` 通过 MQTT 与 AGV 交换 VDA5050 2.0.0 JSON 报文。

核心职责：

1. 将 Kernel 下发的 `MovementCommand` 转换为 VDA5050 `Order`。
2. 将 openTCS 的 `Point`、`Path`、`Location`、`MovementCommand` 属性转换为 VDA5050 `Node`、`Edge`、`Action`。
3. 订阅 AGV 上报的 `connection`、`state`、`visualization`、`factsheet` topic。
4. 将 AGV 上报的 `Connection`、`State` 报文写入 `ProcessModelImpl`，并同步到 openTCS 车辆状态。
5. 通过 `MessageResponseMatcher` 用后续 `State` 回执确认已下发 `Order`，控制重发和队列推进。
6. 通过 `MovementCommandManager` 判断移动命令完成，向 Kernel 汇报命令执行结果。

### 6.2 适配器编译、启动命令、启动依赖

#### 6.2.1 编译命令

Windows PowerShell：

```powershell
cd D:\byd_agv_njc\opentcs-commadapter-vda5050
.\gradlew.bat clean build
.\gradlew.bat installDist
```

Linux 终端：

```bash
cd /path/to/opentcs-commadapter-vda5050
./gradlew clean build
./gradlew installDist
```

构建说明：

| 项 | 说明 |
| :--- | :--- |
| 工程类型 | Gradle Java 工程。 |
| 根工程名 | `openTCS-CommAdapter-VDA5050`。 |
| 主要依赖 | `opentcs-api-injection`、`opentcs-common`、Jackson、Everit JSON Schema、Eclipse Paho MQTT、SLF4J。 |
| 主工程集成 | `D:\byd_agv_njc\opentcs\settings.gradle` 通过 `includeBuild('../opentcs-commadapter-vda5050')` 引入本地源码。 |
| Kernel依赖 | `opentcs-kernel\build.gradle` 通过 `org.opentcs.commadapter.vehicle.vda5050:openTCS-CommAdapter-VDA5050` 引用适配器。 |

#### 6.2.2 启动命令

适配器不单独启动。标准运行方式是启动 Kernel，由 Kernel 加载适配器：

Windows PowerShell：

```powershell
cd D:\byd_agv_njc\opentcs
.\gradlew.bat :opentcs-kernel:run
```

Linux 终端：

```bash
cd /path/to/opentcs
./gradlew :opentcs-kernel:run
```

运行时加载链路：

```text
opentcs-kernel
  -> 加载 CommAdapterFactoryImpl
  -> 根据 commadapter.vehicle.vda5050.enabledVersions 启用 1.1 / 2.0 工厂
  -> v2_0.CommAdapterFactory.providesAdapterFor(vehicle)
  -> 车辆属性满足 VDA5050 2.0 要求
  -> CommAdapterComponentsFactory.createCommAdapterImpl(vehicle, mqttSetting)
  -> CommAdapterImpl.initialize()
  -> 车辆启用通信适配器时调用 CommAdapterImpl.enable()
```

#### 6.2.3 启动依赖

| 依赖 | 说明 |
| :--- | :--- |
| JDK | 与 openTCS 主工程一致，当前 Java release 为 21。 |
| Gradle Wrapper | 使用模块自带 `gradlew.bat` / `gradlew`。 |
| opentcs-kernel | 适配器运行宿主，负责调度 `MovementCommand` 和维护车辆过程模型。 |
| MQTT Broker | `MqttClientManager` 通过 Eclipse Paho 连接 `tcp://` 或 `ssl://` Broker。 |
| AGV VDA5050客户端 | 发布 `connection` / `state`，订阅 `order` / `instantActions`。 |
| 车辆VDA5050属性 | 必须配置协议版本、制造商、序列号、topic 前缀或 interfaceName。 |

#### 6.2.4 关键配置

为了使车辆驱动程序能够正常运行，以下条目需要在内核应用程序的配置文件中设置为有效值。

内核应用程序配置文件: D:\byd_agv_njc\opentcs\opentcs-kernel\src\dist\config\opentcs-kernel.properties

配置条目说明: [驱动程序的使用与配置](../../opentcs-commadapter-vda5050/doc/configuration-zh.adoc)

全局 MQTT 配置前缀：

```text
commadapter.vehicle.vda5050.mqtt
```

| 配置项 | 说明 |
| :--- | :--- |
| `brokerHost` | MQTT Broker 地址。 |
| `brokerPort` | MQTT Broker 端口。 |
| `connectionEncrypted` | `true` 使用 `ssl://`，否则使用 `tcp://`。 |
| `username` / `password` | Broker 认证信息。 |
| `clientId` | MQTT clientId。 |
| `keepAliveInterval` | MQTT keepalive。 |
| `reconnectInterval` | 断线重连间隔。 |

适配器配置前缀：

```text
commadapter.vehicle.vda5050
```

| 配置项 | 说明 |
| :--- | :--- |
| `enabledVersions` | 启用的 VDA5050 版本列表，支持 `1.1`、`2.0`。 |
| `onOpModeChangeDoUpdateIntegrationLevel` | AGV operatingMode 变化后是否更新 openTCS integration level。 |
| `onOpModeChangeDoWithdrawOrder` | AGV operatingMode 变化后是否撤回当前订单。 |
| `onOpModeChangeDoResetPosition` | AGV operatingMode 变化后是否清空车辆位置。 |
| `orderResendTimeoutMs` | 未确认订单的最小重发间隔，`0` 表示不节流。 |

车辆属性：

| 属性 | 说明 |
| :--- | :--- |
| `vda5050:version` | VDA5050 2.0 适配器要求值为 `2.0`。 |
| `vda5050:manufacturer` | 报文 Header 的 `manufacturer`。 |
| `vda5050:serialNumber` | 报文 Header 的 `serialNumber`。 |
| `vda5050:topicPrefix` | MQTT topic 完整前缀。 |
| `vda5050:interfaceName` | 未配置 `topicPrefix` 时生成 `{interfaceName}/v2/{manufacturer}/{serialNumber}`。 |
| `vda5050:topicConnectionName` | connection topic 后缀，默认 `connection`。 |
| `vda5050:topicStateName` | state topic 后缀，默认 `state`。 |
| `vda5050:topicOrderName` | order topic 后缀，默认 `order`。 |
| `vda5050:topicInstantActionsName` | instantActions topic 后缀，默认 `instantActions`。 |
| `vda5050:topicConnectionQos` | connection 订阅 QoS，默认 `AT_MOST_ONCE`。 |
| `vda5050:topicStateQos` | state 订阅 QoS，默认 `AT_MOST_ONCE`。 |
| `vda5050:topicOrderQos` | order 发布 QoS，默认 `AT_MOST_ONCE`。 |
| `vda5050:topicInstantActionsQos` | instantActions 发布 QoS，默认 `AT_MOST_ONCE`。 |

默认 topic：

```text
{topicPrefix}/connection
{topicPrefix}/state
{topicPrefix}/order
{topicPrefix}/instantActions
```

如果没有显式配置 `vda5050:topicPrefix`，则默认前缀为：

```text
{interfaceName}/v2/{manufacturer}/{serialNumber}
```

### 6.3 MQTT订阅时机：connection / state / order

#### 6.3.1 MQTT客户端连接时机

`MqttClientManager` 构造时创建 `MqttAsyncClient`，根据 `MqttConfiguration` 生成 Broker URI：

```text
connectionEncrypted=false -> tcp://{brokerHost}:{brokerPort}
connectionEncrypted=true  -> ssl://{brokerHost}:{brokerPort}
```

随后调用 `connect()` 发起异步连接。连接成功后，`onConnect()` 会重新订阅 `subscriptions` map 中登记的所有 topic，用于断线恢复后的自动重订阅。

#### 6.3.2 connection订阅时机

connection topic 在 `CommAdapterImpl.enable()` 中订阅：

```text
CommAdapterImpl.enable()
  -> clientManager.registerConnectionEventListener(this)
  -> clientManager.subscribe(mqttSetting.connectionTopicName(), mqttSetting.connectionTopicQos(), this)
```

入站处理链路：

```text
AGV publish {topicPrefix}/connection
  -> MqttClientManager.messageArrived()
  -> CommAdapterImpl.onIncomingMessage()
  -> MessageValidator.validate(Connection.class, rawJson)
  -> JsonBinder.fromJson(rawJson, Connection.class)
  -> Kernel executor 调用 onConnectionMessage(connection)
```

#### 6.3.3 state订阅时机

state topic 同样在 `CommAdapterImpl.enable()` 中订阅：

```text
CommAdapterImpl.enable()
  -> clientManager.subscribe(mqttSetting.stateTopicName(), mqttSetting.stateTopicQos(), this)
```

入站处理链路：

```text
AGV publish {topicPrefix}/state
  -> MqttClientManager.messageArrived()
  -> CommAdapterImpl.onIncomingMessage()
  -> MessageValidator.validate(State.class, rawJson)
  -> JsonBinder.fromJson(rawJson, State.class)
  -> Kernel executor 调用 onStateMessage(state)
```

#### 6.3.4 order订阅时机

适配器侧不订阅 order topic。

在本系统中，`Order` 是主控系统到 AGV 的下行报文：

```text
openTCS Kernel / VDA5050适配器
  -> publish {topicPrefix}/order
  -> AGV VDA5050客户端订阅并执行
```

因此，“order订阅初始化”不发生在 openTCS 适配器中。适配器只负责发布 `Order`，并通过后续 `State.orderId`、`State.orderUpdateId`、`nodeStates`、`edgeStates`、`actionStates` 判断 AGV 是否接受和完成订单。

order 发布可用链路：

```text
Kernel 调用 sendCommand(MovementCommand)
  -> CommAdapterImpl.sendCommand()
  -> OrderMapper.toOrder(command)
  -> MessageResponseMatcher.enqueueCommand(order, command)
  -> 收到允许发送的 State operatingMode
  -> CommAdapterImpl.sendOrder(order)
  -> MqttClientManager.publish(mqttSetting.orderTopicName(), qos, json, false)
```

#### 6.3.5 订阅生命周期

启用适配器：

```text
CommAdapterImpl.enable()
  -> 注册 MQTT 连接事件监听
  -> 订阅 connection
  -> 订阅 state
  -> 订阅 visualization
  -> 订阅 factsheet
  -> MQTT client 已连接时调用 onConnect()
  -> 清空 MessageResponseMatcher
  -> 清空 MovementCommandManager
```

禁用适配器：

```text
CommAdapterImpl.disable()
  -> 取消订阅 connection
  -> 取消订阅 state
  -> 取消订阅 visualization
  -> 取消订阅 factsheet
  -> 注销 MQTT 连接事件监听
  -> onDisconnect()
  -> super.disable()
```

### 6.4 Order订单报文流转流程

#### 6.4.1 数据接收源

Order 是适配器下行发布报文，源头是 Kernel 调度器传给车辆适配器的 openTCS 命令：

```text
Kernel 调度器
  -> VehicleCommAdapter.sendCommand(MovementCommand)
  -> CommAdapterImpl.sendCommand(command)
```

也可由手工适配器消息触发：

```text
VehicleCommAdapterMessage(type=SEND_ORDER_TYPE)
  -> CommAdapterImpl.processMessage()
  -> handleSendOrder()
  -> sendOrder()
```

#### 6.4.2 原始报文格式

Kernel 到适配器的原始载体是 Java 对象：

| 数据对象 | 说明 |
| :--- | :--- |
| `MovementCommand` | 当前车辆要执行的移动命令，包含 `Route.Step`、目的地操作、属性。 |
| `Route.Step` | 单段路径，包含 source point、destination point、path、routeIndex、车辆朝向。 |
| `TransportOrder` | 当前运输订单，`OrderMapper` 用它生成 VDA5050 `orderId`。 |
| `Vehicle` | 车辆对象，提供 VDA5050 topic、制造商、序列号、地图、偏差等属性。 |
| `Point` / `Path` / `Location` / `LocationType` | 参与 node、edge、action 映射的模型对象。 |

转换后的 VDA5050 DTO：

```text
org.opentcs.commadapter.vehicle.vda5050.v2_0.message.order.Order
```

核心字段：

| 字段 | 来源 |
| :--- | :--- |
| `headerId` | `CommAdapterImpl.sendMessage()` 按 topic 自增。 |
| `timestamp` | `CommAdapterImpl.sendMessage()` 设置当前时间。 |
| `version` | 固定为 `2.0.0`。 |
| `manufacturer` | `vda5050:manufacturer`。 |
| `serialNumber` | `vda5050:serialNumber`。 |
| `orderId` | `TransportOrder.name + "-" + currentDriveOrderIndex`。 |
| `orderUpdateId` | `MovementCommand.step.routeIndex`。 |
| `nodes` | 根据 source、destination、horizon points 生成。 |
| `edges` | 根据 route steps 和 paths 生成。 |

典型 JSON 结构：

```json
{
  "headerId": 1,
  "timestamp": "2026-06-16T10:00:00.000Z",
  "version": "2.0.0",
  "manufacturer": "BYD",
  "serialNumber": "AGV-001",
  "orderId": "TOrder-0001-0",
  "orderUpdateId": 0,
  "nodes": [],
  "edges": []
}
```

#### 6.4.3 内部转换逻辑

主链路：

```text
CommAdapterImpl.sendCommand(command)
  -> OrderMapper.toOrder(command)
  -> MessageResponseMatcher.enqueueCommand(order, command)
  -> MessageResponseMatcher.sendNextOrder()
  -> CommAdapterImpl.sendOrder(order)
  -> CommAdapterImpl.sendMessage(order, orderTopic, orderQos)
```

核心映射类：

| 类 / 函数 | 责任 |
| :--- | :--- |
| `OrderMapper.toOrder()` | 将 `MovementCommand` 转成 VDA5050 `Order`。 |
| `createOrderWithMovement()` | 生成 source node、edge、destination node，并追加 horizon。 |
| `createOrderWithoutMovement()` | 生成仅含目的地 node 的无移动订单。 |
| `NodeMapping.toBaseNode()` | 将 openTCS `Point` 转为 released=true 的 VDA5050 `Node`。 |
| `NodeMapping.toHorizonNode()` | 将后续路径点转为 released=false 的 horizon `Node`。 |
| `EdgeMapping.toBaseEdge()` | 将当前 `Route.Step` 转为 released=true 的 `Edge`。 |
| `EdgeMapping.toHorizonEdge()` | 将后续 `Route.Step` 转为 released=false 的 horizon `Edge`。 |
| `ActionsMapping.fromMovementCommand()` | 将目的地操作映射为 VDA5050 `Action`。 |
| `ActionsMapping.mapPropertyActions()` | 从 Point、Path、Location、MovementCommand 属性提取自定义 action。 |

单位转换规则：

| openTCS | VDA5050 |
| :--- | :--- |
| `Point.pose.position.x/y`，单位 mm | `NodePosition.x/y`，单位 m，执行 `/ 1000.0`。 |
| openTCS 朝向角 | `theta`，转换为弧度。 |
| `Path.maxVelocity` / `maxReverseVelocity`，单位 mm/s | `Edge.maxSpeed`，单位 m/s，执行 `/ 1000.0`。 |
| `agvPosition.x/y`，单位 m | openTCS `Pose.x/y`，单位 mm，执行 `* 1000`。 |

Node 映射规则：

1. `nodeId` 使用 openTCS `Point.name`。
2. `sequenceId` 基于 `routeIndex` 生成。
3. base node 的 `released=true`。
4. horizon node 的 `released=false`。
5. `mapId` 来自 `vda5050:mapId`，可配置在 Point 或 Vehicle 上。
6. `allowedDeviationXY`、`allowedDeviationTheta` 来自点或车辆属性。
7. 首节点可按 `DeviationExtensionTrigger` 扩展偏差范围，使 AGV 接受当前位置附近的初始节点。

Edge 映射规则：

1. `edgeId` 使用 openTCS `Path.name`。
2. `startNodeId` / `endNodeId` 使用 source / destination point name。
3. `sequenceId` 基于 `routeIndex` 生成。
4. 正向行驶使用 `Path.maxVelocity`；反向行驶使用 `Path.maxReverseVelocity`。
5. `orientation`、`rotationAllowed`、`orientationType` 可从 Path 的 VDA5050 属性读取。
6. 未显式配置 orientation 时，`OrderMapper.adjustEdgeOrientations()` 按相邻 node 坐标计算。

Action 映射规则：

1. 目的地操作来自 `MovementCommand.operation`。
2. 充电操作可由车辆属性 `vda5050:rechargeOperation` 映射为 `startCharging`。
3. 自定义 action 由 `vda5050:action.*` 属性定义。
4. 目的地 action 参数由 `vda5050:destinationAction.*` 属性定义，可配置在命令、Location、LocationType 上。
5. action 参数支持 `float:`、`integer:`、`boolean:`、`string:` 前缀解析。

发送前处理：

```text
CommAdapterImpl.sendMessage()
  -> 设置 headerId
  -> 设置 timestamp
  -> 设置 version=2.0.0
  -> 设置 manufacturer / serialNumber
  -> JsonBinder.toJson()
  -> MessageValidator.validate(Order.class, json)
  -> MqttClientManager.publish(topic, qos, json, retained=false)
```

#### 6.4.4 发布目标

Order 发布到 AGV 订阅的 MQTT topic：

```text
{topicPrefix}/order
```

代码目标：

```text
mqttSetting.orderTopicName()
```

发布参数：

| 参数 | 值 |
| :--- | :--- |
| QoS | `mqttSetting.orderTopicQos()`，默认 `AT_MOST_ONCE`。 |
| retained | `false`。 |
| payload | VDA5050 2.0.0 `Order` JSON。 |

#### 6.4.5 Order确认与重发

Order 没有独立 ACK topic，适配器用后续 `State` 确认：

```text
AGV publish State
  -> MessageResponseMatcher.onStateMessage(state)
  -> 比较 State.orderId / orderUpdateId
  -> 匹配 Order.orderId / orderUpdateId
  -> orderAcceptedCallback
  -> MovementCommandManager.enqueue(orderAssociation)
  -> 允许发送队列中的下一条请求
```

拒单判断：

```text
StateMappings.vehicleRejectsOrder(state)
  -> errorType in VALIDATION_ERROR / NO_ROUTE_ERROR / ORDER_ERROR / ORDER_UPDATE_ERROR
```

重发规则：

1. 未确认请求保留在 `MessageResponseMatcher` 队列头。
2. `orderResendTimeoutMs=0` 时不做重发节流。
3. `orderResendTimeoutMs>0` 时，同一订单超过该间隔才允许再次发送。
4. 连续拒单次数超过 `vda5050:maxIgnoredRejections` 后停止重试，等待撤单或人工处理。

### 6.5 Connection连接报文流转流程

#### 6.5.1 数据接收源

Connection 由 AGV 或 Broker Last Will 发布：

```text
AGV VDA5050 Client
  -> MQTT publish
  -> {topicPrefix}/connection
  -> CommAdapterImpl subscription
```

#### 6.5.2 原始报文格式

Java DTO：

```text
org.opentcs.commadapter.vehicle.vda5050.v2_0.message.connection.Connection
```

核心字段：

| 字段 | 说明 |
| :--- | :--- |
| `headerId` | AGV 在 connection topic 上递增的 headerId。 |
| `timestamp` | AGV 生成的 ISO8601 时间戳。 |
| `version` | 协议版本，期望为 `2.0.0`。 |
| `manufacturer` | AGV 制造商。 |
| `serialNumber` | AGV 序列号。 |
| `connectionState` | `ONLINE`、`OFFLINE` 或 `CONNECTIONBROKEN`。 |

典型 JSON：

```json
{
  "headerId": 1,
  "timestamp": "2026-06-16T10:00:00.000Z",
  "version": "2.0.0",
  "manufacturer": "BYD",
  "serialNumber": "AGV-001",
  "connectionState": "ONLINE"
}
```

#### 6.5.3 内部转换逻辑

接收链路：

```text
MqttClientManager.messageArrived(topic, mqttMessage)
  -> new IncomingMessage(topic, payload)
  -> CommAdapterImpl.onIncomingMessage()
  -> topic == mqttSetting.connectionTopicName()
  -> MessageValidator.validate(Connection.class, rawJson)
  -> JsonBinder.fromJson(rawJson, Connection.class)
  -> getExecutor().submit(() -> onConnectionMessage(connection))
```

`IncomingMessageFilter` 对 connection 的处理：

1. `ONLINE`：重置各 topic header 记录，设置 `online=true`，记录 connection 的 headerId 和 timestamp。
2. `OFFLINE`：重置过滤器并接受该报文。
3. `CONNECTIONBROKEN`：重置过滤器并接受该报文。
4. connection 报文即使 headerId 或 timestamp 比历史值旧也会接受，用于兼容 AGV 重启后 headerId 归零。

`onConnectionMessage()` 更新规则：

```text
connectionState == ONLINE
  -> getProcessModel().setCommAdapterConnected(true)
  -> getProcessModel().setState(Vehicle.State.IDLE)

connectionState == OFFLINE / CONNECTIONBROKEN
  -> getProcessModel().setCommAdapterConnected(false)
  -> getProcessModel().setState(Vehicle.State.UNKNOWN)

最后：
  -> getProcessModel().setCurrentConnection(connection)
```

#### 6.5.4 发布目标

Connection 是 AGV 上行报文，适配器不再向 MQTT 发布新的 connection 报文。

内部发布目标：

| 目标 | 内容 |
| :--- | :--- |
| `ProcessModelImpl.currentConnection` | 保存最新 `Connection` 对象。 |
| `VehicleProcessModel.commAdapterConnected` | 标记车辆通信适配器连接状态。 |
| `VehicleProcessModel.state` | `ONLINE` 映射为 `IDLE`，离线类状态映射为 `UNKNOWN`。 |

对上游影响：

1. Kernel 感知车辆通信状态变化。
2. BFF 后续通过 RMI/SSE 可观察车辆状态变化。
3. SPA 车辆监控界面可展示在线、离线或未知状态。

### 6.6 State车辆状态报文流转流程

#### 6.6.1 数据接收源

State 由 AGV 周期性或事件触发发布：

```text
AGV VDA5050 Client
  -> MQTT publish
  -> {topicPrefix}/state
  -> CommAdapterImpl subscription
```

#### 6.6.2 原始报文格式

Java DTO：

```text
org.opentcs.commadapter.vehicle.vda5050.v2_0.message.state.State
```

核心字段：

| 字段 | 说明 |
| :--- | :--- |
| `headerId` / `timestamp` / `version` / `manufacturer` / `serialNumber` | 标准 Header。 |
| `orderId` | 当前订单或上一已完成订单 ID。 |
| `orderUpdateId` | AGV 已接受的订单更新 ID。 |
| `lastNodeId` / `lastNodeSequenceId` | 最近到达或当前所在节点。 |
| `nodeStates` / `edgeStates` | 仍需经过的节点和路径段。 |
| `agvPosition` | 当前地图坐标，可选。 |
| `velocity` | 当前速度，可选。 |
| `loads` | 当前载荷，可选。 |
| `driving` | AGV 是否正在行驶或旋转。 |
| `paused` | AGV 是否暂停，可选。 |
| `actionStates` | 当前或未完成动作状态。 |
| `batteryState` | 电量和充电状态。 |
| `operatingMode` | 当前运行模式。 |
| `errors` | 当前错误列表。 |
| `information` | 信息列表，可选。 |
| `safetyState` | 安全状态。 |

典型 JSON：

```json
{
  "headerId": 10,
  "timestamp": "2026-06-16T10:00:01.000Z",
  "version": "2.0.0",
  "manufacturer": "BYD",
  "serialNumber": "AGV-001",
  "orderId": "TOrder-0001-0",
  "orderUpdateId": 0,
  "lastNodeId": "Point-1",
  "lastNodeSequenceId": 0,
  "nodeStates": [],
  "edgeStates": [],
  "driving": false,
  "actionStates": [],
  "batteryState": {
    "batteryCharge": 80.0,
    "charging": false
  },
  "operatingMode": "AUTOMATIC",
  "errors": [],
  "safetyState": {
    "eStop": "NONE",
    "fieldViolation": false
  }
}
```

#### 6.6.3 内部转换逻辑

接收链路：

```text
MqttClientManager.messageArrived(topic, mqttMessage)
  -> CommAdapterImpl.onIncomingMessage()
  -> topic == mqttSetting.stateTopicName()
  -> MessageValidator.validate(State.class, rawJson)
  -> JsonBinder.fromJson(rawJson, State.class)
  -> getExecutor().submit(() -> onStateMessage(state))
```

`IncomingMessageFilter` 对 state 的规则：

1. 未收到有效 `ONLINE` connection 前拒绝 state。
2. `headerId` 未增长且 `timestamp` 不晚于历史 state 时拒绝。
3. 通过过滤后记录最新 state headerId 和 timestamp。

`onStateMessage()` 主流程：

```text
onStateMessage(state)
  -> setVehicleIdle(false)
  -> incomingMessageFilter.accept(state)
  -> messageResponseMatcher.onStateMessage(state)
  -> setPreviousState(currentState)
  -> setCurrentState(state)
  -> 检查是否拒单并发布用户通知
  -> 根据 agvPosition / lastNodeId 更新位置
  -> 更新载荷、能量、错误、信息、暂停、车辆状态、车体长度
  -> 处理 operatingMode 变化副作用
  -> movementCommandManager.onStateMessage(state, onMovementCommandExecuted)
```

#### 6.6.4 State到Kernel模型的映射

| State字段 | Kernel / ProcessModel更新 |
| :--- | :--- |
| `orderId`、`orderUpdateId` | `MessageResponseMatcher` 用于确认 Order 是否被 AGV 接受。 |
| `nodeStates`、`edgeStates` | `MovementCommandManager` 用于判断移动命令是否完成。 |
| `lastNodeId` | 作为 openTCS 车辆 position 候选值。 |
| `agvPosition.x/y/theta` | 转换为 openTCS `Pose`，x/y 从 m 转 mm，theta 从弧度转角度。 |
| `loads` | 映射为 openTCS `LoadHandlingDevice` 列表。 |
| `batteryState.batteryCharge` | 更新 energyLevel。 |
| `batteryState.charging` | 参与 `Vehicle.State.CHARGING` 判断。 |
| `errors` | fatal 错误映射为 `Vehicle.State.ERROR`，并写入车辆属性。 |
| `information` | 写入 info/debug 车辆属性。 |
| `paused` | 写入 `vda5050:paused`。 |
| `operatingMode` | 映射车辆可用状态，并触发撤单、重置位置或 integration level 更新。 |

车辆状态映射：

```text
StateMappings.toVehicleState(state)
  -> 存在 FATAL error              -> Vehicle.State.ERROR
  -> operatingMode 非自动/半自动    -> Vehicle.State.UNAVAILABLE
  -> batteryState.charging=true     -> Vehicle.State.CHARGING
  -> driving=true                   -> Vehicle.State.EXECUTING
  -> nodeStates/edgeStates仍有释放项 -> Vehicle.State.EXECUTING
  -> actionStates仍有未终态动作      -> Vehicle.State.EXECUTING
  -> 其他                           -> Vehicle.State.IDLE
```

位置处理：

```text
if state.agvPosition != null:
  x_mm = agvPosition.x * 1000
  y_mm = agvPosition.y * 1000
  theta_deg = Math.toDegrees(agvPosition.theta)
  getProcessModel().setPose(new Pose(...))

if state.lastNodeId 非空:
  若 lastNodeId 与待执行命令目的地相关
    -> getProcessModel().setPosition(lastNodeId)
  否则忽略不相关位置
else if state.agvPosition != null:
  -> positionResolutionRequested(getProcessModel().getPose())
```

告警和信息属性：

| VDA5050内容 | openTCS车辆属性 |
| :--- | :--- |
| fatal errors | `vda5050:errors.fatal` |
| warning errors | `vda5050:errors.warning` |
| info entries | `vda5050:information.info` |
| debug entries | `vda5050:information.debug` |
| paused | `vda5050:paused` |

OperatingMode 副作用：

```text
processVehicleOperatingMode(state)
  -> operatingMode 变化
  -> 按配置 onOpModeChangeDoWithdrawOrder 决定是否 transportOrderWithdrawalRequested(true)
  -> 按配置 onOpModeChangeDoResetPosition 决定是否 setPosition(null)
  -> 按配置 onOpModeChangeDoUpdateIntegrationLevel 决定是否 integrationLevelChangeRequested(...)
```

#### 6.6.5 运动命令完成判断

`MovementCommandManager` 只跟踪已被 `MessageResponseMatcher` 确认接受的订单：

```text
MessageResponseMatcher.orderAccepted()
  -> movementCommandManager.enqueue(orderAssociation)
```

每次收到 state：

```text
MovementCommandManager.onStateMessage(state, callback)
  -> 校验 state.orderId 是否匹配当前 drive order
  -> 检查 released edges 是否已从 state.edgeStates 消失
  -> 检查 released nodes 是否已从 state.nodeStates 消失
  -> 最后一段命令还要求相关 action 进入 FINISHED 或 FAILED
  -> 满足条件后 callback.accept(movementCommand)
  -> CommAdapterImpl.onMovementCommandExecuted()
```

完成条件相关车辆属性：

| 属性 | 说明 |
| :--- | :--- |
| `vda5050:movementCommandCompletedCondition` | 可配置按 edge 完成或 edge+node 完成。 |
| `vda5050:lastNodeIdRequiredForMovementCompletion` | 为 `true` 时还要求 `lastNodeId` 与已释放目的地匹配。 |

#### 6.6.6 发布目标

State 是 AGV 上行报文，适配器不向 MQTT 发布新的 state 报文。

内部发布目标：

| 目标 | 内容 |
| :--- | :--- |
| `ProcessModelImpl.previousState` | 上一条 State。 |
| `ProcessModelImpl.currentState` | 最新 State。 |
| `VehicleProcessModel.pose` | AGV 坐标转换后的 openTCS Pose。 |
| `VehicleProcessModel.position` | 按 `lastNodeId` 解析出的 openTCS Point 名称。 |
| `VehicleProcessModel.energyLevel` | 电量百分比。 |
| `VehicleProcessModel.loadHandlingDevices` | 载荷处理设备状态。 |
| `VehicleProcessModel.state` | 映射后的 openTCS `Vehicle.State`。 |
| `Vehicle` properties | VDA5050 错误、信息、暂停等属性。 |
| Kernel 调度器 | 通过 `onMovementCommandExecuted()` 推进运输订单执行。 |

对上游影响：

1. Kernel 车辆状态、位置、订单执行进度被刷新。
2. 运输订单生命周期可能因移动命令完成而进入下一步或终态。
3. BFF 可通过 RMI 读取更新后的车辆和订单状态。
4. SPA 可通过 SSE 展示车辆实时位置、状态、电量和订单进度。

### 6.7 核心类与关键函数清单

| 类 | 关键函数 | 说明 |
| :--- | :--- | :--- |
| `CommAdapterFactoryImpl` | `providesAdapterFor()` / `getAdapterFor()` | 根据配置启用 VDA5050 1.1 / 2.0 工厂，并优先创建 2.0 适配器。 |
| `v2_0.CommAdapterFactory` | `providesAdapterFor()` / `getAdapterFor()` | 判断车辆是否满足 VDA5050 2.0 属性要求，并创建 `CommAdapterImpl`。 |
| `MqttSetting` | `forVehicle()` | 从车辆属性生成 manufacturer、serialNumber、topicPrefix、各 topic 名称和 QoS。 |
| `MqttClientManager` | `connect()` / `subscribe()` / `publish()` / `messageArrived()` | 管理 Paho MQTT 连接、订阅、发布和入站消息分发。 |
| `CommAdapterImpl` | `enable()` / `disable()` | 管理适配器生命周期和 MQTT topic 订阅。 |
| `CommAdapterImpl` | `sendCommand()` | 接收 Kernel `MovementCommand`，转换为 VDA5050 `Order` 并入队。 |
| `CommAdapterImpl` | `onIncomingMessage()` | 根据 topic 分派 Connection、State、Visualization、Factsheet。 |
| `CommAdapterImpl` | `onConnectionMessage()` | 处理 AGV 在线、离线、连接中断。 |
| `CommAdapterImpl` | `onStateMessage()` | 处理车辆状态、位置、电量、载荷、告警、订单确认和命令完成。 |
| `CommAdapterImpl` | `sendMessage()` | 补全 Header、序列化 JSON、Schema 校验并发布 MQTT。 |
| `MessageValidator` | `validate()` | 使用 VDA5050 2.0 JSON Schema 校验 Order、State、Connection 等报文。 |
| `IncomingMessageFilter` | `accept()` | 按在线状态、headerId、timestamp 过滤入站报文。 |
| `OrderMapper` | `toOrder()` | 将 openTCS `MovementCommand` 转换为 VDA5050 `Order`。 |
| `NodeMapping` | `toBaseNode()` / `toHorizonNode()` / `toNodePosition()` | 将 openTCS `Point` 转为 VDA5050 `Node` 和 `NodePosition`。 |
| `EdgeMapping` | `toBaseEdge()` / `toHorizonEdge()` | 将 openTCS `Route.Step` / `Path` 转为 VDA5050 `Edge`。 |
| `ActionsMapping` | `fromMovementCommand()` / `mapPropertyActions()` | 将目的地操作和自定义属性映射为 VDA5050 `Action`。 |
| `MessageResponseMatcher` | `enqueueCommand()` / `onStateMessage()` | 将下发 Order 与 State 回执匹配，控制确认、重发和队列推进。 |
| `MovementCommandManager` | `enqueue()` / `onStateMessage()` | 根据 State 判断 `MovementCommand` 是否完成。 |
| `StateMappings` | `toVehicleState()` / `toLoadHandlingDevices()` / `vehicleRejectsOrder()` | 将 VDA5050 State 转换为 openTCS 车辆状态、载荷和拒单判断。 |
| `ProcessModelImpl` | `setCurrentState()` / `setCurrentConnection()` / `setLastOrderSent()` | 保存适配器扩展过程模型，并通过 property change 事件通知 Kernel。 |

### 6.8 当前实现边界与注意事项

1. VDA5050 2.0 适配器要求车辆属性 `vda5050:version=2.0`，并配置 manufacturer、serialNumber、topicPrefix 或 interfaceName。
2. `connection` 和 `state` 是适配器订阅的 AGV 上行主题；`order` 是适配器发布的下行主题。
3. state 报文在收到有效 `ONLINE` connection 前会被 `IncomingMessageFilter` 拒绝。
4. `Connection` 报文会重置 header 过滤记录，用于兼容 AGV 或 Broker 重连后 headerId 重新开始的情况。
5. Order 接受确认依赖后续 `State.orderId` 和 `State.orderUpdateId`，不是独立 ACK topic。
6. `MovementCommand` 完成依赖 `nodeStates` / `edgeStates` / `actionStates` 从 state 中消失或进入终态，AGV 必须按 VDA5050 规范维护这些字段。
7. 适配器也订阅 `visualization` 和 `factsheet`。其中 visualization 可更新车辆 pose，factsheet 当前主要记录并忽略，不属于本阶段三类主报文分析范围。

## 章节7：端到端全链路数据流转分析

### 7.1 链路总览

端到端数据流由五层组成：

```text
opentcs-spa
  -> HTTP REST / SSE
opentcs-bff
  -> Java RMI / KernelServicePortal
opentcs-kernel
  -> VehicleCommAdapter / VehicleProcessModel / TCSObjectEvent
opentcs-commadapter-vda5050
  -> MQTT / VDA5050 2.0.0 JSON
AGV VDA5050 Client
```

数据载体分层：

| 层级 | 下行订单载体 | 上行车辆状态载体 |
| :--- | :--- | :--- |
| SPA | `TransportOrderRequest` JSON | `SseEventEnvelope<Vehicle>` / `SseEventEnvelope<TransportOrder>` |
| BFF REST/SSE | OpenAPI DTO | OpenAPI DTO |
| BFF到Kernel | `TransportOrderCreationTO` | `KernelServicePortal.fetchEvents()` 获取 `TCSObjectEvent` |
| Kernel内部 | `TransportOrder` / `DriveOrder` / `Route` / `MovementCommand` | `VehicleProcessModel` 属性变化、`Vehicle` / `TransportOrder` 对象事件 |
| 适配器到MQTT | VDA5050 `Order` JSON | VDA5050 `State` / `Connection` JSON |
| AGV | 订阅 `order` topic | 发布 `state` / `connection` topic |

### 7.2 场景1：前端创建并提交运输订单

订单路径示例：

```text
Point-1(MOVE) -> Location-2(pick) -> Point-3(MOVE) -> Location-4(drop)
```

#### 7.2.1 SPA提交REST请求

前端入口：

```text
OrdersView.vue
  -> submit()
  -> createTransportOrder(request)
  -> apiClient.post('/api/v1/transport-orders', request)
```

SPA REST入参类型：

```text
TransportOrderRequest
```

示例请求体：

```json
{
  "name": "spa-1781613600000",
  "incompleteName": true,
  "intendedVehicle": "AGV-001",
  "destinations": [
    {
      "locationName": "Point-1",
      "operation": "MOVE"
    },
    {
      "locationName": "Location-2",
      "operation": "pick"
    },
    {
      "locationName": "Point-3",
      "operation": "MOVE"
    },
    {
      "locationName": "Location-4",
      "operation": "drop"
    }
  ]
}
```

SPA侧语义：

| 字段 | 说明 |
| :--- | :--- |
| `name` | 前端生成的订单名占位。 |
| `incompleteName=true` | 允许 Kernel 追加唯一后缀。 |
| `intendedVehicle` | 指定车辆；为空时由 Kernel 调度器分配。 |
| `destinations[]` | 多段目的地序列，每项包含 `locationName`、`operation`、可选 `properties`。 |

提交成功后：

```text
BFF返回 TransportOrder DTO
  -> live.recordCreatedOrder(order)
  -> 写入 liveStatus.transportOrders
  -> 追加 orderTimeline
  -> 页面跳回 EditorView
```

#### 7.2.2 BFF接收REST并转换为RMI对象

BFF路由：

```text
BffApplication
  -> path("/api/v1")
  -> path("/transport-orders")
  -> post(CreateTransportOrderHandler)
```

处理入口：

```text
CreateTransportOrderHandler.handle(ctx)
  -> ctx.bodyAsClass(TransportOrderRequest.class)
  -> TransportOrderConverter.toCreationTO(request)
  -> kernelClient.createTransportOrder(creationTO)
  -> TransportOrderConverter.toDto(created)
  -> ctx.json(dto)
```

BFF REST DTO：

```text
org.opentcs.bff.api.v1.model.TransportOrderRequest
```

BFF到Kernel RMI对象：

```text
org.opentcs.access.to.order.TransportOrderCreationTO
```

目的地转换：

```text
TransportOrderRequest.destinations[]
  -> DestinationCreationTO(dest.locationName, dest.operation)
  -> DestinationCreationTO.withProperties(dest.properties)
```

其他字段转换：

| REST字段 | RMI对象字段 |
| :--- | :--- |
| `name` | `TransportOrderCreationTO.name` |
| `incompleteName` | `withIncompleteName()` |
| `dispensable` | `withDispensable()` |
| `intendedVehicle` | `withIntendedVehicleName()` |
| `type` | `withType()`，空值转为 `OrderConstants.TYPE_NONE` |
| `deadline` | `withDeadline()`，空值为 `Instant.MAX` |
| `dependencies` | `withDependencyNames()` |
| `wrappingSequence` | `withWrappingSequence()` |
| `peripheralReservationToken` | `withPeripheralReservationToken()` |
| `properties` | `withProperties()` |

#### 7.2.3 BFF通过Java RMI调用Kernel

BFF RMI入口：

```text
KernelClient.createTransportOrder(to)
  -> ensureConnected()
  -> KernelServicePortal.login(host, port)
  -> getTransportOrderService().createTransportOrder(to)
```

RMI服务：

```text
TransportOrderService.createTransportOrder(TransportOrderCreationTO)
```

连接特性：

1. `KernelClient` 懒加载并复用一个 `KernelServicePortal`。
2. 出现 `CredentialsException` 时会清空 portal 并重连重试一次。
3. 其他 Kernel 调用异常直接向上抛出，由 BFF 错误处理转换为 HTTP 错误响应。

#### 7.2.4 Kernel创建TransportOrder

Kernel入口：

```text
StandardTransportOrderService.createTransportOrder(to)
  -> synchronized(globalSyncObject)
  -> TransportOrderPoolManager.createTransportOrder(to)
```

Kernel内部数据结构：

```text
TransportOrderCreationTO
  -> TransportOrder
  -> List<DriveOrder>
  -> DriveOrder.Destination
```

`TransportOrderPoolManager.createTransportOrder()` 关键逻辑：

```text
nameFor(to)
  -> incompleteName=true 时由 ObjectNameProvider 生成最终订单名

toDriveOrders(to.getDestinations(), transportOrderName)
  -> 校验每个目的地是否存在
  -> 校验 Point / Location 操作是否合法
  -> 创建 DriveOrder

new TransportOrder(transportOrderName, driveOrders)
  -> withCreationTime(Instant.now())
  -> withIntendedVehicle(vehicleRef)
  -> withType(type)
  -> withDeadline(deadline)
  -> withDispensable(...)
  -> withDependencies(...)
  -> withProperties(...)

objectRepo.addObject(newOrder)
emitObjectEvent(newOrder, null, OBJECT_CREATED)
```

目的地合法性规则：

| 目的地类型 | 合法操作 |
| :--- | :--- |
| `Point` | `MOVE` 或 `PARK`。 |
| `Location` | `NOP` 或 LocationType 允许的操作，并且满足 attached link 的 allowedOperations。 |
| 不存在对象 | 抛出 `ObjectUnknownException`。 |

示例订单被转换为：

```text
TransportOrder
  name = Kernel最终订单名
  intendedVehicle = Vehicle(AGV-001)
  driveOrders[0] = Destination(Point-1, MOVE)
  driveOrders[1] = Destination(Location-2, pick)
  driveOrders[2] = Destination(Point-3, MOVE)
  driveOrders[3] = Destination(Location-4, drop)
  state = RAW
```

#### 7.2.5 Kernel调度并分配车辆

创建后的 `TransportOrder` 会通过对象事件进入 Kernel 调度流程。调度器选择车辆并规划路径后，更新订单：

```text
TransportOrderPoolManager.setTransportOrderProcessingVehicle()
  -> order.withProcessingVehicle(vehicleRef)
  -> order.withDriveOrders(plannedDriveOrders)
  -> order.withCurrentDriveOrderIndex(0)
  -> order.withCurrentDriveOrderState(TRAVELLING)
  -> emitObjectEvent(order, previousState, OBJECT_MODIFIED)
```

车辆控制器接收当前订单：

```text
DefaultVehicleController.setTransportOrder(newOrder)
  -> setDriveOrder(order.getCurrentDriveOrder(), order.getProperties())
  -> MovementCommandMapper.toMovementCommands(driveOrder, transportOrder)
  -> commandProcessingTracker.driveOrderUpdated(commands)
  -> scheduler.claim(...)
  -> allocateForNextCommand()
```

`MovementCommandMapper` 将每个 `DriveOrder` 的 `Route.Step` 转为 `MovementCommand`：

```text
DriveOrder + TransportOrder
  -> Route.steps[]
  -> MovementCommand[]
```

`MovementCommand` 内容：

| 字段 | 说明 |
| :--- | :--- |
| `transportOrder` | 当前 `TransportOrder`。 |
| `driveOrder` | 当前 `DriveOrder`。 |
| `step` | 当前 `Route.Step`。 |
| `operation` | 非最后一步为 `NO_OPERATION`，最后一步为目的地操作。 |
| `opLocation` | 最后一步且目的地为 Location 时填充。 |
| `finalMovement` | 是否为该 DriveOrder 的最后一段移动。 |
| `finalDestinationLocation` | 最终 Location。 |
| `finalDestinationPoint` | 最终 Point。 |
| `properties` | TransportOrder properties 与 Destination properties 合并。 |

资源分配成功后：

```text
DefaultVehicleController.allocated()
  -> startPreMovementInteractions(...)
  -> sendCommandOrStopSending(command)
  -> sendCommand(command)
  -> commAdapter.enqueueCommand(transformedCommand)
  -> commandProcessingTracker.commandSent(command)
```

#### 7.2.6 Kernel到VDA5050适配器

适配器入口：

```text
CommAdapterImpl.sendCommand(MovementCommand)
  -> OrderMapper.toOrder(command)
  -> MessageResponseMatcher.enqueueCommand(order, command)
```

Kernel到适配器数据载体：

```text
org.opentcs.drivers.vehicle.MovementCommand
```

适配器内部转换：

```text
MovementCommand
  -> OrderMapper.createOrderWithMovement()
  -> NodeMapping.toBaseNode()
  -> EdgeMapping.toBaseEdge()
  -> ActionsMapping.fromMovementCommand()
  -> VDA5050 Order
```

VDA5050 `Order` 字段生成：

| VDA5050字段 | 来源 |
| :--- | :--- |
| `orderId` | `TransportOrder.name + "-" + currentDriveOrderIndex`。 |
| `orderUpdateId` | `MovementCommand.step.routeIndex`。 |
| `nodes[].nodeId` | openTCS `Point.name`。 |
| `nodes[].sequenceId` | `routeIndex * 2 + 偏移`。 |
| `nodes[].released` | 当前 base 为 `true`，horizon 为 `false`。 |
| `nodes[].nodePosition.x/y` | openTCS mm 坐标转换为 m。 |
| `edges[].edgeId` | openTCS `Path.name`。 |
| `edges[].startNodeId/endNodeId` | source / destination point name。 |
| `edges[].maxSpeed` | openTCS mm/s 转 m/s。 |
| `actions[]` | 目的地操作或 `vda5050:action.*` / `vda5050:destinationAction.*` 属性。 |

#### 7.2.7 VDA5050适配器发布MQTT Order

下发链路：

```text
MessageResponseMatcher
  -> sendOrderCallback
  -> CommAdapterImpl.sendOrder(order)
  -> CommAdapterImpl.sendMessage(order, orderTopic, orderQos)
  -> MqttClientManager.publish(topic, qos, json, retained=false)
```

MQTT发布目标：

```text
{topicPrefix}/order
```

VDA5050 JSON载体：

```json
{
  "headerId": 1,
  "timestamp": "2026-06-16T10:00:00.000Z",
  "version": "2.0.0",
  "manufacturer": "BYD",
  "serialNumber": "AGV-001",
  "orderId": "spa-1781613600000-0",
  "orderUpdateId": 0,
  "nodes": [
    {
      "nodeId": "Point-1",
      "sequenceId": 0,
      "released": true,
      "nodePosition": {
        "x": 1.0,
        "y": 2.0,
        "mapId": "factory-map"
      },
      "actions": []
    }
  ],
  "edges": []
}
```

说明：

1. 实际 `nodes` / `edges` 内容由 Kernel 规划出的 `Route.Step` 决定，不直接等同于 REST 请求中的四个 destination。
2. REST 中的 `Point-1(MOVE) -> Location-2(pick) -> Point-3(MOVE) -> Location-4(drop)` 会先被 Kernel 分解为多个 `DriveOrder`，每个 `DriveOrder` 再经过路径规划生成一组 route steps。
3. 适配器按当前 `MovementCommand` 下发 base node/edge，并可追加 horizon node/edge。
4. AGV 接收 `Order` 后，后续通过 `State.orderId` / `orderUpdateId` 确认是否接受。

#### 7.2.8 订单状态回流到前端

Kernel 对 `TransportOrder` 的创建、分配、执行进度、终态变化都会发出 `TCSObjectEvent`：

```text
TransportOrderPoolManager.emitObjectEvent(...)
```

BFF后台轮询：

```text
KernelEventPoller
  -> kernelClient.fetchEvents(1000)
  -> KernelServicePortal.fetchEvents(timeout)
  -> SseEventBridge.dispatch(TCSObjectEvent)
```

BFF SSE转换：

```text
TCSObjectEvent<TransportOrder>
  -> TransportOrderConverter.toDto(current)
  -> SseEventEnvelope<TransportOrder>
  -> event: /events/transportOrders
  -> data: JSON
```

SPA接收：

```text
SseClient
  -> EventSource('/api/v1/sse?vehicles=true&transportOrders=true')
  -> dispatchTransportOrder()
  -> useLiveStatusStore.applyTransportOrderEnvelope()
  -> transportOrders[name] = dto
  -> orderTimeline append
  -> OrderStatusSidebar 渲染
```

订单生命周期常见状态：

```text
RAW -> ACTIVE -> DISPATCHABLE -> BEING_PROCESSED -> FINISHED
```

异常状态：

```text
WITHDRAWN
FAILED
UNROUTABLE
```

### 7.3 场景2：AGV上报State车辆状态报文

链路：

```text
AGV MQTT上报
  -> VDA5050适配器
  -> Kernel
  -> BFF
  -> SPA前端渲染
```

#### 7.3.1 AGV发布State到MQTT

AGV发布目标：

```text
{topicPrefix}/state
```

原始数据载体：

```text
VDA5050 2.0.0 State JSON
```

示例：

```json
{
  "headerId": 20,
  "timestamp": "2026-06-16T10:00:02.000Z",
  "version": "2.0.0",
  "manufacturer": "BYD",
  "serialNumber": "AGV-001",
  "orderId": "spa-1781613600000-0",
  "orderUpdateId": 0,
  "lastNodeId": "Point-1",
  "lastNodeSequenceId": 0,
  "nodeStates": [],
  "edgeStates": [],
  "agvPosition": {
    "x": 12.3,
    "y": 5.6,
    "theta": 1.5708,
    "mapId": "factory-map"
  },
  "driving": false,
  "actionStates": [],
  "batteryState": {
    "batteryCharge": 78.0,
    "charging": false
  },
  "operatingMode": "AUTOMATIC",
  "errors": [],
  "information": [],
  "safetyState": {
    "eStop": "NONE",
    "fieldViolation": false
  }
}
```

#### 7.3.2 适配器接收State

适配器订阅时机：

```text
CommAdapterImpl.enable()
  -> clientManager.subscribe(mqttSetting.stateTopicName(), mqttSetting.stateTopicQos(), this)
```

入站链路：

```text
MqttClientManager.messageArrived(topic, mqttMessage)
  -> IncomingMessage(topic, payload)
  -> CommAdapterImpl.onIncomingMessage()
  -> messageValidator.validate(State.class, rawJson)
  -> jsonBinder.fromJson(rawJson, State.class)
  -> executor.execute(() -> onStateMessage(state))
```

适配器内对象：

```text
org.opentcs.commadapter.vehicle.vda5050.v2_0.message.state.State
```

过滤规则：

1. 未收到有效 `ONLINE` connection 前，state 被 `IncomingMessageFilter` 拒绝。
2. `headerId` 未增长且 `timestamp` 不晚于上一条 state 时，state 被拒绝。
3. 通过过滤后进入业务处理。

#### 7.3.3 State进入Kernel前的适配器处理

主处理流程：

```text
CommAdapterImpl.onStateMessage(state)
  -> messageResponseMatcher.onStateMessage(state)
  -> setPreviousState(currentState)
  -> setCurrentState(state)
  -> processVehiclePosition(state.agvPosition)
  -> setPosition(state.lastNodeId)
  -> setLoadHandlingDevices(...)
  -> setEnergyLevel(...)
  -> setProperty(vda5050 errors/info/paused)
  -> setState(StateMappings.toVehicleState(state))
  -> setBoundingBox(...)
  -> processVehicleOperatingMode(state)
  -> movementCommandManager.onStateMessage(state, onMovementCommandExecuted)
```

适配器到Kernel的中间载体：

```text
ProcessModelImpl extends VehicleProcessModel
```

关键字段转换：

| State字段 | ProcessModel / Kernel含义 |
| :--- | :--- |
| `agvPosition.x/y` | m 转 mm，写入 `Pose.position`。 |
| `agvPosition.theta` | 弧度转角度，写入 `Pose.orientationAngle`。 |
| `lastNodeId` | 写入 `VehicleProcessModel.position`。 |
| `batteryState.batteryCharge` | 写入 `energyLevel`。 |
| `loads` | 映射为 `LoadHandlingDevice`。 |
| `errors` | 写入车辆属性并参与 `Vehicle.State.ERROR` 判断。 |
| `information` | 写入车辆属性。 |
| `paused` | 写入 `vda5050:paused`。 |
| `operatingMode` | 参与可用状态、撤单、位置重置、integration level 更新。 |

#### 7.3.4 State进入Kernel后的内部业务副作用

`DefaultVehicleController` 监听适配器 `ProcessModel` 属性变化：

```text
commAdapter.getProcessModel().addPropertyChangeListener(this)
```

每次 ProcessModel 变化：

```text
DefaultVehicleController.propertyChange(evt)
  -> handleProcessModelEvent(evt)
  -> eventBus.onEvent(new ProcessModelEvent(...))
  -> 根据 VehicleProcessModel.Attribute 更新 Kernel 对象
```

副作用清单：

| ProcessModel属性 | Kernel副作用 |
| :--- | :--- |
| `POSITION` | `setVehiclePosition()`，更新 `Vehicle.currentPosition`，并根据 integration level 处理资源占用。 |
| `POSE` | `vehicleService.updateVehiclePose()`，更新车辆精确坐标。 |
| `ENERGY_LEVEL` | `vehicleService.updateVehicleEnergyLevel()`。 |
| `LOAD_HANDLING_DEVICES` | `vehicleService.updateVehicleLoadHandlingDevices()`。 |
| `STATE` | `vehicleService.updateVehicleState()`。 |
| `BOUNDING_BOX` | `vehicleService.updateVehicleBoundingBox()`。 |
| `VEHICLE_PROPERTY` | `vehicleService.updateObjectProperty()`，写入 VDA5050 错误、信息、暂停等属性。 |
| `COMMAND_EXECUTED` | 调用 `commandExecuted()`，推进当前移动命令。 |
| `TRANSPORT_ORDER_WITHDRAWAL_REQUESTED` | `dispatcherService.withdrawByVehicle()`，撤回车辆当前订单。 |
| `INTEGRATION_LEVEL_CHANGE_REQUESTED` | `vehicleService.updateVehicleIntegrationLevel()`。 |
| `POSITION_RESOLUTION_REQUESTED` | 根据精确 Pose 解析最近 openTCS Point。 |

命令完成副作用：

```text
movementCommandManager.onStateMessage()
  -> 判断 released node/edge 是否已完成
  -> onMovementCommandExecuted(finishedCommand)
  -> getProcessModel().commandExecuted(oldestCommand)
  -> DefaultVehicleController.commandExecuted()
```

`commandExecuted()` 会：

1. 从 `CommandProcessingTracker` 标记命令已执行。
2. 按资源管理策略释放已通过的 path/point 资源。
3. `vehicleService.updateVehicleAllocatedResources()` 更新车辆占用资源。
4. `transportOrderService.updateTransportOrderCurrentRouteStepIndex()` 更新当前订单路由进度。
5. 启动后置外设交互。
6. 若当前 drive order 全部命令完成，更新车辆 `ProcState.AWAITING_ORDER`，等待调度器给下一段或结束订单。

订单确认副作用：

```text
MessageResponseMatcher.onStateMessage(state)
  -> State.orderId / orderUpdateId 匹配已下发 Order
  -> orderAcceptedCallback
  -> MovementCommandManager.enqueue(orderAssociation)
  -> 允许发送队列中下一条 Order / InstantActions
```

拒单副作用：

```text
StateMappings.vehicleRejectsOrder(state)
  -> errorType = VALIDATION_ERROR / NO_ROUTE_ERROR / ORDER_ERROR / ORDER_UPDATE_ERROR
  -> ProcessModel USER_NOTIFICATION
  -> Kernel NotificationService 发布用户通知
```

#### 7.3.5 Kernel到BFF的事件传递

Kernel服务更新 `Vehicle` 或 `TransportOrder` 后会产生 `TCSObjectEvent`：

```text
Vehicle changed
TransportOrder changed
```

BFF事件轮询：

```text
KernelEventPoller.pollLoop()
  -> kernelClient.fetchEvents(1000)
  -> KernelServicePortal.fetchEvents(timeout)
  -> SseEventBridge.dispatch(TCSObjectEvent)
```

BFF转换：

```text
TCSObjectEvent<Vehicle>
  -> VehicleConverter.toDto()
  -> SseEventEnvelope<Vehicle>
  -> event: /events/vehicles

TCSObjectEvent<TransportOrder>
  -> TransportOrderConverter.toDto()
  -> SseEventEnvelope<TransportOrder>
  -> event: /events/transportOrders
```

Vehicle DTO字段：

| BFF字段 | Kernel来源 |
| :--- | :--- |
| `name` | `Vehicle.name` |
| `state` | `Vehicle.state` |
| `procState` | `Vehicle.procState` |
| `integrationLevel` | `Vehicle.integrationLevel` |
| `paused` | `Vehicle.paused` |
| `energyLevel` | `Vehicle.energyLevel` |
| `currentPosition` | `Vehicle.currentPosition.name` |
| `precisePosition` | `Vehicle.pose.position`，单位 mm |
| `orientationAngle` | `Vehicle.pose.orientationAngle`，单位度 |

TransportOrder DTO字段：

| BFF字段 | Kernel来源 |
| :--- | :--- |
| `name` | `TransportOrder.name` |
| `type` | `TransportOrder.type` |
| `state` | `TransportOrder.state` |
| `intendedVehicle` | `TransportOrder.intendedVehicle.name` |
| `processingVehicle` | `TransportOrder.processingVehicle.name` |
| `destinations` | `DriveOrder.destination` |

#### 7.3.6 SPA前端渲染

前端SSE连接：

```text
openLiveStatusStream({
  vehicles: true,
  transportOrders: true
})
  -> EventSource('/api/v1/sse?vehicles=true&transportOrders=true')
```

车辆事件处理：

```text
SseClient.dispatchVehicle()
  -> parseEnvelope<Vehicle>()
  -> useLiveStatusStore.applyVehicleEnvelope()
  -> vehicles[name] = Vehicle DTO
```

订单事件处理：

```text
SseClient.dispatchTransportOrder()
  -> parseEnvelope<TransportOrder>()
  -> useLiveStatusStore.applyTransportOrderEnvelope()
  -> transportOrders[name] = TransportOrder DTO
  -> 状态变化时追加 orderTimeline
```

渲染组件：

| UI | 数据来源 |
| :--- | :--- |
| 车辆实时状态 | `liveStatus.vehicles`。 |
| 车辆列表 | `liveStatus.vehicleList`。 |
| 订单状态侧栏 | `liveStatus.orderTimeline` / `activeOrders`。 |
| 画布车辆位置 | `currentPosition` 和 `precisePosition`。 |
| 电量、状态、集成等级 | `Vehicle.energyLevel`、`state`、`integrationLevel`。 |

### 7.4 场景3：AGV上报Connection连接报文

链路：

```text
AGV MQTT上报
  -> VDA5050适配器
  -> Kernel
  -> BFF
  -> SPA前端渲染
```

#### 7.4.1 AGV发布Connection到MQTT

AGV发布目标：

```text
{topicPrefix}/connection
```

原始数据载体：

```text
VDA5050 2.0.0 Connection JSON
```

示例：

```json
{
  "headerId": 1,
  "timestamp": "2026-06-16T10:00:00.000Z",
  "version": "2.0.0",
  "manufacturer": "BYD",
  "serialNumber": "AGV-001",
  "connectionState": "ONLINE"
}
```

可选状态：

```text
ONLINE
OFFLINE
CONNECTIONBROKEN
```

#### 7.4.2 适配器接收Connection

订阅时机：

```text
CommAdapterImpl.enable()
  -> clientManager.subscribe(mqttSetting.connectionTopicName(), mqttSetting.connectionTopicQos(), this)
```

入站链路：

```text
MqttClientManager.messageArrived(topic, mqttMessage)
  -> IncomingMessage(topic, payload)
  -> CommAdapterImpl.onIncomingMessage()
  -> messageValidator.validate(Connection.class, rawJson)
  -> jsonBinder.fromJson(rawJson, Connection.class)
  -> executor.execute(() -> onConnectionMessage(connection))
```

适配器内对象：

```text
org.opentcs.commadapter.vehicle.vda5050.v2_0.message.connection.Connection
```

`IncomingMessageFilter` 对 connection 的特殊处理：

1. `ONLINE`、`OFFLINE`、`CONNECTIONBROKEN` 都会触发过滤器重置。
2. connection 报文即使 headerId 或 timestamp 比历史旧也会被接受。
3. 这样可以兼容 AGV 重启、Broker重连、headerId重新开始的情况。
4. 只有 `ONLINE` 会设置 filter 的 `online=true`，后续 state / visualization 才会被接受。

#### 7.4.3 Connection进入Kernel前的适配器处理

处理逻辑：

```text
CommAdapterImpl.onConnectionMessage(connection)
  -> setVehicleIdle(false)
  -> incomingMessageFilter.accept(connection)
  -> connectionState == ONLINE
       -> setCommAdapterConnected(true)
       -> setState(Vehicle.State.IDLE)
  -> connectionState == OFFLINE / CONNECTIONBROKEN
       -> setCommAdapterConnected(false)
       -> setState(Vehicle.State.UNKNOWN)
  -> setCurrentConnection(connection)
```

适配器到Kernel的中间载体：

```text
ProcessModelImpl.currentConnection
VehicleProcessModel.commAdapterConnected
VehicleProcessModel.state
```

#### 7.4.4 Connection进入Kernel后的内部业务副作用

`ProcessModelImpl` 变化会触发 `DefaultVehicleController.handleProcessModelEvent()`。

直接副作用：

| Connection状态 | ProcessModel变化 | Kernel对象变化 |
| :--- | :--- | :--- |
| `ONLINE` | `commAdapterConnected=true`，`state=IDLE`，`currentConnection=connection` | `Vehicle.state=IDLE`，车辆可被视为通信恢复。 |
| `OFFLINE` | `commAdapterConnected=false`，`state=UNKNOWN`，`currentConnection=connection` | `Vehicle.state=UNKNOWN`，上游看到车辆通信未知/不可用。 |
| `CONNECTIONBROKEN` | `commAdapterConnected=false`，`state=UNKNOWN`，`currentConnection=connection` | `Vehicle.state=UNKNOWN`。 |

间接副作用：

1. `ONLINE` 会让 `IncomingMessageFilter` 接受后续 `State` 报文。
2. `OFFLINE` / `CONNECTIONBROKEN` 会重置过滤器，后续 state 在再次 `ONLINE` 前被拒绝。
3. `onDisconnect()` 由 MQTT client 连接断开触发时，也会将 `brokerConnected=false`、`commAdapterConnected=false`、`vehicleIdle=true`、`Vehicle.State.UNKNOWN` 写入过程模型。
4. Kernel车辆状态变化会触发 `TCSObjectEvent<Vehicle>`，供BFF SSE转发。

说明：Connection 报文本身不直接推进运输订单，也不直接释放或申请路径资源；它主要影响车辆通信状态、可视状态以及后续 state 报文是否被接受。

#### 7.4.5 Kernel到BFF再到SPA

Kernel事件：

```text
vehicleService.updateVehicleState(vehicleRef, Vehicle.State.IDLE/UNKNOWN)
  -> Vehicle对象修改
  -> TCSObjectEvent<Vehicle>
```

BFF轮询和转发：

```text
KernelEventPoller
  -> kernelClient.fetchEvents(1000)
  -> SseEventBridge.dispatch(TCSObjectEvent)
  -> VehicleConverter.toDto(vehicle)
  -> SseEventEnvelope<Vehicle>
  -> event: /events/vehicles
```

SSE数据示例：

```json
{
  "currentObjectState": {
    "name": "AGV-001",
    "state": "IDLE",
    "procState": "IDLE",
    "integrationLevel": "TO_BE_UTILIZED",
    "paused": false,
    "energyLevel": 78,
    "currentPosition": "Point-1",
    "precisePosition": {
      "x": 12300,
      "y": 5600,
      "z": 0
    },
    "orientationAngle": 90.0
  },
  "previousObjectState": {
    "name": "AGV-001",
    "state": "UNKNOWN",
    "procState": "IDLE",
    "integrationLevel": "TO_BE_UTILIZED",
    "paused": false,
    "energyLevel": 78,
    "currentPosition": "Point-1",
    "precisePosition": {
      "x": 12300,
      "y": 5600,
      "z": 0
    },
    "orientationAngle": 90.0
  }
}
```

SPA渲染：

```text
SseClient.dispatchVehicle()
  -> useLiveStatusStore.applyVehicleEnvelope()
  -> vehicles["AGV-001"] = currentObjectState
  -> VehicleStatusPanel / 画布车辆图标响应式刷新
```

前端可观察变化：

| Connection状态 | 前端表现 |
| :--- | :--- |
| `ONLINE` | 车辆状态可能从 `UNKNOWN` 变为 `IDLE`，状态面板显示通信恢复。 |
| `OFFLINE` | 车辆状态变为 `UNKNOWN`。 |
| `CONNECTIONBROKEN` | 车辆状态变为 `UNKNOWN`，后续 state 被过滤直到重新 ONLINE。 |

### 7.5 三个场景的数据载体对照

| 场景 | SPA/BFF REST | BFF到Kernel | Kernel内部 | 适配器/MQTT | BFF/SPA回流 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 创建运输订单 | `TransportOrderRequest` / `TransportOrder` | `TransportOrderCreationTO` | `TransportOrder`、`DriveOrder`、`Route`、`MovementCommand` | `Order` JSON 发布到 `{topicPrefix}/order` | `SseEventEnvelope<TransportOrder>` |
| AGV上报State | 无REST入参 | 无RMI写入；后续通过事件读取 | `ProcessModelImpl`、`Vehicle`、`TransportOrder`、`TCSObjectEvent` | `State` JSON 来自 `{topicPrefix}/state` | `SseEventEnvelope<Vehicle>` / `SseEventEnvelope<TransportOrder>` |
| AGV上报Connection | 无REST入参 | 无RMI写入；后续通过事件读取 | `ProcessModelImpl.currentConnection`、`Vehicle.state`、`TCSObjectEvent` | `Connection` JSON 来自 `{topicPrefix}/connection` | `SseEventEnvelope<Vehicle>` |

### 7.6 排障观察点

订单下发链路观察点：

| 层 | 观察点 |
| :--- | :--- |
| SPA | `POST /api/v1/transport-orders` 请求体和响应状态。 |
| BFF | `CreateTransportOrderHandler` 是否完成 DTO 转换和 RMI调用。 |
| Kernel | `TransportOrderPoolManager` 是否创建订单并发出 `OBJECT_CREATED`。 |
| Dispatcher | 订单是否进入 `DISPATCHABLE` / `BEING_PROCESSED`。 |
| VehicleController | 是否调用 `commAdapter.enqueueCommand()`。 |
| VDA适配器 | `sendOrder()` 是否发布 `{topicPrefix}/order`。 |
| MQTT | Broker中是否能看到 order topic payload。 |
| AGV | 是否用 state 回报相同 `orderId` / `orderUpdateId`。 |

State回流链路观察点：

| 层 | 观察点 |
| :--- | :--- |
| MQTT | `{topicPrefix}/state` 是否持续收到 payload。 |
| VDA适配器 | `IncomingMessageFilter` 是否因未 ONLINE 或 header 过旧丢弃 state。 |
| VDA适配器 | `onStateMessage()` 是否更新 pose、position、energy、state。 |
| Kernel | `Vehicle` / `TransportOrder` 是否产生 `TCSObjectEvent`。 |
| BFF | `KernelEventPoller` 是否取到事件并交给 `SseEventBridge`。 |
| SPA | `/api/v1/sse?vehicles=true&transportOrders=true` 是否连接，`liveStatus` 是否更新。 |

Connection回流链路观察点：

| 层 | 观察点 |
| :--- | :--- |
| MQTT | `{topicPrefix}/connection` 是否收到 `ONLINE`。 |
| VDA适配器 | `onConnectionMessage()` 是否设置 `commAdapterConnected` 和 `Vehicle.State`。 |
| VDA适配器 | 重新 `ONLINE` 后 state 是否开始被接受。 |
| Kernel | `Vehicle.state` 是否从 `UNKNOWN` 变为 `IDLE`。 |
| BFF/SPA | `/events/vehicles` 是否推送最新车辆状态。 |

## 章节8：OpenTCS 日志系统运维手册

本章面向 openTCS V7.2.1 + VDA5050 v2.0 适配器的本地开发、联调和现场运维，重点说明 Kernel 日志系统如何配置、如何按包/类打开 DEBUG/FINE 日志，以及如何用日志定位 SPA 下发 VDA5050 instantActions 后 MQTT 无报文、请求阻塞、适配器未发布等问题。

### 8.1 SLF4J 日志门面基础原理

SLF4J，全称 Simple Logging Facade for Java，是 Java 日志领域常用的“日志门面”。它本身不负责最终写文件、打控制台、滚动切割日志，而是给业务代码提供统一的 `Logger` API。

业务代码通常只依赖 SLF4J API：

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ExampleService {

  private static final Logger LOG = LoggerFactory.getLogger(ExampleService.class);

  public void execute(String vehicleName, String actionId) {
    LOG.info("{}: sending instant action {}", vehicleName, actionId);
    LOG.debug("{}: instant action payload prepared: {}", vehicleName, actionId);
    LOG.warn("{}: vehicle state is not ideal for action dispatch", vehicleName);
  }
}
```

这种写法的好处是：业务代码不绑定具体日志实现。底层最终可以接 Logback、Log4j2、JDK 自带的 `java.util.logging`，业务代码不需要改。

SLF4J 的核心分层如下：

| 层级 | 作用 | openTCS 当前项目中的体现 |
| :--- | :--- | :--- |
| 业务代码 | 调用 `LOG.info()`、`LOG.debug()`、`LOG.warn()` | Kernel、BFF、VDA适配器 Java 代码大量使用 `org.slf4j.Logger` |
| SLF4J API | 提供统一日志接口 | `gradle/java-project.gradle` 引入 `libs.slf4j.api` |
| SLF4J Binding/Provider | 把 SLF4J 调用转给具体日志实现 | Kernel 运行时依赖 `libs.slf4j.jdk14` |
| 底层日志实现 | 真正负责级别过滤、输出、文件滚动 | 当前 Kernel 使用 JDK JUL，即 `java.util.logging` |

在当前 openTCS Kernel 中，`LOG.debug(...)` 不会读取 `DEBUG` 这个级别名，而是经由 `slf4j-jdk14` 映射到底层 JUL 的 `FINE` 级别。因此，要看 SLF4J debug 日志，应在 `logging.config` 中配置 `FINE`。

### 8.2 OpenTCS 日志分层架构（SLF4J + 底层日志实现）

openTCS Kernel 的日志链路可以理解为：

```text
Java业务代码
  -> org.slf4j.Logger / LoggerFactory
  -> slf4j-jdk14
  -> java.util.logging.Logger
  -> logging.config
  -> ConsoleHandler / FileHandler
  -> 控制台 / log/opentcs-kernel.%g.log
```

以 VDA5050 v2.0 适配器的 `MessageResponseMatcher` 为例：

```java
private static final Logger LOG = LoggerFactory.getLogger(MessageResponseMatcher.class);

LOG.debug("{}: Not sending enqueued request yet, due to unacknowledged previous request.",
          vehicleName);
```

该日志的实际 logger 名称来自 Java 类的全限定名：

```text
org.opentcs.commadapter.vehicle.vda5050.v2_0.MessageResponseMatcher
```

由于 Kernel 运行时使用 `slf4j-jdk14`，这条 `LOG.debug(...)` 最终等价于 JUL 的 `FINE` 日志。要让它输出，需要同时满足两个条件：

1. 对应 logger 自身允许 `FINE`。
2. 输出 handler，例如 `ConsoleHandler` 或 `FileHandler`，也允许 `FINE`。

如果只配置：

```properties
java.util.logging.ConsoleHandler.level = FINE
```

仍然可能看不到 debug 日志，因为这只是“控制台允许打印 FINE”。如果全局 logger 仍然是：

```properties
.level = INFO
```

则类 logger 默认只产生 `INFO` 及以上日志，`LOG.debug(...)` 对应的 `FINE` 在 logger 层就被过滤掉了。正确做法是给目标包或目标类单独打开 `FINE`。

### 8.3 logging.config 配置文件完整语法、路径、加载规则

`logging.config` 属于 JDK JUL，即 `java.util.logging` 的配置文件，不是 Logback 的 `logback.xml`，也不是 Log4j2 的 `log4j2.xml`。

Kernel 发布包中的典型路径为：

```text
D:\byd_agv_njc\opentcs\opentcs-kernel\build\install\opentcs-kernel\config\logging.config
```

Kernel 启动脚本通过 JVM 参数加载该文件：

```text
-Djava.util.logging.config.file="%OPENTCS_CONFIGDIR%\logging.config"
```

因此，实际生效的是“正在运行的 Kernel 进程启动时指定的那个配置文件”。如果修改源码模板：

```text
opentcs-kernel/src/dist/config/logging.config
```

但当前 Kernel 是从 `build/install/opentcs-kernel` 目录启动的，则运行中的 Kernel 不会自动使用源码模板里的修改。

常用配置项如下：

```properties
# 全局默认日志级别。没有单独配置的 logger 会继承它。
.level = INFO

# 启用控制台和文件输出。
handlers = java.util.logging.FileHandler, java.util.logging.ConsoleHandler

# Kernel日志文件路径，通常相对于Kernel运行目录。
java.util.logging.FileHandler.pattern = ./log/opentcs-kernel.%g.log

# 单个日志文件最大字节数。
java.util.logging.FileHandler.limit = 500000

# 滚动文件数量。
java.util.logging.FileHandler.count = 10

# 追加写入，而不是每次启动覆盖。
java.util.logging.FileHandler.append = true

# 文件handler允许输出的最低级别。
java.util.logging.FileHandler.level = FINE

# 控制台handler允许输出的最低级别。
java.util.logging.ConsoleHandler.level = FINE

# openTCS单行日志格式化器，便于现场检索。
java.util.logging.FileHandler.formatter = org.opentcs.util.logging.SingleLineFormatter
java.util.logging.ConsoleHandler.formatter = org.opentcs.util.logging.SingleLineFormatter
```

配置加载规则：

| 规则 | 说明 |
| :--- | :--- |
| 加载时机 | JVM 启动时读取 `java.util.logging.config.file` 指向的文件 |
| 是否热加载 | 默认不热加载，修改后需要重启 Kernel |
| key 语法 | `loggerName.level = LEVEL` |
| loggerName 来源 | Java 包名或类全限定名 |
| handler level | 控制输出目标是否允许该级别 |
| logger level | 控制该 logger 是否产生日志事件 |

### 8.4 按包/类自定义日志级别配置方法

JUL 的 logger 名称通常来自 Java 类全限定名，也就是：

```text
包名.类名
```

例如 Java 类：

```java
package org.opentcs.commadapter.vehicle.vda5050.v2_0;

public class MessageResponseMatcher {
}
```

对应的 logger 配置 key 为：

```properties
org.opentcs.commadapter.vehicle.vda5050.v2_0.MessageResponseMatcher.level = FINE
```

字段拆解如下：

| 片段 | 含义 |
| :--- | :--- |
| `org` | 顶级包名 |
| `opentcs` | openTCS 项目包 |
| `commadapter` | 通信适配器相关模块 |
| `vehicle` | 车辆通信适配器域 |
| `vda5050` | VDA5050协议适配器 |
| `v2_0` | VDA5050 v2.0实现包 |
| `MessageResponseMatcher` | 具体 Java 类名 |
| `.level` | JUL 固定配置后缀，表示设置该 logger 的级别 |
| `FINE` | JUL 日志级别，对应 SLF4J debug |

本次 VDA5050 instantActions 请求阻塞排障的实战配置：

```properties
# 只打开 VDA5050 v2.0 请求应答匹配器的 debug/FINE 日志。
org.opentcs.commadapter.vehicle.vda5050.v2_0.MessageResponseMatcher.level = FINE
```

如果现场不确定适配器版本，可同时配置 v1.1 和 v2.0：

```properties
org.opentcs.commadapter.vehicle.vda5050.v1_1.MessageResponseMatcher.level = FINE
org.opentcs.commadapter.vehicle.vda5050.v2_0.MessageResponseMatcher.level = FINE
```

按包打开日志的示例：

```properties
# 打开整个 VDA5050 适配器包的 FINE 日志，日志量会明显增加。
org.opentcs.commadapter.vehicle.vda5050.level = FINE

# 打开 Kernel 车辆控制器包的 FINE 日志，用于排查调度/命令下发。
org.opentcs.kernel.vehicles.level = FINE

# 打开具体 Kernel 类的 FINE 日志。
org.opentcs.kernel.vehicles.DefaultVehicleController.level = FINE
```

通用模板：

```properties
# 按具体类配置，推荐用于精准排障。
完整包名.类名.level = FINE

# 按包配置，推荐用于短时间联调，不建议长期在线上打开。
完整包名.level = FINE
```

### 8.5 各级日志级别适用场景、线上运维推荐级别

JUL 常用级别从高到低如下：

| JUL级别 | 常见含义 | SLF4J常见对应 | 适用场景 |
| :--- | :--- | :--- | :--- |
| `SEVERE` | 严重错误 | `error` | Kernel无法启动、适配器关键线程崩溃、不可恢复异常 |
| `WARNING` | 警告 | `warn` | 车辆状态异常、连接失败、报文解析失败、业务可继续但存在风险 |
| `INFO` | 常规运行信息 | `info` | 启停、状态切换、订单创建、关键业务动作 |
| `CONFIG` | 配置相关信息 | 较少直接使用 | 启动配置、模块参数、现场配置核对 |
| `FINE` | 调试信息 | `debug` | 请求队列、状态机细节、MQTT收发链路、调度判断分支 |
| `FINER`/`FINEST` | 更细粒度调试 | `trace` | 极细粒度排障，一般只在开发环境短时间打开 |

推荐策略：

| 环境 | 推荐全局级别 | 建议 |
| :--- | :--- | :--- |
| 生产/现场稳定运行 | `.level = INFO` | 保留 `INFO`、`WARNING`、`SEVERE`，避免长期全局 `FINE` |
| 现场问题复现 | `.level = INFO` + 单类 `FINE` | 对疑似类精准打开，例如 `MessageResponseMatcher.level = FINE` |
| 开发联调 | 可短时打开包级 `FINE` | 调试完成后恢复，避免日志淹没核心信息 |
| 深度源码调试 | 单类/小包 `FINER` 或 `FINEST` | 仅限短时间使用，注意磁盘和性能影响 |

不建议长期配置：

```properties
.level = FINE
```

因为这会打开整个 Kernel 和相关依赖的 debug 级别日志，现场日志量会快速膨胀，反而降低排障效率。

### 8.6 日志排障实操：即时动作、MQTT报文收发、适配器请求阻塞类问题调试方案

#### 8.6.1 SPA下发instantActions后MQTT无报文的核心链路

即时动作下发链路：

```text
SPA
  -> POST /api/v1/vehicles/{name}/instant-actions
  -> BFF instant-actions接口
  -> Kernel VehicleService.sendCommAdapterMessage(...)
  -> VDA5050适配器 processMessage(...)
  -> MessageResponseMatcher.enqueueAction(...)
  -> MessageResponseMatcher.enqueueRequest(...)
  -> MQTT publish {topicPrefix}/instantActions
  -> AGV state.actionStates 回报执行状态
  -> MessageResponseMatcher 确认请求完成，释放后续请求
```

当 Kernel 日志出现：

```text
Vehicle-1: Not sending enqueued request yet, due to unacknowledged previous request.
```

含义是：当前 instantActions 已进入适配器请求队列，但前一个请求还没有被车辆状态报文确认完成。`MessageResponseMatcher` 为避免请求乱序或重复发送，会阻止后续请求继续发布 MQTT。

此时需要重点检查：

| 检查点 | 说明 |
| :--- | :--- |
| MQTT state topic | AGV 是否持续上报 `{topicPrefix}/state` |
| `actionStates` | state 报文里是否包含前一个即时动作的 `actionId` |
| 执行状态 | 前一个动作是否从 `WAITING`/`INITIALIZING`/`RUNNING` 走到终态 |
| actionId | AGV 回报的 `actionId` 是否与下发报文完全一致 |
| topicPrefix | 订阅的 topic 是否与适配器发布的 topic 一致 |
| adapter连接状态 | connection 是否为 `ONLINE`，state 是否被适配器接受 |

建议打开的精准日志：

```properties
org.opentcs.commadapter.vehicle.vda5050.v2_0.MessageResponseMatcher.level = FINE
```

可选打开 VDA5050 包级日志：

```properties
org.opentcs.commadapter.vehicle.vda5050.level = FINE
```

可选打开 Kernel 车辆控制器日志：

```properties
org.opentcs.kernel.vehicles.DefaultVehicleController.level = FINE
```

#### 8.6.2 关键日志检索命令

Windows PowerShell 示例：

```powershell
Select-String -Path .\log\opentcs-kernel.*.log `
  -Pattern "MessageResponseMatcher|Enqueuing instant action|Not sending enqueued request yet|Sending order to comm adapter|Vehicle acknowledged instant actions|Cannot send next order"
```

针对即时动作排障，重点搜索：

```text
Enqueuing instant action
Not sending enqueued request yet
Cannot send next order
Sending order to comm adapter
Vehicle acknowledged instant actions
```

如果前端返回成功，但 MQTTX 订阅不到 `{topicPrefix}/instantActions`，按以下顺序判断：

1. BFF 是否返回 2xx：确认请求已进入 BFF。
2. Kernel 是否有 commAdapterMessage 处理日志：确认请求已进 Kernel。
3. `MessageResponseMatcher` 是否打印 `Enqueuing instant action`：确认请求已进入 VDA 适配器队列。
4. 是否出现 `Not sending enqueued request yet`：确认是否被未确认的前序请求阻塞。
5. 是否出现 MQTT 发布日志或 `Sending order to comm adapter` 类日志：确认是否真正进入发布阶段。
6. MQTTX 订阅 topic 是否与适配器配置一致：确认不是订阅错 topic。
7. AGV state 是否回报前序 `actionId` 终态：确认请求队列是否能释放。

#### 8.6.3 MQTT报文收发排障建议

VDA5050 v2.0 典型 topic：

```text
{topicPrefix}/instantActions
{topicPrefix}/state
{topicPrefix}/connection
{topicPrefix}/order
```

例如：

```text
VDA/V2.0.0/BYD_11/DP0055/instantActions
```

排障时 MQTTX 至少同时订阅：

```text
VDA/V2.0.0/BYD_11/DP0055/instantActions
VDA/V2.0.0/BYD_11/DP0055/state
VDA/V2.0.0/BYD_11/DP0055/connection
```

如果只订阅 `instantActions`，只能看到是否发布，无法判断为什么后续动作被阻塞。`state.actionStates` 是判断前序动作是否被 AGV 确认的关键依据。

### 8.7 日志持久化、滚动分割、日志过滤运维技巧

Kernel 默认日志文件配置示例：

```properties
java.util.logging.FileHandler.pattern = ./log/opentcs-kernel.%g.log
java.util.logging.FileHandler.limit = 500000
java.util.logging.FileHandler.count = 10
java.util.logging.FileHandler.append = true
java.util.logging.FileHandler.formatter = org.opentcs.util.logging.SingleLineFormatter
```

字段含义：

| 配置项 | 说明 |
| :--- | :--- |
| `pattern` | 日志文件路径和命名模式，`%g` 是滚动序号 |
| `limit` | 单个日志文件最大字节数 |
| `count` | 最多保留的滚动文件数量 |
| `append` | 是否追加写入旧日志 |
| `formatter` | 日志格式化器，openTCS 默认使用单行格式，便于 grep/Select-String |

现场运维建议：

1. 稳定运行时保持 `.level = INFO`。
2. 排障时优先打开具体类，例如 `MessageResponseMatcher.level = FINE`。
3. 问题复现后及时恢复日志级别，避免日志滚动过快覆盖现场证据。
4. 排障前可适当增大 `FileHandler.limit` 和 `FileHandler.count`，防止高频 state/MQTT 日志覆盖关键片段。
5. 每次修改 `logging.config` 后重启 Kernel，并确认启动脚本加载的是当前修改的配置文件。

常用过滤命令：

```powershell
# 搜索指定车辆。
Select-String -Path .\log\opentcs-kernel.*.log -Pattern "Vehicle-1"

# 搜索指定即时动作ID。
Select-String -Path .\log\opentcs-kernel.*.log -Pattern "173fe7c7-6fae-4176-830c-6002eb60c374"

# 搜索VDA5050请求阻塞。
Select-String -Path .\log\opentcs-kernel.*.log -Pattern "unacknowledged previous request"

# 搜索适配器请求匹配器相关日志。
Select-String -Path .\log\opentcs-kernel.*.log -Pattern "MessageResponseMatcher"
```

最终定位原则：

| 现象 | 优先判断 |
| :--- | :--- |
| 前端返回成功，但 MQTT 无 instantActions | 看 `MessageResponseMatcher` 是否已入队、是否被前序未确认请求阻塞 |
| 第一条能发，第二条不能发 | 看前一条 actionId 是否在 state.actionStates 中回报终态 |
| Kernel 无任何相关日志 | 看 BFF 是否真的调用 Kernel、Kernel 是否加载了新适配器 JAR、logger配置是否生效 |
| MQTTX 收不到但日志显示已发布 | 看 topicPrefix、broker地址、client订阅topic、QoS/retain配置 |
| state 有上报但队列不释放 | 看 actionId 是否一致、actionStatus 是否终态、适配器解析版本是否匹配 |

# 章节：提示词

```
# 全局前置上下文：dd-opentcs 自研AGV调度系统完整背景与约束
## 一、任务执行强制前置规则（最高优先级，必须先遵守）
1. 禁止一次性全量扫描4个模块所有源码、禁止一次性生成全部7个章节；
2. 任务必须拆分为5个独立阶段分步执行，仅处理当前阶段指定章节，其余章节留白，不提前分析、不预读无关模块代码；
3. 每完成一个阶段，输出【阶段X已完成，请执行下一阶段指令】提示，等待用户再次调用后再处理下一章节；
4. 阶段划分规则：
   阶段1：仅分析并输出 章节1、章节2、章节3
   阶段2：仅分析并输出 章节4 opentcs-bff 专项
   阶段3：仅分析并输出 章节5 opentcs-spa 前端专项
   阶段4：仅分析并输出 章节6 VDA5050适配器专项
   阶段5：仅分析并输出 章节7 端到端全链路分析
5. 源码扫描范围控制：仅读取当前阶段对应模块src源码，自动跳过 node_modules、target、build、dist、test、docs、第三方依赖目录，减少文件检索耗时。

## 二、项目基础背景
本项目 dd-opentcs 是基于开源 openTCS 二次开发、面向汽车工厂场景的AGV调度整套系统，由四大核心模块组成，各模块定义如下：
1. opentcs-commadapter-vda5050：内置MQTT客户端，负责将openTCS内部TransportOrder、Route对象双向转换为 VDA5050 2.0.0 标准JSON报文，完成与AGV的MQTT收发，对接Mosquitto MQTT Broker
2. opentcs-kernel：系统内核服务进程，独立于车型实现通用调度策略、交通管制、路径规划、任务分配，对外提供Java RMI调用接口
3. opentcs-bff：前后端缓冲适配层，上游对接前端SPA，接收HTTP/SSE请求；下游通过Java RMI直连kernel，实现前端与内核解耦、工厂地图统一适配
4. opentcs-spa：操作员可视化前端入口，Vue3+TS单页应用，提供工厂画布拖拽编辑、运输订单管理、AGV实时监控、订单全生命周期追踪

## 三、完整系统数据流架构（自上而下链路）
opentcs-spa（浏览器Vue3+TS）
    ↓ HTTP/REST + SSE
opentcs-bff（BFF缓冲层）
    ↓ Java RMI
opentcs-kernel（调度内核） ←→ opentcs-commadapter-vda5050（VDA5050适配器）
    ↓ MQTT协议（VDA5050 2.0.0 JSON报文）
Mosquitto MQTT Broker
    ↓ 厂区工业Wi-Fi/5G专网
AGV车载VDA5050客户端（订阅指令、上报车辆state/connection/order报文）

## 四、各模块本地源码绝对路径
1. VDA5050通信适配器：D:\byd_agv_njc\opentcs-commadapter-vda5050
2. openTCS内核kernel：D:\byd_agv_njc\opentcs\opentcs-kernel
3. BFF中间层：D:\byd_agv_njc\opentcs\opentcs-bff
4. SPA可视化前端：D:\byd_agv_njc\opentcs\opentcs-spa

## 五、配套参考文档路径与外部规范
1. 本地项目文档目录：D:\byd_agv_njc\opentcs\docs
    - spa-frontend-roadmap.md
    - spa-architecture.md
    - bff-roadmap.md
2. VDA5050 2.0.0 官方标准仓库：https://github.com/VDA5050/VDA5050/tree/2.0.0

## 六、本次任务总目标
基于以上整套系统代码、文档、架构信息，分阶段完成工程化分析，增量写入标准开发运维手册，文件输出路径固定为：docs/project-manual.md
手册使用场景：①新人入职培训教材；②开发/运维/故障排查/迭代开发参考工具书。

## 七、手册完整章节清单（分阶段处理，单次只写对应阶段章节）
### 章节1：系统架构与模块划分
1. 四大核心模块各自定位、核心能力
2. 每个模块上下游依赖、模块间通信协议、交互方式

### 章节2：项目技术栈与顶层目录结构
1. 每个模块所用编程语言、开发框架、构建/打包工具完整说明
2. dd-opentcs 顶层目录结构，仅展示一级目录，无需深层递归，忽略构建产物、第三方依赖、测试目录

### 章节3：全模块编译与运行规范
1. 模块间启动依赖先后顺序
2. 各模块标准编译命令、启动运行命令

### 章节4：opentcs-bff 专项深度解析
1. BFF编译、启动命令、前置依赖项
2. BFF对外全部HTTP API清单
3. API文档查看方式
4. Windows PowerShell / Linux 终端API测试示例
5. BFF完整核心业务数据流（请求入口→内部处理→下游出口）
6. BFF核心业务类、关键函数清单

### 章节5：opentcs-spa 前端专项深度解析
1. SPA编译、启动命令、依赖条件
2. 全流程业务数据流拆解，逐条覆盖以下场景：
    - 工厂地图三件套上传流程、后端处理逻辑、文件存储位置
    - 画布编辑器模型编辑流程、工厂模型文件格式、存储路径
    - 工厂模型新建/重命名/另存为/删除完整逻辑
    - 工厂模型发布流程、调用后端接口明细
    - 前端创建运输订单全链路
    - AGV车辆实时状态渲染：数据获取通道、下游模块返回数据内容
    - 订单生命周期状态展示：数据获取通道、下游模块返回数据内容

### 章节6：opentcs-commadapter-vda5050 适配器专项深度解析
1. 适配器编译、启动命令、启动依赖
2. MQTT订阅时机：connection/state/order三类主题何时完成订阅初始化
3. 三类VDA5050报文完整流转流程分开说明：
    - Order订单报文：数据接收源、原始报文格式、内部转换逻辑、发布目标
    - Connection连接报文：数据接收源、原始报文格式、内部转换逻辑、发布目标
    - State车辆状态报文：数据接收源、原始报文格式、内部转换逻辑、发布目标

### 章节7：端到端全链路数据流转分析（按场景拆分，全程标注各阶段数据载体格式）
场景1：前端创建并提交运输订单
订单路径示例：Point-1(MOVE) → Location-2(pick) → Point-3(MOVE) → Location-4(drop)
要求：完整追踪数据从SPA提交 → BFF → Kernel → VDA5050适配器 → MQTT下发AGV，标注每一层数据结构类型（REST入参/RMI对象/VDA5050 JSON）

场景2：AGV上报State车辆状态报文
数据流链路：AGV MQTT上报 → VDA5050适配器 → Kernel → BFF → SPA前端渲染
要求：每层数据格式说明，同时说明报文进入Kernel后触发的内部业务副作用

场景3：AGV上报Connection连接报文
数据流链路：AGV MQTT上报 → VDA5050适配器 → Kernel → BFF → SPA前端渲染
要求：每层数据格式说明，同时说明报文进入Kernel后触发的内部业务副作用

## 八、强制输出约束规则
1. 自动忽略所有测试代码、构建输出目录、第三方依赖库代码，不纳入分析
2. 全文统一使用中文，严格Markdown结构化排版，增量追加写入docs/project-manual.md，不覆盖已有内容
3. 仅输出手册正文，不额外增加闲聊、解释类文字；阶段完成后固定输出阶段完成提示文本
```

