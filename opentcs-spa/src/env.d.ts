/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

interface ImportMetaEnv {
  /** Base URL of the opentcs-bff service. Empty in dev → use Vite proxy. */
  readonly VITE_BFF_BASE_URL?: string;
  /** Optional access key sent as `X-Api-Access-Key`. Empty disables auth. */
  readonly VITE_BFF_ACCESS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
