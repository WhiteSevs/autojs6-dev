import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig, UserConfig } from 'vite';
import { DEFAULT_BUILTIN_MODULES, builtinModuleCode } from './builtin';
import type { AutoJs6Options } from './options';

const VIRTUAL_PREFIX = '\0autojs6:builtin:';

const DEFAULT_ASSETS = ['project.json', 'res', 'images'];

/**
 * AutoJs6 + Vite 打包插件.
 *
 * 负责四件事:
 * 1. 把构建配置改成「单文件 CJS 产物」, 让 Rhino 能直接执行;
 * 2. 拦截 AutoJs6 内置模块的 import, 避免被打包器判为缺少依赖;
 * 3. 注入 `"ui";` 指令与编译期常量;
 * 4. 把 `project.json` / `res` / `images` 等静态资源拷贝到产物目录.
 *
 * 脚本里的 API 全部来自 AutoJs6 运行时本身 (`device` / `ocr` / `images` ...),
 * 类型提示由官方声明文件 `@sm003/autojs6-dts` 提供, 插件不额外封装 API.
 */
export function autojs6(options: AutoJs6Options = {}): Plugin {
  const {
    entry = 'src/main.ts',
    uiEntry,
    outDir = 'dist',
    fileName = 'main.js',
    uiMode = false,
    assets = DEFAULT_ASSETS,
    builtinModules = [],
    target = 'es2018',
    banner = '',
    define = {},
    strict = false,
    log = true
  } = options;

  const builtinSet = new Set<string>([...DEFAULT_BUILTIN_MODULES, ...builtinModules]);

  let resolved: ResolvedConfig;
  let isDev = false;
  let entryFile = entry;

  return {
    name: 'vite-plugin-autojs6',
    // 必须先于 vite:resolve 拦截内置模块名
    enforce: 'pre',

    config(userConfig, env): UserConfig {
      const root = path.resolve(userConfig.root ?? process.cwd());
      isDev = !env.mode.startsWith('production');

      const useUiEntry = uiMode && !!uiEntry && fs.existsSync(path.resolve(root, uiEntry));
      entryFile = useUiEntry ? (uiEntry as string) : entry;

      return {
        build: {
          outDir,
          emptyOutDir: true,
          target,
          minify: options.minify ?? !isDev,
          sourcemap: options.sourcemap ?? false,
          reportCompressedSize: false,
          // 产物是给移动端脚本引擎用的, 体积警告没有意义
          chunkSizeWarningLimit: 4096,
          lib: {
            entry: path.resolve(root, entryFile),
            formats: ['cjs'],
            fileName: () => fileName
          },
          rollupOptions: {
            output: {
              format: 'cjs',
              entryFileNames: fileName,
              // 运行时没有 import() 能力, 动态导入必须内联
              inlineDynamicImports: true,
              exports: 'auto',
              // 默认不写 "use strict": AutoJs6 脚本不需要它, 产物保持干净
              strict
            }
          }
        },
        define: {
          ...define
        }
      };
    },

    configResolved(config) {
      resolved = config;
    },

    buildStart() {
      const file = path.resolve(resolved.root, entryFile);
      if (!fs.existsSync(file)) {
        this.error(
          `找不到入口脚本: ${path.relative(resolved.root, file)}\n` +
            '  请检查 autojs6() 的 entry 选项.'
        );
      }
    },

    resolveId(source) {
      if (builtinSet.has(source)) {
        return VIRTUAL_PREFIX + source;
      }
      return null;
    },

    load(id) {
      if (id.startsWith(VIRTUAL_PREFIX)) {
        return builtinModuleCode(id.slice(VIRTUAL_PREFIX.length));
      }
      return null;
    },

    /**
     * 产物头部由这里写入, 而不是用 `output.banner`.
     *
     * 原因: `"ui";` 必须是脚本的第一个有效语句, 并且要在压缩之后写入,
     * 否则头部注释会被 minifier 删掉. 没有 `"ui";` 和自定义 banner 时
     * 不写任何头部, 产物第一行就是代码.
     */
    generateBundle(_outputOptions, bundle) {
      const prefix = buildBanner({ uiMode, banner });

      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          if (prefix) {
            chunk.code = prefix + '\n' + chunk.code;
          }

          // 用了 ui.layout* 却没开 UI 模式, 产物到手机上会直接抛异常, 提前提醒
          if (!uiMode && /\bui\.(layout|layoutFile)\s*\(/.test(chunk.code)) {
            resolved.logger.warn(
              '检测到 ui.layout* 调用, 但当前不是 UI 模式 (产物缺少首行 "ui";).\n' +
                '  请用 npm run dev:ui / npm run build:ui 构建, 或在 autojs6() 里设置 uiMode: true.',
              { timestamp: true }
            );
          }
          break;
        }
      }
    },

    writeBundle(_outputOptions, bundle) {
      const root = resolved.root;
      const outDirAbs = path.resolve(root, resolved.build.outDir);

      const copied: string[] = [];
      for (const asset of assets === false ? [] : assets) {
        const from = path.resolve(root, asset);
        const to = path.resolve(outDirAbs, asset);
        // 防止把产物目录自身再拷贝进去
        if (to === from || from.startsWith(outDirAbs + path.sep)) continue;
        if (!fs.existsSync(from)) continue;
        fs.cpSync(from, to, { recursive: true, dereference: true });
        copied.push(asset);
      }

      if (!log) {
        return;
      }

      const mainAsset = bundle[fileName];
      const size = mainAsset && 'code' in mainAsset ? Buffer.byteLength(mainAsset.code) : 0;
      const kb = (size / 1024).toFixed(1);
      const tag = isDev ? 'dev' : 'build';
      const ui = uiMode ? ' · UI 模式' : '';

      resolved.logger.info(
        `\x1b[36m[autojs6]\x1b[0m ${tag} 产物 → ` +
          `${path.relative(root, path.join(outDirAbs, fileName))} (${kb} kB)${ui}` +
          (copied.length ? ` · 已同步 ${copied.join(', ')}` : ''),
        { timestamp: true }
      );
    }
  };
}

function buildBanner(input: { uiMode: boolean; banner: string }) {
  const lines: string[] = [];

  // AutoJs6 要求 `"ui";` 是脚本的第一个有效语句, 因此必须放在最前面.
  if (input.uiMode) {
    lines.push('"ui";');
  }

  if (input.banner) {
    lines.push(input.banner);
  }

  return lines.join('\n');
}

export default autojs6;
