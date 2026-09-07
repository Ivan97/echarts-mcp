# 日历图（`calendar`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 日期 × 数值的长表，日期必须是 YYYY-MM-DD，跨年会自动拆成多个日历 |
| **回答的问题** | 哪几天最活跃？有没有周末效应、季节性或连续中断？ |
| **典型主题** | 打卡与提交热力、日活与订单量、告警频次、出勤与排班 |
| **别用它当** | 时间粒度不是「天」（小时级用热力图，月度用柱状图）；只关心总量走势（用折线） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 8 个

option 在 `examples/gallery/calendar/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `calendar-simple` | 基础日历图 | Simple Calendar | 视觉映射 | 365 | — |
| `calendar-heatmap` | 日历热力图 | Calendar Heatmap | 视觉映射 | 366 | — |
| `calendar-vertical` | 纵向日历图 | Calendar Heatmap Vertical | 多系列、视觉映射、含函数 | 549 | 抽稀、含函数 |
| `calendar-horizontal` | 横向日历图 | Calendar Heatmap Horizontal | 多系列、视觉映射 | 549 | 抽稀 |
| `calendar-graph` | 日历关系图 | Calendar Graph | 多系列、视觉映射 | 378 | — |
| `calendar-lunar` | 农历日历图 | Calendar Lunar | 多系列、视觉映射、含函数 | 549 | 抽稀、含函数 |
| `calendar-pie` | 日历饼图 | Calendar Pie | 多系列、含函数 | 112 | 含函数 |
| `calendar-charts` | 日历图 | Calendar Charts | 多系列、视觉映射、含函数 | 745 | 抽稀、含函数 |
