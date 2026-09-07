# 雷达图（`radar`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 少数几个对象 × 3~8 个可比维度，量纲需要先归一 |
| **回答的问题** | 这个对象强在哪、弱在哪？几个对象的画像差在哪？ |
| **典型主题** | 能力模型、产品参数对比、评测得分、体检指标 |
| **别用它当** | 维度超过 10 个（形状糊成一团）；对象超过 4 个（互相遮挡）；各维量纲差太多又没归一 |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 5 个

option 在 `examples/gallery/radar/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `radar` | 基础雷达图 | Basic Radar Chart | — | 2 | — |
| `radar-aqi` | AQI - 雷达图 | AQI - Radar Chart | 多系列、面积 | 93 | — |
| `radar-custom` | 自定义雷达图 | Customized Radar Chart | 多系列、渐变色、含函数 | 4 | 含函数 |
| `radar2` | 浏览器占比变化 | Proportion of Browsers | 多系列、视觉映射 | 28 | — |
| `radar-multiple` | 多雷达图 | Multiple Radar | 多系列、面积 | 5 | — |
