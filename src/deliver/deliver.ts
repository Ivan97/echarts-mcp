import type { EChartsOption } from 'echarts';
import { DeliveryChannel, OutputFormat } from '../types.js';
import { partitionFunctions } from '../option/functions.js';
import { buildStandaloneHtml } from '../html/standalone.js';
import { EMPTY_CHART_HINT, looksEmpty } from '../render/empty-check.js';
import type { Renderer, RenderSize } from '../render/types.js';
import type { StorageAdapter } from './types.js';
import { markdownFor, markdownForOption } from './markdown.js';
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
async function produce(
  args: DeliverArgs,
  notes: string[],
): Promise<{ bytes: Buffer; mimeType: string }> {
  if (args.resolved.output === OutputFormat.Html) {
    // html 由浏览器执行，函数字符串原样保留
    return {
      bytes: Buffer.from(buildStandaloneHtml(args.option, args.size, args.title), 'utf8'),
      mimeType: 'text/html',
    };
  }

  // 静态图不执行 JS。函数字段留着不会生效，反而会被 ECharts 当成普通字符串画出来。
  const { sanitized, functionPaths } = partitionFunctions(args.option);
  if (functionPaths.length > 0) {
    notes.push(
      `静态图不支持函数值，已忽略以下字段：${functionPaths.join('、')}。` +
        '如需函数生效，请改用 output: "html"。',
    );
  }

  const result = await args.renderer.render(sanitized as EChartsOption, args.size);
  // ECharts 对非法 option 不抛错，只会静默画空图，所以必须主动检测
  if (result.mimeType === 'image/svg+xml' && looksEmpty(result.bytes.toString('utf8'))) {
    notes.push(EMPTY_CHART_HINT);
  }
  return result;
}

export async function deliver(args: DeliverArgs): Promise<McpContent[]> {
  const notes = [...args.resolved.notes];

  if (args.resolved.output === OutputFormat.Option) {
    // option 原样返回（含函数字符串），由调用方前端自行决定如何处理
    return withNotes(notes, [{ type: 'text', text: markdownForOption(args.option) }]);
  }

  const { bytes, mimeType } = await produce(args, notes);

  if (args.resolved.channel === DeliveryChannel.Inline) {
    return withNotes(notes, [{ type: 'image', data: bytes.toString('base64'), mimeType }]);
  }
  if (args.resolved.channel === DeliveryChannel.Raw) {
    return withNotes(notes, [{ type: 'text', text: bytes.toString('utf8') }]);
  }

  const stored = await args.store.put(bytes, mimeType);
  return withNotes(notes, [
    { type: 'text', text: markdownFor(args.resolved.channel, args.resolved.output, stored, args.title) },
  ]);
}

/** notes 放在最前面。LLM 先看到「你的参数被改了」才不会以为工具没照办。 */
function withNotes(notes: string[], content: McpContent[]): McpContent[] {
  return notes.length ? [{ type: 'text', text: notes.join('\n') }, ...content] : content;
}
