import { ChartError, ErrorCode } from '../errors.js';
import type { McpContent } from '../deliver/deliver.js';

/**
 * 把异常转成 MCP 工具错误结果。
 *
 * 错误文本必须包含 code 与出错字段 —— LLM 靠这两项才能定位问题并自我修正后重试。
 * 只说「渲染失败」的话，它只会原样再发一次。
 */
export function toToolError(e: unknown): { content: McpContent[]; isError: true } {
  const isChart = e instanceof ChartError;
  const code = isChart ? e.code : ErrorCode.InvalidOption;
  const field = isChart && e.field ? `（字段：${e.field}）` : '';
  const message = e instanceof Error ? e.message : String(e);
  return {
    content: [{ type: 'text', text: `[${code}]${field} ${message}` }],
    isError: true,
  };
}

/** option 序列化体积上限。防止 LLM 把整张表塞进来打爆内存。 */
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
