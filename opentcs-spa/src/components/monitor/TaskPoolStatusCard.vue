<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { SseConnectionState } from '@/api/sse';
import type { TransportOrder, TransportOrderState } from '@/api/types/bff';
import {
  ABNORMAL_ORDER_STATES,
  PROCESSING_ORDER_STATES,
  taskPoolOrdersForBucket,
  type TaskPoolCounts,
  type TaskPoolDrilldownId,
} from '@/domain/orders/taskPool';

const STORAGE_KEY = 'dd-opentcs.monitor.taskPoolStatus.collapsed';
const MAX_DRILLDOWN_ROWS = 5;

const props = defineProps<{
  counts: TaskPoolCounts;
  orders: readonly TransportOrder[];
  sseState: SseConnectionState;
}>();

const bucketLabels: Record<TaskPoolDrilldownId, string> = {
  active: '活跃',
  pending: '待执行',
  processing: '执行中',
  abnormal: '异常',
};

function readCollapsed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // localStorage may be unavailable; the in-memory state is sufficient.
  }
}

function selectBucket(bucket: TaskPoolDrilldownId): void {
  selectedBucket.value = bucket;
}

function vehicleText(order: TransportOrder): string {
  return order.processingVehicle || order.intendedVehicle || '-';
}

function destinationText(order: TransportOrder): string {
  if (!order.destinations.length) return '-';
  return order.destinations
    .map((destination) => `${destination.locationName} / ${destination.operation}`)
    .join(' -> ');
}

function stateTone(state: TransportOrderState): 'bad' | 'processing' | 'pending' {
  if (ABNORMAL_ORDER_STATES.has(state)) return 'bad';
  if (PROCESSING_ORDER_STATES.has(state)) return 'processing';
  return 'pending';
}

const collapsed = ref(readCollapsed());
const selectedBucket = ref<TaskPoolDrilldownId | null>(null);
const hasAbnormal = computed(() => props.counts.abnormal > 0);
const healthText = computed(() => (hasAbnormal.value ? '需处理' : '正常'));
const sseText = computed(() => {
  switch (props.sseState) {
    case 'open':
      return '实时';
    case 'connecting':
      return '连接中';
    case 'reconnecting':
      return '重连中';
    default:
      return '未连接';
  }
});
const metrics = computed(() => [
  {
    id: 'active' as const,
    label: '活跃任务',
    count: props.counts.active,
    className: 'metric--active',
  },
  { id: 'pending' as const, label: '待执行', count: props.counts.pending, className: '' },
  {
    id: 'processing' as const,
    label: '执行中',
    count: props.counts.processing,
    className: 'metric--processing',
  },
  {
    id: 'abnormal' as const,
    label: '异常',
    count: props.counts.abnormal,
    className: 'metric--abnormal',
  },
]);
const drilldownBucket = computed<TaskPoolDrilldownId | null>(
  () => selectedBucket.value ?? (hasAbnormal.value ? 'abnormal' : null),
);
const drilldownOrders = computed(() =>
  drilldownBucket.value ? taskPoolOrdersForBucket(props.orders, drilldownBucket.value) : [],
);
const drilldownPreview = computed(() => drilldownOrders.value.slice(0, MAX_DRILLDOWN_ROWS));
const hiddenDrilldownCount = computed(() =>
  Math.max(0, drilldownOrders.value.length - drilldownPreview.value.length),
);
const drilldownTitle = computed(() =>
  drilldownBucket.value ? `${bucketLabels[drilldownBucket.value]}任务` : '任务明细',
);
const emptyText = computed(() =>
  drilldownBucket.value ? `当前没有${bucketLabels[drilldownBucket.value]}任务` : '',
);

watch(collapsed, writeCollapsed);
watch(
  () => [props.counts.active, props.counts.pending, props.counts.processing, props.counts.abnormal],
  () => {
    if (selectedBucket.value && props.counts[selectedBucket.value] === 0) {
      selectedBucket.value = null;
    }
  },
);
</script>

<template>
  <button
    v-if="collapsed"
    type="button"
    class="task-pool-chip"
    :data-health="hasAbnormal ? 'bad' : 'ok'"
    title="展开任务池状态"
    @click="collapsed = false"
  >
    <span>任务池 {{ counts.active }}</span>
    <span v-if="hasAbnormal" class="chip-alert">异常 {{ counts.abnormal }}</span>
  </button>

  <section v-else class="task-pool-card" :data-health="hasAbnormal ? 'bad' : 'ok'">
    <header class="card-header">
      <div>
        <h3>任务池健康</h3>
        <p :data-health="hasAbnormal ? 'bad' : 'ok'">{{ healthText }} · {{ sseText }}</p>
      </div>
      <button
        type="button"
        class="collapse-button"
        title="隐藏任务池状态"
        @click="collapsed = true"
      >
        收起
      </button>
    </header>

    <div class="metrics" aria-label="任务池统计">
      <button
        v-for="item in metrics"
        :key="item.id"
        type="button"
        class="metric"
        :class="[item.className, { 'metric--selected': drilldownBucket === item.id }]"
        :disabled="item.count === 0"
        :aria-pressed="drilldownBucket === item.id"
        :data-testid="`task-pool-metric-${item.id}`"
        @click="selectBucket(item.id)"
      >
        <strong>{{ item.count }}</strong>
        <span>{{ item.label }}</span>
      </button>
    </div>

    <div v-if="drilldownBucket" class="drilldown-list" aria-label="任务明细列表">
      <div class="list-title">
        <span>{{ drilldownTitle }}</span>
        <small v-if="hiddenDrilldownCount">另 {{ hiddenDrilldownCount }} 条</small>
      </div>
      <ol v-if="drilldownPreview.length">
        <li v-for="order in drilldownPreview" :key="order.name">
          <span class="order-name" :title="order.name">{{ order.name }}</span>
          <span class="order-state" :data-tone="stateTone(order.state)">{{ order.state }}</span>
          <span class="order-vehicle" :title="vehicleText(order)"
            >车辆 {{ vehicleText(order) }}</span
          >
          <span class="order-target" :title="destinationText(order)">{{
            destinationText(order)
          }}</span>
        </li>
      </ol>
      <p v-else class="empty-drilldown">{{ emptyText }}</p>
    </div>
    <p v-else class="drilldown-hint">点击上方数字查看任务明细</p>
  </section>
</template>

<style scoped>
.task-pool-card,
.task-pool-chip {
  position: absolute;
  top: 0.9rem;
  right: 0.9rem;
  z-index: 12;
}

.task-pool-card {
  width: min(28rem, calc(100% - 1.8rem));
  border: 1px solid #d8dee7;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 28px rgba(31, 35, 40, 0.14);
  color: #24292f;
  overflow: hidden;
}

.task-pool-card[data-health='bad'] {
  border-color: #ffb4a8;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.75rem 0.85rem 0.6rem;
  border-bottom: 1px solid #eef2f6;
}

.card-header h3 {
  margin: 0;
  color: #30363d;
  font-size: 0.98rem;
  font-weight: 700;
}

.card-header p {
  margin: 0.15rem 0 0;
  color: #2da44e;
  font-size: 0.78rem;
  font-weight: 650;
}

.card-header p[data-health='bad'] {
  color: #cf222e;
}

.collapse-button {
  height: 1.8rem;
  padding: 0 0.55rem;
  border: 1px solid #d0d7de;
  border-radius: 5px;
  background: #ffffff;
  color: #57606a;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
}

.metric {
  min-width: 0;
  padding: 0.72rem 0.45rem 0.7rem;
  text-align: center;
  border: 0;
  border-right: 1px solid #eef2f6;
  border-bottom: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.metric:last-child {
  border-right: 0;
}

.metric:disabled {
  cursor: default;
  opacity: 0.48;
}

.metric:not(:disabled):hover,
.metric--selected {
  background: #f6f8fa;
}

.metric--selected {
  border-bottom-color: #0969da;
}

.metric strong {
  display: block;
  color: #30363d;
  font-size: 1.35rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.metric span {
  display: block;
  margin-top: 0.35rem;
  color: #6e7781;
  font-size: 0.76rem;
  font-weight: 650;
  white-space: nowrap;
}

.metric--active strong,
.metric--processing strong {
  color: #0969da;
}

.metric--abnormal strong {
  color: #cf222e;
}

.drilldown-list {
  border-top: 1px solid #eef2f6;
  padding: 0.55rem 0.75rem 0.75rem;
}

.list-title {
  display: flex;
  justify-content: space-between;
  color: #57606a;
  font-size: 0.78rem;
  font-weight: 700;
}

.list-title small {
  color: #8c959f;
  font: inherit;
}

ol {
  margin: 0.4rem 0 0;
  padding: 0;
  list-style: none;
}

li {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(4rem, 5.4rem);
  gap: 0.45rem;
  align-items: center;
  padding: 0.42rem 0;
  color: #57606a;
  font-size: 0.78rem;
  border-top: 1px solid #f0f3f6;
}

li:first-child {
  border-top: 0;
}

.order-name,
.order-vehicle,
.order-target {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-name {
  color: #30363d;
  font-weight: 650;
}

.order-state {
  font-weight: 700;
}

.order-state[data-tone='bad'] {
  color: #cf222e;
}

.order-state[data-tone='processing'] {
  color: #0969da;
}

.order-state[data-tone='pending'] {
  color: #9a6700;
}

.order-vehicle {
  text-align: right;
}

.order-target {
  grid-column: 1 / -1;
  color: #6e7781;
}

.empty-drilldown,
.drilldown-hint {
  margin: 0;
  padding: 0.65rem 0.75rem;
  color: #8c959f;
  font-size: 0.78rem;
}

.drilldown-hint {
  border-top: 1px solid #eef2f6;
}

.task-pool-chip {
  min-height: 2.15rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid #d8dee7;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: #30363d;
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 0.25rem 0.75rem;
  box-shadow: 0 8px 22px rgba(31, 35, 40, 0.14);
}

.task-pool-chip[data-health='bad'] {
  border-color: #ffb4a8;
  color: #cf222e;
}

.chip-alert {
  color: #cf222e;
}

@media (max-width: 780px) {
  .task-pool-card,
  .task-pool-chip {
    top: 0.6rem;
    right: 0.6rem;
  }

  .task-pool-card {
    width: min(22rem, calc(100% - 1.2rem));
  }

  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric:nth-child(2) {
    border-right: 0;
  }

  .metric:nth-child(-n + 2) {
    border-bottom: 1px solid #eef2f6;
  }

  .metric--selected:nth-child(-n + 2) {
    border-bottom-color: #0969da;
  }
}
</style>
