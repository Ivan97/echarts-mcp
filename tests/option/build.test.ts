import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType, ThemeName } from '../../src/types.js';
import { registerTemplate } from '../../src/charts/registry.js';
import { buildOption } from '../../src/option/build.js';

beforeAll(() => {
  registerTemplate({
    type: ChartType.Bar,
    dataShape: 'Dataset',
    example: { dimensions: ['x', 'y'], source: [['A', 1]] },
    build: (input) => ({
      title: { text: input.title },
      series: [{ type: 'bar', itemStyle: { color: 'blue' } }],
    }),
  });
});

describe('buildOption', () => {
  it('产出模板的基础 option 并带上标题', () => {
    const o = buildOption({ type: ChartType.Bar, data: { dimensions: ['x'], source: [] }, title: 'T' });
    expect(o.title).toMatchObject({ text: 'T' });
  });

  it('无论如何都强制 animation: false', () => {
    const o = buildOption({
      type: ChartType.Bar,
      data: { dimensions: ['x'], source: [] },
      optionOverrides: { animation: true },
    });
    expect(o.animation).toBe(false);
  });

  it('optionOverrides 能改到模板内部的深层字段', () => {
    const o = buildOption({
      type: ChartType.Bar,
      data: { dimensions: ['x'], source: [] },
      optionOverrides: { series: [{ itemStyle: { color: 'red' } }] },
    });
    expect((o.series as never[])[0]).toMatchObject({ type: 'bar', itemStyle: { color: 'red' } });
  });

  it('dark 主题注入 Apple 深色背景与字体栈', () => {
    const o = buildOption({ type: ChartType.Bar, data: { dimensions: ['x'], source: [] }, theme: ThemeName.Dark });
    expect(o.backgroundColor).toBe('#161617');
    expect((o.textStyle as { fontFamily: string }).fontFamily).toContain('-apple-system');
  });

  it('default 主题用 Apple 系统色，首色为 system blue', () => {
    const o = buildOption({ type: ChartType.Bar, data: { dimensions: ['x'], source: [] } });
    expect((o.color as string[])[0]).toBe('#007aff');
    expect(o.backgroundColor).toBe('#fbfbfd');
  });

  it('overrides 优先级高于主题', () => {
    const o = buildOption({
      type: ChartType.Bar,
      data: { dimensions: ['x'], source: [] },
      theme: ThemeName.Dark,
      optionOverrides: { backgroundColor: '#fff' },
    });
    expect(o.backgroundColor).toBe('#fff');
  });
});
