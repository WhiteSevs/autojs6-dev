import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { autojs6 } from 'autojs6-dev'

/**
 * 通过 `--mode` 控制产物形态:
 *   development / production        普通脚本
 *   development-ui / production-ui  UI 模式脚本 (产物首行写入 `"ui";`)
 */
export default defineConfig(({ mode }) => {
  const uiMode = mode.includes('ui')

  return {
    // 产物是单文件脚本, 不需要浏览器相关的配置
    appType: 'custom' as const,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    plugins: [
      autojs6({
        entry: 'src/main.ts',
        // UI 模式下改用这个入口
        uiEntry: 'src/main.ui.ts',
        uiMode,
        outDir: 'dist',
        fileName: 'main.js',
        // 随脚本一起部署到 AutoJs6 的静态资源
        assets: ['project.json', 'res', 'images']
      })
    ]
  }
})
