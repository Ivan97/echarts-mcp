# 热力图（`heatmap`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 两个类目维度交叉出的矩阵 × 一个数值，必须配 `visualMap` |
| **回答的问题** | 哪一格最热？有没有成行成列的规律？ |
| **典型主题** | 星期×时段活跃度、渠道×品类转化、相关系数矩阵、日历打卡 |
| **别用它当** | 只有一个维度；某一维类目超过 30（格子小到看不清） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 5 个

option 在 `examples/gallery/heatmap/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `heatmap-cartesian` | 笛卡尔坐标系上的热力图 | Heatmap on Cartesian | 视觉映射 | 168 | — |
| `calendar-heatmap` | 日历热力图 | Calendar Heatmap | 视觉映射 | 366 | — |
| `calendar-vertical` | 纵向日历图 | Calendar Heatmap Vertical | 多系列、视觉映射、含函数 | 549 | 抽稀、含函数 |
| `heatmap-large` | 热力图 - 2w 数据 | Heatmap - 20K data | 视觉映射 | 635 | 抽稀 |
| `heatmap-large-piecewise` | 热力图 - 颜色的离散映射 | Heatmap - Discrete Mapping of Color | 视觉映射 | 635 | 抽稀 |
