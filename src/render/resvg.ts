import { Resvg } from '@resvg/resvg-js';
import type { EChartsOption } from 'echarts';
import { RendererKind } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import { SvgRenderer } from './svg.js';
import { fontStrategy } from './fonts.js';
import type { Renderer, RenderResult, RenderSize } from './types.js';

/**
 * 先用 ECharts SSR 出 SVG，再用 resvg 栅格化为 PNG。
 *
 * 相比 node-canvas 的好处：resvg 提供预编译二进制，安装无需编译 cairo/pango，
 * Docker 镜像可以用 node:slim。
 */
export class ResvgRenderer implements Renderer {
  readonly kind = RendererKind.Resvg;
  private readonly svg = new SvgRenderer();

  /**
   * @param scale 输出倍率。默认 2 是为了在高分屏上不糊。
   * @param fontFiles 显式字体文件路径，覆盖自动探测。容器里自带字体时使用。
   */
  constructor(
    private readonly scale: number = 2,
    private readonly fontFiles?: string[],
  ) {}

  async render(option: EChartsOption, size: RenderSize): Promise<RenderResult> {
    const svg = (await this.svg.render(option, size)).bytes.toString('utf8');
    try {
      const png = new Resvg(svg, {
        fitTo: { mode: 'width', value: Math.round(size.width * this.scale) },
        background: '#ffffff',
        font: fontStrategy(this.fontFiles),
      })
        .render()
        .asPng();
      return { bytes: Buffer.from(png), mimeType: 'image/png' };
    } catch (e) {
      throw new ChartError(
        ErrorCode.RendererUnavailable,
        `SVG 栅格化失败：${(e as Error).message}`,
      );
    }
  }
}
