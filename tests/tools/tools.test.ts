import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { TransportKind } from '../../src/types.js';
import { loadConfig } from '../../src/config.js';
import { LocalDiskStore } from '../../src/deliver/local-disk.js';
import { createServer } from '../../src/core/server.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'echarts-tool-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function connect(transport = TransportKind.Stdio, env: Record<string, string> = {}) {
  const config = loadConfig({ ECHARTS_MCP_STORAGE_DIR: dir, ...env });
  const server = createServer({
    config,
    store: new LocalDiskStore(dir, 3600, config.publicUrl),
    transport,
  });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

const textOf = (res: unknown) =>
  (res as { content: { text?: string }[] }).content.map((c) => c.text ?? '').join('\n');

const BAR_DATA = { dimensions: ['月份', '销量'], source: [['1月', 120], ['2月', 200]] };

describe('工具注册', () => {
  it('恰好注册三个工具', async () => {
    const { client, close } = await connect();
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual(['generate_chart', 'list_chart_types', 'render_option']);
    await close();
  });

  it('每个工具都有非空描述', async () => {
    const { client, close } = await connect();
    for (const t of (await client.listTools()).tools) {
      expect(t.description!.length, `${t.name} 描述过短`).toBeGreaterThan(30);
    }
    await close();
  });
});

describe('generate_chart', () => {
  it('生成柱状图并返回 Markdown 图片语法', async () => {
    const { client, close } = await connect();
    const res = await client.callTool({
      name: 'generate_chart',
      arguments: { type: 'bar', data: BAR_DATA, title: '销量' },
    });
    expect(res.isError).toBeFalsy();
    expect(textOf(res)).toMatch(/!\[销量\]\(file:\/\/.*\.svg\)/);
    await close();
  });

  it('delivery inline 时返回 image content 且为 png', async () => {
    const { client, close } = await connect();
    const res = await client.callTool({
      name: 'generate_chart',
      arguments: {
        type: 'pie',
        data: { dimensions: ['名', '值'], source: [['A', 1], ['B', 2]] },
        delivery: 'inline',
      },
    });
    const image = (res.content as { type: string; mimeType?: string }[]).find((c) => c.type === 'image');
    expect(image?.mimeType).toBe('image/png');
    await close();
  });

  it('optionOverrides 能改到最终 option', async () => {
    const { client, close } = await connect();
    const res = await client.callTool({
      name: 'generate_chart',
      arguments: {
        type: 'bar',
        data: BAR_DATA,
        output: 'option',
        optionOverrides: { backgroundColor: '#123456' },
      },
    });
    const text = textOf(res);
    const json = JSON.parse(text.replace(/^[\s\S]*?```json\n/, '').replace(/\n```[\s\S]*$/, ''));
    expect(json.backgroundColor).toBe('#123456');
    await close();
  });

  it('http 传输下默认走 url 通道', async () => {
    const { client, close } = await connect(TransportKind.Http, {
      ECHARTS_MCP_PUBLIC_URL: 'https://charts.example.com',
    });
    const res = await client.callTool({
      name: 'generate_chart',
      arguments: { type: 'bar', data: BAR_DATA },
    });
    expect(textOf(res)).toContain('https://charts.example.com/files/');
    await close();
  });

  it('不支持的类型返回 isError', async () => {
    const { client, close } = await connect();
    const res = await client.callTool({
      name: 'generate_chart',
      arguments: { type: 'bar3D', data: {} },
    });
    expect(res.isError).toBe(true);
    await close();
  });

  it('数据点超过配额时返回 isError 并说明原因', async () => {
    const { client, close } = await connect(TransportKind.Stdio, {
      ECHARTS_MCP_MAX_DATA_POINTS: '3',
    });
    const res = await client.callTool({
      name: 'generate_chart',
      arguments: {
        type: 'bar',
        data: { dimensions: ['x', 'y'], source: [['a', 1], ['b', 2], ['c', 3], ['d', 4]] },
      },
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/OPTION_TOO_LARGE/);
    await close();
  });
});

describe('render_option', () => {
  it('直接给完整 option 也能出图', async () => {
    const { client, close } = await connect();
    const res = await client.callTool({
      name: 'render_option',
      arguments: {
        option: {
          xAxis: { type: 'category', data: ['A', 'B'] },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: [1, 2] }],
        },
      },
    });
    expect(res.isError).toBeFalsy();
    expect(textOf(res)).toMatch(/\.svg/);
    await close();
  });

  it('option 画不出东西时给出空图提示而不是假装成功', async () => {
    const { client, close } = await connect();
    const res = await client.callTool({
      name: 'render_option',
      arguments: { option: { series: 'not-an-array' } },
    });
    expect(textOf(res)).toMatch(/空图/);
    await close();
  });
});

describe('list_chart_types', () => {
  it('不带参数时列出全部 17 种类型', async () => {
    const { client, close } = await connect();
    const data = JSON.parse(textOf(await client.callTool({ name: 'list_chart_types', arguments: {} })));
    expect(data.types).toHaveLength(17);
    expect(data.types.map((t: { type: string }) => t.type)).toContain('sankey');
    await close();
  });

  it('带 type 参数时返回 dataShape、example 与 variants', async () => {
    const { client, close } = await connect();
    const data = JSON.parse(
      textOf(await client.callTool({ name: 'list_chart_types', arguments: { type: 'bar' } })),
    );
    expect(data.dataShape).toBeTruthy();
    expect(data.example).toBeTruthy();
    expect(data.variants.map((v: { name: string }) => v.name)).toEqual(
      expect.arrayContaining(['堆叠', '横向']),
    );
    await close();
  });

  // 闭环验证：工具自述的细分样式片段必须真的能用
  it('variants 里的 optionOverrides 可直接喂给 generate_chart', async () => {
    const { client, close } = await connect();
    const detail = JSON.parse(
      textOf(await client.callTool({ name: 'list_chart_types', arguments: { type: 'bar' } })),
    );
    const stacked = detail.variants.find((v: { name: string }) => v.name === '堆叠');
    const res = await client.callTool({
      name: 'generate_chart',
      arguments: {
        type: 'bar',
        data: { dimensions: ['月', '销量', '利润'], source: [['1月', 10, 3], ['2月', 20, 5]] },
        optionOverrides: stacked.optionOverrides,
        output: 'option',
      },
    });
    expect(res.isError).toBeFalsy();
    expect(textOf(res)).toContain('"stack"');
    await close();
  });
});
