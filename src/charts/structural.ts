import type { EChartsOption } from 'echarts';
import { ChartType, type NodeLinkData, type TreeNode } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import { registerTemplate, type ChartTemplate, type TemplateInput } from './registry.js';
import { titleOf } from './shared.js';

/**
 * 这三类图表的数据天然是图/树结构，硬塞进 { dimensions, source } 会很别扭，
 * 所以各用专属结构。报错信息必须把正确形状写全，否则 LLM 只会反复重试同一个错误。
 */
function asNodeLink(input: TemplateInput, label: string): NodeLinkData {
  const d = input.data as NodeLinkData;
  if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.links)) {
    throw new ChartError(
      ErrorCode.InvalidInput,
      `${label} 要求 data 为 { nodes: [{ name, value? }], links: [{ source, target, value? }] }，` +
        '不接受 { dimensions, source }',
      'data',
    );
  }
  return d;
}

function asTree(input: TemplateInput): TreeNode {
  const d = input.data as TreeNode;
  if (!d || typeof d.name !== 'string') {
    throw new ChartError(
      ErrorCode.InvalidInput,
      'tree 要求 data 为 { name, value?, children?: [...] } 的递归结构，只传一个根节点',
      'data',
    );
  }
  return d;
}

const TEMPLATES: ChartTemplate[] = [
  {
    type: ChartType.Sankey,
    dataShape:
      'NodeLinkData：{ nodes: [{ name, value? }], links: [{ source, target, value }] }。' +
      'links 里的 source/target 必须是 nodes 中出现过的 name',
    example: {
      nodes: [{ name: '访问' }, { name: '注册' }, { name: '下单' }, { name: '付费' }],
      links: [
        { source: '访问', target: '注册', value: 60 },
        { source: '注册', target: '下单', value: 35 },
        { source: '下单', target: '付费', value: 20 },
      ],
    },
    build: (input) => {
      const d = asNodeLink(input, 'sankey');
      return {
        title: titleOf(input),
        tooltip: { trigger: 'item', triggerOn: 'mousemove' },
        series: [
          {
            type: 'sankey',
            emphasis: { focus: 'adjacency' },
            nodeGap: 14,
            lineStyle: { color: 'gradient', opacity: 0.4 },
            data: d.nodes,
            links: d.links,
          },
        ],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.Graph,
    dataShape:
      'NodeLinkData：{ nodes: [{ name, value? }], links: [{ source, target, value? }] }。' +
      '使用力导向布局自动排布，node.value 越大节点画得越大',
    example: {
      nodes: [{ name: 'A', value: 10 }, { name: 'B', value: 6 }, { name: 'C', value: 4 }, { name: 'D', value: 8 }],
      links: [{ source: 'A', target: 'B' }, { source: 'A', target: 'C' }, { source: 'B', target: 'D' }],
    },
    build: (input) => {
      const d = asNodeLink(input, 'graph');
      return {
        title: titleOf(input),
        tooltip: { trigger: 'item' },
        series: [
          {
            type: 'graph',
            layout: 'force',
            roam: false,
            label: { show: true, position: 'right' },
            force: { repulsion: 220, edgeLength: 90 },
            data: d.nodes.map((n) => ({
              name: n.name,
              value: n.value,
              symbolSize: 14 + (n.value ?? 0) * 1.5,
            })),
            links: d.links,
          },
        ],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.Tree,
    dataShape: 'TreeNode：{ name, value?, children?: TreeNode[] } 的递归结构，只传一个根节点',
    example: {
      name: '公司',
      children: [
        { name: '研发', children: [{ name: '前端' }, { name: '后端' }] },
        { name: '销售', children: [{ name: '华东' }] },
      ],
    },
    build: (input) =>
      ({
        title: titleOf(input),
        tooltip: { trigger: 'item', triggerOn: 'mousemove' },
        series: [
          {
            type: 'tree',
            data: [asTree(input)],
            left: '12%',
            right: '22%',
            top: '14%',
            bottom: '8%',
            symbolSize: 9,
            label: { position: 'left', verticalAlign: 'middle', align: 'right' },
            expandAndCollapse: false,
          },
        ],
      }) as EChartsOption,
  },
];

export function registerStructuralTemplates(): void {
  TEMPLATES.forEach(registerTemplate);
}
