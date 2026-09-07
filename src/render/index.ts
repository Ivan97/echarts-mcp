import { OutputFormat, RendererKind } from '../types.js';
import { SvgRenderer } from './svg.js';
import { ResvgRenderer } from './resvg.js';
import { CanvasRenderer, isCanvasAvailable } from './canvas.js';
import type { Renderer } from './types.js';

export type { Renderer, RenderResult, RenderSize } from './types.js';
export { SvgRenderer, ResvgRenderer, CanvasRenderer, isCanvasAvailable };
export { looksEmpty, unknownSeriesTypes, inspectOption } from './empty-check.js';

/**
 * 选择渲染器。
 *
 * svg 输出恒用 SvgRenderer；png 输出优先按配置，
 * **canvas 不可用时静默降级到 resvg，不抛错** —— canvas 是可选依赖。
 *
 * @param configured 配置里指定的渲染器。仅对 png 生效，且在 canvas 不可用时会被忽略。
 * @param output 目标输出格式。svg 直接决定用 SvgRenderer，其余走 png 那条分支。
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
