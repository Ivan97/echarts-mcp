import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { serializeOptionWithFunctions } from '../option/functions.js';
import { SHELL_COLORS, THEME_FONT_STACK } from '../option/themes.js';
import type { RenderSize } from '../render/types.js';

const require = createRequire(import.meta.url);
let cachedRuntime: string | undefined;

/** ECharts 运行时只读一次并缓存。每次出 html 都读一遍 1MB 文件没有意义。 */
function echartsRuntime(): string {
  cachedRuntime ??= readFileSync(require.resolve('echarts/dist/echarts.min.js'), 'utf8');
  return cachedRuntime;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/**
 * 页面主题锁定到图表主题。
 *
 * 页面只有一个主题，不允许外壳与图表一浅一深。调用方选了 dark 主题，
 * 整个页面就是深色的，不跟随查看者的系统设置 —— 否则深色图表配浅色外壳，
 * 图里的浅色文字会直接看不见。
 */
function shellThemeOf(option: object): 'light' | 'dark' {
  const bg = (option as { backgroundColor?: unknown }).backgroundColor;
  if (typeof bg !== 'string') return 'light';
  const hex = bg.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(hex)) return 'light';
  // 按感知亮度判断，不是简单比较三通道均值
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5 ? 'dark' : 'light';
}

/**
 * 生成不依赖外部网络的单文件 HTML。
 *
 * option 中的函数字符串在此原样写入，由浏览器执行；服务端不 eval。
 * 视觉语言取自 Apple 的系统色与系统字体栈；卡片的半透明质感是
 * backdrop-filter 近似，**不是** Apple 的 Liquid Glass 材质
 * （那是 Apple 平台专有的，没有官方 web 实现）。
 */
interface TitleBlock {
  text?: unknown;
  subtext?: unknown;
}

/**
 * 标题只能出现一次。
 *
 * 图表 option 里通常已经带了 title，页面外壳又要一个大标题，
 * 两者都渲染就会把同一句话画两遍。这里把标题**上提**到页面 h1，
 * 并从传给 ECharts 的 option 中移除，图表本身保持干净。
 */
function hoistTitle(
  option: object,
  explicit?: string,
): { heading: string; sub: string; option: object } {
  const t = (option as { title?: TitleBlock }).title;
  const heading = explicit ?? (typeof t?.text === 'string' ? t.text : '');
  const sub = typeof t?.subtext === 'string' ? t.subtext : '';
  if (!heading && !sub) return { heading: '', sub: '', option };
  const { title: _dropped, ...rest } = option as Record<string, unknown>;
  return { heading, sub, option: reclaimTitleSpace(rest) };
}

/**
 * 标题被上提到页面后，模板为它预留的 grid.top 就成了纯浪费的留白。
 * 这里把它收回来。只处理明确留了大间距的情况，不动调用方自己设的紧凑值。
 */
function reclaimTitleSpace(option: Record<string, unknown>): Record<string, unknown> {
  const grid = option.grid;
  if (!grid || typeof grid !== 'object' || Array.isArray(grid)) return option;
  const top = (grid as { top?: unknown }).top;
  if (typeof top !== 'number' || top < 60) return option;
  return { ...option, grid: { ...(grid as object), top: 28 } };
}

export function buildStandaloneHtml(option: object, size: RenderSize, title?: string): string {
  const theme = shellThemeOf(option);
  const c = SHELL_COLORS[theme];
  const hoisted = hoistTitle(option, title);
  const heading = hoisted.heading ? escapeHtml(hoisted.heading) : '';
  const sub = hoisted.sub ? escapeHtml(hoisted.sub) : '';
  const chartOption = hoisted.option;

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${heading || 'ECharts'}</title>
<style>
  :root {
    --bg: ${c.bg};
    --surface: ${theme === 'dark' ? 'rgba(38,38,40,0.72)' : 'rgba(255,255,255,0.72)'};
    --text: ${c.text};
    --muted: ${c.muted};
    --hairline: ${c.hairline};
    --radius: 18px;
    --shadow: ${
      theme === 'dark'
        ? '0 1px 2px rgba(0,0,0,0.5), 0 24px 60px -20px rgba(0,0,0,0.7)'
        : '0 1px 2px rgba(29,29,31,0.06), 0 24px 60px -20px rgba(29,29,31,0.18)'
    };
    --font: ${THEME_FONT_STACK};
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 40px 24px;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    -webkit-font-smoothing: antialiased;
  }

  header {
    max-width: ${size.width}px;
    text-align: center;
  }

  h1 {
    margin: 0;
    font-size: clamp(21px, 2.4vw, 30px);
    font-weight: 600;
    /* Apple 在大字号上收紧字距，小字号放松 */
    letter-spacing: -0.021em;
    line-height: 1.15;
  }

  header p {
    margin: 7px 0 0;
    font-size: 15px;
    line-height: 1.4;
    color: var(--muted);
  }

  .surface {
    padding: 20px;
    border-radius: var(--radius);
    border: 1px solid var(--hairline);
    background: var(--surface);
    box-shadow: var(--shadow);
    /* Apple 平台的 Liquid Glass 无官方 web 实现，这里是 backdrop-filter 近似 */
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    max-width: 100%;
    overflow-x: auto;
  }

  #chart {
    width: ${size.width}px;
    height: ${size.height}px;
    max-width: 100%;
  }

  @media (prefers-reduced-transparency: reduce) {
    .surface {
      background: var(--bg);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    header, .surface {
      animation: rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .surface { animation-delay: 0.06s; }
    @keyframes rise {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: none; }
    }
  }
</style>
</head>
<body>
${heading || sub ? `<header>${heading ? `<h1>${heading}</h1>` : ''}${sub ? `<p>${sub}</p>` : ''}</header>` : ''}
<div class="surface"><div id="chart"></div></div>
<script>${echartsRuntime()}</script>
<script>
  var option = ${serializeOptionWithFunctions(chartOption)};
  // 静态出图时动画是关闭的；页面版是交互式的，把它打开
  option.animation = true;
  option.backgroundColor = 'transparent';
  var el = document.getElementById('chart');
  var chart = echarts.init(el);
  chart.setOption(option);
  window.addEventListener('resize', function () { chart.resize(); });
</script>
</body>
</html>`;
}
