import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ChartType } from '../types.js';
import { CHART_TEMPLATES, getTemplate } from '../charts/registry.js';
import { getVariants } from '../charts/variants.js';
import { toToolError } from '../core/errors.js';
import type { ServerDeps } from '../core/server.js';

/**
 * 这个工具是 context 成本的解法。
 *
 * 「每种图表一个工具」的路线（AntV mcp-server-chart）要把 20~30 个工具的 schema
 * 常驻在 LLM 的 context 里。这里把它变成**按需拉取**：平时只占一个工具的位置，
 * LLM 需要知道某个类型怎么传 data、有哪些细分样式时再调一次。
 */
export function registerListChartTypes(server: McpServer, _deps: ServerDeps): void {
  server.registerTool(
    'list_chart_types',
    {
      title: '查询支持的图表类型',
      description:
        '列出 generate_chart 支持的全部图表类型。带上 type 参数可获得该类型的详细信息：' +
        'data 该怎么组织、可直接复制的示例数据，以及常见细分样式（堆叠、横向、极坐标、玫瑰图等）' +
        '对应的 optionOverrides 片段。不确定怎么传 data 时，先调用本工具。',
      inputSchema: {
        type: z.nativeEnum(ChartType).optional().describe('省略则返回全部类型的概览'),
      },
    },
    async (args) => {
      try {
        if (args.type) {
          const tpl = getTemplate(args.type);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    type: tpl.type,
                    dataShape: tpl.dataShape,
                    example: tpl.example,
                    variants: getVariants(tpl.type),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const types = Object.values(ChartType)
          .filter((t) => CHART_TEMPLATES[t])
          .map((t) => ({
            type: t,
            dataShape: CHART_TEMPLATES[t]!.dataShape,
            variantCount: getVariants(t).length,
          }));

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  types,
                  hint: '需要某个类型的示例数据与细分样式片段时，用 type 参数再调一次本工具。',
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (e) {
        return toToolError(e);
      }
    },
  );
}
