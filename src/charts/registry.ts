import type { EChartsOption } from 'echarts';
import type { ChartData, ChartType } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';

export interface TemplateInput {
  data: ChartData;
  title?: string;
  subtitle?: string;
}

export interface ChartTemplate {
  readonly type: ChartType;
  /** 给 list_chart_types 用的 data 形状说明，必须写清楚每个字段的含义 */
  readonly dataShape: string;
  /** 可直接复制使用的示例 data */
  readonly example: ChartData;
  build(input: TemplateInput): EChartsOption;
}

export const CHART_TEMPLATES: Partial<Record<ChartType, ChartTemplate>> = {};

export function registerTemplate(template: ChartTemplate): void {
  CHART_TEMPLATES[template.type] = template;
}

export function getTemplate(type: ChartType): ChartTemplate {
  const tpl = CHART_TEMPLATES[type];
  if (!tpl) {
    throw new ChartError(
      ErrorCode.InvalidInput,
      `不支持的图表类型 "${type}"，可用类型：${Object.keys(CHART_TEMPLATES).join(', ')}`,
      'type',
    );
  }
  return tpl;
}
