# 平行坐标（`parallel`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 多个样本 × 4~15 个数值维度 |
| **回答的问题** | 高维空间里样本分成几群？哪些维度是一起变的？ |
| **典型主题** | 多指标筛选、参数与配置空间探索、营养成分与材料属性对比 |
| **别用它当** | 维度少于 3（用散点）；样本上千又不做刷选（线糊成一片） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 4 个

option 在 `examples/gallery/parallel/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `parallel-simple` | 基础平行坐标 | Basic Parallel | — | 3 | — |
| `parallel-aqi` | AQI 分布（平行坐标） | Parallel Aqi | 多系列、视觉映射 | 93 | — |
| `parallel-nutrients` | 营养结构（平行坐标） | Parallel Nutrients | 视觉映射、平滑 | 60 | 抽稀 |
| `scatter-matrix` | 散点矩阵和平行坐标 | Scatter Matrix | 多系列、双轴、视觉映射、多宫格、平滑 | 192 | 抽稀 |
