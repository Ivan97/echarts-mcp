# 关系图（`graph`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 节点 + 边，边可带权重，节点可分类或带坐标 |
| **回答的问题** | 谁和谁有关系？谁是中心？有几个社群？ |
| **典型主题** | 依赖与调用关系、社交网络、知识图谱、共现分析 |
| **别用它当** | 边远多于节点导致毛球（先过滤或聚合）；本质是严格层级（用 tree） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 12 个

option 在 `examples/gallery/graph/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `graph-force2` | 力引导布局 | Force Layout | 多系列 | 152 | — |
| `graph-grid` | 笛卡尔坐标系上的 Graph | Graph on Cartesian | — | 13 | — |
| `graph-simple` | Graph 简单示例 | Simple Graph | — | 10 | — |
| `graph-force` | 力引导布局 | Force Layout | — | 331 | — |
| `graph-label-overlap` | 关系图自动隐藏重叠标签 | Hide Overlapped Label | — | 331 | — |
| `calendar-graph` | 日历关系图 | Calendar Graph | 多系列、视觉映射 | 378 | — |
| `graph` | 悲惨世界人物关系图 | Les Miserables | — | 204 | 抽稀 |
| `graph-circular-layout` | 悲惨世界人物关系图(环形布局) | Les Miserables | — | 204 | 抽稀 |
| `graph-force-dynamic` | 动态增加图节点 | Graph Dynamic | — | 1 | — |
| `graph-life-expectancy` | 预期寿命 | Graph Life Expectancy | 多系列、数据缩放、视觉映射、含函数 | 114 | 抽稀、含函数 |
| `graph-webkit-dep` | WebKit 模块关系依赖图 | Graph Webkit Dep | — | 1 | 抽稀 |
| `graph-npm` | NPM 依赖关系图 | NPM Dependencies | — | 1 | 抽稀 |
