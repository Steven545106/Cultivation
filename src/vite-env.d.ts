/// <reference types="vite/client" />
declare const __GAME_SHUTDOWN_TOKEN__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __MONSTER_ASSET_PATHS__: readonly string[];
