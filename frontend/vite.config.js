var _a;
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
var __dirname = dirname(fileURLToPath(import.meta.url));
// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: (_a = process.env.VITE_API_URL) !== null && _a !== void 0 ? _a : "http://localhost:3000",
                changeOrigin: true,
            },
        },
    },
});
