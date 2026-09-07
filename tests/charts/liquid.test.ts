import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType } from '../../src/types.js';
import { getTemplate } from '../../src/charts/registry.js';
import { registerLiquidTemplates } from '../../src/charts/liquid.js';
import { SvgRenderer } from '../../src/render/svg.js';
import { looksEmpty } from '../../src/render/empty-check.js';

beforeAll(() => {
  registerLiquidTemplates();
});

/* eslint-disable @typescript-eslint/no-explicit-any */
type Opt = Record<string, any>;
const build = (data: unknown, title?: string): Opt =>
  getTemplate(ChartType.Liquid).build({ data: data as never, title }) as Opt;
const listOf = (v: unknown): Opt[] => (Array.isArray(v) ? v : [v]) as Opt[];

const ds = (source: unknown[][]) => ({ dimensions: ['指标', '完成率'], source });

describe('liquid 模板', () => {
  it('画成 liquidFill 系列', () => {
    const o = build(ds([['交付率', 62]]));
    const series = listOf(o.series);
    expect(series).toHaveLength(1);
    expect(series[0].type).toBe('liquidFill');
  });

  it('大于 1 的数按百分比理解，折算成 0–1', () => {
    const o = build(ds([['交付率', 62]]));
    expect(listOf(o.series)[0].data[0]).toBeCloseTo(0.62, 6);
  });

  it('全部不超过 1 的数按小数理解，原样使用', () => {
    const o = build(ds([['A', 0.62], ['B', 0.3]]));
    const series = listOf(o.series);
    expect(series[0].data[0]).toBeCloseTo(0.62, 6);
    expect(series[1].data[0]).toBeCloseTo(0.3, 6);
  });

  it('一行一个球，多行横向排开且中心互不重合', () => {
    const o = build(ds([['A', 20], ['B', 50], ['C', 80]]));
    const series = listOf(o.series);
    expect(series).toHaveLength(3);
    const centers = series.map((s) => s.center[0]);
    expect(new Set(centers).size).toBe(3);
  });

  it('名称进入球内标签，读图时不用猜哪个球是哪个指标', () => {
    const o = build(ds([['交付率', 62]]));
    expect(JSON.stringify(listOf(o.series)[0])).toContain('交付率');
  });

  it('超出 100% 的数拒绝，而不是画一个溢出的球', () => {
    expect(() => build(ds([['A', 140]]))).toThrow(/0[^0-9]*100|百分比|范围/);
  });

  it('负数拒绝', () => {
    expect(() => build(ds([['A', -5]]))).toThrow();
  });

  it('非数字拒绝，并且报错要指出是哪一行', () => {
    expect(() => build(ds([['A', '很高' as unknown as number]]))).toThrow(/A|数字/);
  });

  it('dimensions 不是 2 项时报错说明期望值', () => {
    expect(() =>
      build({ dimensions: ['a', 'b', 'c'], source: [['x', 1, 2]] }),
    ).toThrow(/2/);
  });

  it('标题透传', () => {
    const o = build(ds([['A', 50]]), '季度完成率');
    expect(o.title.text).toBe('季度完成率');
  });
});

describe('liquid 真实渲染', () => {
  it('经真实渲染器出图，且不是空图', async () => {
    const option = build(ds([['交付率', 62], ['覆盖率', 81]]), '完成情况');
    const out = await new SvgRenderer().render(option as never, { width: 800, height: 500 });
    expect(out.bytes.length).toBeGreaterThan(2000);
    // 扩展没注册成功时 ECharts 不报错，只画一张空图 —— 必须显式挡住这种情况
    expect(looksEmpty(option as never)).toBe(false);
    expect(out.bytes.toString('utf8')).toContain('62%');
  });
});
