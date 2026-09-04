import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, utimesSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDiskStore } from '../../src/deliver/local-disk.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'echarts-mcp-test-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('LocalDiskStore', () => {
  it('写盘并返回 id / path / url', async () => {
    const store = new LocalDiskStore(dir, 3600, 'https://cdn.example.com');
    const out = await store.put(Buffer.from('<svg/>'), 'image/svg+xml');
    expect(existsSync(out.path)).toBe(true);
    expect(out.url).toBe(`https://cdn.example.com/files/${out.id}.svg`);
  });

  it('publicUrl 末尾多余的斜杠被规范化', async () => {
    const store = new LocalDiskStore(dir, 3600, 'https://cdn.example.com/');
    const out = await store.put(Buffer.from('x'), 'image/png');
    expect(out.url).toBe(`https://cdn.example.com/files/${out.id}.png`);
  });

  it('未配置 publicUrl 时 url 退化为 file:// 绝对路径', async () => {
    const store = new LocalDiskStore(dir, 3600);
    const out = await store.put(Buffer.from('x'), 'image/png');
    expect(out.url.startsWith('file://')).toBe(true);
  });

  it('文件名是 32 位十六进制随机串，不可猜', async () => {
    const store = new LocalDiskStore(dir, 3600);
    const a = await store.put(Buffer.from('x'), 'image/png');
    const b = await store.put(Buffer.from('x'), 'image/png');
    expect(a.id).toMatch(/^[0-9a-f]{32}$/);
    expect(a.id).not.toBe(b.id);
  });

  it('mimeType 决定扩展名', async () => {
    const store = new LocalDiskStore(dir, 3600);
    expect((await store.put(Buffer.from('x'), 'image/png')).path.endsWith('.png')).toBe(true);
    expect((await store.put(Buffer.from('x'), 'text/html')).path.endsWith('.html')).toBe(true);
    expect((await store.put(Buffer.from('x'), 'image/svg+xml')).path.endsWith('.svg')).toBe(true);
    expect((await store.put(Buffer.from('x'), 'application/octet-stream')).path.endsWith('.bin')).toBe(true);
  });

  it('sweep 删除超过 TTL 的文件，保留未过期的', async () => {
    const store = new LocalDiskStore(dir, 60);
    const stale = await store.put(Buffer.from('old'), 'image/png');
    const fresh = await store.put(Buffer.from('new'), 'image/png');
    const longAgo = new Date(Date.now() - 3600_000);
    utimesSync(stale.path, longAgo, longAgo);

    expect(await store.sweep()).toBe(1);
    expect(existsSync(stale.path)).toBe(false);
    expect(existsSync(fresh.path)).toBe(true);
    expect(readdirSync(dir)).toHaveLength(1);
  });

  it('目录不存在时 sweep 返回 0 而不抛错', async () => {
    const store = new LocalDiskStore(join(dir, 'nope'), 60);
    await expect(store.sweep()).resolves.toBe(0);
  });

  it('目录不存在时 put 会自动创建', async () => {
    const nested = join(dir, 'a', 'b');
    const out = await new LocalDiskStore(nested, 3600).put(Buffer.from('x'), 'image/png');
    expect(existsSync(out.path)).toBe(true);
  });
});
