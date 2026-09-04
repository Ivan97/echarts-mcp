# @ivan97/echarts-mcp

[![npm](https://img.shields.io/npm/v/@ivan97/echarts-mcp)](https://www.npmjs.com/package/@ivan97/echarts-mcp)
[![license](https://img.shields.io/npm/l/@ivan97/echarts-mcp)](LICENSE)

Apache ECharts 的 MCP 服务。给 LLM 一个图表类型和一份数据，返回可直接渲染的图。

支持 **stdio** 与 **Streamable HTTP** 两种集成方式，输出 SVG / PNG / ECharts option JSON / 自包含 HTML 四种格式。

- 覆盖 18 种图表类型，细分样式（堆叠、横向、极坐标、双 Y 轴、玫瑰图……）不需要换工具
- 默认渲染链路**零原生依赖**：ECharts SSR 出 SVG，需要位图时经 `@resvg/resvg-js` 栅格化，无需编译 cairo/pango
- 存储走 `StorageAdapter` 接口，**不绑定任何云厂商**
- 输出为 Markdown 语法，支持 md 的客户端直接把图渲染出来

> **完整使用指南见 [`docs/usage.md`](https://github.com/Ivan97/echarts-mcp/blob/main/docs/usage.md)** —— 安装、各客户端接入配置、
> 三个工具的全部参数、数据结构、出错时的表现，所有示例都是实际跑过的。

## 快速开始

### 安装

```bash
npm install -g @ivan97/echarts-mcp
```

也可以不装，接入配置里直接用 `npx`。

### stdio

标准 `mcpServers` 配置，适用于 Claude Desktop、Claude Code、Cherry Studio 等：

```json
{
  "mcpServers": {
    "echarts": {
      "command": "npx",
      "args": ["-y", "@ivan97/echarts-mcp"]
    }
  }
}
```

Claude Code 也可以一行命令加上：

```bash
claude mcp add echarts -- npx -y @ivan97/echarts-mcp
```

### 远端 HTTP

```bash
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

本服务是标准 MCP server，无需任何改动即可被 LangChain 消费：

```ts
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

const client = new MultiServerMCPClient({
  echarts: { transport: 'stdio', command: 'npx', args: ['-y', '@ivan97/echarts-mcp'] },
});
const tools = await client.getTools();
```

## 三个工具

| 工具 | 用途 |
|---|---|
| `generate_chart` | 主力。给图表类型与数据即可出图；细分样式靠 `optionOverrides` 追加 option 片段实现 |
| `render_option` | 专家模式。直接给完整 ECharts option，能力上限等同 ECharts 本身 |
| `list_chart_types` | 查询某类型的 data 结构、示例数据与可用的细分样式片段 |

工具数量固定为 3 个。「每种图表一个工具」的路线会把 20~30 份 schema 常驻在 LLM 的 context 里；
这里把它变成按需拉取 —— 平时只占一个工具的位置，需要时再调 `list_chart_types`。

### 细分样式不需要新工具

「堆叠柱状图」不是一种新的图表类型，只是 `bar` 加了一段 option：

```json
{
  "type": "bar",
  "data": { "dimensions": ["月份", "订阅", "服务"], "source": [["1月", 182, 61], ["2月", 214, 74]] },
  "optionOverrides": { "series": [{ "stack": "总量" }, { "stack": "总量" }] }
}
```

现成的片段可以从 `list_chart_types` 拿：传入 `type` 会返回该类型的 `variants` 列表。

## 支持的图表类型

18 种，分三组。每种的 data 结构、示例数据与实测渲染图见 [`docs/chart-types.md`](https://github.com/Ivan97/echarts-mcp/blob/main/docs/chart-types.md)。

- **直角坐标系**：`bar` `line` `scatter` `pictorialBar` `heatmap` `boxplot` `candlestick` `themeRiver`
- **非直角坐标系**：`pie` `funnel` `gauge` `radar` `parallel` `treemap` `sunburst`
- **结构型**：`sankey` `graph` `tree`

一期不含地图类（`map` / `geo`）与 3D 类：前者需要 GeoJSON 分发，是独立子系统；后者依赖 WebGL，SSR 环境不可用。

## 输出格式与交付通道

`output` 决定产物形态，`delivery` 决定怎么交给调用方。都不传时按传输方式取最省 token 的默认值：

| 传输 | 默认 delivery | 默认 output | 理由 |
|---|---|---|---|
| stdio | `file` | `svg` | 写本地盘返回路径，客户端可直接打开 |
| HTTP | `url` | `svg` | 对话里只占一行链接 |

两条需要知道的规则：

- **`delivery: "inline"` 会强制输出 PNG。** 多数聊天客户端不渲染 `image/svg+xml`。
- **`output: "html"` 不支持内联。** 它内联了 ECharts 运行时，达 MB 量级，只能走文件或链接。

`html` 产物是一个不依赖外部网络的单文件页面，打开即是带 tooltip、图例交互与动画的真实图表。

## 配置

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `ECHARTS_MCP_TOKEN` | 空 | 配置则启用 Bearer 鉴权，不配则开放 |
| `ECHARTS_MCP_PORT` | 3000 | HTTP 端口 |
| `ECHARTS_MCP_PUBLIC_URL` | 空 | `url` 通道生成链接的 base URL |
| `ECHARTS_MCP_STORAGE_DIR` | 系统临时目录 | 图片落盘路径 |
| `ECHARTS_MCP_STORAGE_TTL` | 3600 | 图片保留秒数 |
| `ECHARTS_MCP_RENDERER` | `auto` | `auto` \| `svg` \| `resvg` \| `canvas` |
| `ECHARTS_MCP_MAX_OPTION_BYTES` | 2000000 | option 序列化字节上限 |
| `ECHARTS_MCP_MAX_DATA_POINTS` | 50000 | 数据点总量上限 |
| `ECHARTS_MCP_FONT_FILES` | 空 | 逗号分隔的字体文件路径，覆盖自动探测 |

## 关于字体

PNG 由服务端栅格化，用的是**服务器上**的字体；SVG 里字体名原样写入，由**查看者**的设备解析。
两条路径的可用字体不同。容器缺中文字体时会静默丢字而不报错，所以镜像里预装了 `fonts-noto-cjk`。

渲染中文的 PNG 单图约 90ms，开销主要来自 CJK 字体文件本身的解析（Noto Sans CJK 有 20MB 量级），
每次栅格化都要重新解析且无法复用。SVG 单图约 2ms，这也是默认走 SVG 的原因。

## 开发

```bash
npm install
npm test            # 单元测试、渲染回归、视觉回归、传输层集成测试
npm run coverage    # 覆盖率
npm run build
```

- 使用指南：[`docs/usage.md`](https://github.com/Ivan97/echarts-mcp/blob/main/docs/usage.md)
- 图表类型清单与实测示例图：[`docs/chart-types.md`](https://github.com/Ivan97/echarts-mcp/blob/main/docs/chart-types.md)
- 设计文档与实施计划：`docs/superpowers/`

## License

MIT
