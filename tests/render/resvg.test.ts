import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType, RendererKind } from '../../src/types.js';
import { CHART_TEMPLATES } from '../../src/charts/registry.js';
import { registerCartesianTemplates } from '../../src/charts/cartesian.js';
import { buildOption } from '../../src/option/build.js';
import { ResvgRenderer } from '../../src/render/resvg.js';
import { fontStrategy, resetFontCache } from '../../src/render/fonts.js';

const SIZE = { width: 600, height: 400 };
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

beforeAll(() => registerCartesianTemplates());

const barOption = (title?: string) =>
  buildOption({ type: ChartType.Bar, data: CHART_TEMPLATES[ChartType.Bar]!.example, title });

describe('ResvgRenderer', () => {
  it('产出 PNG 字节流，带 PNG magic number', async () => {
    const r = new ResvgRenderer();
    const out = await r.render(barOption(), SIZE);
    expect(r.kind).toBe(RendererKind.Resvg);
    expect(out.mimeType).toBe('image/png');
    expect(out.bytes.subarray(0, 8)).toEqual(PNG_MAGIC);
  });

  it('scale 为 2 时输出宽度是请求宽度的两倍', async () => {
    const out = await new ResvgRenderer(2).render(barOption(), SIZE);
    // PNG IHDR：第 16~19 字节为宽度大端整数
    expect(out.bytes.readUInt32BE(16)).toBe(1200);
  });

  it('scale 为 1 时输出宽度等于请求宽度', async () => {
    const out = await new ResvgRenderer(1).render(barOption(), SIZE);
    expect(out.bytes.readUInt32BE(16)).toBe(600);
  });

  it('中文标题不丢字：带标题的产物明显大于不带标题的', async () => {
    const r = new ResvgRenderer(1);
    const withText = await r.render(barOption('季度销售额统计报表'), SIZE);
    const without = await r.render(barOption(), SIZE);
    expect(withText.bytes.length).toBeGreaterThan(without.bytes.length);
  });

  // 注意：字体**不是**只加载一次。resvg 每次构造都会重新解析 fontFiles，
  // resvg-js 未提供复用 font database 的接口。被缓存的只有「用哪些文件」这个决策。
  it('字体策略只探测一次并复用同一个对象', () => {
    expect(fontStrategy()).toBe(fontStrategy());
  });

  it('探测到字体文件时关闭全量扫描', () => {
    const s = fontStrategy();
    if (s.fontFiles?.length) {
      expect(s.loadSystemFonts).toBe(false);
    } else {
      // 一个候选都没命中，必须退回全量扫描，宁可慢也不能丢字
      expect(s.loadSystemFonts).toBe(true);
    }
  });

  it('显式指定不存在的字体路径时退回全量扫描', () => {
    resetFontCache();
    try {
      expect(fontStrategy(['/nonexistent/font.ttf'])).toMatchObject({ loadSystemFonts: true });
    } finally {
      resetFontCache();
    }
  });
});
