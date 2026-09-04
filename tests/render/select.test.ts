import { describe, it, expect } from 'vitest';
import { OutputFormat, RendererKind } from '../../src/types.js';
import { selectRenderer } from '../../src/render/index.js';
import { SvgRenderer } from '../../src/render/svg.js';
import { ResvgRenderer } from '../../src/render/resvg.js';
import { isCanvasAvailable } from '../../src/render/canvas.js';

describe('selectRenderer', () => {
  it('输出 svg 时永远用 SvgRenderer，与配置无关', async () => {
    expect(await selectRenderer(RendererKind.Auto, OutputFormat.Svg)).toBeInstanceOf(SvgRenderer);
    expect(await selectRenderer(RendererKind.Canvas, OutputFormat.Svg)).toBeInstanceOf(SvgRenderer);
    expect(await selectRenderer(RendererKind.Resvg, OutputFormat.Svg)).toBeInstanceOf(SvgRenderer);
  });

  it('auto + png 用 ResvgRenderer', async () => {
    expect(await selectRenderer(RendererKind.Auto, OutputFormat.Png)).toBeInstanceOf(ResvgRenderer);
  });

  it('显式要 resvg 时用 ResvgRenderer', async () => {
    expect(await selectRenderer(RendererKind.Resvg, OutputFormat.Png)).toBeInstanceOf(ResvgRenderer);
  });

  // 核心行为：canvas 是可选依赖，装不上时必须静默降级，不能让主流程报错
  it('要 canvas 但依赖缺失时降级到 resvg 而非报错', async () => {
    const renderer = await selectRenderer(RendererKind.Canvas, OutputFormat.Png);
    if (await isCanvasAvailable()) {
      expect(renderer.kind).toBe(RendererKind.Canvas);
    } else {
      expect(renderer).toBeInstanceOf(ResvgRenderer);
    }
  });

  it('isCanvasAvailable 在依赖缺失时返回 false 而不抛错', async () => {
    await expect(isCanvasAvailable()).resolves.toEqual(expect.any(Boolean));
  });

  it('isCanvasAvailable 的探测结果被缓存，重复调用结果一致', async () => {
    const a = await isCanvasAvailable();
    const b = await isCanvasAvailable();
    expect(a).toBe(b);
  });
});
