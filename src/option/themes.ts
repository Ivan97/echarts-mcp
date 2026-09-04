import { ThemeName } from '../types.js';

const PALETTE_DEFAULT = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'];
const PALETTE_DARK = ['#4992ff', '#7cffb2', '#fddd60', '#ff6e76', '#58d9f9', '#05c091', '#ff8a45', '#8d48e3'];
const PALETTE_VINTAGE = ['#d87c7c', '#919e8b', '#d7ab82', '#6e7074', '#61a0a8', '#efa18d', '#787464', '#cc7e63'];

/**
 * 内置主题。全部以纯 option 片段形式表达，通过 deepMerge 叠加，
 * 不使用 echarts.registerTheme —— 那是全局状态，多请求并发时会互相干扰。
 */
export const THEMES: Record<ThemeName, Record<string, unknown>> = {
  [ThemeName.Default]: {
    color: PALETTE_DEFAULT,
    backgroundColor: '#ffffff',
  },
  [ThemeName.Dark]: {
    color: PALETTE_DARK,
    backgroundColor: '#100c2a',
    textStyle: { color: '#ffffff' },
    title: { textStyle: { color: '#ffffff' }, subtextStyle: { color: '#b3b3b3' } },
    legend: { textStyle: { color: '#ffffff' } },
    xAxis: { axisLine: { lineStyle: { color: '#6e7079' } }, axisLabel: { color: '#b3b3b3' } },
    yAxis: { axisLine: { lineStyle: { color: '#6e7079' } }, axisLabel: { color: '#b3b3b3' } },
  },
  [ThemeName.Vintage]: {
    color: PALETTE_VINTAGE,
    backgroundColor: '#fef8ef',
  },
};
