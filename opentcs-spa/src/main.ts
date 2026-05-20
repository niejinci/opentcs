import { createApp } from 'vue';
import VueKonva from 'vue-konva';

import App from './App.vue';
import { router } from './router';
import './styles/global.css';

createApp(App).use(router).use(VueKonva).mount('#app');
