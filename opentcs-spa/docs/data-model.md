# opentcs-spa · 中间态数据模型（活文档）

> 配套：[`spa-frontend-architecture.md`](../../docs/spa-frontend-architecture.md) §3.3、ADR-0003。
> 本文件**从 S3 起持续演进**；S5 落 Point / Path，S6 补 Location / LocationType / Block / Vehicle，每个 S 内追加一节。

## 1. 设计原则（强约束，复述 ADR-0003）

SPA 「编辑期中间态 JSON」= openTCS `PlantModelCreationTO` 的镜像：

- 字段名 / 嵌套结构 / 单位（mm、Triple、mm/s）**与 TO 一一对齐**；
- 仅在必要处补充少量"编辑期辅助字段"（例如像素坐标 `pixelX/pixelY` 便于回到画布定位）；
- S8 发布层只做 **打包 + 校验 + RMI**，不做字段翻译。

---

## 2. S3 已落地：`BackgroundMap`（底图元数据）

S3 阶段只处理底图与仿射映射，**还没有任何 Point / Path 实体**。底图相关字段（建议命名）：

```ts
interface BackgroundMap {
  /** 三件套文件名（仅用于 UI 显示与 S7 资产落盘）。 */
  files: { png: string; pgm: string; yaml: string };

  /** ROS map.yaml 解析结果（meters / radians）。 */
  resolution: number; // m/px
  origin: { x: number; y: number; theta: number }; // 米；theta 当前仅支持 0
  negate: number;
  occupiedThresh: number;
  freeThresh: number;

  /** PNG 的自然像素尺寸（由浏览器解码得到，yaml 中不含）。 */
  imageWidth: number; // px
  imageHeight: number; // px
}
```

仿射映射（实现见 `src/domain/geometry/affine.ts`）：

```
world_x = origin.x + px         * resolution
world_y = origin.y + (H - py)   * resolution    // py 是 top-left 系
```

> 该结构 S5 起会被嵌入更大的 `ProjectDraft` 中（与 `PlantModelCreationTO` 镜像并列：底图是编辑期辅助，不会出现在 TO 里）。

---

## 3. S4 已落地：编辑器框架（暂无新模型）

S4 只交付画布框架（Konva 多图层 / 缩放 / 平移 / 工具栏切换），**未引入任何新的中间态实体**。S5 起 `BackgroundMapState` 已搬到 `useProjectStore().background`，原 `useBackgroundMap` 退化为 thin compat 层；持久化层只落「可序列化部分」——`image` 由资产文件 + 浏览器解码重建。

```ts
interface BackgroundMapState {
  image: HTMLImageElement; // 进程内，非持久化
  pngName: string;
  pgmName: string | null;
  yamlName: string;
  width: number; // px == affine.imageWidth
  height: number;
  yaml: RosMapMetadata;
  affine: AffineMapping;
}
```

---

## 4. S5 已落地：`DraftPoint` / `DraftPath`

源文件：[`src/domain/model/types.ts`](../src/domain/model/types.ts)。**字段名与单位严格镜像** `org.opentcs.access.to.model.PointCreationTO` / `PathCreationTO` / `PoseCreationTO` / `TripleCreationTO`，除明示标注的「编辑期辅助字段」外其余字段在 S8 publish 层一比一打包成 RMI 入参。

### 4.1 `DraftPoint` ↔ `PointCreationTO`

```ts
type PointType = 'HALT_POSITION' | 'PARK_POSITION';

interface DraftPoint {
  name: string; // PointCreationTO.name
  type: PointType; // PointCreationTO.type
  pose: {
    position: { x: number; y: number; z: number }; // TripleCreationTO (mm, integer)
    orientationAngle: number; // PoseCreationTO.orientationAngle (degrees; NaN = 未设置)
  };
  layout: { pixelX: number; pixelY: number }; // 编辑期辅助：不进入 TO
}
```

| Draft 字段              | TO 字段                                                 | 单位 / 备注                                              |
| :---------------------- | :------------------------------------------------------ | :------------------------------------------------------- |
| `name`                  | `PointCreationTO.name`                                  | 编辑器内必须唯一；S5 自动名 `Point-N`                    |
| `type`                  | `PointCreationTO.type`                                  | `HALT_POSITION` / `PARK_POSITION`                        |
| `pose.position.{x,y,z}` | `TripleCreationTO`                                      | mm，integer；S5 中 `z=0`                                 |
| `pose.orientationAngle` | `PoseCreationTO.orientationAngle`                       | degrees；`NaN` = 未设置（与 TO 默认一致）                |
| `layout.pixelX/pixelY`  | —                                                       | **编辑期辅助**，由 AffineMapping 反算可得；S8 转换层丢弃 |
| _未实现_                | `vehicleEnvelopes` / `maxVehicleBoundingBox` / `Layout` | 留 S6+；S8 转换层用 TO 的默认值                          |

### 4.2 `DraftPath` ↔ `PathCreationTO`

```ts
interface DraftPath {
  name: string;
  srcPointName: string;
  destPointName: string;
  length: number; // mm
  maxVelocity: number; // mm/s
  maxReverseVelocity: number; // mm/s
  locked: boolean;
}
```

| Draft 字段                       | TO 字段                                                | 单位 / 备注                                                                                                          |
| :------------------------------- | :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| `name`                           | `PathCreationTO.name`                                  | 自动名 `Path-N`                                                                                                      |
| `srcPointName` / `destPointName` | `PathCreationTO.srcPointName` / `destPointName`        | 必须命中既有 Point；Point 改名时由 store 级联更新                                                                    |
| `length`                         | `PathCreationTO.length` (`long`)                       | mm，integer；store `addPoint/movePoint/setPointWorldMeters` 后自动用 `distanceMm` 重算（手工编辑会被覆盖，MVP 权衡） |
| `maxVelocity`                    | `PathCreationTO.maxVelocity` (`int`)                   | mm/s；S5 默认 `1000` (= 1 m/s)；`0` = 禁止正向                                                                       |
| `maxReverseVelocity`             | `PathCreationTO.maxReverseVelocity` (`int`)            | mm/s；S5 默认 `0` = 禁止反向                                                                                         |
| `locked`                         | `PathCreationTO.locked`                                | 锁定后 AGV 不会经过；AnnotationLayer 用虚线 + 灰色                                                                   |
| _未实现_                         | `peripheralOperations` / `vehicleEnvelopes` / `Layout` | 留 S6+；S8 用 TO 默认                                                                                                |

### 4.3 localStorage 持久化约定

- key：`opentcs-spa.draftV1`
- envelope：`{ v: 1, points: DraftPoint[], paths: DraftPath[], selection: SelectionRef | null }`
- 写入时机：`watch([points, paths, selection], deep:true)` 触发后 debounce 200ms（避免高频拖拽抖动写盘）
- 读取时机：首次 `useProjectStore()` 调用；`v` 不等于当前版本 / JSON 损坏 / 数组缺失 = 安静丢弃并以空草稿继续
- 不持久化：`background`（含 `HTMLImageElement`） / `pathDraftSrc`（path 工具半态）
- S7 计划：保持本节 schema 不变，但把读写从 `localStorage` 切到 BFF `PUT /api/v1/projects/{id}/draft` —— actions 形状刻意保持稳定以便机械迁移

---

## 5. S6 已落地：`DraftLocationType` / `DraftLocation` / `DraftBlock` / `DraftVehicle`

源文件：[`src/domain/model/types.ts`](../src/domain/model/types.ts)。规则同 §4：**字段名 / 嵌套结构 / 单位**严格镜像 `org.opentcs.access.to.model.{LocationType,Location,Block,Vehicle}CreationTO`，仅在必要处补「编辑期辅助字段」并明示。

### 5.1 `DraftLocationType` ↔ `LocationTypeCreationTO`

```ts
interface DraftLocationType {
  name: string;
  allowedOperations: string[];
  allowedPeripheralOperations: string[];
  layout: { locationRepresentation: LocationRepresentation };
}
```

| Draft 字段                      | TO 字段                                                | 单位 / 备注                                                 |
| :------------------------------ | :----------------------------------------------------- | :---------------------------------------------------------- |
| `name`                          | `LocationTypeCreationTO.name`                          | 自动名 `LocType-N`；改名级联到所有 `DraftLocation.typeName` |
| `allowedOperations`             | `LocationTypeCreationTO.allowedOperations`             | 自由字符串列表；store 在 commit 时 `trim + dedupe`          |
| `allowedPeripheralOperations`   | `LocationTypeCreationTO.allowedPeripheralOperations`   | MVP 通常留空                                                |
| `layout.locationRepresentation` | `LocationTypeCreationTO.Layout.locationRepresentation` | 14 值枚举 `LocationRepresentation`（全集见类型文件）        |
| _未实现_                        | `properties`                                           | 留 S7+；S8 用 TO 默认                                       |

### 5.2 `DraftLocation` ↔ `LocationCreationTO`

```ts
interface DraftLocation {
  name: string;
  typeName: string; // 必须命中既有 DraftLocationType.name
  position: { x: number; y: number; z: number }; // TripleCreationTO (mm, integer)
  locked: boolean;
  links: { pointName: string; allowedOperations: string[] }[];
  layout: {
    pixelX: number;
    pixelY: number; // 编辑期辅助
    locationRepresentation: LocationRepresentation; // 覆盖 LocationType 的同名字段
  };
}
```

| Draft 字段                                 | TO 字段                                                 | 单位 / 备注                                                                      |
| :----------------------------------------- | :------------------------------------------------------ | :------------------------------------------------------------------------------- |
| `name`                                     | `LocationCreationTO.name`                               | 自动名 `Location-N`；改名级联到 `Block.memberNames`                              |
| `typeName`                                 | `LocationCreationTO.typeName`                           | 首次添加 Location 时若 store 为空，自动创建一个默认 `LocType-1`                  |
| `position`                                 | `LocationCreationTO.position`（`TripleCreationTO`）     | mm，integer                                                                      |
| `locked`                                   | `LocationCreationTO.locked`                             | 锁定后订单不会以此为目的地；AnnotationLayer 用灰色填充                           |
| `links[i].pointName` / `allowedOperations` | `LocationCreationTO.links` (`Map<String, Set<String>>`) | SPA 用数组保有序便于 UI；S8 转 Map；`allowedOperations` 留空 = 继承 LocationType |
| `layout.pixelX/pixelY`                     | —                                                       | **编辑期辅助**；由 AffineMapping 反算可得，S8 转换层丢弃                         |
| `layout.locationRepresentation`            | `LocationCreationTO.Layout.locationRepresentation`      | 仅本 Location 覆盖 `LocationType.layout.locationRepresentation`                  |
| _未实现_                                   | `Layout.labelOffset / layerId / properties`             | 留 S7+；S8 用 TO 默认                                                            |

### 5.3 `DraftBlock` ↔ `BlockCreationTO`

```ts
type BlockType = 'SINGLE_VEHICLE_ONLY' | 'SAME_DIRECTION_ONLY';

interface DraftBlock {
  name: string;
  type: BlockType;
  memberNames: string[]; // 引用 Point / Path / Location 的 name
  layout: { colorRgb: string }; // '#RRGGBB' 小写，无 alpha
}
```

| Draft 字段        | TO 字段                             | 单位 / 备注                                                                    |
| :---------------- | :---------------------------------- | :----------------------------------------------------------------------------- |
| `name`            | `BlockCreationTO.name`              | 自动名 `Block-N`                                                               |
| `type`            | `BlockCreationTO.Type`              | `SINGLE_VEHICLE_ONLY`（默认） / `SAME_DIRECTION_ONLY`                          |
| `memberNames`     | `BlockCreationTO.memberNames` (Set) | 引用 Point / Path / Location 的 `name`；删除被引实体或重命名时 store 级联更新  |
| `layout.colorRgb` | `BlockCreationTO.Layout.color`      | `#RRGGBB` → S8 用 `Integer.parseInt(rgb.substring(1), 16)` 转 `java.awt.Color` |
| _未实现_          | `properties`                        | 留 S7+                                                                         |

### 5.4 `DraftVehicle` ↔ `VehicleCreationTO`

```ts
interface DraftVehicle {
  name: string;
  boundingBox: { length: number; width: number; height: number }; // mm, long
  energyLevelThresholdSet: {
    energyLevelCritical: number; // 0-100
    energyLevelGood: number;
    energyLevelSufficientlyRecharged: number;
    energyLevelFullyRecharged: number;
  };
  maxVelocity: number; // mm/s
  maxReverseVelocity: number; // mm/s
  envelopeKey: string; // '' = 默认
  layout: {
    pixelX: number;
    pixelY: number; // 编辑期辅助
    orientationDeg: number; // 编辑期辅助（图标朝向）
    routeColorRgb: string; // '#RRGGBB'
  };
}
```

| Draft 字段                                | TO 字段                                                    | 单位 / 备注                                                                                                    |
| :---------------------------------------- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| `name`                                    | `VehicleCreationTO.name`                                   | 自动名 `Vehicle-N`                                                                                             |
| `boundingBox.{length,width,height}`       | `VehicleCreationTO.boundingBox`（`BoundingBoxCreationTO`） | mm，long；默认 1000/1000/1000                                                                                  |
| `energyLevelThresholdSet.*`               | `VehicleCreationTO.energyLevelThresholdSet`                | 百分比 0-100；默认 30/90/30/90 与 TO 一致                                                                      |
| `maxVelocity` / `maxReverseVelocity`      | 同名字段                                                   | mm/s；默认 1000                                                                                                |
| `envelopeKey`                             | `VehicleCreationTO.envelopeKey`                            | 字符串；MVP 通常留空                                                                                           |
| `layout.routeColorRgb`                    | `VehicleCreationTO.Layout.routeColor`                      | `#RRGGBB` → `java.awt.Color`                                                                                   |
| **`layout.pixelX/pixelY/orientationDeg`** | —                                                          | **编辑期辅助**：TO 不带初始位姿（运行时由 Kernel 给出），SPA 仅用于画布渲染；**S8 publish 转换器必须显式丢弃** |
| _未实现_                                  | `properties`                                               | 留 S7+                                                                                                         |

### 5.5 `localStorage` envelope v2

S6 把 envelope 从 v1 升到 v2（key 仍是 `opentcs-spa.draftV1`，避免不必要的命名漂移）：

```ts
interface PersistedDraft {
  v: 2;
  points: DraftPoint[];
  paths: DraftPath[];
  locationTypes: DraftLocationType[];
  locations: DraftLocation[];
  blocks: DraftBlock[];
  vehicles: DraftVehicle[];
  selection: SelectionRef | null;
}
```

向后兼容：`loadPersisted` 同时接受 `v=1` 与 `v=2`，对 v1 用空数组补齐 S6 四个集合——已有 S5 草稿无缝迁移。

### 5.6 删除 / 重命名级联约定

| 触发                                                     | 自动级联                                                                                                  |
| :------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| 删 Point                                                 | 关联 Path 一并删；从 `Location.links[].pointName` 中剔除；从 `Block.memberNames` 中剔除                   |
| 删 Path                                                  | 从 `Block.memberNames` 中剔除                                                                             |
| 删 Location                                              | 从 `Block.memberNames` 中剔除                                                                             |
| 改 Point.name                                            | 更新所有引用它的 `Path.{srcPointName,destPointName}` / `Location.links[].pointName` / `Block.memberNames` |
| 改 LocationType.name                                     | 更新所有 `Location.typeName`                                                                              |
| 改 Path.name / Location.name / Block.name / Vehicle.name | 更新 `Block.memberNames` 中的同名引用；改名前 `nameTaken` 全六类去重                                      |
| 删 LocationType                                          | 若仍有 Location 引用 → 软失败（属性面板提示先改类型再删）                                                 |

---

## 6. 待落（按里程碑）

| 里程碑 | 新增结构                                                                          | 对齐的 TO 类           |
| :----- | :-------------------------------------------------------------------------------- | :--------------------- |
| S7     | `ProjectDraft`：`{ id, name, backgroundMap, points[], paths[], ... }` 整体 schema | —                      |
| S8     | `PlantModelTO` 镜像（顶层），加发布请求外壳 `{projectId, plantModel}`             | `PlantModelCreationTO` |
