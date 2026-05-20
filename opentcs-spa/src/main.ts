import { createPinia } from 'pinia';
import { createApp } from 'vue';
import VueKonva from 'vue-konva';

import App from './App.vue';
import { router } from './router';
import './styles/global.css';

// Order matters: Pinia must be installed before any component that calls
// `useProjectStore()` mounts. Vue-router is installed before Pinia only
// because the router has no store dependency at definition time, while
// some lazy-loaded views (EditorView) call stores during `setup`.
createApp(App).use(createPinia()).use(router).use(VueKonva).mount('#app');
