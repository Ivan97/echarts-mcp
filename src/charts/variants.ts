import { ChartType } from '../types.js';

export interface ChartVariant {
  /** 变体名，LLM 可读的标识 */
  name: string;
  /** 一句话说明这个变体解决什么问题 */
  description: string;
  /** 直接可用的 optionOverrides 片段，全部经实测渲染验证 */
  optionOverrides: Record<string, unknown>;
}

/**
 * 细分样式目录。
 *
 * 存在的理由：「堆叠柱状图」「南丁格尔玫瑰图」这些不是新的图表类型，只是同一类型的
 * 不同 option。把它们列出来，LLM 就不必预先知道 ECharts 有 stack / roseType /
 * coordinateSystem 这些配置项 —— 工具会主动告诉它。
 *
 * 下列片段全部实测渲染通过，见 docs/chart-types.md 第 4 节。
 */
export const VARIANTS: Partial<Record<ChartType, ChartVariant[]>> = {
  [ChartType.Bar]: [
    {
      name: '堆叠',
      description: '多条系列叠加显示总量。需要为每条系列指定同一个 stack 名',
      optionOverrides: { series: [{ stack: '总量' }, { stack: '总量' }] },
    },
    {
      name: '横向',
      description: '条形图。把类目轴换到 Y 轴，适合类目名较长的场景。yAxis.data 要填实际类目',
      optionOverrides: {
        xAxis: { type: 'value', data: null },
        yAxis: { type: 'category', data: ['替换为实际类目'] },
      },
    },
    {
      name: '极坐标',
      description: '南丁格尔式柱状图。需同时把 grid/xAxis/yAxis 置为 null 并声明 polar',
      optionOverrides: {
        grid: null,
        xAxis: null,
        yAxis: null,
        polar: { radius: [28, '75%'] },
        angleAxis: { type: 'category', data: ['替换为实际类目'] },
        radiusAxis: {},
        series: [{ coordinateSystem: 'polar' }],
      },
    },
    {
      name: '圆角与数值标签',
      description: '柱顶显示数值并加圆角，用于强调具体数字',
      optionOverrides: {
        series: [{ label: { show: true, position: 'top' }, itemStyle: { borderRadius: [6, 6, 0, 0] } }],
      },
    },
  ],

  [ChartType.Line]: [
    { name: '面积', description: '折线下方填充色块，强调累积量', optionOverrides: { series: [{ areaStyle: {} }] } },
    { name: '阶梯', description: '阶梯状折线，适合状态跳变类数据', optionOverrides: { series: [{ step: 'end' }] } },
    { name: '平滑', description: '曲线平滑处理', optionOverrides: { series: [{ smooth: true }] } },
    {
      name: '平滑堆叠面积',
      description: '多条系列堆叠的平滑面积图',
      optionOverrides: {
        series: [
          { smooth: true, areaStyle: {}, stack: 't' },
          { smooth: true, areaStyle: {}, stack: 't' },
        ],
      },
    },
    {
      name: '双 Y 轴',
      description: '量纲不同的两条系列共存，第二条走右侧轴并改为折线',
      optionOverrides: {
        yAxis: [{ type: 'value', name: '左轴' }, { type: 'value', name: '右轴' }],
        series: [{}, { type: 'line', yAxisIndex: 1, smooth: true }],
      },
    },
    {
      name: '均值线与极值点',
      description: '标出最大值、最小值与平均线，无需自行计算',
      optionOverrides: {
        series: [
          {
            markPoint: { data: [{ type: 'max', name: '最大值' }, { type: 'min', name: '最小值' }] },
            markLine: { data: [{ type: 'average', name: '平均值' }] },
          },
        ],
      },
    },
  ],

  [ChartType.Pie]: [
    {
      name: '南丁格尔玫瑰',
      description: '扇区半径随数值变化，适合数值差异明显的场景',
      optionOverrides: { series: [{ roseType: 'area', radius: ['15%', '72%'] }] },
    },
    {
      name: '外部百分比标签',
      description: '在扇区外标注名称与百分比。formatter 用字符串模板，不需要函数',
      optionOverrides: { series: [{ radius: '62%', label: { show: true, formatter: '{b}: {d}%' } }] },
    },
  ],

  [ChartType.Scatter]: [
    {
      name: '气泡图',
      description:
        '逐点指定 symbolSize 表达第三个维度。注意 symbolSize 不能写成回调函数，必须逐点给数值',
      optionOverrides: {
        series: [
          {
            data: [
              { value: [10, 200], symbolSize: 20 },
              { value: [20, 150], symbolSize: 42 },
            ],
          },
        ],
      },
    },
  ],

  [ChartType.Heatmap]: [
    {
      name: '自定义色带',
      description: '用 visualMap.inRange.color 指定连续配色，纯声明式，无需函数',
      optionOverrides: { visualMap: { inRange: { color: ['#34c759', '#ffcc00', '#ff3b30'] } } },
    },
  ],
};

export function getVariants(type: ChartType): ChartVariant[] {
  return VARIANTS[type] ?? [];
}
