
[toc]
***

chat:
https://github.com/niejinci/opentcs/tasks/a36bcb8a-c953-4d24-a0ad-55cf80002607?author=niejinci

以下是为您重新格式化后的 Markdown 记录：

---

在选择前，我先补充一些 it-rcs 的情况以帮助你确认需要澄清的事情：

我们通过 web 页面访问 it-rcs 系统（系统后台对我们来说是黑盒），在页面创建订单下发给 AGV。

在创建订单前，我们把地图包上传到 it-rcs，然后在地图管理功能页面编辑地图，在地图上画点（路径标点，工位点，充电点，休息点）。

编译地图，保存，下载后的地图包里面的文件：
```text
SS27.feature
SS27.json
SS27.pgm
SS27.png
SS27.yaml
SS27.yaml.lxmap
```
其中 `SS27.json` 和 `SS27.yaml.lxmap` 是编辑地图后生成的文件，其他的是用 AGV 扫描工厂生成的地图文件。

地图包文件存放路径: [https://github.com/niejinci/opentcs/tree/master/SS27](https://github.com/niejinci/opentcs/tree/master/SS27)

其中 **外部下发完整请求报文** 中的 `endPointCode` 在 `SS27.yaml.lxmap` 中找到如下：
```text
Cairn: Goal 1638 Goal_KpE5D "" "" -74.9294 40.033 0 0 0 7 0 "" "0,0,0" "0,0,0" "0" "1" 0 0 0 0 0 0
Cairn: Goal 1697 Goal_FM2q4 "" "" -68.0984 40.033 0 0 0 7 0 "" "0,0,0" "0,0,0" "0" "1" 0 0 0 0 0 0 {"quadrant_divide_angle":"0,90,180,270","use_vda5050_rotate_avoid":0}
```
**注意：**
`Goal_KpE5D` 的坐标跟 `nodePosition` 的坐标不一致，是因为，两个订单数据对应地图位置不一样，场景是一样的。

it-rcs 上的编辑地图界面：
`SS27.png`

---

## Enhancing map management and order creation in it-rcs
*耗时: 3m 33s*

完美 —— 三个澄清问题的答案全部从仓库实际文件里读出来了，比预期最理想的情况还要好。下面是直接结论。

### 三个澄清问题 · 全部澄清完毕（基于仓库 SS27/ 实际文件）

#### Q1（点位元数据是否已离散化）：✅ 100% 已离散，标准格式
`SS27.yaml.lxmap` 是业界知名的 SEER Robotics LX-MAP 文本格式（仙工/中国主流 AGV 厂商通用），ASCII 行式，1473 行 Cairn 记录：

| Cairn 类型 | 数量 | 含义 |
| :--- | :--- | :--- |
| **Goal** | 543 | 离散点位（路径标点/工位点/充电点/休息点/对接点/滚筒点 6 类，跟你截图里的下拉菜单一致） |
| **Route** | 930 | 显式有向边（一对正反向通常各一条） |

**Goal 行字段格式（25 个字段 + 末尾可选 JSON）**
```text
Cairn: Goal <id> <code> "<别名>" "<描述>" <x_米> <y_米> <theta_弧度> <isWorkstation> <?> <?> <?> "<?>" "<入栈拆分量x,y,θ>" "<出栈拆分量x,y,θ>" "<对接方向>" "<允许停车>" 0 0 0 0 0 0 {可选JSON属性}
```
对应你截图的右侧属性面板：x/y 坐标、方向、类型、入栈/出栈拆分量、允许停车、旋转避开方位分割角度…全部能定位到字段。

**实例（订单里出现的两个 Goal）：**
```text
Cairn: Goal 1638 Goal_KpE5D "" "" -74.9294 40.033 0 0 0 7 0 "" "0,0,0" "0,0,0" "0" "1" 0 0 0 0 0 0
Cairn: Goal 1697 Goal_FM2q4 "" "" -68.0984 40.033 0 0 0 7 0 "" "0,0,0" "0,0,0" "0" "1" 0 0 0 0 0 0 {"quadrant_divide_angle":"0,90,180,270","use_vda5050_rotate_avoid":0}
```
你提到的 "`Goal_KpE5D` 坐标 -74.9294,40.033 跟订单 JSON 29.02,2.12 不一致 / 同名异图" 已收到，明白：SS27/ 是另一张样例地图，订单 JSON 来自另一张地图。这不影响方案——格式完全相同。

#### Q2（通行关系是否显式）：✅ 完全显式 + 双向独立
**Route 行格式：**
```text
Cairn: Route <id> <fromGoalId> <toGoalId> <x1> <y1> <x2> <y2> <?> <速度?> ... {path_width, cost, empty_cost, full_cost, *_safety_distance, is_back, ...}
```
**样例（同一对点的双向各 1 条 → 与 openTCS Path 单向语义完美 1:1 对应）：**
```text
Cairn: Route 377 227 187 86.2789 118.3442 86.2789 115.9646 0 0.5 ... {forward_safety_distance:0.5, path_width:100, cost:1, ...}
Cairn: Route 378 187 227 86.2789 115.9646 86.2789 118.3442 0 0.5 ... {forward_safety_distance:0.5, ...}
```
JSON 尾部给的字段直接可填到 openTCS：
*   `cost`/`empty_cost`/`full_cost` → 路由代价（写入 `Path.properties`）
*   `*_safety_distance`（前/后/左/右）→ 跟订单 JSON 里的 `edges[].security.avoid` 同语义（写入 `Path.properties` 或映射到 `Envelope`）
*   `path_width` → 通行宽度（→ `Path.properties` 或 `BoundingBox` 校验）
*   `is_back` → 倒车标志（→ `maxReverseVelocity > 0`）
*   `速度`（第 9 字段 0.5 m/s = 500 mm/s）→ `Path.maxVelocity = 500`

#### Q3（PNG 坐标系参数）：✅ SS27.yaml 给出全部参数（标准 ROS map_server 格式）
```yaml
%YAML:1.0
image: "SS27.pgm"
resolution: 0.05             # 米/像素 → openTCS VisualLayout.scaleX = scaleY = 50.0 mm/pixel
origin: [-195.2, -33.6, 0]   # PNG 左下角对应的世界坐标 (米)；z 旋转=0
negate: 0
occupied_thresh: 0.65
free_thresh: 0.196
```
**像素 → 世界（米）公式（标准 ROS 定义）：**
```java
world_x_m = origin.x + px_x * resolution
world_y_m = origin.y + (img_height_px - px_y) * resolution     // 注意 y 轴翻转
```
**→ openTCS Triple (mm)：**
```java
tcs_x_mm = round(world_x_m * 1000)
tcs_y_mm = round(world_y_m * 1000)
```

### 因此：方案最终确定
走 **方案 A（元数据 ETL）**，且工作量比第 1 轮估计的还要少——因为：

1.  元数据是一行一记录的标准 ASCII 文本，正则 / 简单 split 即可解析（不需要数据库连接、不需要专有 SDK）；
2.  Routes 已经显式存在且双向分开 → 直接 1:1 翻译为 openTCS Path，完全跳过第 1 轮提到的 "自动生成 + 人工审核 Path" 工序；
3.  PNG 元数据是 ROS 标准 map_server `.yaml` → 像素↔世界坐标换算公��是公开的、零猜测；
4.  lxmap 格式是社区已知规范（SEER Robotics 公开的 SRC 控制器地图），可以放心写解析器。

→ 整个 PNG 接入工作转化为 1 个独立 Java 模块：
```text
opentcs-tools-itrcs-importer/
├── parser/        // SeerLxMapParser (Goal/Route 行解析) + RosMapYamlParser
├── ir/            // ItRcsMapPackage = {goals[], routes[], yaml(scale/origin)}
├── mapping/       // GoalToPointMapper / GoalToLocationMapper / RouteToPathMapper
└── exporter/      // V7PlantModelToWriter （JAXB → model.xml）
```
预计工作量：3-5 工作日（含单元测试 + 用 SS27 真实数据跑通端到端）。

### 顺便对第 1 轮的几条结论做修订

| 第 1 轮的判断 | 修订后的判断 |
| :--- | :--- |
| "需要确认通行关系是否显式" | ✅ **已确认**：完全显式（930 条 Route），无需任何路径推断算法 |
| "通行关系若不显式则要图像处理 + 半人工" | ❌ **整条方案 B 路线作废**，永远不需要 |
| "Q3：m/pixel 与原点要核对" | ✅ **已确认**：标准 ROS yaml，`resolution=0.05`、`origin=[-195.2,-33.6,0]` |
| "Goal 类型只能区分 HALT/PARK + Location 区分工艺" | ✅ **进一步细化**：lxmap 第 10 字段已经标记是否工位点（1=工位/0=路径标点），可直接驱动是否生成 Location；`quadrant_divide_angle` 等 JSON 属性整体写入 properties |
| "需要把 PNG 单独搬到 PlantOverview 当背景" | **不变** — 但用户 PNG/PGM 文件已经在仓库 SS27/，直接拷贝即可，无需任何转换 |

### 下一步建议（请你二选一回复）

*   **选项①（推荐 ⭐）：「现在就开始第 2 轮：订单体系对比 + 逐字段映射表」** → 我会基于 `TransportOrder.java` / `DriveOrder.java` / Web API Schema 源码，把：
    *   it-rcs `taskChain` + `tasks[]` 下单报文
    *   AGV 订阅的 VDA 5050 nodes/edges/actions
    *   openTCS `TransportOrder` + `DestinationCreationTO`
    *   lxmap Goal/Route → PlantModel Point/Path/Location
    四套数据结构画一张完整逐字段映射大表（含你最关心的拆分点位、pick/drop、loadType/loadId 等业务字段如何落到 openTCS properties）。
*   **选项②：「先把 SS27 的 PoC importer 代码骨架在仓库里建起来（方案 A 工程化）」** → 我创建 `opentcs-tools-itrcs-importer/` 模块，实现 lxmap 解析器 + V7 PlantModelTO 输出，用 SS27 实际数据生成一份可直接被 openTCS Kernel 加载的 `model.xml`，附单元测试。然后第 2 轮再做映射表。
*   **选项③：「两个并行做：你先回选项①的映射表，让我同时确认无误，然后再做选项②的代码」** → 推荐给注重风险控制的同学（先有"地基"映射表 → 再写代码不返工）。

你选哪个？

---

**User:**
在选择之前，我想让你先回答另一个问题：

在【行业典型系统架构图】说到，用户通过 web browser 来创建订单跟 opentcs kernel 交互。我想让你从宏观一点的角度来说明(方案)：使用 web browser 创建订单，发送请求给 opentcs, opentcs 处理请求后，发出订单数据给 mqtt broker, 整条链路的数据流转、数据格式变化、涉及的核心文件 / 模块。

请围绕以下流程，说明数据变化 + 涉及文件 / 模块 + 存储格式 + 调用关系：
1. AGV 扫描工厂生成地图文件(pgm, yaml, png)
2. 在 web browser(是否需要对应的独立后台服务，或者是 opentcs 的一个http 模块)，上传地图文件
3. 编辑地图文件，创建各种类型的点(工位点，路径标点...)，保存。保存后，这些工位点以什么格式保存在什么文件？被谁用到?
4. 创建订单，根据实际的订单场景，选择不同类型的点，构成订单，然后提交订单。这个订单请求数据是该是什么样的？订单数据进入 opentcs 时是什么样的？从 opentcs 出来到进入 vda5050 commAdapter 时是什么样的？从 vda5050 commAdapter 出来时是什么样的？

---

## Implementing order creation via web browser with opentcs
*耗时: 4m 30s*

我已掌握足够信息。直接给完整答案——这是分析/说明请求，不改代码。

### openTCS 架构总览：Web Browser → openTCS → MQTT(VDA 5050) 全链路数据流转

#### 0. 先把 5 个关键事实摆出来（防止被误导）

| # | 事实 | 仓库证据 |
| :- | :--- | :--- |
| 1 | openTCS **没有内置 Web 前端**。Browser 是用户自建/第三方的 SPA，Kernel 只暴露 REST API（Javalin） | `opentcs-kernel-extension-http-services/.../v1/V1RequestHandler.java`（行 191-214 全是 post/get/put） |
| 2 | openTCS **没有内置地图编辑器 Web 版**。地图编辑用的是 **桌面应用** `opentcs-modeleditor`（Swing），保存为 `model.xml` | `opentcs-modeleditor/`，`opentcs-common/.../persistence/v7/V7PlantModelTO.java`，schema `model-7.0.0.xsd` |
| 3 | openTCS **没有内置 VDA 5050 commadapter**，也没有 MQTT 连接。仓库里只有 loopback 适配器（虚拟车辆） | `opentcs-commadapter-loopback/.../virtualvehicle/`；社区项目 `opentcs-commadapter-vda5050` 是独立 GitHub repo |
| 4 | AGV 扫描产生的 `.pgm`/`.png`/`.yaml` **不被 openTCS Kernel 使用**。Kernel 只认拓扑（Point/Path/Location），栅格图最多作为 PlantOverview 的"背景图层"显示 | `V7VisualLayoutTO` 仅持久化 `scaleX`/`scaleY`/`layers`，无 `image` 字段 |
| 5 | Kernel 内部 `TransportOrder` 经 Router/Scheduler 拆成一系列 `MovementCommand`(=Route.Step + operation) 才发给 commadapter | `opentcs-api-base/.../drivers/vehicle/MovementCommand.java`（字段：`step` / `operation` / `opLocation` / `finalDestination` / `finalOperation`） |

---

#### 1. 阶段 1：AGV 扫描工厂生成栅格地图
```text
AGV 雷达扫描 ──→ 厂商 SLAM 软件（it-rcs/SEER/Cartographer/...） ──→ 标准 ROS map_server 三件套
                                                                  ├── SS27.pgm   占用栅格(灰度)
                                                                  ├── SS27.png   预览图
                                                                  └── SS27.yaml  metadata: resolution/origin/thresholds
```
**与 openTCS 的关系：零关系。** openTCS Kernel 的世界里只有图（拓扑），没有像素地图。
*   这套文件不进入 Kernel 流转通道；
*   仅在 PlantOverview/ModelEditor 里作为 `BitmapFigure` 视觉背景层（`opentcs-modeleditor`），方便人在画 Point/Path 时对照真实工厂尺寸；
*   像素↔毫米换算：`world_mm = (origin + px·resolution) · 1000`；写入 `VisualLayout.scaleX/scaleY = resolution·1000`。

所以第 1 步的产物在 openTCS 体系里只是"画图时的描红纸"——不是数据源。真正的数据源是后续人工/导入工具产出的拓扑图。

---

#### 2. 阶段 2：上传地图文件到 Web —— openTCS 不提供这个功能
这是 it-rcs 系统的能力，openTCS 没有对应的 HTTP endpoint。`V1RequestHandler.java` 全部端点里没有 `multipart/form-data` 上传接口，没有 `/maps`、`/upload` 之类路径。

→ 如果要在你的方案里实现"Web 上传栅格图"，有 3 种做法：

| 方案 | 做法 | 典型选型 |
| :--- | :--- | :--- |
| **A 独立后台** | 自建 Spring Boot/Node 服务接收上传，存 OSS/磁盘，自己做地图编辑 SPA，编辑完成后调 openTCS REST `PUT /v1/plantModel` 推拓扑给 Kernel | **推荐** ——职责清晰 |
| **B 写 openTCS Kernel 扩展** | 实现 KernelExtension，注册新的 Javalin 路由（参考 ServiceWebApi 怎么注册）。把上传/编辑能力做成 Kernel 扩展模块 | 与 Kernel 耦合，部署简单 |
| **C 仅用桌面 ModelEditor** | 完全不要 Web，运维人员用 `opentcs-modeleditor` 桌面应用，背景图通过菜单加载 PNG，画完保存 `model.xml` | 最贴合 openTCS 原生用法 |

**关键结论：** openTCS 的 Web API 不是"地图管理"接口，而是"运行期"接口 —— 拓扑模型应该在编辑期定型，Web 只用来下订单、查状态。

---

#### 3. 阶段 3：编辑地图、画点、保存 —— 拓扑数据如何落地

**3.1 数据模型（运行期，内存里的领域对象）**
位于 `opentcs-api-base/src/main/java/org/opentcs/data/model/`：

| 类型 | 含义 | 对应 it-rcs 概念 |
| :--- | :--- | :--- |
| **Point** | 拓扑节点（HALT_POSITION / PARK_POSITION / REPORT_POSITION），含 Triple position(mm)、pose.orientationAngle | "路径标点"、"休息点" |
| **Path** | 有向边，含 sourcePoint/destinationPoint、length、maxVelocity、maxReverseVelocity、Envelope（占用包络） | it-rcs 的 Route + 安全宽度 |
| **Location + LocationType** | 工艺站点（pick/drop/charge），通过 Link 挂在某个 Point 上；allowedOperations 决定能做什么动作 | "工位点"、"充电点" |
| **Block** | 互斥资源块（多车不可同时进入） | 路径锁区域 |
| **VisualLayout** | 视觉信息（scaleX/scaleY、图层、点位的可视坐标） | 编辑器背景图缩放 |

**3.2 持久化格式：model.xml（XML，JAXB 序列化）**
*   **Schema：** `opentcs-common/src/main/resources/org/opentcs/util/persistence/model-7.0.0.xsd`（当前 V7 ）
*   **序列化类：** `opentcs-common/.../persistence/v7/V7PlantModelTO.java` + `V7TOMapper`、`V7ModelParser`
*   **写盘者：** `opentcs-kernel/src/main/java/org/opentcs/kernel/persistence/XMLFileModelPersister.java`
*   **默认路径：** `<kernel-home>/data/model.xml`
*   **接口：** `ModelPersister.saveModel(PlantModelCreationTO)` / `readModel()`

**3.3 谁写入 model.xml？两条路径**
```text
路径①（人工编辑）
  ┌─────────────────────────────┐
  │ opentcs-modeleditor (Swing) │
  │  ModelComponent ──▶ TO ──▶ JAXB ──▶ data/model.xml
  └─────────────────────────────┘
            │ 拷贝/上传
            ▼
   Kernel 启动时 XMLFileModelPersister.readModel() 加载

路径②（API 推送 —— 这条更适合"从 it-rcs 元数据自动生成"）
  外部程序（你的 importer）
       │ HTTP PUT
       ▼
  /v1/plantModel  →  PlantModelHandler.putPlantModel()
       │
       ▼
  StandardPlantModelService.createPlantModel(PlantModelCreationTO)
       │
       ├─▶ 写入运行时模型（内存）
       └─▶ XMLFileModelPersister 持久化到 model.xml
```

**3.4 对应到你截图右侧"工位点属性面板"的字段**

| ITRCS 字段 | 落到 openTCS 的什么字段 |
| :--- | :--- |
| 编号 `Goal_anICQ` | `Point.name` 或 `Location.name` |
| x/y 坐标(米) | `Point.position = Triple(x*1000, y*1000, 0) mm` |
| 方向 | `Point.pose.orientationAngle` (度) |
| 类型(路径标点/工位点/充电点/休息点...) | 路径标点→`Point.type=HALT_POSITION`；工位/充电→建 Location+Link；休息点→`Point.type=PARK_POSITION` |
| 入栈/出栈拆分量、对接方向、旋转避方位 | 全部写入 `Point.properties` / `Location.properties`（Map<String,String> 转 JSON 单字符串） |
| 允许停车 | `Point.type` 是否为 `PARK_POSITION` |
| 背负/空车安全加宽 | `Path.envelopes` 里的 EnvelopeKey 多组包络，或写 properties |

**3.5 谁来用这些点？**
```text
model.xml ──读取──▶ Kernel 内 PlantModelService （内存领域模型）
                           │
                           ├──▶ Router  （Dijkstra 算路）
                           ├──▶ Scheduler（资源/Block 抢占）
                           ├──▶ Dispatcher（订单→车辆分派）
                           ├──▶ PlantOverview/操作台 SSE 实时显示
                           └──▶ commadapter（生成 MovementCommand 时引用 step.path/destinationPoint）
```

---

#### 4. 阶段 4：创建订单 → MQTT 全链路（核心）

**4.1 第①跳：Browser ➜ Kernel HTTP API**
*   **协议：** HTTP POST `/v1/transportOrders/{NAME}`，Content-Type: `application/json`
*   **Handler：** `opentcs-kernel-extension-http-services/.../v1/V1RequestHandler.java#handlePostTransportOrder`
*   **JSON Schema：** `PostTransportOrderRequestTO`（同包 binding/），核心字段：
```json
{
  "incompleteName": false,
  "dispensable": false,
  "deadline": "2026-04-30T12:00:00Z",
  "intendedVehicle": "AGV-01",     // 可选：指定车
  "type": "Transport",              // 订单类型，Vehicle.acceptableOrderTypes 过滤
  "destinations": [                 // ★关键：有序站点序列，每个=一个 DriveOrder
    { "locationName": "Loc-Pick-A",  "operation": "Load",  "properties": [...] },
    { "locationName": "Loc-Drop-B",  "operation": "Unload" }
  ],
  "properties":   [ {"key":"orderId","value":"WMS-1234"} ],
  "dependencies": [ "ORDER-PRE-1" ]
}
```
**注意：** `destinations[*].locationName` 必须是已存在于 PlantModel 的 Location 名（或 Point 名作为 MOVE 目的地）。`operation` 必须落在该 Location 关联 LocationType 的 `allowedOperations` 里。这就是为什么阶段 3 的 Location 必须先建好。

**绑定 → 转换流程：**
```text
PostTransportOrderRequestTO（DTO，REST 边界类）
        │ TransportOrderHandler#createOrder()
        ▼
TransportOrderCreationTO（API 层 TO，opentcs-api-base/access/to/order/）
        │ KernelExecutorWrapper（保证 kernel 单线程执行）
        ▼
TransportOrderService.createTransportOrder(TransportOrderCreationTO)
        │ kernel 内
        ▼
TransportOrder（领域对象，opentcs-api-base/data/order/） 
   │
   └─ 内部展开为 List<DriveOrder>，每个 DriveOrder.destination = (Location, operation)
```

**4.2 第②跳：Kernel 内部 —— Dispatcher / Router / Scheduler**
```text
TransportOrder (RAW)
   │ DefaultDispatcher  （opentcs-strategies-default）
   │   - 根据 type/intendedVehicle/能量等挑车
   ▼
为车辆 V 分派该 order
   │ DefaultRouter.getRoute(V, currentPoint, destinationPoint)
   │   - Dijkstra 找最短路径
   ▼
DriveOrder.route = Route                    ← Route = 一串有序的 Route.Step
                       │                       Step = (Path? sourcePoint→destPoint, Vehicle.Orientation, costs)
                       │
                       ▼
DefaultScheduler 校验/抢占资源（Block/Path/Point 锁）
   │
   ▼
依次构造一个个 MovementCommand 推到该车 commadapter 的命令队列
```
`MovementCommand` 字段（`opentcs-api-base/.../drivers/vehicle/MovementCommand.java`）：
```java
step                 : Route.Step          // 这一段的 Path/Point + 方向 + 代价
operation            : String              // 到达这一步后做的操作（"Load"/"Unload"/"NOP"/"MOVE"/"PARK"）
opLocation           : Location            // 操作所在 Location（如果 operation 非空）
finalDestination     : Point               // 整个 DriveOrder 的最终目标点
finalDestinationLocation, finalOperation
properties, transportOrder
```
这就是从 openTCS 出来、即将进入 commadapter 的标准协议 —— 与具体车辆通信协议完全无关。

**4.3 第③跳：commadapter（VDA 5050）—— openTCS↔车辆的"翻译器"**
*注意：本仓库没有这个适配器，它是社区单独项目 openTCS-commadapter-vda5050。把它装进 Kernel 后才有 MQTT。*
```text
                       MovementCommand 序列
                              │
                              ▼
          VDA5050CommunicationAdapter#sendCommand(MovementCommand)
              │
              │  内部状态机：把多条 MovementCommand 累加 / 拼接成一条 VDA 5050 Order
              │  - 同一 order_id（=openTCS TransportOrder 名）
              │  - order_update_id 递增
              │  - nodes[] = step.destinationPoint 序列（带 nodePosition x/y/theta）
              │  - edges[] = step.path 序列（含 maxSpeed、orientation、trajectory）
              │  - actions[] = 把 operation/location 翻译成 VDA 5050 action
              │      ("Load"→pick, "Unload"→drop, "NOP"→无, 也可定制 mapping)
              ▼
          VDA 5050 Order（JSON，符合 vda5050/order schema 2.0.0）
              │  Jackson 序列化
              ▼
          MQTT publish to topic: <interfaceName>/v2/<manufacturer>/<serialNumber>/order
              │
              ▼
        MQTT Broker (EMQX/Mosquitto/HiveMQ ...)
              │
              ▼
        AGV (订阅相同 topic)
```
**反向：** AGV 周期性发布 state 消息（同 topic 前缀 `/state`）→ commadapter 订阅 → 转成 `VehicleProcessModel` 状态变更 → Kernel 看到 `Vehicle.position/state/energyLevel` 更新 → 通过 SSE `/v1/events` 推回 Browser。

---

#### 5. 一张全链路总图（数据格式 / 文件 / 模块）
```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ 编辑期（一次性 / 偶尔变更）                                                       │
│                                                                               │
│  AGV SLAM 扫描 → SS27.pgm/.png/.yaml  ─┐                                       │
│                                         │ (仅做背景图)                          │
│  人工或自建 importer                     ▼                                      │
│  ─────────────────────►  opentcs-modeleditor (Swing, 桌面)                     │
│      或 PUT /v1/plantModel  ───────►   PlantModelHandler                       │
│                                         │                                      │
│                                         ▼                                      │
│                              StandardPlantModelService                         │
│                                         │                                      │
│                                         ▼                                      │
│                       data/model.xml  (XML, schema model-7.0.0.xsd)            │
│                       —— Point / Path / Location / Block / VisualLayout        │
└──────────────────────────────────────────────────────────────────────────────┘
                                         │ Kernel 启动加载
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 运行期                                                                         │
│                                                                               │
│  Browser (你的 SPA)                                                            │
│      │ HTTP POST  /v1/transportOrders/{NAME}                                  │
│      │ Content-Type: application/json                                         │
│      │ Body = PostTransportOrderRequestTO                                     │
│      ▼                                                                        │
│  V1RequestHandler.handlePostTransportOrder                                    │
│      │   (Javalin route 注册：opentcs-kernel-extension-http-services)         │
│      ▼                                                                        │
│  TransportOrderHandler  →  TransportOrderCreationTO  →  TransportOrderService │
│      │                                                                        │
│      ▼                                                                        │
│  TransportOrder (领域对象, in-memory) ── 拆 ──► List<DriveOrder>              │
│      │                                                                        │
│      ▼                                                                        │
│  DefaultDispatcher 选车  →  DefaultRouter 算 Route                            │
│      │                                                                        │
│      ▼                                                                        │
│  DefaultScheduler 资源抢占                                                     │
│      │                                                                        │
│      ▼ 逐步生成                                                                │
│  MovementCommand  (step, operation, opLocation, finalDestination, ...)        │
│      │                                                                        │
│      ▼ VehicleCommAdapter#sendCommand                                         │
│  ┌─────────────────────────────────────────────────┐                          │
│  │ VDA 5050 commadapter (社区独立模块, 非本仓库)    │                          │
│  │                                                  │                          │
│  │  MovementCommand 序列 → 拼装为 VDA 5050 Order   │                          │
│  │      JSON {orderId, orderUpdateId, nodes[],     │                          │
│  │            edges[], actions[]}  schema 2.0.0    │                          │
│  └─────────────┬───────────────────────────────────┘                          │
│                │ MQTT publish                                                  │
│                ▼                                                               │
│  MQTT Broker (EMQX 等)                                                         │
│      topic: uagv/v2/<manufacturer>/<serial>/order                              │
│                │                                                               │
│                ▼                                                               │
│              AGV                                                               │
│                │ MQTT publish state                                            │
│                ▼                                                               │
│  commadapter 订阅 state → 更新 VehicleProcessModel                             │
│      │                                                                        │
│      ▼                                                                        │
│  Kernel 通过 SSE 推送 /v1/events  →  Browser 实时刷新                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

#### 6. 各阶段数据形态速查表

| 阶段 | 数据形态 | 类型/类 | 文件/通道 |
| :--- | :--- | :--- | :--- |
| **AGV 扫描** | 灰度栅格 + ROS metadata | binary + YAML | `*.pgm` `*.png` `*.yaml` |
| **编辑期落地** | 拓扑模型 XML | `V7PlantModelTO`(JAXB) | `data/model.xml` (schema `model-7.0.0.xsd`) |
| **API 推送拓扑** | JSON | `PlantModelTO` (REST DTO) → `PlantModelCreationTO` (API TO) | HTTP `PUT /v1/plantModel` |
| **创建订单（Browser→Kernel）** | JSON | `PostTransportOrderRequestTO` | HTTP `POST /v1/transportOrders/{NAME}` |
| **Kernel 接收** | Java 对象 | `TransportOrderCreationTO` → `TransportOrder` + `List<DriveOrder>` | 内存 |
| **Router 算路后** | Java 对象 | `Route` (`List<Route.Step>`) | 内存 |
| **发给 commadapter** | Java 对象 | `MovementCommand` | `VehicleCommAdapter#sendCommand` |
| **commadapter→AGV** | JSON | VDA 5050 Order v2.0.0 | MQTT topic `…/order` |
| **AGV→commadapter** | JSON | VDA 5050 State / Visualization | MQTT topic `…/state` |
| **Kernel→Browser** | JSON (SSE) | `GetEventsResponseTO` | HTTP `GET /v1/events`（SSE） |

---

#### 7. 关键文件 / 模块 一览

| 模块 | 作用 |
| :--- | :--- |
| `opentcs-api-base` | 领域对象 (`TransportOrder`/`DriveOrder`/`Point`/`Path`/`Location`/`MovementCommand`)，TO (`TransportOrderCreationTO`/`PlantModelCreationTO`)，commadapter SPI (`VehicleCommAdapter`) |
| `opentcs-common` | 持久化 schema + JAXB TO（`v7/V7PlantModelTO`、`model-7.0.0.xsd`、`V7ModelParser`） |
| `opentcs-kernel` | Kernel 主体；`persistence/XMLFileModelPersister`；`services/StandardPlantModelService`、`StandardTransportOrderService` |
| `opentcs-kernel-extension-http-services` | REST API（Javalin）；`v1/V1RequestHandler`、`TransportOrderHandler`、`PlantModelHandler`、`binding/PostTransportOrderRequestTO` 等 |
| `opentcs-kernel-extension-rmi-services` | 桌面工具（PlantOverview/OperationsDesk/ModelEditor）连 Kernel 用的 RMI 通道 |
| `opentcs-strategies-default` | Dispatcher / Router / Scheduler 默认实现 |
| `opentcs-modeleditor` | 桌面地图编辑器（Swing） |
| `opentcs-operationsdesk` | 桌面运行监控台 |
| `opentcs-commadapter-loopback` | 仓库内自带的虚拟车（仅供测试） |
| **(外部)** `openTCS-commadapter-vda5050` | 社区独立 GitHub 项目 —— 把 `MovementCommand` ↔ VDA 5050 JSON ↔ MQTT 真正连起来 |

---

#### 8. 给你的方案落点（结合 it-rcs 场景）
要把"工厂用 it-rcs"换成"工厂用 openTCS+VDA5050 AGV"，需要做的事：

1.  **地图迁移（一次性）：** 写 it-rcs → openTCS importer，读 `SS27.yaml.lxmap` + `SS27.yaml`，输出 `PlantModelCreationTO`，调 `PUT /v1/plantModel` 或直接生成 `model.xml`。栅格 PNG 仅作 PlantOverview 背景。
2.  **Web 前端��自建，独立后台）：** 你自己的 Browser 应用，调用 openTCS REST `POST /v1/transportOrders/{NAME}` 下单，订阅 `GET /v1/events` SSE 看状态。openTCS 不提供这个 SPA，需要你自己开发。
3.  **接入 VDA 5050 AGV：** 在 Kernel 里安装社区版 `openTCS-commadapter-vda5050`，配置 MQTT broker、manufacturer、serial。Kernel 内核完全无需修改。
4.  **业务字段透传：** it-rcs 订单里那些 loadType/loadId/wmsOrderId 等业务字段，统一以 `properties[]` 方式带过来 → 进 `TransportOrder.properties` → commadapter 取出来塞进 VDA 5050 action 的 `actionParameters[]`。

如果以上整体说明 OK，下一步我建议是：给 Round 2 —— 把第 1 章三种"创建订单方"的 schema（it-rcs 下单报文 / openTCS PostTransportOrderRequestTO / VDA 5050 Order）做一张逐字段对照大表，让你看到每一个业务字段从 Browser 到 AGV 是怎么流过去的。需要现在就出这张表吗？

**User:**
第三方的 SPA 中的 SPA 是什么意思？

【2. 阶段 2：上传地图文件到 Web】，我计划采用 **方案 A 独立后台** , 不使用 桌面 ModelEditor。

关于【地图迁移（一次性）：写 it-rcs → openTCS importer，读 SS27.yaml.lxmap + SS27.yaml，输出 PlantModelCreationTO，调 PUT /v1/plantModel 或直接生成 model.xml。栅格 PNG 仅作 PlantOverview 背景。】：

`SS27.yaml.lxmap` 是 it-rcs 编辑地图保存后生成的文件。

不用 model editor, 因此没有 栅格 PNG 仅作 PlantOverview 背景 的说法了。

`model.xml` 是 opentcs 的工厂模型文件吗？

Web 前端（自建，独立后台）：我们在编辑地图后，需要保存独立的 `SS27.yaml.lxmap` 文件吗？如果保存了 `SS27.yaml.lxmap` 文件，是不是也要把编辑的点信息同步到对应的 opentcs 的工厂模型文件？

---

## Uploading map files in phase 2 with independent backend
*耗时: 2m 11s*

这些是问答，无需改代码。直接回答：

### 1. SPA 是什么？
SPA = **Single Page Application（单页应用）**。

**特征：**
*   浏览器只加载一次 HTML/JS/CSS，之后页面切换、数据更新都通过 JS + REST/WebSocket/SSE 在前端完成，不再整页刷新。
*   典型技术栈：React / Vue / Angular / Svelte，配合 axios/fetch 调后端 REST。

在你这个场景里，"SPA" 就是指 **你自己用 Vue/React 写的那个 Web 控制台**——画地图、下订单、看车辆状态都在这个前端里完成，它通过 HTTP 调 openTCS Kernel 的 `/v1/...` REST 接口。
与之对应的旧模式叫 MPA（Multi Page Application），每点一次链接服务端就重新渲染一整页 HTML（典型如老的 JSP/PHP 站点）。

### 2. 选定"方案 A 独立后台"——确认架构
OK，那你的整体部署形态就是：

```text
┌──────────────┐     HTTPS/WS     ┌────────────────────────┐    HTTP    ┌──────────────────┐
│   Browser    │ ───────────────▶ │  你的独立后台 (Spring  │ ─────────▶ │ openTCS Kernel   │
│  (你的 SPA)  │ ◀─────────────── │   Boot / Node / Go)    │ ◀───────── │ (Javalin REST)   │
└──────────────┘                  │                        │            │                  │
                                  │ - 用户/权限/审计       │            │ - PlantModel     │
                                  │ - 地图工程管理(多版本) │            │ - TransportOrder │
                                  │ - 上传/编辑/导入       │            │ - Dispatch/Route │
                                  │ - 业务订单(WMS/MES 对接)│            │ - commadapter    │
                                  │ - DB(MySQL/PG)         │            └─────────┬────────┘
                                  └────────────────────────┘                      │ MQTT
                                                                                  ▼
                                                                           VDA 5050 / AGV
```
这是工业项目最常见的模式。优点：
*   **职责隔离**：openTCS Kernel 只做"运行期调度"，不管用户/权限/工程版本。
*   **不污染 Kernel**：升级 openTCS 不影响你的业务后端。
*   **可复用 Java 生态**：WMS/MES/工单系统都接你的后端，由它统一翻译给 Kernel。
*   **多工厂/多模型管理**：你后端可以维护多个地图版本，按需推送给某台 Kernel。

### 3. 关于地图迁移说法的更正
完全同意你的两点更正：

*   ✅ `SS27.yaml.lxmap` 是 it-rcs 自己的工程文件（包含点位/路径/属性等业务语义），不是 ROS `map_server` 的标准 yaml。所以更准确的描述是：
    *"读 it-rcs 的 `*.lxmap`（业务拓扑）+ 必要时附带的 `*.yaml`/`*.pgm`（栅格） → 转成 openTCS 的 `PlantModelCreationTO` → `PUT /v1/plantModel`。"*
*   ��� **不用 ModelEditor 桌面端，就没有"栅格 PNG 作背景"的事。** 栅格 `.pgm` / `.png` 在你的方案里只用在你自己 SPA 的画布里做底图渲染（前端 canvas/svg 直接加载图片即可），跟 openTCS 完全无关。Kernel 从头到尾不知道也不需要知道这些图片存在。

**一句话总结：** 在方案 A 下，栅格图是你 SPA 自己的事，拓扑模型才是要同步给 Kernel 的事��

### 4. model.xml 是 openTCS 的工厂模型文件吗？
**是的。** 它是 openTCS Kernel 的"工厂模型"持久化文件，是 Kernel 启动后整个运行世界的来源。

*   **位置：** 默认 `<kernel-home>/data/model.xml`
*   **格式：** XML，JAXB 序列化
*   **Schema：** `opentcs-common/src/main/resources/org/opentcs/util/persistence/model-7.0.0.xsd`（当前 V7 版本）
*   **TO 类：** `opentcs-common/.../persistence/v7/V7PlantModelTO.java`
*   **读写者：** `opentcs-kernel/.../persistence/XMLFileModelPersister.java`
*   **内容：** 所有 Point / Path / Location / LocationType / Block / Vehicle / VisualLayout 及其属性。

两条写入路径都最终落到同一个 `model.xml`：

| 入口 | 谁写 |
| :--- | :--- |
| **桌面 ModelEditor 保存** | ModelEditor → RMI → Kernel → `XMLFileModelPersister` |
| **REST `PUT /v1/plantModel`** | `PlantModelHandler` → `StandardPlantModelService` → `XMLFileModelPersister` |

*注意一个小细节：openTCS 的 `model.xml` 是 Kernel 的"当前生效模型"——它一次只装一个。如果你有多个工厂/多版本，需要在你自己后端做"工程仓库 + 推送"。*

### 5. 编辑后要不要保存 *.lxmap？要不要同步到 model.xml？
这是这次最关键的设计抉择。结论：

#### 5.1 推荐做法：只维护一份"权威源"，不要双写
把"权威源（source of truth）"集中到 **你自己后端的数据库 / 工程文件里**，例如：

```text
你后端 DB:  project(id, name, version, created_at, ...)
            map_layer(project_id, pgm_blob, png_blob, resolution, origin, ...)
            point(project_id, name, type, x_mm, y_mm, theta, properties_json, ...)
            path(project_id, src, dst, length, max_velocity, envelopes_json, ...)
            location(project_id, name, type, linked_point, allowed_ops, ...)
            ...
```
然后：

| 文件 | 是否保存？ | 谁来用？ |
| :--- | :--- | :--- |
| **你后端 DB 中的工程数据** | ✅ 保存（权威源） | 你的 SPA 编辑、版本管理、回滚 |
| **`*.lxmap`** | ❓ 不必须（见下） | 仅当你需要兼容/导出回 it-rcs 时 |
| **`*.pgm` / `*.png` / `*.yaml`(ROS)** | ✅ 保存为 blob/对象存储 | 你 SPA 画底图 |
| **openTCS `model.xml`** | ✅ 由你后端"发布"时通过 `PUT /v1/plantModel` 推���去 | Kernel 加载并运行 |

#### 5.2 关于 *.lxmap 的去留
问自己一个问题：之后还需要这个文件被任何 it-rcs 工具（编辑器/导入器/客户老系统）打开吗？
*   **不需要** → **不要保存 .lxmap**。一旦数据迁移到你的 DB，lxmap 就完成历史使命了，否则就要长期维护"双格式同步"的 bug 农场。
*   **需要**（例如客户要求保留旧编辑器作为回退） → 保存，但要明确单向流动：DB 是源 → 按需导出生成 .lxmap；不要反过来从 .lxmap 改回 DB。否则两个文件迟早分叉。

#### 5.3 关于 model.xml 的同步策略
把 `model.xml` 当成"Kernel 的运行时缓存/快照"，而不是"另一份要维护的源文件"：

```text
你 SPA 编辑 ──▶ 你后端 DB（权威）
                     │
                     │ 用户点【发布到 Kernel】按钮（或 CI 自动）
                     ▼
            后端把 DB 整体序列化为 PlantModelCreationTO (JSON)
                     │
                     │ PUT /v1/plantModel
                     ▼
            Kernel 内存模型更新 + 自动落 data/model.xml
```
**要点：**
*   **永远不要双向编辑 model.xml**：不要让运维/PlantOverview 也手改它，否则下一次发布就会被你 SPA 覆盖。
*   **发布是显式动作**：编辑过程不要每次小改动都推 Kernel，否则可能踢掉正在运行的车辆/订单。建议设"草稿/发布"两态。
*   **变更审计**：在你后端记录每次"发布"的 diff（点新增/删除/属性改了什么），方便排查现场问题。
*   **校验先行**：发布前在后端做一次完整性校验（Path 端点存在、Location 必须 Link 到 Point、allowedOperations 与订单类型匹配等），避免 Kernel 拒绝导致回滚混乱。
*   **运行中变更**：对正在跑车的工厂改点位风险高。openTCS 也提供 `POST /plantModel/topologyUpdateRequest`（见 `V1RequestHandler:210`）做"轻量拓扑更新"，但仍需谨慎。

#### 5.4 一句话回答你的问题
不必再保存 `.lxmap`（除非你要给 it-rcs 老工具回吐）；编辑结果存进你自己后端的 DB，再由后端"发布"按钮把它转成 `PlantModelCreationTO` 并 `PUT /v1/plantModel`，Kernel 会自动更新内存模型并落到它自己的 `data/model.xml`。`model.xml` 不归你 SPA 维护，它是 Kernel 内部的快照。

需要的话，下一步我可以给你画一张"你后端 DB 表 ↔ openTCS PlantModel 字段"的对照映射表，作为 importer/发布器的开发蓝图。需要现在就出吗？

---

**User:**
前面说到: *关键结论：openTCS 的 Web API 不是"地图管理"接口，而是"运行期"接口 —— 拓扑模型应该在编辑期定型，Web 只用来下订单、查状态。*

我的理解:

地图编辑，保存，都是属于编辑期，修改的是本地的地图，无需 kernel 启动。我看 model editor 就是这么做的，它支持从本地加载地图，新建地图，保存地图。也支持从kernel加载地图，上传地图到kernel，此时才需要 kernel 启动。

关于 【5. 一张全链路总图（数据格式 / 文件 / 模块）】里面的 编辑期 的链路图是错误的吧？因为 `PUT /v1/plantModel` 需要 启动 kernel 吧？正确的图应该是:
```text
http/ws                  显式触发上传到 kernel
Browser 编辑地图(SPA)------------> SPA 独立后台 ----------------------> opentcs kernel(plant model api)
```

适配 it-rcs 的 png 地图到 opentcs，只需要新增 SPA 功能(包括前端和后端)，它：
*   支持 AGV 扫描生成的地图文件上传
*   支持新建地图，编辑地图，保存地图到本地
*   支持上传地图到kernel, 通过 `PUT /v1/plantModel`, 此时需要把本地的地图文件转换为 web api 需要的参数格式。(需要启动 kernel)
*   支持从 kernel 下载地图???

---

## Clarifying map management in openTCS API
*耗时: 1m 36s*

回答（无需改代码）：

### 1. ✅ 你的理解正确：编辑期不依赖 Kernel
"编辑期 vs 运行期"是 openTCS 的核心架构分界，你的理解完全对：

| 阶段 | 数据载体 | 是否需要 Kernel |
| :--- | :--- | :--- |
| **编辑期**：画点/连线/调参数/版本管理 | 你 SPA 的 DB / 本地 `model.xml` 文件 | ❌ 不需要 |
| **发布**（上传到 Kernel） | `PlantModelCreationTO` over `PUT /v1/plantModel` | ✅ 需要 |
| **运行期**：下订单、看车辆、调度 | Kernel 内存模型 + REST/WS | ✅ 需要 |

ModelEditor 的行为正好印证这一点：
*   "本地新建 / 打开 / 保存 *.xml" → 纯本地文件操作，Kernel 可以是关的。
*   "上传到 Kernel / 从 Kernel 加载" → 这两个动作才走 RMI 到 Kernel，Kernel 必须开。

这也是为什么官方把 ModelEditor 和 Kernel 拆成两个独立进程：一个是"画图工具"，一个是"运行时引擎"。

### 2. ✅ 是我前面的图画错了，你修正得对
正确链路图（编辑期 → 发布期）：

```text
                                http (REST)                            http (REST，显式"发布")
   ┌─────────────────┐  upload  ┌──────────────────┐  read/write DB  ┌───────────────┐  PUT /v1/plantModel  ┌──────────────────┐
   │  Browser (SPA)  │ ───────▶ │  你的独立后台    │ ──────────────▶ │   工程 DB     │ ───────────────────▶ │ openTCS Kernel   │
   │ 画图/编辑/草稿  │ ◀─────── │ (Spring Boot 等) │ ◀────────────── │ (MySQL/PG)    │ ◀─────────────────── │ (Javalin REST)   │
   └───────────────��─┘  list/   └──────────────────┘                 └───────────────┘   200 OK             └──────────────────┘
                        get                                                                                          │
                                                                                                                     ▼
                                                                                                            写入 data/model.xml
                                                                                                            (Kernel 内部，
                                                                                                             你不直接管)
```
**关键澄清：**
*   **"编辑期"** = SPA ↔ 后台 ↔ DB，Kernel 完全不在线也能干活。这是工程化的"草稿/版本"阶段。
*   **"发布"** 是一个显式动作（一个按钮 / 一次 CI），此时要求 Kernel 在线，调 `PUT /v1/plantModel`，把 DB 序列化成 `PlantModelCreationTO` 推过去。
*   Kernel 收到后自动落 `data/model.xml`（由 `XMLFileModelPersister` 写的），这一步你不要自己去碰 `model.xml`。

### 3. SPA 需要哪些功能 —— 你列的基本完整，补充几点
你列的 4 项功能正确，我帮你把"是否需要 Kernel"和实现要点标注清楚：

| 功能 | 需要 Kernel? | 备注 |
| :--- | :--- | :--- |
| ① 上传 AGV 扫描生成的栅格地图（`.pgm`/`.png`/`.yaml`） | ❌ | 存到后端对象存储/DB blob，仅作 SPA 画布底图 |
| ② 新建 / 编辑 / 保存地图（点位、路径、库位…）到本地（即后台 DB） | ❌ | 权威源就是这里；建议带版本号 + 草稿/已发布两态 |
| ③ "发布到 Kernel"按钮：DB → `PlantModelCreationTO` → `PUT /v1/plantModel` | ✅ | 发布前先做完整性校验；记录每次发布的 diff 用于审计 |
| ④ 从 Kernel 下载地图（`GET /v1/plantModel`） | ✅ | 建议保留但限制用途，见下 |

#### 关于 ④"从 Kernel 下载"——要不要做？
**建议做，但定位为"只读 / 应急 / 一次性导入"，不要把它当日常编辑入口。**

理由 / 用途：
*   ✅ **首次接入老 Kernel**：现场已经有一个跑着的 Kernel 装着 `model.xml`，你 SPA 第一次部署时需要把它"吸"进 DB 当作初始版本——这时就用 `GET /v1/plantModel` 一次性导入。
*   ✅ **应急对账 / 漂移检测**：万一有人绕过 SPA 直接改了 Kernel（例如老桌面 ModelEditor 临时救场），SPA 可以拉下来跟 DB 对 diff，提示"线上模型与 DB 不一致"。
*   ❌ **不要支持"从 Kernel 下载 → 在 SPA 里改 → 再发布回去"作为日常流程。** 一旦允许"双向编辑"，DB 和 Kernel 就会逐渐分叉，最终没人知道哪份是对的。始终保持单向：DB 是源 → Kernel 是镜像。

#### 还���以再补 1~2 项可选功能

| 可选功能 | 说明 |
| :--- | :--- |
| **多版本 / 回滚** | DB 里保留历次发布的快照（JSON 即可），出问题时一键 PUT 旧版本回 Kernel |
| **导出 model.xml** | 直接在后台用 JAXB 把 `PlantModelCreationTO` 写成 XML，方便离线调试或塞进新 Kernel 的 `data/model.xml` 启动 |
| **导出回 .lxmap** | 仅当客户要保留 it-rcs 老编辑器时才做，单向导出 |
| **拓扑实时更新** | 调 `POST /plantModel/topologyUpdateRequest`，让 Kernel 在不重载整张图的情况下刷新部分属性（车辆运行中要慎用） |

**一句话总结**
编辑期完全不碰 Kernel——SPA + 独立后台 + DB 自闭环；只有"发布"和"运行期下订单/查状态"才需要 Kernel 在线。`PUT /v1/plantModel` 是"发布"那一刻的事，不是编辑保存的事。前面那张图把它画在编辑链路里确实是错的，按你修正的版本来。

需要的话，下一步我可以给你画一张更细的"草稿 → 校验 → 发布 → 回滚"状态机图，作为 SPA 后台的核心流程。要现在出吗？

**User:**
好——纯设计输出，下面给一张 SPA 后台围绕"地图版本"运转的核心状态机，以及配套的 API、数据模型和关键不变量。直接照着实现就行。

1. 两层模型：Project（项目） + Revision（版本）
先把数据模型摆清楚，状态机才有依附对象。
```text
Project (一张地图工程)
  ├── id, name, agvScanRef (PNG/yaml 底图的引用)
  ├── currentDraftRevisionId   ← 唯一可写的"草稿"
  ├── publishedRevisionId      ← 当前线上 Kernel 跑的那一版（可空）
  └── Revision[] (历史，append-only)

Revision (一次"快照"，不可变)
  ├── id (单调递增/UUID)、projectId、parentId(从哪一版派生)
  ├── state ∈ { DRAFT, VALIDATING, VALID, INVALID,
  │             PUBLISHING, PUBLISHED, SUPERSEDED, FAILED, ARCHIVED }
  ├── payload: 你自己的"中间态地图"JSON（点/路径/库位/块/参数…）
  ├── validationReport (errors/warnings)
  ├── publishMeta { kernelUrl, requestId, httpStatus, at, by, durationMs }
  └── audit { createdBy, createdAt, publishedBy, publishedAt, … }
```
两条铁律（避免后面所有麻烦的源头）：
*   Revision 一旦离开 `DRAFT` 就不可变。任何修改���必须 fork 出新 Revision。
*   同一时刻，一个 Project 至多一个 `DRAFT` + 至多一个 `PUBLISHED`。其余历史只能是 `SUPERSEDED` / `ARCHIVED` / `FAILED`。

2. 主状态机（单个 Revision 的生命周期）
```text
                  ┌──────────────────────────────────────────────────────────┐
                  │                                                          │
                  │             create / fork-from(rev)                      │
                  ▼                                                          │
              ┌────────┐  edit (autosave)                                    │
   ┌────────▶ │ DRAFT  │ ◀──────────────┐                                    │
   │          └────┬───┘                │                                    │
   │               │ submit-for-validate│                                    │
   │               ▼                    │                                    │
   │        ┌────────────┐              │                                    │
   │        │ VALIDATING │──errors──────┘ (回到 DRAFT，附 errors)            │
   │        └─────┬──────┘                                                   │
   │              │ ok                                                       │
   │              ▼                                                          │
   │         ┌─────────┐  edit again (任何修改 → 失效)                       │
   │  ┌────▶ │  VALID  │ ─────────────► back to DRAFT (清空 validationReport)│
   │  │      └────┬────┘                                                     │
   │  │           │ publish (需 Kernel 在线 & 锁)                            │
   │  │           ▼                                                          │
   │  │     ┌────────────┐                                                   │
   │  │     │ PUBLISHING │──5xx/timeout──► FAILED ─── retry ──┐              │
   │  │     └─────┬──────┘                          │         │              │
   │  │           │ 200 OK from PUT /v1/plantModel  │         │              │
   │  │           ▼                                 ▼         │              │
   │  │     ┌───────────┐    rollback / publish another  ┌────┴────┐         │
   │  │     │ PUBLISHED │ ─────────────────────────────► │SUPERSED.│         │
   │  │     └─────┬─────┘                                └─────────┘         │
   │  │           │ rollback-to(this)  → 重走 PUBLISHING                     │
   │  │           ▼                                                          │
   │  └──── (新 DRAFT 由 fork-from(PUBLISHED) 创建) ─────────────────────────┘
   │
   │  手动 archive 任意非当前版本
   └──────────────────────────────────────────────► ARCHIVED
```
状态语义速查

| 状态 | 可写? | 含义 | 允许的下一步 |
| :--- | :--- | :--- | :--- |
| **DRAFT** | ✅ | 唯一允许编辑的版本 | edit / submit-for-validate / discard |
| **VALIDATING** | ❌ | 校验中（短暂） | → VALID / → DRAFT(带errors) |
| **VALID** | ❌ | 已通过校验，等待发布 | publish / 任何编辑→DRAFT |
| **PUBLISHING** | ❌ | 正在 PUT /v1/plantModel | → PUBLISHED / → FAILED |
| **PUBLISHED** | ❌ | 当前 Kernel 线上版本 | rollback / 被新版本覆盖→SUPERSEDED |
| **SUPERSEDED** | ❌ | 历史已发布版本 | rollback-to / archive |
| **FAILED** | ❌ | 发布失败的快照 | retry-publish / archive |
| **INVALID** | ❌ | （可选）校验失败的留痕版本 | archive |
| **ARCHIVED** | ❌ | 软删除 | — |

3. 主要触发事件 → API 一览
后端只暴露这 8 个动作就够用：

| 动作 | HTTP | 关键副作用 |
| :--- | :--- | :--- |
| **新建项目** | `POST /projects` | 创建空 Project，自动建一个空 DRAFT |
| **打开/编辑草稿** | `GET/PATCH /projects/{id}/draft` | 仅作用于当前 DRAFT；任何 PATCH 自动把 VALID→DRAFT |
| **从底图导入** | `POST /projects/{id}/draft/import-png` | AGV 扫描图 → 占位拓扑写进 DRAFT |
| **校验** | `POST /projects/{id}/draft/validate` | DRAFT → VALIDATING → VALID/DRAFT(+errors) |
| **发布** | `POST /projects/{id}/publish` body: `{revisionId, expectedPublishedRevisionId}` | VALID → PUBLISHING → PUBLISHED；旧的 PUBLISHED → SUPERSEDED |
| **回滚** | `POST /projects/{id}/rollback` body: `{toRevisionId}` | 选 SUPERSEDED 重走发布；当前 PUBLISHED→SUPERSEDED |
| **从 Kernel 导入** | `POST /projects/{id}/import-from-kernel` | 仅当 Project 没有 PUBLISHED 时允许（首次接入/对账） |
| **对账** | `GET /projects/{id}/diff-with-kernel` | 拉 Kernel 当前模型 vs `publishedRevisionId` 比对 |

`expectedPublishedRevisionId` 是乐观锁，防并发发布把彼此覆盖（详见第 5 节）。

4. 校验做什么（VALIDATING 阶段的检查清���）
发布前必须在 SPA 后端先跑一遍，不要指望 Kernel 报错友好。最少要查：
*   **结构**：Point/Path/Location/LocationType/Block/Vehicle 名称唯一、引用都存在。
*   **拓扑**：每条 Path 的 source/destination Point 存在；Location ↔ Point 链接成对；Block 内成员同型。
*   **几何**：坐标在底图范围内；Path 长度与端点距离一致（或允许的容差内）；同一 Point 不重叠。
*   **运行语义**：Vehicle 的 allowed order types / energy level threshold 合理；LocationType 的 allowedOperations 覆盖订单里会用到的 op。
*   **可达性**：所有 Point 在主图中弱连通（或按规则允许的多子图）。
*   **限额**：节点/边数量、属性长度等不超过 Kernel 已知限制（避免发布后被截断）。
*   **变更影响**（与当前 PUBLISHED 比对）：删了/改了正在被运行中订单引用的 Point/Path → 强制走"停服窗口"或拒绝发布。

校验产物 = `validationReport { errors[], warnings[] }`，有 error 不允许 publish；warning 允许带勾选发布。

5. 发布（PUBLISHING）：必须满足的不变量
这是整个系统最容易出事的地方，列出后端必须保证的 5 件事：
1.  **Project 级互斥锁**：同一 Project 同一时刻只允许一个发布事务（DB 行锁/Redis 锁均可）。
2.  **乐观锁**：请求里带 `expectedPublishedRevisionId`，与 DB 当前不一致 → `409 Conflict`，前端要刷新后重试。
3.  **Kernel 健康预检**：发布前先 `GET /v1/status` / `/v1/version`，不通直接拒绝，省得卡在 PUBLISHING。
4.  **幂等键**：每次 `PUT /v1/plantModel` 带 `requestId = revisionId + attemptNo`，Kernel 网络抖动重试不会留垃圾。
5.  **结果写库放在 Kernel 200 之后**：顺序必须是 Kernel 200 → DB 提交 PUBLISHED。如果 DB 提交失败但 Kernel 已成功 → 自动触发"对账"，不是回滚 Kernel。

发布伪流程：
```python
acquire_project_lock(projectId)
try:
  rev = load(revisionId); assert rev.state == VALID
  assert project.publishedRevisionId == expectedPublishedRevisionId      # 乐观锁
  ping_kernel()                                                          # 健康
  rev.state = PUBLISHING; persist(rev)
  
  to = serialize_to_PlantModelCreationTO(rev.payload)
  resp = http.put(kernel + "/v1/plantModel",
                  body=to, headers={"X-Request-Id": rev.id+"#"+attempt})
                  
  if resp.ok:
      old = project.publishedRevisionId
      project.publishedRevisionId = rev.id
      rev.state = PUBLISHED
      if old: mark(old, SUPERSEDED)
      persist(project, rev, old)
  else:
      rev.state = FAILED; rev.publishMeta = {...}; persist(rev)
finally:
  release_project_lock(projectId)
```

6. 回滚（rollback-to）
回滚 = "把某个 SUPERSEDED 重新走一次发布"��不是修改历史。流程：
```text
1. 选定 target ∈ {PUBLISHED, SUPERSEDED, FAILED-but-was-PUBLISHED}
2. 复制其 payload 为新的 DRAFT'? 
   ── 推荐做法：直接复用 target 自身（因为它不可变），跳过 DRAFT/VALIDATE
   ── 但仍然跑一次 validate（防 Kernel 端 schema 升级后旧版本失效）
3. 走标准 publish 流程（含锁、乐观锁、幂等键）
4. 成功后：当前 PUBLISHED → SUPERSEDED；target → PUBLISHED
```
注意：不要直接把 `target.state` 改回 `PUBLISHED`，要保留"何时被发回去"的审计 = 在 `publishMeta` 里追加一条记录（建议把 `publishMeta` 设计成 `list<PublishAttempt>` 而不是单值）。

7. 漂移检测（Drift detection，旁路状态）
后台每 N 分钟（或人工触发）调 `GET /v1/plantModel`，hash 后与 `publishedRevisionId.payloadHash` 比较：
```text
hash(kernel) == hash(published)        → OK
hash(kernel) != hash(published)        → DRIFT (报警；提供 "import-as-new-draft" 入口)
publishedRevisionId == null            → UNMANAGED (首次接入提示)
```
漂移本身不改变任何 Revision 的状态，只在 Project 上挂一个 `driftStatus` 标记。

8. 时序图（最常见的一次"编辑 → 发布"）
```text
Browser            SPA-Backend            DB              Kernel
   │  PATCH /draft     │                   │                 │
   │ ─────────────────▶│  upsert payload   │                 │
   │                   │ ─────────────────▶│                 │
   │  POST /validate   │                   │                 │
   │ ─────────────────▶│  state=VALIDATING │                 │
   │                   │  run checks       │                 │
   │                   │  state=VALID      │                 │
   │  POST /publish    │                   │                 │
   │ ─────────────────▶│  lock + 乐观锁    │                 │
   │                   │  ping             │ ───── GET /v1/status ──▶
   │                   │ ◀───────────── 200│                 │
   │                   │  state=PUBLISHING │                 │
   │                   │  PUT /v1/plantModel ──────────────▶ │
   │                   │                  (Kernel 写 model.xml)
   │                   │ ◀──── 200 ──────────────────────────│
   │                   │  state=PUBLISHED, 旧版→SUPERSEDED   │
   │                   │  unlock           │                 │
   │ ◀──── 200 ────────│                   │                 │
```
一句话总结
Project 持有指针，Revision 持有快照；一切修改都通过"在 DRAFT 上编辑 → 校验 → 显式发布"完成；Kernel 的角色只是"PUBLISHED 镜像"，永远由 SPA 后台单向推过去；回滚 = 重发旧快照，不是改历史；并发安全靠 Project 锁 + 乐观锁 + 幂等键三件套。

要不要我下一步把这套状态机翻译成具体的：
(a) 数据库表 DDL（projects / revisions / publish_attempts），或
(b) 后端的 REST OpenAPI 草稿，或
(c) 一份"中间态地图 payload"的 JSON Schema（直接对应 PlantModelCreationTO 的字段，省得发布时再做大块映射）？
你挑一个我就出。

因为:
AGV 扫描工厂产生标准的 ros map_server 三件套: SS27.png, SS27.pgm, SS27.yaml
kernel 最终使用的地图文件是 model.xml

那么：
*   SPA 编辑地图，保存地图的典型过程是什么样的？保存的地图文件是什么格式？
*   SPA 发布地图到 kernel 的时候，是不是涉及到地图数据格式的转换？
*   能否举例说明 SPA 编辑地图，保存地图，发布地图 的详细过程，包含地图文件数据变化的详细过程。
*   地图发布后，用户需要在 SPA 创建订单请求，通过 opentcs web api 发送给 kernel，考虑这个订单业务场景: AGV 从当前位置移动到 A 点，然后移动到 B 点，顶升，然后移动到 A 点，然后移动到 B 点，下降; B 点和当前位置 是同一个点。举例说明如何在 SPA 创建该订单：因为订单请求数据要符合 web api 规范中的描述，我们在 SPA 看到的点和kernel 实际用到的 model.xml 之间的点之间是存在差异的吧？在提交订单的时候需要做数据转换吗？

---

## Exploring SPA map editing and publishing workflows
*耗时: 3m 5s*

下面四个问题一起答，结合 openTCS 仓库里实际的数据结构（`PlantModelCreationTO` / `PostTransportOrderRequestTO` / `Destination(locationName, operation)`）举例，避免泛泛而谈。

### 1. SPA 编辑/保存地图的典型过程 & 保存格式

**流程（接上一轮的状态机）**
```text
扫描三件套(SS27.png/.pgm/.yaml)
        │  上传到 SPA
        ▼
[导入] 解析 yaml 的 resolution / origin → 得到"像素 ↔ 米"的仿射
        │
        ▼
[底图] 把 PNG 作为 Canvas 背景 (只读图层)
        │
        ▼
[标注层] 用户在画布上画 Point / Path / Location / Block / Vehicle
        │  每次编辑 = PATCH /projects/{id}/draft
        ▼
[草稿] 保存到 SPA 后端的 DB
```

**保存的"格式"（关键决策）**
不要直接保存 `model.xml`，也不要直接保存 `PlantModelCreationTO` 的二进制序列化。保存一种 SPA 自己的中间态 JSON，原因有三：

| 维度 | `model.xml` | `PlantModelCreationTO`(JSON) | SPA 中间态 JSON（推荐） |
| :--- | :--- | :--- | :--- |
| **是否含 UI/底图信息** | ❌（只有图元，layout 字段散落在 properties 里） | ❌ | ✅ 含 `agvScan{png,yaml,resolution,origin}`、图层、视图状态���未完成的草稿对象 |
| **是否要求字段完整、可编译** | ✅ 严格 | ✅ 严格（缺字段会被 Kernel 拒） | ❌ 允许"未完成"（半画完的 Path、未命名 Point） |
| **是否记 schema/版本** | Kernel 自己管 | 跟 Kernel 走 | ✅ 自带 `schemaVersion`，便于前向迁移 |
| **与 `PlantModelCreationTO` 的关系** | Kernel 内部由 TO 序列化产生 | Kernel REST 入口期望的形状 | SPA 中间态是超集，发布时投影为 TO |

**结论：**
*   保存格式 = **SPA 自定义 JSON（中间态）**，建议按 `PlantModelCreationTO` 的字段命名（points/paths/locationTypes/locations/blocks/vehicles/visualLayouts），再外挂 `agvScan` 和 `editorMeta` 两个段。
*   `model.xml` 永远只在 Kernel 一侧存在；SPA 不读不写 `model.xml`。

### 2. 发布到 Kernel 时是否涉及格式转换？
**是，必须转换。** 但这次转换只是"瘦身 + 校验"，不是结构重写——因为我们刻意让中间态字段命名贴齐 `PlantModelCreationTO`。

```text
SPA 中间态 JSON
  ├─ agvScan{...}            ──► 丢弃（Kernel 不需要）
  ├─ editorMeta{...}         ──► 丢弃
  ├─ points[]                ──► 1:1 → PointCreationTO
  ├─ paths[]                 ──► 1:1 → PathCreationTO
  ├─ locationTypes[]         ──► 1:1 → LocationTypeCreationTO
  ├─ locations[]             ──► 1:1 → LocationCreationTO
  ├─ blocks[]                ──► 1:1 → BlockCreationTO
  ├─ vehicles[]              ──► 1:1 → VehicleCreationTO
  └─ visualLayouts[]         ──► 1:1 → VisualLayoutCreationTO（图层/缩放等）

  ▼ HTTP PUT /v1/plantModel  body = PlantModelCreationTO (JSON)
Kernel 接收 → 实例化 PlantModel → XMLFileModelPersister → 落盘 model.xml
```

**坐标的转换（这是真·"格式转换"那一步）：**
*   **AGV 扫描坐标系：** 像素（左上角 0,0，y 向下）。
*   **ROS yaml：** `resolution`（米/像素）、`origin: [x, y, θ]`（地图左下角在世界系的位姿，y 向上）。
*   **openTCS Point：** 毫米整数（x, y, z）。

公式（典型情况，θ=0）：
```java
x_mm = round((px * resolution + origin_x) * 1000)
y_mm = round(((H_pixels - py) * resolution + origin_y) * 1000)   // y 翻转
```
这一步必须在 SPA 完成；Kernel 不知道你那张 PNG 的存在。

### 3. 一个完整例子：编辑 → 保存 → 发布的数据演化
假设扫描三件套：`SS27.yaml` 给出 `resolution: 0.05`（5 cm/px），`origin: [-10.0, -5.0, 0]`，PNG 高度 H=400px。

#### 第 1 步 用户在 SPA 画两个点 A、B
画布上点 A 像素 (120, 80)，B 像素 (200, 80)，再画一条 A→B 的双向 Path。

#### 第 2 步 SPA 自动转坐标，落到��间态 JSON
```json
// PATCH /projects/SS27/draft  （增量片段）
{
  "schemaVersion": "1.0",
  "agvScan": {
    "png": "blob://SS27.png", "yaml": "blob://SS27.yaml",
    "resolution": 0.05, "origin": [-10.0, -5.0, 0], "heightPx": 400
  },
  "points": [
    { "name": "A", "type": "HALT_POSITION",
      "position": { "x": -4000, "y": 11000, "z": 0 },          // mm
      "vehicleOrientationAngle": "NaN",
      "properties": { "ui:px": "120,80" } },                   // 反查用
    { "name": "B", "type": "HALT_POSITION",
      "position": { "x":  0,    "y": 11000, "z": 0 },
      "vehicleOrientationAngle": "NaN",
      "properties": { "ui:px": "200,80" } }
  ],
  "paths": [
    { "name": "A --- B", "srcPointName": "A", "destPointName": "B",
      "length": 4000, "maxVelocity": 1000, "maxReverseVelocity": 1000,
      "locked": false }
  ]
}
```
*注意 `ui:px` 放进 `properties`。Kernel 不在乎，但回程导入对账时需要原像素来恢复底图对齐。*

#### 第 3 步 用户在 B 上挂一个"顶升站" → Location + LocationType
```json
"locationTypes": [
  { "name": "LiftStation",
    "allowedOperations": ["LIFT", "LOWER"],
    "allowedPeripheralOperations": [] }
],
"locations": [
  { "name": "Loc-B", "typeName": "LiftStation",
    "position": { "x": 0, "y": 11000, "z": 0 },
    "links": [ { "pointName": "B", "allowedOperations": [] } ] }   // 链到 Point B
]
```
现在 B 这个点有了一个附着位置 `Loc-B`，对应的操作是 `LIFT` / `LOWER`。

#### 第 4 步 验证 → 发布
```text
POST /projects/SS27/draft/validate   → state: VALID
POST /projects/SS27/publish          → state: PUBLISHING
```
SPA 后端把上面 JSON 投影成 `PlantModelCreationTO`：
1. 丢掉 `agvScan` / `schemaVersion`；
2. 字段一一对应；
3. 保留 `properties` 里的 `ui:px`（Kernel 当成 opaque map 存着）。

PUT body（节选）：
```json
{
  "name": "SS27",
  "points":[ {"name":"A", ...}, {"name":"B", ...} ],
  "paths":[ {"name":"A --- B", "srcPointName":"A", "destPointName":"B", ...} ],
  "locationTypes":[ {"name":"LiftStation","allowedOperations":["LIFT","LOWER"], ...} ],
  "locations":[ {"name":"Loc-B","typeName":"LiftStation","links":[{"pointName":"B"}], ...} ],
  "vehicles":[ ... ],
  "visualLayouts":[ ... ],
  "properties":{}
}
```
Kernel 收到 → 反序列化为 `PlantModel` → `XMLFileModelPersister` 写入 `model.xml`：
```xml
<plantModel name="SS27" version="0.0.6">
  <point name="A" xPosition="-4000" yPosition="11000" zPosition="0" type="HALT_POSITION">
    <property name="ui:px" value="120,80"/>
  </point>
  <point name="B" xPosition="0" yPosition="11000" zPosition="0" type="HALT_POSITION">
    <property name="ui:px" value="200,80"/>
  </point>
  <path name="A --- B" sourcePoint="A" destinationPoint="B"
        length="4000" maxVelocity="1000" maxReverseVelocity="1000" locked="false"/>
  <locationType name="LiftStation">
    <allowedOperation name="LIFT"/>
    <allowedOperation name="LOWER"/>
  </locationType>
  <location name="Loc-B" type="LiftStation" xPosition="0" yPosition="11000" zPosition="0">
    <link point="B"/>
  </location>
  <vehicle .../>
  <visualLayout .../>
</plantModel>
```
`model.xml` 的诞生与 SPA 无关——SPA 只到 PUT 那一刻为止。这一点很重要：你永远不要试图自己拼 XML。

### 4. 创建那个"A→B→顶升→A→B→下降"订单

#### 4.1 关键事实：Web API 的 destination 只有 (locationName, operation)
看 `PostTransportOrderRequestTO` 和 `Destination`：
```java
public class Destination {
  private String locationName;   // 必须是 model.xml 里 <location> 的 name
  private String operation;      // 必须是该 location 对应 locationType 的 allowedOperations 之一
  private List<Property> properties;
}
```
`PostTransportOrderRequestTO.destinations`: `List<Destination>` —— 一个订单 = 有序 destination 列表。**没有"point"概念对外暴露**，所以"移动到某个点"的语义必须借助挂在那个点上的 `Location`。

#### 4.2 SPA 看到的 vs Kernel 用的：差异在哪？

| 层 | 概念 | 你在 SPA 画布上点的 | 提交订单时 API 真正接受的 |
| :--- | :--- | :--- | :--- |
| **视觉** | 点 A（黑色小圆） | "点 A" | — |
| **数据** | Point A | `points[].name = "A"` | ❌ 不能直接用 |
| **数据** | Location `Loc-A` 链接 Point A | "在 A 上的某个 Location" | ✅ `locationName: "Loc-A"` |
| **数据** | 操作 | "顶升" 按钮 | ✅ `operation: "LIFT"` |

所以确实需要数据转换，SPA 内部要维持一张映射：
```text
   userClicks(Point P, action X)
      │
      │ resolveOrderTarget()
      ▼
   pickAttachedLocation(P, op=X) → (locationName, operation)
```
*   如果用户选了 Point 而该点上没有 Location → 需要**"虚拟移动位"**：约定每个 Point 自动带一个名字为 `__move_<PointName>` 的 Location，类型 `MoveOnly`，`allowedOperations=["MOVE"]`（或 `NOP`）。这样订单永远能落到 `(location, op)` 形式上。
*   如果有多个 Location 链到同一个 Point，让用户在 SPA 里选具体哪一个。
*   这层映射**必须在 SPA 后端做、不在前端做**——因为发布版本/Kernel 版本之间，"Point→Location"映射可能变化，前端只发"业务意图"(pointId, action)，后端负责"翻译成 Web API 形状"。

#### 4.3 业务场景翻译
**AGV 从当前位置 → A → B → 顶升 → A → B → 下降；B == 当前位置。**

SPA 业务层视角（前端发给 SPA 后端的意图）：
```json
// POST /api/orders
{
  "vehicle": "AGV-01",
  "steps": [
    { "kind": "moveToPoint", "point": "A" },
    { "kind": "moveToPoint", "point": "B" },
    { "kind": "actionAtPoint", "point": "B", "action": "LIFT" },
    { "kind": "moveToPoint", "point": "A" },
    { "kind": "moveToPoint", "point": "B" },
    { "kind": "actionAtPoint", "point": "B", "action": "LOWER" }
  ]
}
```

SPA 后端转换（按当前 `publishedRevision` 的 Point↔Location 映射查表）：

| step | point | action | → locationName | → operation |
| :--- | :--- | :--- | :--- | :--- |
| 1 | A | move | `__move_A`（虚拟） | `MOVE` |
| 2 | B | move | `__move_B`（虚拟） | `MOVE` |
| 3 | B | LIFT | `Loc-B` | `LIFT` |
| 4 | A | move | `__move_A` | `MOVE` |
| 5 | B | move | `__move_B` | `MOVE` |
| 6 | B | LOWER | `Loc-B` | `LOWER` |

最终 PUT 给 Kernel 的请求（符合 `PostTransportOrderRequestTO`）：
```json
// POST /v1/transportOrders/TO-2026-0001
// Content-Type: application/json
{
  "incompleteName": false,
  "dispensable": false,
  "intendedVehicle": "AGV-01",
  "type": "-",
  "destinations": [
    { "locationName": "__move_A", "operation": "MOVE" },
    { "locationName": "__move_B", "operation": "MOVE" },
    { "locationName": "Loc-B",    "operation": "LIFT" },
    { "locationName": "__move_A", "operation": "MOVE" },
    { "locationName": "__move_B", "operation": "MOVE" },
    { "locationName": "Loc-B",    "operation": "LOWER",
      "properties": [ { "key": "ui.stepId", "value": "6" } ] }
  ],
  "properties": [
    { "key": "ui.orderIntentId", "value": "intent-7c1a..." },
    { "key": "ui.publishedRev",  "value": "rev_2026_0312" }
  ]
}
```
**关于 "B == 当前位置"：**
*   Kernel 不需要你显式说明。Dispatcher 会从 AGV 当前所在 Point 出发规划，第一步 MOVE 到 `__move_B` 如果它本来就在 B → 路径长度 0，立即完成（visit 计数仍 +1，状态会经过 `ACTIVE`→`FINISHED` 这一段），不会出错。
*   **不要在 SPA 端"优化掉"第一个 step**。业务意图就是要先到 A 再到 B，删步骤会丢语义。

#### 4.4 必须做的预校验（提交前 SPA 后端做）
1.  `intendedVehicle` 在当前 PUBLISHED 中存在；
2.  每个 `locationName` 存在且其 `locationType.allowedOperations` 包含对应 operation（防 Kernel 直接 422）；
3.  每个虚拟 `__move_<P>` 必须发布版本里真有——这意味着**发布时 SPA 后端要为每个 Point 自动生成一个 MoveOnly Location**，否则线上没法做"纯移动"订单；
4.  `peripheralReservationToken` / `deadline` / `dependencies` 等可选字段按场景填。

### 一句话总览
SPA 保存的是"中间态 JSON"（PNG/yaml + 业务图元 + UI 元数据），从不直接产生 `model.xml`。发布 = 把中间态投影成 `PlantModelCreationTO` PUT 给 Kernel，Kernel 自己写出 `model.xml`。下订单时再做一次"业务点 → (locationName, operation)"的小型转换，因为 Web API 只认 Location，不认 Point；要让"纯移动"也能下发，发布时给每个 Point 自动配一个 `MoveOnly` 虚拟 Location。

要不要我下一步给出：
(a) 坐标转换那段（像素↔mm，含 yaml origin 和 PNG 高度翻转）的伪代码 + 单元测试用例；
(b) Point↔Location 映射表的存储模型（含"MoveOnly 虚拟 Location"的发布期生成规则）；
(c) 这条订单的完整 OpenAPI 请求/响应（贴着仓库里 `openapi.yaml` 的 schema 给出可直接 curl 的例子）？
挑一个就行。

**User:**
关于【坐标的转换（这是真·"格式转换"那一步）：】中的 `x_mm`, `px`, `resolution`, `origin_x`, `y_mm`, `H_pixels`, `py`, `origin_y` 分别是什么意思？

【第 2 步 SPA 自动转坐标，落到中间态 JSON】中 `"position": { "x": -4000, "y": 11000, "z": 0 }` 的 `x`, `y` 是怎么计算出来的？

---

### 1. 各符号的含义
公式（θ=0 简化情形）：
```java
x_mm = round((px * resolution + origin_x) * 1000)
y_mm = round(((H_pixels - py) * resolution + origin_y) * 1000)
```

| 符号 | 来源 | 单位 | 含义 |
| :--- | :--- | :--- | :--- |
| **px** | SPA 画布上鼠标点击的横坐标 | 像素 (px) | 像素坐标系 X：图像左上角为原点，向右为正。 |
| **py** | SPA 画布上鼠标点击的纵坐标 | 像素 (px) | 像素坐标系 Y：图像左上角为原点，向下为正（这是图像/屏幕惯例）。 |
| **H_pixels** | `SS27.png` 图像高度 | 像素 (px) | PNG 的总高度，用来把"y 向下"的像素系翻转成"y 向上"的世界系。 |
| **resolution** | `SS27.yaml` 中的 resolution 字段 | 米/像素 (m/px) | ROS map_server 标准字段；一格像素在真实世界里代表多少米。例 0.05 即 5 cm/px。 |
| **origin_x** | `SS27.yaml` 中 `origin: [x, y, θ]` 的第 1 个分量 | 米 (m) | 地图左下角那个像素，在世界（map）坐标系中的 X 坐标。 |
| **origin_y** | `SS27.yaml` 中 `origin: [x, y, θ]` 的第 2 个分量 | 米 (m) | 地图左下角那个像素，在世界坐标系中的 Y 坐标。 |
| **x_mm** | 计算结果 | 毫米 (mm) | openTCS `Point.position.x`，即写入 `model.xml` 的 `xPosition`。 |
| **y_mm** | 计算结果 | 毫米 (mm) | openTCS `Point.position.y`，即写入 `model.xml` 的 `yPosition`。 |

公式分三步：
1.  **像素 → 米**：乘以 `resolution`。
2.  **像素系 → 世界系**：
    *   X 同向，直接加 `origin_x`；
    *   Y 反向（图像 y 向下、世界 y 向上），所以先 `H_pixels - py` 把原点从"左上"挪到"左下"，再加 `origin_y`。
3.  **米 → 毫米 + 取整**：乘 1000、round，因为 openTCS 的 `Point.position` 是 long 毫米。

### 2. 例子里 A=(-4000, 11000)、B=(0, 11000) 是怎么算出来的
参数（上一轮约定）：
```text
resolution = 0.05   m/px
origin     = [-10.0, -5.0, 0]   ⇒ origin_x = -10.0,  origin_y = -5.0
H_pixels   = 400

A 在画布像素：(px, py) = (120, 80)
B 在画布像素：(px, py) = (200, 80)
```

**点 A —— (px, py) = (120, 80)**
X：
```text
x_m  = 120 * 0.05 + (-10.0)
     = 6.0 - 10.0
     = -4.0  m
x_mm = round(-4.0 * 1000) = -4000
```
Y（先翻转）：
```text
H_pixels - py = 400 - 80 = 320
y_m  = 320 * 0.05 + (-5.0)
     = 16.0 - 5.0
     = 11.0 m
y_mm = round(11.0 * 1000) = 11000
```
⇒ `A.position = { x: -4000, y: 11000, z: 0 }` ✅

**点 B —— (px, py) = (200, 80)**
X：
```text
x_m  = 200 * 0.05 + (-10.0)
     = 10.0 - 10.0
     = 0.0 m
x_mm = 0
```
Y 与 A 相同（py 相同）：
```text
y_mm = 11000
```
⇒ `B.position = { x: 0, y: 11000, z: 0 }` ✅

**直观理解**
*   画布上 A、B 的 py 都是 80（同一行），所以世界 Y 相同 → 11000 mm；
*   B 的 px 比 A 大 80 像素，每像素 5 cm = 50 mm，所以 B 的世界 X 比 A 大 80 * 50 = 4000 mm（−4000 → 0）；
*   负值是因为 `origin_x = -10` m 把世界原点放到了图像内部偏右的位置——A 落在原点左边 4 m 处。

*进阶：如果 yaml.origin 的第 3 个分量 θ ≠ 0（地图整体被旋转过），则在"像素 → 米"之后还要绕原点做一次 2D 旋转 R(θ)，再加 origin。生产代码里建议直接用一个 3×3 仿射矩阵一次算掉，避免散落的三角函数到处出现。*

---

**User:**
关于 SPA 我还有几个问题：
*   SPA 后端是提供 web api 给 SPA 前端使用吧？
*   SPA 的实现选择用什么语言？选型的依据是什么？(我的开发背景是c++, opentcs kernel 是java语言开发)
*   关于【一份"中间态地图 payload"的 JSON Schema（直接对应 PlantModelCreationTO 的字段，省得发布时再做大块映射）？】中的 省得发布时再做大块映射 是什么意思？

---

### 1. SPA 后端 ↔ SPA 前端
是的，但更精确地说，"SPA 后端"在你这套架构里同时承担两个角色：

| 角色 | 通信对象 | 协议 | 典型接口 |
| :--- | :--- | :--- | :--- |
| **① 后端 for 前端 (BFF)** | SPA 前端浏览器 | HTTPS + JSON（REST 或 WebSocket） | `POST /api/maps`、`POST /api/maps/{id}/publish`、`GET /api/maps/{id}/preview`、`WS /api/maps/{id}/events` |
| **② openTCS 适配器** | openTCS Kernel | openTCS 自带的 HTTP/JSON Kernel API（`/v1/...`） 或者直接用 Java Kernel Client SDK | `POST /v1/plantModel`、`GET /v1/status/...` |

也就是说，前端只跟 ① 说话；① 在收到"发布地图"请求后，把中间态 JSON 翻译成 openTCS 的 `PlantModelCreationTO`，然后通过 ② 推给 Kernel。

为什么不让 SPA 前端直接调 Kernel REST？
*   **鉴权与多租户**：地图编辑权限、图片上传、版本/草稿这些"编辑器侧"概念，Kernel 根本不管。
*   **大文件**：`SS27.png`/`yaml` 这类资产存在编辑器侧（对象存储/磁盘），Kernel 只关心拓扑。
*   防止前端被 Kernel API 的版本/字段变动绑死。BFF 是缓冲层。
*   **CORS / 网络隔离**：Kernel 通常在内网，不直接暴露给浏览器。

### 2. SPA 用什么语言？选型依据
先把一句话结论摆上：
**前端：TypeScript + React（或 Vue）；后端：Java（Spring Boot）。**

下面解释为什么——尤其是针对你"C++ 背景，Kernel 是 Java"这个前提。

#### 前端：TypeScript
不是"选 TS 而非 JS"，是"浏览器里能跑的现代选择基本只有 TS"。
*   画布场景（拖点、连边、撤销重做）依赖成熟生态：React + Konva/Fabric/PixiJS、或 Vue + Konva。
*   类型系统能让你把"中间态 JSON Schema"用 zod / io-ts 或 OpenAPI codegen 直接生成 TS 类型，前后端共用一份契约。
*   你 C++ 出身，TS 的"显式类型 + 编译期检查"比裸 JS 友好得多。

*不要用 WebAssembly 把 C++ 搬到前端来做画布编辑器。能做，但生态、热更新、调试体验会差一截，团队后续维护成本高。除非你已经有大量 C++ 几何/路径算法要复用，否则不值得。*

#### 后端：Java（Spring Boot）—— 强烈推荐，原因如下
1.  **复用 openTCS 的领域模型类**。`PlantModelCreationTO`、`PointCreationTO`、`PathCreationTO`、`LocationCreationTO`、`VehicleCreationTO`、`Triple`、`Couple` 等都是 openTCS 自己的 Java 类。BFF 用 Java，可以直接 new 这些对象，调用 Kernel 的 Java client，不用自己再去复刻一份 DTO。换 Python/Go/Node，你就得对着 openTCS 的 JSON Schema 手搓一份 TO 等价物，还要追着 openTCS 升级。
2.  **避免"双模型漂移"**。openTCS 本身在演进，字段会增删。Java BFF 升级 openTCS 依赖版本就能拿到新字段；非 Java 就只能滞后跟进。
3.  **同栈调试**。Kernel 出问题、TO 校验失败时，你能在同一个 JVM 进程里加日志、断点。
4.  **团队成本**。你已经有 Java 工程师在维护 Kernel，BFF 用 Java 就少养一门技术栈。

#### 什么时候可以不选 Java？
*   BFF 几乎不做任何业务，只是 JSON 转发 → 用 Node.js (NestJS) 也行，前后端同语言（TS）能共享类型；缺点是 TO 类需要自己维护。
*   团队主力是 Go/Python，且能容忍维护一份手写 TO 映射 → 那也可以，但要写更多胶水代码。
*   计划把"路径平滑、几何检查、避碰预演"这类算力活放到 BFF → 这种纯算法部分用 C++/Rust 做成独立微服务，由 Java BFF 通过 gRPC 调，比把整个 BFF 改语言更划算。

#### 给 C++ 背景的你一个上手梯度
*   Spring Boot ≈ "带依赖注入的服务容器"，思路类似你写过的 C++ 框架里的 IoC；
*   Maven/Gradle ≈ CMake + Conan；
*   Jackson ≈ 手写 JSON 序列化器但自动化；
*   JUnit ≈ GoogleTest。
绝大多数概念有 1:1 的 C++ 对应物，过渡成本远小于 "Java → Web 前端"。

### 3. "省得发布时再做大块映射"什么意思？
"映射"指的是：把"编辑器世界里的概念" 翻译成 "openTCS Kernel 接受的字段" 这个翻译动作。

发布地图时，Kernel 接收的是 `PlantModelCreationTO`，它内部固定有这些必填/具名字段（举几个常见的）：
```java
PlantModelCreationTO
 ├─ name: String
 ├─ points:    List<PointCreationTO>     // 每个 Point 有 name, position(Triple, mm), type, vehicleOrientationAngle...
 ├─ paths:     List<PathCreationTO>      // sourcePoint, destinationPoint, length(mm), maxVelocity...
 ├─ locations: List<LocationCreationTO>
 ├─ locationTypes, blocks, vehicles, visualLayout, properties ...
```
如果 SPA 中间态 JSON 用的是编辑器自己的概念，比如：
```json
{
  "nodes": [{ "id": "n1", "label": "A", "xPx": 120, "yPx": 80 }],
  "edges": [{ "from": "n1", "to": "n2", "speedKmh": 5 }],
  "stations": [...]
}
```
那么发布的时候你就要写一大块代码：
1.  `nodes` → `points`，并且把 `xPx,yPx` 跑一次像素→mm 转换填进 `position`；
2.  给每个 node 起 openTCS 合法的 name；
3.  `edges.from/to` → `sourcePoint/destinationPoint` 字符串；
4.  `speedKmh 5` → `maxVelocity 1389`（mm/s），单位换算；
5.  缺省字段（type、orientationAngle、length…）一个个补；
6.  还要做引用校验（edge 引用的 node 必须存在）、命名唯一性校验……

这就是"大块映射"——一个又长又脆的 transformer 层，openTCS 加字段你就得改、改错就发布失败。

反过来，如果 SPA 中间态 JSON 的 schema 直接对齐 `PlantModelCreationTO` 的字段名、单位和结构：
```json
{
  "name": "SS27",
  "points": [
    { "name": "A",
      "position": { "x": -4000, "y": 11000, "z": 0 },   // mm，对齐 Triple
      "type": "HALT_POSITION",
      "vehicleOrientationAngle": 0.0,
      "properties": {} }
  ],
  "paths":     [...],
  "locations": [...],
  "vehicles":  [...]
}
```
那么"格式转换"在编辑阶段就一次性做完了（像素→mm、km/h→mm/s、起名…全在前端落库时就处理掉），中间态 JSON 落库即"准发布态"。发布时只剩两件小事：
1.  `Jackson.readValue(json, PlantModelCreationTO.class)` —— 反序列化，几乎零代码；
2.  `kernelClient.createPlantModel(to)` —— 推给 Kernel。

好处：
*   发布路径短、失败面小：编辑期就能用同一份 Schema/Validator 校验，所见即所发。
*   可回放/审计：这份 JSON 就是发布契约，存档即可重放。
*   跟随 openTCS 升级：openTCS 加字段，Schema 加字段，前端表单加输入；BFF 几乎不改。
*   前端直接给"准生产数据"做预览（连通性、命名冲突等），不用等到发布失败才报错。

代价：
*   前端需要理解 Kernel 的字段语义（mm、Triple、type 枚举等）。但这正是你想要的——因为这些语义早晚要面对，早面对一次胜过临到发布做一坨脆映射。

**一句话总结：** 让"中间态 JSON ≈ `PlantModelCreationTO` 的镜像"，把单位换算、命名、缺省值这些麻烦事全前置到编辑期；发布时退化成"反序列化 + 一次 RPC"，没有"大块映射"代码。

---

**User:**
关于【复用 openTCS 的领域模型类。PlantModelCreationTO、PointCreationTO、PathCreationTO、LocationCreationTO、VehicleCreationTO、Triple、Couple 等都是 openTCS 自己的 Java 类。BFF 用 Java，可以直接 new 这些对象，调用 Kernel 的 Java client，不用自己再去复刻一份 DTO。换 Python/Go/Node，你就得对着 openTCS 的 JSON Schema 手搓一份 TO 等价物，还要追着 openTCS 升级。】：

SPA 后端是作为独立的进程吗？如果是的话，它是如何直接使用 PlantModelCreationTO、PointCreationTO... 这些java类的，因为 opentcs kennel 也是独立的进程。

---

### 关键概念厘清："直接 new" ≠ "同进程"
是的，SPA 后端是独立的进程（独立的 JVM）。它"直接 new `PlantModelCreationTO`"和"通过网络调用 Kernel"这两件事并不冲突——这是 Java 生态里非常常见、但对 C++ 背景容易绕弯的一点。我分两层解释。

#### 1. 进程边界 vs 编译期依赖：是两回事
C++ 世界里，"用一个类" ≈ "编译时拿到它的头文件 + 链接时拿到它的实现"。如果两个 exe 想共享同一个类的对象，要么走 IPC，要么共享内存，对象本身没法跨进程"流动"。

Java（以及绝大多数带运行时的语言）多了一层中间环节：

| 层 | C++ 类比 | 说明 |
| :--- | :--- | :--- |
| **编译期依赖** | 引头文件 + 链接 `.lib` | SPA 后端的 `build.gradle` 写一行 `implementation "org.opentcs:opentcs-api-base:6.x"`，就把 `PlantModelCreationTO` 的 `.class` 文件打进了自己的 jar。 |
| **运行时进程** | 一个 `.exe` | SPA 后端 JVM 里有自己的 `PlantModelCreationTO` Class 对象，可以 new、可以 setter、可以 equals。这跟 Kernel JVM 里那份 Class 是同一份字节码的两个加载实例。 |
| **跨进程传输** | gRPC/socket | 把这个对象序列化（JSON 或 Java 序列化），通过 HTTP/RMI 发给 Kernel JVM，对方反序列化重建���个等价对象。 |

所以"直接 new"指的是第①层——SPA 后端在自己的进程里就能用这些类，不必手写一份镜像 DTO。第③层的"传输"是另外一件事，由库帮你做。

#### 2. 这在 openTCS 里已经是现成模式
这不是我在画饼——openTCS 自带的 Model Editor 和 Operations Desk 就是独立的 JVM 进程，它们和 Kernel 的关系正好就是你将来 SPA 后端和 Kernel 的关系。证据就在这个仓库里：
*   `opentcs-api-base/src/main/java/org/opentcs/access/to/model/PlantModelCreationTO.java` —— TO 类定义。
*   `opentcs-api-base/src/main/java/org/opentcs/access/KernelServicePortal.java` —— 客户端门面接口。
*   `opentcs-api-base/src/main/java/org/opentcs/access/rmi/KernelServicePortalBuilder.java` —— 在客户端进程里"建一个连到 Kernel 的代理"。

`opentcs-modeleditor/...` 这个独立模块（独立进程）依赖 `opentcs-api-base`，然后做这样的事：
```java
// 在 SPA 后端 JVM 里——它是独立进程
KernelServicePortal portal = new KernelServicePortalBuilder("user", "pwd")
    .build();
portal.login("localhost", 1099);          // 网络连到 Kernel 进程

PlantModelCreationTO to = new PlantModelCreationTO("SS27")    // ← "直接 new"
    .withPoints(List.of(
        new PointCreationTO("A").withPosition(new Triple(-4000, 11000, 0))))
    .withPaths(...);

portal.getPlantModelService().createPlantModel(to);           // ← 走 RMI 跨进程
```
`createPlantModel` 这一行底下，框架会把 `to` 序列化 → 通过 RMI 走到 Kernel JVM → Kernel 那边反序列化成 Kernel 自己进程里的 `PlantModelCreationTO` 实例 → 落到模型里。整个序列化/反序列化你不用写一行代码，因为两边用的是同一份 `.class` 文件（Kernel 用 6.x，BFF 也依赖 6.x），字段、构造器、enum 名字天然一致。

#### 3. SPA 后端和 Kernel 通信的两条路
你将来挑一条用即可：

| 通道 | 用什么 | 适合 |
| :--- | :--- | :--- |
| **A. RMI** | `KernelServicePortal`（如上例，`opentcs-api-base` 提供） | 内网、Java↔Java、想要强类型客户端、低延迟。Modeleditor 走的就是这条。 |
| **B. HTTP/JSON** | Kernel 的 `opentcs-kernel-extension-http-services`（`PlantModelHandler` 等） | 跨语言、跨网段、用得熟。`POST /v1/plantModel` 直接吃一份 JSON。 |

注意 B 通道也救你：哪怕 SPA 后端不是 Java，HTTP 通道存在；但只有 Java BFF能两条都走、且完全免手写 DTO。

如果你担心 Java BFF 的部署形态：它就是一个普通的 Spring Boot fat-jar / Docker 镜像，跟 Kernel 的 jar 互相独立部署、独立升级，两边都依赖 `opentcs-api-base` 这一个共享 API 包就行。版本号对齐即可（比如都用 6.5.0），就像两个 C++ 服务都依赖同一份 `.proto` 生成���桩代码。

#### 一句话回到你的问题
"SPA 后端是独立进程，怎么直接用 Kernel 的 Java 类？"

把 `opentcs-api-base` 当成"openTCS 的 SDK jar"，在 SPA 后端的 Gradle 里加一行依赖，就把 `PlantModelCreationTO` 等 TO 类搬进了 SPA 后端进程。new 和组装在 SPA 后端 JVM 里完成；最后通过 `KernelServicePortal`（RMI）或 HTTP 把对象序列化送给 Kernel 进程。两个进程互相独立，但共享同一份类定义——这正是 Modeleditor 今天对 Kernel 干的事，照搬即可。

---

**User:**
因为我是c++开发背景，不熟悉java，也不熟悉它使用的框架，构建工具。我几乎是完全依赖你来帮我完成 SPA 后端的开发，构建，测试，api 文档... 。我该怎么跟你交互？例如，直接说 **现在请你带领我从头开始 SPA 后端程序的开发吧**。?

---

### 怎么跟我交互最高效——给 C++ 背景同学的一份"操作手册"
你的问题本身是个交互/工作流问题，不需要改代码。先给结论，再给具体话术。

#### 一句话回答
**不要说 "带我从头开发吧"**——那种 open-ended 指令对 AI agent 是最低效的用法，原因有两个：
1.  我每次会话是无状态的（除了你看到的 PR 描述和我存到 memory 里的少量事实，session 之间没有连续记忆）；
2.  你看不见我在你电脑里跑的中间过程，"带你"这件事做不到——只能"替你做 + 给你解释"。

正确的姿势是：**你当产品经理 + 架构评审，我当全栈工程师。** 你负责拍板方向、验收结果；我负责脚手架、写代码、跑构建测试、解释为什么这么写。

#### 推荐的分阶段交互节奏
把 SPA 后端开发切成 5~7 个里程碑，每个里程碑一个 task / 一个 PR。这样契合 Copilot agent 的工作模型（一次会话 ≈ 一个 PR），也方便你回滚和复盘。

**阶段 0：先做一次"架构对齐"会话（不写代码）**
开一个 issue / 任务，原样问我：
> *"我要做一个 SPA 后端（BFF），对接 openTCS Kernel。请先调研本仓库里 modeleditor / operationsdesk 是怎么连 Kernel 的，然后给我一份 BFF 的技术选型方案，包含：构建工具（Gradle vs Maven）、Web 框架（Spring Boot vs Javalin vs Quarkus）、连 Kernel 用 RMI 还是 HTTP、API 文档工具（springdoc-openapi）、测试栈（JUnit5 + Testcontainers）、目录结构。要求：每个选项给出 2~3 个候选、推荐理由、对 C++ 背景人的学习成本评估。不要写代码，只输出方案让我审。"*

**关键**：明确说"只出方案、不写代码"。我会用代码块标签返回，你审完拍板，再进入阶段 1。

**阶段 1：脚手架 + Hello World（一个 PR）**
> *"按上面定下的方案 [Spring Boot 3 + Gradle + Java 21]，在仓库里新建一个 opentcs-bff 模块，目标：跑起来一个 GET /health 端点���要求：
> 1. 复用根 build.gradle 的版本管理；
> 2. 包名 org.opentcs.bff；
> 3. 加一个 BffApplicationTest 用 @SpringBootTest 验证启动；
> 4. 在 PR 描述里告诉我：怎么本地 ./gradlew :opentcs-bff:bootRun 跑起来、怎么 curl 测试。"*

这种单一目标 + 明确验收标准的 prompt，是最适合我的形式。

**阶段 2：连上 Kernel（一个 PR）**
> *"在 opentcs-bff 里加一个 KernelClient 组件，用 KernelServicePortal（RMI）连本地 Kernel。提供一个 GET /api/plant-model 端点，返回当前 Kernel 里的 PlantModel 的 JSON 摘要（点数、路径数、车辆数）。Kernel 地址走 application.yml 配置，默认 localhost:1099。给我一个 docker-compose.yml 同时起 Kernel + BFF 方便我手测。"*

**阶段 3+：按业务一个端点一个 PR**
> *"加一个 POST /api/plant-model 端点，接收前端 JSON，转成 PlantModelCreationTO 后调 Kernel 的 createPlantModel。要求：
> 1. 用 springdoc-openapi 自动出 OpenAPI 文档，挂在 /swagger-ui.html；
> 2. 输入校验失败返回 400 + 结构化错误；
> 3. 写 2 个测试：一个 mock 掉 portal 的单元测试、一个用 Testcontainers 跑真 Kernel 的集成测试。"*

#### 高效 prompt 的 5 条规则（针对你的背景）
1.  **写"验收条件"，别写"愿望"。**
    *   ❌ *"做个用户管理"*
    *   ✅ *"加 POST /users 和 GET /users/{id}，返回 JSON，写 JUnit 测试覆盖 200/400/404"*
2.  **告诉我边界，越窄越好。**
    *   ❌ *"完善一下错误处理"*
    *   ✅ *"在 KernelClient 类里，把 RemoteException 包装成 KernelUnavailableException（自定义），HTTP 层映射到 503"*
3.  **遇到不熟的概念，让我先讲再做。**
    *   *"在动手之前，用 5 句话给我讲清楚 Spring Boot 的 @RestController 和 C++ 里写 HTTP handler 有啥本质区别。然后再开始改代码。"*
4.  **每个 PR 之后让我留"给下次的备忘"。**
    *   *"在 PR 描述结尾加一段 ## 下一步建议，列出 3 个可选的下一里程碑和它们的依赖关系。"*
    我也会自动用 `store_memory` 记住关键事实（构建命令、约定），下个 session 仍可用。
5.  **大改动先要 plan，别让我直接动手。**
    *   *"请用代码块给我一份重构计划：把 KernelClient 从 RMI 切换到 HTTP/JSON 通道。先不要写代码。"*

#### 你不需要学但需要"看得懂"的几个东西
我不指望你能写 Java，但下面这几条能让你看懂我的 PR、做有效评审：

| 概念 | C++ 类比 | 看到时知道是啥就行 |
| :--- | :--- | :--- |
| `build.gradle` / `settings.gradle` | `CMakeLists.txt` | 构建脚本 |
| `pom.xml` | 同上（另一种构建工具，Maven） | 我会全程用 Gradle，与本仓库一致 |
| `@Annotation` | 没有完美对应；类似 attribute / 宏 | 框架靠这个识别"这是 controller / 这是 bean" |
| `application.yml` | `config.json` | 运行时配置 |
| `./gradlew` | `make` | 项目自带的构建入口，不用本机装 Gradle |
| `./gradlew test` | `ctest` | 跑测试 |
| Spring Boot fat-jar | 静态链接 exe | `java -jar app.jar` 一条命令启动 |
| OpenAPI / Swagger UI | 没有完美对应 | 自动生成的 API 文档网页 |

#### 一份"可以直接复制粘贴"的开场白模板
下次新开任务，我建议这么写（替换中括号内容）：

> **背景**：我在做 openTCS 的 SPA 后端（BFF），技术栈：[Spring Boot 3 + Gradle + Java 21]。仓库里已有的相关代码：[opentcs-modeleditor 用 RMI 连 Kernel、opentcs-kernel-extension-http-services 是 Kernel 自带的 HTTP 扩展]。
> 
> **本次目标**：[一句话说清楚要交付什么]
> 
> **验收标准**：
> *   [具体的接口/类/行为]
> *   [测试覆盖要求]
> *   [文档/配置要求]
> 
> **约束**：
> *   不要修改 opentcs-api-base 等已有模块
> *   沿用仓库现有的 [Checkstyle / Spotless] 规范
> 
> **先做 / 后做**：
> *   如果方案有歧义，先用代码块给我候选方案，我确认后再写代码
> *   PR 描述里说明本地跑/测的命令

#### 直接回答你的那个例子
*"现在请你带领我从头开始 SPA 后端程序的开发吧。"*
如果你真这么发给我，我大概率会做这两件之一：
(A) 自作主张选一套技术栈直接 scaffold 一个 hello-world，提一个又大又含糊的 PR——多半你不满意；
(B) 反过来问你一堆选型问题，浪费一次会话。

把它改写成：
> *"我要启动 openTCS 的 SPA 后端项目。这是第 0 个会话，目标是定方案不写代码。请：
> 1. 阅读本仓库 opentcs-modeleditor、opentcs-kernel-extension-http-services、根 build.gradle、settings.gradle，搞清楚现有 Java 版本、Gradle 版本、依赖管理方式；
> 2. 在代码块里给我一份 BFF 技术选型表，包含：模块放仓库内还是另起 repo、构建工具、Web 框架、连 Kernel 通道（RMI/HTTP）、API 文档、测试、日志、配置、容器化方案；每项给推荐 + 1~2 个备选 + 一句话理由；
> 3. 末尾列出 5 个后续里程碑的建议拆分。 不要创建任何文件，不要 report_progress。"*

这样一次会话产出一份你能逐条审的方案，效率最高。
需要的话，下一步你就把上面那段开场白发过来，我们正式开干 🚀。

---

**User:**
"我要启动 openTCS 的 SPA 后端项目。这是第 0 个会话，目标是定方案不写代码。请：

阅读本仓库 opentcs-modeleditor、opentcs-kernel-extension-http-services、根 build.gradle、settings.gradle，搞清楚现有 Java 版本、Gradle 版本、依赖管���方式；
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
| 7 | API 文档 | **OpenAPI 3 + org.openapi.generator Gradle 插件 + swagger-ui webjar**（全部已在 catalog） | springdoc-openapi（仅 Spring Boot 路线） | 手写 openapi.yaml + Redoc | 设��优先（design-first）：把 `openapi.yaml` 放 `src/main/resources/openapi/`，插件生成 DTO/接口骨架，再让 Javalin handler 实现。这是仓库已有的 swagger-generator 工具链，零新依赖。 |
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