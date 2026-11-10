/// <reference types="@sm003/autojs6-dts" />

/**
 * AutoJs6 的 CommonJS 模块包装变量.
 * 在 `.ts` 里通常用不到 (源码按 ESM 写, 由打包器转换), 需要时可用于兼容旧脚本.
 */
declare const module: { exports: unknown }
declare const exports: Record<string, unknown>
declare const __filename: string
declare const __dirname: string

/**
 * `import text from './foo.xml?raw'` — 以字符串形式引入任意静态文件.
 * (没有引入 vite/client, 避免把 DOM 类型混进 Rhino 环境)
 */
declare module '*?raw' {
  const content: string
  export default content
}
