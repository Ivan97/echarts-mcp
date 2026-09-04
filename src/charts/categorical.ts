import type { EChartsOption } from 'echarts';
import { ChartType } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import { registerTemplate, type ChartTemplate, type TemplateInput } from './registry.js';
import { asDataset, rows, titleOf } from './shared.js';

/** pie / funnel / gauge / treemap / sunburst 共用：[名称, 数值] 两列。 */
function pairs(input: TemplateInput, label: string): { name: string; value: number }[] {
  const data = asDataset(input);
  if (data.dimensions.length !== 2) {
    throw new ChartError(
      ErrorCode.InvalidInput,
      `${label} 要求 dimensions 恰好 2 项 [名称, 数值]，收到 ${data.dimensions.length} 项`,
      'data',
    );
  }
  return rows(data).map((r) => ({ name: String(r[0]), value: Number(r[1]) }));
}

interface TreeAcc {
  name: string;
  value?: number;
  children: TreeAcc[];
}

/** 把 "华东/上海" 这类路径还原成层级树，treemap 与 sunburst 共用。 */
function pathsToTree(items: { name: string; value: number }[]): TreeAcc[] {
  const roots: TreeAcc[] = [];
  for (const item of items) {
    let level = roots;
    const segments = item.name.split('/').filter(Boolean);
    segments.forEach((seg, idx) => {
      let node = level.find((n) => n.name === seg);
      if (!node) {
        node = { name: seg, children: [] };
        level.push(node);
      }
      if (idx === segments.length - 1) node.value = item.value;
      level = node.children;
    });
  }
  return roots;
}

const TEMPLATES: ChartTemplate[] = [
  {
    type: ChartType.Pie,
    dataShape: 'Dataset：dimensions 恰好 2 项 [名称, 数值]，source 每行为 [名称, 数值]',
    example: { dimensions: ['渠道', '占比'], source: [['直销', 40], ['分销', 35], ['线上', 25]] },
    build: (input) =>
      ({
        title: titleOf(input),
        tooltip: { trigger: 'item' },
        legend: { bottom: 0 },
        series: [
          {
            type: 'pie',
            radius: ['42%', '68%'],
            itemStyle: { borderRadius: 6, borderColor: 'transparent', borderWidth: 2 },
            data: pairs(input, 'pie'),
          },
        ],
      }) as EChartsOption,
  },
  {
    type: ChartType.Funnel,
    dataShape: 'Dataset：dimensions 恰好 2 项 [阶段名, 数值]',
    example: { dimensions: ['阶段', '人数'], source: [['访问', 100], ['注册', 60], ['下单', 35], ['付费', 20]] },
    build: (input) =>
      ({
        title: titleOf(input),
        tooltip: { trigger: 'item' },
        series: [
          { type: 'funnel', left: '10%', width: '80%', label: { show: true }, data: pairs(input, 'funnel') },
        ],
      }) as EChartsOption,
  },
  {
    type: ChartType.Gauge,
    dataShape: 'Dataset：dimensions 恰好 2 项 [指标名, 数值]，通常只有一行',
    example: { dimensions: ['指标', '完成率'], source: [['完成率', 72]] },
    build: (input) =>
      ({
        title: titleOf(input),
        series: [{ type: 'gauge', progress: { show: true, width: 14 }, data: pairs(input, 'gauge') }],
      }) as EChartsOption,
  },
  {
    type: ChartType.Radar,
    dataShape:
      'Dataset：dimensions 第 1 项为系列名，其余每项为一个雷达指标。source 每行为 [系列名, 指标1值, 指标2值, ...]',
    example: {
      dimensions: ['角色', '攻击', '防御', '速度', '智力'],
      source: [['战士', 90, 80, 40, 30], ['法师', 70, 40, 60, 95]],
    },
    build: (input) => {
      const data = asDataset(input);
      const table = rows(data);
      const indicator = data.dimensions.slice(1).map((name, i) => ({
        name,
        max: Math.max(1, ...table.map((r) => Number(r[i + 1]) || 0)),
      }));
      return {
        title: titleOf(input),
        tooltip: { trigger: 'item' },
        legend: { bottom: 0, data: table.map((r) => String(r[0])) },
        radar: { indicator },
        series: [
          {
            type: 'radar',
            data: table.map((r) => ({ name: String(r[0]), value: r.slice(1).map(Number) })),
          },
        ],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.Parallel,
    dataShape:
      'Dataset：dimensions 第 1 项为线名，其余每项为一根平行坐标轴。source 每行为 [线名, 轴1值, 轴2值, ...]',
    example: {
      dimensions: ['样本', '价格', '销量', '评分'],
      source: [['A', 10, 200, 4.5], ['B', 20, 150, 4.8], ['C', 15, 300, 4.2]],
    },
    build: (input) => {
      const data = asDataset(input);
      const table = rows(data);
      return {
        title: titleOf(input),
        parallelAxis: data.dimensions.slice(1).map((name, i) => ({ dim: i, name })),
        series: [{ type: 'parallel', data: table.map((r) => r.slice(1).map(Number)) }],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.Treemap,
    dataShape:
      'Dataset：dimensions 恰好 2 项 [层级路径, 数值]。路径用 / 分隔表示层级，例如 "华东/上海"',
    example: {
      dimensions: ['路径', '销售额'],
      source: [['华东/上海', 120], ['华东/杭州', 80], ['华北/北京', 100], ['华南/深圳', 90]],
    },
    build: (input) =>
      ({
        title: titleOf(input),
        tooltip: { trigger: 'item' },
        series: [
          { type: 'treemap', roam: false, itemStyle: { borderRadius: 4 }, data: pathsToTree(pairs(input, 'treemap')) },
        ],
      }) as EChartsOption,
  },
  {
    type: ChartType.Sunburst,
    dataShape: 'Dataset：同 treemap，dimensions 恰好 2 项 [层级路径, 数值]，路径用 / 分隔',
    example: {
      dimensions: ['路径', '数量'],
      source: [['动物/猫', 5], ['动物/狗', 8], ['植物/树', 3], ['植物/花', 6]],
    },
    build: (input) =>
      ({
        title: titleOf(input),
        tooltip: { trigger: 'item' },
        series: [
          { type: 'sunburst', radius: [0, '85%'], itemStyle: { borderRadius: 4 }, data: pathsToTree(pairs(input, 'sunburst')) },
        ],
      }) as EChartsOption,
  },
];

export function registerCategoricalTemplates(): void {
  TEMPLATES.forEach(registerTemplate);
}
