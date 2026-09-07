/**
 * 支持的图表类型。新增类型必须同时在 charts/ 下注册模板，否则 coverage 守卫测试会失败。
 *
 * 刻意不收 `gauge` / `pictorialBar` / `themeRiver`：
 * 前两个在官方图库里的形态基本都是拟物或信息图装饰（汽车表盘、时钟、重复图标堆成的柱子），
 * themeRiver 则读不出准确数值。三者都不是数据分析里会用来汇报结论的形态，
 * 单个指标用条形图或直接给数值更清楚，多主题随时间的构成用堆叠面积图。
 */
export enum ChartType {
  Bar = 'bar',
  Line = 'line',
  Pie = 'pie',
  Scatter = 'scatter',
  Radar = 'radar',
  Heatmap = 'heatmap',
  Boxplot = 'boxplot',
  Candlestick = 'candlestick',
  Funnel = 'funnel',
  Sankey = 'sankey',
  Treemap = 'treemap',
  Sunburst = 'sunburst',
  Graph = 'graph',
  Tree = 'tree',
  Parallel = 'parallel',
}

export enum OutputFormat {
  Svg = 'svg',
  Png = 'png',
  Option = 'option',
  Html = 'html',
}

/** 调用方可以传入的 delivery 取值 */
export enum DeliveryRequest {
  Auto = 'auto',
  Inline = 'inline',
  File = 'file',
  Url = 'url',
}

/** 推导之后实际使用的交付通道。与 DeliveryRequest 不是同一个集合：这里多一个 raw、少一个 auto。 */
export enum DeliveryChannel {
  Inline = 'inline',
  File = 'file',
  Url = 'url',
  Raw = 'raw',
}

export enum RendererKind {
  Auto = 'auto',
  Svg = 'svg',
  Resvg = 'resvg',
  Canvas = 'canvas',
}

export enum ThemeName {
  Default = 'default',
  Dark = 'dark',
  Vintage = 'vintage',
}

export enum TransportKind {
  Stdio = 'stdio',
  Http = 'http',
}

/** 表格型数据。多数图表类型使用这一结构。 */
export interface Dataset {
  dimensions: string[];
  source: unknown[][] | Record<string, unknown>[];
}

/** 节点-边数据。sankey 与 graph 使用。 */
export interface NodeLinkData {
  nodes: { name: string; value?: number }[];
  links: { source: string; target: string; value?: number }[];
}

/** 递归树数据。tree 使用。 */
export interface TreeNode {
  name: string;
  value?: number;
  children?: TreeNode[];
}

export type ChartData = Dataset | NodeLinkData | TreeNode;

export const DEFAULT_WIDTH = 800;
export const DEFAULT_HEIGHT = 500;
