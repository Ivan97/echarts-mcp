import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { RendererKind } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import type { Renderer, RenderResult, RenderSize } from './types.js';

interface CanvasModule {
  createCanvas(w: number, h: number): unknown;
}

let canvasModule: CanvasModule | null | undefined;

/**
 * 探测可选依赖 `canvas` 是否可用。**永不抛错。**
 *
 * canvas 是原生模块，需要编译 cairo/pango，在很多环境里装不上。
 * 它装不上不应该影响主流程 —— 默认链路（SVG / resvg）零原生依赖。
 */
// 用变量而不是字符串字面量做 import 说明符：字面量会让 TypeScript 去静态解析 'canvas'，
// 在没装这个可选依赖的环境里直接报 TS2307，编译不过 —— 那就违背了「可选」的意义。
// Docker 构建阶段 npm ci --omit=optional 正是这种环境。
const CANVAS_SPECIFIER = 'canvas';

export async function isCanvasAvailable(): Promise<boolean> {
  if (canvasModule === undefined) {
    try {
      canvasModule = (await import(CANVAS_SPECIFIER)) as unknown as CanvasModule;
    } catch {
      canvasModule = null;
    }
  }
  return canvasModule !== null;
}

/** 供 canvas 独有渲染特性使用。绕过 SVG 链路，直接在 canvas 上作画。 */
export class CanvasRenderer implements Renderer {
  readonly kind = RendererKind.Canvas;

  async render(option: EChartsOption, size: RenderSize): Promise<RenderResult> {
    if (!(await isCanvasAvailable()) || !canvasModule) {
      throw new ChartError(
        ErrorCode.RendererUnavailable,
        '可选依赖 canvas 未安装。默认链路不需要它；如需 canvas 独有特性请先安装。',
      );
    }
    const canvas = canvasModule.createCanvas(size.width, size.height) as {
      toBuffer(mime: string): Buffer;
    };
    const chart = echarts.init(canvas as never, null, {
      renderer: 'canvas',
      width: size.width,
      height: size.height,
    });
    try {
      chart.setOption(option);
      return { bytes: canvas.toBuffer('image/png'), mimeType: 'image/png' };
    } catch (e) {
      throw new ChartError(
        ErrorCode.InvalidOption,
        `ECharts 拒绝了该 option：${(e as Error).message}`,
        'option',
      );
    } finally {
      chart.dispose();
    }
  }
}
