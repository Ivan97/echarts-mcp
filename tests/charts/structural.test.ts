import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType } from '../../src/types.js';
import { getTemplate } from '../../src/charts/registry.js';
import { registerStructuralTemplates } from '../../src/charts/structural.js';

beforeAll(() => registerStructuralTemplates());

describe('结构型模板', () => {
  it.each([ChartType.Sankey, ChartType.Graph, ChartType.Tree])(
    '%s 已注册且 example 可驱动 build',
    (type) => {
      const tpl = getTemplate(type);
      expect(tpl.dataShape.length).toBeGreaterThan(10);
      expect(tpl.build({ data: tpl.example, title: 'T' }).series).toBeDefined();
    },
  );

  it('sankey 把 nodes/links 原样接入 series', () => {
    const option = getTemplate(ChartType.Sankey).build({
      data: { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: 5 }] },
    });
    const s = (option.series as { data: unknown[]; links: unknown[] }[])[0];
    expect(s.data).toHaveLength(2);
    expect(s.links).toEqual([{ source: 'A', target: 'B', value: 5 }]);
  });

  it('tree 接受递归 children 结构', () => {
    const option = getTemplate(ChartType.Tree).build({
      data: { name: '根', children: [{ name: '子1' }, { name: '子2', children: [{ name: '孙' }] }] },
    });
    const s = (option.series as { data: { name: string }[] }[])[0];
    expect(s.data[0].name).toBe('根');
  });

  it('sankey 收到 Dataset 结构时报错并指出正确形状', () => {
    expect(() =>
      getTemplate(ChartType.Sankey).build({ data: { dimensions: ['a'], source: [] } as never }),
    ).toThrow(/nodes/);
  });

  it('tree 收到非树结构时报错并指出正确形状', () => {
    expect(() =>
      getTemplate(ChartType.Tree).build({ data: { dimensions: ['a'], source: [] } as never }),
    ).toThrow(/children/);
  });

  it('graph 的 symbolSize 随 value 变化', () => {
    const option = getTemplate(ChartType.Graph).build({
      data: { nodes: [{ name: 'A', value: 0 }, { name: 'B', value: 10 }], links: [] },
    });
    const s = (option.series as { data: { symbolSize: number }[] }[])[0];
    expect(s.data[1].symbolSize).toBeGreaterThan(s.data[0].symbolSize);
  });
});
