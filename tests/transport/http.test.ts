import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { TransportKind } from '../../src/types.js';
import { loadConfig } from '../../src/config.js';
import { LocalDiskStore } from '../../src/deliver/local-disk.js';
import { createApp } from '../../src/transport/http.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'echarts-http-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const appWith = (env: Record<string, string> = {}) => {
  const config = loadConfig({ ECHARTS_MCP_STORAGE_DIR: dir, ...env });
  return createApp({
    config,
    store: new LocalDiskStore(dir, 3600, config.publicUrl),
    transport: TransportKind.Http,
  });
};

const INIT = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } },
};
const ACCEPT = 'application/json, text/event-stream';

describe('HTTP transport', () => {
  it('健康检查返回 ok', async () => {
    await request(appWith())
      .get('/health')
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('ok'));
  });

  it('健康检查不需要鉴权', async () => {
    await request(appWith({ ECHARTS_MCP_TOKEN: 'secret' })).get('/health').expect(200);
  });

  it('未配置 token 时开放访问，initialize 成功', async () => {
    const res = await request(appWith()).post('/mcp').set('Accept', ACCEPT).send(INIT);
    expect(res.status).toBe(200);
  });

  it('配置了 token 但请求不带时返回 401', async () => {
    await request(appWith({ ECHARTS_MCP_TOKEN: 'secret' }))
      .post('/mcp')
      .set('Accept', ACCEPT)
      .send(INIT)
      .expect(401);
  });

  it('配置了 token 但 token 不对时返回 401', async () => {
    await request(appWith({ ECHARTS_MCP_TOKEN: 'secret' }))
      .post('/mcp')
      .set('Accept', ACCEPT)
      .set('Authorization', 'Bearer wrong')
      .send(INIT)
      .expect(401);
  });

  it('配置了 token 且请求带对时放行', async () => {
    const res = await request(appWith({ ECHARTS_MCP_TOKEN: 'secret' }))
      .post('/mcp')
      .set('Accept', ACCEPT)
      .set('Authorization', 'Bearer secret')
      .send(INIT);
    expect(res.status).toBe(200);
  });

  it('静态路由能取回已存储的图', async () => {
    writeFileSync(join(dir, 'abc.svg'), '<svg/>');
    await request(appWith()).get('/files/abc.svg').expect(200).expect('Content-Type', /svg/);
  });

  it('静态路由拒绝路径穿越', async () => {
    const res = await request(appWith()).get('/files/..%2f..%2fetc%2fpasswd');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('无状态模式拒绝 GET 与 DELETE', async () => {
    await request(appWith()).get('/mcp').expect(405);
    await request(appWith()).delete('/mcp').expect(405);
  });
});
