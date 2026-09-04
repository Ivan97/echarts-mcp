import { OutputFormat, RendererKind } from '../types.js';
import { SvgRenderer } from './svg.js';
import { ResvgRenderer } from './resvg.js';
import { CanvasRenderer, isCanvasAvailable } from './canvas.js';
import type { Renderer } from './types.js';

export type { Renderer, RenderResult, RenderSize } from './types.js';
export { SvgRenderer, ResvgRenderer, CanvasRenderer, isCanvasAvailable };
export { looksEmpty, countDrawables, EMPTY_CHART_HINT } from './empty-check.js';

/**
 * 选择渲染器。
 *
 * svg 输出恒用 SvgRenderer；png 输出优先按配置，
 * **canvas 不可用时静默降级到 resvg，不抛错** —— canvas 是可选依赖。
 *
 * @param fontFiles 显式字体路径，透传给 ResvgRenderer
 */
export async function selectRenderer(
  configured: RendererKind,
  output: OutputFormat,
  fontFiles?: string[],
): Promise<Renderer> {
  if (output === OutputFormat.Svg) return new SvgRenderer();
  if (configured === RendererKind.Canvas && (await isCanvasAvailable())) return new CanvasRenderer();
  return new ResvgRenderer(2, fontFiles);
}
