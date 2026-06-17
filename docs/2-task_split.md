
2026-06-10

## 任务场景-1

执行车辆： Vehicle-1

Point-19(MOVE) ---> Point-11(MOVE) ---> Point-10(PARK)

### AGV 侧订阅的 order 信息如下：

topic: VDA/V2.0.0/BYD_11/DP0055/order

第一段: Point-19 --- Point-11
```json
{
    "headerId": 0,
    "timestamp": "2026-06-10T06:31:31.264158400Z",
    "version": "2.0.0",
    "manufacturer": "BYD_11",
    "serialNumber": "DP0055",
    "orderId": "spa-178107308487401KTR3N0EW1BAF8VDN3MK7FWXM-1",
    "orderUpdateId": 0,
    "nodes": [
        {
            "nodeId": "Point-19",
            "sequenceId": 0,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -1.15,
                "mapId": "HZ27",
                "theta": -2.8753406044388705,
                "allowedDeviationXY": 0.032803508501982756,
                "allowedDeviationTheta": 3.141592653589793
            }
        },
        {
            "nodeId": "Point-11",
            "sequenceId": 2,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -2.8,
                "mapId": "HZ27",
                "theta": -1.5707963267948966
            }
        }
    ],
    "edges": [
        {
            "edgeId": "Point-19 --- Point-11",
            "sequenceId": 1,
            "released": true,
            "startNodeId": "Point-19",
            "endNodeId": "Point-11",
            "actions": [],
            "maxSpeed": 1,
            "orientation": -1.5707963267948966,
            "orientationType": "GLOBAL"
        }
    ]
}
```

第二段: Point-11 --- Point-10
```json
{
    "headerId": 1,
    "timestamp": "2026-06-10T06:31:44.072021200Z",
    "version": "2.0.0",
    "manufacturer": "BYD_11",
    "serialNumber": "DP0055",
    "orderId": "spa-178107308487401KTR3N0EW1BAF8VDN3MK7FWXM-2",
    "orderUpdateId": 0,
    "nodes": [
        {
            "nodeId": "Point-11",
            "sequenceId": 0,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -2.8,
                "mapId": "HZ27",
                "theta": 2.356194490192456,
                "allowedDeviationXY": 0.01282842712474619,
                "allowedDeviationTheta": 3.141592653589793
            }
        },
        {
            "nodeId": "Point-10",
            "sequenceId": 2,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -4.1,
                "mapId": "HZ27",
                "theta": -1.5707963267948966
            }
        }
    ],
    "edges": [
        {
            "edgeId": "Point-11 --- Point-10",
            "sequenceId": 1,
            "released": true,
            "startNodeId": "Point-11",
            "endNodeId": "Point-10",
            "actions": [],
            "maxSpeed": 1,
            "orientation": -1.5707963267948966,
            "orientationType": "GLOBAL"
        }
    ]
}
```

## 任务场景-2

执行车辆： Vehicle-1

Point-10(MOVE) ---> Point-19(PARK)

### AGV 侧订阅的 order 信息如下：


第一段：Point-10 --- Point-11 --- Point-19
```json
{
    "headerId": 2,
    "timestamp": "2026-06-10T06:33:41.172943800Z",
    "version": "2.0.0",
    "manufacturer": "BYD_11",
    "serialNumber": "DP0055",
    "orderId": "spa-178107321619301KTR3S0P8GBN54RJ2AMN50JG7-1",
    "orderUpdateId": 0,
    "nodes": [
        {
            "nodeId": "Point-10",
            "sequenceId": 0,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -4.1,
                "mapId": "HZ27",
                "theta": -2.8966139904630337,
                "allowedDeviationXY": 0.01412310562561766,
                "allowedDeviationTheta": 3.141592653589793
            }
        },
        {
            "nodeId": "Point-11",
            "sequenceId": 2,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -2.8,
                "mapId": "HZ27",
                "theta": 1.5707963267948966
            }
        },
        {
            "nodeId": "Point-19",
            "sequenceId": 4,
            "released": false,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -1.15,
                "mapId": "HZ27",
                "theta": 1.5707963267948966
            }
        }
    ],
    "edges": [
        {
            "edgeId": "Point-10 --- Point-11",
            "sequenceId": 1,
            "released": true,
            "startNodeId": "Point-10",
            "endNodeId": "Point-11",
            "actions": [],
            "maxSpeed": 1,
            "orientation": 1.5707963267948966,
            "orientationType": "GLOBAL"
        },
        {
            "edgeId": "Point-11 --- Point-19",
            "sequenceId": 3,
            "released": false,
            "startNodeId": "Point-11",
            "endNodeId": "Point-19",
            "actions": [],
            "maxSpeed": 1,
            "orientation": 1.5707963267948966,
            "orientationType": "GLOBAL"
        }
    ]
}
```

第二段: Point-11 --- Point-19, "orderUpdateId": 1
```json
{
    "headerId": 3,
    "timestamp": "2026-06-10T06:33:41.195138900Z",
    "version": "2.0.0",
    "manufacturer": "BYD_11",
    "serialNumber": "DP0055",
    "orderId": "spa-178107321619301KTR3S0P8GBN54RJ2AMN50JG7-1",
    "orderUpdateId": 1,
    "nodes": [
        {
            "nodeId": "Point-11",
            "sequenceId": 2,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -2.8,
                "mapId": "HZ27",
                "theta": 1.5738756088251926
            }
        },
        {
            "nodeId": "Point-19",
            "sequenceId": 4,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -1.15,
                "mapId": "HZ27",
                "theta": 1.5707963267948966
            }
        }
    ],
    "edges": [
        {
            "edgeId": "Point-11 --- Point-19",
            "sequenceId": 3,
            "released": true,
            "startNodeId": "Point-11",
            "endNodeId": "Point-19",
            "actions": [],
            "maxSpeed": 1,
            "orientation": 1.5707963267948966,
            "orientationType": "GLOBAL"
        }
    ]
}
```

第三段: Point-11 --- Point-19, "orderUpdateId": 1
```json
{
    "headerId": 4,
    "timestamp": "2026-06-10T06:33:41.204456800Z",
    "version": "2.0.0",
    "manufacturer": "BYD_11",
    "serialNumber": "DP0055",
    "orderId": "spa-178107321619301KTR3S0P8GBN54RJ2AMN50JG7-1",
    "orderUpdateId": 1,
    "nodes": [
        {
            "nodeId": "Point-11",
            "sequenceId": 2,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -2.8,
                "mapId": "HZ27",
                "theta": 1.5738756088251926
            }
        },
        {
            "nodeId": "Point-19",
            "sequenceId": 4,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -1.15,
                "mapId": "HZ27",
                "theta": 1.5707963267948966
            }
        }
    ],
    "edges": [
        {
            "edgeId": "Point-11 --- Point-19",
            "sequenceId": 3,
            "released": true,
            "startNodeId": "Point-11",
            "endNodeId": "Point-19",
            "actions": [],
            "maxSpeed": 1,
            "orientation": 1.5707963267948966,
            "orientationType": "GLOBAL"
        }
    ]
}
```

## 任务执行结果

1. 场景-1 的任务执行成功
2. 场景-2 的任务执行失败, agv_task_manager 的日志信息：
```log
[2026-06-10 14:33:42.090] [agv_task_manager] [info] [28282] Received order_id: spa-178107321619301KTR3S0P8GBN54RJ2AMN50JG7-1, order_update_id: 0, data_origin: rcs
[2026-06-10 14:33:42.090] [agv_task_manager] [info] [28282] Handling new order: spa-178107321619301KTR3S0P8GBN54RJ2AMN50JG7-1
[2026-06-10 14:33:42.090] [agv_task_manager] [info] [28282] MoveAction
[2026-06-10 14:33:42.090] [agv_task_manager] [info] [28282] Set new_base_request to: false
[2026-06-10 14:33:42.090] [agv_task_manager] [warning] [28282] order push: spa-178107321619301KTR3S0P8GBN54RJ2AMN50JG7-1, order total: 0
[2026-06-10 14:33:42.090] [agv_task_manager] [info] [28279] Processing order:  (update_id: 0)
[2026-06-10 14:33:42.090] [agv_task_manager] [info] [28279] GetCurrentTask success, task type: move
[2026-06-10 14:33:42.091] [agv_task_manager] [info] [28279] Detected pause in behavior tree execution: 111426 ms
[2026-06-10 14:33:42.091] [agv_task_manager] [info] [28279] Published path with 3 nodes and 2 edges
[2026-06-10 14:33:42.091] [agv_task_manager] [info] [28279] Node[0]: id=Point-10, pos=(9.85, -4.1, -2.8966139904630337)
[2026-06-10 14:33:42.091] [agv_task_manager] [info] [28279] Edge[1]: id=Point-10 --- Point-11, speed=1
[2026-06-10 14:33:42.091] [agv_task_manager] [info] [28279] Node[2]: id=Point-11, pos=(9.85, -2.8, 1.5707963267948966)
[2026-06-10 14:33:42.091] [agv_task_manager] [info] [28279] Edge[3]: id=Point-11 --- Point-19, speed=1
[2026-06-10 14:33:42.091] [agv_task_manager] [info] [28279] Node[4]: id=Point-19, pos=(9.85, -1.15, 1.5707963267948966)
[2026-06-10 14:33:42.107] [agv_task_manager] [info] [28280] Received order_id: spa-178107321619301KTR3S0P8GBN54RJ2AMN50JG7-1, order_update_id: 1, data_origin: rcs
[2026-06-10 14:33:42.107] [agv_task_manager] [info] [28280] Handling Update order:spa-178107321619301KTR3S0P8GBN54RJ2AMN50JG7-1 , update_id: 1
[2026-06-10 14:33:42.107] [agv_task_manager] [info] [28280] MoveAction
[2026-06-10 14:33:42.108] [agv_task_manager] [info] [28280] Set new_base_request to: false
[2026-06-10 14:33:42.108] [agv_task_manager] [warning] [28280] Order update received but BT is running, skipping
[2026-06-10 14:33:42.111] [agv_task_manager] [warning] [28279] Prepared next move task with 2 nodes and 1 edges
[2026-06-10 14:33:42.111] [agv_task_manager] [info] [28279] Published path with 2 nodes and 1 edges
[2026-06-10 14:33:42.111] [agv_task_manager] [info] [28279] Node[2]: id=Point-11, pos=(9.85, -2.8, 1.5738756088251926)
[2026-06-10 14:33:42.111] [agv_task_manager] [info] [28279] Edge[3]: id=Point-11 --- Point-19, speed=1
[2026-06-10 14:33:42.111] [agv_task_manager] [info] [28279] Node[4]: id=Point-19, pos=(9.85, -1.15, 1.5707963267948966)
[2026-06-10 14:33:42.112] [agv_task_manager] [error] [28266] Move task action fail, error_msg: move param
[2026-06-10 14:33:42.113] [agv_task_manager] [info] [28282] Received order_id: spa-178107321619301KTR3S0P8GBN54RJ2AMN50JG7-1, order_update_id: 1, data_origin: rcs
[2026-06-10 14:33:42.114] [agv_task_manager] [error] [28282] Received new order, but agv has existing errors.
[2026-06-10 14:33:42.121] [agv_task_manager] [error] [28279] Move Action aborted!
[2026-06-10 14:33:42.124] [agv_task_manager] [info] [28279] order execution finished, result: FAILED
```

## 我的分析

1. 场景-1 中的任务包含 3个 Point, opentcs 自动将其拆分为了两个子任务，分别是 Point-19 --- Point-11, Point-11 --- Point-10
2. 场景-2 中的任务包含 2个 Point, 但是从 Point-10 到 Point-19 必须经过 Point-11, opentcs 先是发布了一个包含3个点的任务，后续又发布了两个子任务，两个子任务的内容除了
headerId 和 timestamp 不一样，其余都一样。

## 疑问

1. 场景-2中 opentcs 发布了3个任务，他们之间有什么联系？这种任务划分的依据/逻辑是什么样的？

2. 对于这种任务，opentcs 发布的订单通用逻辑是什么样的？
    - 任务场景：任务序列包含 A, B 两个点，但是 从 A 到 B 的路径上，还有其他的节点。

3. 场景-2 中的3个order, 他们的 orderUpdateId 取值不一样，orderUpdateId 的作用是什么，在什么场景下使用？

---

## 分界线

忽略从当前章节【## 分界线】开始的后续所有内容。

---

## 发给 codex cli 的提示词


```text
请基于我提供的 md 文档内容，分析并回答以下 3 个问题：

md 文档: D:\byd_agv_njc\opentcs\docs\task_split.md

1. 场景 2 中 openTCS 先后发布了 3 个 order，它们之间是什么关系？任务划分的依据和逻辑是什么？
2. openTCS 对于起点 A 到终点 B 之间存在中间节点的任务，生成、拆分、下发订单的通用逻辑是什么？
3. orderUpdateId 的作用是什么？在什么场景下会被使用？不同 orderUpdateId 代表什么含义？

请分析本文件中【## 任务场景-1】到【## 疑问】之间的所有内容，忽略从当前章节【## 发给 codex cli 的提示词】开始的后续所有内容。

```

### codex cli 的回答

```
 1. 场景 2 的 3 个 order 是什么关系
  它们不是 3 个独立任务，而是 同一个 VDA5050 order 的初始下发 + 后续更新/重复发送。

  从文档看，三段都有同一个：

  "orderId": "spa-178107321619301KTR3S0P8GBN54RJ2AMN50JG7-1"

  区别是：

  第一段 orderUpdateId = 0
  第二段 orderUpdateId = 1
  第三段 orderUpdateId = 1

  含义是：

  - 第一段：初始 order，包含当前可执行 base 部分 Point-10 -> Point-11，以及未释放的 horizon 部分 Point-11 -> Point-19
  - 第二段：同一个 order 的更新，把原 horizon 中的 Point-11 -> Point-19 释放为 base
  - 第三段：和第二段内容相同，属于同一个 orderId + orderUpdateId=1 的重复发送，不是新任务

  代码依据：

  - VDA orderId 来自 transport order + 当前 drive order index：D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/ordermapping/
    OrderMapper.java:447

  - orderUpdateId 来自 route step index：D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/ordermapping/OrderMapper.java:183
  - 每个 MovementCommand 对应一个 route step：src/main/java/org/opentcs/kernel/vehicles/MovementCommandMapper.java:63

  场景 2 的路线是：

  Point-10 -> Point-11 -> Point-19

  但业务目标只有一个最终目标 Point-19，Point-11 是路由中间点。因此 adapter 第一次下发时把：

  Point-10 -> Point-11

  作为已释放 base，把：

  Point-11 -> Point-19

  作为未释放 horizon。

  这不是 openTCS 把任务拆成 3 个子任务，而是 VDA5050 的 base/horizon 分段释放机制。

  2. A 到 B 中间有节点时的通用逻辑
  假设业务任务是：

  A -> B

  但路由实际是：

  A -> M1 -> M2 -> B

  openTCS/VDA adapter 的通用逻辑是：

  1. openTCS router 计算完整 Route：

  Step0: A  -> M1
  Step1: M1 -> M2
  Step2: M2 -> B

  2. kernel 把每个 Route.Step 转成一个 MovementCommand。

  代码：src/main/java/org/opentcs/kernel/vehicles/MovementCommandMapper.java:63

  3. VDA adapter 收到第一个 command 时，生成一个 VDA order：

  base:    A -> M1       released=true
  horizon: M1 -> M2 -> B released=false

  代码：createOrderWithMovement() 会先加当前 step，再调用 mapHorizon()：D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/
  ordermapping/OrderMapper.java:144

  4. 当车辆执行完/接受当前 base 后，kernel/adpater 继续发送下一个 MovementCommand，同一个 orderId 下发新的 orderUpdateId，把下一段 horizon 释放出来：

  base:    M1 -> M2      released=true
  horizon: M2 -> B       released=false

  5. 最后再释放：

  base: M2 -> B released=true

  如果路径只有两段，比如场景 2：

  Point-10 -> Point-11 -> Point-19

  所以你看到：

  初始 orderUpdateId=0:
    released: Point-10 -> Point-11
    horizon:  Point-11 -> Point-19

  更新 orderUpdateId=1:
    released: Point-11 -> Point-19

  场景 1 不一样，因为它的业务序列本身包含多个目标点：

  Point-19(MOVE) -> Point-11(MOVE) -> Point-10(PARK)

  这里 Point-11 不是路由中间点，而是业务目的地，所以 openTCS 会形成多个 DriveOrder。你看到两个不同的 VDA orderId：

  ...-1
  ...-2

  这代表不同 DriveOrder，不是同一个 order 的 update。

  3. orderUpdateId 的作用
  orderUpdateId 是 同一个 VDA orderId 下的版本号/更新号。

  它的作用是让 AGV 区分：

  这是同一个订单的初始版本？
  还是同一个订单的后续更新？
  还是重复发送的旧版本？

  在 VDA5050 里，判断一个 order 通常看组合键：

  orderId + orderUpdateId

  当前 adapter 里，MessageResponseMatcher 也用这两个字段判断车辆是否确认了当前 order：

  D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/MessageResponseMatcher.java:221

  return Objects.equals(state.getOrderId(), order.getOrderId())
      && Objects.equals(state.getOrderUpdateId(), order.getOrderUpdateId());

  不同取值含义：

  orderUpdateId = 0
    同一个 orderId 的初始下发

  orderUpdateId = 1, 2, 3...
    同一个 orderId 的后续更新，通常用于释放 horizon、扩展/更新路径

  相同 orderId + 相同 orderUpdateId 重复出现
    重复发送同一版本，不代表新任务

  场景 2 的第二段和第三段都是：

  orderId 相同
  orderUpdateId = 1
  nodes/edges 基本相同

  所以它们语义上是同一个 update。重复的原因在发送队列逻辑里：如果 adapter 还没从车辆 state 中看到对应 orderId + orderUpdateId，会继续发送队首请求。

  代码：D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/MessageResponseMatcher.java:165

  else {
    sendNextOrder();
  }

  因此场景 2 失败的关键不应理解成“openTCS 创建了 3 个任务”，而应理解成：

  同一个 VDA order：
    初始版本 orderUpdateId=0
    更新版本 orderUpdateId=1
    orderUpdateId=1 被重复发送了一次

  AGV 侧应该对相同 orderId + orderUpdateId 的重复消息做幂等处理。
```

## opentcs 什么情况下会重复发送任务？

```
关于场景-2中的`第三段：和第二段内容相同，属于同一个 orderId + orderUpdateId=1 的重复发送，不是新任务`:
  1. 什么情况下会重复发送任务？
  2. 重复发送的任务会给AGV侧的任务执行造成不良影响吗？
```

### codex cli 答复

```
• 1. 什么情况下会重复发送任务
  在当前 VDA5050 adapter 里，重复发送发生在：adapter 已经发送了某个 order/update，但还没有从 AGV 的 state 中看到对应的 orderId + orderUpdateId 确认。

  关键代码在 MessageResponseMatcher.onStateMessage()。

  如果当前队首请求还没有被确认：

  if (requestAcknowledged(currentRequest, state)) {
    requests.poll();
    ...
    sendNextOrder();
  }
  else {
    sendNextOrder();
  }

  也就是说，只要收到 AGV state，但这个 state 里还不是当前等待确认的：

  orderId == 当前发送的 orderId
  orderUpdateId == 当前发送的 orderUpdateId

  adapter 就会再次调用 sendNextOrder()，把队首 order 再发一遍。

  确认逻辑是：

  return Objects.equals(state.getOrderId(), order.getOrderId())
      && Objects.equals(state.getOrderUpdateId(), order.getOrderUpdateId());

  所以场景 2 很可能是这个时序：

  T1 adapter 发送 orderUpdateId=1
  T2 AGV 很快又上报了一帧 state，但 state 里仍然是旧的 orderUpdateId=0
  T3 adapter 判断“还没确认 updateId=1”
  T4 adapter 再次发送同一个 orderUpdateId=1

  你的文档里第二段和第三段 timestamp 只差大约 9ms，很符合这种“state 回报还没来得及更新，adapter 立即重发”的现象。

  常见触发场景：

  - AGV 收到 order 后，state 上报延迟
  - AGV state 仍停留在旧 orderUpdateId
  - MQTT 消息/状态更新有时序差
  - AGV 没有及时把新 order 的 orderId/orderUpdateId 回写到 state

  因为相同的：

  orderId + orderUpdateId

  如果已经接收过这个 orderId + orderUpdateId：
    可以忽略，或继续在 state 中报告当前 orderId/orderUpdateId

  所以对于场景 2 的第二段和第三段：

  orderId 相同
  orderUpdateId 相同
  nodes/edges 相同

  AGV 侧理想行为是：识别为重复下发的同一版本，不当作新任务。

  但如果 AGV 侧实现不幂等，就可能有不良影响，例如：

  - 把重复 order 当成新任务，导致任务重置
  - 清空当前执行状态，重新规划
  - 重复触发 node/edge action
  - 在已经执行中时拒绝相同 order
  - 因重复收到 released=true 的边而校验失败
  - 执行状态和 adapter 等待状态不同步，导致 openTCS 继续重发或失败

  所以结论是：

  协议语义上：重复发送同一个 orderId + orderUpdateId 是可接受的，AGV 应幂等处理。
  工程实现上：如果 AGV 没有做幂等，确实可能影响执行。

  如果你们的 AGV 会因为重复消息失败，建议在 adapter 侧加节流/去重机制，例如：

  同一个 orderId + orderUpdateId 已发送后，
  只有超过 resendTimeout 且仍未确认时才重发，
  不要每收到一帧旧 state 就立即重发。

  这比让 AGV 承受毫秒级重复下发更稳。
```

---

## opentcs-kernel  或者 VDA 里面有 resendTimeout 机制吗?

```
关于 `  同一个 orderId + orderUpdateId 已发送后，
    只有超过 resendTimeout 且仍未确认时才重发，
    不要每收到一帧旧 state 就立即重发。`:

  1. opentcs-kernel  或者 VDA 里面有 resendTimeout 机制吗？
  2. 如果有话的，可以通过配置来设置其值吗？
```

### codex cli 答复

```
结论是：现有 openTCS kernel / VDA5050 代码里没有可配置的 resendTimeout。

  现在重复下发 order 的逻辑不是“超时重发”，而是：

  1. AGV 上报一帧 state
  2. adapter 检查当前队首 order 是否已被 orderId + orderUpdateId 确认
  3. 如果还没确认，就立即再次发送
  4. 所以 state 上报越频繁，重复发送也可能越频繁

  也就是说，当前机制是state 事件触发重发，不是定时器/间隔控制重发。

  如果要避免这种高频重复发送，需要改代码加一个类似配置：

  orderResendTimeoutMs=1000

  然后在发送/匹配逻辑里记录每个 order 的 lastSentTime，未确认时只有满足：

  now - lastSentTime >= orderResendTimeoutMs

  才允许重发。否则这帧 state 只做确认检查，不触发再次发送。
```

---

## 

1. 请你实现在 vda5050 适配器中新增 resendTimeout 机制的方案：
- 在重新发动订单前，检查是否满足重发超时(orderResendTimeoutMs)
- orderResendTimeoutMs 支持通过配置设置
- 其他的你认为要支持的特性

vda5050 适配器所在目录: D:\byd_agv_njc\opentcs-commadapter-vda5050

### codex cli 修改

• 已实现 orderResendTimeoutMs 机制，覆盖 VDA5050 v1.1 和 v2.0 两套 adapter。

  主要改动：

  - 新增配置项：commadapter.vehicle.vda5050.orderResendTimeoutMs
  - 默认分发配置设为 1000 ms：src/dist/config/opentcs-kernel.properties:11
  - 0 表示保持旧行为：每帧 state 都允许重发
  - 正数时：同一个未确认 order 只有超过该间隔才会重发
  - 当前 order 被确认后，下一条 order 会立即发送，不受前一条的 resend timeout 影响
  - instant action 逻辑未被节流，避免改变 cancelOrder 等动作的既有行为

  核心文件：

  - 配置接口：D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/CommAdapterConfiguration.java:57
  - v2.0 重发控制：D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/MessageResponseMatcher.java:306
  - v1.1 重发控制：D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v1_1/MessageResponseMatcher.java:306
  - 文档已同步英文/中文配置说明。

  验证已通过：

  .\gradlew.bat test --tests org.opentcs.commadapter.vehicle.vda5050.v1_1.MessageResponseMatcherTest --tests
  org.opentcs.commadapter.vehicle.vda5050.v2_0.MessageResponseMatcherTest
  .\gradlew.bat :opentcs-kernel:compileJava

### commit 信息

```
  feat(vda5050): 增加订单重发超时控制

  新增 commadapter.vehicle.vda5050.orderResendTimeoutMs 配置项，用于限制未确认订单的重复发送频率。

  主要变更：
  - 在 v1.1 和 v2.0 的 MessageResponseMatcher 中记录订单上次发送时间
  - 未确认订单再次发送前检查是否达到 orderResendTimeoutMs
  - orderResendTimeoutMs 为 0 时保持旧行为，即每帧 state 都可触发重发
  - 当前订单确认后，下一条订单仍立即发送，不受重发超时影响
  - 补充单元测试和配置文档
  - 在 kernel 默认分发配置中加入 orderResendTimeoutMs = 1000
```

---

## 对于前面说的 `## 任务场景-2`, AGV 执行任务的时候失败了，原因是:

- AGV 侧不支持 released 机制，第一次收到的任务: Point-10 -> Point-11 -> Point-19, 第二次收到的任务 Point-11 -> Point-19, 下层的运控模块会校验收到的节点，第二次收到的 Point-11 跟第一次收到的最后一个节点 Point-19 不匹配，此时报错: error_msg: move param, 上层业务模块收到该错误后，会终止任务的执行。

工厂生产环境使用的 lanxin-rcs 也不使用 released 机制，对于 `## 任务场景-2` 中的任务，它发送的订单可能是：
1. Point-10 -> Point-11 -> Point-19
2. Point-10 -> Point-11, Point-11 -> Point-19, orderId 不相同，其实就是两个独立的订单(针对路由中间点存在阻塞的情况)
3. Point-10 -> Point-11, Point-11 -> Point-19, orderId 相同，orderUpdateId 递增，从order数据角度看，订单第二段的起点就是订单第一段的终点 (nodeId, sequenceId 要相同)

【任务】

1. 为了兼容现有的 AGV, opentcs 需要修改 `A 到 B 中间有节点` 场景时，发布订单的逻辑，跟 lanxin-rcs 的逻辑相同。
2. 请你评估改动的方案是否可行，需要改动的模块，文件

vda5050 适配器所在目录: D:\byd_agv_njc\opentcs-commadapter-vda5050

`## 任务场景-2` 在文档: D:\byd_agv_njc\opentcs\docs\task_split.md

---


### 豆包优化后的提示词

对于前面说的 `## 任务场景-2`，我继续跟你提问：

【问题背景】
在 openTCS 中，当任务为 A → B（路径中间必须经过其他节点，例如 Point-10 → Point-19 必须经过 Point-11）时，
openTCS 默认会分多次下发 order：
1. 第一次：Point-10 → Point-11 → Point-19
2. 第二次：Point-11 → Point-19

由于 AGV 不支持 VDA5050 的 released / horizon 分段释放机制，第二次下发的路径起点（Point-11）与 AGV 当前预期节点不匹配，导致运控校验失败、任务终止。

工厂生产环境使用的 lanxin-rcs 不存在此问题，因其订单下发逻辑完全兼容 AGV 运控。

【lanxin-rcs 订单下发逻辑】
对于 A → B 路径中间存在节点的场景，lanxin-rcs 只会以下面三种兼容方式下发：
1. 直接下发完整路径：Point-10 → Point-11 → Point-19
2. 拆分为独立订单：Point-10→Point-11、Point-11→Point-19（orderId 不同）
3. 拆分为更新订单：Point-10→Point-11、Point-11→Point-19（orderId 相同，orderUpdateId 递增，且下一段起点 = 上一段终点）

核心特点：**不会中途突然把起点改成中间节点，不会破坏 AGV 节点连续性**。

【需求任务】
为了兼容现场 AGV，需要修改 openTCS + VDA5050 适配器，让其在 A → B 路径含中间点时：
1. **不使用 openTCS 默认的分段/horizon/released 机制**
2. **订单下发逻辑与 lanxin-rcs 保持一致**
   - 要么下发完整路径
   - 要么拆分为连续订单（下一段起点 = 上一段终点）
   - 绝对不允许中途直接从中间节点开始下发路径

请你：
1. 评估该需求是否可实现
2. 指出需要修改的核心模块
3. 指出需要修改的核心文件（尤其是 VDA5050 适配器）
4. 给出具体修改思路

【相关路径】
VDA5050 适配器目录：D:\byd_agv_njc\opentcs-commadapter-vda5050
任务场景描述文档：D:\byd_agv_njc\opentcs\docs\task_split.md

---

### doubao 答复

可以实现，而且优先建议在 VDA5050 adapter 层实现，不要先改 openTCS kernel 的调度/路由主逻辑。

  关键判断：openTCS kernel 本身只是把一条 route 拆成多个 MovementCommand，每个 route step 一个命令。真正产生 released=true/false、base/horizon、orderUpdateId 的地方是在 VDA5050
  adapter 的 OrderMapper。

  核心结论
  当前场景-2失败的根因不是 openTCS 路由算错，而是 VDA5050 adapter 默认按 VDA5050 的 base/horizon 机制下发：

  - 第一次：当前 step 作为 base，后续 step 作为 horizon
  - 第二次：把原 horizon 释放成 base
  - AGV 不支持这种“先收到未释放路径，后续再释放”的模型
  - 所以现场 AGV 会把 Point-11 -> Point-19 这种 update 当成异常路径处理

  核心模块
  需要关注三层：

  1. kernel 命令生成
      - src/main/java/org/opentcs/kernel/vehicles/MovementCommandMapper.java:64
      - 这里每个 route step 生成一个 MovementCommand
      - 不建议优先改这里，改动会影响所有适配器和资源调度

  2. kernel 命令下发控制
      - src/main/java/org/opentcs/kernel/vehicles/DefaultVehicleController.java:449
      - 这里把 MovementCommand 交给 comm adapter
      - 只在“完整路径一次性下发”方案里可能需要配合修改

  3. VDA5050 order 映射
      - D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/ordermapping/OrderMapper.java:144
      - D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/CommAdapterImpl.java:369
      - D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/MovementCommandManager.java:98

  最小可落地方案
  推荐实现一个新的配置模式，例如：

  commadapter.vehicle.vda5050.orderDispatchMode = SEGMENTED_NO_HORIZON

  可选值建议：

  HORIZON
  SEGMENTED_NO_HORIZON
  SEGMENTED_NEW_ORDER
  FULL_ROUTE

  其中 HORIZON 保持现有行为，作为默认值，避免影响标准 VDA5050 车辆。

  推荐先实现：SEGMENTED_NO_HORIZON
  这个模式最贴近 lanxin-rcs 的第 3 种方式：

  Point-10 -> Point-11
  Point-11 -> Point-19

  同一个 orderId，orderUpdateId 递增，但不再下发 horizon=false 的节点/边。

  具体改法：

  1. 在 OrderMapper.createOrderWithMovement() 中根据配置决定是否调用：

  mapHorizon(order, command, vehicle);

  当前代码位置：
  D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/ordermapping/OrderMapper.java:163

  2. SEGMENTED_NO_HORIZON 模式下跳过 mapHorizon()，第一次只下发：

  Point-10 -> Point-11

  第二次在上一个 movement 完成后再下发：

  Point-11 -> Point-19

  3. 保留当前 orderUpdateId = routeIndex 逻辑：
     D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/ordermapping/OrderMapper.java:186

  4. 保留当前连续起点逻辑：
     D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/ordermapping/OrderMapper.java:202

  这段逻辑会把上一条 order 的终点复制为下一条 order 的起点，正好满足：

  下一段起点 = 上一段终点

  如果要拆成独立订单
  也可以实现 SEGMENTED_NEW_ORDER：

  orderId = transportOrderName-driveOrderIndex-routeIndex
  orderUpdateId = 0

  需要改：
  D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/ordermapping/OrderMapper.java:447

  现在 orderId 是：

  transportOrder.getName() + "-" + transportOrder.getCurrentDriveOrderIndex()

  可改为在新模式下追加 routeIndex，让每段成为独立 VDA order。

  不建议优先做完整路径一次性下发
  完整路径：

  Point-10 -> Point-11 -> Point-19

  看起来最简单，但在 openTCS 架构里反而改动更大。因为 kernel 仍然认为有多个 MovementCommand，如果 adapter 第一次就把整条路径发给 AGV，那么后续需要：

  - 阻止 kernel 再发送后续 step
  - 或者 adapter 内部聚合多个 MovementCommand
  - AGV 完成整条路径后，adapter 要向 kernel 连续回报多个 command executed
  - 还要处理资源释放、路径进度、动作完成条件

  涉及：

  - CommAdapterImpl.sendCommand()
  - OrderMapper
  - MovementCommandManager
  - OrderAssociation
  - 可能还要影响 DefaultVehicleController

  所以完整路径可实现，但不是最小风险方案。

  额外提示
  你们可以先不改代码，试一个配置级验证：给车辆设置：

  vda5050:maxStepsHorizon = 0

  这个属性已经存在：
  D:/byd_agv_njc/opentcs-commadapter-vda5050/src/main/java/org/opentcs/commadapter/vehicle/vda5050/v2_0/ObjectProperties.java:144

  它会让 mapHorizon() 不追加后续 horizon。若现场 AGV 能跑通，说明“拆分连续订单、禁用 horizon”就是正确方向。之后再把它产品化成明确的 orderDispatchMode 配置。

---

