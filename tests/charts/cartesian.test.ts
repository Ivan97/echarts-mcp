import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType } from '../../src/types.js';
import { getTemplate } from '../../src/charts/registry.js';
import { registerCartesianTemplates } from '../../src/charts/cartesian.js';

beforeAll(() => registerCartesianTemplates());

const CARTESIAN = [
  ChartType.Bar,
  ChartType.Line,
  ChartType.Scatter,
  ChartType.Heatmap,
  ChartType.Boxplot,
  ChartType.Candlestick,
];

describe('直角坐标系模板', () => {
  it.each(CARTESIAN)('%s 已注册且 example 可驱动 build', (type) => {
    const tpl = getTemplate(type);
    expect(tpl.dataShape.length).toBeGreaterThan(10);
    const option = tpl.build({ data: tpl.example, title: 'T' });
    expect(option.series).toBeDefined();
    expect(Array.isArray(option.series)).toBe(true);
  });

  it('bar 按维度数量生成多条 series', () => {
    const option = getTemplate(ChartType.Bar).build({
      data: { dimensions: ['月份', '销量', '利润'], source: [['1月', 10, 3], ['2月', 20, 5]] },
    });
    expect(option.series).toHaveLength(2);
    expect((option.series as { type: string }[]).every((s) => s.type === 'bar')).toBe(true);
  });

  it('heatmap 带 visualMap 且值域取自数据', () => {
    const option = getTemplate(ChartType.Heatmap).build({
      data: { dimensions: ['x', 'y', 'v'], source: [['a', 'p', 1], ['b', 'q', 9]] },
    });
    expect(option.visualMap).toMatchObject({ min: 1, max: 9 });
  });

  it('title 与 subtitle 都写进 option', () => {
    const option = getTemplate(ChartType.Line).build({
      data: { dimensions: ['x', 'y'], source: [['a', 1]] },
      title: '主',
      subtitle: '副',
    });
    expect(option.title).toMatchObject({ text: '主', subtext: '副' });
  });

  it('source 为对象数组时按 dimensions 取值', () => {
    const option = getTemplate(ChartType.Bar).build({
      data: { dimensions: ['月份', '销量'], source: [{ 月份: '1月', 销量: 42 }] },
    });
    expect((option.series as { data: unknown[] }[])[0].data).toEqual([42]);
  });

  it('固定维度数的类型收到错误维度数时报错并指出期望值', () => {
    expect(() =>
      getTemplate(ChartType.Boxplot).build({ data: { dimensions: ['a', 'b'], source: [] } }),
    ).toThrow(/恰好 6 项/);
  });
});
