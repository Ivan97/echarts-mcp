import { ChartError, ErrorCode } from '../errors.js';

function lengthOf(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function asList(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (v && typeof v === 'object') return [v as Record<string, unknown>];
  return [];
}

/**
 * 展开 option 里所有「放得下 series 的层」。
 *
 * timeline 配置（`{ baseOption, options }`）把 series 藏在下一层，顶层是空的。
 * 只看顶层会得到 0 —— 对配额来说等于整类 option 直接绕过预检，
 * 对空图检测来说等于给一张好图误报「空图」。两个方向都错，所以统一在这里展开。
 */
export function optionLayers(option: object): Record<string, unknown>[] {
  const o = option as { baseOption?: unknown; options?: unknown };
  const layers: Record<string, unknown>[] = [option as Record<string, unknown>];

  if (o.baseOption && typeof o.baseOption === 'object') {
    layers.push(o.baseOption as Record<string, unknown>);
  }
  if (Array.isArray(o.options)) {
    for (const frame of o.options) {
      if (frame && typeof frame === 'object') layers.push(frame as Record<string, unknown>);
    }
  }
  return layers;
}

/**
 * 估算一份 option 会画多少个数据点。
 *
 * 用数据点总数而不是序列化字节数做配额，是因为它更贴近真实渲染开销：
 * 一份 200KB 但只有 50 个点的 option 渲染很快，
 * 一份 50KB 但有 20 万个点的 option 会把进程拖死。
 *
 * timeline 的各帧是累加的：虽然同一时刻只画一帧，但所有帧都要传输和解析，
 * 累加才是这份 option 真实的分量。
 */
export function countDataPoints(option: object): number {
  let total = 0;

  for (const layer of optionLayers(option)) {
    for (const s of asList(layer.series)) {
      total += lengthOf(s?.data) + lengthOf(s?.links) + lengthOf(s?.nodes);
    }
    for (const d of asList(layer.dataset)) {
      total += lengthOf(d?.source);
    }
  }
  return total;
}

/**
 * 渲染前的预防性配额。
 *
 * 注意这不是「超时」：ECharts SSR 与 resvg 都是同步调用，同步代码占住事件循环时
 * 定时器根本没机会触发，Promise.race 式的超时拦不住任何东西。
 * 能真正拦住的只有渲染前的准入检查。
 */
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
