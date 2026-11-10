#!/usr/bin/env node
/**
 * 打包 autojs6-dev 自身.
 *
 * 产物:
 *   dist/plugin/index.js    插件 (ESM, 给 vite.config 用)
 *   dist/plugin/index.cjs   插件 (CJS, 兼容老配置)
 *   dist/plugin/*.d.ts      类型声明
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/** 让 `import ... from 'autojs6-dev'` 顺带带上 AutoJs6 的全局类型提示 */
const REFERENCE = '/// <reference types="@sm003/autojs6-dts" />';

main().catch((error) => {
  console.error(`\n✖ 构建失败: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  await buildPlugin();
  emitTypes();
  report();
}

/** 插件: Node 侧代码, 同时产出 ESM 与 CJS, 依赖全部外置 */
async function buildPlugin() {
  await build({
    configFile: false,
    root: ROOT,
    publicDir: false,
    logLevel: 'warn',
    build: {
      outDir: 'dist/plugin',
      emptyOutDir: true,
      copyPublicDir: false,
      target: 'node18',
      minify: false,
      sourcemap: false,
      lib: {
        entry: path.join(ROOT, 'src/index.ts'),
        formats: ['es', 'cjs'],
        fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs')
      },
      rollupOptions: {
        external: ['vite', /^node:/],
        output: { exports: 'named' }
      }
    }
  });
}

/** 用 tsc 生成类型声明 (esbuild/vite 不做这件事) */
function emitTypes() {
  const tsc = path.join(ROOT, 'node_modules/typescript/bin/tsc');

  try {
    execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], {
      cwd: ROOT,
      stdio: 'inherit'
    });
  } catch (error) {
    throw new Error(`类型声明生成失败${error instanceof Error ? `: ${error.message}` : ''}`, {
      cause: error
    });
  }

  ensureReference(path.join(DIST, 'plugin/index.d.ts'));
}

function ensureReference(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('/// <reference types="@sm003/autojs6-dts" />')) {
    return;
  }
  fs.writeFileSync(file, `${REFERENCE}\n${text}`, 'utf8');
}

function report() {
  console.log(`\n\x1b[36m[autojs6-dev]\x1b[0m v${pkg.version} 构建完成`);

  for (const file of ['plugin/index.js', 'plugin/index.cjs']) {
    const full = path.join(DIST, file);
    if (!fs.existsSync(full)) {
      continue;
    }
    const size = fs.statSync(full).size;
    console.log(`  ${file.padEnd(20)} ${(size / 1024).toFixed(1)} kB`);
  }
  console.log('');
}
