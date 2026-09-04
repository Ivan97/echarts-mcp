import { describe, it, expect } from 'vitest';
import { deepMerge } from '../../src/option/merge.js';

describe('deepMerge', () => {
  it('递归合并嵌套对象', () => {
    const base = { title: { text: 'A', left: 'center' }, grid: { top: 10 } };
    const out = deepMerge(base, { title: { text: 'B' } });
    expect(out).toEqual({ title: { text: 'B', left: 'center' }, grid: { top: 10 } });
  });

  it('不修改入参', () => {
    const base = { title: { text: 'A' } };
    deepMerge(base, { title: { text: 'B' } });
    expect(base.title.text).toBe('A');
  });

  it('数组按索引合并而非整体替换', () => {
    const base = { series: [{ type: 'bar', data: [1, 2] }, { type: 'line', data: [3] }] };
    const out = deepMerge(base, { series: [{ itemStyle: { color: 'red' } }] });
    expect(out.series[0]).toEqual({ type: 'bar', data: [1, 2], itemStyle: { color: 'red' } });
    expect(out.series[1]).toEqual({ type: 'line', data: [3] });
  });

  it('patch 数组更长时保留多出的项', () => {
    const base = { series: [{ type: 'bar' }] };
    const out = deepMerge(base, { series: [{}, { type: 'line' }] });
    expect(out.series).toHaveLength(2);
    expect(out.series[1]).toEqual({ type: 'line' });
  });

  it('patch 为 undefined 时返回等值副本', () => {
    const base = { a: 1 };
    const out = deepMerge(base, undefined);
    expect(out).toEqual(base);
    expect(out).not.toBe(base);
  });

  it('null 值显式覆盖', () => {
    const out = deepMerge({ tooltip: { show: true } }, { tooltip: null });
    expect(out.tooltip).toBeNull();
  });
});
