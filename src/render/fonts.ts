import { existsSync } from 'node:fs';

/**
 * 常见平台上「能覆盖中英文」的字体文件位置。
 *
 * 为什么要列这张表：resvg 的 `loadSystemFonts: true` 每次构造都会重扫全部系统字体。
 * 实测（macOS，600x400 柱状图带中文，输出 1200px 宽）：
 *
 * | 字体策略 | 单图耗时 | 中文 |
 * |---|---|---|
 * | `loadSystemFonts: true` | 232ms | 正常 |
 * | 显式 fontFiles（含 22MB 的 CJK 字体） | **95ms** | 正常 |
 * | 只加载拉丁字体 | 18ms | **丢字** |
 * | 不加载任何字体 | 10ms | **全部文字丢失** |
 *
 * 真实收益是 2.4 倍（232 → 95ms），不是更高。
 * **开销几乎全部来自 CJK 字体本身**：Hiragino Sans GB 有 22.4MB，
 * resvg 每次构造都要重新解析，而 resvg-js 没有提供复用 font database 的接口。
 * 实测把文件数从 4 个减到 1 个 CJK 字体反而没有变快（94.7ms vs 108.6ms，在噪声范围内），
 * 说明瓶颈是 CJK 字体的体积而非文件数量。
 *
 * 结论：只要要渲染中文，PNG 单图就下不到 90ms 以内。
 * 默认输出走 SVG（2ms）正是为了避开这条路径。
 *
 * 表里一个都没命中时必须退回全量扫描 —— 宁可慢，不能丢字。
 */
const CANDIDATES = [
  // macOS
  '/System/Library/Fonts/PingFang.ttc',
  '/System/Library/Fonts/Hiragino Sans GB.ttc',
  '/System/Library/Fonts/Helvetica.ttc',
  '/System/Library/Fonts/HelveticaNeue.ttc',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  // Debian / Ubuntu，对应 Dockerfile 里安装的 fonts-noto-cjk 与 fonts-dejavu-core
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  // Alpine
  '/usr/share/fonts/noto/NotoSansCJK-Regular.ttc',
];

export interface FontStrategy {
  loadSystemFonts: boolean;
  fontFiles?: string[];
  defaultFontFamily?: string;
}

let cached: FontStrategy | undefined;

/**
 * 决定并缓存字体策略。只在首次调用时探测文件系统。
 * `override` 来自配置，用于容器里自带字体的场景。
 */
export function fontStrategy(override?: string[]): FontStrategy {
  if (cached) return cached;

  const files = (override?.length ? override : CANDIDATES).filter((f) => existsSync(f));
  cached = files.length
    ? { loadSystemFonts: false, fontFiles: files, defaultFontFamily: 'PingFang SC' }
    : // 一个都没命中，只能退回全量扫描。慢，但不会丢字。
      { loadSystemFonts: true };
  return cached;
}

/** 仅供测试使用：清掉缓存以便验证不同分支。 */
export function resetFontCache(): void {
  cached = undefined;
}
