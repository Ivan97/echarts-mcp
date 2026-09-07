# 精选示例目录

> 本文件由 `scripts/generate-references.mjs` 从 `examples/examples.json` 生成，不要手工编辑。

共 22 条，全部由 `scripts/verify-examples.mjs` 实测渲染通过。
在这里挑中一条之后，再去 `examples/examples.json` 里按 `id` 取它的完整 payload ——
**不要为了拿一条 payload 把整份 JSON 读进上下文。**

| id | 说明 | 工具 | 类型 | 要注意的地方 |
|---|---|---|---|---|
| `bar-basic` | 基础柱状图：比较各类目 | `generate_chart` | `bar` | — |
| `bar-stacked` | 堆叠柱状图：看总量也看构成 | `generate_chart` | `bar` | — |
| `bar-horizontal` | 横向条形图：类目名较长时用 | `generate_chart` | `bar` | yAxis.data 必须换成真实类目，照抄 list_chart_types 给的占位符会把占位文字画到轴上 |
| `line-dual-axis` | 双 Y 轴：量纲不同的两条系列共存 | `generate_chart` | `line` | — |
| `line-area-mean` | 面积图加均值线与极值点 | `generate_chart` | `line` | — |
| `pie-rose` | 南丁格尔玫瑰图：数值差异明显时 | `generate_chart` | `pie` | — |
| `scatter-bubble` | 气泡图：逐点指定 symbolSize 表达第三维 | `render_option` | — | symbolSize 不能写成回调函数，必须逐点给数值 |
| `heatmap` | 热力图：两个维度交叉看密度 | `generate_chart` | `heatmap` | — |
| `funnel` | 漏斗图：线性流程的逐级流失 | `generate_chart` | `funnel` | — |
| `sankey` | 桑基图：有分支的流向 | `generate_chart` | `sankey` | links 里的 source/target 必须是 nodes 中出现过的 name |
| `radar` | 雷达图：一个对象在多个维度上的表现 | `generate_chart` | `radar` | — |
| `treemap` | 矩形树图：层级占比，路径用 / 分隔 | `generate_chart` | `treemap` | — |
| `boxplot` | 箱线图：分布形态，五数概括需自行算好 | `generate_chart` | `boxplot` | — |
| `tree` | 树图：层级结构，只传一个根节点 | `generate_chart` | `tree` | — |
| `html-interactive` | 交互式页面：带 tooltip、图例交互与动画 | `generate_chart` | `line` | 产物约 1.1 MB，只能走文件或链接，不能内联 |
| `option-for-frontend` | 只要 option JSON，交给自己的前端渲染 | `generate_chart` | `bar` | — |
| `render-option-multi-grid` | 多坐标系分面：模板覆盖不到，用 render_option | `render_option` | — | — |
| `calendar-activity` | 日历图：一年里哪几天忙 | `generate_chart` | `calendar` | 日期必须是 YYYY-MM-DD。ECharts 认不出的日期不会报错，只会把该点丢掉，画出一张空日历 |
| `calendar-multi-year` | 日历图：跨年数据自动按年拆成多张 | `generate_chart` | `calendar` | 不用自己按年分组，模板会拆开并把每年的点绑到对应的日历上 |
| `matrix-confusion` | 矩阵图：混淆矩阵，逐格读数 | `generate_chart` | `matrix` | 第一维是 x（列），第二维是 y（行）。行列顺序按首次出现，不会被重排 |
| `matrix-cross-tab` | 矩阵图：渠道 × 品类交叉表 | `generate_chart` | `matrix` | 同样的数据给 heatmap 也画得出来，区别是 matrix 带表头且逐格标数，适合要读具体数值的场合 |
| `liquid-progress` | 水波图：季度目标完成率 | `generate_chart` | `liquid` | 只表达比例。比例写 62 或 0.62 都行，但同一列会按统一口径解释——整列里出现过大于 1 的数就全按百分数算。要比较多个指标请改用 bar |
