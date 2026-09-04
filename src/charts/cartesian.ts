import type { EChartsOption } from 'echarts';
import { ChartType } from '../types.js';
import { registerTemplate, type ChartTemplate, type TemplateInput } from './registry.js';
import { asDataset, fixedDims, rows, titleOf } from './shared.js';

/**
 * bar / line / scatter / pictorialBar 共用的布局：
 * dimensions 第 1 项为类目轴，其余每项生成一条系列。
 */
function seriesPerDimension(
  type: ChartType,
  input: TemplateInput,
  extra: Record<string, unknown> = {},
): EChartsOption {
  const data = asDataset(input);
  const table = rows(data);
  const series = data.dimensions.slice(1).map((name, i) => ({
    name,
    type,
    data: table.map((r) => r[i + 1]),
    ...extra,
  }));
  return {
    title: titleOf(input),
    tooltip: { trigger: type === ChartType.Scatter ? 'item' : 'axis' },
    legend: { data: data.dimensions.slice(1), bottom: 0 },
    grid: { left: 60, right: 30, top: 70, bottom: 60 },
    xAxis: { type: 'category', data: table.map((r) => r[0]) },
    yAxis: { type: 'value' },
    series: series.length > 0 ? series : [{ type, data: [] }],
  } as EChartsOption;
}

const TEMPLATES: ChartTemplate[] = [
  {
    type: ChartType.Bar,
    dataShape:
      'Dataset：dimensions 第 1 项为类目轴，其余每项生成一条柱系列。source 每行为 [类目, 值1, 值2, ...]',
    example: { dimensions: ['月份', '销量'], source: [['1月', 120], ['2月', 200], ['3月', 150], ['4月', 80]] },
    build: (i) => seriesPerDimension(ChartType.Bar, i),
  },
  {
    type: ChartType.Line,
    dataShape: 'Dataset：同 bar，dimensions 第 1 项为类目轴，其余每项一条折线',
    example: {
      dimensions: ['月份', '销量', '利润'],
      source: [['1月', 120, 30], ['2月', 200, 60], ['3月', 150, 45], ['4月', 180, 70]],
    },
    build: (i) => seriesPerDimension(ChartType.Line, i, { smooth: false }),
  },
  {
    type: ChartType.Scatter,
    dataShape: 'Dataset：dimensions 第 1 项为 x 轴类目，其余每项一组散点',
    example: { dimensions: ['x', 'y'], source: [['A', 10], ['B', 25], ['C', 18], ['D', 32], ['E', 22]] },
    build: (i) => seriesPerDimension(ChartType.Scatter, i, { symbolSize: 16 }),
  },
  {
    type: ChartType.PictorialBar,
    dataShape: 'Dataset：同 bar，额外用象形符号绘制柱体',
    example: { dimensions: ['城市', '人口'], source: [['北京', 21], ['上海', 24], ['广州', 18]] },
    build: (i) =>
      seriesPerDimension(ChartType.PictorialBar, i, {
        symbol: 'roundRect',
        symbolRepeat: true,
        symbolSize: [16, 8],
      }),
  },
  {
    type: ChartType.Heatmap,
    dataShape: 'Dataset：dimensions 恰好 3 项 [x 类目, y 类目, 数值]，source 每行为 [x, y, value]',
    example: {
      dimensions: ['星期', '时段', '访问量'],
      source: [
        ['周一', '上午', 5], ['周一', '下午', 9], ['周二', '上午', 2],
        ['周二', '下午', 7], ['周三', '上午', 8], ['周三', '下午', 3],
      ],
    },
    build: (input) => {
      const table = fixedDims(input, 3, ChartType.Heatmap);
      const xs = [...new Set(table.map((r) => String(r[0])))];
      const ys = [...new Set(table.map((r) => String(r[1])))];
      const values = table.map((r) => Number(r[2]));
      return {
        title: titleOf(input),
        tooltip: { position: 'top' },
        grid: { left: 80, right: 40, top: 70, bottom: 80 },
        xAxis: { type: 'category', data: xs },
        yAxis: { type: 'category', data: ys },
        visualMap: {
          min: values.length ? Math.min(...values) : 0,
          max: values.length ? Math.max(...values) : 1,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 10,
        },
        series: [
          {
            type: 'heatmap',
            label: { show: true },
            data: table.map((r) => [xs.indexOf(String(r[0])), ys.indexOf(String(r[1])), r[2]]),
          },
        ],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.Boxplot,
    dataShape:
      'Dataset：dimensions 恰好 6 项，source 每行为 [名称, min, Q1, median, Q3, max]。五数概括需调用方预先算好',
    example: {
      dimensions: ['分组', 'min', 'Q1', 'median', 'Q3', 'max'],
      source: [['A', 1, 3, 5, 7, 9], ['B', 2, 4, 6, 8, 12], ['C', 0, 2, 4, 6, 10]],
    },
    build: (input) => {
      const table = fixedDims(input, 6, ChartType.Boxplot);
      return {
        title: titleOf(input),
        tooltip: { trigger: 'item' },
        grid: { left: 60, right: 30, top: 70, bottom: 50 },
        xAxis: { type: 'category', data: table.map((r) => r[0]) },
        yAxis: { type: 'value' },
        series: [{ type: 'boxplot', data: table.map((r) => r.slice(1)) }],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.Candlestick,
    dataShape: 'Dataset：dimensions 恰好 5 项，source 每行为 [日期, open, close, low, high]',
    example: {
      dimensions: ['日期', 'open', 'close', 'low', 'high'],
      source: [
        ['01-02', 10, 12, 9, 13], ['01-03', 12, 11, 10, 14],
        ['01-04', 11, 15, 10, 16], ['01-05', 15, 13, 12, 17],
      ],
    },
    build: (input) => {
      const table = fixedDims(input, 5, ChartType.Candlestick);
      return {
        title: titleOf(input),
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        grid: { left: 60, right: 30, top: 70, bottom: 50 },
        xAxis: { type: 'category', data: table.map((r) => r[0]) },
        yAxis: { type: 'value', scale: true },
        series: [{ type: 'candlestick', data: table.map((r) => r.slice(1)) }],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.ThemeRiver,
    dataShape: 'Dataset：dimensions 恰好 3 项，source 每行为 [日期, 数值, 系列名]',
    example: {
      dimensions: ['日期', '数值', '系列'],
      source: [
        ['2026-01-01', 10, 'A'], ['2026-01-02', 15, 'A'], ['2026-01-03', 12, 'A'],
        ['2026-01-01', 6, 'B'], ['2026-01-02', 9, 'B'], ['2026-01-03', 14, 'B'],
      ],
    },
    build: (input) => {
      const table = fixedDims(input, 3, ChartType.ThemeRiver);
      return {
        title: titleOf(input),
        tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
        singleAxis: { type: 'time', top: 70, bottom: 60 },
        series: [{ type: 'themeRiver', data: table }],
      } as EChartsOption;
    },
  },
];

export function registerCartesianTemplates(): void {
  TEMPLATES.forEach(registerTemplate);
}
