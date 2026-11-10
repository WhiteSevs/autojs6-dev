/**
 * autojs6-dev
 *
 * AutoJs6 的 Vite 构建插件: 把 TypeScript + ESM 源码打成 AutoJs6 可直接执行的单文件脚本.
 *
 * 脚本里不需要从这里 import 任何东西 —— `device` / `app` / `ocr` / `images` 等都是
 * AutoJs6 的全局对象, 直接使用即可; 代码提示由 `@sm003/autojs6-dts` 提供.
 */
export { autojs6 } from './autojs6';
export { autojs6 as default } from './autojs6';
export { DEFAULT_BUILTIN_MODULES } from './builtin';
export type { AutoJs6Options } from './options';
