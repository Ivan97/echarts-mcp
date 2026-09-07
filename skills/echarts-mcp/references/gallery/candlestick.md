# K 线图（`candlestick`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 时间 × 开盘/收盘/最低/最高四个价格 |
| **回答的问题** | 这段时间价格怎么走的？振幅多大？在哪放量？ |
| **典型主题** | 股票、期货、加密货币行情，常与均线和成交量副图同屏 |
| **别用它当** | 数据不是 OHLC 语义（别拿它当误差棒）；跨度过长又不配 `dataZoom` |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 9 个

option 在 `examples/gallery/candlestick/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `candlestick-simple` | 基础 K 线图 | Basic Candlestick | — | 4 | — |
| `candlestick-sh` | 上证指数 | ShangHai Index | 多系列、数据缩放、标注线/点、平滑、含函数 | 440 | 含函数 |
| `candlestick-large` | 大数据量K线图 | Large Scale Candlestick | 多系列、双轴、数据缩放、视觉映射、dataset、多宫格、大数据量、encode 映射 | 196 | 抽稀 |
| `matrix-stock` | 股市矩阵图 | Matrix Stock Application | 多系列、横向、双轴、时间轴、多宫格、标注线/点、面积、阶梯、富文本标签 | 272 | 抽稀 |
| `candlestick-touch` | 触屏上的坐标轴指示器 | Axis Pointer Link and Touch | 多系列、双轴、数据缩放、多宫格、平滑、含函数 | 305 | 含函数 |
| `intraday-breaks-1` | 断轴上的日内走势图 | Intraday Chart with Breaks | 时间轴、数据缩放、面积、富文本标签、含函数 | 784 | 抽稀、含函数 |
| `intraday-breaks-2` | 断轴上的日内走势图 (II) | Intraday Chart with Breaks (II) | 时间轴、数据缩放、含函数 | 242 | 含函数 |
| `candlestick-brush` | K 线图刷选 | Candlestick Brush | 多系列、双轴、数据缩放、视觉映射、多宫格、平滑、含函数 | 594 | 抽稀、含函数 |
| `candlestick-sh-2015` | 2015 年上证指数 | ShangHai Index, 2015 | 多系列、数据缩放、平滑 | 615 | 抽稀 |
