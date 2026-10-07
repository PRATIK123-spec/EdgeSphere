/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for the API base path. Defaults to "/api" (Vite proxy). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
