import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType, RendererKind } from '../../src/types.js';
import { CHART_TEMPLATES } from '../../src/charts/registry.js';
import { registerCartesianTemplates } from '../../src/charts/cartesian.js';
import { registerCategoricalTemplates } from '../../src/charts/categorical.js';
import { registerStructuralTemplates } from '../../src/charts/structural.js';
import { registerCoordinateTemplates } from '../../src/charts/coordinate.js';
import { VARIANTS } from '../../src/charts/variants.js';
import { buildOption } from '../../src/option/build.js';
import { SvgRenderer } from '../../src/render/svg.js';

const renderer = new SvgRenderer();
const SIZE = { width: 600, height: 400 };

beforeAll(() => {
  registerCartesianTemplates();
  registerCategoricalTemplates();
  registerStructuralTemplates();
  registerCoordinateTemplates();
});

describe('SvgRenderer', () => {
  it('kind 为 Svg，mimeType 为 image/svg+xml', async () => {
    const out = await renderer.render(
      buildOption({ type: ChartType.Bar, data: CHART_TEMPLATES[ChartType.Bar]!.example }),
      SIZE,
    );
    expect(renderer.kind).toBe(RendererKind.Svg);
    expect(out.mimeType).toBe('image/svg+xml');
    expect(out.bytes.toString('utf8').trimStart().startsWith('<svg')).toBe(true);
  });

  it('产出的 SVG 宽高与请求一致', async () => {
    const out = await renderer.render(
      buildOption({ type: ChartType.Line, data: CHART_TEMPLATES[ChartType.Line]!.example }),
      SIZE,
    );
    const svg = out.bytes.toString('utf8');
    expect(svg).toContain('width="600"');
    expect(svg).toContain('height="400"');
  });

  it.each(Object.values(ChartType))('%s 能渲染出非空 SVG', async (type) => {
    const out = await renderer.render(buildOption({ type, data: CHART_TEMPLATES[type]!.example }), SIZE);
    const svg = out.bytes.toString('utf8');
    expect(svg.startsWith('<svg'), `${type} 产物不是 SVG`).toBe(true);
    // 空图只有一个背景 rect，正常图必然长得多
    expect(svg.length, `${type} 的 SVG 过短，疑似渲染为空`).toBeGreaterThan(800);
  });

  // spec §16.6：合并不出错 ≠ 渲染正确。每个细分样式都要真渲一遍。
  const VARIANT_CASES = Object.entries(VARIANTS).flatMap(([type, list]) =>
    list!.map((v) => [type as ChartType, v.name, v.optionOverrides] as const),
  );

  it.each(VARIANT_CASES)('细分样式 %s/%s 能渲染出非空 SVG', async (type, _name, overrides) => {
    const out = await renderer.render(
      buildOption({ type, data: CHART_TEMPLATES[type]!.example, optionOverrides: overrides }),
      SIZE,
    );
    expect(out.bytes.toString('utf8').length).toBeGreaterThan(800);
  });

  // 回归测试：字体名若用双引号，会截断 SVG 的 font-family 属性，导致 resvg 解析失败、
  // PNG 全线不可用。ECharts SSR 不会转义这个属性值。
  it('font-family 属性中不出现会截断 XML 属性的双引号', async () => {
    const out = await renderer.render(
      buildOption({ type: ChartType.Bar, data: CHART_TEMPLATES[ChartType.Bar]!.example, title: 'T' }),
      SIZE,
    );
    const svg = out.bytes.toString('utf8');
    for (const m of svg.matchAll(/font-family="([^"]*)"/g)) {
      expect(m[1], 'font-family 值被双引号截断').not.toContain('"');
    }
    expect(svg).toContain('-apple-system');
  });

  it('中文标题原样出现在 SVG 中', async () => {
    const out = await renderer.render(
      buildOption({
        type: ChartType.Bar,
        data: CHART_TEMPLATES[ChartType.Bar]!.example,
        title: '季度销售额',
      }),
      SIZE,
    );
    expect(out.bytes.toString('utf8')).toContain('季度销售额');
  });

  // 实测结论：ECharts 对非法 option 几乎从不抛错，而是静默画出一张空图。
  // 因此不能靠异常做错误反馈，必须检测空图。
  it('非法 option 不抛错而是渲染成空图', async () => {
    const out = await renderer.render({ series: 'not-an-array' } as never, SIZE);
    expect(out.bytes.toString('utf8').length).toBeLessThan(400);
  });

});
