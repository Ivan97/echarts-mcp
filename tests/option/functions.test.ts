import { describe, it, expect } from 'vitest';
import {
  isFunctionExpression,
  partitionFunctions,
  serializeOptionWithFunctions,
} from '../../src/option/functions.js';

describe('函数字符串处理', () => {
  it('识别 function 与箭头两种写法', () => {
    expect(isFunctionExpression('function (p) { return p.name; }')).toBe(true);
    expect(isFunctionExpression('function fmt(p) { return p; }')).toBe(true);
    expect(isFunctionExpression('(p) => p.name')).toBe(true);
    expect(isFunctionExpression('p => p.name')).toBe(true);
  });

  it('不把字符串模板误判为函数', () => {
    expect(isFunctionExpression('{b}: {c}')).toBe(false);
    expect(isFunctionExpression('{b}\n{c} ({d}%)')).toBe(false);
    expect(isFunctionExpression(42)).toBe(false);
    expect(isFunctionExpression(null)).toBe(false);
  });

  it('剥离函数字段并记录路径', () => {
    const { sanitized, functionPaths } = partitionFunctions({
      tooltip: { formatter: '(p) => p.name' },
      series: [{ label: { formatter: '{b}' } }],
    });
    expect(functionPaths).toEqual(['tooltip.formatter']);
    expect((sanitized as { tooltip: object }).tooltip).toEqual({});
    expect((sanitized as { series: { label: object }[] }).series[0].label).toEqual({ formatter: '{b}' });
  });

  it('剥离时不修改原对象', () => {
    const src = { tooltip: { formatter: '(p) => p.name' } };
    partitionFunctions(src);
    expect(src.tooltip.formatter).toBe('(p) => p.name');
  });

  it('数组内的函数字段路径带下标', () => {
    const { functionPaths } = partitionFunctions({
      series: [{}, { label: { formatter: 'function(p){return 1}' } }],
    });
    expect(functionPaths).toEqual(['series[1].label.formatter']);
  });

  it('没有函数时 functionPaths 为空', () => {
    expect(partitionFunctions({ title: { text: 'x' } }).functionPaths).toEqual([]);
  });

  it('序列化时函数不带引号，普通字符串仍带引号', () => {
    const js = serializeOptionWithFunctions({
      tooltip: { formatter: '(p) => p.name' },
      title: { text: '标题' },
    });
    expect(js).toContain('"formatter": (p) => p.name');
    expect(js).toContain('"text": "标题"');
    expect(js).not.toContain('"(p) => p.name"');
  });

  it('序列化产物是可执行的 JS 且函数真的能跑', () => {
    const js = serializeOptionWithFunctions({ f: 'function (p) { return p * 2; }' });
    // 这里的 eval 只发生在测试中，用于验证产物可执行；生产代码任何路径都不 eval
    const obj = new Function(`return ${js}`)() as { f: (n: number) => number };
    expect(typeof obj.f).toBe('function');
    expect(obj.f(21)).toBe(42);
  });
});
