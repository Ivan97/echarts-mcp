import type { EChartsOption } from 'echarts';
import { ThemeName, type ChartData, type ChartType } from '../types.js';
import { getTemplate } from '../charts/registry.js';
import { deepMerge } from './merge.js';
import { THEMES } from './themes.js';

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
  const themed = deepMerge(base as Record<string, unknown>, THEMES[input.theme ?? ThemeName.Default]);
  const overridden = deepMerge(themed, input.optionOverrides);
  return { ...overridden, animation: false } as EChartsOption;
}
