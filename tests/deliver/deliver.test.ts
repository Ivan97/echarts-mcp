import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChartType, DeliveryChannel, OutputFormat } from '../../src/types.js';
import { registerCartesianTemplates } from '../../src/charts/cartesian.js';
import { CHART_TEMPLATES } from '../../src/charts/registry.js';
import { buildOption } from '../../src/option/build.js';
import { SvgRenderer } from '../../src/render/svg.js';
import { ResvgRenderer } from '../../src/render/resvg.js';
import { LocalDiskStore } from '../../src/deliver/local-disk.js';
import { deliver } from '../../src/deliver/deliver.js';

const SIZE = { width: 600, height: 400 };
let dir: string;

beforeAll(() => registerCartesianTemplates());
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'echarts-deliver-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const opt = () => buildOption({ type: ChartType.Bar, data: CHART_TEMPLATES[ChartType.Bar]!.example });
const store = (publicUrl?: string) => new LocalDiskStore(dir, 3600, publicUrl);
const textOf = (content: { text?: string }[]) => content.map((c) => c.text ?? '').join('\n');

describe('deliver', () => {
  it('inline 通道返回 image content，data 为 base64 PNG', async () => {
    const out = await deliver({
      option: opt(),
      size: SIZE,
      renderer: new ResvgRenderer(1),
      store: store(),
      resolved: { output: OutputFormat.Png, channel: DeliveryChannel.Inline, notes: [] },
    });
    const image = out.find((c) => c.type === 'image')!;
    expect(image.mimeType).toBe('image/png');
    expect(Buffer.from(image.data!, 'base64').subarray(0, 4)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
  });

  it('url 通道返回 Markdown 图片语法', async () => {
    const out = await deliver({
      option: opt(),
      size: SIZE,
      renderer: new SvgRenderer(),
      store: store('https://cdn.example.com'),
      title: '季度销量',
      resolved: { output: OutputFormat.Svg, channel: DeliveryChannel.Url, notes: [] },
    });
    expect(textOf(out)).toMatch(/^!\[季度销量\]\(https:\/\/cdn\.example\.com\/files\/[0-9a-f]{32}\.svg\)$/);
  });

  it('file 通道给出 Markdown 图片加纯路径，且文件确实存在', async () => {
    const out = await deliver({
      option: opt(),
      size: SIZE,
      renderer: new SvgRenderer(),
      store: store(),
      resolved: { output: OutputFormat.Svg, channel: DeliveryChannel.File, notes: [] },
    });
    const text = textOf(out);
    expect(text).toContain('![图表](file://');
    const path = text.match(/^(\/[^\s]+\.svg)$/m)![1];
    expect(readFileSync(path, 'utf8').startsWith('<svg')).toBe(true);
  });

  it('标题里的方括号被转义，不破坏 markdown 结构', async () => {
    const out = await deliver({
      option: opt(),
      size: SIZE,
      renderer: new SvgRenderer(),
      store: store('https://x.dev'),
      title: '销售[华东]',
      resolved: { output: OutputFormat.Svg, channel: DeliveryChannel.Url, notes: [] },
    });
    expect(textOf(out)).toContain('![销售\\[华东\\]](https://x.dev/');
  });

  it('option 输出用 json 代码围栏包裹', async () => {
    const out = await deliver({
      option: opt(),
      size: SIZE,
      renderer: new SvgRenderer(),
      store: store(),
      resolved: { output: OutputFormat.Option, channel: DeliveryChannel.Raw, notes: [] },
    });
    const text = textOf(out);
    expect(text.startsWith('```json')).toBe(true);
    expect(JSON.parse(text.replace(/^```json\n/, '').replace(/\n```$/, '')).animation).toBe(false);
  });

  it('html 输出给出可打开的链接与单文件页面', async () => {
    const out = await deliver({
      option: opt(),
      size: SIZE,
      renderer: new SvgRenderer(),
      store: store(),
      title: '报表',
      resolved: { output: OutputFormat.Html, channel: DeliveryChannel.File, notes: [] },
    });
    const text = textOf(out);
    expect(text).toContain('[在浏览器中打开：报表](file://');
    const path = text.match(/^(\/[^\s]+\.html)$/m)![1];
    expect(readFileSync(path, 'utf8')).toContain('<!DOCTYPE html>');
  });

  it('静态图渲染时剥离函数字段并在 notes 中告知', async () => {
    const out = await deliver({
      option: { ...opt(), tooltip: { formatter: '(p) => p.name' } },
      size: SIZE,
      renderer: new SvgRenderer(),
      store: store(),
      resolved: { output: OutputFormat.Svg, channel: DeliveryChannel.File, notes: [] },
    });
    expect(textOf(out)).toMatch(/tooltip\.formatter/);
  });

  it('渲染出空图时给出具体排查方向', async () => {
    const out = await deliver({
      option: { series: 'not-an-array' },
      size: SIZE,
      renderer: new SvgRenderer(),
      store: store(),
      resolved: { output: OutputFormat.Svg, channel: DeliveryChannel.File, notes: [] },
    });
    expect(textOf(out)).toMatch(/空图/);
    expect(textOf(out)).toMatch(/series/);
  });

  it('notes 排在最前面', async () => {
    const out = await deliver({
      option: opt(),
      size: SIZE,
      renderer: new SvgRenderer(),
      store: store(),
      resolved: { output: OutputFormat.Svg, channel: DeliveryChannel.File, notes: ['测试提示'] },
    });
    expect(out[0].text).toContain('测试提示');
  });
});
