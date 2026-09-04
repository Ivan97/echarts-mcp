import { describe, it, expect } from 'vitest';
import { countDataPoints, assertRenderBudget } from '../../src/render/budget.js';

describe('渲染配额', () => {
  it('统计 series.data 中的数据点总数', () => {
    expect(countDataPoints({ series: [{ data: [1, 2, 3] }, { data: [4, 5] }] })).toBe(5);
  });

  it('统计 sankey/graph 的 nodes 与 links', () => {
    expect(
      countDataPoints({
        series: [{ data: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B' }] }],
      }),
    ).toBe(3);
  });

  it('统计 dataset.source', () => {
    expect(countDataPoints({ dataset: { source: [[1, 2], [3, 4], [5, 6]] } })).toBe(3);
  });

  it('series 为单个对象而非数组时也能统计', () => {
    expect(countDataPoints({ series: { data: [1, 2] } })).toBe(2);
  });

  it('无数据时为 0，不抛错', () => {
    expect(countDataPoints({ title: { text: 'x' } })).toBe(0);
    expect(countDataPoints({})).toBe(0);
  });

  it('series 是非法类型时返回 0 而不崩', () => {
    expect(countDataPoints({ series: 'not-an-array' })).toBe(0);
  });

  it('超过配额时抛错并说明实际点数与上限', () => {
    expect(() => assertRenderBudget({ series: [{ data: new Array(101).fill(1) }] }, 100)).toThrow(
      /101.*100/s,
    );
  });

  it('未超配额时不抛错', () => {
    expect(() => assertRenderBudget({ series: [{ data: [1, 2] }] }, 100)).not.toThrow();
  });
});
