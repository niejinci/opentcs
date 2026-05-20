import { createPinia } from 'pinia';
import { createApp } from 'vue';
import VueKonva from 'vue-konva';

import App from './App.vue';
import { router } from './router';
import './styles/global.css';

// Order matters: Pinia must be installed before any component that calls
// `useProjectStore()` mounts. Lazy-loaded views (EditorView) call stores
// during `setup`, so Pinia goes in first, then the router, then VueKonva.
createApp(App).use(createPinia()).use(router).use(VueKonva).mount('#app');
