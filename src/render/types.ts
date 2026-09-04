import type { EChartsOption } from 'echarts';
import type { RendererKind } from '../types.js';

export interface RenderSize {
  width: number;
  height: number;
}

export interface RenderResult {
  bytes: Buffer;
  mimeType: string;
}

export interface Renderer {
  readonly kind: RendererKind;
  render(option: EChartsOption, size: RenderSize): Promise<RenderResult>;
}
