# 柱状图（`bar`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 离散类目 × 一到多个数值，类目 3~15 个最舒服 |
| **回答的问题** | 谁多谁少？各类目怎么比？总量里哪一块撑起来的？ |
| **典型主题** | 销量与人数对比、分区域分渠道拆解、排行榜、预算构成 |
| **别用它当** | 类目超过 20 个（改横向或先取 Top N）；连续时间趋势（用 line）；纯占比（用 pie） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 43 个

option 在 `examples/gallery/bar/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `bar-simple` | 基础柱状图 | Basic Bar | — | 7 | — |
| `bar-tick-align` | 坐标轴刻度与标签对齐 | Axis Align with Tick | — | 7 | — |
| `data-transform-sort-bar` | 柱状图排序 | Sort Data in Bar Chart | dataset、encode 映射 | 9 | — |
| `bar-background` | 带背景色的柱状图 | Bar with Background | — | 7 | — |
| `bar-data-color` | 自定义单个柱子颜色 | Set Style of Single Bar. | — | 7 | — |
| `bar-waterfall` | 瀑布图（柱状图模拟） | Waterfall Chart | 多系列、堆叠、含函数 | 12 | 含函数 |
| `dataset-encode0` | 指定数据到坐标轴的映射 | Simple Encode | 视觉映射、dataset、encode 映射 | 10 | — |
| `bar-negative2` | 交错正负轴标签 | Bar Chart with Negative Value | 堆叠、横向 | 10 | — |
| `bar-polar-label-radial` | 极坐标柱状图标签 | Radial Polar Bar Label Position | 极坐标 | 4 | — |
| `bar-polar-label-tangential` | 极坐标柱状图标签 | Tangential Polar Bar Label Position | 极坐标 | 4 | — |
| `bar-y-category` | 世界人口总量 - 条形图 | World Population | 多系列、横向 | 12 | — |
| `polar-endAngle` | 极坐标系 endAngle | Polar endAngle | 多系列、极坐标 | 6 | — |
| `bar-breaks-simple` | 断轴上的柱状图 | Bar Chart with Axis Breaks | 多系列 | 28 | — |
| `bar-gradient` | 特性示例：渐变色 阴影 点击缩放 | Clickable Column Chart with Gradient | 数据缩放、渐变色 | 20 | — |
| `bar-label-rotation` | 柱状图标签旋转 | Bar Label Rotation | 多系列、富文本标签 | 20 | — |
| `bar-stack` | 堆叠柱状图 | Stacked Column Chart | 多系列、堆叠、标注线/点 | 63 | — |
| `bar-stack-borderRadius` | 带圆角的堆积柱状图 | Stacked Bar with borderRadius | 多系列、堆叠 | 35 | — |
| `bar-stack-normalization` | 堆叠柱状图的归一化 | Stacked Bar Normalization | 多系列、堆叠、含函数 | 35 | 含函数 |
| `bar-stack-normalization-and-variation` | 堆叠柱状图的归一化和变化 | Stacked Bar Normalization and Variation | 多系列、堆叠、含函数 | 35 | 含函数 |
| `bar-waterfall2` | 阶梯瀑布图（柱状图模拟） | Waterfall Chart | 多系列、堆叠、含函数 | 33 | 含函数 |
| `bar-y-category-stack` | 堆叠条形图 | Stacked Horizontal Bar | 多系列、堆叠、横向 | 35 | — |
| `bar-brush` | 柱状图框选 | Brush Select on Column Chart | 多系列、堆叠 | 40 | — |
| `bar-negative` | 正负条形图 | Bar Chart with Negative Value | 多系列、堆叠、横向 | 21 | — |
| `bar1` | 某地区蒸发量和降水量 | Rainfall and Evaporation | 多系列、标注线/点 | 24 | — |
| `mix-line-bar` | 折柱混合 | Mixed Line and Bar | 多系列、双轴、含函数 | 36 | 含函数 |
| `mix-zoom-on-value` | 多数值轴轴缩放 | Mix Zoom On Value | 多系列、数据缩放、含函数 | 448 | 抽稀、含函数 |
| `multiple-y-axis` | 多 Y 轴示例 | Multiple Y Axes | 多系列、双轴 | 36 | — |
| `bar-animation-delay` | 柱状图动画延迟 | Animation Delay | 多系列、含函数 | 200 | 含函数 |
| `bar-drilldown` | 柱状图下钻动画 | Bar Chart Drilldown Animation | — | 3 | — |
| `bar-large` | 大数据量柱图 | Large Scale Bar Chart | 数据缩放、大数据量 | 489 | 抽稀 |
| `bar-race` | 动态排序柱状图 | Bar Race | — | 5 | — |
| `dataset-series-layout-by` | 系列按行和按列排布 | Series Layout By Column or Row | 多系列、双轴、dataset、多宫格 | 4 | — |
| `dataset-simple0` | 最简单的数据集（dataset） | Simple Example of Dataset | 多系列、dataset | 5 | — |
| `dataset-simple1` | 对象数组的输入格式 | Dataset in Object Array | 多系列、dataset | 4 | — |
| `bar-multi-drilldown` | 柱状图多层下钻动画 | Bar Chart Multi-level Drilldown Animation | encode 映射、含函数 | 3 | 含函数 |
| `bar-rich-text` | 天气统计（富文本） | Weather Statistics | 多系列、横向、标注线/点、富文本标签、含函数 | 9 | 含函数 |
| `dynamic-data` | 动态数据 | Dynamic Data | 多系列、双轴、数据缩放 | 20 | — |
| `mix-timeline-finance` | 2002全国宏观经济指标 | Finance Indices 2002 | 时间线、含函数 | 0 | 抽稀、含函数 |
| `bar-polar-real-estate` | 极坐标系下的柱状图 | Bar Chart on Polar | 多系列、堆叠、极坐标、含函数 | 76 | 含函数 |
| `bar-polar-stack` | 极坐标系下的堆叠柱状图 | Stacked Bar Chart on Polar | 多系列、堆叠、极坐标 | 12 | — |
| `bar-polar-stack-radial` | 极坐标系下的堆叠柱状图 | Stacked Bar Chart on Polar(Radial) | 多系列、堆叠、极坐标 | 21 | — |
| `polar-roundCap` | 圆角环形图 | Rounded Bar on Polar | 多系列、极坐标 | 10 | — |
| `bar-breaks-brush` | 断轴上的柱状图（可刷选） | Bar Chart with Axis Breaks (Brush-enabled) | 多系列 | 28 | — |
