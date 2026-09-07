import type { EChartsOption } from 'echarts';
import { ChartType } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import { registerTemplate, type ChartTemplate, type TemplateInput } from './registry.js';
import { fixedDims, titleOf } from './shared.js';

/**
 * 坐标系型模板：日历图与矩阵图。
 *
 * 这两个在 ECharts 里都**不是 series 类型**，而是坐标系 ——
 * 日历热力图是 `series.type: 'heatmap'` 加 `coordinateSystem: 'calendar'`，
 * 矩阵图同理。调用方不需要知道这一层：他要的是「一张日历热力图」，
 * 至于它底下是 heatmap 还是别的，是模板该管的事。
 *
 * 单独成文件而不是塞进 cartesian.ts，是因为它们的 option 骨架
 * （calendar / matrix 组件 + visualMap + 挂在坐标系上的 series）
 * 和直角坐标系那一组没有共用部分。
 */

/** 数值列的取值范围。visualMap 不给范围的话整张图会是同一个颜色。 */
function valueRange(values: number[]): { min: number; max: number } {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) {
    throw new ChartError(ErrorCode.InvalidInput, '数值列里没有一个有效数字，无法出图', 'data');
  }
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 取出日期的年份，顺便校验格式。
 *
 * 必须主动校验：ECharts 认不出的日期不会报错，只是**默默把这个点丢掉**。
 * 传一批 "3/1" 或 "上周一" 进去，得到的是一张完全空白的日历，
 * 没有任何提示能告诉调用方问题出在日期格式上。
 */
function yearOf(raw: unknown): string {
  const s = String(raw);
  const m = YMD.exec(s);
  if (!m) {
    throw new ChartError(
      ErrorCode.InvalidInput,
      `日期 "${s}" 不是 YYYY-MM-DD 格式。日历图的第一维必须是这个格式，` +
        'ECharts 对认不出的日期不会报错，只会把该点丢掉，画出一张空日历。',
      'data',
    );
  }
  return m[1];
}

/** 单个日历的高度与间距，多年时按这个节奏往下排。 */
const CALENDAR_TOP = 90;
const CALENDAR_BLOCK = 150;

const CALENDAR: ChartTemplate = {
  type: ChartType.Calendar,
  dataShape:
    'Dataset：dimensions 恰好 2 项 [日期, 数值]，日期必须是 YYYY-MM-DD。' +
    '跨年的数据会自动按年拆成多个日历，不需要调用方自己分组。',
  example: {
    dimensions: ['日期', '提交数'],
    source: [
      ['2026-01-05', 12], ['2026-01-06', 9], ['2026-01-07', 15], ['2026-01-12', 7],
      ['2026-02-02', 21], ['2026-02-14', 3], ['2026-02-23', 18], ['2026-03-09', 11],
      ['2026-03-21', 25], ['2026-04-06', 14], ['2026-04-20', 6], ['2026-05-01', 8],
      ['2026-05-18', 19], ['2026-06-08', 13], ['2026-06-22', 4], ['2026-07-06', 22],
      ['2026-07-19', 17], ['2026-08-10', 10], ['2026-08-24', 16], ['2026-09-14', 5],
      ['2026-09-30', 6], ['2026-10-19', 23], ['2026-11-11', 21], ['2026-12-25', 14],
    ],
  },
  build: (input: TemplateInput): EChartsOption => {
    const table = fixedDims(input, 2, 'calendar');
    const years = [...new Set(table.map((r) => yearOf(r[0])))].sort();
    const { min, max } = valueRange(table.map((r) => r[1] as number));

    return {
      title: titleOf(input),
      tooltip: { trigger: 'item' },
      visualMap: {
        type: 'continuous',
        min,
        max,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        calculable: true,
      },
      calendar: years.map((year, i) => ({
        range: year,
        top: CALENDAR_TOP + i * CALENDAR_BLOCK,
        left: 60,
        right: 30,
        cellSize: ['auto', 15],
        splitLine: { show: false },
        itemStyle: { borderWidth: 2 },
        yearLabel: { show: years.length > 1 },
      })),
      // 一年一条 series，并显式绑到同下标的日历上。
      // 不给 calendarIndex 的话所有 series 都默认落在第 0 个日历，多年数据会全堆在第一张图里。
      series: years.map((year, i) => ({
        type: 'heatmap',
        coordinateSystem: 'calendar',
        calendarIndex: i,
        data: table.filter((r) => yearOf(r[0]) === year) as (string | number)[][],
      })),
    } as EChartsOption;
  },
};

const MATRIX: ChartTemplate = {
  type: ChartType.Matrix,
  dataShape:
    'Dataset：dimensions 恰好 3 项 [x 类目, y 类目, 数值]，source 每行为 [x, y, value]。' +
    '与 heatmap 的数据形状相同，区别是画成带行列表头的表格。',
  example: {
    dimensions: ['预测', '实际', '数量'],
    source: [
      ['正例', '正例', 42], ['正例', '反例', 8],
      ['反例', '正例', 5], ['反例', '反例', 45],
    ],
  },
  build: (input: TemplateInput): EChartsOption => {
    const table = fixedDims(input, 3, 'matrix');
    // 按首次出现顺序去重，不排序：混淆矩阵、相关系数矩阵的行列次序本身有含义，
    // 字典序重排会改变读者对「对角线」的判断。
    const xs = [...new Set(table.map((r) => String(r[0])))];
    const ys = [...new Set(table.map((r) => String(r[1])))];
    const { min, max } = valueRange(table.map((r) => r[2] as number));

    return {
      title: titleOf(input),
      tooltip: { trigger: 'item' },
      matrix: {
        x: { data: xs },
        y: { data: ys },
        top: 90,
        left: 70,
        right: 130,
        bottom: 40,
      },
      visualMap: {
        type: 'continuous',
        min,
        max,
        dimension: 2,
        orient: 'vertical',
        right: 20,
        top: 'middle',
        calculable: true,
      },
      series: {
        type: 'heatmap',
        coordinateSystem: 'matrix',
        data: table as (string | number)[][],
        // 矩阵图的读法就是逐格读数，标签不开等于只剩一片色块
        label: { show: true },
      },
    } as EChartsOption;
  },
};

export function registerCoordinateTemplates(): void {
  [CALENDAR, MATRIX].forEach(registerTemplate);
}
