# 排错参考

本文所列的每一条行为都经过实测，不是推测。

## 最重要的一条：ECharts 不报错，只画空图

这是使用这个服务时唯一必须先建立的心智模型。

**ECharts 对非法 option 几乎从不抛异常**，而是静默渲染出一张空白图。实测样本
（echarts 6.1.0，SVG 服务端渲染，600×400）：

| 情形 | 是否抛错 | 产物 |
|---|---|---|
| `series` 传成字符串 | **否** | 233 字节，只有背景 |
| option 完全为空 | **否** | 233 字节 |
| `series.type` 拼错 | **否**，仅 console 警告 | 604 字节，有轴无数据 |
| `series.data` 为空数组 | **否** | 441 字节 |

所以**「工具没报错」不等于「图是对的」**。服务端会主动检测并在返回开头加提示，
看到提示就必须改参数，不能原样重试。

## 服务端返回的提示

### 「这份 option 里没有任何数据点，渲染出来会是一张空图」

判据是数据点总数为 0。逐项排查：

- `series` 是不是数组？传成字符串或对象都会被当成没有数据
- `series.data` 是不是空数组或 `null`
- 数据是不是放在了 `dataset` 里，但 `series` 没有通过 `encode` 引用它
- 类目轴的 `data` 长度和 `series.data` 长度是否匹配

### 「series.type 取值 "xxx" 不是 ECharts 支持的类型」

拼写错误。合法取值：`line` `bar` `pie` `scatter` `effectScatter` `radar` `tree`
`treemap` `sunburst` `boxplot` `candlestick` `heatmap` `map` `parallel` `lines`
`graph` `sankey` `funnel` `custom`。

注意其中 `map` `lines` 本服务不支持（需要 GeoJSON 分发）。

### 「静态图不支持函数值，已忽略以下字段：xxx」

传了函数字符串但输出的是 SVG 或 PNG。静态图不执行 JS，这些字段留着也不会生效。
两条出路：改用字符串模板，或把 `output` 换成 `html`（浏览器会执行函数）。

## 错误码

工具返回 `isError` 时，文本形如 `[错误码]（字段：xxx） 说明`。

| 错误码 | 含义 | 怎么改 |
|---|---|---|
| `INVALID_INPUT` | 参数不合法 | 按提示里的字段名改。类型不支持时会列出全部可用类型 |
| `INVALID_OPTION` | ECharts 拒绝了该 option | 看提示里 ECharts 的原话 |
| `OPTION_TOO_LARGE` | 数据点或序列化体积超限 | 先聚合或采样再出图，默认上限 50000 个数据点 |
| `RENDERER_UNAVAILABLE` | 两种成因，看提示里的原话区分 | **栅格化失败**（服务端字体或环境问题）：改用 `output: "svg"` 绕开。**扩展加载失败**（提示里会点名 `echarts-liquidfill`）：只影响 `liquid` 一种类型，换输出格式没有用，改用 `bar` 或直接给数字；其余类型不受影响 |
| `STORAGE_FAILED` | 写盘失败 | 检查 `ECHARTS_MCP_STORAGE_DIR` 的权限 |

### 「要求 dimensions 恰好 N 项」

有几种类型对维度数有硬性要求，错了会直接报错并告诉你期望值：

| 类型 | dimensions 数 |
|---|---|
| `pie` `funnel` `treemap` `sunburst` `calendar` | 2 |
| `heatmap` `matrix` | 3 |
| `candlestick` | 5 |
| `boxplot` | 6 |

`boxplot` 要的是**已经算好的五数概括**（min / Q1 / median / Q3 / max），
不是原始观测值。传原始数据不会报错，但画出来是错的。

## 静默出错、不会有任何提示的情况

以下几种不触发任何错误码也不触发空图提示，但结果是错的，只能靠核对参数发现。

### 照抄含占位符的变体片段

`list_chart_types` 返回的 `bar` 的**横向**与**极坐标**两个变体，
`optionOverrides` 里带 `"替换为实际类目"` 占位符。

实测：照抄不改时，**坐标轴上会直接印出「替换为实际类目」这几个字，真实类目一个都不显示**。
图能渲染、字节数正常、不触发空图检测，所以完全靠人工核对。

使用前必须把 `data` 数组换成实际类目：

```json
{ "xAxis": { "type": "value", "data": null },
  "yAxis": { "type": "category", "data": ["实际类目1", "实际类目2"] } }
```

### 堆叠时 series 条目数给少了

`{"series":[{"stack":"t"}]}` 只会让第一条系列堆叠，第二条不受影响。
数组是**按索引合并**的，有几条系列就要给几个条目。

### 聊天窗口里看不到图

如果 `delivery` 没设成 `inline`，返回的是文件路径或链接而非内联图片。
另外内联时会强制输出 PNG —— 多数客户端不渲染 `image/svg+xml`。

## 性能相关

| 现象 | 原因 |
|---|---|
| PNG 比 SVG 慢很多（约 90ms vs 2ms） | CJK 字体文件体量大（Noto Sans CJK 约 20MB），每次栅格化都要重新解析，无法复用 |
| 容器里出图中文变成空白 | 服务端缺中文字体。PNG 用的是**服务器**的字体，缺字体时静默丢字不报错。镜像需预装 `fonts-noto-cjk` |
| `output: "html"` 产物有 1.1 MB | 内联了完整的 ECharts 运行时，因此不能内联返回，只能走文件或链接 |
