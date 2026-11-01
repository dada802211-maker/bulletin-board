import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // サブフォルダへの配置でもビルド済みアセットを相対パスで参照する。
  base: './',
  server: {
    // 開発時だけPHPリクエストをLaragonへ転送する。本番の配布ファイルには適用されない。
    proxy: {
      '/php': {
        target: 'http://127.0.0.1',
        changeOrigin: true,
        // Vite側の/phpを、Laragonのプロジェクト配下のURLに対応させる。
        rewrite: (path) => `/bulletin-board${path}`,
      },
    },
  },
})