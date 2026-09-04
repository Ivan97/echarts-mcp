import { describe, it, expect } from 'vitest';
import { ChartType } from '../../src/types.js';
import { getVariants, VARIANTS } from '../../src/charts/variants.js';

describe('细分样式目录', () => {
  it('bar 至少有堆叠、横向、极坐标三种变体', () => {
    const names = getVariants(ChartType.Bar).map((v) => v.name);
    expect(names).toEqual(expect.arrayContaining(['堆叠', '横向', '极坐标']));
  });

  it('每个变体都有非空描述与非空 optionOverrides', () => {
    for (const [type, list] of Object.entries(VARIANTS)) {
      for (const v of list!) {
        expect(v.description.length, `${type}/${v.name} 缺描述`).toBeGreaterThan(4);
        expect(Object.keys(v.optionOverrides).length, `${type}/${v.name} 的 overrides 为空`).toBeGreaterThan(0);
      }
    }
  });

  it('变体名在同一类型内不重复', () => {
    for (const [type, list] of Object.entries(VARIANTS)) {
      const names = list!.map((v) => v.name);
      expect(new Set(names).size, `${type} 有重名变体`).toBe(names.length);
    }
  });

  it('没有变体的类型返回空数组而非抛错', () => {
    expect(getVariants(ChartType.Gauge)).toEqual([]);
  });
});
