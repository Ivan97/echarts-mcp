import type { EChartsOption } from 'echarts';
import { ChartType } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import { registerTemplate, type ChartTemplate, type TemplateInput } from './registry.js';
import { fixedDims, titleOf } from './shared.js';
import { ensureLiquidFill } from './extensions.js';

/**
 * 水波图模板。
 *
 * 和其它模板不同，liquidFill 不是 ECharts 内置系列，来自扩展包
 * echarts-liquidfill，加载方式见 extensions.ts。
 *
 * 适用面很窄：它只能表达「一个比例」。要比较多个数值、要看趋势、
 * 要读精确值，柱状图和直接给数字都更合适。留着它是因为进度类看板
 * 确实会用到这种一眼看出「满没满」的形式。
 */

/** 一行数据的球心横坐标。多个球均分画布宽度。 */
function centerOf(index: number, total: number): [string, string] {
  return [`${((index + 0.5) / total) * 100}%`, '52%'];
}

/**
 * 球的半径随球数收缩，否则多个球会叠在一起。
 * 上限 62% 是留白与可读性的折中：再大标签就要贴到边框上了。
 */
function radiusOf(total: number): string {
  return `${Math.min(62, 150 / total)}%`;
}

/**
 * 把一列数值统一成 0–1 的比例。
 *
 * 调用方写 `62` 和写 `0.62` 都想表达 62%，两种都得接。判据是整列里
 * **有没有大于 1 的数**：有就整列按百分数理解，没有就整列按小数理解。
 * 逐个判断是不行的 —— [0.5, 80] 逐个判会得到 50% 和 80%，
 * 但这列数据显然是百分数，0.5 应该是 0.5%。同一列必须用同一把尺子。
 */
function toFractions(values: unknown[], names: unknown[]): number[] {
  const nums = values.map((v, i) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) {
      throw new ChartError(
        ErrorCode.InvalidInput,
        `"${String(names[i])}" 的值 "${String(v)}" 不是数字。水波图的第二维必须是数字比例。`,
        'data',
      );
    }
    return n;
  });

  const asPercent = nums.some((n) => n > 1);
  return nums.map((n, i) => {
    const frac = asPercent ? n / 100 : n;
    if (frac < 0 || frac > 1) {
      throw new ChartError(
        ErrorCode.InvalidInput,
        `"${String(names[i])}" 的值 ${nums[i]} 超出范围。水波图表达的是比例，` +
          `取值须落在 0–1（小数）或 0–100（百分数）之间，这一列按${
            asPercent ? '百分数' : '小数'
          }理解。`,
        'data',
      );
    }
    return frac;
  });
}

const LIQUID: ChartTemplate = {
  type: ChartType.Liquid,
  dataShape:
    'Dataset：dimensions 恰好 2 项 [名称, 比例]，source 每行一个球。' +
    '比例写 0–1 的小数或 0–100 的百分数都可以，同一列会按统一口径解释。',
  example: {
    dimensions: ['指标', '完成率'],
    source: [
      ['交付率', 62],
      ['覆盖率', 81],
      ['自动化率', 45],
    ],
  },

  build(input: TemplateInput): EChartsOption {
    ensureLiquidFill();

    const table = fixedDims(input, 2, '水波图');
    if (table.length === 0) {
      throw new ChartError(ErrorCode.InvalidInput, '水波图至少需要一行数据', 'data');
    }
    const names = table.map((r) => String(r[0]));
    const fractions = toFractions(
      table.map((r) => r[1]),
      names,
    );

    return {
      title: titleOf(input),
      // 一行一个球：liquidFill 的一个 series 就是一个球，
      // 同一个 series 里放多个值画出来是同一个球里的多层波浪，不是多个球。
      series: fractions.map((frac, i) => ({
        type: 'liquidFill' as never,
        name: names[i],
        data: [frac],
        radius: radiusOf(fractions.length),
        center: centerOf(i, fractions.length),
        outline: { show: true, borderDistance: 4, itemStyle: { borderWidth: 2 } },
        label: {
          formatter: `${names[i]}\n${(frac * 100).toFixed(0)}%`,
          fontSize: fractions.length > 2 ? 16 : 22,
          fontWeight: 'bold',
          // 不依赖扩展自己的双色方案。它的做法是同一段文字画两遍（深色一份、
          // 浅色一份），再用 clipPath 沿水位线各留一半。那个裁剪区域跟波形动画
          // 绑在一起，而我们出静态图时把动画关了 —— 结果只剩深色那份，
          // 水位一高文字就压在同色的水面上，实测几乎读不出来。
          // 改成描边：白字 + 半透明深色描边，水上水下都够对比，且与裁剪无关。
          color: '#fff',
          insideColor: '#fff',
          textBorderColor: 'rgba(0, 0, 0, 0.45)',
          textBorderWidth: 3,
        },
      })) as never,
      // 名称已经写在球里了，图例只会重复一遍，而且多个球同色时
      // 三个一模一样的色块反而让人以为是分类维度。
      legend: { show: false },
    };
  },
};

export function registerLiquidTemplates(): void {
  registerTemplate(LIQUID);
}
