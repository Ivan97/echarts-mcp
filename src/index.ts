/**
 * 库入口。
 *
 * 多数人通过两个可执行命令使用本包（`echarts-mcp` 与 `echarts-mcp-http`），
 * 这里导出的是给需要嵌入的场景：把 MCP server 挂进自己已有的 Express 应用，
 * 或在自己的进程里直接调用图表构建与渲染。
 */

export { createServer, SERVER_NAME, SERVER_VERSION, type ServerDeps } from './core/server.js';
export { createApp } from './transport/http.js';

export { loadConfig, type Config } from './config.js';
export { ChartError, ErrorCode } from './errors.js';

export {
  ChartType,
  OutputFormat,
  DeliveryRequest,
  DeliveryChannel,
  RendererKind,
  ThemeName,
  TransportKind,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  type ChartData,
  type Dataset,
  type NodeLinkData,
  type TreeNode,
} from './types.js';

export { buildOption, type BuildOptionInput } from './option/build.js';
export { deepMerge } from './option/merge.js';
export { THEMES, AXIS_THEMES, THEME_FONT_STACK } from './option/themes.js';

export { CHART_TEMPLATES, getTemplate, registerTemplate, type ChartTemplate } from './charts/registry.js';
export { getVariants, VARIANTS, type ChartVariant } from './charts/variants.js';
export { registerCartesianTemplates } from './charts/cartesian.js';
export { registerCategoricalTemplates } from './charts/categorical.js';
export { registerStructuralTemplates } from './charts/structural.js';

export {
  selectRenderer,
  SvgRenderer,
  ResvgRenderer,
  CanvasRenderer,
  isCanvasAvailable,
  looksEmpty,
  unknownSeriesTypes,
  inspectOption,
  type Renderer,
  type RenderResult,
  type RenderSize,
} from './render/index.js';

export { buildStandaloneHtml } from './html/standalone.js';

export { LocalDiskStore } from './deliver/local-disk.js';
export { type StorageAdapter, type StoredObject } from './deliver/types.js';
export { resolveDelivery, type Resolved } from './deliver/resolve.js';
export { deliver, type McpContent } from './deliver/deliver.js';
