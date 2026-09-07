# 旭日图（`sunburst`）

## 什么时候用它

| | |
|---|---|
| **适合的数据** | 同 treemap 的层级数据，但更强调从根到叶的**路径** |
| **回答的问题** | 构成路径是什么？每一层各自怎么分？ |
| **典型主题** | 组织与目录结构占比、多级分类构成、多级来源归因 |
| **别用它当** | 层级超过 4 层（外圈太细读不了）；叶子数量很大；只关心叶子大小（用 treemap） |

展开的适用性讨论与常见误用见 `references/choosing-and-options.md`。

## 官方示例 7 个

option 在 `examples/gallery/sunburst/<id>.json` 的 `option` 字段，
直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**

「标签」是从 option 里推出来的特征，用来在同类里二次筛选；
「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；
「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。

| id | 名称 | English | 标签 | 数据点 | 备注 |
|---|---|---|---|---|---|
| `sunburst-simple` | 基础旭日图 | Basic Sunburst | 环形 | 2 | — |
| `sunburst-borderRadius` | 圆角旭日图 | Sunburst with Rounded Corner | 环形 | 2 | — |
| `sunburst-label-rotate` | 旭日图标签旋转 | Sunburst Label Rotate | 环形、含函数 | 4 | 含函数 |
| `sunburst-monochrome` | 单色旭日图 | Monochrome Sunburst | 环形 | 4 | — |
| `sunburst-visualMap` | 旭日图使用视觉编码 | Sunburst VisualMap | 视觉映射、环形 | 3 | — |
| `sunburst-drink` | 饮品风味分类 | Drink Flavors | 环形 | 9 | — |
| `sunburst-book` | 书籍分布 | Book Records | 含函数 | 2 | 含函数 |
