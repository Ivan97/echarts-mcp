import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { RendererKind } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import type { Renderer, RenderResult, RenderSize } from './types.js';

export class SvgRenderer implements Renderer {
  readonly kind = RendererKind.Svg;

  async render(option: EChartsOption, size: RenderSize): Promise<RenderResult> {
    // ssr: true 让 ECharts 在无 DOM 环境下工作；animation 已由 buildOption 关闭
    const chart = echarts.init(null, null, {
      renderer: 'svg',
      ssr: true,
      width: size.width,
      height: size.height,
    });
    try {
      chart.setOption(option);
      return { bytes: Buffer.from(chart.renderToSVGString(), 'utf8'), mimeType: 'image/svg+xml' };
    } catch (e) {
      // 错误信息要带上 ECharts 的原话，LLM 才知道是哪个字段不合法
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
