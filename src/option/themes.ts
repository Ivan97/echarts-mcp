import { ThemeName } from '../types.js';

/**
 * Apple 系统字体栈。
 *
 * 两种渲染路径的字体解析方不同：
 * - SVG 产物里字体名原样写入，由**查看者**的设备解析，Apple 设备会拿到 SF Pro
 * - PNG 由服务端 resvg 栅格化，用的是**服务器**上装的字体，Linux 容器里会落到后面的回退项
 * 因此回退链必须一路兜到中文字体，否则容器里出图会丢字。
 *
 * 字体名一律用**单引号**：ECharts SSR 把 fontFamily 原样写进 SVG 的
 * `font-family="..."` 属性且不做转义，名字里带双引号会直接截断 XML 属性，
 * 导致 resvg 报 `SVG data parsing failed cause invalid attribute`，PNG 全线不可用。
 */
const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', " +
  "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif";

/**
 * Apple 系统色（Human Interface Guidelines 的 System Colors）。
 * 顺序刻意把蓝色放首位、红色靠后：红在数据图里天然读作「负向」，不适合当第一序列色。
 */
const PALETTE_LIGHT = [
  '#007aff', // system blue
  '#34c759', // system green
  '#ff9500', // system orange
  '#af52de', // system purple
  '#5ac8fa', // system teal
  '#ff2d55', // system pink
  '#ffcc00', // system yellow
  '#5856d6', // system indigo
];

/** 深色模式下 Apple 会提高明度与饱和度，不是简单地把浅色版调暗。 */
const PALETTE_DARK = [
  '#0a84ff',
  '#30d158',
  '#ff9f0a',
  '#bf5af2',
  '#64d2ff',
  '#ff375f',
  '#ffd60a',
  '#5e5ce6',
];

const PALETTE_VINTAGE = [
  '#d87c7c',
  '#919e8b',
  '#d7ab82',
  '#6e7074',
  '#61a0a8',
  '#efa18d',
  '#787464',
  '#cc7e63',
];

// apple.com 实际使用的中性色，不是纯黑纯白 —— 纯值会让画面失去层次
const LIGHT_BG = '#fbfbfd';
const LIGHT_TEXT = '#1d1d1f';
const LIGHT_MUTED = '#6e6e73';
const LIGHT_HAIRLINE = '#d2d2d7';

const DARK_BG = '#161617';
const DARK_TEXT = '#f5f5f7';
const DARK_MUTED = '#a1a1a6';
const DARK_HAIRLINE = '#38383a';

/** 轴与网格线统一按「发丝线」处理：细、低对比、不抢数据。 */
function axisStyle(hairline: string, muted: string) {
  return {
    axisLine: { lineStyle: { color: hairline } },
    axisTick: { show: false },
    axisLabel: { color: muted, fontSize: 12 },
    splitLine: { lineStyle: { color: hairline, type: 'dashed' as const } },
  };
}

/**
 * 内置主题。全部以纯 option 片段表达并经 deepMerge 叠加，
 * 不用 echarts.registerTheme —— 那是全局状态，多请求并发会互相干扰。
 *
 * **注意 THEMES 里不含 xAxis / yAxis 样式。**
 * 无条件注入轴样式会让 ECharts 给饼图、仪表盘、雷达图这类没有直角坐标系的图表
 * 也创建出默认坐标轴，在图的左侧和底部画出多余的轴线（已在饼图上实际观察到）。
 * 轴样式放在 AXIS_THEMES 里，由 buildOption 在图表本身有轴时才叠加。
 */
export const THEMES: Record<ThemeName, Record<string, unknown>> = {
  [ThemeName.Default]: {
    color: PALETTE_LIGHT,
    backgroundColor: LIGHT_BG,
    textStyle: { fontFamily: FONT_STACK, color: LIGHT_TEXT },
    title: {
      textStyle: { fontFamily: FONT_STACK, color: LIGHT_TEXT, fontWeight: 600, fontSize: 18 },
      subtextStyle: { fontFamily: FONT_STACK, color: LIGHT_MUTED, fontSize: 13 },
    },
    legend: { textStyle: { fontFamily: FONT_STACK, color: LIGHT_MUTED }, icon: 'roundRect' },
    tooltip: {
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderColor: LIGHT_HAIRLINE,
      borderWidth: 1,
      textStyle: { fontFamily: FONT_STACK, color: LIGHT_TEXT },
      extraCssText: 'backdrop-filter: blur(20px); border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.10);',
    },
  },

  [ThemeName.Dark]: {
    color: PALETTE_DARK,
    backgroundColor: DARK_BG,
    textStyle: { fontFamily: FONT_STACK, color: DARK_TEXT },
    title: {
      textStyle: { fontFamily: FONT_STACK, color: DARK_TEXT, fontWeight: 600, fontSize: 18 },
      subtextStyle: { fontFamily: FONT_STACK, color: DARK_MUTED, fontSize: 13 },
    },
    legend: { textStyle: { fontFamily: FONT_STACK, color: DARK_MUTED }, icon: 'roundRect' },
    tooltip: {
      backgroundColor: 'rgba(30,30,32,0.92)',
      borderColor: DARK_HAIRLINE,
      borderWidth: 1,
      textStyle: { fontFamily: FONT_STACK, color: DARK_TEXT },
      extraCssText: 'backdrop-filter: blur(20px); border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.45);',
    },
  },

  [ThemeName.Vintage]: {
    color: PALETTE_VINTAGE,
    backgroundColor: '#fef8ef',
    textStyle: { fontFamily: FONT_STACK },
  },
};

/**
 * 轴样式，只对**真正有直角坐标系**的图表叠加。
 * 由 buildOption 判断：模板产出的 option 里有 xAxis 或 yAxis 才应用。
 */
export const AXIS_THEMES: Record<ThemeName, Record<string, unknown>> = {
  [ThemeName.Default]: {
    xAxis: axisStyle(LIGHT_HAIRLINE, LIGHT_MUTED),
    yAxis: axisStyle(LIGHT_HAIRLINE, LIGHT_MUTED),
  },
  [ThemeName.Dark]: {
    xAxis: axisStyle(DARK_HAIRLINE, DARK_MUTED),
    yAxis: axisStyle(DARK_HAIRLINE, DARK_MUTED),
  },
  [ThemeName.Vintage]: {
    xAxis: axisStyle('#d8cbb4', '#6e7074'),
    yAxis: axisStyle('#d8cbb4', '#6e7074'),
  },
};

/** 供 html 产物复用，避免页面外壳与图表内部字体不一致。 */
export const THEME_FONT_STACK = FONT_STACK;

/** 页面外壳配色，与上面的图表主题保持同一套中性色。 */
export const SHELL_COLORS = {
  light: { bg: LIGHT_BG, text: LIGHT_TEXT, muted: LIGHT_MUTED, hairline: LIGHT_HAIRLINE },
  dark: { bg: DARK_BG, text: DARK_TEXT, muted: DARK_MUTED, hairline: DARK_HAIRLINE },
};
