#!/usr/bin/env node
/**
 * 用 autojs6-dev 的模板创建一个新项目.
 *
 *   npx autojs6-dev my-app
 *   npx autojs6-dev my-app --install
 *   npx autojs6-dev create my-app --ui ...
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TEMPLATE = path.join(ROOT, 'template');
const SELF = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/** 模板里不参与复制的目录/文件 */
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.vscode', '.idea', '.workbuddy']);
const SKIP_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.DS_Store',
  'Thumbs.db'
]);

const REWRITABLE = new Set(['package.json', 'project.json', 'README.md']);

const USAGE = `
创建一个新的 AutoJs6 脚本项目

  用法   npx autojs6-dev <目录名> [选项]
         npx autojs6-dev create <目录名> [选项]

  选项
    --install    创建后自动执行 npm install
    --force      目标目录非空时仍然继续
    -h, --help   显示帮助

  示例
    npx autojs6-dev my-app
    npx autojs6-dev create my-app --install
`.trim();

// ---------------------------------------------------------------- 参数解析

const flags = { install: false, force: false };
let target = '';

for (const arg of process.argv.slice(2)) {
  if (arg === '-h' || arg === '--help') {
    console.log(USAGE);
    process.exit(0);
  }
  if (arg === 'create') {
    continue;
  }
  if (arg === '--install') {
    flags.install = true;
    continue;
  }
  if (arg === '--force') {
    flags.force = true;
    continue;
  }
  if (arg.startsWith('-')) {
    fail(`未知选项: ${arg}`);
  }
  if (target) {
    fail(`只能指定一个目录名, 收到了 "${target}" 和 "${arg}"`);
  }
  target = arg;
}

if (!target) {
  console.log(USAGE);
  process.exit(1);
}

if (!fs.existsSync(TEMPLATE)) {
  fail(`未找到模板目录: ${TEMPLATE}`);
}

// ---------------------------------------------------------------- 命名

const folderName = path.basename(target.replace(/[\\/]+$/, ''));
const packageName = toPackageName(folderName);
if (!packageName) {
  fail(`"${folderName}" 无法转换为合法的包名, 请换一个目录名`);
}

const title = toTitle(folderName);
const dest = path.resolve(process.cwd(), target);

if (fs.existsSync(dest)) {
  const entries = fs.readdirSync(dest);
  if (entries.length > 0 && !flags.force) {
    fail(`目录已存在且非空: ${dest}\n  如需继续请加 --force`);
  }
}

// ---------------------------------------------------------------- 复制与改写

const copied = [];
copyTree(TEMPLATE, dest);

if (flags.install) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  console.log(`\n→ npm install`);
  const result = spawnSync(npm, ['install'], {
    cwd: dest,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) {
    console.log('\n! 依赖安装失败, 请进入目录手动执行 npm install');
  }
}

console.log(`
✔ 已创建 ${title}
  目录  ${dest}
  包名  ${packageName}
  文件  ${copied.length} 个
`);

console.log('下一步:');
console.log(`  cd ${path.relative(process.cwd(), dest) || '.'}`);
if (!flags.install) {
  console.log('  npm install');
}
console.log('  npm run dev        # 监听构建, 产物在 dist/');
console.log('  npm run dev:ui     # UI 模式');
console.log('  把 dist/ 目录部署到 AutoJs6 即可运行\n');

// ---------------------------------------------------------------- 函数

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function toPackageName(raw) {
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-._]+/, '')
    .replace(/[-._]+$/, '');
}

function toTitle(raw) {
  return String(raw)
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function copyTree(fromDir, toDir, rel = '') {
  fs.mkdirSync(toDir, { recursive: true });

  for (const entry of fs.readdirSync(fromDir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    // npm 打包时会丢掉 .gitignore, 模板里用 _gitignore 存一份, 生成时改回名字
    const targetName = entry.name === '_gitignore' ? '.gitignore' : entry.name;
    const from = path.join(fromDir, entry.name);
    const to = path.join(toDir, targetName);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      copyTree(from, to, relPath);
      continue;
    }

    if (!entry.isFile() || SKIP_FILES.has(entry.name)) continue;

    if (REWRITABLE.has(relPath)) {
      fs.writeFileSync(to, rewrite(relPath, fs.readFileSync(from, 'utf8')));
    } else {
      fs.copyFileSync(from, to);
    }
    copied.push(targetName === entry.name ? relPath : targetName);
  }
}

function rewrite(relPath, content) {
  if (relPath === 'package.json') {
    const pkg = JSON.parse(content);
    pkg.name = packageName;
    pkg.version = '0.1.0';
    pkg.description = `${title} — AutoJs6 脚本 (autojs6-dev + Vite + TypeScript)`;
    pkg.private = true;
    pkg.devDependencies = pkg.devDependencies || {};
    pkg.devDependencies['autojs6-dev'] = `^${SELF.version}`;
    return `${JSON.stringify(pkg, null, 2)}\n`;
  }

  if (relPath === 'project.json') {
    const project = JSON.parse(content);
    project.name = title;
    project.packageName = `com.example.${packageName.replace(/[^a-z0-9]/g, '')}`;
    return `${JSON.stringify(project, null, 2)}\n`;
  }

  if (relPath === 'README.md') {
    return content.replace(/^# .+$/m, `# ${title}`);
  }

  return content;
}
