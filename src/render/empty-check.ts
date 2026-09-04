/**
 * 空图检测。
 *
 * 存在的理由：实测发现 **ECharts 对非法 option 几乎从不抛异常**，
 * 而是静默渲染出一张空图。以下都不抛错：
 * `series` 传成字符串、series.type 拼错、data 为 null、option 完全为空。
 *
 * 因此「捕获 setOption 异常再告诉 LLM 哪里错了」这条路是走不通的，
 * 必须主动检测产物。实测各情形的可绘制元素数量：
 *
 * | 情形 | path 数 |
 * |---|---|
 * | 正常柱状图 | 8 |
 * | 单点折线 | 10 |
 * | 仪表盘 | 74 |
 * | series 传成字符串 | 0 |
 * | option 完全为空 | 0 |
 * | series.type 拼错 | 1 |
 * | data 为空数组 | 1 |
 *
 * 正常图最少 8 个，坏图最多 1 个，取阈值 2 有足够安全边界。
 */
const DRAWABLE = /<(path|circle|polyline|polygon)[\s>]/g;
const MIN_DRAWABLE = 2;

export function countDrawables(svg: string): number {
  return (svg.match(DRAWABLE) ?? []).length;
}

export function looksEmpty(svg: string): boolean {
  return countDrawables(svg) <= MIN_DRAWABLE;
}

/** 检测到空图时给 LLM 的提示。要具体到「该检查哪些字段」，否则它只会原样重试。 */
export const EMPTY_CHART_HINT =
  '这份 option 渲染出的是一张空图。ECharts 对非法配置不会报错，只会画出空白，' +
  '所以请检查：series 是否为数组、series.type 是否拼写正确、series.data 是否为空或 null、' +
  '类目轴的 data 与 series.data 长度是否匹配。';
