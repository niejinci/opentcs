<script setup lang="ts">
import { useTemplateRef } from 'vue';

import MapStage from '@/components/canvas/MapStage.vue';
import type { BackgroundMapState } from '@/stores/project';

defineProps<{
  background: BackgroundMapState | null;
}>();

const emit = defineEmits<{
  'target-click': [target: { kind: 'point' | 'location'; name: string }];
}>();

const mapStageRef = useTemplateRef<{
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
} | null>('mapStageRef');
</script>

<template>
  <section class="task-map-panel" aria-label="工厂模型画布">
    <MapStage
      v-if="background"
      ref="mapStageRef"
      readonly
      :image="background.image"
      :image-width="background.width"
      :image-height="background.height"
      :affine="background.affine"
      tool="select"
      @target-click="(target) => emit('target-click', target)"
    >
      <template #status="{ scale }">
        <footer class="map-status">
          <span>缩放 {{ (scale * 100).toFixed(0) }}%</span>
          <button type="button" @click="mapStageRef?.zoomOut()">−</button>
          <button type="button" @click="mapStageRef?.zoomIn()">+</button>
          <button type="button" @click="mapStageRef?.resetView()">重置</button>
        </footer>
      </template>
    </MapStage>

    <div v-else class="empty-map">
      <p>当前工程没有可渲染底图</p>
    </div>
  </section>
</template>

<style scoped>
.task-map-panel {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #d8dde2;
}

.map-status {
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.45rem;
  border: 1px solid rgba(208, 215, 222, 0.9);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.92);
  color: #57606a;
  font-size: 0.82rem;
  box-shadow: 0 4px 14px rgba(31, 35, 40, 0.12);
}

.map-status button {
  min-width: 1.9rem;
  height: 1.8rem;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background: #ffffff;
  color: #57606a;
  cursor: pointer;
}

.empty-map {
  height: 100%;
  min-height: 30rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6e7781;
}

.empty-map p {
  margin: 0;
}
</style>
