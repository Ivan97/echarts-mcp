# 箱线图（`boxplot`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 每组一份**已算好的**五数概括：min / Q1 / 中位数 / Q3 / max |
| **回答的问题** | 分布多散？中位数差多少？异常值落在哪？ |
| **典型主题** | 多批次实验对比、接口耗时分位、成绩与薪酬分布 |
| **别用它当** | 只想看总量或均值（用柱状图）；每组样本少于 10（箱线没有统计意义）；传原始观测值（不报错但画错） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 3 个

option 在 `examples/gallery/boxplot/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `boxplot-light-velocity` | 基础盒须图 | Boxplot Light Velocity | 多系列、dataset | 5 | — |
| `boxplot-light-velocity2` | 垂直方向盒须图 | Boxplot Light Velocity2 | 多系列、横向、dataset、encode 映射、含函数 | 5 | 含函数 |
| `boxplot-multi` | 多系列盒须图 | Multiple Categories | 多系列、数据缩放、dataset | 54 | 抽稀 |
