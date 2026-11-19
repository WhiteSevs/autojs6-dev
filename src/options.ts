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
  /**
   * 构建结束后把产物目录同步到手机 (调用 AutoJs6 VSCode 扩展).
   *
   * 走扩展的本机 HTTP 命令桥 (`/exec?cmd=saveProject&path=...`), 不需要 adb;
   * 要求 VSCode 正在运行、AutoJs6 扩展已激活且至少有一台设备已连接.
   * 传 `false` 等价于关闭, 也是默认行为.
   */
  deploy?: DeployOptions | false;
}

/**
 * 自动同步到设备的配置. 由 `autojs6()` 的 `deploy` 选项使用.
 *
 * 依赖 AutoJs6-VSCode-Extension (≥ 1.0.13) 的 HTTP 命令桥, 需要 AutoJs6 ≥ 6.8.0
 * 才有增量同步与删除文件的语义.
 */
export interface DeployOptions {
  /** 是否启用. 默认 `false` */
  enabled?: boolean;
  /** 扩展侧命令: `save` 只保存项目, `run` 保存后立即运行. 默认 `save` */
  command?: "save" | "run";
  /** 扩展 HTTP 命令桥的地址. 默认 `127.0.0.1` */
  host?: string;
  /**
   * 命令桥端口. 未设置时读取工作区 `.vscode/settings.json` 的 `autojs6.http.port`,
   * 仍取不到则用扩展的默认值 `10347`.
   */
  port?: number;
  /**
   * 触发同步的构建模式. 默认 `dev` (即 `--mode development*`);
   * 传 `all` 不限制, 或传模式名数组精确匹配.
   */
  modes?: "dev" | "all" | string[];
  /** 请求超时 (毫秒). 默认 `1500` */
  timeout?: number;
  /** 连接扩展失败时的行为: `warn` 打印一次警告 (默认), `silent` 完全静默 */
  onError?: "warn" | "silent";
}
