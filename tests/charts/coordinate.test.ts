import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType } from '../../src/types.js';
import { getTemplate } from '../../src/charts/registry.js';
import { registerCoordinateTemplates } from '../../src/charts/coordinate.js';

beforeAll(() => {
  registerCoordinateTemplates();
});

/* eslint-disable @typescript-eslint/no-explicit-any */
type Opt = Record<string, any>;
const build = (type: ChartType, data: unknown, title?: string): Opt =>
  getTemplate(type).build({ data: data as never, title }) as Opt;
const listOf = (v: unknown): Opt[] => (Array.isArray(v) ? v : [v]) as Opt[];

describe('calendar 模板', () => {
  const oneYear = {
    dimensions: ['日期', '提交数'],
    source: [
      ['2026-01-01', 3],
      ['2026-06-15', 11],
      ['2026-12-31', 7],
    ],
  };

  it('画成 calendar 坐标系上的 heatmap', () => {
    const o = build(ChartType.Calendar, oneYear);
    const series = listOf(o.series);
    expect(series[0].type).toBe('heatmap');
    expect(series[0].coordinateSystem).toBe('calendar');
    expect(series[0].data).toHaveLength(3);
  });

  it('range 从数据里的年份推出来，不用调用方自己填', () => {
    const o = build(ChartType.Calendar, oneYear);
    const calendars = listOf(o.calendar);
    expect(calendars).toHaveLength(1);
    expect(calendars[0].range).toBe('2026');
  });

  it('跨年数据每年一个日历，各自只带本年的点', () => {
    const o = build(ChartType.Calendar, {
      dimensions: ['日期', '值'],
      source: [
        ['2025-03-01', 1],
        ['2026-04-02', 2],
        ['2026-05-03', 3],
      ],
    });
    const calendars = listOf(o.calendar);
    const series = listOf(o.series);
    expect(calendars.map((c) => c.range)).toEqual(['2025', '2026']);
    expect(series).toHaveLength(2);
    // 第 n 条 series 必须挂在第 n 个日历上，否则两年的点会全堆进第一个日历
    expect(series.map((s) => s.calendarIndex)).toEqual([0, 1]);
    expect(series[0].data).toHaveLength(1);
    expect(series[1].data).toHaveLength(2);
  });

  it('visualMap 的范围取自数据，否则整张图一个颜色', () => {
    const o = build(ChartType.Calendar, oneYear);
    expect(o.visualMap.min).toBe(3);
    expect(o.visualMap.max).toBe(11);
  });

  it('维度数不对时报错说清期望值', () => {
    expect(() =>
      build(ChartType.Calendar, { dimensions: ['日期'], source: [['2026-01-01']] }),
    ).toThrow(/恰好 2 项/);
  });

  it('日期不合法时明确报错，而不是画出一张空日历', () => {
    // ECharts 遇到认不出的日期不会报错，只会把这个点丢掉。不主动拦就是一张静默的空图。
    expect(() =>
      build(ChartType.Calendar, { dimensions: ['日期', '值'], source: [['上周一', 5]] }),
    ).toThrow(/日期/);
  });
});

describe('matrix 模板', () => {
  const confusion = {
    dimensions: ['预测', '实际', '数量'],
    source: [
      ['正例', '正例', 10],
      ['正例', '反例', 2],
      ['反例', '正例', 3],
      ['反例', '反例', 5],
    ],
  };

  it('画成 matrix 坐标系上的 heatmap，带数值标签', () => {
    const o = build(ChartType.Matrix, confusion);
    const series = listOf(o.series);
    expect(series[0].type).toBe('heatmap');
    expect(series[0].coordinateSystem).toBe('matrix');
    expect(series[0].label.show).toBe(true);
  });

  it('行列表头按首次出现顺序去重，不重排', () => {
    // 混淆矩阵、相关系数矩阵的行列顺序是有含义的，按字典序重排会改变读法
    const o = build(ChartType.Matrix, {
      dimensions: ['x', 'y', 'v'],
      source: [
        ['乙', 'B', 1],
        ['甲', 'A', 2],
        ['乙', 'A', 3],
      ],
    });
    expect(o.matrix.x.data).toEqual(['乙', '甲']);
    expect(o.matrix.y.data).toEqual(['B', 'A']);
  });

  it('visualMap 的范围取自数据', () => {
    const o = build(ChartType.Matrix, confusion);
    expect(o.visualMap.min).toBe(2);
    expect(o.visualMap.max).toBe(10);
  });

  it('维度数不对时报错说清期望值', () => {
    expect(() => build(ChartType.Matrix, { dimensions: ['x', 'y'], source: [['a', 'b']] })).toThrow(
      /恰好 3 项/,
    );
  });
});
