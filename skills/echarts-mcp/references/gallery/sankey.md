# 桑基图（`sankey`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 节点 + 带权重的有向边，可多级，**不能有环** |
| **回答的问题** | 量从哪来、到哪去？哪条路径最粗？在哪分流或汇聚？ |
| **典型主题** | 用户路径与流失、能源与资金流向、渠道归因、预算分配 |
| **别用它当** | 图里有环（桑基要求无环）；节点过多导致连线互相压住；只有单层（用柱状图） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 7 个

option 在 `examples/gallery/sankey/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `sankey-simple` | 基础桑基图 | Basic Sankey | — | 12 | — |
| `sankey-vertical` | 垂直方向的桑基图 | Sankey Orient Vertical | — | 12 | — |
| `sankey-itemstyle` | 桑基图节点自定义样式 | Specify ItemStyle for Each Node in Sankey | — | 208 | — |
| `sankey-levels` | 桑基图层级自定义样式 | Sankey with Levels Setting | — | 130 | — |
| `sankey-energy` | 桑基图渐变色边 | Gradient Edge | — | 116 | — |
| `sankey-nodeAlign-left` | 桑基图左对齐布局 | Node Align Left in Sankey | — | 116 | — |
| `sankey-nodeAlign-right` | 桑基图右对齐布局 | Node Align Right in Sankey | — | 116 | — |
