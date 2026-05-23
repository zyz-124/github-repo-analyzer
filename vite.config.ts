import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // Tauri 生产构建必须使用相对路径，否则无法加载静态资源
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // 生产构建优化
  build: {
    // 限制单个 chunk 大小，超出后自动分割
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // 将大型依赖分离为独立 chunk，优化加载性能
        manualChunks(id: string) {
          if (id.includes('node_modules/recharts')) {
            return 'vendor-recharts';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
        },
      },
    },
  },

  // 防止 Vite 在 Tauri 环境下忽略 Rust 端的日志
  clearScreen: false,

  server: {
    // Tauri 在 dev 模式下需要固定的端口
    port: 5173,
    strictPort: true,
    // 允许 Tauri 访问 dev server
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  // 环境变量前缀：Tauri 使用 TAURI_ 前缀，Vite 默认是 VITE_
  envPrefix: ["VITE_", "TAURI_"],
})
