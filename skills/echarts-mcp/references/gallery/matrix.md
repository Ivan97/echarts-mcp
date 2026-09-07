# 矩阵图（`matrix`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 同 heatmap 的 [x 类目, y 类目, 数值]，但画成带行列表头的表格，逐格标数 |
| **回答的问题** | 这张表里哪一格大？对角线和非对角线差多少？ |
| **典型主题** | 混淆矩阵、相关系数矩阵、渠道×品类交叉表、评分对照表 |
| **别用它当** | 类目多到读不完每一格（改 heatmap 看色块分布）；行列没有对应关系（那就是普通表格） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 10 个

option 在 `examples/gallery/matrix/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `matrix-simple` | 简单的矩阵图 | Simple Matrix | 视觉映射 | 6 | — |
| `matrix-correlation-heatmap` | 相关矩阵（热力图） | Correlation Matrix (Heatmap) | 视觉映射、含函数 | 36 | 含函数 |
| `matrix-correlation-scatter` | 相关矩阵（散点图） | Correlation Matrix (Scatter) | 视觉映射、含函数 | 60 | 含函数 |
| `matrix-covariance` | 协方差矩阵 | Covariance Matrix | 视觉映射、含函数 | 625 | 含函数 |
| `matrix-graph` | 矩阵布局下的关系图 | Graph Chart in Matrix | 含函数 | 14 | 含函数 |
| `matrix-pie` | 矩阵布局下的饼图 | Pie Charts in Matrix | 多系列 | 108 | — |
| `matrix-grid-layout` | 矩阵中响应式网格布局 | Responsive grid layout based on matrix | 多系列、双轴、时间轴、多宫格 | 220 | — |
| `matrix-stock` | 股市矩阵图 | Matrix Stock Application | 多系列、横向、双轴、时间轴、多宫格、标注线/点、面积、阶梯、富文本标签 | 272 | 抽稀 |
| `matrix-sparkline` | 矩阵中的微型折线图 | Mini Line Charts (Sparkline) in Matrix | 多系列、双轴、数据缩放、多宫格 | 150 | 抽稀 |
| `matrix-mbti` | MBTI 伴侣相容性 | MBTI Partner Compatibility | 多系列、视觉映射、含函数 | 64 | 抽稀、含函数 |
