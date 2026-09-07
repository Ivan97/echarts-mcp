# 散点图（`scatter`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 每个观测两个数值维度，第三维可用点大小或颜色承载 |
| **回答的问题** | 这两个量有没有关系？有没有离群点？样本聚成几团？ |
| **典型主题** | 相关性分析、性能与成本权衡、人群分布、回归与聚类 |
| **别用它当** | 横轴其实是类目（用柱状图）；点数上万又不开 `large`（渲染会拖慢） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 21 个

option 在 `examples/gallery/scatter/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `scatter-simple` | 基础散点图 | Basic Scatter Chart | — | 22 | — |
| `scatter-anscombe-quartet` | 安斯库姆四重奏 | Anscomb's quartet | 多系列、双轴、多宫格、标注线/点 | 44 | — |
| `scatter-effect` | 涟漪特效散点图 | Effect Scatter Chart | 多系列 | 262 | — |
| `scatter-jitter` | 带抖动的散点图 | Scatter with Jittering | — | 438 | 抽稀 |
| `scatter-punchCard` | GitHub 打卡气泡图 | Punch Card of Github | 含函数 | 168 | 含函数 |
| `scatter-single-axis` | 单轴散点图 | Scatter on Single Axis | 多系列、含函数 | 168 | 含函数 |
| `scatter-weight` | 男性女性身高体重分布 | Distribution of Height and Weight | 多系列、标注线/点、含函数 | 507 | 含函数 |
| `scatter-aggregate-bar` | 散点图聚合为柱状图动画 | Aggregate Scatter to Bar | 多系列、含函数 | 507 | 含函数 |
| `scatter-label-align-right` | 散点图标签顶部对齐 | Align Label on the Top | 含函数 | 19 | 含函数 |
| `scatter-label-align-top` | 散点图标签顶部对齐 | Align Label on the Top | 含函数 | 19 | 含函数 |
| `scatter-symbol-morph` | 散点图变形动画 | Symbol Shape Morph | — | 100 | — |
| `scatter-large` | 大规模散点图 | Large Scatter | 多系列、数据缩放、大数据量 | 978 | 抽稀 |
| `scatter-stream-visual` | 流式渲染和视觉映射操作 | Visual interaction with stream | 视觉映射 | 1011 | 抽稀 |
| `bubble-gradient` | 气泡图 | Bubble Chart | 多系列、渐变色、含函数 | 38 | 含函数 |
| `scatter-aqi-color` | AQI 气泡图 | Scatter Aqi Color | 多系列、视觉映射、含函数 | 93 | 含函数 |
| `scatter-nutrients` | 营养分布散点图 | Scatter Nutrients | 视觉映射 | 500 | 抽稀 |
| `scatter-nutrients-matrix` | 营养分布散点矩阵 | Scatter Nutrients Matrix | 多系列、双轴、数据缩放、视觉映射、多宫格、含函数 | 64 | 抽稀、含函数 |
| `scatter-polar-punchCard` | GitHub 打卡气泡图（极坐标） | Punch Card of Github | 极坐标、含函数 | 168 | 含函数 |
| `scatter-life-expectancy-timeline` | 各国人均寿命与GDP关系演变 | Life Expectancy and GDP | 时间线、含函数 | 0 | 抽稀、含函数 |
| `scatter-painter-choice` | 历代绘画大师的色彩运用 | Master Painter Color Choices Throughout History | 含函数 | 1028 | 抽稀、含函数 |
| `effectScatter-bmap` | 全国主要城市空气质量 - 百度地图 | Air Quality - Baidu Map | 多系列、encode 映射、含函数 | 196 | 含函数 |
