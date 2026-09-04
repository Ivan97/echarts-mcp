# echarts-mcp 使用指南

本文档里所有的命令、参数和返回值**都是实际跑过的**，不是示意。

---

## 1. 这东西解决什么问题

你在和 LLM 对话时说「把这几个月的销量画成柱状图」，它需要一个能真正出图的工具。

直接让 LLM 写完整的 ECharts option 是可行的，但冷门图表（桑基图、旭日图、平行坐标）它经常写错；
而给每种图表做一个专用工具，20 多份工具描述会一直占着它的上下文。

这个服务的做法是：**用模板保证常见图表稳定，用一个 `optionOverrides` 参数放开表达力上限**，
工具总数固定为 3 个。

它能做的：

- 18 种图表类型，从柱状图到桑基图
- 堆叠、横向、极坐标、双 Y 轴、玫瑰图等细分样式，**不需要换工具**
- 四种产物：SVG、PNG、ECharts option JSON、可交互的单文件 HTML
- 两种集成方式：本地 stdio 进程、远端 HTTP 服务

---

## 2. 安装

### 从源码安装（当前方式）

```bash
cd /Users/ivan97/workspace/WebStormWorkspace/echarts-mcp
npm install
npm run build
npm link          # 把 echarts-mcp 命令装到全局
```

验证：

```bash
$ which echarts-mcp
/Users/ivan97/.npm-global/bin/echarts-mcp
```

`npm link` 会同时装上两个命令：

| 命令 | 用途 |
|---|---|
| `echarts-mcp` | stdio 模式，给本地客户端用 |
| `echarts-mcp-http` | HTTP 模式，给远端部署用 |

### 卸载

```bash
npm unlink -g echarts-mcp
```

---

## 3. 接入客户端

### Claude Code

```bash
claude mcp add echarts -- echarts-mcp
```

或者手工写进配置文件，格式与其他客户端通用：

```json
{
  "mcpServers": {
    "echarts": {
      "command": "echarts-mcp"
    }
  }
}
```

### Claude Desktop

配置文件位置：`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "echarts": {
      "command": "echarts-mcp",
      "env": {
        "ECHARTS_MCP_STORAGE_DIR": "/Users/ivan97/Pictures/echarts"
      }
    }
  }
}
```

把 `ECHARTS_MCP_STORAGE_DIR` 指到一个你平时会打开的目录，出的图就直接落在那里。

### Cherry Studio 等其他客户端

同样的 `mcpServers` 结构。若客户端要求填绝对路径，用 `which echarts-mcp` 的输出。

### 远端 HTTP

```bash
docker build -t echarts-mcp .
docker run -d -p 3000:3000 \
  -e ECHARTS_MCP_TOKEN=your-secret \
  -e ECHARTS_MCP_PUBLIC_URL=https://charts.example.com \
  -v echarts-data:/data \
  echarts-mcp
```

客户端配置：

```json
{
  "mcpServers": {
    "echarts": {
      "type": "http",
      "url": "https://charts.example.com/mcp",
      "headers": { "Authorization": "Bearer your-secret" }
    }
  }
}
```

### 从 LangChain 调用

本服务是标准 MCP server，不需要为 LangChain 做任何适配：

```ts
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

const client = new MultiServerMCPClient({
  echarts: { transport: 'stdio', command: 'echarts-mcp', args: [] },
});
const tools = await client.getTools();
```

---

## 4. 三个工具

| 工具 | 什么时候用 |
|---|---|
| `generate_chart` | 绝大多数情况。给类型和数据即可 |
| `render_option` | 模板覆盖不到的高级需求，直接给完整 ECharts option |
| `list_chart_types` | 不确定某类型的 data 怎么传、有哪些细分样式时 |

### 4.1 `generate_chart`

最少只需要两个参数：

```json
{
  "type": "bar",
  "data": {
    "dimensions": ["月份", "销量"],
    "source": [["1月", 120], ["2月", 200], ["3月", 150]]
  },
  "title": "月度销量"
}
```

实际返回：

```
![月度销量](file:///var/folders/.../635b8e75d52420f6701c28a2bd21fe18.svg)

/var/folders/.../635b8e75d52420f6701c28a2bd21fe18.svg
```

第一行是 Markdown 图片语法，支持 markdown 的客户端会直接把图渲染出来；
第二行是纯路径，方便在 IDE 里点开。

**全部参数：**

| 参数 | 必填 | 说明 |
|---|---|---|
| `type` | 是 | 图表类型，18 种之一 |
| `data` | 是 | 数据，结构随类型而异，见第 5 节 |
| `title` | 否 | 主标题 |
| `subtitle` | 否 | 副标题 |
| `theme` | 否 | `default` / `dark` / `vintage` |
| `width` | 否 | 默认 800 |
| `height` | 否 | 默认 500 |
| `optionOverrides` | 否 | 任意 ECharts option 片段，深合并到模板产物上 |
| `output` | 否 | `svg` / `png` / `option` / `html` |
| `delivery` | 否 | `auto` / `inline` / `file` / `url` |

### 4.2 `render_option`

直接给完整的 ECharts option。能力上限就是 ECharts 本身。

```json
{
  "option": {
    "xAxis": { "type": "category", "data": ["A", "B", "C"] },
    "yAxis": [
      { "type": "value", "name": "销量" },
      { "type": "value", "name": "增速" }
    ],
    "series": [
      { "type": "bar", "data": [120, 200, 150] },
      { "type": "line", "yAxisIndex": 1, "data": [0.1, 0.3, 0.2] }
    ]
  },
  "title": "双轴组合"
}
```

实际返回：

```
![双轴组合](file:///var/folders/.../1ed60b6762f1b66eeb762c78a136a120.svg)
```

### 4.3 `list_chart_types`

不带参数时返回全部 18 种类型的概览。带上 `type` 返回该类型的详情：

```json
{ "type": "bar" }
```

实际返回（节选）：

```json
{
  "type": "bar",
  "dataShape": "Dataset：dimensions 第 1 项为类目轴，其余每项生成一条柱系列。source 每行为 [类目, 值1, 值2, ...]",
  "example": {
    "dimensions": ["月份", "销量"],
    "source": [["1月", 120], ["2月", 200], ["3月", 150], ["4月", 80]]
  },
  "variants": [
    {
      "name": "堆叠",
      "description": "多条系列叠加显示总量。需要为每条系列指定同一个 stack 名",
      "optionOverrides": { "series": [{ "stack": "总量" }, { "stack": "总量" }] }
    },
    { "name": "横向", "...": "..." },
    { "name": "极坐标", "...": "..." },
    { "name": "圆角与数值标签", "...": "..." }
  ]
}
```

`variants` 里的 `optionOverrides` 可以直接复制到 `generate_chart` 里用，不需要修改。

---

## 5. 数据怎么传

18 种类型分三组，每组的 `data` 结构不同。

### 5.1 表格型（15 种）

绝大多数类型用这个结构：

```json
{
  "dimensions": ["月份", "销量", "利润"],
  "source": [["1月", 120, 30], ["2月", 200, 60]]
}
```

`source` 也可以是对象数组，键取自 `dimensions`：

```json
{
  "dimensions": ["月份", "销量"],
  "source": [{ "月份": "1月", "销量": 120 }]
}
```

**维度的含义随类型而变：**

| 类型 | `dimensions` 语义 |
|---|---|
| `bar` `line` `scatter` `pictorialBar` | 第 1 项为类目轴，其余每项一条系列 |
| `radar` `parallel` | 第 1 项为系列名，其余每项一个指标或坐标轴 |
| `pie` `funnel` `gauge` | 恰好 2 项：`[名称, 数值]` |
| `treemap` `sunburst` | 恰好 2 项：`[层级路径, 数值]`，路径用 `/` 分隔 |
| `heatmap` | 恰好 3 项：`[x 类目, y 类目, 数值]` |
| `themeRiver` | 恰好 3 项：`[日期, 数值, 系列名]` |
| `candlestick` | 恰好 5 项：`[日期, open, close, low, high]` |
| `boxplot` | 恰好 6 项：`[名称, min, Q1, median, Q3, max]` |

要求「恰好 N 项」的类型，维度数不对会直接报错并告诉你期望值。

### 5.2 节点-边型（`sankey` / `graph`）

```json
{
  "nodes": [{ "name": "访问" }, { "name": "注册" }, { "name": "付费" }],
  "links": [
    { "source": "访问", "target": "注册", "value": 60 },
    { "source": "注册", "target": "付费", "value": 20 }
  ]
}
```

`links` 里的 `source` / `target` 必须是 `nodes` 中出现过的 `name`。

### 5.3 树型（`tree`）

```json
{
  "name": "公司",
  "children": [
    { "name": "研发", "children": [{ "name": "前端" }, { "name": "后端" }] },
    { "name": "销售" }
  ]
}
```

只传一个根节点。

---

## 6. 细分样式：不需要新工具

「堆叠柱状图」不是一种新类型，只是 `bar` 加了一段 option。

```json
{
  "type": "bar",
  "data": {
    "dimensions": ["月份", "订阅收入", "服务收入"],
    "source": [["1月", 182, 61], ["2月", 214, 74], ["3月", 196, 88]]
  },
  "title": "收入构成",
  "optionOverrides": { "series": [{ "stack": "总量" }, { "stack": "总量" }] }
}
```

现成的片段从 `list_chart_types` 拿。目前内置的：

| 类型 | 可用变体 |
|---|---|
| `bar` | 堆叠、横向、极坐标、圆角与数值标签 |
| `line` | 面积、阶梯、平滑、平滑堆叠面积、双 Y 轴、均值线与极值点 |
| `pie` | 南丁格尔玫瑰、外部百分比标签 |
| `scatter` | 气泡图 |
| `heatmap` | 自定义色带 |

没有列出的需求也能做 —— `optionOverrides` 接受任意 ECharts option 片段。
比如改配色只需要 `{ "color": ["#c23531"] }`。

**合并规则**：对象递归合并，**数组按索引逐项合并**（不是整体替换）。
所以 `{ "series": [{ "stack": "总量" }] }` 只会给第一条系列加 `stack`，不会把它的 `data` 冲掉。

---

## 7. 输出格式与交付方式

`output` 决定产物是什么，`delivery` 决定怎么交给你。

### 7.1 四种 output

| 取值 | 产物 | 什么时候用 |
|---|---|---|
| `svg` | SVG 字符串 | 默认。矢量、体积最小 |
| `png` | PNG 位图 | 需要在聊天窗口里内联显示时 |
| `option` | ECharts option 的 JSON | 交给自己的前端渲染 |
| `html` | 自包含单文件网页 | 需要 tooltip、图例交互、动画时 |

`option` 输出用代码围栏包裹：

````
```json
{
  "title": { ... },
  "series": [ ... ],
  "animation": false
}
```
````

`html` 输出是一个不依赖外部网络的完整网页，**实测 1.1 MB**（内联了 ECharts 运行时）。
打开就是带交互和动画的真实图表：

```
[在浏览器中打开：交互式折线](file:///var/folders/.../80707bb4e0b410a65a1b41d5be894319.html)
```

### 7.2 四种 delivery

| 取值 | 行为 |
|---|---|
| `auto` | 默认。stdio 下走 `file`，HTTP 下走 `url` |
| `inline` | base64 内联进对话 |
| `file` | 写本地盘，返回路径 |
| `url` | 存储后返回链接 |

两条会改写你参数的规则，改写时会在返回里说明原因：

- **`delivery: "inline"` 会强制把 `output` 改成 `png`。** 多数聊天客户端不渲染 `image/svg+xml`。
  实测一张饼图内联后 base64 长度 46172 字符。
- **`output: "html"` 不接受 `inline`。** 1.1 MB 的页面塞进对话不现实，会自动改走文件或链接。

---

## 8. 配置项

全部通过环境变量配置。

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `ECHARTS_MCP_STORAGE_DIR` | 系统临时目录 | 图片落盘位置。**建议改成你会打开的目录** |
| `ECHARTS_MCP_STORAGE_TTL` | 3600 | 图片保留秒数，过期自动清理 |
| `ECHARTS_MCP_TOKEN` | 空 | 配了就启用 Bearer 鉴权，不配则开放 |
| `ECHARTS_MCP_PORT` | 3000 | HTTP 端口 |
| `ECHARTS_MCP_PUBLIC_URL` | 空 | `url` 通道生成链接的前缀 |
| `ECHARTS_MCP_RENDERER` | `auto` | `auto` / `svg` / `resvg` / `canvas` |
| `ECHARTS_MCP_MAX_OPTION_BYTES` | 2000000 | option 序列化字节上限 |
| `ECHARTS_MCP_MAX_DATA_POINTS` | 50000 | 数据点总量上限 |
| `ECHARTS_MCP_FONT_FILES` | 空 | 逗号分隔的字体文件路径，覆盖自动探测 |

---

## 9. 出错时会看到什么

### 参数不合法

服务返回 `isError`，文本带错误码和出错字段：

```
[INVALID_INPUT]（字段：type） 不支持的图表类型 "bar3D"，可用类型：bar, line, pie, ...
```

```
[OPTION_TOO_LARGE]（字段：data） 该 option 含 4 个数据点，超过上限 3。请先对数据做聚合或采样再出图。
```

### 画出来是空图

**ECharts 对非法配置不报错，只会静默画出一张空白图。** 这是它的既定行为，不是本服务的缺陷。
服务会主动检测并在返回开头给出排查方向：

```
这份 option 里没有任何数据点，渲染出来会是一张空图。ECharts 对非法配置不会报错，
只会画出空白，所以请检查：series 是否为数组、series.data 是否为空或 null、
数据是否放在了 dataset 而 series 未通过 encode 引用它。
```

`series.type` 拼错时也会单独提示：

```
series.type 取值 "barr" 不是 ECharts 支持的类型，多半是拼写错误。
ECharts 遇到未知类型不会报错，只会画出一张没有数据的图。
```

---

## 10. 已知的限制

### 传不了 JavaScript 函数

MCP 的工具入参是 JSON，装不下函数。需要写回调的 ECharts 配置项无法直接传入。

实际影响有限，因为大多数场景有声明式替代：

| 想做的事 | 替代写法 |
|---|---|
| `label.formatter` 自定义文本 | 用字符串模板 `{b}: {c} ({d}%)` |
| `symbolSize` 按值变化（气泡图） | 逐点写成 `{ "value": [x, y], "symbolSize": 20 }` |
| `tooltip.formatter` 自定义 | 静态图不渲染 tooltip，该配置不参与出图 |

**唯一的例外是 `output: "html"`**：函数字符串会原样写进网页由浏览器执行。
服务端在任何代码路径上都不执行外来字符串。

### 不支持的图表类型

| 类型 | 原因 |
|---|---|
| `map` / `geo` 地图 | 需要注册 GeoJSON 与地图数据分发，是独立子系统 |
| `lines` 路径图 | 通常依附地图坐标系，随地图一并推迟 |
| 3D 类（`bar3D` / `surface`） | 依赖 echarts-gl 与 WebGL，服务端渲染环境不可用 |

### 中文 PNG 的耗时下限

渲染中文的 PNG 单图约 90ms，SVG 约 2ms。

开销主要来自 CJK 字体文件本身的解析（Noto Sans CJK 有 20MB 量级），
每次栅格化都要重新解析，栅格化库没有提供复用字体库的接口。
这是默认输出走 SVG 的原因。

### 容器里的字体

PNG 由服务端栅格化，用的是**服务器上**的字体；SVG 里字体名原样写入，由**查看者**的设备解析。
两条路径的可用字体不同。

容器缺中文字体时会**静默丢字而不报错**，所以镜像里预装了 `fonts-noto-cjk`。
自建镜像时别忘了这一步。

---

## 11. 为什么是这个设计

三个设计决策的由来：

**为什么只有 3 个工具。** MCP 工具的描述会常驻在 LLM 的上下文里。
每种图表一个工具能让选型最准，但 20 多份描述的开销一直在付。
这里把「有哪些类型、怎么传数据」做成 `list_chart_types` 按需拉取，
平时只占一个工具的位置。

**为什么有 `optionOverrides` 这个口子。** 只给受限参数的话，
「把柱子改成红色」这类需求就做不了；只让 LLM 写完整 option 的话，冷门图表又容易写错。
模板负责稳定，`optionOverrides` 负责上限，两边都要。

**为什么默认输出 SVG 而不是 PNG。** SVG 单图 2ms、3.5KB，PNG 要 90ms、27KB。
只有内联进聊天窗口时才必须用 PNG，那时会自动切换。

---

## 12. 想读代码的话

依赖方向是单向的，从上到下：

```
transport/  两个入口，stdio 与 http
   ↓
core/       工具注册，与传输层无关
   ↓
tools/      三个工具的 schema 与 handler
   ↓
option/     option 构建：模板 → 主题 → 覆盖合并 → 强制关动画
   ↓
charts/     18 个图表模板 + 细分样式目录
   ↓
render/     三个渲染器实现 + 空图检测 + 数据点配额
   ↓
deliver/    交付通道推导 + Markdown 输出 + 存储抽象
```

建议的阅读顺序：

1. `src/types.ts` —— 全部枚举与数据结构，看完就知道系统里有哪些概念
2. `src/option/build.ts` —— 20 行，说清了 option 是怎么拼出来的
3. `src/charts/cartesian.ts` —— 看一个模板长什么样
4. `src/deliver/resolve.ts` —— 交付通道的推导规则全在这里
5. `src/core/server.ts` —— 三个工具怎么挂上去的

设计文档与实施计划在 `docs/superpowers/` 下，里面记录了每个决策的取舍过程，
以及实测推翻先前判断的几处。
