# 折线图（`line`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 有序的连续维度（时间、刻度）× 数值，可多条系列 |
| **回答的问题** | 怎么变的？趋势往哪走？几条序列谁涨得快？ |
| **典型主题** | 时间序列监控、增长曲线、多指标走势对比、预测与置信区间 |
| **别用它当** | 类目无序（连线会暗示不存在的连续性）；系列超过 7 条（改热力图或平行坐标） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 37 个

option 在 `examples/gallery/line/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `line-simple` | 基础折线图 | Basic Line Chart | — | 7 | — |
| `line-smooth` | 基础平滑折线图 | Smoothed Line Chart | 平滑 | 7 | — |
| `area-basic` | 基础面积图 | Basic area chart | 面积 | 7 | — |
| `line-stack` | 堆叠折线图 | Stacked Line Chart | 多系列、堆叠 | 35 | — |
| `area-stack` | 堆叠面积图 | Stacked Area Chart | 多系列、堆叠、面积 | 35 | — |
| `area-stack-gradient` | 渐变堆叠面积图 | Gradient Stacked Area Chart | 多系列、堆叠、平滑、面积、渐变色 | 35 | — |
| `bump-chart` | 凹凸图 | Bump Chart (Ranking) | 多系列、平滑 | 54 | — |
| `line-marker` | 未来一周气温变化 | Temperature Change in the Coming Week | 多系列、标注线/点 | 14 | — |
| `area-pieces` | 折线图区域高亮 | Area Pieces | 视觉映射、标注线/点、平滑、面积 | 9 | — |
| `data-transform-filter` | 数据过滤 | Data Transform Filter | 多系列、dataset、encode 映射 | 385 | 抽稀 |
| `line-gradient` | 折线图的渐变 | Line Gradient | 多系列、双轴、视觉映射、多宫格 | 100 | — |
| `line-sections` | 一天用电量分布 | Distribution of Electricity | 视觉映射、标注线/点、平滑 | 20 | — |
| `area-simple` | 大数据量面积图 | Large scale area chart | 数据缩放、面积、渐变色、含函数 | 625 | 抽稀、含函数 |
| `confidence-band` | 置信带 | Confidence Band | 多系列、堆叠、面积、含函数 | 273 | 含函数 |
| `grid-multiple` | 雨量蒸发量关系图 | Rainfall vs Evaporation | 多系列、双轴、数据缩放、多宫格 | 770 | 抽稀 |
| `line-aqi` | 北京 AQI 可视化 | Beijing AQI | 数据缩放、视觉映射、标注线/点 | 616 | 抽稀 |
| `multiple-x-axis` | 多 X 轴 | Multiple X Axes | 多系列、双轴、平滑、含函数 | 24 | 含函数 |
| `area-rainfall` | 雨量流量关系图 | Rainfall | 多系列、双轴、数据缩放、标注线/点、面积 | 770 | 抽稀 |
| `area-time-axis` | 时间轴折线图 | Area Chart with Time Axis | 时间轴、数据缩放、平滑、面积、含函数 | 625 | 抽稀、含函数 |
| `dataset-link` | 联动和共享数据集 | Share Dataset | 多系列、dataset、平滑、encode 映射 | 5 | — |
| `dynamic-data2` | 动态数据 + 时间坐标轴 | Dynamic Data + Time Axis | 时间轴、含函数 | 250 | 抽稀、含函数 |
| `line-function` | 函数绘图 | Function Plot | 数据缩放 | 501 | 抽稀 |
| `line-race` | 动态排序折线图 | Line Race | 多系列、dataset、encode 映射、含函数 | 385 | 抽稀、含函数 |
| `line-markline` | 折线图的标记线 | Line with Marklines | 堆叠、标注线/点 | 5 | — |
| `line-style` | 自定义折线图样式 | Line Style and Item Style | — | 7 | — |
| `line-in-cartesian-coordinate-system` | 双数值轴折线图 | Line Chart in Cartesian Coordinate System | — | 3 | — |
| `line-log` | 对数轴示例 | Log Axis | 多系列、对数轴 | 27 | — |
| `line-step` | 阶梯折线图 | Step Line | 多系列、阶梯 | 21 | — |
| `line-easing` | 缓动函数可视化 | Line Easing Visualizing | 多系列、双轴、多宫格 | 124 | 抽稀 |
| `line-fisheye-lens` | 折线图鱼眼放大 | Fisheye Lens on Line Chart | — | 1000 | — |
| `line-y-category` | 垂直折线图（Y轴为类目轴） | Line Y Category | 横向、平滑 | 9 | — |
| `line-graphic` | 自定义图形组件 | Custom Graphic Component | 横向、平滑 | 9 | — |
| `line-pen` | 点击添加折线图拐点 | Click to Add Points | 平滑、含函数 | 5 | 含函数 |
| `line-polar` | 极坐标双数值轴 | Two Value-Axes in Polar | 极坐标 | 101 | — |
| `line-polar2` | 极坐标双数值轴 | Two Value-Axes in Polar | 极坐标 | 361 | — |
| `line-tooltip-touch` | 移动端上的 dataZoom 和 tooltip | Tooltip and DataZoom on Mobile | 多系列、堆叠、时间轴、数据缩放、平滑、面积、渐变色、含函数 | 18 | 含函数 |
| `line-draggable` | 可拖拽点 | Draggable Points | 数据缩放、平滑、含函数 | 5 | 含函数 |
