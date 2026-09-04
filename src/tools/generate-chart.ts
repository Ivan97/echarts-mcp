import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ChartType,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  DeliveryRequest,
  OutputFormat,
  ThemeName,
  type ChartData,
} from '../types.js';
import { buildOption } from '../option/build.js';
import { selectRenderer } from '../render/index.js';
import { assertRenderBudget } from '../render/budget.js';
import { resolveDelivery } from '../deliver/resolve.js';
import { deliver } from '../deliver/deliver.js';
import { assertOptionSize, toToolError } from '../core/errors.js';
import type { ServerDeps } from '../core/server.js';

const datasetSchema = z.object({
  dimensions: z
    .array(z.string())
    .describe('维度名。多数类型第 1 项为类目轴，其余每项生成一条系列'),
  source: z
    .array(z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]))
    .describe('数据行。可以是数组（顺序与 dimensions 对应）或对象（键为 dimensions 中的名字）'),
});

const nodeLinkSchema = z.object({
  nodes: z.array(z.object({ name: z.string(), value: z.number().optional() })),
  links: z.array(
    z.object({ source: z.string(), target: z.string(), value: z.number().optional() }),
  ),
});

const treeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    name: z.string(),
    value: z.number().optional(),
    children: z.array(treeSchema).optional(),
  }),
);

export const generateChartShape = {
  type: z
    .nativeEnum(ChartType)
    .describe('图表类型。调用 list_chart_types 可查看每种类型的 data 结构与可用的细分样式'),
  data: z
    .union([datasetSchema, nodeLinkSchema, treeSchema])
    .describe(
      '数据。多数类型用 { dimensions, source }；sankey 与 graph 用 { nodes, links }；' +
        'tree 用递归的 { name, children }',
    ),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  theme: z.nativeEnum(ThemeName).optional().describe('内置主题，默认 default'),
  width: z.number().int().positive().optional().describe(`宽度，默认 ${DEFAULT_WIDTH}`),
  height: z.number().int().positive().optional().describe(`高度，默认 ${DEFAULT_HEIGHT}`),
  optionOverrides: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      '任意 ECharts option 片段，深合并到模板产物上。堆叠、横向、极坐标、双 Y 轴等细分样式' +
        '都靠它实现，不需要换工具。调用 list_chart_types 并传入 type 可拿到现成片段',
    ),
  output: z.nativeEnum(OutputFormat).optional().describe('svg | png | option | html'),
  delivery: z.nativeEnum(DeliveryRequest).optional().describe('auto | inline | file | url'),
};

export function registerGenerateChart(server: McpServer, deps: ServerDeps): void {
  server.registerTool(
    'generate_chart',
    {
      title: '生成图表',
      description:
        '用 Apache ECharts 生成图表。给定图表类型与数据即可出图。' +
        '需要堆叠、横向、双 Y 轴等细分样式时，在 optionOverrides 里追加 ECharts option 片段，' +
        '不需要换工具。共支持 18 种类型，具体的 data 结构用 list_chart_types 查询。',
      inputSchema: generateChartShape,
    },
    async (args) => {
      try {
        const option = buildOption({
          type: args.type,
          data: args.data as ChartData,
          title: args.title,
          subtitle: args.subtitle,
          theme: args.theme,
          optionOverrides: args.optionOverrides,
        });
        assertOptionSize(option, deps.config.maxOptionBytes);
        assertRenderBudget(option, deps.config.maxDataPoints);

        const resolved = resolveDelivery({
          transport: deps.transport,
          output: args.output,
          delivery: args.delivery,
        });
        const size = { width: args.width ?? DEFAULT_WIDTH, height: args.height ?? DEFAULT_HEIGHT };
        const renderer = await selectRenderer(deps.config.renderer, resolved.output, deps.config.fontFiles);

        return {
          content: await deliver({
            option,
            resolved,
            size,
            renderer,
            store: deps.store,
            title: args.title,
          }),
        };
      } catch (e) {
        return toToolError(e);
      }
    },
  );
}
