# 图表选型与官方示例总索引

覆盖 Apache ECharts 官方示例库里属于我们支持的 15 种类型的全部例子，共 189 个。

## 怎么用这份索引

**三步，每步只读一个文件，不要一次把 gallery 全部读进来。**

1. 用下面的「选型表」根据用户的问题和数据形态定类型 —— 看的是**要回答什么问题**，不是数据长什么样
2. 打开 `references/gallery/<类型>.md`，在例子表里按标签挑一个最接近的
3. 读 `examples/gallery/<类型>/<id>.json`，取它的 `option` 字段传给 `render_option`

想要的是本工具模板化的调用方式（`generate_chart` + `data` + `optionOverrides`）而不是裸 option，
先看 `examples/examples.json`：18 个精选、已验证的 `generate_chart` payload，常规需求到这一步就够了。

两者的分工：`examples.json` 是**我们工具的惯用写法**，数据与样式分离、有主题和留白默认值；
gallery 是**官方原样的 option**，覆盖面广但要自己管全部字段。常规图表优先前者。

## 选型表

| 类型 | 适合的数据 | 回答的问题 | 典型主题 | 例子 |
|---|---|---|---|---|
| `bar` 柱状图 | 离散类目 × 一到多个数值，类目 3~15 个最舒服 | 谁多谁少？各类目怎么比？总量里哪一块撑起来的？ | 销量与人数对比、分区域分渠道拆解、排行榜、预算构成 | [43 个](gallery/bar.md) |
| `line` 折线图 | 有序的连续维度（时间、刻度）× 数值，可多条系列 | 怎么变的？趋势往哪走？几条序列谁涨得快？ | 时间序列监控、增长曲线、多指标走势对比、预测与置信区间 | [38 个](gallery/line.md) |
| `pie` 饼图 | 一组互斥且加总有意义的部分，2~7 项，数值非负 | 谁占大头？份额怎么分？ | 市场份额、流量来源、预算与成本构成、投票结果 | [16 个](gallery/pie.md) |
| `scatter` 散点图 | 每个观测两个数值维度，第三维可用点大小或颜色承载 | 这两个量有没有关系？有没有离群点？样本聚成几团？ | 相关性分析、性能与成本权衡、人群分布、回归与聚类 | [22 个](gallery/scatter.md) |
| `radar` 雷达图 | 少数几个对象 × 3~8 个可比维度，量纲需要先归一 | 这个对象强在哪、弱在哪？几个对象的画像差在哪？ | 能力模型、产品参数对比、评测得分、体检指标 | [5 个](gallery/radar.md) |
| `heatmap` 热力图 | 两个类目维度交叉出的矩阵 × 一个数值，必须配 `visualMap` | 哪一格最热？有没有成行成列的规律？ | 星期×时段活跃度、渠道×品类转化、相关系数矩阵、日历打卡 | [5 个](gallery/heatmap.md) |
| `boxplot` 箱线图 | 每组一份**已算好的**五数概括：min / Q1 / 中位数 / Q3 / max | 分布多散？中位数差多少？异常值落在哪？ | 多批次实验对比、接口耗时分位、成绩与薪酬分布 | [3 个](gallery/boxplot.md) |
| `candlestick` K 线图 | 时间 × 开盘/收盘/最低/最高四个价格 | 这段时间价格怎么走的？振幅多大？在哪放量？ | 股票、期货、加密货币行情，常与均线和成交量副图同屏 | [9 个](gallery/candlestick.md) |
| `funnel` 漏斗图 | 一条**线性**流程的各阶段留存量，逐级递减 | 哪一步掉得最多？整体转化率多少？ | 注册到支付的转化、招聘流程、销售管线、活动参与 | [4 个](gallery/funnel.md) |
| `sankey` 桑基图 | 节点 + 带权重的有向边，可多级，**不能有环** | 量从哪来、到哪去？哪条路径最粗？在哪分流或汇聚？ | 用户路径与流失、能源与资金流向、渠道归因、预算分配 | [7 个](gallery/sankey.md) |
| `treemap` 矩形树图 | 带数值的层级结构，用面积表达量 | 哪一块占地最大？大类里是谁撑起来的？ | 磁盘与云成本占用、品类销售构成、代码体积、人口与经济体量 | [7 个](gallery/treemap.md) |
| `sunburst` 旭日图 | 同 treemap 的层级数据，但更强调从根到叶的**路径** | 构成路径是什么？每一层各自怎么分？ | 组织与目录结构占比、多级分类构成、多级来源归因 | [7 个](gallery/sunburst.md) |
| `graph` 关系图 | 节点 + 边，边可带权重，节点可分类或带坐标 | 谁和谁有关系？谁是中心？有几个社群？ | 依赖与调用关系、社交网络、知识图谱、共现分析 | [12 个](gallery/graph.md) |
| `tree` 树图 | 单根、每个节点只有一个父的严格层级 | 上下级或包含关系是什么？分支有多深？ | 组织架构、文件目录、决策树、分类体系、技能树 | [7 个](gallery/tree.md) |
| `parallel` 平行坐标 | 多个样本 × 4~15 个数值维度 | 高维空间里样本分成几群？哪些维度是一起变的？ | 多指标筛选、参数与配置空间探索、营养成分与材料属性对比 | [4 个](gallery/parallel.md) |

## 什么时候别用它

选型最容易错的地方不是「想不到用哪个」，而是「用了看起来像但答非所问的那个」。

| 类型 | 别用它当 |
|---|---|
| `bar` | 类目超过 20 个（改横向或先取 Top N）；连续时间趋势（用 line）；纯占比（用 pie） |
| `line` | 类目无序（连线会暗示不存在的连续性）；系列超过 7 条（改热力图或平行坐标） |
| `pie` | 超过 7 片（角度比不出来，改横向条形或 treemap）；比较两个时点的份额变化（用堆叠柱） |
| `scatter` | 横轴其实是类目（用柱状图）；点数上万又不开 `large`（渲染会拖慢） |
| `radar` | 维度超过 10 个（形状糊成一团）；对象超过 4 个（互相遮挡）；各维量纲差太多又没归一 |
| `heatmap` | 只有一个维度；某一维类目超过 30（格子小到看不清） |
| `boxplot` | 只想看总量或均值（用柱状图）；每组样本少于 10（箱线没有统计意义）；传原始观测值（不报错但画错） |
| `candlestick` | 数据不是 OHLC 语义（别拿它当误差棒）；跨度过长又不配 `dataZoom` |
| `funnel` | 流程有分支或回流（用 sankey）；阶段之间不是包含关系；阶段数值不单调 |
| `sankey` | 图里有环（桑基要求无环）；节点过多导致连线互相压住；只有单层（用柱状图） |
| `treemap` | 要精确比较两块相近的量（面积比长度难比）；只有一层且项目少（用条形图） |
| `sunburst` | 层级超过 4 层（外圈太细读不了）；叶子数量很大；只关心叶子大小（用 treemap） |
| `graph` | 边远多于节点导致毛球（先过滤或聚合）；本质是严格层级（用 tree） |
| `tree` | 节点有多个父（那是图，用 graph）；只关心量的占比（用 treemap） |
| `parallel` | 维度少于 3（用散点）；样本上千又不做刷选（线糊成一片） |

## 覆盖范围

官方示例库共 377 个例子，其中 212 个属于我们支持的 15 种类型，已收录 189 个。

**画不出来的**（能力边界，理由逐条列在 `references/gallery-support.md`）：

- `custom-ohlc` —— custom 系列的 renderItem 是函数，静态渲染时被剥离后无法成图
- `scatter-clustering` —— 需要服务端注册 echarts-stat 的 clustering 变换
- `scatter-clustering-process` —— custom 系列的 renderItem 是函数，静态渲染时被剥离后无法成图
- `scatter-exponential-regression` —— 需要服务端注册 echarts-stat 的 regression 变换
- `pie-pattern` —— 用位图做图案填充，需要浏览器的 Image 对象，svg-ssr 下报 Image width/height must be given
- `scatter-linear-regression` —— 需要服务端注册 echarts-stat 的 regression 变换
- `scatter-polynomial-regression` —— 需要服务端注册 echarts-stat 的 regression 变换
- `geo-graph` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `data-transform-aggregate` —— 需要服务端注册 echarts-simple-transform 的 aggregate 变换
- `geo-choropleth-scatter` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `map-iceland-pie` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `scatter-nebula` —— 数据是 8MB 的 Float32 二进制（约 66 万个点），超出服务端 50,000 点的渲染配额，抓下来也画不出
- `bar-race-country` —— 数据要在浏览器里对 CDN 资源做二次解析，构建期沙箱拿不到可用的 dataset
- `matrix-mini-bar-geo` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `watermark` —— 水印用 canvas 现画图案，服务端没有 canvas 2d 上下文
- `scatter-world-population` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `scatter-logarithmic-regression` —— 需要服务端注册 echarts-stat 的 regression 变换
- `effectScatter-map` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `heatmap-bmap` —— 画在百度地图（bmap）上，需要地图扩展与 API key
- `heatmap-map` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `scatter-map` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `scatter-map-brush` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `scatter-weibo` —— 画在 geo 坐标系上，本工具不支持 map / geo

**画得出来但没有收录的**（取舍，不是能力问题）：

- 无

`map` / `geo` / `lines` / `custom` / `matrix` / `calendar` 等类型本工具不支持，因此不在收录范围内。
用户要地图时直接说明不支持，不要拿散点图顶替。

渲染实测结果（浅色与深色两种模式）见 `references/gallery-support.md`。
