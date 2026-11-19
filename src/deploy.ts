import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { DeployOptions } from "./options";

/**
 * 通过 AutoJs6 VSCode 扩展把产物目录同步到手机.
 *
 * 扩展在激活时 (VSCode 启动即激活) 会监听一个本机 HTTP 命令桥,
 * `GET /exec?cmd=saveProject&path=<项目目录>` 就能触发它的「保存项目到设备」命令.
 * 这条通道是「发完立即返回 200」的语义, 拿不到同步结果, 所以这里只承诺
 * 「请求已送达扩展」, 失败原因也只在变化时上报一次, 免得 watch 模式刷屏.
 */

/** 扩展 HTTP 命令桥的默认端口 (`autojs6.http.port` 的默认值). */
export const DEFAULT_HTTP_PORT = 10347;

/** 选项名 → 扩展命令名. 两者都在扩展的 HTTP 白名单里. */
const COMMANDS = {
  save: "saveProject",
  run: "runProject"
} as const;

const TAG = "\x1b[36m[autojs6]\x1b[0m";

/** 规范化后的同步配置. */
export interface DeploySettings {
  command: (typeof COMMANDS)[keyof typeof COMMANDS];
  host: string;
  port: number;
  timeout: number;
  silent: boolean;
}

export interface DeployLogger {
  info(message: string): void;
  warn(message: string): void;
}

export interface Deployer {
  /**
   * 触发一次同步. 返回值用于拼接构建日志, `null` 表示本次跳过.
   * 请求是 fire-and-forget, 不会阻塞构建.
   */
  trigger(projectDir: string): string | null;
}

/** 规范化 `deploy` 选项; 未启用或当前模式不命中时返回 `null`. */
export function resolveDeploy(
  options: DeployOptions | false | undefined,
  root: string,
  mode: string
): DeploySettings | null {
  if (!options || options.enabled === false || !matchMode(options.modes, mode)) {
    return null;
  }

  return {
    command: COMMANDS[options.command ?? "save"],
    host: options.host ?? "127.0.0.1",
    port: options.port ?? readExtensionPort(root) ?? DEFAULT_HTTP_PORT,
    timeout: options.timeout ?? 1500,
    silent: options.onError === "silent"
  };
}

function matchMode(modes: DeployOptions["modes"], mode: string) {
  if (!modes || modes === "dev") {
    // 与插件自身的开发模式判断保持一致: --mode development / development-ui
    return mode.startsWith("development");
  }
  return modes === "all" || modes.includes(mode);
}

/**
 * 读取工作区 `.vscode/settings.json` 里的 `autojs6.http.port`.
 * settings.json 允许注释, 用正则取值而不是 JSON.parse.
 */
export function readExtensionPort(root: string): number | undefined {
  try {
    const text = fs.readFileSync(path.join(root, ".vscode", "settings.json"), "utf8");
    const matched = /"autojs6\.http\.port"\s*:\s*(\d+)/.exec(text);
    return matched ? Number(matched[1]) : undefined;
  } catch {
    // 没有工作区设置时沿用扩展默认端口
    return undefined;
  }
}

export function createDeployer(settings: DeploySettings, logger: DeployLogger): Deployer {
  const target = `${settings.host}:${settings.port}`;
  let inflight = false;
  let lastError = "";

  function report(message: string) {
    if (settings.silent || message === lastError) {
      return;
    }
    lastError = message;
    logger.warn(`${TAG} ${message}`);
  }

  return {
    trigger(projectDir) {
      // 扩展靠 project.json 认定项目目录, 缺失时会直接报错, 这里提前说清楚
      if (!fs.existsSync(path.join(projectDir, "project.json"))) {
        report(
          "产物目录缺少 project.json, 已跳过同步到设备.\n" +
            "  AutoJs6 依赖它识别项目, 请确认 assets 选项包含 project.json."
        );
        return null;
      }
      // 上一笔请求还没回来 (watch 连续重建), 跳过本次
      if (inflight) {
        return null;
      }

      inflight = true;
      void (async () => {
        try {
          await sendProject(settings, projectDir);
          if (lastError) {
            lastError = "";
            logger.info(`${TAG} 已恢复与 VSCode 扩展的连接 (${target})`);
          }
        } catch (error) {
          report(describeError(error as NodeJS.ErrnoException, settings, target));
        } finally {
          inflight = false;
        }
      })();

      return `已请求同步到设备 (${target})`;
    }
  };
}

function sendProject(settings: DeploySettings, projectDir: string): Promise<void> {
  const query = `cmd=${encodeURIComponent(settings.command)}&path=${encodeURIComponent(projectDir)}`;

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: settings.host,
        port: settings.port,
        path: `/exec?${query}`,
        method: "GET",
        agent: false,
        timeout: settings.timeout
      },
      (response) => {
        // 响应体只有一行文本, 没有结果语义, 读完即可
        response.resume();
        response.on("end", () => resolve());
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error(`timeout after ${settings.timeout}ms`));
    });
    request.on("error", reject);
    request.end();
  });
}

function describeError(error: NodeJS.ErrnoException, settings: DeploySettings, target: string) {
  if (error.code === "ECONNREFUSED") {
    return (
      `无法连接 VSCode 扩展的 HTTP 命令桥 (${target}): 端口无人监听.\n` +
      "  请确认 VSCode 已打开且 AutoJs6 扩展已连接设备;\n" +
      "  不需要自动同步时把 deploy 设为 false (或删掉 deploy 选项)."
    );
  }
  if (error.code === "ETIMEDOUT" || /timeout/i.test(error.message ?? "")) {
    return `VSCode 扩展响应超时 (${target}, ${settings.timeout}ms), 本次同步可能未完成.`;
  }
  return `同步到设备失败 (${target}): ${error.message || String(error)}`;
}
