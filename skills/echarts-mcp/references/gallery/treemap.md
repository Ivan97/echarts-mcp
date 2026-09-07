# 矩形树图（`treemap`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 带数值的层级结构，用面积表达量 |
| **回答的问题** | 哪一块占地最大？大类里是谁撑起来的？ |
| **典型主题** | 磁盘与云成本占用、品类销售构成、代码体积、人口与经济体量 |
| **别用它当** | 要精确比较两块相近的量（面积比长度难比）；只有一层且项目少（用条形图） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 7 个

option 在 `examples/gallery/treemap/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `treemap-sunburst-transition` | 矩形树图和旭日图的动画过渡 | Transition between Treemap and Sunburst | — | 15 | 抽稀 |
| `treemap-disk` | 磁盘占用 | Disk Usage | 含函数 | 9 | 抽稀、含函数 |
| `treemap-drill-down` | ECharts 配置项查询分布 | ECharts Option Query | — | 14 | 抽稀 |
| `treemap-obama` | 3.7 万亿美元支出构成 | How $3.7 Trillion is Spent | 多系列、富文本标签、含函数 | 15 | 抽稀、含函数 |
| `treemap-show-parent` | 显示父层级标签 | Show Parent Labels | 含函数 | 9 | 抽稀、含函数 |
| `treemap-simple` | 基础矩形树图 | Basic Treemap | — | 2 | — |
| `treemap-visual` | 映射为渐变色 | Gradient Mapping | 含函数 | 9 | 抽稀、含函数 |
