# ECharts MCP 工具套件 — 设计文档

- 日期：2026-09-04
- 状态：已与需求方确认，待评审
- 范围：A（出图核心）+ B（传输与部署）

---

## 1. 背景与目标

把 Apache ECharts 的图表生成能力，通过 MCP（Model Context Protocol）暴露给大模型客户端，
让 LLM 能够根据自然语言和数据直接产出图表。

同时支持两种集成形态：

- **stdio**：本地进程，`npx` 一条命令即用，面向 Claude Code / IDE / 桌面客户端
- **Streamable HTTP**：远端部署，面向自建前端和 BI 系统

### 1.1 与现有方案的关系

已调研的 prior art 是官方仓库 `apache/echarts-mcp`（82 star，2026-09-03 仍在更新）。
它在 README 中自述为示例实现（"shows how to implement"），存在三个限制，正是本项目要解决的：

| 官方实现的限制 | 本项目的做法 |
|---|---|
| 仅支持 8 种 series 类型 | 覆盖 18 种，并留有 option 直通通道兜底 |
| 强依赖百度云对象存储才能返回图片 | 交付方式三通道，存储抽象为可替换 adapter，内置本地磁盘 |
| 仅 stdio | stdio + Streamable HTTP 双传输，核心逻辑与传输解耦 |

官方 README 中关于「三种参数路线」的讨论是有价值的结论，本项目采纳其核心洞察
（LLM 直接写完整 option 对冷门图表不稳定），但**不采纳其结论**（只给最小参数、
主题由服务端锁死）。理由见 5.1 节。

### 1.2 成功标准

1. 一条 `npx` 命令即可在 Claude Code 中出图，无需任何云服务账号
2. 一个 Docker 镜像即可远端部署，镜像不需要编译原生模块
3. 18 种图表类型全部有可跑通的测试用例
4. LLM 提出的非常规需求（改配色、加双轴、组合图）不需要新增工具即可满足

---

## 2. 范围

### 2.1 本期做

- 图表 option 构建（模板 + 覆盖合并）
- 服务端无头渲染（SVG / PNG）
- 四种输出格式：SVG、PNG、ECharts option JSON、自包含 HTML
- 四种交付通道：内联 base64（`inline`）、本地文件（`file`）、URL（`url`）、直接返回文本（`raw`）
- stdio 与 Streamable HTTP 两种传输
- 可选 Bearer Token 鉴权
- npm 包与 Docker 镜像分发

### 2.2 本期明确不做（YAGNI）

| 不做的东西 | 原因 |
|---|---|
| 地图类图表（map / geo） | 需要 GeoJSON 注册与地图数据分发，是独立子系统 |
| ECharts 文档检索、option 校验、代码生成工具组 | 需求方明确砍掉；与出图正交，可作为独立二期 |
| 多租户会话隔离、`Mcp-Session-Id` 状态维护 | 出图是无状态请求-响应，用不上会话 |
| SSE 服务端主动推送 | 同上 |
| S3 / OSS 存储实现 | 只留接口扩展点，不写实现 |

---

## 3. 已验证的技术结论

以下数据均为本机（darwin arm64、Node v26.8.1、echarts 6.1.0）**实测所得**，非推测。
验证脚本见 12.4 节，需在实现阶段固化为回归测试。

### 3.1 ECharts SVG SSR 可在纯 Node 环境跑通

```js
const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 600, height: 400 });
chart.setOption({ animation: false, /* ... */ });
const svg = chart.renderToSVGString();
chart.dispose();
```

- **零原生依赖**，不需要 node-canvas、不需要 cairo/pango
- 中文字符正常写入 SVG `<text>` 元素
- 一张四柱柱状图产物 3.5KB

### 3.2 存在优于 node-canvas 的 PNG 路径

`@resvg/resvg-js` 提供预编译二进制（本机安装 `@resvg/resvg-js-darwin-arm64`，秒级完成，
**无编译过程**）。将 ECharts 产出的 SVG 栅格化为 PNG，中英文混排均正常渲染（已目视确认产出图像）。

三条渲染路径实测对比：

| 路径 | 依赖代价 | 单图耗时（热路径） | 产物体积 |
|---|---|---|---|
| ECharts SSR → SVG | 零原生依赖 | **2ms** | 3.5KB |
| SVG → resvg-js → PNG（1200px 宽） | 预编译二进制，免编译 | **168ms** | 27KB |
| node-canvas → PNG | 需编译 cairo/pango，中文需手动注册字体 | 未实测 | 未实测 |

**决策：resvg 作为默认 PNG 路径，node-canvas 降级为可选依赖。**
这使 Docker 镜像可基于 `node:slim`，只需额外安装中文字体包，无需构建工具链。

### 3.3 已识别的性能优化点（未实施）

168ms 中的大部分开销来自 `Resvg` 构造时 `loadSystemFonts: true` 重复扫描系统字体。
实现阶段应将字体加载结果缓存或改用显式 `fontFiles`/`fontBuffers` 预载。
**此优化的实际收益未验证**，作为实现阶段的待办。

---

## 4. 架构分层

```
调用方
  │
  ├─ stdio ─────────┐
  └─ Streamable HTTP┤
                    ▼
         ② MCP Server 核心
         工具注册 / 参数校验 / 错误映射
         （与传输层完全解耦，一份工具代码两个 entry）
                    ▼
         ③ 工具层（3 个工具）
         generate_chart / render_option / list_chart_types
                    ▼
         ④ Option 构建器
         图表模板 → 基础 option → 主题合并 → deep-merge 覆盖
                    ▼
         ⑤ 渲染层（可插拔）
         SvgRenderer(默认) / ResvgRenderer / CanvasRenderer(可选)
                    ▼
         ⑥ 交付层（四通道）
         inline / file / url / raw
                    ▼
         StorageAdapter 接口
         LocalDiskStore(内置) / S3、OSS(仅扩展点)
```

分层的约束：**每一层只依赖它下面那层的接口，不依赖实现**。具体地：

- 工具层不知道渲染器是 SVG 还是 canvas
- 渲染层不知道产物要内联还是上传
- 核心不知道自己跑在 stdio 还是 HTTP 上

---

## 5. 工具契约

### 5.1 路线选择：分层混合（预设 + 逃生舱）

官方 README 归纳的三条路线各有硬伤：

- **路线 1（LLM 给完整 option）**：覆盖面最大，但冷门图表（桑基、旭日、平行坐标）LLM 容易写错
- **路线 2/3（受限参数）**：稳定，但表达力有天花板，「把柱子改成红色」这类需求做不了
- **每种图一个工具（AntV mcp-server-chart 路线）**：LLM 选型最准，但 20~30 个工具的 schema
  常驻 context，且新增类型必须改代码

本项目采用**分层混合**：用模板保证常见图表的稳定性，用 `optionOverrides` 逃生舱
恢复表达力上限，用 `render_option` 兜住 ECharts 的完整能力，全部只用 3 个工具。

### 5.2 `generate_chart`

主力工具。参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| `type` | 是 | 图表类型枚举，取值见 5.5 |
| `data` | 是 | 统一采用 ECharts 原生 dataset 结构（见 5.4） |
| `title` | 否 | 主标题 |
| `subtitle` | 否 | 副标题 |
| `theme` | 否 | 内置主题名，取值见 5.7 |
| `width` | 否 | 默认 800 |
| `height` | 否 | 默认 500 |
| `optionOverrides` | 否 | **逃生舱**：任意 ECharts option 片段，deep-merge 到模板产物上 |
| `output` | 否 | `svg` \| `png` \| `option` \| `html`，产物定义见 5.6，默认由 `delivery` 推导 |
| `delivery` | 否 | `auto` \| `inline` \| `file` \| `url`，默认 `auto` |

`optionOverrides` 是本设计的关键：它把「为特殊需求新增工具」变成「LLM 追加一段 option」，
使工具数量不随图表特性增长。改配色、加第二根 Y 轴、组合图、自定义 tooltip 全部走这里。

### 5.3 `render_option`

专家模式。LLM 直接提供完整 ECharts option 对象，服务端只负责渲染。
能力上限等同 ECharts 本身。参数：`option`（必填）、`width`、`height`、`theme`、`output`、`delivery`。

### 5.4 `list_chart_types`

能力自描述工具。按需返回：支持的类型清单、每种类型期望的 `data` 形状、一个可直接复制使用的示例。

**这个工具是 context 成本的解法**：它把 AntV 路线中「20~30 个工具的 schema 常驻 context」
转化为「LLM 需要时主动拉取」，既省 token 又保留可发现性。

### 5.5 data 结构与图表类型

统一使用 ECharts 原生 dataset 结构：

```
{ dimensions: string[], source: 行数组[] | 对象数组[] }
```

一期支持 18 种类型：

`bar` `line` `pie` `scatter` `radar` `heatmap` `boxplot` `candlestick` `funnel`
`gauge` `sankey` `treemap` `sunburst` `graph` `tree` `parallel` `themeRiver` `pictorialBar`

**已知的结构别扭之处（已接受的代价）**：`dimensions/source` 对表格型图表
（bar/line/pie/scatter 等）非常自然，但对 `sankey`（节点 + 边）、`graph`（图结构）、
`tree`（树结构）是别扭的。这三类在模板中做专门的 data 适配，
并在 `list_chart_types` 的返回中明确说明其 data 形状。
代价是这几类的 schema 描述会明显长于其他类型。

---

### 5.6 `output` 四种取值的确切产物

| 取值 | 产物 | 用途 |
|---|---|---|
| `svg` | SVG 字符串 | 矢量、体积最小，默认值 |
| `png` | PNG 字节 | 聊天客户端内联显示 |
| `option` | ECharts option 的 JSON | 前端应用 / BI 系统自行渲染，保真度最高 |
| `html` | **自包含单文件 HTML** | 双击即可在浏览器打开、带交互的图表 |

`html` 的确切定义：一个不依赖外部网络的完整 HTML 文档，内含
（a）打包进来的 ECharts 运行时脚本，（b）序列化后的 option，（c）一个挂载容器。
打开即为**带 tooltip、图例交互、动画的真实 ECharts 图表**，而非静态图片。

已接受的代价：内嵌 ECharts 运行时会使单个 HTML 文件达到 MB 量级。
因此 `html` 产物**只走 `file` 或 `url` 通道，禁止内联**，避免打爆对话上下文。

### 5.7 `theme` 的取值

一期提供三个内置主题，均以 ECharts 主题 JSON 形式内置，不联网加载：

| 取值 | 说明 |
|---|---|
| `default` | ECharts 原生默认主题，默认值 |
| `dark` | 深色背景主题 |
| `vintage` | ECharts 官方 vintage 配色 |

自定义主题不在一期范围内。需要改配色的场景走 `optionOverrides` 逃生舱
（如 `{ color: ['#c23531', '#2f4554'] }`），无需新增主题。

---

## 6. Option 构建器

纯函数，无副作用，无 IO。职责链：

```
图表类型模板 → 基础 option
             → 主题合并
             → deep-merge(optionOverrides)
             → 强制 animation: false（SSR 必需）
             → 输出 option 对象
```

设计约束：

- 必须是纯函数，因为它是最值钱的可测单元（见 12.1）
- 每个图表类型一个独立模板文件，避免出现一个巨型 switch
- deep-merge 需处理数组语义：`series` 数组的合并策略要明确（按索引合并，而非替换）

---

## 7. 渲染层

统一接口，三个实现：

| 实现 | 触发条件 | 说明 |
|---|---|---|
| `SvgRenderer` | 默认 | ECharts SSR `renderToSVGString()` |
| `ResvgRenderer` | 需要位图时 | 接 SvgRenderer 的产物栅格化 |
| `CanvasRenderer` | 显式配置且已安装 `canvas` | 供 canvas 独有特性使用，绕过 SVG 链路 |

关键行为：**请求 PNG 但 `canvas` 未安装时，自动走 resvg，而不是报错。**

---

## 8. 交付层与存储抽象

### 8.1 `delivery: auto` 推导规则

| 传输方式 | delivery | output | 理由 |
|---|---|---|---|
| stdio | `file` | `svg` | 写本地盘返回路径，客户端可直接打开，最省 token |
| stdio + 显式 `inline` | `inline` | **强制 png** | 见 8.2 |
| Streamable HTTP | `url` | `svg` | 对话中只有一行链接，多轮对话友好 |
| 任意 + `output: option` | `raw` | — | option JSON 体积小，直接返回文本，供前端/BI 消费 |
| 任意 + `output: html` | `file`（stdio）/ `url`（HTTP） | — | 自包含 HTML 达 MB 量级，**禁止 `raw` 与 `inline`**，见 5.6 |

### 8.2 为什么 inline 时强制 PNG

**假设（未验证）**：多数聊天类 MCP 客户端的 ImageContent 只支持 `image/png` 等位图
mimeType，不渲染 `image/svg+xml`。若成立，则「默认 SVG」在内联场景下不可用。

本设计据此强制 inline → PNG。**该假设必须在实现阶段用真实客户端验证**，见 14.1。

### 8.3 StorageAdapter

```
interface StorageAdapter {
  put(bytes, mimeType): Promise<{ url: string }>
}
```

- 内置 `LocalDiskStore`：不可猜的随机 ID 作为文件名 + TTL 到期自动清理
- S3 / OSS：**只定义扩展点，本期不实现**

这一层的存在就是为了避免重蹈官方实现硬绑百度云的覆辙。

---

## 9. 传输层与部署

### 9.1 两个 entry，一份核心

工具注册代码只写一遍，stdio 与 HTTP 两个 entry 各自包装。

- **stdio**：`npx echarts-mcp`，零配置
- **Streamable HTTP**：**无状态模式**，不维护 `Mcp-Session-Id`。可水平扩展，无需粘性路由。
  另挂静态文件路由，服务 `url` 通道产出的图片。

### 9.2 鉴权

环境变量 `ECHARTS_MCP_TOKEN`：

- 已配置 → 校验请求的 Bearer Token
- 未配置 → 开放访问（便于内网与本机调试）

### 9.3 分发

- npm 包（供 `npx` 使用）
- Docker 镜像：基于 `node:slim`，额外安装中文字体包。
  因默认链路零原生依赖，**镜像构建无需编译工具链**。

---

## 10. 错误处理

| 场景 | 处理 |
|---|---|
| 入参不合法 | Zod 校验，错误信息精确指向出错字段 |
| `setOption` 抛错 | 捕获并返回结构化 `isError`，**明确指出是哪个 option 字段不合法** |
| 渲染超时 | 超时保护，返回明确错误 |
| option 体积超限 | 设上限，防止 LLM 塞入巨量数据打爆内存 |
| 请求 PNG 但 canvas 未装 | 静默降级到 resvg，不报错 |

第二条是 `render_option` 模式好不好用的关键：错误信息足够具体，LLM 才能自我修正重试。

---

## 11. 配置项

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `ECHARTS_MCP_TOKEN` | 空 | 配置则启用 Bearer 鉴权 |
| `ECHARTS_MCP_PORT` | 3000 | HTTP 端口 |
| `ECHARTS_MCP_PUBLIC_URL` | 空 | `url` 通道生成链接的 base URL |
| `ECHARTS_MCP_STORAGE_DIR` | 系统临时目录 | 本地存储路径 |
| `ECHARTS_MCP_STORAGE_TTL` | 3600 | 图片保留秒数 |
| `ECHARTS_MCP_RENDERER` | `auto` | `auto` \| `svg` \| `resvg` \| `canvas` |

---

## 12. 测试策略

遵循 CLAUDE.md 要求：TDD（先红后绿），覆盖率不低于 80%。

### 12.1 单元测试 — option 构建器

构建器是纯函数，用快照测试其产出的 option JSON。**这是最好写也最值钱的一层**，
18 种类型 × 各自的 data 形状 × 覆盖合并逻辑。

### 12.2 渲染测试 — SVG 快照

SVG 单图仅 2ms，可以把全部图表类型跑一遍做快照比对，成本极低。

### 12.3 视觉回归 — PNG 像素比对

只挑少量关键图做，避免像素级比对带来的 flaky 测试。

### 12.4 集成测试

- **stdio**：用 MCP SDK 的内存 transport 起真实 client，走完整链路
- **HTTP**：用 supertest 打真实端点，覆盖鉴权开/关两种情况
- 把第 3 节的验证脚本固化进来，防止 ECharts / resvg 升级导致回归

---

## 13. 技术栈与目录结构

TypeScript + Zod + `@modelcontextprotocol/sdk` + echarts 6 + Express + Vitest。

目录按职责分层，遵循 CLAUDE.md 的「多个小文件优于少数大文件」（单文件 200~400 行，上限 800）：

```
src/
  core/          MCP server 核心、工具注册
  tools/         3 个工具各自的 schema 与 handler
  charts/        18 个图表类型模板，一类一个文件
  option/        option 构建器、主题、deep-merge
  render/        渲染器接口与三个实现
  deliver/       交付通道与 StorageAdapter
  transport/     stdio / http 两个 entry
```

图表类型、输出格式、交付通道、渲染器种类均为可枚举集合，
按 CLAUDE.md 要求**一律用 enum 建模，不散落字符串字面量**。

---

## 14. 未验证的假设与风险

### 14.1 聊天客户端对 SVG 的支持情况（阻塞 8.2 决策）

8.2 节「inline 强制 PNG」建立在「客户端不渲染 `image/svg+xml`」这一假设上，
**该假设尚未用真实客户端验证**。实现阶段的第一批任务应包含此验证。
若假设不成立，可放宽为 inline 也允许 SVG，降低 168ms 的栅格化开销。

### 14.2 node-canvas 路径完全未实测

3.2 节表格中 node-canvas 一行标注为「未实测」。该路径是可选依赖，
实现阶段需实测其安装成本与中文字体注册流程，否则不应在文档中承诺其可用性。

### 14.3 字体缓存优化收益未验证

见 3.3 节。

### 14.4 sankey / graph / tree 的 data 适配复杂度

5.5 节已识别这三类与统一 data 结构不匹配。适配的实际复杂度未评估，
存在超出预期的可能。若实现中发现适配代价过高，退路是让这三类只走 `render_option`。

---

## 15. 实现顺序建议

1. option 构建器 + 图表模板（纯函数，可完全 TDD，无外部依赖）
2. 渲染层（SvgRenderer → ResvgRenderer）
3. 交付层 + StorageAdapter
4. MCP 核心 + 3 个工具
5. stdio entry
6. HTTP entry + 鉴权 + 静态路由
7. Docker 镜像与 npm 分发

前 4 步全部可以离线测试，第 5 步才第一次接入真实客户端 —— 14.1 的验证应在此时进行。

---

## 16. 评审后的决策补充（2026-09-04）

需求方评审图表类型清单后提出新要求：**尽量支持每种图表完整能力的 options，给用户更灵活的体验**。
以下四条为据此确定的补充决策，覆盖前文相应段落。

### 16.1 细分样式一律不扩展类型枚举（已实测）

「类型」与「样式」是两件事。堆叠柱状图、横向条形图、极坐标柱状图、面积图、阶梯折线图、
平滑堆叠面积图、南丁格尔玫瑰图、双 Y 轴组合图等 **10 个细分样式已实测渲染通过**，
`type` 参数始终是 `bar`/`line`/`pie` 之一，差异只在 `optionOverrides`。

结论：**18 种类型枚举不因样式需求而增长**。证据见 `docs/chart-types.md` 第 4 节。

### 16.2 纯 JSON 的能力边界（已实测）

MCP 工具入参是 JSON，无法承载 JavaScript 函数。以下 6 项高级能力经实测确认**纯 JSON 可表达**，
不受此约束：气泡图（逐点 `symbolSize`）、字符串模板 `label.formatter`、`visualMap` 连续映射、
`markLine`/`markPoint`、多 grid 分面、富文本与轴标签旋转。证据见 `docs/chart-types.md` 第 5 节。

真正受限的只有必须写 JS 回调的配置项，替代方案见同节表格。

### 16.3 函数字符串：只在 html 输出支持，服务端永不 eval

为消除 16.2 的残余限制，`optionOverrides` 允许传入函数字符串（形如 `"function(p){ ... }"`），
但**处理方式按输出格式严格区分**：

| 输出格式 | 函数字符串的处理 | 安全性 |
|---|---|---|
| `html` | 原样写入生成的 HTML，由**浏览器**执行 | 服务端不执行任何外来代码 |
| `svg` / `png` | **剥离该字段**，并在工具响应的 `notes` 中告知调用方「已忽略某字段的函数值，静态图不支持函数」 | 同上 |
| `option` | 原样返回给调用方，由其前端自行决定是否反序列化 | 同上 |

**硬约束：服务端在任何代码路径上都不得 `eval` 或 `new Function` 外来字符串。**
此约束不可通过配置项放宽 —— 不提供 `ECHARTS_MCP_ALLOW_FUNCTIONS` 之类的开关。

### 16.4 `list_chart_types` 追加 `variants` 字段

为让「细分样式」成为**可发现能力**而非靠 LLM 猜测，`list_chart_types` 的返回在
`dataShape` 与 `example` 之外追加 `variants`：每种类型列出常见细分样式的名称与
对应的 `optionOverrides` 片段。

这直接服务于「完整能力」这一要求：LLM 不必预先知道 ECharts 有 `stack`、`roseType`、
`coordinateSystem: 'polar'` 这些配置，工具会主动告诉它。

### 16.5 对前文的影响

- §5.4 `list_chart_types` 的返回结构增加 `variants` 字段
- §5.6 `output: html` 的定义增加「函数字符串由浏览器执行」
- §10 错误处理增加一类**非错误提示**：`notes` 数组，用于告知调用方被静默调整的字段
- §14 未验证假设新增一条：见 §16.6

### 16.6 新增的未验证假设

`optionOverrides` 与模板产物 deep-merge 时，可能出现**残留字段**。
已实测的一例：横向条形图把 `xAxis` 从 category 改为 value 后，原 category 的 `data`
字段仍留在 option 中 —— 该例经渲染确认 ECharts 会忽略它，结果正确。
**但这不代表所有残留字段都无害。** 实现阶段需为每个细分样式补渲染回归测试，
不得假设「合并不出错就等于渲染正确」。
