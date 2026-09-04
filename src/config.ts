import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RendererKind } from './types.js';
import { ChartError, ErrorCode } from './errors.js';

export interface Config {
  token?: string;
  port: number;
  publicUrl?: string;
  storageDir: string;
  storageTtlSeconds: number;
  renderer: RendererKind;
  /** 单次渲染的期望耗时上限。仅作记录用途 —— ECharts SSR 是同步调用，无法用它构造真正的超时中断。 */
  renderTimeoutMs: number;
  maxOptionBytes: number;
  maxDataPoints: number;
  /** 显式字体文件路径。容器里自带精简字体时用它绕开自动探测。 */
  fontFiles?: string[];
}

function intOf(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ChartError(ErrorCode.InvalidInput, `${key} 必须是正整数，收到 "${raw}"`, key);
  }
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rendererRaw = env.ECHARTS_MCP_RENDERER ?? RendererKind.Auto;
  const renderer = Object.values(RendererKind).find((v) => v === rendererRaw);
  if (!renderer) {
    throw new ChartError(
      ErrorCode.InvalidInput,
      `ECHARTS_MCP_RENDERER 取值非法："${rendererRaw}"，可选：${Object.values(RendererKind).join(', ')}`,
      'ECHARTS_MCP_RENDERER',
    );
  }
  return {
    token: env.ECHARTS_MCP_TOKEN || undefined,
    port: intOf(env, 'ECHARTS_MCP_PORT', 3000),
    publicUrl: env.ECHARTS_MCP_PUBLIC_URL || undefined,
    storageDir: env.ECHARTS_MCP_STORAGE_DIR || join(tmpdir(), 'echarts-mcp'),
    storageTtlSeconds: intOf(env, 'ECHARTS_MCP_STORAGE_TTL', 3600),
    renderer,
    renderTimeoutMs: intOf(env, 'ECHARTS_MCP_RENDER_TIMEOUT_MS', 10000),
    maxOptionBytes: intOf(env, 'ECHARTS_MCP_MAX_OPTION_BYTES', 2_000_000),
    maxDataPoints: intOf(env, 'ECHARTS_MCP_MAX_DATA_POINTS', 50_000),
    fontFiles: env.ECHARTS_MCP_FONT_FILES
      ? env.ECHARTS_MCP_FONT_FILES.split(',').map((f) => f.trim()).filter(Boolean)
      : undefined,
  };
}
