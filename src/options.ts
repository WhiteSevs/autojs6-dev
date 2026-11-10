/**
 * 插件选项.
 */
export interface AutoJs6Options {
  /** 入口脚本, 相对项目根目录. 默认 `src/main.ts` */
  entry?: string;
  /**
   * UI 模式的入口脚本, 相对项目根目录.
   * 仅在 `uiMode` 为 `true` 时生效, 未设置时沿用 `entry`.
   */
  uiEntry?: string;
  /** 产物目录, 相对项目根目录. 默认 `dist` */
  outDir?: string;
  /** 产物文件名. 默认 `main.js` */
  fileName?: string;
  /**
   * 是否为 UI 模式脚本.
   * 开启后会在产物首行写入 `"ui";` 指令 (AutoJs6 要求它是第一个有效语句).
   */
  uiMode?: boolean;
  /**
   * 需要一并拷贝到产物目录的文件/目录 (相对项目根目录).
   * 默认 `['project.json', 'res', 'images']`; 传 `false` 关闭.
   */
  assets?: string[] | false;
  /** 额外视为 AutoJs6 内置模块的模块名 */
  builtinModules?: string[];
  /** 编译目标. Rhino 引擎建议 `es2018`. 默认 `es2018` */
  target?: string;
  /** 是否压缩. 默认生产模式 (`--mode production*`) 下为 `true` */
  minify?: boolean;
  /** 是否生成 sourcemap. 默认 `false` (AutoJs6 内部不使用 `.map` 文件) */
  sourcemap?: boolean;
  /** 追加到产物头部的注释 (默认不写任何注释) */
  banner?: string;
  /**
   * 是否在产物中写入 `"use strict";`.
   * @default false
   */
  strict?: boolean;
  /** 额外注入的编译期常量 */
  define?: Record<string, string>;
  /** 构建结束后是否打印产物信息. 默认 `true` */
  log?: boolean;
}
