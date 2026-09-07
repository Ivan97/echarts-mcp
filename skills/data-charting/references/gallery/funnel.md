# 漏斗图（`funnel`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 一条**线性**流程的各阶段留存量，逐级递减 |
| **回答的问题** | 哪一步掉得最多？整体转化率多少？ |
| **典型主题** | 注册到支付的转化、招聘流程、销售管线、活动参与 |
| **别用它当** | 流程有分支或回流（用 sankey）；阶段之间不是包含关系；阶段数值不单调 |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 4 个

option 在 `examples/gallery/funnel/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `funnel` | 漏斗图 | Funnel Chart | — | 5 | — |
| `funnel-align` | 漏斗图(对比) | Funnel Compare | 多系列 | 20 | — |
| `funnel-customize` | 漏斗图 | Customized Funnel | 多系列 | 10 | — |
| `funnel-mutiple` | 多漏斗图 | Multiple Funnels | 多系列 | 20 | — |
