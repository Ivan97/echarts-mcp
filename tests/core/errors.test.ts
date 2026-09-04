import { describe, it, expect } from 'vitest';
import { ChartError, ErrorCode } from '../../src/errors.js';
import { toToolError, assertOptionSize } from '../../src/core/errors.js';

describe('错误映射', () => {
  it('ChartError 映射出 code 与出错字段，便于 LLM 自我修正', () => {
    const r = toToolError(new ChartError(ErrorCode.InvalidInput, '类型不支持', 'type'));
    expect(r.isError).toBe(true);
    const text = r.content[0].text!;
    expect(text).toContain('INVALID_INPUT');
    expect(text).toContain('type');
    expect(text).toContain('类型不支持');
  });

  it('没有 field 时不输出空括号', () => {
    const text = toToolError(new ChartError(ErrorCode.StorageFailed, '写盘失败')).content[0].text!;
    expect(text).toContain('STORAGE_FAILED');
    expect(text).not.toContain('（字段：）');
  });

  it('普通 Error 归入 INVALID_OPTION', () => {
    expect(toToolError(new Error('炸了')).content[0].text).toContain('INVALID_OPTION');
  });

  it('非 Error 抛出物也能安全转换', () => {
    expect(toToolError('字符串异常').content[0].text).toContain('字符串异常');
  });

  it('option 超过上限时抛 OPTION_TOO_LARGE 并给出实际体积', () => {
    expect(() => assertOptionSize({ big: 'x'.repeat(200) }, 100)).toThrow(/超过上限/);
  });

  it('option 未超限时不抛错', () => {
    expect(() => assertOptionSize({ a: 1 }, 1000)).not.toThrow();
  });
});
