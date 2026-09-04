import { DeliveryChannel, DeliveryRequest, OutputFormat, TransportKind } from '../types.js';

export interface ResolveInput {
  transport: TransportKind;
  output?: OutputFormat;
  delivery?: DeliveryRequest;
}

export interface Resolved {
  output: OutputFormat;
  channel: DeliveryChannel;
  /** 告知调用方哪些请求被静默调整过。LLM 需要知道自己的参数为什么没被照办。 */
  notes: string[];
}

/**
 * 推导实际使用的输出格式与交付通道。
 *
 * 规则来自 spec §8.1，核心是「按传输方式选最省 token 的默认值」：
 * stdio 写本地盘（客户端能直接打开），HTTP 给链接（对话里只占一行）。
 */
export function resolveDelivery(input: ResolveInput): Resolved {
  const notes: string[] = [];
  const delivery = input.delivery ?? DeliveryRequest.Auto;
  const isStdio = input.transport === TransportKind.Stdio;

  // option 体积小，恒以文本直接返回
  if (input.output === OutputFormat.Option) {
    return { output: OutputFormat.Option, channel: DeliveryChannel.Raw, notes };
  }

  // html 内联了 ECharts 运行时，达 MB 量级，禁止内联与直接返回文本
  if (input.output === OutputFormat.Html) {
    if (delivery === DeliveryRequest.Inline) {
      notes.push(
        'html 产物内联了 ECharts 运行时（MB 量级），不支持内联返回，已改为写文件或上传后返回链接。',
      );
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
