import { countDataPoints, optionLayers } from './budget.js';

/**
 * 空图与可疑 option 的检测。
 *
 * 存在的理由：实测发现 **ECharts 对非法 option 几乎从不抛异常**，
 * 而是静默渲染出一张空图。以下都不抛错：
 * `series` 传成字符串、`series.type` 拼错、`data` 为 null、option 完全为空。
 * 「捕获 setOption 异常再告诉 LLM 哪里错了」这条路走不通，必须主动检测。
 *
 * 判据放在 **option 层面**而不是产物层面。曾经用「统计 SVG 里可绘制元素的数量」
 * 做判据，标定时用的是无主题的图（正常图 ≥8 个、坏图 ≤1 个）；
 * 主题引入网格线之后，一张没有任何数据的空图也能有 7 个可绘制元素，
 * 阈值直接失效。option 层面的判据与主题、尺寸、渲染器都无关。
 */

/**
 * 认得的 series.type 取值。用于识别拼写错误 —— 拼错时 ECharts 只在 console 警告。
 *
 * 末尾那一组来自第三方扩展（见 charts/extensions.ts）。它们必须列在这里：
 * 少列一个，用户画出的正常图会被扣上「类型拼写错误」的帽子，
 * 而这条提示是加在返回内容最前面的，比没有提示更糟。
 */
const KNOWN_SERIES_TYPES = new Set([
  'line', 'bar', 'pie', 'scatter', 'effectScatter', 'radar', 'tree', 'treemap',
  'sunburst', 'boxplot', 'candlestick', 'heatmap', 'map', 'parallel', 'lines',
  'graph', 'sankey', 'funnel', 'gauge', 'pictorialBar', 'themeRiver', 'custom',
  'liquidFill',
]);

/** 收集所有层里的 series，timeline 的 baseOption / options 也算在内。 */
function seriesList(option: object): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const layer of optionLayers(option)) {
    const s = layer.series;
    if (Array.isArray(s)) out.push(...(s as Record<string, unknown>[]));
    else if (s && typeof s === 'object') out.push(s as Record<string, unknown>);
  }
  return out;
}

/** 没有任何数据点即为空图。确定性判断，不依赖渲染产物。 */
export function looksEmpty(option: object): boolean {
  return countDataPoints(option) === 0;
}

/** 返回 series.type 中不认识的取值，多半是拼写错误。 */
export function unknownSeriesTypes(option: object): string[] {
  const bad: string[] = [];
  for (const s of seriesList(option)) {
    const t = s?.type;
    if (typeof t === 'string' && !KNOWN_SERIES_TYPES.has(t)) bad.push(t);
  }
  return bad;
}

/**
 * 检查 option 并返回要告知调用方的提示。没问题时返回空数组。
 *
 * 提示必须具体到「该检查哪个字段」，笼统地说「渲染失败」只会让 LLM 原样重试。
 */
export function inspectOption(option: object): string[] {
  const notes: string[] = [];

  const badTypes = unknownSeriesTypes(option);
  if (badTypes.length > 0) {
    notes.push(
      `series.type 取值 ${badTypes.map((t) => `"${t}"`).join('、')} 不是 ECharts 支持的类型，` +
        '多半是拼写错误。ECharts 遇到未知类型不会报错，只会画出一张没有数据的图。',
    );
  }

  if (looksEmpty(option)) {
    notes.push(
      '这份 option 里没有任何数据点，渲染出来会是一张空图。ECharts 对非法配置不会报错，' +
        '只会画出空白，所以请检查：series 是否为数组、series.data 是否为空或 null、' +
        '数据是否放在了 dataset 而 series 未通过 encode 引用它。',
    );
  }

  return notes;
}
