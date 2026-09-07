#!/usr/bin/env node
/**
 * 从 Apache ECharts 官方示例库抓取我们支持的图表类型的全部例子，
 * 求值成纯 option 对象，落成 examples/gallery/ 下的目录文件。
 *
 * 为什么要「求值」而不是直接存源码：
 * 官方例子是一段 TypeScript，里面有变量、循环、外部数据请求。
 * 我们的工具吃的是 JSON option，两者之间必须有一步转换。
 * 这一步在**构建期**做，产物是纯数据 —— 服务端在任何路径上都不会执行外来代码。
 *
 * 求值用 node:vm 起一个隔离上下文，只注入例子会用到的少量全局：
 * echarts / myChart / ROOT_PATH / $ / app。定时器一律打成空转，
 * 这样捕获到的是图表的**初始帧**，而不是某次动画之后的中间状态。
 *
 * 用法：
 *   node scripts/build-gallery.mjs              # 增量：命中缓存的不重新下载
 *   node scripts/build-gallery.mjs --refresh    # 丢掉缓存重新抓
 *
 * 依赖仓库根目录的 node_modules（typescript、echarts），在仓库内运行。
 */
import { createContext, runInContext } from 'node:vm';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as echarts from 'echarts';
import ecStatNs from 'echarts-stat';
import * as ecSimpleTransformNs from 'echarts-simple-transform';
import { CHART_PROFILES } from './chart-profiles.mjs';

// 官方图库里做聚类、回归与聚合的例子依赖这两个附加库，它们不是 echarts 的一部分
const ecStat = ecStatNs.default ?? ecStatNs;
const ecSimpleTransform = ecSimpleTransformNs.default ?? ecSimpleTransformNs;

/**
 * 例子里的异步链（`$.getScript(...).then(run)`）产生的 promise 我们抓不到句柄，
 * 里面抛错会变成 unhandledRejection 直接把进程带走。挂一个全局钩子接住，
 * 归到当前正在求值的例子名下，让这一个失败而不是整轮失败。
 */
let asyncError = null;
process.on('unhandledRejection', (e) => { asyncError = e; });

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = join(here, '..');
const cacheDir = join(skillRoot, '.cache');
const outDir = join(skillRoot, 'examples/gallery');
const refresh = process.argv.includes('--refresh');

const SITE = 'https://echarts.apache.org/examples';
const BUNDLE = `${SITE}/js/example-bundle.js`;

/** 我们支持的 15 种类型，与 src/types.ts 的 ChartType 一一对应。 */
const SUPPORTED = [
  'bar', 'line', 'pie', 'scatter', 'radar', 'heatmap', 'boxplot', 'candlestick',
  'funnel', 'sankey', 'treemap', 'sunburst', 'graph', 'tree', 'parallel',
];

/**
 * 明确不抓的例子，连同理由。
 *
 * 与「求值失败」分开记：失败是我们的沙箱不够用，需要修；
 * 这里是**已知且不打算支持**的，写清楚原因比留个含糊的报错有用。
 */
const KNOWN_SKIP = {
  // —— 依赖 geo / map 坐标系。这些例子在官方图库里挂在 scatter / heatmap / graph / bar 名下，
  //    但画布是地图，本工具明确不支持 map / geo，收进来只会是一份必然报错的 option。
  'matrix-mini-bar-geo': '画在 geo 坐标系上，本工具不支持 map / geo',
  'map-iceland-pie': '画在 geo 坐标系上，本工具不支持 map / geo',
  'effectScatter-map': '画在 geo 坐标系上，本工具不支持 map / geo',
  'geo-choropleth-scatter': '画在 geo 坐标系上，本工具不支持 map / geo',
  'geo-graph': '画在 geo 坐标系上，本工具不支持 map / geo',
  'scatter-map': '画在 geo 坐标系上，本工具不支持 map / geo',
  'scatter-map-brush': '画在 geo 坐标系上，本工具不支持 map / geo',
  'scatter-weibo': '画在 geo 坐标系上，本工具不支持 map / geo',
  'scatter-world-population': '画在 geo 坐标系上，本工具不支持 map / geo',
  'heatmap-map': '画在 geo 坐标系上，本工具不支持 map / geo',
  'heatmap-bmap': '画在百度地图（bmap）上，需要地图扩展与 API key',

  // —— 依赖服务端注册第三方数据变换。option 里写的是 `transform: { type: 'ecStat:regression' }`，
  //    这个 type 只有在服务端调用过 echarts.registerTransform 之后才存在。
  //    我们的服务端没有注册 echarts-stat，ECharts 会直接报 "Can not find transform on type"。
  'scatter-clustering': '需要服务端注册 echarts-stat 的 clustering 变换',
  'scatter-linear-regression': '需要服务端注册 echarts-stat 的 regression 变换',
  'scatter-polynomial-regression': '需要服务端注册 echarts-stat 的 regression 变换',
  'scatter-exponential-regression': '需要服务端注册 echarts-stat 的 regression 变换',
  'scatter-logarithmic-regression': '需要服务端注册 echarts-stat 的 regression 变换',
  'data-transform-aggregate': '需要服务端注册 echarts-simple-transform 的 aggregate 变换',

  // —— custom 系列。renderItem 是函数，静态出图时被剥离，剥离后 ECharts 报 "series.render is required"。
  'custom-ohlc': 'custom 系列的 renderItem 是函数，静态渲染时被剥离后无法成图',
  'scatter-clustering-process': 'custom 系列的 renderItem 是函数，静态渲染时被剥离后无法成图',

  // —— 图案填充要在浏览器里用 Image 加载位图，SSR 下 resvg 要求显式宽高。
  'pie-pattern': '用位图做图案填充，需要浏览器的 Image 对象，svg-ssr 下报 Image width/height must be given',
  watermark: '水印用 canvas 现画图案，服务端没有 canvas 2d 上下文',

  // —— 上游 option 自身在 SSR 下就不成立，与本工具无关（已用纯 echarts 复现）。
  'themeRiver-lastfm':
    '官方 option 原样喂给 echarts 的 svg-ssr 就抛 "Cannot read properties of undefined (reading \'x\')"，浏览器端正常，服务端渲染不了',

  // —— 构建期取不到可用数据。
  'bar-race-country': '数据要在浏览器里对 CDN 资源做二次解析，构建期沙箱拿不到可用的 dataset',
  'scatter-nebula':
    '数据是 8MB 的 Float32 二进制（约 66 万个点），超出服务端 50,000 点的渲染配额，抓下来也画不出',
};

/**
 * 能画出来、但对数据分析没有实际用处，因此不收录的例子。
 *
 * 与 KNOWN_SKIP 分开记，因为两者的含义完全不同：
 * KNOWN_SKIP 是**画不出来**，属于能力边界；这里是**画得出来但不该推荐**，属于取舍。
 * 混在一起会让兼容性报告说谎 —— 报告只该为「能不能画」负责。
 *
 * 目前为空：gauge / pictorialBar / themeRiver 这三类整体从支持列表里去掉了，
 * 连带它们的例子根本不会进入候选，不需要在这里逐条排除。
 */
const CURATION_SKIP = {};

// ---------------------------------------------------------------- 抓取与缓存

if (refresh && existsSync(cacheDir)) rmSync(cacheDir, { recursive: true, force: true });
mkdirSync(cacheDir, { recursive: true });

const cacheKey = (url) => join(cacheDir, encodeURIComponent(url).replace(/%/g, '_').slice(-180));

async function getText(url) {
  const key = cacheKey(url);
  if (existsSync(key)) return readFileSync(key, 'utf8');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const text = await res.text();
  writeFileSync(key, text);
  return text;
}

/**
 * 官方示例清单没有独立的接口，只以数组字面量的形式内联在 example-bundle.js 里。
 * 这里把那段字面量抠出来做文本级转换后 JSON.parse —— 不执行它。
 */
async function fetchExampleList() {
  const js = await getText(BUNDLE);
  const from = js.indexOf('[', js.indexOf('const ce=['));
  if (from < 0) throw new Error('example-bundle.js 结构变了，找不到示例清单');

  let depth = 0, end = -1, inStr = null;
  for (let i = from; i < js.length; i++) {
    const c = js[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '[') depth++;
    else if (c === ']' && --depth === 0) { end = i + 1; break; }
  }
  const literal = js.slice(from, end)
    .replace(/([{,])([A-Za-z_$][A-Za-z0-9_$]*):/g, '$1"$2":')
    .replace(/:!0([,}])/g, ':true$1')
    .replace(/:!1([,}])/g, ':false$1');
  return JSON.parse(literal);
}

// ---------------------------------------------------------------- 求值沙箱

/** 函数在 option 里以**源码字符串**保存：静态出图时被剥离，html 输出时由浏览器执行。 */
function fnToSource(fn) {
  const src = Function.prototype.toString.call(fn).trim();
  // 对象字面量里的简写方法 `formatter(p) {}` 不是合法的函数表达式，补上 function 前缀
  return /^(function\b|\(|[A-Za-z_$][\w$]*\s*=>|async\b)/.test(src) ? src : `function ${src}`;
}

/** 把求值得到的对象转成纯 JSON 值。函数转源码，循环引用截断。 */
function toPlain(value, seen = new WeakSet()) {
  if (typeof value === 'function') return fnToSource(value);
  if (value === null || typeof value !== 'object') {
    return typeof value === 'number' && !Number.isFinite(value) ? null : value;
  }
  if (value instanceof Date) return value.toISOString();
  // 类型化数组（scatter-large 用 Float32Array 装数据）不转成普通数组的话，
  // JSON.stringify 会把它写成 {"0":…,"1":…} 这种下标对象，ECharts 完全认不出来
  if (ArrayBuffer.isView(value)) return Array.from(value, (n) => (Number.isFinite(n) ? n : null));
  // Array.from 而不是 .map：官方例子里有稀疏数组（matrix-stock 的 data 带空洞），
  // .map 会原样保留空洞，序列化出来就是一串裸逗号，不是合法 JSON。Array.from 把空洞填成 undefined。
  if (Array.isArray(value)) return Array.from(value, (v) => toPlain(v, seen));
  if (seen.has(value)) return null;
  seen.add(value);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    out[k] = toPlain(v, seen);
  }
  return out;
}

/** jQuery 的极小替身：只实现例子里真正用到的 get / getJSON / when。 */
function makeJQuery(pending) {
  const wrap = (promise) => {
    const p = promise;
    p.done = (cb) => { p.then((d) => cb(d)); return p; };
    p.fail = () => p;
    p.always = (cb) => { p.finally(() => cb()); return p; };
    return p;
  };
  const get = (url, cb) => {
    const p = getText(url).then((text) => {
      let data = text;
      try { data = JSON.parse(text); } catch { /* 少数资源不是 JSON，原样回传 */ }
      if (typeof cb === 'function') cb(data);
      return data;
    });
    pending.push(p);
    return wrap(p);
  };
  const $ = () => ({ on: () => {}, val: () => '', width: () => 800, height: () => 500 });
  $.get = get;
  $.getJSON = get;
  $.getScript = (url) => wrap(Promise.resolve(url));
  $.when = (...args) => {
    const p = Promise.all(args);
    pending.push(p);
    const w = wrap(p);
    w.done = (cb) => { p.then((vals) => cb(...vals)); return w; };
    return w;
  };
  $.each = (obj, cb) => { Object.entries(obj).forEach(([k, v]) => cb(k, v)); };
  return $;
}

async function evaluateExample(id, source) {
  const body = source
    .replace(/^\s*\/\*[\s\S]*?\*\//, '')          // 去掉头部元信息注释
    .replace(/^\s*import\s[\s\S]*?from\s+'[^']*';\s*$/gm, '') // 只用于类型的 import，转译器分辨不出来，先摘掉
    .replace(/^\s*export\s*\{\s*\};?\s*$/m, '');  // transpile 前再摘掉模块标记

  const js = ts.transpileModule(body, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText;

  asyncError = null;
  const pending = [];
  const setOptionCalls = [];
  const noopTimer = () => 0;

  /**
   * setTimeout 立即同步执行，但最多放行 3 次。
   *
   * 有的例子把整个 option 写在 `setTimeout(function () { ... })` 里（dataset-link），
   * 直接空转就什么都拿不到；而动画类例子会在回调里再排一次 setTimeout，
   * 无限递归。次数上限同时满足这两头。setInterval 一律空转 —— 它只用于动画。
   */
  let timerBudget = 3;
  const immediateTimer = (fn) => {
    if (typeof fn === 'function' && timerBudget-- > 0) {
      try { fn(); } catch { /* 动画回调依赖运行时状态，失败不影响初始帧 */ }
    }
    return 0;
  };

  const zrStub = {
    on: () => {}, off: () => {}, add: () => {}, remove: () => {},
    configLayer: () => {}, refresh: () => {}, painter: { getViewportRoot: () => null },
    dom: { style: {} },
  };
  const chartStub = {
    setOption: (o) => { setOptionCalls.push(o); },
    getWidth: () => 800,
    getHeight: () => 500,
    getZr: () => zrStub,
    getDom: () => ({ style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 500 }) }),
    getModel: () => ({ getSeries: () => [], getComponent: () => null }),
    on: () => {}, off: () => {}, dispatchAction: () => {}, resize: () => {},
    showLoading: () => {}, hideLoading: () => {}, appendData: () => {},
    convertToPixel: () => [0, 0], convertFromPixel: () => [0, 0],
    getOption: () => setOptionCalls[setOptionCalls.length - 1] ?? {},
  };

  const canvasStub = () => ({
    width: 0, height: 0, style: {},
    getContext: () => new Proxy({}, {
      get: (_t, k) => (k === 'canvas' ? canvasStub() : () => ({})),
      set: () => true,
    }),
    toDataURL: () => 'data:image/png;base64,',
  });

  const sandbox = {
    echarts,
    ecStat,
    ecSimpleTransform,
    myChart: chartStub,
    chart: chartStub,
    ROOT_PATH: SITE,
    CDN_PATH: 'https://fastly.jsdelivr.net/npm/',
    app: { config: {}, configParameters: {}, onchange: null, title: '' },
    $: makeJQuery(pending),
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: immediateTimer, setInterval: noopTimer,
    clearTimeout: () => {}, clearInterval: () => {},
    requestAnimationFrame: noopTimer, cancelAnimationFrame: () => {},
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
    Promise, Map, Set, Symbol, Error, TypeError, Intl, BigInt,
    option: undefined,
    Image: class { constructor() { this.src = ''; this.width = 0; this.height = 0; } },
    document: {
      getElementById: () => null,
      createElement: (tag) => (tag === 'canvas' ? canvasStub() : { style: {} }),
      addEventListener: () => {},
    },
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};
  sandbox.innerWidth = 800;
  sandbox.innerHeight = 500;
  sandbox.devicePixelRatio = 1;

  const ctx = createContext(sandbox);
  runInContext(js, ctx, { timeout: 20000, filename: `${id}.js` });

  // 异步取数的例子在 $.get 回调里才写 option，等一轮 pending 再读
  for (let round = 0; round < 4 && pending.length; round++) {
    const batch = pending.splice(0, pending.length);
    try { await Promise.all(batch); } catch (e) { asyncError ??= e; }
  }
  // 让例子自己排的 .then 链跑完，unhandledRejection 才有机会落到钩子上
  await new Promise((r) => setImmediate(r));

  const fromGlobal = ctx.option;
  const substantive = (o) => o && typeof o === 'object' &&
    (o.series !== undefined || o.dataset !== undefined || o.baseOption !== undefined);

  const chosen = substantive(fromGlobal)
    ? fromGlobal
    : setOptionCalls.filter(substantive).pop();

  if (!chosen) {
    throw new Error(asyncError ? String(asyncError.message ?? asyncError) : '求值后没有拿到含 series/dataset 的 option');
  }
  return toPlain(chosen);
}

// ---------------------------------------------------------------- 体积控制

/**
 * 单个例子文件的上限。超过就等距抽稀数据，否则整个 gallery 会有近百 MB。
 * 量的是**落盘文本**的长度，不是紧凑 JSON 的长度 —— 两者能差出两三倍，
 * 按紧凑长度设限的话，结构复杂的例子仍然会写出近百 KB 的文件。
 */
const MAX_EXAMPLE_BYTES = 30_000;
/**
 * 抽稀时依次尝试的数组长度下限。
 *
 * 从 200 开始，是因为多数图表抽掉短数组只会破坏图形、省不下字节。
 * 但树形数据（treemap / graph 的 children）每层都只有几十个节点，
 * 200 的下限对它们完全不起作用 —— 光调步长永远压不下来，
 * 所以还要有一条往下放宽下限的退路。
 */
const SAMPLE_FLOORS = [200, 60, 20, 8];

/** 这些子树里的数组不抽稀：抽 legend.data 会让图例和系列对不上，抽 color 会打乱配色。 */
const NEVER_SAMPLE = new Set(['legend', 'toolbox', 'visualMap', 'dataZoom', 'title', 'tooltip', 'color', 'grid']);

/**
 * 只有这些键下面的数组才抽稀 —— 它们装的是**数据**。
 *
 * 反面教训：一开始是「凡是够长的数组都抽」，结果把 `series`、`xAxis` 这种
 * **组件数组**也抽掉了。line-easing 有 31 组坐标系，series 被抽到 8 个、
 * grid 还留着 31 个，于是 `xAxisIndex: 8` 指向了一个不存在的轴，ECharts 直接报
 * `xAxis "8" not found`。组件数组的下标是被别处引用的，动不得。
 */
const SAMPLE_KEYS = new Set(['data', 'source', 'links', 'nodes', 'children', 'categories']);

const sizeOf = (o) => stringifyReadable(o).length;

/**
 * 用**同一个步长**抽稀所有长数组。
 *
 * 步长必须全局统一：K 线图的 xAxis.data 与 series.data 是等长并行的两个数组，
 * 只抽其中一个会让日期和价格整体错位，图还是画得出来，但内容是错的。
 * 统一步长且都从下标 0 起，等长数组抽完仍然等长、仍然对齐，
 * dataset.source 的表头（第 0 行）也因此一定保留。
 */
function sampleArrays(node, stride, floor, key = null, frozen = false) {
  if (Array.isArray(node)) {
    const dense = Array.from(node);
    const sampleable = !frozen && SAMPLE_KEYS.has(key) && dense.length > floor;
    const kept = sampleable ? dense.filter((_, i) => i % stride === 0) : dense;
    return kept.map((v) => sampleArrays(v, stride, floor, key, frozen));
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = sampleArrays(v, stride, floor, k, frozen || NEVER_SAMPLE.has(k));
    }
    return out;
  }
  return node;
}

/** 返回 { option, trimmed }。trimmed 为 null 表示原样收录。 */
function shrinkToFit(option) {
  const originalBytes = sizeOf(option);
  if (originalBytes <= MAX_EXAMPLE_BYTES) return { option, trimmed: null };

  const originalPoints = countPoints(option);
  let best = null;
  for (const floor of SAMPLE_FLOORS) {
    for (let stride = 2; stride <= 4096; stride *= 2) {
      const candidate = sampleArrays(option, stride, floor, null, false);
      best = { candidate, stride, floor };
      if (sizeOf(candidate) <= MAX_EXAMPLE_BYTES) {
        return {
          option: candidate,
          trimmed: { stride, floor, originalPoints, keptPoints: countPoints(candidate), originalBytes },
        };
      }
    }
  }
  return {
    option: best.candidate,
    trimmed: {
      stride: best.stride,
      floor: best.floor,
      originalPoints,
      keptPoints: countPoints(best.candidate),
      originalBytes,
    },
  };
}

const arrLen = (v) => (Array.isArray(v) ? v.length : 0);
const asArray = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : []);

/** 与 src/render/budget.ts 的 countDataPoints 同口径，用来判断是否会撞上服务端配额。 */
function countPoints(option) {
  let total = 0;
  for (const s of asArray(option.series)) total += arrLen(s?.data) + arrLen(s?.links) + arrLen(s?.nodes);
  for (const d of asArray(option.dataset)) total += arrLen(d?.source);
  return total;
}

/** 服务端 ECHARTS_MCP_MAX_DATA_POINTS 的默认值，超过这个数默认配置下会被直接拒绝。 */
const DEFAULT_POINT_BUDGET = 50_000;

// ---------------------------------------------------------------- 主流程

const list = await fetchExampleList();
const selected = list.filter((e) => e.category.some((c) => SUPPORTED.includes(c)));
console.log(`官方示例 ${list.length} 个，命中我们支持的类型 ${selected.length} 个`);

const byCategory = new Map(SUPPORTED.map((c) => [c, []]));
const failures = [];
const curated = [];

for (const meta of selected) {
  if (KNOWN_SKIP[meta.id]) {
    failures.push({ id: meta.id, reason: KNOWN_SKIP[meta.id], kind: 'unsupported' });
    continue;
  }
  if (CURATION_SKIP[meta.id]) {
    curated.push({ id: meta.id, reason: CURATION_SKIP[meta.id], kind: 'curated' });
    continue;
  }
  const ext = meta.ts ? 'ts' : 'js';
  let entry;
  try {
    const source = await getText(`${SITE}/examples/${ext}/${meta.id}.${ext}`);
    const full = await evaluateExample(meta.id, source);
    if (!full.series && !full.dataset && !full.baseOption) throw new Error('option 里没有 series');
    const { option, trimmed } = shrinkToFit(full);
    entry = {
      id: meta.id,
      title: meta.title,
      titleCN: meta.titleCN,
      difficulty: meta.difficulty,
      source: `${SITE}/examples/${ext}/${meta.id}.${ext}`,
      ...(trimmed
        ? {
            trimmed: {
              ...trimmed,
              exceedsDefaultBudget: trimmed.originalPoints > DEFAULT_POINT_BUDGET,
              note: `原始数据 ${trimmed.originalPoints} 个点、${(trimmed.originalBytes / 1024).toFixed(0)}KB，` +
                `按步长 ${trimmed.stride} 等距抽稀到 ${trimmed.keptPoints} 个点后收录。完整数据见 source。`,
            },
          }
        : {}),
      option,
    };
  } catch (e) {
    failures.push({ id: meta.id, reason: String(e.message ?? e).slice(0, 160) });
    continue;
  }
  const cat = meta.category.find((c) => SUPPORTED.includes(c));
  byCategory.get(cat).push(entry);
}

// ---------------------------------------------------------------- 序列化

/**
 * 结构缩进、数据压行的 JSON 序列化。
 *
 * 直接 `JSON.stringify(o, null, 2)` 会把每个数字单独占一行，
 * 一份 40KB 的 option 落盘变成 150KB —— 读它的是模型，那多出来的
 * 三倍全是缩进和换行，纯粹烧上下文。这里的规则很简单：
 * 紧凑写法不超过 maxInline 个字符的值就写成一行，超过才展开。
 * 于是 option 的层级结构仍然清晰，而数据行是紧凑的。
 */
function stringifyReadable(value, indent = 2, maxInline = 110, depth = 0) {
  const compact = JSON.stringify(value);
  if (compact === undefined) return 'null';
  if (compact.length <= maxInline || value === null || typeof value !== 'object') return compact;

  const pad = ' '.repeat(indent * (depth + 1));
  const closePad = ' '.repeat(indent * depth);

  if (Array.isArray(value)) {
    // 同上：稀疏数组的空洞必须显式变成 null，否则拼出来是 `[ , , ]`
    const items = Array.from(value, (v) => stringifyReadable(v, indent, maxInline, depth + 1));
    return `[\n${pad}${items.join(`,\n${pad}`)}\n${closePad}]`;
  }
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  if (!entries.length) return '{}';
  const items = entries.map(([k, v]) => `${JSON.stringify(k)}: ${stringifyReadable(v, indent, maxInline, depth + 1)}`);
  return `{\n${pad}${items.join(`,\n${pad}`)}\n${closePad}}`;
}

// ---------------------------------------------------------------- 特征标签

/**
 * 从 option 里推出「这个例子演示了什么」。
 *
 * 标签的用途是**选型之后的二次筛选**：确定了要画柱状图之后，
 * 还要在 46 个柱状图例子里挑出「堆叠的」「横向的」「带缩放的」那一个。
 * 靠标题挑不出来，靠把 46 份 option 全读一遍代价太高。
 */
function deriveTags(option) {
  const tags = new Set();
  const series = asArray(option.series);
  const axes = (a) => asArray(a).map((x) => x?.type).filter(Boolean);
  const xTypes = axes(option.xAxis);
  const yTypes = axes(option.yAxis);
  const has = (re) => re.test(JSON.stringify(option));

  if (series.length > 1) tags.add('多系列');
  if (series.some((s) => s?.stack)) tags.add('堆叠');
  if (option.polar || series.some((s) => s?.coordinateSystem === 'polar')) tags.add('极坐标');
  if (xTypes.includes('value') && yTypes.includes('category')) tags.add('横向');
  if (asArray(option.yAxis).length > 1 || asArray(option.xAxis).length > 1) tags.add('双轴');
  if (xTypes.includes('time') || yTypes.includes('time')) tags.add('时间轴');
  if (xTypes.includes('log') || yTypes.includes('log')) tags.add('对数轴');
  if (option.dataZoom) tags.add('数据缩放');
  if (option.visualMap) tags.add('视觉映射');
  if (option.timeline || option.baseOption) tags.add('时间线');
  if (option.dataset) tags.add('dataset');
  if (option.grid && asArray(option.grid).length > 1) tags.add('多宫格');
  if (series.some((s) => s?.markLine || s?.markPoint || s?.markArea)) tags.add('标注线/点');
  if (series.some((s) => s?.smooth)) tags.add('平滑');
  if (series.some((s) => s?.areaStyle)) tags.add('面积');
  if (series.some((s) => s?.step)) tags.add('阶梯');
  if (series.some((s) => s?.roseType)) tags.add('玫瑰图');
  if (series.some((s) => Array.isArray(s?.radius))) tags.add('环形');
  if (has(/"type":\s*"(linear|radial)"/) || has(/colorStops/)) tags.add('渐变色');
  if (has(/"symbol":\s*"image:\/\//)) tags.add('图片符号');
  if (has(/"rich":/)) tags.add('富文本标签');
  if (series.some((s) => s?.large)) tags.add('大数据量');
  if (series.some((s) => s?.encode)) tags.add('encode 映射');
  if (findFunctionPaths(option).length) tags.add('含函数');
  return [...tags];
}

/** 含函数字符串的字段路径。静态出图时会被服务端剥离，只有 html 输出才执行。 */
const FN_PATTERN = /^\s*(function\s*\*?\s*\(|function\s+[A-Za-z_$][\w$]*\s*\(|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/;
function findFunctionPaths(node, path = '', out = []) {
  if (typeof node === 'string') {
    if (FN_PATTERN.test(node)) out.push(path);
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => findFunctionPaths(v, `${path}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) findFunctionPaths(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

// ---------------------------------------------------------------- 落盘

/**
 * 一个例子一个文件。
 *
 * 不做成「一类一个大文件」是因为读它的是模型：确定要画堆叠柱状图之后，
 * 只需要 bar-stacked 这一份 option，不该被迫把另外 45 个柱状图例子一起读进上下文。
 * 目录索引只带标题和标签，不带 option，几 KB 就能看完全貌。
 */
mkdirSync(outDir, { recursive: true });
const catalogue = [];

for (const [cat, entries] of byCategory) {
  if (!entries.length) {
    catalogue.push({ category: cat, count: 0, dir: cat, examples: [] });
    continue;
  }
  const catDir = join(outDir, cat);
  mkdirSync(catDir, { recursive: true });

  const items = [];
  for (const e of entries) {
    const tags = deriveTags(e.option);
    const fnPaths = findFunctionPaths(e.option);
    const points = countPoints(e.option);
    const payload = {
      $comment: '由 scripts/build-gallery.mjs 从官方示例求值生成。option 可直接作为 render_option 的参数。',
      id: e.id,
      category: cat,
      title: e.title,
      titleCN: e.titleCN,
      difficulty: e.difficulty,
      tags,
      points,
      upstream: e.source,
      ...(e.trimmed ? { trimmed: e.trimmed } : {}),
      ...(fnPaths.length
        ? {
            functionFields: fnPaths,
            functionNote: '这些字段是函数字符串：svg/png 输出会被剥离，只有 output=html 由浏览器执行。',
          }
        : {}),
      option: e.option,
    };
    const file = `${cat}/${e.id}.json`;
    const text = `${stringifyReadable(payload)}\n`;
    // 自定义序列化器出过 bug（稀疏数组写成裸逗号），落盘前必须回读验证一次，
    // 否则坏文件要等到有人去读它才暴露
    try {
      JSON.parse(text);
    } catch (err) {
      throw new Error(`${e.id} 序列化后不是合法 JSON：${err.message}`);
    }
    writeFileSync(join(outDir, file), text);
    items.push({
      id: e.id,
      titleCN: e.titleCN,
      title: e.title,
      tags,
      points,
      file,
      bytes: statSync(join(outDir, file)).size,
      trimmed: Boolean(e.trimmed),
      functions: fnPaths.length > 0,
    });
  }
  catalogue.push({ category: cat, count: items.length, dir: cat, examples: items });
}

writeFileSync(
  join(outDir, 'index.json'),
  `${stringifyReadable({
    $comment:
      '顶层目录，只有 18 个类目名和数量。挑定类型后读 references/gallery/<类型>.md 选例子，' +
      '再读 examples/gallery/<类型>/<id>.json 拿 option。不要一次把整个 gallery 读进上下文。' +
      '由 scripts/build-gallery.mjs 生成，不要手改。',
    upstream: `${SITE}/zh/index.html`,
    generatedFrom: 'apache/echarts-examples',
    pointBudget: DEFAULT_POINT_BUDGET,
    curatedOut: curated,
    categories: catalogue.map((c) => ({
      category: c.category,
      count: c.count,
      catalogue: `references/gallery/${c.category}.md`,
      files: `examples/gallery/${c.category}/<id>.json`,
    })),
    skipped: failures,
  })}\n`,
);

// ---------------------------------------------------------------- 目录文档

const docsDir = join(skillRoot, 'references/gallery');
mkdirSync(docsDir, { recursive: true });

const mdCell = (v) => String(v).replace(/\|/g, '\\|');
const profileOf = (cat) => CHART_PROFILES[cat] ?? { cn: cat, data: '—', question: '—', topics: '—', avoid: '—' };

for (const cat of catalogue) {
  const pf = profileOf(cat.category);
  const curatedHere = curated.filter((c) => c.id.startsWith(cat.category));
  const rows = cat.examples.map((e) => {
    const flags = [e.trimmed ? '抽稀' : '', e.functions ? '含函数' : ''].filter(Boolean).join('、');
    return `| \`${e.id}\` | ${mdCell(e.titleCN)} | ${mdCell(e.title)} | ${e.tags.join('、') || '—'} | ${e.points} | ${flags || '—'} |`;
  });
  const body = [
    `# ${pf.cn}（\`${cat.category}\`）`,
    '',
    '## 什么时候用它',
    '',
    `| | |`,
    `|---|---|`,
    `| **适合的数据** | ${mdCell(pf.data)} |`,
    `| **回答的问题** | ${mdCell(pf.question)} |`,
    `| **典型主题** | ${mdCell(pf.topics)} |`,
    `| **别用它当** | ${mdCell(pf.avoid)} |`,
    '',
    `展开的适用性讨论与常见误用见 \`references/choosing-and-options.md\`。`,
    '',
    `## 官方示例 ${cat.count} 个`,
    '',
    ...(cat.count === 0
      ? [
          '官方图库里这一类的例子**一个都没有收录**，理由在下面。',
          `要画 \`${cat.category}\`，用 \`generate_chart\` 的模板 —— 模板产出的是分析场景该有的形态，`,
          '数据与样式分离，主题也能完全生效。',
        ]
      : [
          `option 在 \`examples/gallery/${cat.category}/<id>.json\` 的 \`option\` 字段，`,
          '直接作为 `render_option` 的参数即可。**只读你要用的那一个，不要把整个目录读进上下文。**',
          '',
          '「标签」是从 option 里推出来的特征，用来在同类里二次筛选；',
          '「抽稀」表示原始数据过大、已等距抽稀，完整数据见文件里的 `upstream`；',
          '「含函数」表示 option 里有函数字符串，svg/png 输出会剥离它，只有 `output: "html"` 才执行。',
          '',
          '| id | 名称 | English | 标签 | 数据点 | 备注 |',
          '|---|---|---|---|---|---|',
          ...rows,
        ]),
    '',
    ...(curatedHere.length
      ? [
          '## 主动剔除的官方例子',
          '',
          '这些能渲染出来，但对数据分析没有实际用处，所以不收录：',
          '',
          ...curatedHere.map((c) => `- \`${c.id}\` —— ${c.reason}`),
          '',
        ]
      : []),
  ].join('\n');
  writeFileSync(join(docsDir, `${cat.category}.md`), body);
}

// 总入口：选型表 + 每类的例子数与去处。读者读完这一份就该知道去开哪个文件。
const entry = [
  '# 图表选型与官方示例总索引',
  '',
  `覆盖 Apache ECharts 官方示例库里属于我们支持的 15 种类型的全部例子，共 ${catalogue.reduce((n, c) => n + c.count, 0)} 个。`,
  '',
  '## 怎么用这份索引',
  '',
  '**三步，每步只读一个文件，不要一次把 gallery 全部读进来。**',
  '',
  '1. 用下面的「选型表」根据用户的问题和数据形态定类型 —— 看的是**要回答什么问题**，不是数据长什么样',
  '2. 打开 `references/gallery/<类型>.md`，在例子表里按标签挑一个最接近的',
  '3. 读 `examples/gallery/<类型>/<id>.json`，取它的 `option` 字段传给 `render_option`',
  '',
  '想要的是本工具模板化的调用方式（`generate_chart` + `data` + `optionOverrides`）而不是裸 option，',
  '先看 `examples/examples.json`：18 个精选、已验证的 `generate_chart` payload，常规需求到这一步就够了。',
  '',
  '两者的分工：`examples.json` 是**我们工具的惯用写法**，数据与样式分离、有主题和留白默认值；',
  'gallery 是**官方原样的 option**，覆盖面广但要自己管全部字段。常规图表优先前者。',
  '',
  '## 选型表',
  '',
  '| 类型 | 适合的数据 | 回答的问题 | 典型主题 | 例子 |',
  '|---|---|---|---|---|',
  ...catalogue.map((c) => {
    const pf = profileOf(c.category);
    const cell = c.count === 0 ? `[无，见说明](gallery/${c.category}.md)` : `[${c.count} 个](gallery/${c.category}.md)`;
    return `| \`${c.category}\` ${pf.cn} | ${mdCell(pf.data)} | ${mdCell(pf.question)} | ${mdCell(pf.topics)} | ${cell} |`;
  }),
  '',
  '## 什么时候别用它',
  '',
  '选型最容易错的地方不是「想不到用哪个」，而是「用了看起来像但答非所问的那个」。',
  '',
  '| 类型 | 别用它当 |',
  '|---|---|',
  ...catalogue.map((c) => `| \`${c.category}\` | ${mdCell(profileOf(c.category).avoid)} |`),
  '',
  '## 覆盖范围',
  '',
  `官方示例库共 ${list.length} 个例子，其中 ${selected.length} 个属于我们支持的 15 种类型，已收录 ${catalogue.reduce((n, c) => n + c.count, 0)} 个。`,
  '',
  '**画不出来的**（能力边界，理由逐条列在 `references/gallery-support.md`）：',
  '',
  ...(failures.length ? failures.map((f) => `- \`${f.id}\` —— ${f.reason}`) : ['- 无']),
  '',
  '**画得出来但没有收录的**（取舍，不是能力问题）：',
  '',
  ...(curated.length ? curated.map((f) => `- \`${f.id}\` —— ${f.reason}`) : ['- 无']),
  '',
  '`map` / `geo` / `lines` / `custom` / `matrix` / `calendar` 等类型本工具不支持，因此不在收录范围内。',
  '用户要地图时直接说明不支持，不要拿散点图顶替。',
  '',
  '渲染实测结果（浅色与深色两种模式）见 `references/gallery-support.md`。',
  '',
].join('\n');
writeFileSync(join(skillRoot, 'references/gallery.md'), entry);

const total = catalogue.reduce((n, c) => n + c.count, 0);
console.log(`\n落盘 ${total} 个例子（一个例子一个文件），分布：`);
for (const c of catalogue) {
  const big = c.examples.filter((e) => e.trimmed).length;
  console.log(`  ${c.category.padEnd(14)} ${String(c.count).padStart(3)}${big ? `  (${big} 个抽稀过)` : ''}`);
}
if (failures.length) {
  console.log(`\n画不出来、未收录 ${failures.length} 个：`);
  for (const f of failures) console.log(`  ${f.id.padEnd(34)} ${f.reason}`);
}
if (curated.length) {
  console.log(`\n主动剔除 ${curated.length} 个（画得出来但没用）：`);
  for (const f of curated) console.log(`  ${f.id.padEnd(34)} ${f.reason}`);
}
