# AutoJs6 Script

用 TypeScript 写 [AutoJs6](https://github.com/SuperMonster003/AutoJs6) 脚本, 由 Vite 打包成 AutoJs6 可以直接执行的 `main.js`.

- 构建由 [`autojs6-dev`](https://www.npmjs.com/package/autojs6-dev) 的 Vite 插件完成: 单文件 CJS 产物、内置模块拦截、`"ui";` 注入、资源同步
- 脚本里直接用 AutoJs6 的全局 API (`device` / `app` / `ocr` / `images` ...), 不用 import 任何 SDK
- 代码提示来自官方声明文件 [`@sm003/autojs6-dts`](https://github.com/SuperMonster003/AutoJs6-TypeScript-Declarations)

## 快速开始

```bash
npm install
npm run dev        # 监听构建, 产物在 dist/
```

把 **`dist` 目录**部署到手机上 (VSCode + AutoJs6 扩展 / adb push / 文件管理器), 即可运行.

## 脚本

| 命令                   | 作用                                               |
| ---------------------- | -------------------------------------------------- |
| `npm run dev`          | 开发构建, 监听变更, 不压缩                         |
| `npm run dev:ui`       | 同上, 但使用 `src/main.ui.ts` 且产物首行是 `"ui";` |
| `npm run build`        | 正式构建 (压缩)                                    |
| `npm run build:ui`     | 正式构建 + UI 模式                                 |
| `npm run typecheck`    | 只做类型检查                                       |
| `npm run lint`         | oxlint 校验 (ES2018 限制)                          |
| `npm run lint:fix`     | oxlint 自动修复                                    |
| `npm run format`       | oxfmt 格式化                                       |
| `npm run format:check` | 只检查格式, 不写入                                 |
| `npm run check`        | typecheck + lint + 格式检查 + 构建                 |

## 写脚本

全局对象直接可用, 全程有类型提示 (Ctrl/⌘ + 点击可以跳到声明文件):

```ts
log(`${device.brand} ${device.model}`)
toast('已启动')

const lines = ocr.recognizeText() // string[]
const point = images.findColor(images.captureScreen(), '#FF0000')
click(540, 1200)
```

需要 Node 兼容模块时才 import, 且只支持默认导入:

```ts
import path from 'path' // → require("path")
```

## 目录结构

```
.
├── src/
│   ├── main.ts           # 普通脚本入口
│   └── main.ui.ts        # UI 模式入口
├── res/
│   ├── icon.png
│   └── layout/main.xml   # UI 布局
├── types/globals.d.ts    # 编译期常量 / ?raw 声明
├── .oxfmtrc.jsonc        # oxfmt 格式化配置
├── .oxlintrc.jsonc       # oxlint 校验配置 (限制 ES2018)
├── project.json          # AutoJs6 项目描述 (会同步到 dist)
├── vite.config.ts
└── tsconfig.json
```

`tsconfig.json` 里的 `types: ["@sm003/autojs6-dts"]` 是类型提示的来源, 不要删.

## 代码风格与 ES2018 限制

格式化用 [oxfmt](https://oxc.rs/docs/guide/usage/formatter), 校验用 [oxlint](https://oxc.rs/docs/guide/usage/linter):

```bash
npm run format        # 单引号 / 无分号 / 无尾随逗号 / 2 空格 / 100 列
npm run lint          # 检查
```

`.oxlintrc.jsonc` 把可用语法/API 限制在 **ES2018** (AutoJs6 的 Rhino 引擎只到这一档, 且构建不做 polyfill):

```ts
arr.flat() // ✖ ES2019
arr.flatMap((x) => x) // ✖ ES2019
text.replaceAll('-', '+') // ✖ ES2021, 改用 replace(/-/g, '+')
text.trimStart() // ✖ ES2019, 改用 replace(/^\s+/, '')
Object.fromEntries(entries) // ✖ ES2019
promise.allSettled(list) // ✖ ES2020
globalThis.foo // ✖ ES2020, 直接用具体全局对象
arr.at(-1) // ✖ ES2022, 改用 arr[arr.length - 1]
```

`no-undef` 是关闭的: `device` / `app` / `ocr` 这些 AutoJs6 全局由声明文件提供类型, 未定义变量交给 `tsc` 检查.

## 注意

- XML 布局不能写成字面量 (E4X), 会直接编译不过; 布局放 `res/layout/*.xml` 用 `ui.layoutFile()` 加载.
- 动态 `import()` 会被内联, 不能用来做懒加载.
- 顶层 `await` 不支持, 异步逻辑写在 `async` 函数里.
