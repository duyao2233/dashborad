/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROMETHEUS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
