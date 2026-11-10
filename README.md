# autojs6-dev

用 TypeScript 写 [AutoJs6](https://github.com/SuperMonster003/AutoJs6) 脚本的 **Vite 构建插件**.

只做构建这一件事: 把 ESM + TypeScript 源码打成 AutoJs6 (Rhino) 可以直接执行的单文件 `main.js`, 顺带处理内置模块、`"ui";` 指令和资源同步.

脚本里不需要任何 SDK —— `device` / `app` / `ocr` / `images` / `ui` 都是 AutoJs6 的全局对象, 直接用;
代码提示与类型检查来自官方声明文件 [`@sm003/autojs6-dts`](https://github.com/SuperMonster003/AutoJs6-TypeScript-Declarations) (已随本包安装).

```bash
npm i -D autojs6-dev vite typescript
```

---

## 快速开始

**1. `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import { autojs6 } from 'autojs6-dev';

export default defineConfig(({ mode }) => ({
  appType: 'custom',
  plugins: [
    autojs6({
      entry: 'src/main.ts',
      uiEntry: 'src/main.ui.ts', // UI 模式 (--mode *-ui) 使用的入口
      uiMode: mode.includes('ui')
    })
  ]
}));
```

**2. `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "lib": ["ES2018"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["@sm003/autojs6-dts"],
    "strict": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "types/**/*.d.ts"]
}
```

`types` 这一行就是全部类型提示的来源。

**3. `src/main.ts`**

```ts
async function main() {
  log(`${device.brand} ${device.model}`); // 设备信息, 全程有提示
  log(`Android ${device.release} (API ${device.sdkInt})`);

  toast('开始运行');

  const lines = ocr.recognizeText(); // 截屏 + 文字识别, 返回 string[]
  log(lines.join('\n'));
}

main();
```

**4. 构建**

```bash
npx vite build --mode production     # → dist/main.js
npx vite build --watch --mode development
```

`dist/` 目录 (含 `main.js` / `project.json` / `res`) 就是完整的 AutoJs6 项目, 直接部署到手机即可运行.

> 懒得手动搭? `npx autojs6-dev my-app --install` 会生成上面这套结构 (含 `src/main.ui.ts`、`project.json`、布局文件、tsconfig).

---

## 类型提示

本包把 `@sm003/autojs6-dts` 装成了依赖, 你不需要单独安装; 只要项目的 `tsconfig.json` 里带上它:

```json
{ "compilerOptions": { "types": ["@sm003/autojs6-dts"] } }
```

之后 `device` / `app` / `auto` / `automator` / `images` / `ocr` / `files` / `http` / `storages` / `ui` / `shell` / `sensors` / `media` / `speech` / `qrcode` ... 全部带类型, 跳转可直达声明文件.

```ts
const shot = images.captureScreen(); // ImageWrapper
const result = ocr.detect(shot); // Ocr.Result[]
result.forEach((item) => log(item.text, item.bounds));

app.launch('com.tencent.mm'); // App.PackageName
sleep(500);
```

个别 API 在声明文件里类型偏保守, 需要时自行断言即可 — 例如 `ui.findView()` 返回的是 `android.view.View`, 想要 `setText` / `on` 就断言成自己的接口:

```ts
interface TextViewLike {
  setText(text: string): void;
}
const title = ui.findView('title') as unknown as TextViewLike;
title.setText('Hello');
```

想用第三方 npm 包 (如 `dayjs` / `axios`) 照常 `import` 即可, 构建时会被内联进单文件.

---

## 插件选项

```ts
autojs6({
  entry: 'src/main.ts', // 入口脚本 (相对项目根)
  uiEntry: 'src/main.ui.ts', // UI 模式入口, 仅 uiMode 为 true 时生效
  uiMode: false, // 产物首行写入 "ui";
  outDir: 'dist', // 产物目录
  fileName: 'main.js', // 产物文件名
  assets: ['project.json', 'res', 'images'], // 同步到产物的资源, 传 false 关闭
  builtinModules: [], // 追加视为 AutoJs6 内置模块的包名
  target: 'es2018', // 编译目标 (Rhino 的安全线)
  minify: undefined, // 默认: 生产模式 true, 开发模式 false
  sourcemap: false,
  banner: '', // 自定义头部注释, 默认不写
  strict: false, // 是否写入 "use strict";, 默认不写
  define: {}, // 追加编译期常量
  log: true // 构建结束打印产物信息
});
```

产物头部保持干净: 默认没有任何注释, 也不会写 `"use strict";` —— 第一行就是代码; UI 模式下第一行是 `"ui";`.

---

## 工作原理

**1. 输出单文件 CJS**

```ts
build: {
  lib: { entry: 'src/main.ts', formats: ['cjs'], fileName: () => 'main.js' },
  target: 'es2018',   // async/await 原样保留, 又不会生成 Rhino 不认识的语法
  rollupOptions: { output: { inlineDynamicImports: true } },
}
```

AutoJs6 的模块加载器是 CommonJS 风格, `.mjs` 也不会启用原生 ESM 语义, 所以源码里的 `import` / `export` 必须全部内联掉.

**2. 拦截内置模块**

`import path from 'path'` / `import ui from 'ui'` 这类写法如果直接交给打包器, 会报「找不到依赖」或被打成浏览器桩代码. 插件把它们替换成虚拟模块:

```js
var mod = typeof ui !== 'undefined' ? ui : require('ui');
export default mod;
```

AutoJs6 里本身就是全局对象的 (`app` / `device` / `ui` / `images` ...) 直接取全局; 只有通过 `require` 才能拿到的 (`fs` / `path` / `lodash` ...) 走运行时 `require`. 完整名单见 `DEFAULT_BUILTIN_MODULES`, 可用 `builtinModules` 追加.

> 内置模块只支持默认导入 (`import ui from 'ui'`), 不支持 `import { launch } from 'app'`. 具名 API 直接用全局对象即可 (`app.launch(...)`).

**3. 注入 `"ui";`**

AutoJs6 要求 `"ui";` 是脚本的**第一个有效语句**. 插件在 `generateBundle` 阶段 (压缩之后) 写到产物最前面, 除此之外不添加任何头部:

```js
// 普通脚本
log('hi');

// UI 模式
('ui');
log('hi');
```

所以**不要在源码里手写 `"ui";`**. 反向检查也做了: 代码里用了 `ui.layout*` 却没开 UI 模式时, 构建会给出警告.

**4. 同步静态资源**

`project.json` / `res/` / `images/` 会原样拷贝到产物目录, watch 重建也会重新同步.

---

## 脚手架 CLI

```bash
npx autojs6-dev my-app              # 生成项目
npx autojs6-dev my-app --install    # 生成并安装依赖
npx autojs6-dev my-app --force      # 目标目录非空也继续
```

生成的项目:

```
my-app/
├── src/
│   ├── main.ts           # 普通脚本入口
│   └── main.ui.ts        # UI 模式入口
├── res/
│   ├── icon.png
│   └── layout/main.xml
├── types/globals.d.ts
├── .oxfmtrc.jsonc        # oxfmt 格式化配置
├── .oxlintrc.jsonc       # oxlint 校验配置 (限制 ES2018)
├── project.json
├── vite.config.ts
├── tsconfig.json
└── package.json
```

| 命令 (在生成的项目里)  | 作用                                       |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | 开发构建, 监听变更, 不压缩                 |
| `npm run dev:ui`       | 同上, UI 模式 (`"ui";` + `src/main.ui.ts`) |
| `npm run build`        | 正式构建 (压缩)                            |
| `npm run build:ui`     | 正式构建 + UI 模式                         |
| `npm run typecheck`    | 类型检查                                   |
| `npm run lint`         | oxlint 校验 (限制 ES2018 语法与 API)       |
| `npm run lint:fix`     | oxlint 自动修复                            |
| `npm run format`       | oxfmt 格式化                               |
| `npm run format:check` | 只检查格式                                 |
| `npm run check`        | typecheck + lint + 格式检查 + 构建         |

模板自带 `.oxlintrc.jsonc`, 把可用 API 限制在 **ES2018** —— AutoJs6 的 Rhino 引擎只支持到这一档, 而构建只做语法降级 (esbuild 不 polyfill):

```ts
arr.flat(); // ✖ ES2019
text.replaceAll('-', '+'); // ✖ ES2021 → replace(/-/g, '+')
Object.fromEntries(entries); // ✖ ES2019
globalThis.foo; // ✖ ES2020
arr.at(-1); // ✖ ES2022 → arr[arr.length - 1]
```

`no-undef` 有意关闭: `device` / `app` / `ocr` 这些 AutoJs6 全局由 `@sm003/autojs6-dts` 提供类型, 未定义变量交给 `tsc` 检查, 不必在 lint 里维护一份全局清单.

---

## 部署到 AutoJs6

构建产物 `dist/` 就是完整的 AutoJs6 项目目录:

```
dist/
├── main.js
├── project.json
└── res/
```

三种常见方式:

1. **VSCode + AutoJs6 扩展** (推荐): 把 `dist` 作为项目目录打开, 保存即同步到手机.
2. **adb**: `adb push dist/. /sdcard/脚本/hello/`
3. **文件管理器 / 微信传输**: 整体拷到手机存储目录.

---

## 常见问题

**产物报 SyntaxError?**
确认 AutoJs6 ≥ 6.8.0 (`async/await` 从该版本起支持); 仍不行把 `target` 调到 `es2017`.

**某些全局 API 没有类型提示?**
检查 `tsconfig.json` 的 `types` 是否包含 `@sm003/autojs6-dts`, 然后重启编辑器 (VSCode 有时需要重新索引声明文件).

**XML 布局不能写成字面量?**
E4X 只有 Rhino 能解析, TypeScript / esbuild 会直接报语法错误. 布局放 `res/layout/*.xml`, 用 `ui.layoutFile()` 加载.

**动态 `import()`?**
会被 `inlineDynamicImports` 内联进单文件, 不能做懒加载.

**顶层 `await`?**
不支持. 异步逻辑写在 `async` 函数里再调用.

**想引入本地文本资源 (布局 XML 等)?**
用 `?raw` 后缀, 得到字符串: `import xml from '../res/layout/main.xml?raw'`.

---

## 本仓库开发

```bash
pnpm install
pnpm run build        # 产出 dist/plugin (插件 + 类型)
pnpm run typecheck
pnpm run lint         # oxlint
pnpm run format       # oxfmt

# 端到端验证: 模板项目通过 file:.. 引用本包
cd template && npm install && npm run build
```

> 用 pnpm 在 `template/` 里安装时可能提示 `Ignored build scripts: esbuild`, 不影响构建.

| 命令                               | 作用                              |
| ---------------------------------- | --------------------------------- |
| `pnpm run lint` / `lint:fix`       | oxlint 校验 (自动修复)            |
| `pnpm run format` / `format:check` | oxfmt 格式化 (只检查不写入)       |
| `pnpm run check`                   | 类型检查 + lint + 格式检查 + 构建 |

代码风格由两份配置固定下来 —— 根目录一份 (插件源码), `template/` 目录一份 (随脚手架一起发布给使用方):

| 文件                       | 工具                                               | 说明                                                            |
| -------------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| `.oxfmtrc.jsonc`           | [oxfmt](https://oxc.rs/docs/guide/usage/formatter) | 单引号 / 无分号 / 无尾随逗号 / 2 空格 / 100 列 / LF             |
| `.oxlintrc.jsonc`          | [oxlint](https://oxc.rs/docs/guide/usage/linter)   | correctness=error, suspicious/perf=warn, TS 项目关闭 `no-undef` |
| `template/.oxfmtrc.jsonc`  | oxfmt                                              | 同上 (生成的项目可独立使用)                                     |
| `template/.oxlintrc.jsonc` | oxlint                                             | 同上 + 限制到 ES2018 的规则集                                   |

工具会就近取配置, 所以在根目录跑 `lint` / `format` 时, `template/` 下的文件用的是模板自己那份.

> 注意文件名里的 `rc` 不能省: oxfmt 只认 `.oxfmtrc.json` / `.oxfmtrc.jsonc`, oxlint 只认 `.oxlintrc.json` / `.oxlintrc.jsonc`.
> 写成 `.oxfmt.jsonc` / `.oxlint.jsonc` 时工具会提示 "No config found" 并回落到默认值.

```
src/
├── index.ts        # 包入口 (导出插件)
├── autojs6.ts      # 插件实现
├── builtin.ts      # AutoJs6 内置模块名单
└── options.ts      # 插件选项类型
scripts/build.mjs   # ESM + CJS 双格式打包 + 类型声明
bin/create.mjs      # 脚手架 CLI
template/           # 脚手架模板 (也是端到端示例)
```

## 相关链接

- AutoJs6: <https://github.com/SuperMonster003/AutoJs6>
- AutoJs6 文档: <https://docs.autojs6.com>
- 声明文件: <https://github.com/SuperMonster003/AutoJs6-TypeScript-Declarations>

## License

MIT
