# ECharts MCP 工具套件实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Apache ECharts 的 MCP 服务，让 LLM 能通过 stdio 或 Streamable HTTP 生成 18 种图表，输出 SVG / PNG / option JSON / 自包含 HTML。

**Architecture:** 六层单向依赖 —— 工具层 → option 构建器 → 渲染层 → 交付层，MCP 核心与传输层完全解耦（一份工具注册代码，stdio 与 HTTP 两个 entry）。渲染默认走 ECharts SSR 出 SVG（零原生依赖），需要位图时经 `@resvg/resvg-js` 栅格化（预编译二进制，免编译）。图表能力靠模板保证常见类型稳定，靠 `optionOverrides` 逃生舱保住表达力上限，工具总数固定为 3 个。

**Tech Stack:** TypeScript · Zod · `@modelcontextprotocol/sdk` 1.30.0 · echarts 6.1.0 · `@resvg/resvg-js` · Express · Vitest

**Spec:** `docs/superpowers/specs/2026-09-04-echarts-mcp-design.md`

## Global Constraints

以下为 spec 中的全局要求，**每个 Task 的验收都隐含包含本节**：

- **TDD 强制**：先写失败测试（RED）→ 跑一遍确认失败 → 最小实现（GREEN）→ 跑测试确认通过 → 提交。顺序不可颠倒。
- **测试覆盖率不低于 80%**（CLAUDE.md 要求）。
- **文件规模**：单文件 200~400 行为宜，**硬上限 800 行**。超限必须拆分。
- **函数规模**：单函数不超过 50 行；嵌套不超过 4 层。
- **枚举建模**：图表类型、输出格式、交付通道、渲染器种类、主题名均为可枚举集合，**一律用 TypeScript enum，禁止散落字符串字面量**（CLAUDE.md 要求）。需要字符串形态时在调用点取 `.valueOf()` / 直接用 enum 值。
- **不可变**：构建 option 时一律返回新对象，禁止原地修改入参。
- **无硬编码**：尺寸、超时、上限等全部走 `src/config.ts`，不写死在业务代码里。
- **依赖版本下限**：`echarts@^6.1.0`、`@modelcontextprotocol/sdk@^1.30.0`、`zod@^3`、Node `>=20`。
- **`animation: false` 强制**：SSR 渲染必须关动画，由 `buildOption` 统一注入，不依赖调用方传。
- **可选依赖**：`canvas` 为 `optionalDependencies`，缺失时**必须静默降级到 resvg，不得抛错**。
- **提交信息格式**：`<type>: <description>`，type ∈ {feat, fix, refactor, docs, test, chore, perf, ci}。
- **不硬绑云厂商**：存储只经 `StorageAdapter` 接口访问，本期只实现 `LocalDiskStore`。

### 已实测验证的前提（Task 实现时若与实际不符，立即停下报告）

本机 darwin arm64 / Node v26.8.1 实测：

- `echarts.init(null, null, { renderer: 'svg', ssr: true, width, height })` + `chart.renderToSVGString()` 在纯 Node 下可用，零原生依赖，单图约 2ms
- `@resvg/resvg-js` 提供预编译二进制，安装无编译过程；SVG→PNG 单图约 168ms（含系统字体扫描），中英文渲染正常
- `@modelcontextprotocol/sdk@1.30.0`：`server.registerTool(name, { title, description, inputSchema }, handler)`，其中 `inputSchema` 为 **Zod raw shape 对象**（不是 `z.object(...)`）；handler 返回 `{ content: [{ type: 'text', text }, { type: 'image', data: <base64>, mimeType }] }`
- `InMemoryTransport.createLinkedPair()` 可在测试中起真实 client/server 对
- `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` 即无状态模式，其 `sessionId` 为 `undefined`

### 本计划相对 spec 的两处补充（已刻意为之）

1. spec §10 要求「渲染超时保护」和「option 体积上限」，但 §11 配置表未定义对应配置项。本计划补充两个环境变量：`ECHARTS_MCP_RENDER_TIMEOUT_MS`（默认 10000）、`ECHARTS_MCP_MAX_OPTION_BYTES`（默认 2000000）。
2. spec §5.2 的 `delivery` 参数取值为 `auto|inline|file|url`，而 §2.1 的交付通道有四种（含 `raw`）。二者不是同一个集合：前者是**入参**，后者是**推导结果**。本计划用两个独立 enum 区分：`DeliveryRequest` 与 `DeliveryChannel`。

---

## 文件结构

实现前先确认这张表，它锁定了本计划的分解决策。**每个文件一个明确职责**。

| 文件 | 职责 | 引入于 |
|---|---|---|
| `src/types.ts` | 全部共享 enum 与数据结构类型，无逻辑 | Task 2 |
| `src/errors.ts` | `ErrorCode` 枚举与 `ChartError` 类 | Task 2 |
| `src/config.ts` | 环境变量解析为 `Config` | Task 2 |
| `src/option/merge.ts` | `deepMerge`，含 series 数组按索引合并语义 | Task 1 |
| `src/option/themes.ts` | 三个内置主题 JSON 与注册 | Task 3 |
| `src/option/build.ts` | `buildOption`：模板 → 主题 → 覆盖合并 → 强制关动画 | Task 3 |
| `src/charts/registry.ts` | `ChartTemplate` 接口、模板注册表、`getTemplate` | Task 2 |
| `src/charts/cartesian.ts` | 直角坐标系图表模板（8 种） | Task 4 |
| `src/charts/categorical.ts` | 非直角坐标系图表模板（7 种） | Task 5 |
| `src/charts/structural.ts` | 结构型图表模板（3 种，含 data 适配） | Task 6 |
| `src/render/types.ts` | `Renderer` 接口与 `RenderResult` | Task 7 |
| `src/render/svg.ts` | `SvgRenderer` | Task 7 |
| `src/render/resvg.ts` | `ResvgRenderer`，含字体缓存 | Task 8 |
| `src/render/canvas.ts` | `CanvasRenderer`（可选依赖）与可用性探测 | Task 9 |
| `src/render/index.ts` | `selectRenderer` 选择与降级逻辑 | Task 9 |
| `src/html/standalone.ts` | 自包含单文件 HTML 生成 | Task 10 |
| `src/deliver/types.ts` | `StorageAdapter`、`DeliveryResult` | Task 11 |
| `src/deliver/local-disk.ts` | `LocalDiskStore` + TTL 清理 | Task 11 |
| `src/deliver/resolve.ts` | `resolveDelivery`：output/delivery 的 auto 推导 | Task 12 |
| `src/deliver/deliver.ts` | 按通道执行交付，产出 MCP content | Task 12 |
| `src/core/server.ts` | `createServer`：注册 3 个工具，与传输无关 | Task 13 |
| `src/tools/generate-chart.ts` | `generate_chart` 的 schema 与 handler | Task 13 |
| `src/tools/render-option.ts` | `render_option` 的 schema 与 handler | Task 14 |
| `src/tools/list-chart-types.ts` | `list_chart_types` 的 schema 与 handler | Task 14 |
| `src/transport/stdio.ts` | stdio entry | Task 15 |
| `src/transport/http.ts` | HTTP entry：无状态 MCP + 鉴权 + 静态路由 | Task 16 |
| `Dockerfile` | 基于 `node:24-slim` + 中文字体 | Task 17 |

依赖方向严格单向：`transport → core → tools → option/build → charts → option/merge`，以及 `tools → render → deliver → StorageAdapter`。**下层不得反向 import 上层。**

---

## Task 1: 项目脚手架与 deepMerge

脚手架折叠进本任务，因为 `deepMerge` 是第一个需要它的交付物。

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `src/option/merge.ts`
- Test: `tests/option/merge.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `deepMerge<T extends object>(base: T, patch: Record<string, unknown> | undefined): T` —— 纯函数，返回新对象，不修改 `base`。数组语义：**按索引逐项合并**（不是整体替换），`patch` 数组更长时保留多出的项。

- [ ] **Step 1: 建脚手架**

```bash
npm init -y
npm pkg set name="echarts-mcp" version="0.1.0" type="module" license="MIT"
npm pkg set engines.node=">=20"
npm i echarts@^6.1.0 @modelcontextprotocol/sdk@^1.30.0 zod@^3 express@^5 @resvg/resvg-js@^2
npm i -D typescript @types/node vitest @vitest/coverage-v8 @types/express supertest @types/supertest
npm pkg set scripts.test="vitest run" scripts.build="tsc -p tsconfig.json"
npm pkg set scripts.coverage="vitest run --coverage"
```

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: { provider: 'v8', thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 } },
  },
});
```

- [ ] **Step 2: 写失败测试**

`tests/option/merge.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { deepMerge } from '../../src/option/merge.js';

describe('deepMerge', () => {
  it('递归合并嵌套对象', () => {
    const base = { title: { text: 'A', left: 'center' }, grid: { top: 10 } };
    const out = deepMerge(base, { title: { text: 'B' } });
    expect(out).toEqual({ title: { text: 'B', left: 'center' }, grid: { top: 10 } });
  });

  it('不修改入参', () => {
    const base = { title: { text: 'A' } };
    deepMerge(base, { title: { text: 'B' } });
    expect(base.title.text).toBe('A');
  });

  it('数组按索引合并而非整体替换', () => {
    const base = { series: [{ type: 'bar', data: [1, 2] }, { type: 'line', data: [3] }] };
    const out = deepMerge(base, { series: [{ itemStyle: { color: 'red' } }] });
    expect(out.series[0]).toEqual({ type: 'bar', data: [1, 2], itemStyle: { color: 'red' } });
    expect(out.series[1]).toEqual({ type: 'line', data: [3] });
  });

  it('patch 数组更长时保留多出的项', () => {
    const base = { series: [{ type: 'bar' }] };
    const out = deepMerge(base, { series: [{}, { type: 'line' }] });
    expect(out.series).toHaveLength(2);
    expect(out.series[1]).toEqual({ type: 'line' });
  });

  it('patch 为 undefined 时返回等值副本', () => {
    const base = { a: 1 };
    const out = deepMerge(base, undefined);
    expect(out).toEqual(base);
    expect(out).not.toBe(base);
  });

  it('null 值显式覆盖', () => {
    const out = deepMerge({ tooltip: { show: true } }, { tooltip: null });
    expect(out.tooltip).toBeNull();
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run tests/option/merge.test.ts`
Expected: FAIL —— 找不到模块 `src/option/merge.js`

- [ ] **Step 4: 最小实现**

`src/option/merge.ts`：

```ts
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function mergeValue(baseVal: unknown, patchVal: unknown): unknown {
  if (Array.isArray(baseVal) && Array.isArray(patchVal)) {
    const len = Math.max(baseVal.length, patchVal.length);
    return Array.from({ length: len }, (_, i) =>
      i < patchVal.length ? mergeValue(baseVal[i], patchVal[i]) : baseVal[i],
    );
  }
  if (isPlainObject(baseVal) && isPlainObject(patchVal)) {
    return deepMerge(baseVal, patchVal);
  }
  return patchVal === undefined ? baseVal : patchVal;
}

export function deepMerge<T extends object>(base: T, patch?: Record<string, unknown>): T {
  const out: Record<string, unknown> = Array.isArray(base) ? [...(base as unknown[])] as never : { ...base };
  if (!patch) return out as T;
  for (const key of Object.keys(patch)) {
    out[key] = mergeValue((base as Record<string, unknown>)[key], patch[key]);
  }
  return out as T;
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run tests/option/merge.test.ts`
Expected: PASS，6 个用例全绿

- [ ] **Step 6: 提交**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/option/merge.ts tests/option/merge.test.ts
git commit -m "feat: 项目脚手架与 option deepMerge"
```

---

## Task 2: 共享类型、错误模型、配置与模板注册表骨架

**Files:**
- Create: `src/types.ts`, `src/errors.ts`, `src/config.ts`, `src/charts/registry.ts`
- Test: `tests/config.test.ts`, `tests/charts/registry.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `enum ChartType`（18 个成员，值见下方代码）
  - `enum OutputFormat { Svg='svg', Png='png', Option='option', Html='html' }`
  - `enum DeliveryRequest { Auto='auto', Inline='inline', File='file', Url='url' }` —— **入参**
  - `enum DeliveryChannel { Inline='inline', File='file', Url='url', Raw='raw' }` —— **推导结果**
  - `enum RendererKind { Auto='auto', Svg='svg', Resvg='resvg', Canvas='canvas' }`
  - `enum ThemeName { Default='default', Dark='dark', Vintage='vintage' }`
  - `enum TransportKind { Stdio='stdio', Http='http' }`
  - `interface Dataset { dimensions: string[]; source: unknown[][] | Record<string, unknown>[] }`
  - `interface NodeLinkData { nodes: { name: string; value?: number }[]; links: { source: string; target: string; value?: number }[] }`
  - `interface TreeNode { name: string; value?: number; children?: TreeNode[] }`
  - `type ChartData = Dataset | NodeLinkData | TreeNode`
  - `enum ErrorCode`、`class ChartError extends Error { code; field? }`
  - `interface Config`、`loadConfig(env?: NodeJS.ProcessEnv): Config`
  - `interface ChartTemplate { type; dataShape; example; build }`、`interface TemplateInput`
  - `CHART_TEMPLATES: Partial<Record<ChartType, ChartTemplate>>`、`getTemplate(type: ChartType): ChartTemplate`、`registerTemplate(t: ChartTemplate): void`

- [ ] **Step 1: 写失败测试**

`tests/charts/registry.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { ChartType } from '../../src/types.js';
import { getTemplate, registerTemplate, CHART_TEMPLATES } from '../../src/charts/registry.js';
import { ChartError, ErrorCode } from '../../src/errors.js';

describe('chart registry', () => {
  it('ChartType 恰好有 18 个成员', () => {
    expect(Object.keys(ChartType)).toHaveLength(18);
  });

  it('注册后可取回模板', () => {
    const tpl = {
      type: ChartType.Bar,
      dataShape: 'Dataset',
      example: { dimensions: ['x', 'y'], source: [['A', 1]] },
      build: () => ({}),
    };
    registerTemplate(tpl);
    expect(getTemplate(ChartType.Bar)).toBe(tpl);
    expect(CHART_TEMPLATES[ChartType.Bar]).toBe(tpl);
  });

  it('取未注册类型抛 ChartError 且 code 为 INVALID_INPUT', () => {
    try {
      getTemplate('nope' as ChartType);
      expect.unreachable('应当抛错');
    } catch (e) {
      expect(e).toBeInstanceOf(ChartError);
      expect((e as ChartError).code).toBe(ErrorCode.InvalidInput);
      expect((e as ChartError).field).toBe('type');
    }
  });
});
```

`tests/config.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';
import { RendererKind } from '../src/types.js';

describe('loadConfig', () => {
  it('全部使用默认值', () => {
    const c = loadConfig({});
    expect(c.token).toBeUndefined();
    expect(c.port).toBe(3000);
    expect(c.storageTtlSeconds).toBe(3600);
    expect(c.renderer).toBe(RendererKind.Auto);
    expect(c.renderTimeoutMs).toBe(10000);
    expect(c.maxOptionBytes).toBe(2_000_000);
  });

  it('读取环境变量覆盖默认值', () => {
    const c = loadConfig({
      ECHARTS_MCP_TOKEN: 'secret',
      ECHARTS_MCP_PORT: '8080',
      ECHARTS_MCP_STORAGE_TTL: '60',
      ECHARTS_MCP_RENDERER: 'svg',
    });
    expect(c.token).toBe('secret');
    expect(c.port).toBe(8080);
    expect(c.storageTtlSeconds).toBe(60);
    expect(c.renderer).toBe(RendererKind.Svg);
  });

  it('非法 renderer 取值抛 ChartError', () => {
    expect(() => loadConfig({ ECHARTS_MCP_RENDERER: 'webgl' })).toThrow(/ECHARTS_MCP_RENDERER/);
  });

  it('非法端口抛 ChartError', () => {
    expect(() => loadConfig({ ECHARTS_MCP_PORT: 'abc' })).toThrow(/ECHARTS_MCP_PORT/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/config.test.ts tests/charts/registry.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `src/types.ts`**

```ts
export enum ChartType {
  Bar = 'bar', Line = 'line', Pie = 'pie', Scatter = 'scatter',
  Radar = 'radar', Heatmap = 'heatmap', Boxplot = 'boxplot',
  Candlestick = 'candlestick', Funnel = 'funnel', Gauge = 'gauge',
  Sankey = 'sankey', Treemap = 'treemap', Sunburst = 'sunburst',
  Graph = 'graph', Tree = 'tree', Parallel = 'parallel',
  ThemeRiver = 'themeRiver', PictorialBar = 'pictorialBar',
}

export enum OutputFormat { Svg = 'svg', Png = 'png', Option = 'option', Html = 'html' }
/** 调用方可以传入的 delivery 取值 */
export enum DeliveryRequest { Auto = 'auto', Inline = 'inline', File = 'file', Url = 'url' }
/** 推导之后实际使用的交付通道 */
export enum DeliveryChannel { Inline = 'inline', File = 'file', Url = 'url', Raw = 'raw' }
export enum RendererKind { Auto = 'auto', Svg = 'svg', Resvg = 'resvg', Canvas = 'canvas' }
export enum ThemeName { Default = 'default', Dark = 'dark', Vintage = 'vintage' }
export enum TransportKind { Stdio = 'stdio', Http = 'http' }

export interface Dataset {
  dimensions: string[];
  source: unknown[][] | Record<string, unknown>[];
}
export interface NodeLinkData {
  nodes: { name: string; value?: number }[];
  links: { source: string; target: string; value?: number }[];
}
export interface TreeNode { name: string; value?: number; children?: TreeNode[] }

export type ChartData = Dataset | NodeLinkData | TreeNode;

export const DEFAULT_WIDTH = 800;
export const DEFAULT_HEIGHT = 500;
```

- [ ] **Step 4: 实现 `src/errors.ts`**

```ts
export enum ErrorCode {
  InvalidInput = 'INVALID_INPUT',
  InvalidOption = 'INVALID_OPTION',
  RenderTimeout = 'RENDER_TIMEOUT',
  OptionTooLarge = 'OPTION_TOO_LARGE',
  RendererUnavailable = 'RENDERER_UNAVAILABLE',
  StorageFailed = 'STORAGE_FAILED',
  DeliveryNotAllowed = 'DELIVERY_NOT_ALLOWED',
}

export class ChartError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'ChartError';
  }
}
```

- [ ] **Step 5: 实现 `src/config.ts`**

```ts
import { RendererKind } from './types.js';
import { ChartError, ErrorCode } from './errors.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface Config {
  token?: string;
  port: number;
  publicUrl?: string;
  storageDir: string;
  storageTtlSeconds: number;
  renderer: RendererKind;
  renderTimeoutMs: number;
  maxOptionBytes: number;
}

function intOf(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ChartError(ErrorCode.InvalidInput, `${key} 必须是正整数，收到 "${raw}"`, key);
  }
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rendererRaw = env.ECHARTS_MCP_RENDERER ?? RendererKind.Auto;
  const renderer = Object.values(RendererKind).find((v) => v === rendererRaw);
  if (!renderer) {
    throw new ChartError(
      ErrorCode.InvalidInput,
      `ECHARTS_MCP_RENDERER 取值非法："${rendererRaw}"，可选：${Object.values(RendererKind).join(', ')}`,
      'ECHARTS_MCP_RENDERER',
    );
  }
  return {
    token: env.ECHARTS_MCP_TOKEN || undefined,
    port: intOf(env, 'ECHARTS_MCP_PORT', 3000),
    publicUrl: env.ECHARTS_MCP_PUBLIC_URL || undefined,
    storageDir: env.ECHARTS_MCP_STORAGE_DIR || join(tmpdir(), 'echarts-mcp'),
    storageTtlSeconds: intOf(env, 'ECHARTS_MCP_STORAGE_TTL', 3600),
    renderer,
    renderTimeoutMs: intOf(env, 'ECHARTS_MCP_RENDER_TIMEOUT_MS', 10000),
    maxOptionBytes: intOf(env, 'ECHARTS_MCP_MAX_OPTION_BYTES', 2_000_000),
  };
}
```

- [ ] **Step 6: 实现 `src/charts/registry.ts`**

```ts
import type { EChartsOption } from 'echarts';
import { ChartType, type ChartData } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';

export interface TemplateInput {
  data: ChartData;
  title?: string;
  subtitle?: string;
}

export interface ChartTemplate {
  readonly type: ChartType;
  /** 给 list_chart_types 用的 data 形状说明，必须写清楚字段含义 */
  readonly dataShape: string;
  /** 可直接复制使用的示例 data */
  readonly example: ChartData;
  build(input: TemplateInput): EChartsOption;
}

export const CHART_TEMPLATES: Partial<Record<ChartType, ChartTemplate>> = {};

export function registerTemplate(template: ChartTemplate): void {
  CHART_TEMPLATES[template.type] = template;
}

export function getTemplate(type: ChartType): ChartTemplate {
  const tpl = CHART_TEMPLATES[type];
  if (!tpl) {
    throw new ChartError(
      ErrorCode.InvalidInput,
      `不支持的图表类型 "${type}"，可用类型：${Object.keys(CHART_TEMPLATES).join(', ')}`,
      'type',
    );
  }
  return tpl;
}
```

- [ ] **Step 7: 跑测试确认通过**

Run: `npx vitest run tests/config.test.ts tests/charts/registry.test.ts`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add src/types.ts src/errors.ts src/config.ts src/charts/registry.ts tests/config.test.ts tests/charts/registry.test.ts
git commit -m "feat: 共享枚举、错误模型、配置解析与图表模板注册表"
```

---

## Task 3: 内置主题与 buildOption 组装

**Files:**
- Create: `src/option/themes.ts`, `src/option/build.ts`
- Test: `tests/option/build.test.ts`

**Interfaces:**
- Consumes: `deepMerge`（Task 1）、`getTemplate` / `TemplateInput`（Task 2）、`ThemeName` / `ChartType`（Task 2）
- Produces:
  - `THEMES: Record<ThemeName, Record<string, unknown>>`
  - `interface BuildOptionInput { type: ChartType; data: ChartData; title?: string; subtitle?: string; theme?: ThemeName; optionOverrides?: Record<string, unknown> }`
  - `buildOption(input: BuildOptionInput): EChartsOption` —— 纯函数

**职责链（顺序不可变）：** 模板产出基础 option → 合并主题 → 合并 `optionOverrides` → **最后强制注入 `animation: false`**。强制注入放在最后，是为了让调用方无法通过 overrides 打开动画导致 SSR 出错。

- [ ] **Step 1: 写失败测试**

`tests/option/build.test.ts`：

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType, ThemeName } from '../../src/types.js';
import { registerTemplate } from '../../src/charts/registry.js';
import { buildOption } from '../../src/option/build.js';

beforeAll(() => {
  registerTemplate({
    type: ChartType.Bar,
    dataShape: 'Dataset',
    example: { dimensions: ['x', 'y'], source: [['A', 1]] },
    build: (input) => ({
      title: { text: input.title },
      series: [{ type: 'bar', itemStyle: { color: 'blue' } }],
    }),
  });
});

describe('buildOption', () => {
  it('产出模板的基础 option 并带上标题', () => {
    const o = buildOption({ type: ChartType.Bar, data: { dimensions: ['x'], source: [] }, title: 'T' });
    expect(o.title).toMatchObject({ text: 'T' });
  });

  it('无论如何都强制 animation: false', () => {
    const o = buildOption({
      type: ChartType.Bar,
      data: { dimensions: ['x'], source: [] },
      optionOverrides: { animation: true },
    });
    expect(o.animation).toBe(false);
  });

  it('optionOverrides 能改到模板内部的深层字段', () => {
    const o = buildOption({
      type: ChartType.Bar,
      data: { dimensions: ['x'], source: [] },
      optionOverrides: { series: [{ itemStyle: { color: 'red' } }] },
    });
    expect((o.series as never[])[0]).toMatchObject({ type: 'bar', itemStyle: { color: 'red' } });
  });

  it('dark 主题注入 backgroundColor', () => {
    const o = buildOption({ type: ChartType.Bar, data: { dimensions: ['x'], source: [] }, theme: ThemeName.Dark });
    expect(o.backgroundColor).toBe('#100c2a');
  });

  it('overrides 优先级高于主题', () => {
    const o = buildOption({
      type: ChartType.Bar,
      data: { dimensions: ['x'], source: [] },
      theme: ThemeName.Dark,
      optionOverrides: { backgroundColor: '#fff' },
    });
    expect(o.backgroundColor).toBe('#fff');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/option/build.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `src/option/themes.ts`**

```ts
import { ThemeName } from '../types.js';

const PALETTE_DEFAULT = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'];
const PALETTE_DARK = ['#4992ff', '#7cffb2', '#fddd60', '#ff6e76', '#58d9f9', '#05c091', '#ff8a45', '#8d48e3'];
const PALETTE_VINTAGE = ['#d87c7c', '#919e8b', '#d7ab82', '#6e7074', '#61a0a8', '#efa18d', '#787464', '#cc7e63'];

export const THEMES: Record<ThemeName, Record<string, unknown>> = {
  [ThemeName.Default]: { color: PALETTE_DEFAULT, backgroundColor: '#ffffff' },
  [ThemeName.Dark]: {
    color: PALETTE_DARK,
    backgroundColor: '#100c2a',
    textStyle: { color: '#ffffff' },
    title: { textStyle: { color: '#ffffff' } },
  },
  [ThemeName.Vintage]: { color: PALETTE_VINTAGE, backgroundColor: '#fef8ef' },
};
```

- [ ] **Step 4: 实现 `src/option/build.ts`**

```ts
import type { EChartsOption } from 'echarts';
import { ThemeName, type ChartType, type ChartData } from '../types.js';
import { getTemplate } from '../charts/registry.js';
import { deepMerge } from './merge.js';
import { THEMES } from './themes.js';

export interface BuildOptionInput {
  type: ChartType;
  data: ChartData;
  title?: string;
  subtitle?: string;
  theme?: ThemeName;
  optionOverrides?: Record<string, unknown>;
}

export function buildOption(input: BuildOptionInput): EChartsOption {
  const template = getTemplate(input.type);
  const base = template.build({ data: input.data, title: input.title, subtitle: input.subtitle });
  const themed = deepMerge(base as Record<string, unknown>, THEMES[input.theme ?? ThemeName.Default]);
  const overridden = deepMerge(themed, input.optionOverrides);
  // 强制关动画必须放最后：SSR 下动画会导致渲染出未完成的中间帧
  return { ...overridden, animation: false } as EChartsOption;
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run tests/option/build.test.ts`
Expected: PASS，5 个用例全绿

- [ ] **Step 6: 提交**

```bash
git add src/option/themes.ts src/option/build.ts tests/option/build.test.ts
git commit -m "feat: 内置主题与 option 组装职责链"
```

---

## Task 4: 直角坐标系图表模板（8 种）

覆盖 `bar` `line` `scatter` `heatmap` `boxplot` `candlestick` `pictorialBar` `themeRiver`。

**Files:**
- Create: `src/charts/cartesian.ts`
- Test: `tests/charts/cartesian.test.ts`

**Interfaces:**
- Consumes: `ChartTemplate` / `TemplateInput` / `registerTemplate`（Task 2）、`Dataset`（Task 2）
- Produces: `registerCartesianTemplates(): void` —— 调用后 8 种类型进入注册表

**data 约定（写进各模板的 `dataShape`，`list_chart_types` 会原样返回给 LLM）：**

| 类型 | `dimensions` 语义 | 每行 `source` 语义 |
|---|---|---|
| bar / line / scatter / pictorialBar | 第 1 维为类目轴，其余每维一条 series | `[类目, 值1, 值2, ...]` |
| heatmap | 恰好 3 维：x 类目、y 类目、值 | `[x, y, value]` |
| boxplot | 恰好 6 维 | `[名称, min, Q1, median, Q3, max]` |
| candlestick | 恰好 5 维 | `[日期, open, close, low, high]` |
| themeRiver | 恰好 3 维 | `[日期, 值, 系列名]` |

- [ ] **Step 1: 写失败测试**

`tests/charts/cartesian.test.ts`：

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType } from '../../src/types.js';
import { getTemplate } from '../../src/charts/registry.js';
import { registerCartesianTemplates } from '../../src/charts/cartesian.js';

beforeAll(() => registerCartesianTemplates());

const CARTESIAN = [
  ChartType.Bar, ChartType.Line, ChartType.Scatter, ChartType.Heatmap,
  ChartType.Boxplot, ChartType.Candlestick, ChartType.PictorialBar, ChartType.ThemeRiver,
];

describe('直角坐标系模板', () => {
  it.each(CARTESIAN)('%s 已注册且 example 可驱动 build', (type) => {
    const tpl = getTemplate(type);
    expect(tpl.dataShape.length).toBeGreaterThan(10);
    const option = tpl.build({ data: tpl.example, title: 'T' });
    expect(option.series).toBeDefined();
    expect(Array.isArray(option.series)).toBe(true);
  });

  it('bar 按维度数量生成多条 series', () => {
    const option = getTemplate(ChartType.Bar).build({
      data: { dimensions: ['月份', '销量', '利润'], source: [['1月', 10, 3], ['2月', 20, 5]] },
    });
    expect(option.series).toHaveLength(2);
    expect((option.series as never[]).every((s: never) => (s as { type: string }).type === 'bar')).toBe(true);
  });

  it('heatmap 带 visualMap 且值域取自数据', () => {
    const option = getTemplate(ChartType.Heatmap).build({
      data: { dimensions: ['x', 'y', 'v'], source: [['a', 'p', 1], ['b', 'q', 9]] },
    });
    expect(option.visualMap).toMatchObject({ min: 1, max: 9 });
  });

  it('title 与 subtitle 都写进 option', () => {
    const option = getTemplate(ChartType.Line).build({
      data: { dimensions: ['x', 'y'], source: [['a', 1]] }, title: '主', subtitle: '副',
    });
    expect(option.title).toMatchObject({ text: '主', subtext: '副' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/charts/cartesian.test.ts`
Expected: FAIL —— `src/charts/cartesian.js` 不存在

- [ ] **Step 3: 实现 `src/charts/cartesian.ts`**

```ts
import type { EChartsOption } from 'echarts';
import { ChartType, type Dataset } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import { registerTemplate, type ChartTemplate, type TemplateInput } from './registry.js';

function asDataset(input: TemplateInput): Dataset {
  const d = input.data as Dataset;
  if (!d || !Array.isArray(d.dimensions) || !Array.isArray(d.source)) {
    throw new ChartError(ErrorCode.InvalidInput, '该图表类型要求 data 为 { dimensions, source } 结构', 'data');
  }
  return d;
}

function titleOf(input: TemplateInput) {
  return { text: input.title, subtext: input.subtitle };
}

function rows(data: Dataset): unknown[][] {
  return data.source.map((row) =>
    Array.isArray(row) ? row : data.dimensions.map((dim) => (row as Record<string, unknown>)[dim]),
  );
}

/** bar / line / scatter / pictorialBar 共用：第 1 维为类目轴，其余每维一条 series */
function seriesPerDimension(type: ChartType, input: TemplateInput, extra: Record<string, unknown> = {}): EChartsOption {
  const data = asDataset(input);
  const table = rows(data);
  const categories = table.map((r) => r[0]);
  const series = data.dimensions.slice(1).map((name, i) => ({
    name, type, data: table.map((r) => r[i + 1]), ...extra,
  }));
  return {
    title: titleOf(input),
    tooltip: { trigger: type === ChartType.Scatter ? 'item' : 'axis' },
    legend: { data: data.dimensions.slice(1), bottom: 0 },
    grid: { left: 60, right: 30, top: 70, bottom: 60 },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value' },
    series: series.length > 0 ? series : [{ type, data: [] }],
  } as EChartsOption;
}

function fixedDims(input: TemplateInput, n: number, label: string): unknown[][] {
  const data = asDataset(input);
  if (data.dimensions.length !== n) {
    throw new ChartError(ErrorCode.InvalidInput, `${label} 要求 dimensions 恰好 ${n} 项，收到 ${data.dimensions.length} 项`, 'data');
  }
  return rows(data);
}

const TEMPLATES: ChartTemplate[] = [
  {
    type: ChartType.Bar,
    dataShape: 'Dataset：dimensions 第 1 项为类目轴，其余每项生成一条柱系列。source 每行为 [类目, 值1, 值2, ...]',
    example: { dimensions: ['月份', '销量'], source: [['1月', 120], ['2月', 200], ['3月', 150]] },
    build: (i) => seriesPerDimension(ChartType.Bar, i),
  },
  {
    type: ChartType.Line,
    dataShape: 'Dataset：同 bar，dimensions 第 1 项为类目轴，其余每项一条折线',
    example: { dimensions: ['月份', '销量'], source: [['1月', 120], ['2月', 200], ['3月', 150]] },
    build: (i) => seriesPerDimension(ChartType.Line, i, { smooth: false }),
  },
  {
    type: ChartType.Scatter,
    dataShape: 'Dataset：dimensions 第 1 项为 x 轴类目，其余每项一组散点',
    example: { dimensions: ['x', 'y'], source: [['A', 10], ['B', 25], ['C', 18]] },
    build: (i) => seriesPerDimension(ChartType.Scatter, i, { symbolSize: 12 }),
  },
  {
    type: ChartType.PictorialBar,
    dataShape: 'Dataset：同 bar，额外用象形符号绘制柱体',
    example: { dimensions: ['城市', '人口'], source: [['北京', 21], ['上海', 24]] },
    build: (i) => seriesPerDimension(ChartType.PictorialBar, i, { symbol: 'roundRect', symbolRepeat: true, symbolSize: [16, 8] }),
  },
  {
    type: ChartType.Heatmap,
    dataShape: 'Dataset：dimensions 恰好 3 项 [x 类目, y 类目, 数值]，source 每行为 [x, y, value]',
    example: { dimensions: ['星期', '时段', '访问量'], source: [['周一', '上午', 5], ['周一', '下午', 9], ['周二', '上午', 2]] },
    build: (input) => {
      const table = fixedDims(input, 3, 'heatmap');
      const xs = [...new Set(table.map((r) => String(r[0])))];
      const ys = [...new Set(table.map((r) => String(r[1])))];
      const values = table.map((r) => Number(r[2]));
      return {
        title: titleOf(input),
        tooltip: { position: 'top' },
        grid: { left: 80, right: 40, top: 70, bottom: 80 },
        xAxis: { type: 'category', data: xs },
        yAxis: { type: 'category', data: ys },
        visualMap: {
          min: values.length ? Math.min(...values) : 0,
          max: values.length ? Math.max(...values) : 1,
          calculable: true, orient: 'horizontal', left: 'center', bottom: 10,
        },
        series: [{ type: 'heatmap', data: table.map((r) => [xs.indexOf(String(r[0])), ys.indexOf(String(r[1])), r[2]]) }],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.Boxplot,
    dataShape: 'Dataset：dimensions 恰好 6 项，source 每行为 [名称, min, Q1, median, Q3, max]（五数概括需调用方预先算好）',
    example: {
      dimensions: ['分组', 'min', 'Q1', 'median', 'Q3', 'max'],
      source: [['A', 1, 3, 5, 7, 9], ['B', 2, 4, 6, 8, 12]],
    },
    build: (input) => {
      const table = fixedDims(input, 6, 'boxplot');
      return {
        title: titleOf(input),
        tooltip: { trigger: 'item' },
        grid: { left: 60, right: 30, top: 70, bottom: 50 },
        xAxis: { type: 'category', data: table.map((r) => r[0]) },
        yAxis: { type: 'value' },
        series: [{ type: 'boxplot', data: table.map((r) => r.slice(1)) }],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.Candlestick,
    dataShape: 'Dataset：dimensions 恰好 5 项，source 每行为 [日期, open, close, low, high]',
    example: {
      dimensions: ['日期', 'open', 'close', 'low', 'high'],
      source: [['2026-01-02', 10, 12, 9, 13], ['2026-01-03', 12, 11, 10, 14]],
    },
    build: (input) => {
      const table = fixedDims(input, 5, 'candlestick');
      return {
        title: titleOf(input),
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        grid: { left: 60, right: 30, top: 70, bottom: 50 },
        xAxis: { type: 'category', data: table.map((r) => r[0]) },
        yAxis: { type: 'value', scale: true },
        series: [{ type: 'candlestick', data: table.map((r) => r.slice(1)) }],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.ThemeRiver,
    dataShape: 'Dataset：dimensions 恰好 3 项，source 每行为 [日期, 数值, 系列名]',
    example: {
      dimensions: ['日期', '数值', '系列'],
      source: [['2026-01-01', 10, 'A'], ['2026-01-02', 15, 'A'], ['2026-01-01', 6, 'B'], ['2026-01-02', 9, 'B']],
    },
    build: (input) => {
      const table = fixedDims(input, 3, 'themeRiver');
      return {
        title: titleOf(input),
        tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
        singleAxis: { type: 'time', top: 70, bottom: 60 },
        series: [{ type: 'themeRiver', data: table }],
      } as EChartsOption;
    },
  },
];

export function registerCartesianTemplates(): void {
  TEMPLATES.forEach(registerTemplate);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/charts/cartesian.test.ts`
Expected: PASS，11 个用例（8 个参数化 + 3 个具体断言）全绿

- [ ] **Step 5: 提交**

```bash
git add src/charts/cartesian.ts tests/charts/cartesian.test.ts
git commit -m "feat: 直角坐标系图表模板 8 种"
```

---

## Task 5: 非直角坐标系图表模板（7 种）

覆盖 `pie` `radar` `gauge` `funnel` `treemap` `sunburst` `parallel`。

**Files:**
- Create: `src/charts/categorical.ts`
- Test: `tests/charts/categorical.test.ts`

**Interfaces:**
- Consumes: 同 Task 4
- Produces: `registerCategoricalTemplates(): void`

**data 约定：**

| 类型 | `dimensions` 语义 | 每行 `source` 语义 |
|---|---|---|
| pie / funnel / gauge | 恰好 2 维 | `[名称, 数值]` |
| radar | 第 1 维为系列名，其余每维一个指标 | `[系列名, 指标1, 指标2, ...]` |
| parallel | 第 1 维为线名，其余每维一个坐标轴 | `[线名, 轴1, 轴2, ...]` |
| treemap / sunburst | 恰好 2 维 | `[层级路径（以 / 分隔）, 数值]` |

- [ ] **Step 1: 写失败测试**

`tests/charts/categorical.test.ts`：

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType } from '../../src/types.js';
import { getTemplate } from '../../src/charts/registry.js';
import { registerCategoricalTemplates } from '../../src/charts/categorical.js';

beforeAll(() => registerCategoricalTemplates());

const TYPES = [
  ChartType.Pie, ChartType.Radar, ChartType.Gauge, ChartType.Funnel,
  ChartType.Treemap, ChartType.Sunburst, ChartType.Parallel,
];

describe('非直角坐标系模板', () => {
  it.each(TYPES)('%s 已注册且 example 可驱动 build', (type) => {
    const tpl = getTemplate(type);
    const option = tpl.build({ data: tpl.example, title: 'T' });
    expect(option.series).toBeDefined();
  });

  it('radar 的 indicator 由 dimensions 推导，max 取该指标最大值', () => {
    const option = getTemplate(ChartType.Radar).build({
      data: { dimensions: ['系列', '攻击', '防御'], source: [['A', 10, 20], ['B', 30, 5]] },
    });
    expect(option.radar).toMatchObject({ indicator: [{ name: '攻击', max: 30 }, { name: '防御', max: 20 }] });
  });

  it('treemap 把 / 分隔的路径还原成树', () => {
    const option = getTemplate(ChartType.Treemap).build({
      data: { dimensions: ['路径', '值'], source: [['华东/上海', 10], ['华东/杭州', 5], ['华北/北京', 8]] },
    });
    const roots = (option.series as never[])[0] as { data: { name: string; children?: unknown[] }[] };
    expect(roots.data.map((n) => n.name)).toEqual(['华东', '华北']);
    expect(roots.data[0].children).toHaveLength(2);
  });

  it('pie 维度数不等于 2 时抛 ChartError', () => {
    expect(() =>
      getTemplate(ChartType.Pie).build({ data: { dimensions: ['a', 'b', 'c'], source: [] } }),
    ).toThrow(/恰好 2 项/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/charts/categorical.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `src/charts/categorical.ts`**

```ts
import type { EChartsOption } from 'echarts';
import { ChartType, type Dataset } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import { registerTemplate, type ChartTemplate, type TemplateInput } from './registry.js';

function asDataset(input: TemplateInput): Dataset {
  const d = input.data as Dataset;
  if (!d || !Array.isArray(d.dimensions) || !Array.isArray(d.source)) {
    throw new ChartError(ErrorCode.InvalidInput, '该图表类型要求 data 为 { dimensions, source } 结构', 'data');
  }
  return d;
}

function rows(data: Dataset): unknown[][] {
  return data.source.map((row) =>
    Array.isArray(row) ? row : data.dimensions.map((dim) => (row as Record<string, unknown>)[dim]),
  );
}

function titleOf(input: TemplateInput) {
  return { text: input.title, subtext: input.subtitle };
}

function pairs(input: TemplateInput, label: string): { name: string; value: number }[] {
  const data = asDataset(input);
  if (data.dimensions.length !== 2) {
    throw new ChartError(ErrorCode.InvalidInput, `${label} 要求 dimensions 恰好 2 项 [名称, 数值]，收到 ${data.dimensions.length} 项`, 'data');
  }
  return rows(data).map((r) => ({ name: String(r[0]), value: Number(r[1]) }));
}

interface TreeAcc { name: string; value?: number; children: TreeAcc[] }

/** 把 "华东/上海" 这类路径还原成树，供 treemap 与 sunburst 共用 */
function pathsToTree(items: { name: string; value: number }[]): TreeAcc[] {
  const roots: TreeAcc[] = [];
  for (const item of items) {
    let level = roots;
    const segments = item.name.split('/').filter(Boolean);
    segments.forEach((seg, idx) => {
      let node = level.find((n) => n.name === seg);
      if (!node) {
        node = { name: seg, children: [] };
        level.push(node);
      }
      if (idx === segments.length - 1) node.value = item.value;
      level = node.children;
    });
  }
  return roots;
}

const TEMPLATES: ChartTemplate[] = [
  {
    type: ChartType.Pie,
    dataShape: 'Dataset：dimensions 恰好 2 项 [名称, 数值]，source 每行为 [名称, 数值]',
    example: { dimensions: ['渠道', '占比'], source: [['直销', 40], ['分销', 35], ['线上', 25]] },
    build: (input) => ({
      title: titleOf(input),
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{ type: 'pie', radius: ['40%', '65%'], data: pairs(input, 'pie') }],
    }) as EChartsOption,
  },
  {
    type: ChartType.Funnel,
    dataShape: 'Dataset：dimensions 恰好 2 项 [阶段名, 数值]',
    example: { dimensions: ['阶段', '人数'], source: [['访问', 100], ['注册', 60], ['付费', 20]] },
    build: (input) => ({
      title: titleOf(input),
      tooltip: { trigger: 'item' },
      series: [{ type: 'funnel', left: '10%', width: '80%', data: pairs(input, 'funnel') }],
    }) as EChartsOption,
  },
  {
    type: ChartType.Gauge,
    dataShape: 'Dataset：dimensions 恰好 2 项 [指标名, 数值]，通常只有一行',
    example: { dimensions: ['指标', '完成率'], source: [['完成率', 72]] },
    build: (input) => ({
      title: titleOf(input),
      series: [{ type: 'gauge', progress: { show: true }, data: pairs(input, 'gauge') }],
    }) as EChartsOption,
  },
  {
    type: ChartType.Radar,
    dataShape: 'Dataset：dimensions 第 1 项为系列名，其余每项为一个雷达指标。source 每行为 [系列名, 指标1值, 指标2值, ...]',
    example: { dimensions: ['角色', '攻击', '防御', '速度'], source: [['战士', 90, 80, 40], ['法师', 70, 40, 60]] },
    build: (input) => {
      const data = asDataset(input);
      const table = rows(data);
      const metrics = data.dimensions.slice(1);
      const indicator = metrics.map((name, i) => ({
        name,
        max: Math.max(1, ...table.map((r) => Number(r[i + 1]) || 0)),
      }));
      return {
        title: titleOf(input),
        tooltip: { trigger: 'item' },
        legend: { bottom: 0, data: table.map((r) => String(r[0])) },
        radar: { indicator },
        series: [{
          type: 'radar',
          data: table.map((r) => ({ name: String(r[0]), value: r.slice(1).map(Number) })),
        }],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.Parallel,
    dataShape: 'Dataset：dimensions 第 1 项为线名，其余每项为一根平行坐标轴。source 每行为 [线名, 轴1值, 轴2值, ...]',
    example: { dimensions: ['样本', '价格', '销量', '评分'], source: [['A', 10, 200, 4.5], ['B', 20, 150, 4.8]] },
    build: (input) => {
      const data = asDataset(input);
      const table = rows(data);
      return {
        title: titleOf(input),
        parallelAxis: data.dimensions.slice(1).map((name, i) => ({ dim: i, name })),
        series: [{ type: 'parallel', data: table.map((r) => r.slice(1).map(Number)) }],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.Treemap,
    dataShape: 'Dataset：dimensions 恰好 2 项 [层级路径, 数值]。路径用 / 分隔表示层级，如 "华东/上海"',
    example: { dimensions: ['路径', '销售额'], source: [['华东/上海', 120], ['华东/杭州', 80], ['华北/北京', 100]] },
    build: (input) => ({
      title: titleOf(input),
      tooltip: { trigger: 'item' },
      series: [{ type: 'treemap', data: pathsToTree(pairs(input, 'treemap')) }],
    }) as EChartsOption,
  },
  {
    type: ChartType.Sunburst,
    dataShape: 'Dataset：同 treemap，dimensions 恰好 2 项 [层级路径, 数值]，路径用 / 分隔',
    example: { dimensions: ['路径', '数量'], source: [['动物/猫', 5], ['动物/狗', 8], ['植物/树', 3]] },
    build: (input) => ({
      title: titleOf(input),
      tooltip: { trigger: 'item' },
      series: [{ type: 'sunburst', radius: [0, '85%'], data: pathsToTree(pairs(input, 'sunburst')) }],
    }) as EChartsOption,
  },
];

export function registerCategoricalTemplates(): void {
  TEMPLATES.forEach(registerTemplate);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/charts/categorical.test.ts`
Expected: PASS，10 个用例全绿

- [ ] **Step 5: 提交**

```bash
git add src/charts/categorical.ts tests/charts/categorical.test.ts
git commit -m "feat: 非直角坐标系图表模板 7 种"
```

---

## Task 6: 结构型图表模板（3 种）

覆盖 `sankey` `graph` `tree`。**这三类是 spec §5.5 明确标注「与统一 data 结构不匹配」的类型**，因此使用各自专属的 data 结构，而非 `Dataset`。

**Files:**
- Create: `src/charts/structural.ts`
- Test: `tests/charts/structural.test.ts`

**Interfaces:**
- Consumes: `NodeLinkData` / `TreeNode`（Task 2）、`registerTemplate`（Task 2）
- Produces: `registerStructuralTemplates(): void`

**data 约定：**

| 类型 | data 结构 |
|---|---|
| sankey / graph | `NodeLinkData`：`{ nodes: [{name, value?}], links: [{source, target, value?}] }` |
| tree | `TreeNode`：`{ name, value?, children?: TreeNode[] }` 递归结构 |

**若实现中发现适配代价超出预期**（spec §14.4 已识别此风险），退路是让这三类只走 `render_option`，并从 `ChartType` 中移除 —— 但需先向需求方报告，不得自行决定。

- [ ] **Step 1: 写失败测试**

`tests/charts/structural.test.ts`：

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType } from '../../src/types.js';
import { getTemplate } from '../../src/charts/registry.js';
import { registerStructuralTemplates } from '../../src/charts/structural.js';

beforeAll(() => registerStructuralTemplates());

describe('结构型模板', () => {
  it.each([ChartType.Sankey, ChartType.Graph, ChartType.Tree])('%s 已注册且 example 可驱动 build', (type) => {
    const tpl = getTemplate(type);
    const option = tpl.build({ data: tpl.example, title: 'T' });
    expect(option.series).toBeDefined();
  });

  it('sankey 把 nodes/links 原样接入 series', () => {
    const option = getTemplate(ChartType.Sankey).build({
      data: { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: 5 }] },
    });
    const s = (option.series as never[])[0] as { data: unknown[]; links: unknown[] };
    expect(s.data).toHaveLength(2);
    expect(s.links).toEqual([{ source: 'A', target: 'B', value: 5 }]);
  });

  it('tree 接受递归 children 结构', () => {
    const option = getTemplate(ChartType.Tree).build({
      data: { name: '根', children: [{ name: '子1' }, { name: '子2', children: [{ name: '孙' }] }] },
    });
    const s = (option.series as never[])[0] as { data: { name: string }[] };
    expect(s.data[0].name).toBe('根');
  });

  it('sankey 收到 Dataset 结构时报错并指出正确形状', () => {
    expect(() =>
      getTemplate(ChartType.Sankey).build({ data: { dimensions: ['a'], source: [] } as never }),
    ).toThrow(/nodes/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/charts/structural.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `src/charts/structural.ts`**

```ts
import type { EChartsOption } from 'echarts';
import { ChartType, type NodeLinkData, type TreeNode } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import { registerTemplate, type ChartTemplate, type TemplateInput } from './registry.js';

function titleOf(input: TemplateInput) {
  return { text: input.title, subtext: input.subtitle };
}

function asNodeLink(input: TemplateInput, label: string): NodeLinkData {
  const d = input.data as NodeLinkData;
  if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.links)) {
    throw new ChartError(
      ErrorCode.InvalidInput,
      `${label} 要求 data 为 { nodes: [{ name, value? }], links: [{ source, target, value? }] }，不接受 { dimensions, source }`,
      'data',
    );
  }
  return d;
}

function asTree(input: TemplateInput): TreeNode {
  const d = input.data as TreeNode;
  if (!d || typeof d.name !== 'string') {
    throw new ChartError(
      ErrorCode.InvalidInput,
      'tree 要求 data 为 { name, value?, children?: [...] } 的递归结构',
      'data',
    );
  }
  return d;
}

const TEMPLATES: ChartTemplate[] = [
  {
    type: ChartType.Sankey,
    dataShape: 'NodeLinkData：{ nodes: [{ name, value? }], links: [{ source, target, value }] }。source/target 必须是 nodes 中出现过的 name',
    example: {
      nodes: [{ name: '访问' }, { name: '注册' }, { name: '付费' }],
      links: [{ source: '访问', target: '注册', value: 60 }, { source: '注册', target: '付费', value: 20 }],
    },
    build: (input) => {
      const d = asNodeLink(input, 'sankey');
      return {
        title: titleOf(input),
        tooltip: { trigger: 'item', triggerOn: 'mousemove' },
        series: [{ type: 'sankey', emphasis: { focus: 'adjacency' }, data: d.nodes, links: d.links }],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.Graph,
    dataShape: 'NodeLinkData：{ nodes: [{ name, value? }], links: [{ source, target, value? }] }。使用力导向布局自动排布',
    example: {
      nodes: [{ name: 'A', value: 10 }, { name: 'B', value: 6 }, { name: 'C', value: 4 }],
      links: [{ source: 'A', target: 'B' }, { source: 'A', target: 'C' }],
    },
    build: (input) => {
      const d = asNodeLink(input, 'graph');
      return {
        title: titleOf(input),
        tooltip: { trigger: 'item' },
        series: [{
          type: 'graph',
          layout: 'force',
          roam: false,
          label: { show: true },
          force: { repulsion: 120, edgeLength: 80 },
          data: d.nodes.map((n) => ({ name: n.name, value: n.value, symbolSize: 10 + (n.value ?? 0) })),
          links: d.links,
        }],
      } as EChartsOption;
    },
  },
  {
    type: ChartType.Tree,
    dataShape: 'TreeNode：{ name, value?, children?: TreeNode[] } 的递归结构，只传一个根节点',
    example: {
      name: '公司',
      children: [
        { name: '研发', children: [{ name: '前端' }, { name: '后端' }] },
        { name: '销售' },
      ],
    },
    build: (input) => ({
      title: titleOf(input),
      tooltip: { trigger: 'item', triggerOn: 'mousemove' },
      series: [{
        type: 'tree',
        data: [asTree(input)],
        left: '10%', right: '20%', top: '12%', bottom: '8%',
        symbolSize: 8,
        label: { position: 'left', verticalAlign: 'middle', align: 'right' },
        expandAndCollapse: false,
      }],
    }) as EChartsOption,
  },
];

export function registerStructuralTemplates(): void {
  TEMPLATES.forEach(registerTemplate);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/charts/structural.test.ts`
Expected: PASS，7 个用例全绿

- [ ] **Step 5: 加一个「注册表覆盖全部 18 种」的守卫测试**

`tests/charts/coverage.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { ChartType } from '../../src/types.js';
import { CHART_TEMPLATES } from '../../src/charts/registry.js';
import { registerCartesianTemplates } from '../../src/charts/cartesian.js';
import { registerCategoricalTemplates } from '../../src/charts/categorical.js';
import { registerStructuralTemplates } from '../../src/charts/structural.js';

describe('模板覆盖度', () => {
  it('18 种 ChartType 全部有模板，且 example 都能 build 出 series', () => {
    registerCartesianTemplates();
    registerCategoricalTemplates();
    registerStructuralTemplates();
    const missing = Object.values(ChartType).filter((t) => !CHART_TEMPLATES[t]);
    expect(missing).toEqual([]);
    for (const type of Object.values(ChartType)) {
      const tpl = CHART_TEMPLATES[type]!;
      expect(tpl.build({ data: tpl.example }).series, `${type} 的 example 没能 build 出 series`).toBeDefined();
    }
  });
});
```

Run: `npx vitest run tests/charts/coverage.test.ts`
Expected: PASS，`missing` 为空数组

- [ ] **Step 6: 提交**

```bash
git add src/charts/structural.ts tests/charts/structural.test.ts tests/charts/coverage.test.ts
git commit -m "feat: 结构型图表模板 3 种与 18 类型覆盖守卫"
```
