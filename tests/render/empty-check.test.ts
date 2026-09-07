import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType } from '../../src/types.js';
import { CHART_TEMPLATES } from '../../src/charts/registry.js';
import { registerCartesianTemplates } from '../../src/charts/cartesian.js';
import { registerCategoricalTemplates } from '../../src/charts/categorical.js';
import { registerStructuralTemplates } from '../../src/charts/structural.js';
import { registerCoordinateTemplates } from '../../src/charts/coordinate.js';
import { buildOption } from '../../src/option/build.js';
import { looksEmpty, unknownSeriesTypes, inspectOption } from '../../src/render/empty-check.js';

beforeAll(() => {
  registerCartesianTemplates();
  registerCategoricalTemplates();
  registerStructuralTemplates();
  registerCoordinateTemplates();
});

describe('空图检测', () => {
  it('没有数据点时判为空图', () => {
    expect(looksEmpty({})).toBe(true);
    expect(looksEmpty({ series: 'not-an-array' })).toBe(true);
    expect(looksEmpty({ series: [{ type: 'bar', data: [] }] })).toBe(true);
    expect(looksEmpty({ series: [{ type: 'bar', data: null }] })).toBe(true);
  });

  it('timeline 形态的 option 不判为空图', () => {
    // 实测：官方示例 mix-timeline-finance 能渲染出 24842 字节、100 个可绘制元素的 SVG，
    // 而它的 series 全在 baseOption / options 里。只看顶层会给一张好图扣上「空图」的帽子，
    // 而 SKILL 里明确要求调用方看到这个提示就不要原样重试 —— 误报的代价是直接放弃出图。
    const option = {
      baseOption: { timeline: { data: ['2001'] }, series: [{ type: 'bar', data: [1, 2] }] },
      options: [{ series: [{ data: [3, 4] }] }],
    };
    expect(looksEmpty(option)).toBe(false);
    expect(inspectOption(option)).toEqual([]);
  });

  it('timeline 形态下 series.type 拼错也能识别', () => {
    const option = {
      baseOption: { series: [{ type: 'barr', data: [1] }] },
      options: [{ series: [{ type: 'lien', data: [2] }] }],
    };
    expect(unknownSeriesTypes(option).sort()).toEqual(['barr', 'lien']);
  });

  it('有数据点时不判为空图', () => {
    expect(looksEmpty({ series: [{ type: 'bar', data: [1] }] })).toBe(false);
    expect(looksEmpty({ dataset: { source: [[1, 2]] } })).toBe(false);
  });

  // 这是 SVG 层面判据失效的那个场景：主题的网格线让空图也有 7 个可绘制元素。
  // option 层面的判据与主题无关，所以能稳定识别。
  it('带主题的空数据图仍能被识别为空图', () => {
    const option = buildOption({ type: ChartType.Bar, data: { dimensions: ['a', 'b', 'c'], source: [] } });
    expect(looksEmpty(option)).toBe(true);
    expect(inspectOption(option).join()).toMatch(/空图/);
  });

  it('17 种类型的正常 example 都不会被误判为空图', () => {
    for (const type of Object.values(ChartType)) {
      const option = buildOption({ type, data: CHART_TEMPLATES[type]!.example });
      expect(looksEmpty(option), `${type} 被误判为空图`).toBe(false);
      expect(inspectOption(option), `${type} 产生了多余提示`).toEqual([]);
    }
  });

  it('识别拼错的 series.type', () => {
    expect(unknownSeriesTypes({ series: [{ type: 'barr' }] })).toEqual(['barr']);
    expect(unknownSeriesTypes({ series: [{ type: 'bar' }, { type: 'lineee' }] })).toEqual(['lineee']);
    expect(unknownSeriesTypes({ series: [{ type: 'candlestick' }] })).toEqual([]);
  });

  it('拼错类型时的提示指名道姓', () => {
    const notes = inspectOption({ series: [{ type: 'barr', data: [1, 2] }] });
    expect(notes.join()).toContain('"barr"');
    expect(notes.join()).toMatch(/拼写错误/);
  });

  it('没问题时不产生任何提示', () => {
    expect(inspectOption({ series: [{ type: 'bar', data: [1, 2] }] })).toEqual([]);
  });
});
