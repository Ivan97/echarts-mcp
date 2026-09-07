import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TransportKind } from '../types.js';
import type { Config } from '../config.js';
import type { StorageAdapter } from '../deliver/types.js';
import { registerCartesianTemplates } from '../charts/cartesian.js';
import { registerCategoricalTemplates } from '../charts/categorical.js';
import { registerStructuralTemplates } from '../charts/structural.js';
import { registerCoordinateTemplates } from '../charts/coordinate.js';
import { registerGenerateChart } from '../tools/generate-chart.js';
import { registerRenderOption } from '../tools/render-option.js';
import { registerListChartTypes } from '../tools/list-chart-types.js';

export interface ServerDeps {
  config: Config;
  store: StorageAdapter;
  transport: TransportKind;
}

export const SERVER_NAME = 'echarts-mcp';
export const SERVER_VERSION = '0.1.0';

/**
 * 与传输层无关的核心。stdio 与 http 两个 entry 共用这一份工具注册代码，
 * 差异只体现在传入的 `transport`（它决定交付通道的默认值）。
 */
export function createServer(deps: ServerDeps): McpServer {
  registerCartesianTemplates();
  registerCategoricalTemplates();
  registerStructuralTemplates();
  registerCoordinateTemplates();

  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerGenerateChart(server, deps);
  registerRenderOption(server, deps);
  registerListChartTypes(server, deps);
  return server;
}
