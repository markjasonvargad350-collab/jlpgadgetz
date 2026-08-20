/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API. Unset in dev (relative "/api" is proxied to :4000). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
