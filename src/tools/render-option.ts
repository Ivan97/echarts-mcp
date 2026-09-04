import { z } from 'zod';
import type { EChartsOption } from 'echarts';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, DeliveryRequest, OutputFormat, ThemeName } from '../types.js';
import { THEMES } from '../option/themes.js';
import { deepMerge } from '../option/merge.js';
import { selectRenderer } from '../render/index.js';
import { assertRenderBudget } from '../render/budget.js';
import { resolveDelivery } from '../deliver/resolve.js';
import { deliver } from '../deliver/deliver.js';
import { assertOptionSize, toToolError } from '../core/errors.js';
import type { ServerDeps } from '../core/server.js';

export function registerRenderOption(server: McpServer, deps: ServerDeps): void {
  server.registerTool(
    'render_option',
    {
      title: '渲染 ECharts option',
      description:
        '直接给出完整的 ECharts option 并渲染，能力上限等同 ECharts 本身。' +
        '适合模板覆盖不到的高级需求，例如多坐标系、自定义 series 组合。' +
        '常规图表建议优先用 generate_chart，稳定性更好。' +
        '注意 ECharts 对非法 option 不会报错，只会画出空图，本工具会在结果中提示。',
      inputSchema: {
        option: z.record(z.string(), z.unknown()).describe('完整的 ECharts option 对象'),
        title: z.string().optional().describe('仅用于 html 输出的页面标题与图片 alt 文本'),
        theme: z.nativeEnum(ThemeName).optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        output: z.nativeEnum(OutputFormat).optional(),
        delivery: z.nativeEnum(DeliveryRequest).optional(),
      },
    },
    async (args) => {
      try {
        // 主题作底，调用方的 option 覆盖其上。这里不叠加轴样式：
        // 调用方自己写了完整 option，不该被我们的轴默认值干扰。
        const option = {
          ...deepMerge(THEMES[args.theme ?? ThemeName.Default], args.option),
          animation: false,
        } as EChartsOption;

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
