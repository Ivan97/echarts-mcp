import { describe, it, expect } from 'vitest';
import { ChartType } from '../../src/types.js';
import { getTemplate, registerTemplate, CHART_TEMPLATES } from '../../src/charts/registry.js';
import { ChartError, ErrorCode } from '../../src/errors.js';

describe('chart registry', () => {
  it('ChartType 恰好有 15 个成员', () => {
    expect(Object.keys(ChartType)).toHaveLength(15);
  });

  it('注册后可取回模板', () => {
    const tpl = {
      type: ChartType.Bar,
      dataShape: 'Dataset',
      example: { dimensions: ['x', 'y'], source: [['A', 1]] },
      build: () => ({}),
    };
    registerTemplate(tpl);
    expect(getTemplate(ChartType.Bar)).toBe(tpl);
    expect(CHART_TEMPLATES[ChartType.Bar]).toBe(tpl);
  });

  it('取未注册类型抛 ChartError 且 code 为 INVALID_INPUT', () => {
    try {
      getTemplate('nope' as ChartType);
      expect.unreachable('应当抛错');
    } catch (e) {
      expect(e).toBeInstanceOf(ChartError);
      expect((e as ChartError).code).toBe(ErrorCode.InvalidInput);
      expect((e as ChartError).field).toBe('type');
    }
  });
});
