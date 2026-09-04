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

/**
 * 深合并 option 片段，返回新对象，绝不修改入参。
 *
 * 数组语义为**按索引逐项合并**而非整体替换 —— ECharts 的 series 是数组，
 * 调用方常常只想改其中一条系列的某个字段，整体替换会把模板产出的 data 全丢掉。
 */
export function deepMerge<T extends object>(base: T, patch?: Record<string, unknown>): T {
  const out: Record<string, unknown> = Array.isArray(base)
    ? ([...(base as unknown[])] as unknown as Record<string, unknown>)
    : { ...(base as Record<string, unknown>) };
  if (!patch) return out as T;
  for (const key of Object.keys(patch)) {
    out[key] = mergeValue((base as Record<string, unknown>)[key], patch[key]);
  }
  return out as T;
}
