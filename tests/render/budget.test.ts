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

  it('统计 timeline 形态下 baseOption 与 options 里的数据点', () => {
    // timeline 配置把 series 放在 baseOption / options 里，顶层是没有 series 的。
    // 只看顶层会得到 0，配额形同虚设 —— 一份百万点的 timeline option 能直接绕过预检。
    const option = {
      baseOption: { timeline: { data: ['2001', '2002'] }, series: [{ data: [1, 2, 3] }] },
      options: [{ series: [{ data: [4, 5] }] }, { series: [{ data: [6] }] }],
    };
    expect(countDataPoints(option)).toBe(6);
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
