2026-06-11

## 任务场景

移动任务: Point-7(MOVE) ---> Point-19(PARK)

Point-7 至 Point-19 途经路由点：Point-8、Point-9、Point-10, Point-11

路由点之间的拓扑为：
```
Point-19
/|\
 |
Point-11
/|\
 |
Point-10
/|\
 |
Point-9
/|\
 |
Point-8 <--- Point-7
```

## 问题

AGV 在行驶到 Point-10 后，就不再移动了。

## 排查

1. 查看 AVV 侧订阅的order信息，最后收到的订单信息是: Point-9 ---> Point-10
```json
{
  "headerId" : 2,
  "timestamp" : "2026-06-11T06:07:46.267837Z",
  "version" : "2.0.0",
  "manufacturer" : "BYD_11",
  "serialNumber" : "DP0055",
  "orderId" : "spa-178115805990401KTTMP7WH4MPF19F7XZMD0E41-1",
  "orderUpdateId" : 2,
  "nodes" : [ {
    "nodeId" : "Point-9",
    "sequenceId" : 4,
    "released" : true,
    "actions" : [ ],
    "nodePosition" : {
      "x" : 9.4,
      "y" : -5.6,
      "mapId" : "HZ27",
      "theta" : 2.466054752241197
    }
  }, {
    "nodeId" : "Point-10",
    "sequenceId" : 6,
    "released" : true,
    "actions" : [ ],
    "nodePosition" : {
      "x" : 9.4,
      "y" : -4.1,
      "mapId" : "HZ27",
      "theta" : 1.5707963267948966
    }
  } ],
  "edges" : [ {
    "edgeId" : "Point-9 --- Point-10",
    "sequenceId" : 5,
    "released" : true,
    "startNodeId" : "Point-9",
    "endNodeId" : "Point-10",
    "actions" : [ ],
    "maxSpeed" : 1.0,
    "orientation" : 1.5707963267948966,
    "orientationType" : "GLOBAL"
  } ]
}
```

2. 查看 kernel 日志
```
20260611-14:07:39-925] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.createTransportOrder(): ------Create order----- TransportOrderCreationTO{name='spa-1781158059904', incompleteName=true, intendedVehicleName='Vehicle-1', destinations=[DestinationCreationTO{destLocationName='Point-7', destOperation='MOVE', name='', properties={}}, DestinationCreationTO{destLocationName='Point-19', destOperation='PARK', name='', properties={}}], type='-', deadline=+1000000000-12-31T23:59:59.999999999Z, dispensable=false, wrappingSequence='null', dependencyNames=[], peripheralReservationToken='null', properties={}}
[20260611-14:07:39-939] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.createTransportOrder(): Transport order is being created: spa-178115805990401KTTMP7WH4MPF19F7XZMD0E41 -- details: TransportOrder{name=spa-178115805990401KTTMP7WH4MPF19F7XZMD0E41, wrappingSequence=null, type=-, state=RAW, intendedVehicle=TCSObjectReference{referentClass=class org.opentcs.data.model.Vehicle, name=Vehicle-1}, processingVehicle=null, creationTime=2026-06-11T06:07:39.922204100Z, deadline=+1000000000-12-31T23:59:59.999999999Z, finishedTime=+1000000000-12-31T23:59:59.999999999Z, dispensable=false, peripheralReservationToken=null, dependencies=[], driveOrders=[DriveOrder{name=spa-178115805990401KTTMP7WH4MPF19F7XZMD0E41-drive-order-0, destination=Point-7:MOVE, transportOrder=TCSObjectReference{referentClass=class org.opentcs.data.order.TransportOrder, name=spa-178115805990401KTTMP7WH4MPF19F7XZMD0E41}, state=PRISTINE, route=null}, DriveOrder{name=spa-178115805990401KTTMP7WH4MPF19F7XZMD0E41-drive-order-1, destination=Point-19:PARK, transportOrder=TCSObjectReference{referentClass=class org.opentcs.data.order.TransportOrder, name=spa-178115805990401KTTMP7WH4MPF19F7XZMD0E41}, state=PRISTINE, route=null}], currentDriveOrderIndex=-1, currentRouteStepIndex=-1, properties={}, history=ObjectHistory{entries=[Entry{timestamp=2026-06-11T06:07:39.922204100Z, eventCode=tcs:history:orderCreated, supplements=[]}]}}
[20260611-14:07:46-058] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.setTransportOrderState(): Transport order's state changes: spa-178115805990401KTTMP7WH4MPF19F7XZMD0E41 -- RAW -> ACTIVE
[20260611-14:07:46-063] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.setTransportOrderState(): Transport order's state changes: spa-178115805990401KTTMP7WH4MPF19F7XZMD0E41 -- ACTIVE -> DISPATCHABLE
[20260611-14:07:46-088] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.setTransportOrderState(): Transport order's state changes: spa-178115805990401KTTMP7WH4MPF19F7XZMD0E41 -- DISPATCHABLE -> BEING_PROCESSED
[20260611-14:07:46-090] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.setTransportOrderProcessingVehicle(): Transport order's processing vehicle changes: spa-178115805990401KTTMP7WH4MPF19F7XZMD0E41 -- null -> Vehicle-1
[20260611-14:07:46-092] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.setTransportOrderNextDriveOrder(): Transport order's drive order finished: spa-178115805990401KTTMP7WH4MPF19F7XZMD0E41 -- Point-7:MOVE
[20260611-14:07:46-167] WARNING kernelExecutor       o.o.k.vehicles.DefaultVehicleController.updatePositionWithOrder(): Vehicle-1: Reported position: Point-7, expected one of: [Point-8, Point-9, Point-10]
[20260611-14:07:46-167] INFO    kernelExecutor       o.o.k.workingset.NotificationBuffer.addNotification()  : User notification added: UserNotification{source=Vehicle-1, timestamp=2026-06-11T06:07:46.167700900Z, level=IMPORTANT, text=Vehicle reported an unexpected position ('Point-7') while processing a transport order. Its vehicle driver won't receive further movement commands until the vehicle is forcefully rerouted.}
[20260611-14:09:26-133] INFO    kernelExecutor       o.o.k.workingset.NotificationBuffer.addNotification()  : User notification added: UserNotification{source=Watchdog - Stranded vehicle check, timestamp=2026-06-11T06:09:26.133923400Z, level=INFORMATIONAL, text=Vehicle 'Vehicle-1' is stranded since: 2026-06-11 14:08:16}
```

## 需要 AI 解答的核心问题

1. 从 kernnel 日志，定位到对应的源代码，分析该日志出现的原因；分析 AGV 侧没有收到后续的订单数据是不是跟该日志有关

## 关键文件路径

- VDA5050 适配器源码目录：D:\byd_agv_njc\opentcs-commadapter-vda5050
- 工厂模型文件：D:\byd_agv_njc\opentcs\opentcs-kernel\build\install\opentcs-kernel\data\model.xml

## 分隔线

忽略从 `## 分隔线` 开始的后续所有内容。

## 提示词

请读取上级目录下的问题分析MD文档: D:\byd_agv_njc\opentcs\docs\task_halt.md，严格基于文档内场景、配置、代码逻辑回答问题。

输出要求：
1. 从 kernnel 日志，定位到对应的源代码，分析该日志出现的原因；分析 AGV 侧没有收到后续的订单数据是不是跟该日志有关

---

### codex cli 答复

```
结论

  AGV 没有收到 Point-10 -> Point-11、Point-11 -> Point-19 后续订单，和这条 kernel 日志直接有关：

  Vehicle-1: Reported position: Point-7, expected one of: [Point-8, Point-9, Point-10]

  对应源码在 src/main/java/org/opentcs/kernel/vehicles/DefaultVehicleController.java:1307 的 updatePositionWithOrder()。

  日志出现原因

  当前任务是：

  Point-7(MOVE) -> Point-19(PARK)
  实际路由: Point-7 -> Point-8 -> Point-9 -> Point-10 -> Point-11 -> Point-19

  日志中先出现：

  Transport order's drive order finished ... -- Point-7:MOVE

  说明第一个目标 Point-7:MOVE 已经被认为完成，kernel 开始处理第二个目标 Point-19:PARK，并已经向适配器下发了若干移动命令。随后 kernel 收到车辆位置上报 Point-7，但此时它期望车辆已经
  在已下发路径的目的点之一：

  [Point-8, Point-9, Point-10]

  源码逻辑是：updatePositionWithOrder() 会取 commandProcessingTracker.getSentCommands() 中已发送命令的目标点作为 expectedPoints，如果车辆上报点不在里面，就打印该 warning，并调用
  onUnexpectedPositionReported(point)。

  关键代码：

  - 位置校验和 warning： src/main/java/org/opentcs/kernel/vehicles/DefaultVehicleController.java:1345
  - unexpected position 处理： src/main/java/org/opentcs/kernel/vehicles/DefaultVehicleController.java:1522
  - 设置阻断标志： src/main/java/org/opentcs/kernel/vehicles/DefaultVehicleController.java:1530

  配置里：

  kernelapp.requireManualReroutingAfterUnexpectedPosition = true

  见 build/install/opentcs-kernel/config/opentcs-kernel-defaults-baseline.properties:15。

  所以 kernel 在发现车辆上报 Point-7 不是期望位置后，会执行：

  sendingCommandsAllowed = false;

  并发出通知：

  Its vehicle driver won't receive further movement commands until the vehicle is forcefully rerouted.

  为什么 AGV 没收到后续订单

  后续命令发送前会走 src/main/java/org/opentcs/kernel/vehicles/DefaultVehicleController.java:1153。其中明确检查：

  if (!sendingCommandsAllowed) {
    LOG.debug("{}: Cannot send, unresolved report of an unexpected position.", vehicle.getName());
    return false;
  }

  见 src/main/java/org/opentcs/kernel/vehicles/DefaultVehicleController.java:1188。

  VDA5050 适配器只有在 kernel 调用 sendCommand() 时才会把 MovementCommand 转成 VDA5050 Order 并入队发布：

  - D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/CommAdapterImpl.java:369
  - D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/CommAdapterImpl.java:381

  因此，Point-9 -> Point-10 是 unexpected position 发生前后已经进入发送链路的最后一段；但从 Point-10 -> Point-11 开始，kernel 因 sendingCommandsAllowed=false 不再继续给适配器发送
  移动命令，适配器自然也不会再给 AGV 发布后续 VDA5050 order。

  补充一点：VDA5050 状态处理中，适配器会把 state.lastNodeId 作为车辆逻辑位置上报给 kernel，代码在 D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/
  vehicle/vda5050/v2_0/CommAdapterImpl.java:645。所以这次 warning 的直接触发条件，是 AGV 在执行当前运输订单期间仍上报了 lastNodeId=Point-7，而 kernel 当前已期望它到达 Point-8/
  Point-9/Point-10 之一。

─ Worked for 4m 11s ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────


› 分析 `AGV 上报的 lastNodeId 不在kernel 当前已期望 node` 问题出现的可能场景？并提供解决方案

---

• 可能场景

  1. AGV 的 lastNodeId 更新滞后或卡住

     VDA5050 适配器收到 state.lastNodeId 后，会直接把它作为车辆逻辑位置上报给 kernel：
     D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/CommAdapterImpl.java:645

     如果 AGV 已经接受并执行 Point-7 -> Point-8 -> Point-9 -> Point-10，但状态里仍持续上报：

     "lastNodeId": "Point-7"

     kernel 当前已发送命令的目标点是 [Point-8, Point-9, Point-10]，Point-7 不在这个集合中，于是触发：

     Reported position: Point-7, expected one of: [Point-8, Point-9, Point-10]

  2. AGV 过早清空 nodeStates / edgeStates，导致适配器误判前序移动已完成

     当前 VDA5050 适配器默认用 EDGE_AND_NODE 判断移动完成，但默认不检查 lastNodeId 是否已经到达目标点：

     D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/MovementCommandManager.java:61

     如果 AGV 在还没真正到 Point-8/Point-9 时，就把对应 order 的 edgeStates、nodeStates 清空，适配器会认为这些移动命令完成，kernel 继续下发到 Point-10。但此时 AGV 的 lastNodeId 仍
     是 Point-7，就会和 kernel 期望不一致。

  3. 任务开始时初始位置上报时序不对

     如果 openTCS 在下发第二个 drive order 后，才第一次收到 AGV 上报的 lastNodeId=Point-7，kernel 会认为车辆在执行订单过程中“回到了/仍在”非预期位置。

     这个场景常见于：车辆接入后位置未稳定、先创建任务后才收到第一条有效 state、或者适配器/车辆曾经 reset position。

  4. AGV 接受了与自身当前位置不连续的 order update

     文档中的 AGV 最后一条 order 是：

     Point-9 -> Point-10

     如果 AGV 实际 lastNodeId 仍是 Point-7，却接受了 Point-9 -> Point-10 的 order update，说明 AGV 侧没有校验“订单起点是否与当前逻辑位置连续”，或者 AGV 状态上报和执行状态不同步。

  5. 旧 state / retained MQTT 消息 / 顺序错乱

     如果 MQTT 中存在旧的 state 消息，例如旧消息仍带 lastNodeId=Point-7，并且被适配器接受，也会把 kernel 车辆位置更新回 Point-7。位置更新逻辑本身不要求 state 的 orderId/
     orderUpdateId 一定匹配当前待完成命令。

  解决方案

  1. AGV 侧修正状态上报，优先级最高

     AGV 到达每个释放节点时必须及时更新：

     "lastNodeId": "Point-8"
     "lastNodeSequenceId": 2

     然后依次是 Point-9 / 4、Point-10 / 6。不要在已执行到后续节点后继续上报 Point-7。

  2. 不要过早清空 nodeStates / edgeStates

     对每段移动，AGV 应该在真正完成该段后再移除对应的 edgeState 和目标 nodeState。否则适配器会提前调用 commandExecuted()，kernel 会继续下发后续段，形成“kernel 以为已到 Point-9，
     AGV 仍报 Point-7”的错位。

  3. 在车辆模型中增加完成判定保护

     建议给 Vehicle-1 增加：

     <property name="vda5050:lastNodeIdRequiredForMovementCompletion" value="true"/>

     这个属性会让适配器在判断移动命令完成时，额外要求 lastNodeId 必须匹配已释放路线中的目标点。对应代码在 D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/
     commadapter/vehicle/vda5050/v2_0/MovementCommandManager.java:156。

     这能防止 AGV 仅靠清空 edgeStates/nodeStates 就让 kernel 误认为前序段完成。

  4. 任务下发前先稳定车辆初始位置

     创建运输订单前，确认 kernel/适配器已经收到并记录车辆当前位置 Point-7。避免任务已经进入 Point-19:PARK 的移动阶段后，才收到第一条 lastNodeId=Point-7。

  5. AGV 应拒绝不连续的 order update

     如果 AGV 当前逻辑位置仍是 Point-7，收到以 Point-9 为起点的 order update 时，不应继续接受执行。否则 kernel 和 AGV 状态会进一步分叉。

  6. 清理 MQTT 旧状态和顺序问题

     确认 state topic 不使用 retained 旧消息；headerId、timestamp 单调递增；不要把旧订单的 state 混入当前订单周期。

  7. 现场恢复方式

     当前已经触发：

     sendingCommandsAllowed = false

     kernel 不会继续下发后续移动命令。不要简单等待。应先让 AGV 上报正确当前位置，例如 Point-10，然后在 openTCS 中对车辆执行强制重路由，或撤销当前订单后重新下发从当前点到 Point-19
     的任务。

  不建议通过关闭：

  kernelapp.requireManualReroutingAfterUnexpectedPosition = false

  来规避问题。它只会让车辆在位置偏离时继续收命令，交通管制风险更高。
```

### 继续提问

请你新增对指定 Vehicle reroute 的功能，opentcs-kernel web api 参考: D:\byd_agv_njc\logistics_digit_project\8.openTCS Web API v1.14.0 — 完整中文参考手册.md
- opentcs-bff 源码目录：D:\byd_agv_njc\opentcs\opentcs-bff
- opentcs-spa 源码目录：D:\byd_agv_njc\opentcs\opentcs-spa

### 答复

• 已继续完成并验证。

  实现内容：

  - BFF 新增 POST /api/v1/vehicles/{name}/rerouteRequest?forced=true|false
  - BFF 内部通过 KernelClient.rerouteVehicle() 调用 kernel DispatcherService.reroute(vehicleRef, ReroutingType.REGULAR/FORCED)
  - OpenAPI 文档已补接口
  - SPA vehicles.ts 新增 rerouteVehicle()
  - VehicleStatusPanel 新增每辆车的“普通/强制”重路由按钮
  - 强制重路由会先弹确认提示
  - 补了 BFF handler、应用路由、KernelClient、SPA 组件测试

  验证通过：

  - ./gradlew :opentcs-bff:test --tests org.opentcs.bff.vehicle.VehicleHandlersTest --tests org.opentcs.bff.BffApplicationTest --tests org.opentcs.bff.ProjectsHandlerTest --tests
    org.opentcs.bff.ProjectAssetsHandlerTest

  - ./gradlew :opentcs-bff:test --tests org.opentcs.bff.kernel.KernelClientTest
  - pnpm typecheck
  - pnpm test -- VehicleStatusPanel.test.ts

  注意：第一次 Gradle/pnpm 测试因沙箱权限访问 .gradle/pnpm 临时文件失败，已按规则提升权限后重跑通过。

---

### commit 信息

• feat(vehicle): 新增指定车辆重路由功能

  新增指定 Vehicle 的 reroute 能力，支持通过 BFF 调用 openTCS kernel 的车辆重路由接口，并在 SPA 车辆实时状态中提供普通重路由和强制重路由操作。

  主要变更：
  - BFF 新增 POST /api/v1/vehicles/{name}/rerouteRequest 接口
  - 支持 forced 参数区分 REGULAR / FORCED reroute
  - SPA 车辆实时状态表格新增“普通”和“强制”重路由按钮
  - 强制重路由增加二次确认，避免误操作
  - 补充 BFF、KernelClient、SPA 相关单元测试
  - 更新 OpenAPI 文档

  验证：
  - 通过 opentcs-bff 相关单元测试
  - 通过 opentcs-spa typecheck
  - 通过 VehicleStatusPanel 相关测试

```
【任务场景】

我重新下发了一个任务：

Point-19(MOVE) ---> Location-4(startCharging)

Location-4 链接在 Point-7 上。

Point-19 至 Point-7 途经路由点：Point-11、Point-10, Point-9、Point-8

【异常】

1. 车辆移动到 Point-9 后，停止了移动
2. 内核日志又出现了 `Reported position: Point-19, expected one of: [Point-11, Point-10, Point-9]`

【我的排查】

1. 我查看了 AGV 侧上报的 state 报文，报文显示 AGV 已经达到了 Point-9, last_node_id: Point-9

2. spa 前端页面的 `车辆实时状态` 中的当前点位也更新为了 `Point-9`

3. 内核日志，部分

[20260611-16:25:24-611] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.setTransportOrderNextDriveOrder(): Transport order's drive order finished: spa-178116631746401KTTWJ7XWTDQ518M5MMY8HT75 -- Point-19:MOVE
[20260611-16:25:24-807] WARNING kernelExecutor       o.o.k.vehicles.DefaultVehicleController.updatePositionWithOrder(): Vehicle-1: Reported position: Point-19, expected one of: [Point-11, Point-10, Point-9]
[20260611-16:25:24-809] INFO    kernelExecutor       o.o.k.workingset.NotificationBuffer.addNotification()  : User notification added: UserNotification{source=Vehicle-1, timestamp=2026-06-11T08:25:24.809973Z, level=IMPORTANT, text=Vehicle reported an unexpected position ('Point-19') while processing a transport order. Its vehicle driver won't receive further movement commands until the vehicle is forcefully rerouted.}
[20260611-16:26:44-605] INFO    kernelExecutor       o.o.k.workingset.NotificationBuffer.addNotification()  : User notification added: UserNotification{source=Watchdog - Stranded vehicle check, timestamp=2026-06-11T08:26:44.605108700Z, level=INFORMATIONAL, text=Vehicle 'Vehicle-1' is stranded since: 2026-06-11 16:25:44}
[20260611-16:32:44-633] INFO    kernelExecutor       o.o.s.b.dispatching.DefaultDispatcher.reroute()        : Rerouting vehicle 'Vehicle-1' from its current position 'Point-9' using rerouting type 'FORCED'...
[20260611-16:32:54-603] INFO    kernelExecutor       o.o.k.workingset.NotificationBuffer.addNotification()  : User notification added: UserNotification{source=Watchdog - Stranded vehicle check, timestamp=2026-06-11T08:32:54.603803400Z, level=INFORMATIONAL, text=Vehicle 'Vehicle-1' is no longer stranded.}


【关键文件路径】

- VDA5050 适配器源码目录：D:\byd_agv_njc\opentcs-commadapter-vda5050
- 工厂模型文件：D:\byd_agv_njc\opentcs\opentcs-kernel\build\install\opentcs-kernel\data\model.xml
- AGV 侧上报的 state 报文： D:\byd_agv_njc\opentcs\docs\agv_task_manager_log.txt

【需要 AI 解答的核心问题】

1. 为什么内核老是报 `Reported position: ..., expected one of: `， 机会每个任务必现该问题

2. 我配置了 Vehicle-1 的 vda5050:maxStepsHorizon = 0, vda5050:maxStepsBase 使用默认值(2)， 问题该这个配置有关系吗？
```

---

从 AGV 侧的state报文(D:\byd_agv_njc\opentcs\docs\agv_task_manager_log.txt)看：

1. 有重复上报 last_node_id: Point-19, state 报文上报的逻辑：在状态(state报文中任一字段)有变化时会触发上报，没有状态变化时间隔1秒钟上报
2. 最后一次 last_node_id: Point-19 报文上报后，才会上报 last_node_id: Point-11 的报文

因为 vda5050 适配器跟 agv 通过 mqtt 通信，他们之间是异步的，总是存在这种情形吧：内核完成了某一段，但是收到的下一个state报文还是老的的情形

疑问：
1. 如何从根源上解决这种问题。(state 报文上报机制是已有的，不能改)
2. 关于 ` vda5050:lastNodeIdRequiredForMovementCompletion = true ；这样适配器判断 movement command 完成时，会额外检查 lastNodeId 是否匹配已释放路线中的目标点，避免仅靠 node_states/edge_states 清空就提前完成。`
- 我看 state 报文中，last_node_id 不为空时，node_states/edge_states 都不为空，所以我没有理解你这句话的含义。

order_id: spa-...-1
order_update_id: 0/1/2
last_node_id: Point-19
last_node_sequence_id: 0

---

### codex 答复

```
• 这里还要区分两个“位置”：SPA 显示的车辆当前点位来自 kernel 的 Vehicle.position，它确实会被后续 Point-9 state 刷新；但在异常发生那一刻，kernel 已经因为前一个 Point-19 上报把发车开
  关关掉了，后面位置变成 Point-9 也不会自动恢复继续下发。

───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• 是的，你判断的异步场景一定会存在；但根因不是 MQTT 异步本身，而是 当前 VDA5050 适配器把 lastNodeId 直接当成 openTCS 的“当前位置”上报给 kernel，这个语义在行驶中不成立。

  根因

  在适配器里，state 处理顺序是：

  1. 收到 state
  2. 如果 lastNodeId 非空，立即执行 getProcessModel().setPosition(lastNodeId)
  3. 之后才调用 movementCommandManager.onStateMessage(...) 判断 movement command 是否完成

  对应代码：

  - D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/CommAdapterImpl.java:598
  - D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/MovementCommandManager.java:98

  而 kernel 收到位置更新时，会在当前已发送但未完成的 movement command 目标点里检查：

  expected one of: [Point-11, Point-10, Point-9]

  这些是 kernel 已经下发给适配器的后续目标点。此时 AGV 仍上报 lastNodeId=Point-19 是合理的，因为 VDA5050 里的 lastNodeId 表示“最后到达过的节点”，车辆从 Point-19 往 Point-11 行驶
  时，它本来就可能仍然是 Point-19。

  但 kernel 的 DefaultVehicleController.updatePositionWithOrder() 把它理解成“车辆现在上报自己在 Point-19”，于是触发：

  Reported position: Point-19, expected one of: [Point-11, Point-10, Point-9]

  然后 onUnexpectedPositionReported() 会把 sendingCommandsAllowed=false，所以后续不再继续下发 movement command，直到强制 reroute。

  对应代码：

  - src/main/java/org/opentcs/kernel/vehicles/DefaultVehicleController.java:1307
  - src/main/java/org/opentcs/kernel/vehicles/DefaultVehicleController.java:1522

  怎么从根源解决

  根本解法应该在 VDA5050 适配器侧做状态机容错，而不是改 AGV 的 state 上报机制。

  建议规则：

  1. 有活跃订单时，不要把任意 lastNodeId 直接 setPosition() 给 kernel。
  2. 只有当 lastNodeId 与已释放路线中的某个目标点匹配，并且对应 movement command 已满足完成条件时，才把该点作为 kernel 位置上报。
  3. 行驶过程中 lastNodeId 仍停留在上一节点时，只更新 agvPosition/pose，不要更新 kernel logical position。
  4. movementCommandManager 应先判定 command 完成，再由完成的 command 驱动 kernel 位置/commandExecuted，而不是先用裸 lastNodeId 更新位置。

  也就是说，适配器要把 lastNodeId 当成“车辆协议状态”，经过 command/order 语义校验后，才转换成 openTCS 的 Vehicle.position。

  关于 lastNodeIdRequiredForMovementCompletion=true

  你这个疑问是对的。更精确地说：

  vda5050:lastNodeIdRequiredForMovementCompletion=true 只能影响 MovementCommandManager.movementComplete() 的完成判定，不能阻止前面的 setPosition(lastNodeId)。

  也就是说，在当前代码顺序下，即使打开这个配置：

  state.lastNodeId=Point-19

  仍然会先触发：

  getProcessModel().setPosition("Point-19")

  然后 kernel 立刻报 unexpected position。这个报错发生在 movement completion 判定之前。

  所以这个配置只能防止另一类问题：当 nodeStates/edgeStates 已经被清空，但 lastNodeId 还没推进到目标点时，避免适配器过早认为 movement 完成。

  但你现在日志里的核心问题是：

  lastNodeId 还停留在 Point-19，被提前写入 kernel position

  因此 lastNodeIdRequiredForMovementCompletion=true 不是根治方案，最多是辅助保护。

  配置关系

  vda5050:maxStepsHorizon=0 不是根因。

  maxStepsBase 默认值是 2，适配器内部队列容量会表现为多条 movement command 已经进入“已发送/待完成”集合，所以 kernel 期望点里出现了：

  [Point-11, Point-10, Point-9]

  这会放大问题，但不是本质原因。即使把 base 调小，只要车辆行驶中继续上报上一节点 Point-19，当前适配器仍可能把它写给 kernel，然后触发同类问题。

  结论：根因是 适配器将 VDA5050 的 lastNodeId 直接映射成 openTCS 当前位置，且发生在 movement 完成判定之前。根治要改适配器的 state 处理逻辑，让 lastNodeId 经过订单进度校验后再更新
  kernel logical position。
```

### 继续提问

1. 评估方案: `改适配器的 state 处理逻辑，让 lastNodeId 经过订单进度校验后再更新  kernel logical positio` 的影响，输出影响范围，如果没有不良影响，请你直接在项目上修改吧。
- VDA5050 适配器源码目录：D:\byd_agv_njc\opentcs-commadapter-vda5050

### codex cli 答复

```

• 已评估并完成修改。

  影响范围很窄，只改 VDA5050 适配器两版实现：

  - D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v1_1/CommAdapterImpl.java:640
  - D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/CommAdapterImpl.java:647

  改动逻辑：

  - 车辆没有 sent commands 时，仍按原逻辑用 lastNodeId 更新 kernel position，不影响空闲定位/初始定位。
  - 车辆有 sent commands 时，只有 lastNodeId 属于当前已发送 movement command 的目标点，才更新 kernel position。
  - 如果 lastNodeId=Point-19，但 kernel 正在等待 [Point-11, Point-10, Point-9]，适配器会忽略这个滞后位置，只打 debug 日志，不再触发 kernel 的 Reported position: Point-19, expected
    one of...。

  - 到达 Point-11/Point-10/Point-9 后仍会正常更新位置，不影响后续 command 完成判断。

  我没有发现对当前任务场景的不良影响。唯一行为变化是：订单执行中，非当前 sent command 目标点的 lastNodeId 不再直接写入 kernel position；这正是为了避免 VDA5050 行驶中“上一到达节
  点”被 kernel 误判为异常当前位置。

  验证已通过：

  .\gradlew.bat test --tests org.opentcs.commadapter.vehicle.vda5050.v1_1.MovementCommandManagerTest --tests
  org.opentcs.commadapter.vehicle.vda5050.v2_0.MovementCommandManagerTest
  BUILD SUCCESSFUL

  另外，适配器工作区里已有未改动的脏文件：

  M src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/ordermapping/EdgeMapping.java
  M src/test/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/ordermapping/EdgeMappingTest.java

  这两个不是我这次修改的内容。
```

### commit

为 `根本解法应该在 VDA5050 适配器侧做状态机容错，而不是改 AGV 的 state 上报机制。` 的改动生成符合业界规范的commit信息，信息用中文输出，至少包含：

- 问题
- 解决方案
- ...

• fix(vda5050): 过滤订单执行中的滞后 lastNodeId 位置上报

  问题：
  VDA5050 state 中的 lastNodeId 表示车辆最后到达过的节点。车辆沿边行驶时，
  lastNodeId 可能仍停留在上一节点，例如车辆从 Point-19 前往 Point-11 时仍上报
  Point-19。适配器此前会将任意非空 lastNodeId 直接写入 kernel logical position，
  导致 kernel 在已下发后续 movement command 时误判车辆位置异常，并触发
  “Reported position: ..., expected one of: ...”，进而停止继续下发命令。

  解决方案：
  在 VDA5050 适配器侧增加订单执行中的位置上报过滤逻辑：
  - 无 sent commands 时，保留原有 lastNodeId 更新位置行为
  - 有 sent commands 时，仅当 lastNodeId 属于当前已发送 movement command 的目标点时，
    才更新 kernel position
  - 对上一节点等滞后 lastNodeId 只记录 debug 日志，不再上报为 kernel logical position
  - 同步修改 VDA5050 v1.1 和 v2.0 两套适配器实现

  影响范围：
  - 不修改 AGV state 上报机制
  - 不影响空闲车辆/无订单时的位置校准
  - 不影响车辆真正到达后续目标点时的位置更新
  - 避免 MQTT/state 异步导致的上一节点滞后值触发 kernel unexpected position

  验证：
  - 通过 VDA5050 v1.1 MovementCommandManagerTest
  - 通过 VDA5050 v2.0 MovementCommandManagerTest

## node.theta, edge.orientation

基于: VDA 5050 2.0.0 规范: https://github.com/VDA5050/VDA5050/tree/2.0.0 解释 order.schema 中 node.theta 的 edge.orientation 含义，使用方法，请举例说明，前进，后退场景下 node 坐标(x,y) theta, edge.orientation 的关系。

doubao 优化后的提示词：

```
参考 VDA 5050 2.0.0 正式规范（https://github.com/VDA5050/VDA5050/tree/2.0.0），针对 order.schema 中的 node.theta 和 edge.orientation 字段做完整解析：
1. 定义每个字段的业务含义、取值规则、适用场景；
2. 说明字段使用方式与协议约束；
3. 结合AGV正向前进、反向后退两大典型场景，搭配具体数值案例，梳理节点坐标(x, y)、node.theta、edge.orientation 三者的对应逻辑与联动关系。
```

### 继续提问

对于你的举例
`
  正向前进，orientationType=GLOBAL：

  start = (0, 0)
  end   = (2, 0)

  pathAngle = atan2(0, 2) = 0
  edge.orientation = 0
  node.theta at end = 0

  含义：车头朝 +X，车辆从 (0,0) 开到 (2,0)，正向行驶。

  反向后退，orientationType=GLOBAL：

  start = (0, 0)
  end   = (2, 0)

  pathAngle = 0
  edge.orientation = PI 或 -PI
  node.theta at end = PI 或 -PI

  含义：车辆位置仍从 (0,0) 移到 (2,0)，但车头朝 -X，车辆倒着向 +X 方向移动。
`
我有几个疑问：
1. 前进时 pathAngle = atan2(0, 2) = 0, edge.orientation = 0， 反向后退时 pathAngle = atan2(0, 2) = 0, edge.orientation = PI 或 -PI，同样的 pathAngle 值，但是得到的 orientation 不一样？
这个怎么区分，单单从坐标点(x,y)是无法区分的吧？是靠 vda5050:vehicleOrientation = BACKWARD 这样的属性来区分吗？我们的 vda5050 适配器就是根据 vda5050:vehicleOrientation 属性按照公式: orientation = normalize(atan2(destY - sourceY, destX - sourceX) + PI) 
来计算边角度的。

2. AGV 从 start(0, 0) 走到 end(2, 0), 充完电后，要离开充电区，此时的 start, end 的坐标就对调了，变成了 start(2, 0), end(0, 0), 此时的 pathAngle = atan2(0, -2)，结果还是 0，那么 edege.orientation 应该是多少呢？start.theta, end.theta 应该是多少呢？

### doubao优化提示词

```
结合VDA 5050 2.0.0规范，针对下方示例和我的两个疑问做专业解答、公式推演与场景说明：

参考示例（orientationType=GLOBAL）：
【正向前进】
start = (0, 0)
end   = (2, 0)
pathAngle = atan2(0, 2) = 0
edge.orientation = 0
终点node.theta = 0
说明：车头朝向+X，正向行驶

【反向后退】
start = (0, 0)
end   = (2, 0)
pathAngle = 0
edge.orientation = PI / -PI
终点node.theta = PI / -PI
说明：点位从(0,0)移动至(2,0)，车头朝向-X，倒车行进

我的疑问：
1. 相同起止坐标算出的pathAngle完全一致，但edge.orientation分为0和PI/-PI两种结果，仅依靠节点坐标无法区分前进/后退姿态，是否依靠字段 vda5050:vehicleOrientation = BACKWARD/FORWARD 来判定？
我方VDA5050适配器使用公式：orientation = normalize(atan2(destY - sourceY, destX - sourceX) + PI) 计算边角度，请结合该公式一同分析。

2. 场景延伸：AGV完成充电后原路离开，起止坐标对调为 start(2, 0)、end(0, 0)，此时 pathAngle = atan2(0, -2)，请计算并说明：edge.orientation、起点node.theta、终点node.theta 的合理取值，同时结合前进、后退两种工况分别解释。
```

edge.orientation 表示车辆在边上移动时候的朝向。注意，跟车辆移动的方向不是一个概念。

---

你对 `疑问 2：充电后原路离开` 的答复解答了我的疑问。刚好，我就遇到了这样一个AGV 从充电区出来的问题：

进入充电区时: Point-8 ---> Point-7, 车头朝向 -X，倒车前进。

充电完成后，从充电区原路离开: Point-7 ---> Point-8, 我希望AGV 是正向前进离开，此时的合理姿态应该是:

起点 node.theta = PI
edge.orientation = PI
终点 node.theta = PI

离开时，vda5050 适配器发送的实际订单数据如下，AGV 侧收到任务后执行失败了。

我怀疑是 node: Point-7 的 theta = 0 导致，按照前面的解释，Point-7 的 theta 应该是 PI，你觉得我的猜测是否正确？

如果我的猜测正确的话，我们在 v2_0\ordermapping\OrderMapper.java 的 adjustNodeThetas 是不是也要根据属性 vda5050:vehicleOrientation = BACKWARD, 对于计算出来的 theta 在加上 PI，跟 edgeOrientation 一样？
```json
{
    "headerId": 0,
    "timestamp": "2026-06-12T03:49:33.534122400Z",
    "version": "2.0.0",
    "manufacturer": "BYD_11",
    "serialNumber": "DP0055",
    "orderId": "spa-178123615782901KTWZ5KCCZF0AJ481Z700W8H1-1",
    "orderUpdateId": 0,
    "nodes": [
        {
            "nodeId": "Point-7",
            "sequenceId": 0,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 11.407,
                "y": -7.193,
                "mapId": "HZ27",
                "theta": 0,
                "allowedDeviationXY": 0.01,
                "allowedDeviationTheta": 3.141592653589793
            }
        },
        {
            "nodeId": "Point-8",
            "sequenceId": 2,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 9.4,
                "y": -7.188,
                "mapId": "HZ27",
                "theta": 3.139101378225614
            }
        }
    ],
    "edges": [
        {
            "edgeId": "Point-7 --- Point-8",
            "sequenceId": 1,
            "released": true,
            "startNodeId": "Point-7",
            "endNodeId": "Point-8",
            "actions": [],
            "maxSpeed": 0.2,
            "orientation": 3.139101378225614
        }
    ]
}
```

### doubao 优化后的提示词

```
基于此前VDA 5050 2.0.0 node.theta、edge.orientation、车辆朝向的角度规则，排查AGV充电区驶出执行失败问题。

### 业务场景
1. 驶入充电区：路线 Point-8 → Point-7，AGV 车头朝向 -X，以倒车模式行驶；
2. 驶出充电区：原路折返 Point-7 → Point-8，业务要求 AGV **正向前进**离开。

### 预期姿态（正向驶出）
起点 Point-7 node.theta = PI
边 edge.orientation = PI
终点 Point-8 node.theta = PI

### 问题现象
适配器实际下发的VDA5050订单报文如下，AGV 接收任务后执行失败。
我的初步判断：故障由起点 Point-7 的 node.theta 被赋值为 0（与预期 PI 不符）导致。

请完成两点分析：
1. 判定我的上述猜测是否成立，并结合协议与角度逻辑说明原因；
2. 若问题确实出在 node.theta 计算逻辑，请分析：
   代码文件 v2_0/ordermapping/OrderMapper.java 中的 adjustNodeThetas 方法，是否需要读取 vda5050:vehicleOrientation = BACKWARD 标识，对原始计算得到的 theta 额外加上 PI，统一对齐 edgeOrientation 的计算规则。

【实际订单报文】
{
    "headerId": 0,
    "timestamp": "2026-06-12T03:49:33.534122400Z",
    "version": "2.0.0",
    "manufacturer": "BYD_11",
    "serialNumber": "DP0055",
    "orderId": "spa-178123615782901KTWZ5KCCZF0AJ481Z700W8H1-1",
    "orderUpdateId": 0,
    "nodes": [
        {
            "nodeId": "Point-7",
            "sequenceId": 0,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 11.407,
                "y": -7.193,
                "mapId": "HZ27",
                "theta": 0,
                "allowedDeviationXY": 0.01,
                "allowedDeviationTheta": 3.141592653589793
            }
        },
        {
            "nodeId": "Point-8",
            "sequenceId": 2,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 9.4,
                "y": -7.188,
                "mapId": "HZ27",
                "theta": 3.139101378225614
            }
        }
    ],
    "edges": [
        {
            "edgeId": "Point-7 --- Point-8",
            "sequenceId": 1,
            "released": true,
            "startNodeId": "Point-7",
            "endNodeId": "Point-8",
            "actions": [],
            "maxSpeed": 0.2,
            "orientation": 3.139101378225614
        }
    ]
}
```

---

关于 `修复方向`，我补充信息如下：

1. Point-7 --- Point-8 业务要求正向驶出，但是我当前配置了边(7--->8)属性 vda5050:vehicleOrientation=BACKWARD, 按照你的`建议逻辑`，正向驶出时应该配置 FORWARD；
2. 如果配置了 FORWARD, 那对于 Point-7 --- Point-8 的坐标：
  Point-7 = (11.407, -7.193)
  Point-8 = (9.4,   -7.188)

  dx = 9.4 - 11.407 = -2.007
  dy = -7.188 - (-7.193) = 0.005

  pathAngle = atan2(0.005, -2.007) = 3.139101378 rad ≈ 179.857°
  如果 Point-7, Point-8 的 y 坐标相同( -7.193 跟-7.188 几乎相等了), 那 dy=0, atan2(0, -2.007) 的结果是 0 吧，又因为 vda5050:vehicleOrientation = FORWARD, 因此 pathAngle = 0, 那么会要求 AGV 旋转，但是此时 AGV 是对接充电插头的，站位空间不支持旋转。

  针对上面的困境，该如何在业务逻辑是正向驶出时，又能计算边的角度为 normalize(pathAngle + PI) ？

```
基于VDA 5050 2.0.0规范、此前角度计算逻辑与现场工况，分析问题并提供解决方案。

### 一、业务背景与配置现状
行驶路线：Point-7 → Point-8，业务目标：AGV **正向驶出充电区**。
当前配置：该边属性 vda5050:vehicleOrientation=BACKWARD；按照协议逻辑，正向行驶本应配置为 FORWARD。

### 二、坐标与角度计算
坐标数据：
Point-7：(11.407, -7.193)
Point-8：(9.4, -7.188)

差值计算：
dx = 9.4 - 11.407 = -2.007
dy = -7.188 - (-7.193) = 0.005

pathAngle = atan2(dy, dx) = atan2(0.005, -2.007) ≈ 3.1391 rad

### 三、现存矛盾
1. 若将属性改为标准正向配置 vehicleOrientation=FORWARD；
2. 两点Y值几乎一致，可近似看作 dy=0(直线路径的两个点的y坐标可能相等)，此时 pathAngle = atan2(0, -2.007) ≈ 0；
3. 姿态角度与路径方向不匹配，VDA5050会要求AGV在节点原地旋转；
4. 约束限制：AGV处于充电对接位置，**物理空间不允许原地旋转**。

### 四、核心诉求
在不改变「业务为正向驶出」的前提下，如何能得到正确的边角度，节点角度？例如，上面示例中的边角度应该是: orientation = normalize(pathAngle + PI)
以此避开原地旋转的问题，请分析可行方案、适配规则与实现思路。
  ```

### 答复

先纠正一个关键前提

  atan2(0, -2.007) 的结果不是 0，而是：

  atan2(0, -2.007) = PI

  也就是朝向 -X。所以如果 Point-7 -> Point-8 是正向驶出，且两点近似水平：

  Point-7 = (11.407, -7.193)
  Point-8 = (9.4,   -7.188)

  dx = -2.007
  dy = 0.005

  pathAngle = atan2(0.005, -2.007)
            = 3.139101378 rad
            ≈ PI

  即使 dy=0：

  pathAngle = atan2(0, -2.007) = PI

  因此，正向驶出时正确角度本来就是 PI 附近，不需要为了得到 PI 再额外 +PI。

  VDA 5050 中，node.theta 表示节点上的 AGV 朝向；如果定义了，AGV 必须在该节点采用该角度。edge.orientation 表示边上的 AGV 朝向；若车辆进入边时朝向不同，需要根据 rotationAllowed
  在边上或入边前旋转，否则可拒绝订单。见 VDA 5050 2.0.0 order.schema 对 nodePosition.theta 和 edge.orientation 的说明。(order.schema
  (https://raw.githubusercontent.com/VDA5050/VDA5050/2.0.0/json_schemas/order.schema))

  当前配置矛盾

  你的业务目标是：

  Point-7 -> Point-8
  AGV 正向驶出充电区

  那语义上应是：

  vda5050:vehicleOrientation = FORWARD

  当前却配置为：

  vda5050:vehicleOrientation = BACKWARD

  这会让适配器按“倒车”语义处理，包括 reverse 速度、reverse orientation 规则。对于 Point-7 -> Point-8：

  pathAngle ≈ PI

  如果按 FORWARD：

  edge.orientation = normalize(pathAngle)
                   ≈ PI

  如果按 BACKWARD：

  edge.orientation = normalize(pathAngle + PI)
                   ≈ normalize(2PI)
                   = 0

  也就是说，normalize(pathAngle + PI) 对这条驶出边表达的是倒车驶出，不是正向驶出。它会让车头朝 +X，但车辆位置从 Point-7 往 Point-8，也就是向 -X 移动，这正是倒车语义。

  正向驶出的正确姿态

  对于 Point-7 -> Point-8 正向驶出：

  pathAngle = atan2(Point8.y - Point7.y, Point8.x - Point7.x)
            ≈ 3.1391 rad

  合理值应为：

  起点 Point-7 node.theta = 3.1391 rad
  边 edge.orientation     = 3.1391 rad
  终点 Point-8 node.theta = 3.1391 rad

  如果近似 dy=0：

  起点 Point-7 node.theta = PI
  边 edge.orientation     = PI
  终点 Point-8 node.theta = PI

  这样 AGV 充电完成后如果车头本来朝 -X，驶出时直接正向前进，不需要在充电对接位原地旋转。

  为什么现场会出现旋转/失败

  你之前的实际订单里出现过：

  Point-7.theta = 0
  edge.orientation ≈ 3.1391
  Point-8.theta ≈ 3.1391

  这才是真正的问题。

  起点节点要求车头朝 +X，但边要求车头朝 -X。两者相差约 PI，AGV 就可能尝试在 Point-7 原地转向，或者因无法满足姿态切换而拒绝/失败。

  这个问题不是由 FORWARD 本身导致的，而是 OrderMapper.adjustNodeThetas() 里首节点 theta 的计算方式有缺陷：

  if (i == 0) {
    theta = atan2(currentNode - vehiclePosition)
  }

  当车辆已经在 Point-7 附近时：

  currentNode ≈ vehiclePosition
  atan2(0, 0) = 0

  于是起点 theta 被错误赋成 0。

  推荐方案

  配置层面，Point-7 -> Point-8 必须表达正向驶出：

  <property name="vda5050:vehicleOrientation" value="FORWARD"/>
  <property name="vda5050:orientationType.forward" value="GLOBAL"/>

  不应为了得到某个角度继续配置 BACKWARD。BACKWARD 是倒车语义，会让速度、姿态规则都进入 reverse 分支。

  代码层面，应修正 node.theta 的自动计算规则：节点 theta 应与相邻边的“车辆实际朝向”对齐，而不是首节点用“车辆当前位置到节点”的向量计算。

  建议规则：

  pathAngle = atan2(destY - sourceY, destX - sourceX)

  FORWARD:
    heading = normalize(pathAngle)

  BACKWARD:
    heading = normalize(pathAngle + PI)

  然后：

  边 edge.orientation = heading

  起点 node.theta:
    优先取下一条 edge 的 heading


  对当前驶出边：

  vehicleOrientation = FORWARD
  heading = normalize(pathAngle)
          ≈ 3.1391

  "nodes": [
    {
      "nodeId": "Point-7",
      "nodePosition": {
        "theta": 3.139101378225614
      }
    },
    {
      "nodeId": "Point-8",
      "nodePosition": {
        "theta": 3.139101378225614
      }
    }
  ],
  "edges": [
    {
      "edgeId": "Point-7 --- Point-8",
      "orientation": 3.139101378225614,
      "orientationType": "GLOBAL"
    }
  ]

  最终判断

  你提出的 orientation = normalize(pathAngle + PI) 只适用于倒车。对于当前“正向驶出 Point-7 -> Point-8”，正确规则是：

  真正需要修的是：

  Point-7 起点 node.theta 不应由 atan2(node - vehiclePosition) 算出 0；
  它应对齐下一条边的实际行驶朝向，即约 PI。

---

### 要求修改

你解释的非常清楚，我也理解了失败的原因在于 Point-7 节点的 theta = 0。

请你按照 `推荐方案` 中的规则，直接在项目中修改边和节点的角度计算方法。

---

为上面的改动生成符合业界规范的commit信息，信息用中文输出，至少包含：

- 问题
- 解决方案
- ...

### codex 改动

  本次主要改了 src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/ordermapping/OrderMapper.java:325：

  - 调整顺序：先计算/补齐 edge.orientation，再计算 node.theta。
  - node.theta 优先对齐相邻边的实际车辆朝向：
      - 起点节点优先取下一条 edge 的绝对朝向。
      - 终点/中间节点优先取上一条 edge 的绝对朝向。

  - 支持按 orientationType 解释：
      - GLOBAL：直接使用 edge.orientation。
      - TANGENTIAL 或未配置：按 pathAngle + edge.orientation 转成绝对朝向。

  - 对自动计算出的边角度，设置 orientationType=GLOBAL，避免 AGV 端按默认 TANGENTIAL 误解。
  - 保留无相邻边时的旧兜底逻辑，比如单节点任务仍从车辆当前位置计算 theta。

  针对你的驶出场景 Point-7 -> Point-8，只要配置为正向：

  <property name="vda5050:vehicleOrientation" value="FORWARD"/>
  <property name="vda5050:orientationType.forward" value="GLOBAL"/>

  下发结果会对齐为：

  Point-7 node.theta ≈ 3.1391
  edge.orientation   ≈ 3.1391
  Point-8 node.theta ≈ 3.1391

  这样不会再因为首节点 theta=0 导致车辆在充电对接位尝试原地旋转。

  已补充测试：src/test/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/ordermapping/OrderMapperTest.java:488。

  验证通过：

  .\gradlew test --tests org.opentcs.commadapter.vehicle.vda5050.v2_0.ordermapping.OrderMapperTest --tests
  org.opentcs.commadapter.vehicle.vda5050.v2_0.ordermapping.EdgeMappingTest
  .\gradlew test --tests org.opentcs.commadapter.vehicle.vda5050.v2_0.ordermapping.*

### commit 信息

```
• fix: 修正节点 theta 与边行驶朝向不一致的问题

  问题：
  充电区正向驶出场景中，AGV 路线为 Point-7 -> Point-8，
  业务要求车辆保持车头朝 -X 正向驶离。但首节点 theta 由
  “车辆当前位置到当前节点”的向量计算，当车辆已位于 Point-7
  附近时 atan2(0, 0) 被计算为 0，导致下发报文出现：

  - Point-7 node.theta = 0
  - edge.orientation ≈ PI
  - Point-8 node.theta ≈ PI

  起点节点姿态与边行驶姿态相差约 PI，AGV 可能尝试在充电对接位
  原地旋转，进而导致任务执行失败。

  解决方案：
  调整 VDA5050 v2.0 订单角度计算逻辑：

  - 先计算/补齐 edge.orientation，再计算 node.theta
  - node.theta 优先对齐相邻边的实际车辆朝向
    - 起点节点优先取下一条 edge 的绝对朝向
    - 中间/终点节点优先取上一条 edge 的绝对朝向
  - 按 orientationType 正确解释 edge.orientation
    - GLOBAL：直接使用 edge.orientation
    - TANGENTIAL 或未配置：使用 pathAngle + edge.orientation 转为绝对朝向
  - 自动计算 edge.orientation 时同步设置 orientationType=GLOBAL，
    避免 AGV 端按默认 TANGENTIAL 误解角度
  - 保留无相邻边时的旧兜底逻辑，单节点任务仍按车辆当前位置计算 theta

  使用条件：
  正向驶出充电区时，路径边应配置为正向行驶：

  <property name="vda5050:vehicleOrientation" value="FORWARD"/>
  <property name="vda5050:orientationType.forward" value="GLOBAL"/>

  效果：
  对于 Point-7 -> Point-8 正向驶出场景，报文中的姿态将对齐为：

  - Point-7 node.theta ≈ PI
  - edge.orientation ≈ PI
  - Point-8 node.theta ≈ PI

  从而避免起点姿态错误触发原地旋转。

  测试：
  新增并更新 OrderMapperTest，覆盖首节点 theta 对齐正向 GLOBAL
  边角度的场景，并验证 OrderMapper/EdgeMapping 相关测试通过。
```