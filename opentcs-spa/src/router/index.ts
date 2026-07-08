// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
//
// Vue Router setup. Introduced in S3 because the SPA now has more than one
// real view (Import + Debug). Use HTML5 history mode — the Vite dev server
// already serves `index.html` for unknown paths, and the S10 nginx config
// will need an explicit `try_files $uri /index.html;` rule.

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/projects' },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('@/views/ProjectsView.vue'),
    meta: { title: '工程列表' },
  },
  {
    path: '/import',
    name: 'import',
    component: () => import('@/views/ImportView.vue'),
    meta: { title: '地图导入' },
  },
  {
    path: '/monitor/:projectId?',
    name: 'realtime-monitor',
    component: () => import('@/views/RealtimeMonitorView.vue'),
    meta: { title: '实时监控' },
    props: true,
  },
  {
    path: '/editor/:projectId?',
    name: 'editor',
    component: () => import('@/views/EditorView.vue'),
    meta: { title: '画布编辑器' },
    props: true,
  },
  {
    path: '/warehouse',
    component: () => import('@/views/WarehouseManagementView.vue'),
    meta: { title: '货架管理' },
    redirect: { name: 'warehouse-types' },
    children: [
      {
        path: 'types',
        name: 'warehouse-types',
        component: () => import('@/views/WarehouseTypesView.vue'),
        meta: { title: '货架型号' },
      },
      {
        path: 'racks',
        name: 'warehouse-racks',
        component: () => import('@/views/WarehouseRacksView.vue'),
        meta: { title: '货架列表' },
      },
    ],
  },
  {
    path: '/debug',
    name: 'debug',
    component: () => import('@/views/DebugView.vue'),
    meta: { title: 'BFF 调试' },
  },
  {
    path: '/projects/:projectId/publish',
    name: 'project-publish',
    component: () => import('@/views/PublishView.vue'),
    meta: { title: '发布到 Kernel' },
    props: true,
  },
  {
    path: '/projects/:projectId/orders',
    name: 'project-orders',
    component: () => import('@/views/OrdersView.vue'),
    meta: { title: '运输订单' },
    props: true,
  },
  {
    path: '/projects/:projectId/create-task',
    name: 'project-create-task',
    component: () => import('@/views/CreateTaskView.vue'),
    meta: { title: '创建任务' },
    props: true,
  },
  // Catch-all → projects list.
  { path: '/:pathMatch(.*)*', redirect: '/projects' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
