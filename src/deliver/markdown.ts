import { DeliveryChannel, OutputFormat } from '../types.js';
import type { StoredObject } from './types.js';

/**
 * alt 文本里的方括号会破坏 markdown 图片语法，必须转义。
 * 标题「销售[华东]」不处理的话会把 `![销售[华东]](url)` 解析坏。
 */
function escapeAlt(s: string): string {
  return s.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

/**
 * 把交付结果写成 Markdown。
 *
 * 为什么不返回裸路径或裸 URL：支持 markdown 的客户端会把 `![](url)` 直接渲染成图，
 * 用户不用再点一次链接。对照组 antvis/mcp-server-chart 返回的就是裸 URL 字符串。
 */
export function markdownFor(
  channel: DeliveryChannel,
  output: OutputFormat,
  stored: StoredObject,
  title?: string,
): string {
  const alt = escapeAlt(title?.trim() || '图表');

  // html 是一个页面而非图片，用链接语法；图片语法对它没有意义
  if (output === OutputFormat.Html) {
    const link = `[在浏览器中打开：${alt}](${stored.url})`;
    return channel === DeliveryChannel.File ? `${link}\n\n${stored.path}` : link;
  }

  const image = `![${alt}](${stored.url})`;
  // file 通道额外给出纯路径：IDE 里路径可以直接点开，而 file:// 图片多数客户端不渲染
  return channel === DeliveryChannel.File ? `${image}\n\n${stored.path}` : image;
}

/** option JSON 用代码围栏包裹，裸 JSON 在对话里既难读也无法折叠。 */
export function markdownForOption(option: object): string {
  return `\`\`\`json\n${JSON.stringify(option, null, 2)}\n\`\`\``;
}
