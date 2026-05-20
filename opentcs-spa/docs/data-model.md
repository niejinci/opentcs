# opentcs-spa · 中间态数据模型（活文档）

> 配套：[`spa-frontend-architecture.md`](../../docs/spa-frontend-architecture.md) §3.3、ADR-0003。
> 本文件**从 S3 起持续演进**；S5 起补 Point / Path，S6 补 Location / Block / Vehicle，每个 S 内追加一节。

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

S4 只交付画布框架（Konva 多图层 / 缩放 / 平移 / 工具栏切换），**未引入任何新的中间态实体**。但为承接 S5 起的 Pinia store，落了一个临时的「跨视图共享态」结构（见 `src/composables/useBackgroundMap.ts`）：

```ts
interface BackgroundMapState {
  image: HTMLImageElement; // 已解码的 PNG（仅运行时，非持久化字段）
  pngName: string;
  pgmName: string | null;
  yamlName: string;
  width: number; // px == affine.imageWidth
  height: number; // px == affine.imageHeight
  yaml: RosMapMetadata; // 见 §2 中的 BackgroundMap 字段拍平
  affine: AffineMapping; // 见 src/domain/geometry/affine.ts
}
```

> 这是**进程内**的状态，不进入 `ProjectDraft` JSON。S7 持久化时只落 `BackgroundMap`（§2）的"可序列化部分"——`image` 由资产文件 + 浏览器解码重建。

---

## 4. 待落（按里程碑）

| 里程碑 | 新增结构                                                                                       | 对齐的 TO 类                                     |
| :----- | :--------------------------------------------------------------------------------------------- | :----------------------------------------------- |
| S5     | `PointCreationTO` 镜像 + `PathCreationTO` 镜像                                                 | `org.opentcs.access.to.model.PointCreationTO` 等 |
| S6     | `LocationTypeCreationTO` / `LocationCreationTO` / `BlockCreationTO` / `VehicleCreationTO` 镜像 | 同上                                             |
| S7     | `ProjectDraft`：`{ id, name, backgroundMap, points[], paths[], ... }` 整体 schema              | —                                                |
| S8     | `PlantModelTO` 镜像（顶层），加发布请求外壳 `{projectId, plantModel}`                          | `PlantModelCreationTO`                           |
