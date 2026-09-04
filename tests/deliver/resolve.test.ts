import { describe, it, expect } from 'vitest';
import { DeliveryChannel, DeliveryRequest, OutputFormat, TransportKind } from '../../src/types.js';
import { resolveDelivery } from '../../src/deliver/resolve.js';

describe('resolveDelivery', () => {
  it('stdio 默认走 file + svg', () => {
    expect(resolveDelivery({ transport: TransportKind.Stdio })).toMatchObject({
      output: OutputFormat.Svg,
      channel: DeliveryChannel.File,
    });
  });

  it('http 默认走 url + svg', () => {
    expect(resolveDelivery({ transport: TransportKind.Http })).toMatchObject({
      output: OutputFormat.Svg,
      channel: DeliveryChannel.Url,
    });
  });

  it('显式 inline 时强制输出 png 并给出说明', () => {
    const r = resolveDelivery({
      transport: TransportKind.Stdio,
      delivery: DeliveryRequest.Inline,
      output: OutputFormat.Svg,
    });
    expect(r.output).toBe(OutputFormat.Png);
    expect(r.channel).toBe(DeliveryChannel.Inline);
    expect(r.notes.join()).toMatch(/png/i);
  });

  it('inline 且本来就要 png 时不产生多余说明', () => {
    const r = resolveDelivery({
      transport: TransportKind.Stdio,
      delivery: DeliveryRequest.Inline,
      output: OutputFormat.Png,
    });
    expect(r.notes).toEqual([]);
  });

  it('output 为 option 时恒走 raw，忽略 delivery', () => {
    const r = resolveDelivery({
      transport: TransportKind.Http,
      output: OutputFormat.Option,
      delivery: DeliveryRequest.Inline,
    });
    expect(r.channel).toBe(DeliveryChannel.Raw);
  });

  it('output 为 html 时 stdio 走 file、http 走 url，且拒绝 inline', () => {
    expect(resolveDelivery({ transport: TransportKind.Stdio, output: OutputFormat.Html }).channel).toBe(
      DeliveryChannel.File,
    );
    expect(resolveDelivery({ transport: TransportKind.Http, output: OutputFormat.Html }).channel).toBe(
      DeliveryChannel.Url,
    );
    const forced = resolveDelivery({
      transport: TransportKind.Http,
      output: OutputFormat.Html,
      delivery: DeliveryRequest.Inline,
    });
    expect(forced.channel).toBe(DeliveryChannel.Url);
    expect(forced.notes.join()).toMatch(/html/i);
  });

  it('显式 url 时即使 stdio 也走 url', () => {
    expect(resolveDelivery({ transport: TransportKind.Stdio, delivery: DeliveryRequest.Url }).channel).toBe(
      DeliveryChannel.Url,
    );
  });

  it('显式 file 时即使 http 也走 file', () => {
    expect(resolveDelivery({ transport: TransportKind.Http, delivery: DeliveryRequest.File }).channel).toBe(
      DeliveryChannel.File,
    );
  });
});
