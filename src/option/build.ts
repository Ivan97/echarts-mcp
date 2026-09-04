import type { EChartsOption } from 'echarts';
import { ThemeName, type ChartData, type ChartType } from '../types.js';
import { getTemplate } from '../charts/registry.js';
import { deepMerge } from './merge.js';
import { AXIS_THEMES, THEMES } from './themes.js';

export interface BuildOptionInput {
  type: ChartType;
  data: ChartData;
  title?: string;
  subtitle?: string;
  theme?: ThemeName;
  optionOverrides?: Record<string, unknown>;
}

/**
 * 职责链：模板产出基础 option → 叠加主题 → 叠加调用方的 optionOverrides → 强制关动画。
 *
 * 强制关动画放在最后一步，是为了让调用方无法通过 overrides 把它打开 ——
 * SSR 下开着动画会渲染出未完成的中间帧。
 */
export function buildOption(input: BuildOptionInput): EChartsOption {
  const template = getTemplate(input.type);
  const base = template.build({
    data: input.data,
    title: input.title,
    subtitle: input.subtitle,
  });
  const theme = input.theme ?? ThemeName.Default;
  const baseRecord = base as Record<string, unknown>;

  let themed = deepMerge(baseRecord, THEMES[theme]);
  // 轴样式只对真正有直角坐标系的图表叠加。无条件注入会让 ECharts 给饼图、
  // 仪表盘、雷达图创建出默认坐标轴，在左侧和底部画出多余的轴线。
  if (baseRecord.xAxis !== undefined || baseRecord.yAxis !== undefined) {
    themed = deepMerge(themed, AXIS_THEMES[theme]);
  }

  const overridden = deepMerge(themed, input.optionOverrides);
  return { ...overridden, animation: false } as EChartsOption;
}
