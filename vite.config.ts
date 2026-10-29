import { defineConfig } from "vite";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

// A GitHub Pages project site lives under /<repo>/, so the build is given that base (see .github/workflows/deploy.yml).
const base = process.env.VITE_BASE ?? "/";

const shutdownToken = randomBytes(32).toString("hex");

const monsterAssetDirectory = resolve(process.cwd(), "public/assets/monster");
const monsterAssetPaths = existsSync(monsterAssetDirectory)
  ? readdirSync(monsterAssetDirectory)
    .filter(fileName => /\.(gif|png|webp)$/i.test(fileName))
    .sort((left, right) => left.localeCompare(right, "en"))
    .map(fileName => `${base}assets/monster/${fileName}`)
  : [];

export default defineConfig({
  base,
  plugins: [{
    // The game refers to its public art by absolute "/assets/..." strings; point them under the base when it is not "/".
    name: "prefix-asset-urls",
    apply: "build",
    enforce: "pre",
    transform(code, id) {
      if (base === "/" || id.includes("node_modules") || !/\.tsx?$/.test(id)) return null;
      return code.replace(/(["'`])\/assets\//g, `$1${base}assets/`);
    },
  }, {
    name: "local-game-shutdown",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__game_shutdown", (req, res) => {
        const address = req.socket.remoteAddress;
        const local = address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
        const origin = req.headers.origin;
        if (!local || req.method !== "POST" || !origin || origin !== `http://${req.headers.host}` || req.headers["x-game-shutdown-token"] !== shutdownToken) {
          res.writeHead(403).end();
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify({ ok: true }));
        res.on("finish", () => { setTimeout(() => process.exit(0), 100); });
      });
    },
  }],
  define: {
    __MONSTER_ASSET_PATHS__: JSON.stringify(monsterAssetPaths),
    __GAME_SHUTDOWN_TOKEN__: JSON.stringify(shutdownToken),
  },
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  build: {
    target: "es2022",
    // Phaser is intentionally isolated from the React/Supabase application code.
    // It is loaded only by the battle page's Phaser bridge and no longer makes
    // the main application bundle appear as one monolithic asset.
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"],
          react: ["react", "react-dom"],
        },
      },
    },
    // Phaser is a deliberately retained, full-featured engine dependency.
    chunkSizeWarningLimit: 1500,
  }
});
