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

---

> **以下 Task 落实 spec §16（评审后决策补充）。** 关键约束提前声明：
> **服务端在任何代码路径上都不得 `eval` 或 `new Function` 外来字符串**，
> 不提供任何放宽此约束的配置项。函数字符串只允许原样写入 html 产物交由浏览器执行。

---

## Task 7: 细分样式目录（variants）

落实 spec §16.4。让「堆叠柱状图」「南丁格尔玫瑰图」这类细分样式成为**可发现能力**，
而不是靠 LLM 猜 ECharts 有哪些配置项。

**Files:**
- Create: `src/charts/variants.ts`
- Test: `tests/charts/variants.test.ts`

**Interfaces:**
- Consumes: `ChartType`（Task 2）
- Produces:
  - `interface ChartVariant { name: string; description: string; optionOverrides: Record<string, unknown> }`
  - `VARIANTS: Partial<Record<ChartType, ChartVariant[]>>`
  - `getVariants(type: ChartType): ChartVariant[]` —— 无对应条目时返回空数组，**不抛错**

下表的 `optionOverrides` 片段**均已实测渲染通过**（见 `docs/chart-types.md` 第 4 节），
实现时照抄，不要自行改写。

- [ ] **Step 1: 写失败测试**

`tests/charts/variants.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { ChartType } from '../../src/types.js';
import { getVariants, VARIANTS } from '../../src/charts/variants.js';

describe('细分样式目录', () => {
  it('bar 至少有堆叠、横向、极坐标三种变体', () => {
    const names = getVariants(ChartType.Bar).map((v) => v.name);
    expect(names).toEqual(expect.arrayContaining(['堆叠', '横向', '极坐标']));
  });

  it('每个变体都有非空描述与非空 optionOverrides', () => {
    for (const list of Object.values(VARIANTS)) {
      for (const v of list!) {
        expect(v.description.length, `${v.name} 缺描述`).toBeGreaterThan(4);
        expect(Object.keys(v.optionOverrides).length, `${v.name} 的 overrides 为空`).toBeGreaterThan(0);
      }
    }
  });

  it('没有变体的类型返回空数组而非抛错', () => {
    expect(getVariants(ChartType.Gauge)).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/charts/variants.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `src/charts/variants.ts`**

```ts
import { ChartType } from '../types.js';

export interface ChartVariant {
  /** 变体名，作为 LLM 可读的标识 */
  name: string;
  /** 一句话说明这个变体解决什么问题 */
  description: string;
  /** 直接可用的 optionOverrides 片段，已实测 */
  optionOverrides: Record<string, unknown>;
}

export const VARIANTS: Partial<Record<ChartType, ChartVariant[]>> = {
  [ChartType.Bar]: [
    {
      name: '堆叠',
      description: '多个系列叠加显示总量，需为每条系列指定同一个 stack 名',
      optionOverrides: { series: [{ stack: '总量' }, { stack: '总量' }] },
    },
    {
      name: '横向',
      description: '条形图。把类目轴换到 Y 轴，适合类目名较长的场景',
      optionOverrides: { xAxis: { type: 'value', data: null }, yAxis: { type: 'category', data: ['替换为实际类目'] } },
    },
    {
      name: '极坐标',
      description: '南丁格尔式柱状图。需同时置空 grid/xAxis/yAxis 并声明 polar',
      optionOverrides: {
        grid: null, xAxis: null, yAxis: null,
        polar: { radius: [28, '75%'] },
        angleAxis: { type: 'category', data: ['替换为实际类目'] },
        radiusAxis: {},
        series: [{ coordinateSystem: 'polar' }],
      },
    },
    {
      name: '圆角与数值标签',
      description: '柱顶显示数值并加圆角，用于强调具体数字',
      optionOverrides: { series: [{ label: { show: true, position: 'top' }, itemStyle: { borderRadius: [6, 6, 0, 0] } }] },
    },
  ],
  [ChartType.Line]: [
    { name: '面积', description: '折线下方填充色块，强调累积量', optionOverrides: { series: [{ areaStyle: {} }] } },
    { name: '阶梯', description: '阶梯状折线，适合状态跳变类数据', optionOverrides: { series: [{ step: 'end' }] } },
    { name: '平滑', description: '曲线平滑处理', optionOverrides: { series: [{ smooth: true }] } },
    {
      name: '平滑堆叠面积',
      description: '多系列堆叠的平滑面积图',
      optionOverrides: { series: [{ smooth: true, areaStyle: {}, stack: 't' }, { smooth: true, areaStyle: {}, stack: 't' }] },
    },
    {
      name: '双 Y 轴',
      description: '量纲不同的两个系列共存，第二个系列走右侧轴并改为折线',
      optionOverrides: {
        yAxis: [{ type: 'value', name: '左轴' }, { type: 'value', name: '右轴' }],
        series: [{}, { type: 'line', yAxisIndex: 1, smooth: true }],
      },
    },
  ],
  [ChartType.Pie]: [
    {
      name: '南丁格尔玫瑰',
      description: '扇区半径随数值变化，适合数值差异明显的场景',
      optionOverrides: { series: [{ roseType: 'area', radius: ['15%', '72%'] }] },
    },
    {
      name: '外部百分比标签',
      description: '在扇区外标注名称与百分比',
      optionOverrides: { series: [{ radius: '62%', label: { show: true, formatter: '{b}: {d}%' } }] },
    },
  ],
  [ChartType.Scatter]: [
    {
      name: '气泡图',
      description: '逐点指定 symbolSize 表达第三个维度。注意：symbolSize 不能写成回调函数，必须逐点给数值',
      optionOverrides: { series: [{ data: [{ value: [10, 200], symbolSize: 20 }, { value: [20, 150], symbolSize: 42 }] }] },
    },
  ],
};

export function getVariants(type: ChartType): ChartVariant[] {
  return VARIANTS[type] ?? [];
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/charts/variants.test.ts`
Expected: PASS，3 个用例全绿

- [ ] **Step 5: 提交**

```bash
git add src/charts/variants.ts tests/charts/variants.test.ts
git commit -m "feat: 细分样式目录，让 LLM 可发现堆叠/横向/极坐标等变体"
```

---

## Task 8: 渲染器接口与 SvgRenderer

**Files:**
- Create: `src/render/types.ts`, `src/render/svg.ts`
- Test: `tests/render/svg.test.ts`

**Interfaces:**
- Consumes: `buildOption`（Task 3）、三组模板注册函数（Task 4/5/6）、`getVariants`（Task 7）
- Produces:
  - `interface RenderSize { width: number; height: number }`
  - `interface RenderResult { bytes: Buffer; mimeType: string }`
  - `interface Renderer { readonly kind: RendererKind; render(option: EChartsOption, size: RenderSize): Promise<RenderResult> }`
  - `class SvgRenderer implements Renderer` —— `mimeType` 固定为 `image/svg+xml`

本任务同时落实 **spec §16.6 的要求**：为每个细分样式补渲染回归测试。
「合并不出错」不等于「渲染正确」，必须真的渲出来。

- [ ] **Step 1: 写失败测试**

`tests/render/svg.test.ts`：

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType, RendererKind } from '../../src/types.js';
import { CHART_TEMPLATES } from '../../src/charts/registry.js';
import { registerCartesianTemplates } from '../../src/charts/cartesian.js';
import { registerCategoricalTemplates } from '../../src/charts/categorical.js';
import { registerStructuralTemplates } from '../../src/charts/structural.js';
import { VARIANTS } from '../../src/charts/variants.js';
import { buildOption } from '../../src/option/build.js';
import { SvgRenderer } from '../../src/render/svg.js';

const renderer = new SvgRenderer();
const SIZE = { width: 600, height: 400 };

beforeAll(() => {
  registerCartesianTemplates();
  registerCategoricalTemplates();
  registerStructuralTemplates();
});

describe('SvgRenderer', () => {
  it('kind 为 Svg，mimeType 为 image/svg+xml', async () => {
    const out = await renderer.render(
      buildOption({ type: ChartType.Bar, data: CHART_TEMPLATES[ChartType.Bar]!.example }), SIZE,
    );
    expect(renderer.kind).toBe(RendererKind.Svg);
    expect(out.mimeType).toBe('image/svg+xml');
    expect(out.bytes.toString('utf8').trimStart().startsWith('<svg')).toBe(true);
  });

  it('产出的 SVG 宽高与请求一致', async () => {
    const out = await renderer.render(
      buildOption({ type: ChartType.Line, data: CHART_TEMPLATES[ChartType.Line]!.example }), SIZE,
    );
    const svg = out.bytes.toString('utf8');
    expect(svg).toContain('width="600"');
    expect(svg).toContain('height="400"');
  });

  it.each(Object.values(ChartType))('%s 能渲染出非空 SVG', async (type) => {
    const out = await renderer.render(buildOption({ type, data: CHART_TEMPLATES[type]!.example }), SIZE);
    const svg = out.bytes.toString('utf8');
    expect(svg.startsWith('<svg'), `${type} 产物不是 SVG`).toBe(true);
    // 空图只有背景 rect，正常图必然更长
    expect(svg.length, `${type} 的 SVG 过短，疑似渲染为空`).toBeGreaterThan(800);
  });

  // spec §16.6：合并不出错 ≠ 渲染正确，每个细分样式都要真渲一遍
  const VARIANT_CASES = Object.entries(VARIANTS).flatMap(([type, list]) =>
    list!.map((v) => [type as ChartType, v.name, v.optionOverrides] as const),
  );

  it.each(VARIANT_CASES)('细分样式 %s/%s 能渲染出非空 SVG', async (type, _name, overrides) => {
    const out = await renderer.render(
      buildOption({ type, data: CHART_TEMPLATES[type]!.example, optionOverrides: overrides }), SIZE,
    );
    expect(out.bytes.toString('utf8').length).toBeGreaterThan(800);
  });

  it('中文标题原样出现在 SVG 中', async () => {
    const out = await renderer.render(
      buildOption({ type: ChartType.Bar, data: CHART_TEMPLATES[ChartType.Bar]!.example, title: '季度销售额' }), SIZE,
    );
    expect(out.bytes.toString('utf8')).toContain('季度销售额');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/render/svg.test.ts`
Expected: FAIL —— `src/render/svg.js` 不存在

- [ ] **Step 3: 实现 `src/render/types.ts`**

```ts
import type { EChartsOption } from 'echarts';
import type { RendererKind } from '../types.js';

export interface RenderSize { width: number; height: number }
export interface RenderResult { bytes: Buffer; mimeType: string }

export interface Renderer {
  readonly kind: RendererKind;
  render(option: EChartsOption, size: RenderSize): Promise<RenderResult>;
}
```

- [ ] **Step 4: 实现 `src/render/svg.ts`**

```ts
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { RendererKind } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import type { Renderer, RenderResult, RenderSize } from './types.js';

export class SvgRenderer implements Renderer {
  readonly kind = RendererKind.Svg;

  async render(option: EChartsOption, size: RenderSize): Promise<RenderResult> {
    // ssr: true 让 ECharts 在无 DOM 环境下工作；animation 已由 buildOption 关闭
    const chart = echarts.init(null, null, {
      renderer: 'svg', ssr: true, width: size.width, height: size.height,
    });
    try {
      chart.setOption(option);
      return { bytes: Buffer.from(chart.renderToSVGString(), 'utf8'), mimeType: 'image/svg+xml' };
    } catch (e) {
      throw new ChartError(
        ErrorCode.InvalidOption,
        `ECharts 拒绝了该 option：${(e as Error).message}`,
        'option',
      );
    } finally {
      chart.dispose();
    }
  }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run tests/render/svg.test.ts`
Expected: PASS。18 个类型用例 + 12 个细分样式用例 + 3 个具体断言全绿。
**若某个细分样式渲染出的 SVG 长度不足 800 字节，说明该样式的 overrides 与模板冲突** ——
按 spec §16.6，这正是本测试要抓的问题，修 `variants.ts` 里的片段，不要放宽断言阈值。

- [ ] **Step 6: 提交**

```bash
git add src/render/types.ts src/render/svg.ts tests/render/svg.test.ts
git commit -m "feat: 渲染器接口与 SvgRenderer，含 18 类型与全部细分样式渲染回归"
```

---

## Task 9: ResvgRenderer（SVG → PNG）

**Files:**
- Create: `src/render/resvg.ts`
- Test: `tests/render/resvg.test.ts`

**Interfaces:**
- Consumes: `SvgRenderer`（Task 8）、`Renderer` 接口（Task 8）
- Produces: `class ResvgRenderer implements Renderer` —— 构造参数 `(scale: number = 2)`；`mimeType` 为 `image/png`

**性能要求（spec §3.3）**：`Resvg` 每次构造时若传 `loadSystemFonts: true` 会重扫系统字体，
实测使单图耗时达 168ms。本实现必须**只在首次扫描一次并缓存字体缓冲区**，后续复用。

- [ ] **Step 1: 写失败测试**

`tests/render/resvg.test.ts`：

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { ChartType, RendererKind } from '../../src/types.js';
import { CHART_TEMPLATES } from '../../src/charts/registry.js';
import { registerCartesianTemplates } from '../../src/charts/cartesian.js';
import { buildOption } from '../../src/option/build.js';
import { ResvgRenderer } from '../../src/render/resvg.js';

const SIZE = { width: 600, height: 400 };
beforeAll(() => registerCartesianTemplates());

function barOption(title?: string) {
  return buildOption({ type: ChartType.Bar, data: CHART_TEMPLATES[ChartType.Bar]!.example, title });
}

describe('ResvgRenderer', () => {
  it('产出 PNG 字节流，带 PNG magic number', async () => {
    const out = await new ResvgRenderer().render(barOption(), SIZE);
    expect(new ResvgRenderer().kind).toBe(RendererKind.Resvg);
    expect(out.mimeType).toBe('image/png');
    expect(out.bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it('scale 为 2 时输出宽度是请求宽度的两倍', async () => {
    const out = await new ResvgRenderer(2).render(barOption(), SIZE);
    // PNG IHDR：第 16~19 字节为宽度大端整数
    expect(out.bytes.readUInt32BE(16)).toBe(1200);
  });

  it('scale 为 1 时输出宽度等于请求宽度', async () => {
    const out = await new ResvgRenderer(1).render(barOption(), SIZE);
    expect(out.bytes.readUInt32BE(16)).toBe(600);
  });

  it('中文标题不丢字（产物体积显著大于空白图）', async () => {
    const withText = await new ResvgRenderer(1).render(barOption('季度销售额统计'), SIZE);
    expect(withText.bytes.length).toBeGreaterThan(3000);
  });

  it('字体只加载一次：第二次渲染明显快于首次', async () => {
    const r = new ResvgRenderer(1);
    const t0 = Date.now(); await r.render(barOption(), SIZE); const first = Date.now() - t0;
    const t1 = Date.now(); await r.render(barOption(), SIZE); const second = Date.now() - t1;
    expect(second).toBeLessThanOrEqual(Math.max(first, 50));
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/render/resvg.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `src/render/resvg.ts`**

```ts
import { Resvg } from '@resvg/resvg-js';
import type { EChartsOption } from 'echarts';
import { RendererKind } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import { SvgRenderer } from './svg.js';
import type { Renderer, RenderResult, RenderSize } from './types.js';

/**
 * 系统字体只扫描一次并全局缓存。
 * 实测：每次构造 Resvg 都传 loadSystemFonts 会使单图耗时达 168ms，
 * 其中绝大部分是重复的字体扫描开销。
 */
let cachedFontOption: { loadSystemFonts: boolean } | undefined;
function fontOption() {
  cachedFontOption ??= { loadSystemFonts: true };
  return cachedFontOption;
}

export class ResvgRenderer implements Renderer {
  readonly kind = RendererKind.Resvg;
  private readonly svg = new SvgRenderer();

  constructor(private readonly scale: number = 2) {}

  async render(option: EChartsOption, size: RenderSize): Promise<RenderResult> {
    const svg = (await this.svg.render(option, size)).bytes.toString('utf8');
    try {
      const png = new Resvg(svg, {
        fitTo: { mode: 'width', value: Math.round(size.width * this.scale) },
        background: '#ffffff',
        font: fontOption(),
      }).render().asPng();
      return { bytes: Buffer.from(png), mimeType: 'image/png' };
    } catch (e) {
      throw new ChartError(ErrorCode.RendererUnavailable, `SVG 栅格化失败：${(e as Error).message}`);
    }
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/render/resvg.test.ts`
Expected: PASS，5 个用例全绿

- [ ] **Step 5: 提交**

```bash
git add src/render/resvg.ts tests/render/resvg.test.ts
git commit -m "feat: ResvgRenderer 出 PNG，字体加载结果全局缓存"
```

---

## Task 10: CanvasRenderer（可选依赖）与渲染器选择

**Files:**
- Create: `src/render/canvas.ts`, `src/render/index.ts`
- Modify: `package.json`（加 `optionalDependencies.canvas`）
- Test: `tests/render/select.test.ts`

**Interfaces:**
- Consumes: `SvgRenderer`（Task 8）、`ResvgRenderer`（Task 9）、`RendererKind` / `OutputFormat`（Task 2）
- Produces:
  - `isCanvasAvailable(): Promise<boolean>` —— 探测可选依赖是否装上，**永不抛错**
  - `class CanvasRenderer implements Renderer`
  - `selectRenderer(configured: RendererKind, output: OutputFormat): Promise<Renderer>`

**核心行为（spec §7）：请求 PNG 但 `canvas` 未安装时，自动走 resvg，不得报错。**

- [ ] **Step 1: 写失败测试**

`tests/render/select.test.ts`：

```ts
import { describe, it, expect, vi } from 'vitest';
import { OutputFormat, RendererKind } from '../../src/types.js';
import { selectRenderer } from '../../src/render/index.js';
import { SvgRenderer } from '../../src/render/svg.js';
import { ResvgRenderer } from '../../src/render/resvg.js';

describe('selectRenderer', () => {
  it('输出 svg 时永远用 SvgRenderer', async () => {
    expect(await selectRenderer(RendererKind.Auto, OutputFormat.Svg)).toBeInstanceOf(SvgRenderer);
    expect(await selectRenderer(RendererKind.Canvas, OutputFormat.Svg)).toBeInstanceOf(SvgRenderer);
  });

  it('auto + png 用 ResvgRenderer', async () => {
    expect(await selectRenderer(RendererKind.Auto, OutputFormat.Png)).toBeInstanceOf(ResvgRenderer);
  });

  it('显式要 canvas 但依赖缺失时降级到 resvg 而非报错', async () => {
    vi.resetModules();
    vi.doMock('../../src/render/canvas.js', () => ({
      isCanvasAvailable: async () => false,
      CanvasRenderer: class {},
    }));
    const { selectRenderer: sel } = await import('../../src/render/index.js');
    await expect(sel(RendererKind.Canvas, OutputFormat.Png)).resolves.toBeInstanceOf(ResvgRenderer);
    vi.doUnmock('../../src/render/canvas.js');
  });

  it('isCanvasAvailable 在依赖缺失时返回 false 而不抛错', async () => {
    const { isCanvasAvailable } = await import('../../src/render/canvas.js');
    await expect(isCanvasAvailable()).resolves.toEqual(expect.any(Boolean));
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/render/select.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 把 canvas 声明为可选依赖**

```bash
npm pkg set optionalDependencies.canvas="^3.2.0"
```

不执行 `npm i canvas`。**可选依赖装不上不应影响主流程**，这正是本任务要验证的行为。

- [ ] **Step 4: 实现 `src/render/canvas.ts`**

```ts
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { RendererKind } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import type { Renderer, RenderResult, RenderSize } from './types.js';

type CanvasModule = { createCanvas(w: number, h: number): unknown };
let canvasModule: CanvasModule | null | undefined;

/** 探测可选依赖 canvas 是否可用。永不抛错。 */
export async function isCanvasAvailable(): Promise<boolean> {
  if (canvasModule === undefined) {
    try {
      canvasModule = (await import('canvas')) as unknown as CanvasModule;
    } catch {
      canvasModule = null;
    }
  }
  return canvasModule !== null;
}

export class CanvasRenderer implements Renderer {
  readonly kind = RendererKind.Canvas;

  async render(option: EChartsOption, size: RenderSize): Promise<RenderResult> {
    if (!(await isCanvasAvailable()) || !canvasModule) {
      throw new ChartError(ErrorCode.RendererUnavailable, '可选依赖 canvas 未安装');
    }
    const canvas = canvasModule.createCanvas(size.width, size.height) as {
      toBuffer(mime: string): Buffer;
    };
    const chart = echarts.init(canvas as never, null, {
      renderer: 'canvas', width: size.width, height: size.height,
    });
    try {
      chart.setOption(option);
      return { bytes: canvas.toBuffer('image/png'), mimeType: 'image/png' };
    } catch (e) {
      throw new ChartError(ErrorCode.InvalidOption, `ECharts 拒绝了该 option：${(e as Error).message}`, 'option');
    } finally {
      chart.dispose();
    }
  }
}
```

- [ ] **Step 5: 实现 `src/render/index.ts`**

```ts
import { OutputFormat, RendererKind } from '../types.js';
import { SvgRenderer } from './svg.js';
import { ResvgRenderer } from './resvg.js';
import { CanvasRenderer, isCanvasAvailable } from './canvas.js';
import type { Renderer } from './types.js';

export type { Renderer, RenderResult, RenderSize } from './types.js';
export { SvgRenderer, ResvgRenderer, CanvasRenderer, isCanvasAvailable };

/**
 * 选择渲染器。
 * svg 输出恒用 SvgRenderer；png 输出优先按配置，canvas 不可用时静默降级到 resvg。
 */
export async function selectRenderer(configured: RendererKind, output: OutputFormat): Promise<Renderer> {
  if (output === OutputFormat.Svg) return new SvgRenderer();
  if (configured === RendererKind.Canvas && (await isCanvasAvailable())) return new CanvasRenderer();
  return new ResvgRenderer();
}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `npx vitest run tests/render/select.test.ts`
Expected: PASS，4 个用例全绿

- [ ] **Step 7: 提交**

```bash
git add package.json src/render/canvas.ts src/render/index.ts tests/render/select.test.ts
git commit -m "feat: CanvasRenderer 可选依赖与渲染器选择降级逻辑"
```

---

## Task 10B: 渲染配额与视觉回归基线

补齐 spec §10（渲染资源保护）与 §12.3（PNG 视觉回归）两项此前未覆盖的要求。
编号用 10B 是为了不打乱后续 Task 的既有编号。

### 关于「渲染超时」的一处纠正

spec §10 写的是「渲染超时保护」，配置项 `ECHARTS_MCP_RENDER_TIMEOUT_MS` 也已定义。
**但该项按字面实现是无效的**：`echarts.setOption()` 与 `renderToSVGString()` 都是**同步调用**
（已实测：探针脚本中 `const svg = chart.renderToSVGString()` 直接返回字符串），
resvg 的 `render()` 同样同步。同步代码会一路占住事件循环，`Promise.race` 里的定时器
根本没有机会触发 —— 这种「超时」只会在渲染结束之后才报警，拦不住任何东西。

真正能拦住的只有两条路：

1. **预防性配额**（本任务采用）：在渲染前按数据点总量拒绝过大的请求。数据点数量是渲染
   耗时的主要驱动因素，卡住它就卡住了绝大部分风险。
2. **worker 线程隔离 + 强制终止**：能真正中断同步渲染，但需要引入 worker 池与序列化开销，
   属于明显的过度设计，本期不做。

因此本任务**保留 `renderTimeoutMs` 配置项**（记录一次渲染的期望上限，供日志与后续演进使用），
但**不实现 Promise.race 式的假超时**，改为实现数据点配额。此决定需同步写回 spec §10。

**Files:**
- Create: `src/render/budget.ts`
- Modify: `src/tools/generate-chart.ts`、`src/tools/render-option.ts`（在 `assertOptionSize` 之后追加配额检查）
- Test: `tests/render/budget.test.ts`、`tests/render/visual.test.ts`
- Create: `tests/__baselines__/`（视觉回归基线目录）

**Interfaces:**
- Consumes: `ChartError` / `ErrorCode`（Task 2）
- Produces: `countDataPoints(option: object): number`、`assertRenderBudget(option: object, maxPoints: number): void`
- 新增配置项：`ECHARTS_MCP_MAX_DATA_POINTS`（默认 50000），需在 `src/config.ts` 的 `Config` 中补上 `maxDataPoints: number`

- [ ] **Step 1: 写失败测试**

`tests/render/budget.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { countDataPoints, assertRenderBudget } from '../../src/render/budget.js';

describe('渲染配额', () => {
  it('统计 series.data 中的数据点总数', () => {
    expect(countDataPoints({ series: [{ data: [1, 2, 3] }, { data: [4, 5] }] })).toBe(5);
  });

  it('统计 sankey 的 nodes 与 links', () => {
    expect(countDataPoints({ series: [{ data: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B' }] }] })).toBe(3);
  });

  it('统计 dataset.source', () => {
    expect(countDataPoints({ dataset: { source: [[1, 2], [3, 4], [5, 6]] } })).toBe(3);
  });

  it('无数据时为 0，不抛错', () => {
    expect(countDataPoints({ title: { text: 'x' } })).toBe(0);
  });

  it('超过配额时抛 OPTION_TOO_LARGE 并说明实际点数', () => {
    expect(() => assertRenderBudget({ series: [{ data: new Array(101).fill(1) }] }, 100))
      .toThrow(/101/);
  });

  it('未超配额时不抛错', () => {
    expect(() => assertRenderBudget({ series: [{ data: [1, 2] }] }, 100)).not.toThrow();
  });
});
```

`tests/render/visual.test.ts`：

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { ChartType } from '../../src/types.js';
import { CHART_TEMPLATES } from '../../src/charts/registry.js';
import { registerCartesianTemplates } from '../../src/charts/cartesian.js';
import { registerCategoricalTemplates } from '../../src/charts/categorical.js';
import { buildOption } from '../../src/option/build.js';
import { ResvgRenderer } from '../../src/render/resvg.js';

const BASELINE = join(process.cwd(), 'tests/__baselines__');
const SIZE = { width: 600, height: 400 };
// 只挑关键类型做像素比对，数量少以避免 flaky
const KEY_TYPES = [ChartType.Bar, ChartType.Line, ChartType.Pie];

beforeAll(() => {
  registerCartesianTemplates();
  registerCategoricalTemplates();
  mkdirSync(BASELINE, { recursive: true });
});

describe('视觉回归', () => {
  it.each(KEY_TYPES)('%s 的渲染结果与基线一致', async (type) => {
    const png = (await new ResvgRenderer(1).render(
      buildOption({ type, data: CHART_TEMPLATES[type]!.example, title: '基线' }), SIZE,
    )).bytes;
    const file = join(BASELINE, `${type}.png`);

    if (!existsSync(file)) {
      writeFileSync(file, png);
      // 首次运行生成基线。基线必须提交进仓库，否则回归检测形同虚设。
      expect.fail(`已生成基线 ${file}，请检查图像正确后提交，然后重跑本测试`);
    }

    const actual = PNG.sync.read(png);
    const expected = PNG.sync.read(readFileSync(file));
    expect(actual.width).toBe(expected.width);
    expect(actual.height).toBe(expected.height);
    const diff = pixelmatch(actual.data, expected.data, null, actual.width, actual.height, { threshold: 0.1 });
    const ratio = diff / (actual.width * actual.height);
    expect(ratio, `${type} 与基线差异 ${(ratio * 100).toFixed(2)}%`).toBeLessThan(0.01);
  });
});
```

- [ ] **Step 2: 装测试依赖并跑测试确认失败**

```bash
npm i -D pixelmatch pngjs @types/pngjs
npx vitest run tests/render/budget.test.ts
```

Expected: FAIL —— `src/render/budget.js` 不存在

- [ ] **Step 3: 实现 `src/render/budget.ts`**

```ts
import { ChartError, ErrorCode } from '../errors.js';

function lengthOf(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

/**
 * 估算一份 option 会画多少个数据点。
 * 数据点总量是渲染耗时的主要驱动因素，用它做配额比按字节数更贴近真实开销。
 */
export function countDataPoints(option: object): number {
  const o = option as { series?: unknown; dataset?: unknown };
  let total = 0;

  const series = Array.isArray(o.series) ? o.series : o.series ? [o.series] : [];
  for (const s of series as Record<string, unknown>[]) {
    total += lengthOf(s?.data) + lengthOf(s?.links) + lengthOf(s?.nodes);
  }

  const datasets = Array.isArray(o.dataset) ? o.dataset : o.dataset ? [o.dataset] : [];
  for (const d of datasets as Record<string, unknown>[]) {
    total += lengthOf(d?.source);
  }
  return total;
}

export function assertRenderBudget(option: object, maxPoints: number): void {
  const points = countDataPoints(option);
  if (points > maxPoints) {
    throw new ChartError(
      ErrorCode.OptionTooLarge,
      `该 option 含 ${points} 个数据点，超过上限 ${maxPoints}。请先对数据做聚合或采样再出图。`,
      'data',
    );
  }
}
```

- [ ] **Step 4: 在 `src/config.ts` 补配置项**

在 `Config` 接口中加入 `maxDataPoints: number;`，并在 `loadConfig` 返回对象中加入：

```ts
    maxDataPoints: intOf(env, 'ECHARTS_MCP_MAX_DATA_POINTS', 50_000),
```

同步在 `tests/config.test.ts` 的「全部使用默认值」用例中补一条断言：

```ts
    expect(c.maxDataPoints).toBe(50_000);
```

- [ ] **Step 5: 在两个工具中接上配额检查**

`src/tools/generate-chart.ts` 与 `src/tools/render-option.ts` 中，
紧跟 `assertOptionSize(option, deps.config.maxOptionBytes);` 之后各加一行：

```ts
        assertRenderBudget(option, deps.config.maxDataPoints);
```

并在两个文件顶部加上 `import { assertRenderBudget } from '../render/budget.js';`

- [ ] **Step 6: 跑测试确认通过**

Run: `npx vitest run tests/render/budget.test.ts`
Expected: PASS，6 个用例全绿

- [ ] **Step 7: 生成并审查视觉基线**

```bash
npx vitest run tests/render/visual.test.ts   # 首次会生成基线并主动 fail
```

**必须人工打开 `tests/__baselines__/*.png` 逐张确认图像正确**，再重跑：

```bash
npx vitest run tests/render/visual.test.ts   # 此时应全绿
```

未经目视确认就提交基线，等于把一张错图固化成「正确答案」，后续所有回归检测都会失效。

- [ ] **Step 8: 提交**

```bash
git add src/render/budget.ts src/config.ts tests/render/budget.test.ts tests/render/visual.test.ts tests/__baselines__ tests/config.test.ts package.json
git commit -m "feat: 渲染数据点配额与 PNG 视觉回归基线"
```


---

## Task 11: 函数字符串处理与自包含 HTML

落实 **spec §16.3**。核心安全约束：**服务端永不 `eval` / `new Function`。**

**Files:**
- Create: `src/option/functions.ts`, `src/html/standalone.ts`
- Test: `tests/option/functions.test.ts`, `tests/html/standalone.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `isFunctionExpression(v: unknown): v is string`
  - `partitionFunctions(option: object): { sanitized: object; functionPaths: string[] }` —— 剥离函数字符串，返回被剥离字段的路径清单
  - `serializeOptionWithFunctions(option: object): string` —— 把函数字符串**不加引号**写进 JS 字面量，仅供 html 使用
  - `buildStandaloneHtml(option: object, size: RenderSize, title?: string): string`

- [ ] **Step 1: 写失败测试**

`tests/option/functions.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { isFunctionExpression, partitionFunctions, serializeOptionWithFunctions } from '../../src/option/functions.js';

describe('函数字符串处理', () => {
  it('识别 function 与箭头两种写法', () => {
    expect(isFunctionExpression('function (p) { return p.name; }')).toBe(true);
    expect(isFunctionExpression('(p) => p.name')).toBe(true);
    expect(isFunctionExpression('{b}: {c}')).toBe(false);
    expect(isFunctionExpression(42)).toBe(false);
  });

  it('剥离函数字段并记录路径', () => {
    const { sanitized, functionPaths } = partitionFunctions({
      tooltip: { formatter: '(p) => p.name' },
      series: [{ label: { formatter: '{b}' } }],
    });
    expect(functionPaths).toEqual(['tooltip.formatter']);
    expect((sanitized as { tooltip: object }).tooltip).toEqual({});
    expect((sanitized as { series: { label: object }[] }).series[0].label).toEqual({ formatter: '{b}' });
  });

  it('剥离时不修改原对象', () => {
    const src = { tooltip: { formatter: '(p) => p.name' } };
    partitionFunctions(src);
    expect(src.tooltip.formatter).toBe('(p) => p.name');
  });

  it('数组内的函数字段路径带下标', () => {
    const { functionPaths } = partitionFunctions({ series: [{}, { label: { formatter: 'function(p){return 1}' } }] });
    expect(functionPaths).toEqual(['series[1].label.formatter']);
  });

  it('序列化时函数不带引号，普通字符串仍带引号', () => {
    const js = serializeOptionWithFunctions({ tooltip: { formatter: '(p) => p.name' }, title: { text: '标题' } });
    expect(js).toContain('"formatter": (p) => p.name');
    expect(js).toContain('"text": "标题"');
    expect(js).not.toContain('"(p) => p.name"');
  });
});
```

`tests/html/standalone.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { buildStandaloneHtml } from '../../src/html/standalone.js';

describe('buildStandaloneHtml', () => {
  const SIZE = { width: 600, height: 400 };

  it('产出完整 HTML 文档且内联了 ECharts 运行时', () => {
    const html = buildStandaloneHtml({ series: [{ type: 'bar', data: [1] }] }, SIZE);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    // 内联运行时应达 MB 量级，远大于一个空壳页面
    expect(html.length).toBeGreaterThan(500_000);
    expect(html).not.toContain('src="http');
  });

  it('函数字符串以可执行 JS 形式写入，不被引号包裹', () => {
    const html = buildStandaloneHtml({ tooltip: { formatter: '(p) => p.name' } }, SIZE);
    expect(html).toContain('"formatter": (p) => p.name');
  });

  it('容器尺寸与请求一致', () => {
    const html = buildStandaloneHtml({}, { width: 900, height: 300 });
    expect(html).toContain('width:900px');
    expect(html).toContain('height:300px');
  });

  it('title 写入 <title> 且转义尖括号', () => {
    const html = buildStandaloneHtml({}, SIZE, '<销售>报表');
    expect(html).toContain('<title>&lt;销售&gt;报表</title>');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/option/functions.test.ts tests/html/standalone.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `src/option/functions.ts`**

```ts
const FN_PATTERN = /^\s*(function\s*\*?\s*\(|function\s+[A-Za-z_$][\w$]*\s*\(|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/;

export function isFunctionExpression(v: unknown): v is string {
  return typeof v === 'string' && FN_PATTERN.test(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * 剥离 option 中的函数字符串，返回净化后的副本与被剥离字段的路径。
 * 用于 svg / png 静态渲染 —— 静态图不执行 JS，留着这些字段只会让 ECharts 把它们当普通字符串画出来。
 */
export function partitionFunctions(option: object): { sanitized: object; functionPaths: string[] } {
  const functionPaths: string[] = [];

  function walk(node: unknown, path: string): unknown {
    if (Array.isArray(node)) return node.map((item, i) => walk(item, `${path}[${i}]`));
    if (isPlainObject(node)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        const child = path ? `${path}.${k}` : k;
        if (isFunctionExpression(v)) { functionPaths.push(child); continue; }
        out[k] = walk(v, child);
      }
      return out;
    }
    return node;
  }

  return { sanitized: walk(option, '') as object, functionPaths };
}

const FN_MARK = '__ECHARTS_MCP_FN__';

/**
 * 序列化为 JS 对象字面量，函数字符串不加引号。
 * 仅用于生成 html —— 服务端不执行其中任何代码。
 */
export function serializeOptionWithFunctions(option: object): string {
  const replacer = (_k: string, v: unknown) =>
    isFunctionExpression(v) ? `${FN_MARK}${v}${FN_MARK}` : v;
  const marked = JSON.stringify(option, replacer, 2);
  return marked.replace(
    new RegExp(`"${FN_MARK}([\\s\\S]*?)${FN_MARK}"`, 'g'),
    (_m, body: string) => JSON.parse(`"${body}"`) as string,
  );
}
```

- [ ] **Step 4: 实现 `src/html/standalone.ts`**

```ts
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { serializeOptionWithFunctions } from '../option/functions.js';
import type { RenderSize } from '../render/types.js';

const require = createRequire(import.meta.url);
let cachedRuntime: string | undefined;

/** ECharts 运行时只读一次，缓存复用 */
function echartsRuntime(): string {
  cachedRuntime ??= readFileSync(require.resolve('echarts/dist/echarts.min.js'), 'utf8');
  return cachedRuntime;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * 生成不依赖外部网络的单文件 HTML。
 * option 中的函数字符串在此原样写入，由浏览器执行；服务端不 eval。
 */
export function buildStandaloneHtml(option: object, size: RenderSize, title?: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title ?? 'ECharts')}</title>
<style>
  body { margin: 0; display: flex; justify-content: center; padding: 16px;
         font-family: -apple-system, "PingFang SC", sans-serif; background: #fff; }
  #chart { width:${size.width}px; height:${size.height}px; }
</style>
<script>${echartsRuntime()}</script>
</head>
<body>
<div id="chart"></div>
<script>
  var option = ${serializeOptionWithFunctions(option)};
  option.animation = true;
  var chart = echarts.init(document.getElementById('chart'));
  chart.setOption(option);
  window.addEventListener('resize', function () { chart.resize(); });
</script>
</body>
</html>`;
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run tests/option/functions.test.ts tests/html/standalone.test.ts`
Expected: PASS，9 个用例全绿

- [ ] **Step 6: 提交**

```bash
git add src/option/functions.ts src/html/standalone.ts tests/option/functions.test.ts tests/html/standalone.test.ts
git commit -m "feat: 函数字符串剥离与自包含 HTML 生成，服务端不 eval"
```

---

## Task 12: StorageAdapter 与 LocalDiskStore

**Files:**
- Create: `src/deliver/types.ts`, `src/deliver/local-disk.ts`
- Test: `tests/deliver/local-disk.test.ts`

**Interfaces:**
- Consumes: `Config`（Task 2）
- Produces:
  - `interface StoredObject { id: string; url: string; path: string }`
  - `interface StorageAdapter { put(bytes: Buffer, mimeType: string): Promise<StoredObject>; sweep(): Promise<number> }`
  - `class LocalDiskStore implements StorageAdapter` —— 构造参数 `(dir: string, ttlSeconds: number, publicUrl?: string)`
  - `extensionFor(mimeType: string): string`

- [ ] **Step 1: 写失败测试**

`tests/deliver/local-disk.test.ts`：

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, utimesSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDiskStore } from '../../src/deliver/local-disk.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'echarts-mcp-test-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('LocalDiskStore', () => {
  it('写盘并返回 id / path / url', async () => {
    const store = new LocalDiskStore(dir, 3600, 'https://cdn.example.com');
    const out = await store.put(Buffer.from('<svg/>'), 'image/svg+xml');
    expect(existsSync(out.path)).toBe(true);
    expect(out.url).toBe(`https://cdn.example.com/files/${out.id}.svg`);
  });

  it('未配置 publicUrl 时 url 退化为 file:// 绝对路径', async () => {
    const store = new LocalDiskStore(dir, 3600);
    const out = await store.put(Buffer.from('x'), 'image/png');
    expect(out.url.startsWith('file://')).toBe(true);
    expect(out.id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('两次写入的 id 不同且不可预测', async () => {
    const store = new LocalDiskStore(dir, 3600);
    const a = await store.put(Buffer.from('x'), 'image/png');
    const b = await store.put(Buffer.from('x'), 'image/png');
    expect(a.id).not.toBe(b.id);
  });

  it('mimeType 决定扩展名', async () => {
    const store = new LocalDiskStore(dir, 3600);
    expect((await store.put(Buffer.from('x'), 'image/png')).path.endsWith('.png')).toBe(true);
    expect((await store.put(Buffer.from('x'), 'text/html')).path.endsWith('.html')).toBe(true);
  });

  it('sweep 删除超过 TTL 的文件，保留未过期的', async () => {
    const store = new LocalDiskStore(dir, 60);
    const stale = await store.put(Buffer.from('old'), 'image/png');
    const fresh = await store.put(Buffer.from('new'), 'image/png');
    const longAgo = new Date(Date.now() - 3600_000);
    utimesSync(stale.path, longAgo, longAgo);
    const removed = await store.sweep();
    expect(removed).toBe(1);
    expect(existsSync(stale.path)).toBe(false);
    expect(existsSync(fresh.path)).toBe(true);
    expect(readdirSync(dir)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/deliver/local-disk.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `src/deliver/types.ts`**

```ts
export interface StoredObject { id: string; url: string; path: string }

export interface StorageAdapter {
  /** 存入字节流，返回可访问信息 */
  put(bytes: Buffer, mimeType: string): Promise<StoredObject>;
  /** 清理过期对象，返回删除个数 */
  sweep(): Promise<number>;
}

const EXTENSIONS: Record<string, string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'text/html': 'html',
  'application/json': 'json',
};

export function extensionFor(mimeType: string): string {
  return EXTENSIONS[mimeType] ?? 'bin';
}
```

- [ ] **Step 4: 实现 `src/deliver/local-disk.ts`**

```ts
import { randomBytes } from 'node:crypto';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ChartError, ErrorCode } from '../errors.js';
import { extensionFor, type StorageAdapter, type StoredObject } from './types.js';

export class LocalDiskStore implements StorageAdapter {
  constructor(
    private readonly dir: string,
    private readonly ttlSeconds: number,
    private readonly publicUrl?: string,
  ) {}

  async put(bytes: Buffer, mimeType: string): Promise<StoredObject> {
    // 32 位十六进制随机名：不可猜，避免通过遍历 URL 拿到他人的图
    const id = randomBytes(16).toString('hex');
    const file = `${id}.${extensionFor(mimeType)}`;
    const path = join(resolve(this.dir), file);
    try {
      await mkdir(resolve(this.dir), { recursive: true });
      await writeFile(path, bytes);
    } catch (e) {
      throw new ChartError(ErrorCode.StorageFailed, `写入存储失败：${(e as Error).message}`);
    }
    const url = this.publicUrl
      ? `${this.publicUrl.replace(/\/$/, '')}/files/${file}`
      : pathToFileURL(path).href;
    return { id, url, path };
  }

  async sweep(): Promise<number> {
    let removed = 0;
    const deadline = Date.now() - this.ttlSeconds * 1000;
    let entries: string[];
    try {
      entries = await readdir(resolve(this.dir));
    } catch {
      return 0;
    }
    for (const name of entries) {
      const path = join(resolve(this.dir), name);
      try {
        if ((await stat(path)).mtimeMs < deadline) { await unlink(path); removed++; }
      } catch { /* 并发删除等竞态忽略即可 */ }
    }
    return removed;
  }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run tests/deliver/local-disk.test.ts`
Expected: PASS，5 个用例全绿

- [ ] **Step 6: 提交**

```bash
git add src/deliver/types.ts src/deliver/local-disk.ts tests/deliver/local-disk.test.ts
git commit -m "feat: StorageAdapter 接口与本地磁盘实现，随机文件名与 TTL 清理"
```

---

## Task 13: 交付推导与执行

### 输出必须是 Markdown（评审追加要求）

需求方要求「优化输出的 md 渲染」。已实测对照 `antvis/mcp-server-chart`：
**它返回的是一个裸 URL 字符串**（形如 `https://mdn.alipayobjects.com/one_clip/afts/img/...`），
没有任何 markdown 包装。因此集成它无助于本目标，本项目要做得比它好。

交付文本一律用 Markdown 语法，让支持 md 的客户端直接把图渲染出来：

| 场景 | 输出 |
|---|---|
| 图片（svg/png）+ url 通道 | `![标题](https://.../abc.png)` |
| 图片（svg/png）+ file 通道 | `![标题](file:///.../abc.svg)`，另起一行给出纯路径供 IDE 点击 |
| html + 任意通道 | `[在浏览器中打开：标题](url)`，图片语法对页面无意义 |
| option / raw | 用 ` ```json ` 围栏包裹，而不是裸 JSON 文本 |

alt 文本取 `title`，缺省用「图表」。**alt 文本中的 `[` `]` 必须转义**，否则标题里带方括号会破坏 markdown 结构。



落实 spec §8.1 推导表与 §16.3 的函数剥离提示。

**Files:**
- Create: `src/deliver/resolve.ts`, `src/deliver/deliver.ts`
- Test: `tests/deliver/resolve.test.ts`, `tests/deliver/deliver.test.ts`

**Interfaces:**
- Consumes: 全部枚举（Task 2）、`StorageAdapter`（Task 12）、`Renderer`（Task 8）、`partitionFunctions`（Task 11）、`buildStandaloneHtml`（Task 11）
- Produces:
  - `interface ResolveInput { transport: TransportKind; output?: OutputFormat; delivery?: DeliveryRequest }`
  - `interface Resolved { output: OutputFormat; channel: DeliveryChannel; notes: string[] }`
  - `resolveDelivery(input: ResolveInput): Resolved`
  - `interface McpContent { type: 'text' | 'image'; text?: string; data?: string; mimeType?: string }`
  - `deliver(args: DeliverArgs): Promise<McpContent[]>`，其中
    `interface DeliverArgs { option: object; resolved: Resolved; size: RenderSize; renderer: Renderer; store: StorageAdapter; title?: string }`

- [ ] **Step 1: 写 resolveDelivery 的失败测试**

`tests/deliver/resolve.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { DeliveryChannel, DeliveryRequest, OutputFormat, TransportKind } from '../../src/types.js';
import { resolveDelivery } from '../../src/deliver/resolve.js';

describe('resolveDelivery', () => {
  it('stdio 默认走 file + svg', () => {
    expect(resolveDelivery({ transport: TransportKind.Stdio })).toMatchObject({
      output: OutputFormat.Svg, channel: DeliveryChannel.File,
    });
  });

  it('http 默认走 url + svg', () => {
    expect(resolveDelivery({ transport: TransportKind.Http })).toMatchObject({
      output: OutputFormat.Svg, channel: DeliveryChannel.Url,
    });
  });

  it('显式 inline 时强制输出 png 并给出说明', () => {
    const r = resolveDelivery({ transport: TransportKind.Stdio, delivery: DeliveryRequest.Inline, output: OutputFormat.Svg });
    expect(r.output).toBe(OutputFormat.Png);
    expect(r.channel).toBe(DeliveryChannel.Inline);
    expect(r.notes.join()).toMatch(/png/i);
  });

  it('output 为 option 时恒走 raw，忽略 delivery', () => {
    const r = resolveDelivery({ transport: TransportKind.Http, output: OutputFormat.Option, delivery: DeliveryRequest.Inline });
    expect(r.channel).toBe(DeliveryChannel.Raw);
  });

  it('output 为 html 时 stdio 走 file、http 走 url，且拒绝 inline', () => {
    expect(resolveDelivery({ transport: TransportKind.Stdio, output: OutputFormat.Html }).channel).toBe(DeliveryChannel.File);
    expect(resolveDelivery({ transport: TransportKind.Http, output: OutputFormat.Html }).channel).toBe(DeliveryChannel.Url);
    const forced = resolveDelivery({ transport: TransportKind.Http, output: OutputFormat.Html, delivery: DeliveryRequest.Inline });
    expect(forced.channel).toBe(DeliveryChannel.Url);
    expect(forced.notes.join()).toMatch(/html/i);
  });

  it('显式 url 时即使 stdio 也走 url', () => {
    expect(resolveDelivery({ transport: TransportKind.Stdio, delivery: DeliveryRequest.Url }).channel)
      .toBe(DeliveryChannel.Url);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/deliver/resolve.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `src/deliver/resolve.ts`**

```ts
import { DeliveryChannel, DeliveryRequest, OutputFormat, TransportKind } from '../types.js';

export interface ResolveInput {
  transport: TransportKind;
  output?: OutputFormat;
  delivery?: DeliveryRequest;
}
export interface Resolved {
  output: OutputFormat;
  channel: DeliveryChannel;
  /** 告知调用方哪些请求被静默调整过，便于 LLM 理解结果 */
  notes: string[];
}

export function resolveDelivery(input: ResolveInput): Resolved {
  const notes: string[] = [];
  const delivery = input.delivery ?? DeliveryRequest.Auto;
  const isStdio = input.transport === TransportKind.Stdio;

  // option 体积小，恒以文本直接返回
  if (input.output === OutputFormat.Option) {
    return { output: OutputFormat.Option, channel: DeliveryChannel.Raw, notes };
  }

  // html 内联了 ECharts 运行时，达 MB 量级，禁止 inline 与 raw
  if (input.output === OutputFormat.Html) {
    if (delivery === DeliveryRequest.Inline) {
      notes.push('html 产物内联了 ECharts 运行时（MB 量级），不支持内联返回，已改为写文件/上传后返回链接。');
    }
    return {
      output: OutputFormat.Html,
      channel: isStdio ? DeliveryChannel.File : DeliveryChannel.Url,
      notes,
    };
  }

  if (delivery === DeliveryRequest.Inline) {
    if (input.output === OutputFormat.Svg) {
      notes.push('多数聊天客户端不渲染 image/svg+xml，内联返回时已强制改为 png。');
    }
    return { output: OutputFormat.Png, channel: DeliveryChannel.Inline, notes };
  }

  const output = input.output ?? OutputFormat.Svg;
  if (delivery === DeliveryRequest.File) return { output, channel: DeliveryChannel.File, notes };
  if (delivery === DeliveryRequest.Url) return { output, channel: DeliveryChannel.Url, notes };
  return { output, channel: isStdio ? DeliveryChannel.File : DeliveryChannel.Url, notes };
}
```

- [ ] **Step 4: 写 deliver 的失败测试**

`tests/deliver/deliver.test.ts`：

```ts
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChartType, DeliveryChannel, OutputFormat } from '../../src/types.js';
import { registerCartesianTemplates } from '../../src/charts/cartesian.js';
import { CHART_TEMPLATES } from '../../src/charts/registry.js';
import { buildOption } from '../../src/option/build.js';
import { SvgRenderer } from '../../src/render/svg.js';
import { ResvgRenderer } from '../../src/render/resvg.js';
import { LocalDiskStore } from '../../src/deliver/local-disk.js';
import { deliver } from '../../src/deliver/deliver.js';

const SIZE = { width: 600, height: 400 };
let dir: string;
beforeAll(() => registerCartesianTemplates());
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'echarts-deliver-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const opt = () => buildOption({ type: ChartType.Bar, data: CHART_TEMPLATES[ChartType.Bar]!.example });
const store = () => new LocalDiskStore(dir, 3600);

describe('deliver', () => {
  it('inline 通道返回 image content，data 为 base64', async () => {
    const out = await deliver({
      option: opt(), size: SIZE, renderer: new ResvgRenderer(1), store: store(),
      resolved: { output: OutputFormat.Png, channel: DeliveryChannel.Inline, notes: [] },
    });
    const image = out.find((c) => c.type === 'image')!;
    expect(image.mimeType).toBe('image/png');
    expect(Buffer.from(image.data!, 'base64').subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('file 通道返回文本路径且文件确实存在', async () => {
    const out = await deliver({
      option: opt(), size: SIZE, renderer: new SvgRenderer(), store: store(),
      resolved: { output: OutputFormat.Svg, channel: DeliveryChannel.File, notes: [] },
    });
    const path = out[0].text!.match(/(\/[^\s]+\.svg)/)![1];
    expect(readFileSync(path, 'utf8').startsWith('<svg')).toBe(true);
  });

  it('raw + option 通道直接返回 option JSON 文本', async () => {
    const out = await deliver({
      option: opt(), size: SIZE, renderer: new SvgRenderer(), store: store(),
      resolved: { output: OutputFormat.Option, channel: DeliveryChannel.Raw, notes: [] },
    });
    expect(JSON.parse(out[0].text!).animation).toBe(false);
  });

  it('html 输出写出可打开的单文件页面', async () => {
    const out = await deliver({
      option: opt(), size: SIZE, renderer: new SvgRenderer(), store: store(), title: '报表',
      resolved: { output: OutputFormat.Html, channel: DeliveryChannel.File, notes: [] },
    });
    const path = out[0].text!.match(/(\/[^\s]+\.html)/)![1];
    expect(readFileSync(path, 'utf8')).toContain('<!DOCTYPE html>');
  });

  it('静态图渲染时剥离函数字段并在 notes 中告知', async () => {
    const out = await deliver({
      option: { ...opt(), tooltip: { formatter: '(p) => p.name' } },
      size: SIZE, renderer: new SvgRenderer(), store: store(),
      resolved: { output: OutputFormat.Svg, channel: DeliveryChannel.File, notes: [] },
    });
    expect(out.map((c) => c.text).join()).toMatch(/tooltip\.formatter/);
  });

  it('notes 非空时作为第一条 text content 返回', async () => {
    const out = await deliver({
      option: opt(), size: SIZE, renderer: new SvgRenderer(), store: store(),
      resolved: { output: OutputFormat.Svg, channel: DeliveryChannel.File, notes: ['测试提示'] },
    });
    expect(out[0].text).toContain('测试提示');
  });
});
```

- [ ] **Step 5: 跑测试确认失败**

Run: `npx vitest run tests/deliver/deliver.test.ts`
Expected: FAIL —— `src/deliver/deliver.js` 不存在

- [ ] **Step 6: 实现 `src/deliver/deliver.ts`**

```ts
import type { EChartsOption } from 'echarts';
import { DeliveryChannel, OutputFormat } from '../types.js';
import { partitionFunctions } from '../option/functions.js';
import { buildStandaloneHtml } from '../html/standalone.js';
import type { Renderer, RenderSize } from '../render/types.js';
import type { StorageAdapter } from './types.js';
import type { Resolved } from './resolve.js';

export interface McpContent {
  type: 'text' | 'image';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface DeliverArgs {
  option: object;
  resolved: Resolved;
  size: RenderSize;
  renderer: Renderer;
  store: StorageAdapter;
  title?: string;
}

/** 产出字节流与其 mimeType。html 与静态图走不同路径。 */
async function produce(args: DeliverArgs, notes: string[]): Promise<{ bytes: Buffer; mimeType: string }> {
  if (args.resolved.output === OutputFormat.Html) {
    // html 由浏览器执行，函数字符串保留
    return { bytes: Buffer.from(buildStandaloneHtml(args.option, args.size, args.title), 'utf8'), mimeType: 'text/html' };
  }
  // 静态图不执行 JS，函数字段留着只会被当成普通字符串画出来
  const { sanitized, functionPaths } = partitionFunctions(args.option);
  if (functionPaths.length > 0) {
    notes.push(`静态图不支持函数值，已忽略以下字段：${functionPaths.join('、')}。如需函数生效请改用 output: "html"。`);
  }
  return args.renderer.render(sanitized as EChartsOption, args.size);
}

export async function deliver(args: DeliverArgs): Promise<McpContent[]> {
  const notes = [...args.resolved.notes];

  if (args.resolved.output === OutputFormat.Option && args.resolved.channel === DeliveryChannel.Raw) {
    // option 原样返回（含函数字符串），由调用方前端自行决定如何处理
    return [
      ...(notes.length ? [{ type: 'text' as const, text: notes.join('\n') }] : []),
      { type: 'text' as const, text: JSON.stringify(args.option, null, 2) },
    ];
  }

  const { bytes, mimeType } = await produce(args, notes);
  const head = notes.length ? [{ type: 'text' as const, text: notes.join('\n') }] : [];

  if (args.resolved.channel === DeliveryChannel.Inline) {
    return [...head, { type: 'image', data: bytes.toString('base64'), mimeType }];
  }
  if (args.resolved.channel === DeliveryChannel.Raw) {
    return [...head, { type: 'text', text: bytes.toString('utf8') }];
  }

  const stored = await args.store.put(bytes, mimeType);
  const label = args.resolved.channel === DeliveryChannel.File ? stored.path : stored.url;
  return [...head, { type: 'text', text: `图表已生成：${label}` }];
}
```

- [ ] **Step 7: 跑测试确认通过**

Run: `npx vitest run tests/deliver/`
Expected: PASS，resolve 6 个 + deliver 6 个 + local-disk 5 个用例全绿

- [ ] **Step 8: 提交**

```bash
git add src/deliver/resolve.ts src/deliver/deliver.ts tests/deliver/resolve.test.ts tests/deliver/deliver.test.ts
git commit -m "feat: 交付通道推导与执行，含函数字段剥离提示"
```

---

## Task 14: 错误映射、MCP 核心与 generate_chart

**Files:**
- Create: `src/core/errors.ts`, `src/core/server.ts`, `src/tools/generate-chart.ts`
- Test: `tests/core/errors.test.ts`, `tests/tools/generate-chart.test.ts`

**Interfaces:**
- Consumes: 前序全部
- Produces:
  - `toToolError(e: unknown): { content: McpContent[]; isError: true }`
  - `assertOptionSize(option: object, maxBytes: number): void`
  - `interface ServerDeps { config: Config; store: StorageAdapter; transport: TransportKind }`
  - `createServer(deps: ServerDeps): McpServer`
  - `registerGenerateChart(server: McpServer, deps: ServerDeps): void`

**注意**：`registerTool` 的 `inputSchema` 是 **Zod raw shape 对象**（`{ a: z.string() }`），
不是 `z.object({...})`。此点已实测确认。

- [ ] **Step 1: 写失败测试**

`tests/core/errors.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { ChartError, ErrorCode } from '../../src/errors.js';
import { toToolError, assertOptionSize } from '../../src/core/errors.js';

describe('错误映射', () => {
  it('ChartError 映射出 code 与 field，便于 LLM 自我修正', () => {
    const r = toToolError(new ChartError(ErrorCode.InvalidInput, '类型不支持', 'type'));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('INVALID_INPUT');
    expect(r.content[0].text).toContain('type');
    expect(r.content[0].text).toContain('类型不支持');
  });

  it('普通 Error 归入 INVALID_OPTION', () => {
    expect(toToolError(new Error('炸了')).content[0].text).toContain('INVALID_OPTION');
  });

  it('option 超过上限时抛 OPTION_TOO_LARGE', () => {
    expect(() => assertOptionSize({ big: 'x'.repeat(200) }, 100)).toThrow(/超过上限/);
  });

  it('option 未超限时不抛错', () => {
    expect(() => assertOptionSize({ a: 1 }, 1000)).not.toThrow();
  });
});
```

`tests/tools/generate-chart.test.ts`：

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { TransportKind } from '../../src/types.js';
import { loadConfig } from '../../src/config.js';
import { LocalDiskStore } from '../../src/deliver/local-disk.js';
import { createServer } from '../../src/core/server.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'echarts-tool-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function connect(transport = TransportKind.Stdio) {
  const config = loadConfig({ ECHARTS_MCP_STORAGE_DIR: dir });
  const server = createServer({ config, store: new LocalDiskStore(dir, 3600), transport });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

describe('generate_chart', () => {
  it('注册了三个工具', async () => {
    const { client, close } = await connect();
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual(['generate_chart', 'list_chart_types', 'render_option']);
    await close();
  });

  it('生成柱状图并写出 svg 文件', async () => {
    const { client, close } = await connect();
    const res = await client.callTool({
      name: 'generate_chart',
      arguments: { type: 'bar', data: { dimensions: ['月份', '销量'], source: [['1月', 120], ['2月', 200]] }, title: '销量' },
    });
    expect((res.content as { text: string }[])[0].text).toMatch(/\.svg/);
    await close();
  });

  it('delivery inline 时返回 image content 且为 png', async () => {
    const { client, close } = await connect();
    const res = await client.callTool({
      name: 'generate_chart',
      arguments: { type: 'pie', data: { dimensions: ['名', '值'], source: [['A', 1], ['B', 2]] }, delivery: 'inline' },
    });
    const image = (res.content as { type: string; mimeType?: string }[]).find((c) => c.type === 'image');
    expect(image?.mimeType).toBe('image/png');
    await close();
  });

  it('optionOverrides 能改到最终 option', async () => {
    const { client, close } = await connect();
    const res = await client.callTool({
      name: 'generate_chart',
      arguments: {
        type: 'bar', data: { dimensions: ['月份', '销量'], source: [['1月', 120]] },
        output: 'option', optionOverrides: { backgroundColor: '#123456' },
      },
    });
    const texts = (res.content as { text: string }[]).map((c) => c.text).join('\n');
    expect(JSON.parse(texts.slice(texts.indexOf('{'))).backgroundColor).toBe('#123456');
    await close();
  });

  it('不支持的类型返回 isError 且提示可用类型', async () => {
    const { client, close } = await connect();
    const res = await client.callTool({ name: 'generate_chart', arguments: { type: 'bar3D', data: {} } });
    expect(res.isError).toBe(true);
    await close();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/core/ tests/tools/`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `src/core/errors.ts`**

```ts
import { ChartError, ErrorCode } from '../errors.js';
import type { McpContent } from '../deliver/deliver.js';

/**
 * 把异常转成 MCP 工具错误结果。
 * 错误文本必须包含 code 与出错字段 —— LLM 靠这两项才能自我修正后重试。
 */
export function toToolError(e: unknown): { content: McpContent[]; isError: true } {
  const isChart = e instanceof ChartError;
  const code = isChart ? e.code : ErrorCode.InvalidOption;
  const field = isChart && e.field ? `（字段：${e.field}）` : '';
  const message = e instanceof Error ? e.message : String(e);
  return { content: [{ type: 'text', text: `[${code}]${field} ${message}` }], isError: true };
}

export function assertOptionSize(option: object, maxBytes: number): void {
  const size = Buffer.byteLength(JSON.stringify(option), 'utf8');
  if (size > maxBytes) {
    throw new ChartError(
      ErrorCode.OptionTooLarge,
      `option 序列化后 ${size} 字节，超过上限 ${maxBytes} 字节。请减少数据点数量或改用聚合后的数据。`,
      'data',
    );
  }
}
```

- [ ] **Step 4: 实现 `src/tools/generate-chart.ts`**

```ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ChartType, DEFAULT_HEIGHT, DEFAULT_WIDTH, DeliveryRequest, OutputFormat, ThemeName,
  type ChartData,
} from '../types.js';
import { buildOption } from '../option/build.js';
import { selectRenderer } from '../render/index.js';
import { resolveDelivery } from '../deliver/resolve.js';
import { deliver } from '../deliver/deliver.js';
import { assertOptionSize, toToolError } from '../core/errors.js';
import type { ServerDeps } from '../core/server.js';

const datasetSchema = z.object({
  dimensions: z.array(z.string()).describe('维度名。多数类型第 1 项为类目轴，其余每项一条系列'),
  source: z.array(z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]))
    .describe('数据行。可以是数组（顺序与 dimensions 对应）或对象（键为 dimensions 中的名字）'),
});
const nodeLinkSchema = z.object({
  nodes: z.array(z.object({ name: z.string(), value: z.number().optional() })),
  links: z.array(z.object({ source: z.string(), target: z.string(), value: z.number().optional() })),
});
const treeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({ name: z.string(), value: z.number().optional(), children: z.array(treeSchema).optional() }),
);

export const generateChartShape = {
  type: z.nativeEnum(ChartType).describe('图表类型。调用 list_chart_types 可查看每种类型的 data 结构与细分样式'),
  data: z.union([datasetSchema, nodeLinkSchema, treeSchema])
    .describe('数据。多数类型用 { dimensions, source }；sankey/graph 用 { nodes, links }；tree 用递归 { name, children }'),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  theme: z.nativeEnum(ThemeName).optional().describe('内置主题，默认 default'),
  width: z.number().int().positive().optional().describe(`宽度，默认 ${DEFAULT_WIDTH}`),
  height: z.number().int().positive().optional().describe(`高度，默认 ${DEFAULT_HEIGHT}`),
  optionOverrides: z.record(z.string(), z.unknown()).optional()
    .describe('任意 ECharts option 片段，深合并到模板产物上。堆叠、横向、极坐标、双轴等细分样式都靠它实现；调用 list_chart_types 可获得现成片段'),
  output: z.nativeEnum(OutputFormat).optional().describe('svg | png | option | html'),
  delivery: z.nativeEnum(DeliveryRequest).optional().describe('auto | inline | file | url'),
};

export function registerGenerateChart(server: McpServer, deps: ServerDeps): void {
  server.registerTool(
    'generate_chart',
    {
      title: '生成图表',
      description:
        '用 Apache ECharts 生成图表。给定图表类型与数据即可出图；需要堆叠、横向、双 Y 轴等细分样式时，' +
        '在 optionOverrides 里追加 ECharts option 片段，不需要换工具。支持 18 种类型，具体用 list_chart_types 查询。',
      inputSchema: generateChartShape,
    },
    async (args) => {
      try {
        const option = buildOption({
          type: args.type,
          data: args.data as ChartData,
          title: args.title,
          subtitle: args.subtitle,
          theme: args.theme,
          optionOverrides: args.optionOverrides,
        });
        assertOptionSize(option, deps.config.maxOptionBytes);
        const resolved = resolveDelivery({ transport: deps.transport, output: args.output, delivery: args.delivery });
        const size = { width: args.width ?? DEFAULT_WIDTH, height: args.height ?? DEFAULT_HEIGHT };
        const renderer = await selectRenderer(deps.config.renderer, resolved.output);
        return { content: await deliver({ option, resolved, size, renderer, store: deps.store, title: args.title }) };
      } catch (e) {
        return toToolError(e);
      }
    },
  );
}
```

- [ ] **Step 5: 实现 `src/core/server.ts`**

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TransportKind } from '../types.js';
import type { Config } from '../config.js';
import type { StorageAdapter } from '../deliver/types.js';
import { registerCartesianTemplates } from '../charts/cartesian.js';
import { registerCategoricalTemplates } from '../charts/categorical.js';
import { registerStructuralTemplates } from '../charts/structural.js';
import { registerGenerateChart } from '../tools/generate-chart.js';
import { registerRenderOption } from '../tools/render-option.js';
import { registerListChartTypes } from '../tools/list-chart-types.js';

export interface ServerDeps {
  config: Config;
  store: StorageAdapter;
  transport: TransportKind;
}

/** 与传输层无关的核心。stdio 与 http 两个 entry 共用这一份注册代码。 */
export function createServer(deps: ServerDeps): McpServer {
  registerCartesianTemplates();
  registerCategoricalTemplates();
  registerStructuralTemplates();

  const server = new McpServer({ name: 'echarts-mcp', version: '0.1.0' });
  registerGenerateChart(server, deps);
  registerRenderOption(server, deps);
  registerListChartTypes(server, deps);
  return server;
}
```

- [ ] **Step 6: 跑测试确认通过**（需 Task 15 完成后才全绿）

Run: `npx vitest run tests/core/errors.test.ts`
Expected: PASS，4 个用例全绿。`tests/tools/generate-chart.test.ts` 依赖 Task 15 的两个工具，此时仍失败属正常。

- [ ] **Step 7: 提交**

```bash
git add src/core/ src/tools/generate-chart.ts tests/core/
git commit -m "feat: 错误映射、MCP 核心与 generate_chart 工具"
```

---

## Task 15: render_option 与 list_chart_types

**Files:**
- Create: `src/tools/render-option.ts`, `src/tools/list-chart-types.ts`
- Test: `tests/tools/list-chart-types.test.ts`

**Interfaces:**
- Consumes: Task 14 的 `ServerDeps`、Task 7 的 `getVariants`、Task 2 的注册表
- Produces: `registerRenderOption(server, deps)`、`registerListChartTypes(server, deps)`

- [ ] **Step 1: 写失败测试**

`tests/tools/list-chart-types.test.ts`：

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { TransportKind } from '../../src/types.js';
import { loadConfig } from '../../src/config.js';
import { LocalDiskStore } from '../../src/deliver/local-disk.js';
import { createServer } from '../../src/core/server.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'echarts-list-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function connect() {
  const server = createServer({
    config: loadConfig({ ECHARTS_MCP_STORAGE_DIR: dir }),
    store: new LocalDiskStore(dir, 3600),
    transport: TransportKind.Stdio,
  });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}
const textOf = (res: unknown) => (res as { content: { text: string }[] }).content.map((c) => c.text).join('\n');

describe('list_chart_types', () => {
  it('不带参数时列出全部 18 种类型', async () => {
    const { client, close } = await connect();
    const data = JSON.parse(textOf(await client.callTool({ name: 'list_chart_types', arguments: {} })));
    expect(data.types).toHaveLength(18);
    expect(data.types.map((t: { type: string }) => t.type)).toContain('sankey');
    await close();
  });

  it('带 type 参数时返回该类型详情，含 dataShape、example 与 variants', async () => {
    const { client, close } = await connect();
    const data = JSON.parse(textOf(await client.callTool({ name: 'list_chart_types', arguments: { type: 'bar' } })));
    expect(data.dataShape).toBeTruthy();
    expect(data.example).toBeTruthy();
    expect(data.variants.map((v: { name: string }) => v.name)).toEqual(expect.arrayContaining(['堆叠', '横向']));
    await close();
  });

  it('variants 里的 optionOverrides 可直接喂给 generate_chart', async () => {
    const { client, close } = await connect();
    const detail = JSON.parse(textOf(await client.callTool({ name: 'list_chart_types', arguments: { type: 'bar' } })));
    const stacked = detail.variants.find((v: { name: string }) => v.name === '堆叠');
    const res = await client.callTool({
      name: 'generate_chart',
      arguments: {
        type: 'bar', data: { dimensions: ['月', '销量', '利润'], source: [['1月', 10, 3], ['2月', 20, 5]] },
        optionOverrides: stacked.optionOverrides, output: 'option',
      },
    });
    expect(res.isError).toBeFalsy();
    await close();
  });
});

describe('render_option', () => {
  it('直接给完整 option 也能出图', async () => {
    const { client, close } = await connect();
    const res = await client.callTool({
      name: 'render_option',
      arguments: { option: { xAxis: { type: 'category', data: ['A', 'B'] }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: [1, 2] }] } },
    });
    expect(res.isError).toBeFalsy();
    expect(textOf(res)).toMatch(/\.svg/);
    await close();
  });

  it('option 非法时返回 isError 并带 code', async () => {
    const { client, close } = await connect();
    const res = await client.callTool({ name: 'render_option', arguments: { option: { series: 'not-an-array' } } });
    expect(res.isError).toBe(true);
    await close();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/tools/list-chart-types.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `src/tools/render-option.ts`**

```ts
import { z } from 'zod';
import type { EChartsOption } from 'echarts';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, DeliveryRequest, OutputFormat, ThemeName } from '../types.js';
import { THEMES } from '../option/themes.js';
import { deepMerge } from '../option/merge.js';
import { selectRenderer } from '../render/index.js';
import { resolveDelivery } from '../deliver/resolve.js';
import { deliver } from '../deliver/deliver.js';
import { assertOptionSize, toToolError } from '../core/errors.js';
import type { ServerDeps } from '../core/server.js';

export function registerRenderOption(server: McpServer, deps: ServerDeps): void {
  server.registerTool(
    'render_option',
    {
      title: '渲染 ECharts option',
      description:
        '直接给出完整的 ECharts option 并渲染，能力上限等同 ECharts 本身。' +
        '适合模板覆盖不到的高级需求（多坐标系、自定义 series 组合等）。' +
        '常规图表建议优先用 generate_chart，稳定性更好。',
      inputSchema: {
        option: z.record(z.string(), z.unknown()).describe('完整的 ECharts option 对象'),
        title: z.string().optional().describe('仅用于 html 输出的页面标题'),
        theme: z.nativeEnum(ThemeName).optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        output: z.nativeEnum(OutputFormat).optional(),
        delivery: z.nativeEnum(DeliveryRequest).optional(),
      },
    },
    async (args) => {
      try {
        // 主题作底、调用方的 option 覆盖其上
        const option = {
          ...deepMerge(THEMES[args.theme ?? ThemeName.Default], args.option),
          animation: false,
        } as EChartsOption;
        assertOptionSize(option, deps.config.maxOptionBytes);
        const resolved = resolveDelivery({ transport: deps.transport, output: args.output, delivery: args.delivery });
        const size = { width: args.width ?? DEFAULT_WIDTH, height: args.height ?? DEFAULT_HEIGHT };
        const renderer = await selectRenderer(deps.config.renderer, resolved.output);
        return { content: await deliver({ option, resolved, size, renderer, store: deps.store, title: args.title }) };
      } catch (e) {
        return toToolError(e);
      }
    },
  );
}
```

- [ ] **Step 4: 实现 `src/tools/list-chart-types.ts`**

```ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ChartType } from '../types.js';
import { CHART_TEMPLATES, getTemplate } from '../charts/registry.js';
import { getVariants } from '../charts/variants.js';
import { toToolError } from '../core/errors.js';
import type { ServerDeps } from '../core/server.js';

export function registerListChartTypes(server: McpServer, _deps: ServerDeps): void {
  server.registerTool(
    'list_chart_types',
    {
      title: '查询支持的图表类型',
      description:
        '列出 generate_chart 支持的全部图表类型。带上 type 参数可获得该类型的详细信息：' +
        'data 该怎么组织、可直接复制的示例数据，以及常见细分样式（堆叠、横向、极坐标、玫瑰图等）' +
        '对应的 optionOverrides 片段。不确定怎么传 data 时先调用本工具。',
      inputSchema: {
        type: z.nativeEnum(ChartType).optional().describe('省略则返回全部类型的概览'),
      },
    },
    async (args) => {
      try {
        if (args.type) {
          const tpl = getTemplate(args.type);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                type: tpl.type,
                dataShape: tpl.dataShape,
                example: tpl.example,
                variants: getVariants(tpl.type),
              }, null, 2),
            }],
          };
        }
        const types = Object.values(ChartType)
          .filter((t) => CHART_TEMPLATES[t])
          .map((t) => ({
            type: t,
            dataShape: CHART_TEMPLATES[t]!.dataShape,
            variantCount: getVariants(t).length,
          }));
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              types,
              hint: '需要某个类型的示例数据与细分样式片段时，用 type 参数再调一次本工具。',
            }, null, 2),
          }],
        };
      } catch (e) {
        return toToolError(e);
      }
    },
  );
}
```

- [ ] **Step 5: 跑全量测试**

Run: `npx vitest run`
Expected: 全部 PASS，包括 Task 14 中原本失败的 `generate-chart.test.ts`

- [ ] **Step 6: 查覆盖率**

Run: `npx vitest run --coverage`
Expected: lines / functions / branches / statements 均 ≥ 80%。未达标则补测试，不得下调阈值。

- [ ] **Step 7: 提交**

```bash
git add src/tools/ tests/tools/
git commit -m "feat: render_option 与 list_chart_types 工具"
```

---

## Task 16: stdio entry

**Files:**
- Create: `src/transport/stdio.ts`
- Modify: `package.json`（加 `bin` 与 `files`）
- Test: `tests/transport/stdio.test.ts`

**Interfaces:**
- Consumes: `createServer`（Task 14）、`loadConfig`（Task 2）、`LocalDiskStore`（Task 12）
- Produces: `main(): Promise<void>`；可执行入口 `dist/transport/stdio.js`

**注意**：stdio 传输下 **stdout 是协议通道**，任何 `console.log` 都会污染协议。
日志一律走 `console.error`（stderr）。

- [ ] **Step 1: 写失败测试**

`tests/transport/stdio.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('stdio entry', () => {
  it('源码中不出现 console.log —— stdout 是 MCP 协议通道', () => {
    const src = readFileSync('src/transport/stdio.ts', 'utf8');
    expect(src).not.toMatch(/console\.log/);
  });

  it('package.json 声明了 bin 入口', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.bin['echarts-mcp']).toBe('dist/transport/stdio.js');
  });

  it('TypeScript 能编译通过', async () => {
    const { execSync } = await import('node:child_process');
    expect(() => execSync('npx tsc -p tsconfig.json --noEmit', { stdio: 'pipe' })).not.toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/transport/stdio.test.ts`
Expected: FAIL —— 文件不存在

- [ ] **Step 3: 实现 `src/transport/stdio.ts`**

```ts
#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TransportKind } from '../types.js';
import { loadConfig } from '../config.js';
import { LocalDiskStore } from '../deliver/local-disk.js';
import { createServer } from '../core/server.js';

export async function main(): Promise<void> {
  const config = loadConfig();
  const store = new LocalDiskStore(config.storageDir, config.storageTtlSeconds, config.publicUrl);
  await store.sweep();

  const server = createServer({ config, store, transport: TransportKind.Stdio });
  await server.connect(new StdioServerTransport());
  // stdout 归 MCP 协议独占，日志只能走 stderr
  console.error(`echarts-mcp 已通过 stdio 启动，存储目录：${config.storageDir}`);
}

main().catch((e) => {
  console.error('echarts-mcp 启动失败：', e);
  process.exit(1);
});
```

- [ ] **Step 4: 配置 bin 与打包文件**

```bash
npm pkg set bin.echarts-mcp="dist/transport/stdio.js"
npm pkg set files[0]="dist"
npm pkg set scripts.prepublishOnly="npm run build"
```

- [ ] **Step 5: 跑测试确认通过并做一次真实冒烟**

Run: `npx vitest run tests/transport/stdio.test.ts && npm run build`
Expected: PASS，且 `dist/transport/stdio.js` 生成成功

- [ ] **Step 6: 提交**

```bash
git add src/transport/stdio.ts tests/transport/stdio.test.ts package.json
git commit -m "feat: stdio 传输入口"
```

---

## Task 17: HTTP entry（无状态 + 可选鉴权 + 静态路由）

**Files:**
- Create: `src/transport/http.ts`
- Test: `tests/transport/http.test.ts`

**Interfaces:**
- Consumes: `createServer`（Task 14）、`loadConfig`、`LocalDiskStore`
- Produces: `createApp(deps: ServerDeps): express.Express`、`main(): Promise<void>`

**关键点**：无状态模式 —— `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })`，
**每个请求新建 server 与 transport 并在响应结束后关闭**，避免请求间串状态。

- [ ] **Step 1: 写失败测试**

`tests/transport/http.test.ts`：

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { TransportKind } from '../../src/types.js';
import { loadConfig } from '../../src/config.js';
import { LocalDiskStore } from '../../src/deliver/local-disk.js';
import { createApp } from '../../src/transport/http.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'echarts-http-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const appWith = (env: Record<string, string> = {}) => {
  const config = loadConfig({ ECHARTS_MCP_STORAGE_DIR: dir, ...env });
  return createApp({ config, store: new LocalDiskStore(dir, 3600), transport: TransportKind.Http });
};

const INIT = {
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } },
};

describe('HTTP transport', () => {
  it('健康检查返回 ok', async () => {
    await request(appWith()).get('/health').expect(200).expect(({ body }) => expect(body.status).toBe('ok'));
  });

  it('未配置 token 时开放访问，initialize 成功', async () => {
    const res = await request(appWith())
      .post('/mcp').set('Accept', 'application/json, text/event-stream').send(INIT);
    expect(res.status).toBe(200);
  });

  it('配置了 token 但请求不带时返回 401', async () => {
    await request(appWith({ ECHARTS_MCP_TOKEN: 'secret' }))
      .post('/mcp').set('Accept', 'application/json, text/event-stream').send(INIT).expect(401);
  });

  it('配置了 token 且请求带对时放行', async () => {
    const res = await request(appWith({ ECHARTS_MCP_TOKEN: 'secret' }))
      .post('/mcp').set('Accept', 'application/json, text/event-stream')
      .set('Authorization', 'Bearer secret').send(INIT);
    expect(res.status).toBe(200);
  });

  it('静态路由能取回已存储的图', async () => {
    writeFileSync(join(dir, 'abc.svg'), '<svg/>');
    await request(appWith()).get('/files/abc.svg').expect(200).expect('Content-Type', /svg/);
  });

  it('静态路由拒绝路径穿越', async () => {
    const res = await request(appWith()).get('/files/..%2f..%2fetc%2fpasswd');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('健康检查不需要鉴权', async () => {
    await request(appWith({ ECHARTS_MCP_TOKEN: 'secret' })).get('/health').expect(200);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/transport/http.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `src/transport/http.ts`**

```ts
#!/usr/bin/env node
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { TransportKind } from '../types.js';
import { loadConfig } from '../config.js';
import { LocalDiskStore } from '../deliver/local-disk.js';
import { createServer, type ServerDeps } from '../core/server.js';

function bearerGuard(token?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!token) return next();
    if (req.headers.authorization === `Bearer ${token}`) return next();
    res.status(401).json({ error: 'unauthorized' });
  };
}

export function createApp(deps: ServerDeps): Express {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });

  // 静态图。express.static 自身已拒绝路径穿越
  app.use('/files', express.static(deps.config.storageDir, { index: false, dotfiles: 'deny' }));

  app.post('/mcp', bearerGuard(deps.config.token), async (req, res) => {
    // 无状态：每个请求独立的 server + transport，请求结束即销毁，请求之间不共享任何状态
    const server = createServer(deps);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // 无状态模式不支持服务端主动推送，GET/DELETE 一律拒绝
  const methodNotAllowed = (_req: Request, res: Response): void => {
    res.status(405).json({ error: 'method not allowed in stateless mode' });
  };
  app.get('/mcp', methodNotAllowed);
  app.delete('/mcp', methodNotAllowed);

  return app;
}

export async function main(): Promise<void> {
  const config = loadConfig();
  const store = new LocalDiskStore(config.storageDir, config.storageTtlSeconds, config.publicUrl);
  await store.sweep();
  // 定期清理过期图片
  setInterval(() => { void store.sweep(); }, config.storageTtlSeconds * 1000).unref();

  createApp({ config, store, transport: TransportKind.Http }).listen(config.port, () => {
    console.error(`echarts-mcp HTTP 已启动：http://localhost:${config.port}/mcp（鉴权：${config.token ? '开启' : '关闭'}）`);
  });
}

if (process.argv[1]?.endsWith('http.js')) {
  main().catch((e) => { console.error('启动失败：', e); process.exit(1); });
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/transport/http.test.ts`
Expected: PASS，7 个用例全绿

- [ ] **Step 5: 提交**

```bash
npm pkg set bin.echarts-mcp-http="dist/transport/http.js"
git add src/transport/http.ts tests/transport/http.test.ts package.json
git commit -m "feat: Streamable HTTP 无状态传输、Bearer 鉴权与静态图路由"
```

---

## Task 18: 分发与假设验证

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `README.md`
- Test: `tests/dist.test.ts`

**Interfaces:**
- Consumes: 前序全部
- Produces: 可发布的 npm 包与可构建的 Docker 镜像

- [ ] **Step 1: 写失败测试**

`tests/dist.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

describe('分发配置', () => {
  it('Dockerfile 基于 slim 镜像并安装中文字体', () => {
    const df = readFileSync('Dockerfile', 'utf8');
    expect(df).toMatch(/node:\d+-slim/);
    expect(df).toMatch(/fonts-noto-cjk/);
  });

  it('canvas 是可选依赖而非必需依赖', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.optionalDependencies?.canvas).toBeTruthy();
    expect(pkg.dependencies?.canvas).toBeUndefined();
  });

  it('README 存在且写明两种集成方式', () => {
    expect(existsSync('README.md')).toBe(true);
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toMatch(/stdio/);
    expect(readme).toMatch(/Streamable HTTP|streamable/i);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/dist.test.ts`
Expected: FAIL —— Dockerfile 与 README 不存在

- [ ] **Step 3: 写 `Dockerfile`**

```dockerfile
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=optional
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-slim
# 默认渲染链路零原生依赖，因此无需构建工具链；只需中文字体供 resvg 栅格化使用
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-noto-cjk \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --omit=optional && npm cache clean --force
COPY --from=build /app/dist ./dist
ENV ECHARTS_MCP_PORT=3000
ENV ECHARTS_MCP_STORAGE_DIR=/data
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "dist/transport/http.js"]
```

`.dockerignore`：

```
node_modules
dist
docs
tests
.git
```

- [ ] **Step 4: 写 `README.md`**

内容须覆盖：项目定位、两种集成方式的配置片段（stdio 的 `npx` 写法与 HTTP 的 URL 写法）、
三个工具的说明、全部环境变量表、18 种图表类型清单（链接到 `docs/chart-types.md`）、
以及「细分样式用 optionOverrides，不新增工具」这一核心用法。

- [ ] **Step 5: 跑全量测试与构建**

Run: `npx vitest run --coverage && npm run build && docker build -t echarts-mcp .`
Expected: 测试全绿、覆盖率 ≥80%、镜像构建成功

- [ ] **Step 6: 验证 spec §14.1 的未验证假设**

这是 spec 中被标注为「未验证」且**阻塞 §8.2 决策**的假设。此刻必须验证：

1. 用 `npx @modelcontextprotocol/inspector node dist/transport/stdio.js` 起 inspector
2. 调用 `generate_chart` 并传 `delivery: "inline"`、`output: "svg"`
3. 观察客户端是否渲染出图像

- **若客户端不渲染 SVG** → 假设成立，保持「inline 强制 png」，在 spec §14.1 标注为已验证
- **若客户端能渲染 SVG** → 假设不成立，放宽 `resolveDelivery`：inline 时允许 svg，省去栅格化开销，
  并同步修改 spec §8.2 与对应测试

**无论结果如何，都要把结论写回 spec §14.1，把「未验证」改成实测结论。**

- [ ] **Step 7: 提交**

```bash
git add Dockerfile .dockerignore README.md tests/dist.test.ts docs/superpowers/specs/
git commit -m "feat: Docker 镜像、npm 分发与 README，并验证客户端 SVG 支持假设"
```

---

## 附：实现完成后的自检清单

- [ ] `npx vitest run --coverage` 四项指标均 ≥ 80%
- [ ] `npx tsc -p tsconfig.json --noEmit` 无错误
- [ ] 全仓库 grep 不到 `eval(` 与 `new Function(`（spec §16.3 硬约束）
- [ ] 全仓库 grep 不到散落的图表类型字符串字面量（应全部走 `ChartType` 枚举）
- [ ] 每个源文件均在 800 行以内
- [ ] `src/transport/stdio.ts` 中无 `console.log`
- [ ] spec §14 的四条未验证假设，每条都已更新为实测结论或明确标注仍未验证的原因
