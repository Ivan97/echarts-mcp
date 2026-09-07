# 饼图（`pie`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 一组互斥且加总有意义的部分，2~7 项，数值非负 |
| **回答的问题** | 谁占大头？份额怎么分？ |
| **典型主题** | 市场份额、流量来源、预算与成本构成、投票结果 |
| **别用它当** | 超过 7 片（角度比不出来，改横向条形或 treemap）；比较两个时点的份额变化（用堆叠柱） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 16 个

option 在 `examples/gallery/pie/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `pie-simple` | 某站点用户访问来源 | Referer of a Website | — | 5 | — |
| `pie-borderRadius` | 圆角环形图 | Doughnut Chart with Rounded Corner | 环形 | 5 | — |
| `pie-doughnut` | 环形图 | Doughnut Chart | 环形 | 5 | — |
| `pie-half-donut` | 半环形图 | Half Doughnut Chart | 环形 | 5 | — |
| `pie-padAngle` | 饼图扇区间隙 | Pie with padAngle | 环形 | 5 | — |
| `pie-custom` | 饼图自定义样式 | Customized Pie | 视觉映射、玫瑰图、含函数 | 5 | 含函数 |
| `pie-roseType` | 南丁格尔玫瑰图 | Nightingale Chart | 多系列、玫瑰图、环形 | 16 | — |
| `pie-roseType-simple` | 基础南丁格尔玫瑰图 | Nightingale Chart | 玫瑰图、环形 | 8 | — |
| `data-transform-multiple-pie` | 分割数据到数个饼图 | Partition Data to Pies | 多系列、dataset | 21 | — |
| `dataset-default` | 默认 encode 设置 | Default arrangement | 多系列、dataset、encode 映射 | 5 | — |
| `pie-alignTo` | 饼图标签对齐 | Pie Label Align | 多系列 | 21 | — |
| `pie-labelLine-adjust` | 饼图引导线调整 | Label Line Adjust | 多系列、环形、富文本标签、含函数 | 18 | 含函数 |
| `pie-legend` | 可滚动的图例 | Pie with Scrollable Legend | — | 50 | — |
| `pie-rich-text` | 富文本标签 | Pie Special Label | 富文本标签 | 5 | — |
| `pie-nest` | 嵌套环形图 | Nested Pies | 多系列、环形、富文本标签 | 11 | — |
| `calendar-pie` | 日历饼图 | Calendar Pie | 多系列、含函数 | 112 | 含函数 |
