/**
 * AutoJs6 内置模块名.
 *
 * 这些名称在 `import ... from '<name>'` 时会被插件拦截, 转换成运行时的
 * `require('<name>')` (若同名全局对象已存在则直接取全局), 不会被打包器
 * 当成「找不到的依赖」而报错.
 */
export const DEFAULT_BUILTIN_MODULES: readonly string[] = [
  // AutoJs6 augmentable API (既可作为全局对象使用, 也可 require 载入)
  'app',
  'auto',
  'automator',
  'barcode',
  'base64',
  'canvas',
  'colors',
  'console',
  'continuation',
  'crypto',
  'device',
  'dialogs',
  'engines',
  'events',
  'files',
  'floaty',
  'flow',
  'http',
  'i18n',
  'images',
  'media',
  'mediainfo',
  'notice',
  'ocr',
  'opencc',
  'pinyin',
  'qrcode',
  'sensors',
  'shell',
  'shizuku',
  'speech',
  'sqlite',
  'storages',
  'threads',
  'timers',
  'toast',
  'tts',
  'ui',
  'util',
  'web',
  'zip',
  // Node.js 兼容模块 (6.8.0 起由「脚本库」插件提供)
  'fs',
  'path',
  'os',
  'process',
  'buffer',
  'nodejs',
  'lodash',
  'axios',
  'cheerio',
  'dayjs',
  'pangu',
  // 其他内置资源模块
  'result-adapter'
];

/** 判断标识符能否直接写成 JS 变量名 (用于读取同名全局对象) */
export function isIdentifier(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

/**
 * 生成内置模块的虚拟模块代码.
 *
 * 优先读取同名全局对象 (`ui` / `app` 等在 AutoJs6 中本身就是全局变量),
 * 不存在的再走 `require()` (如 `fs` / `path` / `lodash`).
 *
 * 注意: 只支持默认导入 (`import ui from 'ui'`). 具名导入
 * (`import { launch } from 'app'`) 无法在编译期枚举出真实的键,
 * 需要具名 API 请使用 `autojs6-dev` 提供的运行时.
 */
export function builtinModuleCode(name: string): string {
  const fallback = `require(${JSON.stringify(name)})`;

  if (!isIdentifier(name)) {
    return `export default ${fallback};`;
  }

  return [
    `/* AutoJs6 内置模块: ${name} */`,
    `var __autojs6Module = typeof ${name} !== 'undefined' ? ${name} : ${fallback};`,
    'export default __autojs6Module;'
  ].join('\n');
}
