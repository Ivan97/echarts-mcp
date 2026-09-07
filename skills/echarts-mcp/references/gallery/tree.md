# 树图（`tree`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 单根、每个节点只有一个父的严格层级 |
| **回答的问题** | 上下级或包含关系是什么？分支有多深？ |
| **典型主题** | 组织架构、文件目录、决策树、分类体系、技能树 |
| **别用它当** | 节点有多个父（那是图，用 graph）；只关心量的占比（用 treemap） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 7 个

option 在 `examples/gallery/tree/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `tree-basic` | 从左到右树状图 | From Left to Right Tree | — | 1 | — |
| `tree-legend` | 多棵树 | Multiple Trees | 多系列 | 2 | — |
| `tree-orient-bottom-top` | 从下到上树状图 | From Bottom to Top Tree | — | 1 | — |
| `tree-orient-right-left` | 从右到左树状图 | From Right to Left Tree | — | 1 | — |
| `tree-polyline` | 折线树图 | Tree with Polyline Edge | — | 1 | — |
| `tree-radial` | 径向树状图 | Radial Tree | — | 1 | — |
| `tree-vertical` | 从上到下树状图 | From Top to Bottom Tree | — | 1 | — |
