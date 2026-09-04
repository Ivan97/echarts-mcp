import type { Dataset } from '../types.js';
import { ChartError, ErrorCode } from '../errors.js';
import type { TemplateInput } from './registry.js';

/** 校验并取出表格型数据。三组模板文件共用，避免重复实现。 */
export function asDataset(input: TemplateInput): Dataset {
  const d = input.data as Dataset;
  if (!d || !Array.isArray(d.dimensions) || !Array.isArray(d.source)) {
    throw new ChartError(
      ErrorCode.InvalidInput,
      '该图表类型要求 data 为 { dimensions: string[], source: 行数组 } 结构',
      'data',
    );
  }
  return d;
}

/** 把 source 统一成二维数组。对象行按 dimensions 顺序取值。 */
export function rows(data: Dataset): unknown[][] {
  return data.source.map((row) =>
    Array.isArray(row) ? row : data.dimensions.map((dim) => (row as Record<string, unknown>)[dim]),
  );
}

export function titleOf(input: TemplateInput): { text?: string; subtext?: string } {
  return { text: input.title, subtext: input.subtitle };
}

/** 要求 dimensions 恰好 n 项的类型使用。维度数不对时报错必须说清期望值，LLM 才能自我修正。 */
export function fixedDims(input: TemplateInput, n: number, label: string): unknown[][] {
  const data = asDataset(input);
  if (data.dimensions.length !== n) {
    throw new ChartError(
      ErrorCode.InvalidInput,
      `${label} 要求 dimensions 恰好 ${n} 项，收到 ${data.dimensions.length} 项`,
      'data',
    );
  }
  return rows(data);
}
