import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType } from '../../src/types.js';
import { getTemplate } from '../../src/charts/registry.js';
import { registerCategoricalTemplates } from '../../src/charts/categorical.js';

beforeAll(() => registerCategoricalTemplates());

const TYPES = [
  ChartType.Pie,
  ChartType.Radar,
  ChartType.Funnel,
  ChartType.Treemap,
  ChartType.Sunburst,
  ChartType.Parallel,
];

describe('非直角坐标系模板', () => {
  it.each(TYPES)('%s 已注册且 example 可驱动 build', (type) => {
    const tpl = getTemplate(type);
    expect(tpl.dataShape.length).toBeGreaterThan(10);
    const option = tpl.build({ data: tpl.example, title: 'T' });
    expect(option.series).toBeDefined();
  });

  it('radar 的 indicator 由 dimensions 推导，max 取该指标最大值', () => {
    const option = getTemplate(ChartType.Radar).build({
      data: { dimensions: ['系列', '攻击', '防御'], source: [['A', 10, 20], ['B', 30, 5]] },
    });
    expect(option.radar).toMatchObject({
      indicator: [{ name: '攻击', max: 30 }, { name: '防御', max: 20 }],
    });
  });

  it('treemap 把 / 分隔的路径还原成树', () => {
    const option = getTemplate(ChartType.Treemap).build({
      data: { dimensions: ['路径', '值'], source: [['华东/上海', 10], ['华东/杭州', 5], ['华北/北京', 8]] },
    });
    const s = (option.series as { data: { name: string; children?: unknown[] }[] }[])[0];
    expect(s.data.map((n) => n.name)).toEqual(['华东', '华北']);
    expect(s.data[0].children).toHaveLength(2);
  });

  it('pie 维度数不等于 2 时抛错并指出期望值', () => {
    expect(() =>
      getTemplate(ChartType.Pie).build({ data: { dimensions: ['a', 'b', 'c'], source: [] } }),
    ).toThrow(/恰好 2 项/);
  });

  it('parallel 为每根轴生成 parallelAxis 条目', () => {
    const option = getTemplate(ChartType.Parallel).build({
      data: { dimensions: ['样本', '价格', '销量'], source: [['A', 10, 200]] },
    });
    expect(option.parallelAxis).toHaveLength(2);
  });
});
