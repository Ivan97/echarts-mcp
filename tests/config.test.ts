import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';
import { RendererKind } from '../src/types.js';

describe('loadConfig', () => {
  it('全部使用默认值', () => {
    const c = loadConfig({});
    expect(c.token).toBeUndefined();
    expect(c.port).toBe(3000);
    expect(c.storageTtlSeconds).toBe(3600);
    expect(c.renderer).toBe(RendererKind.Auto);
    expect(c.renderTimeoutMs).toBe(10000);
    expect(c.maxOptionBytes).toBe(2_000_000);
    expect(c.maxDataPoints).toBe(50_000);
  });

  it('读取环境变量覆盖默认值', () => {
    const c = loadConfig({
      ECHARTS_MCP_TOKEN: 'secret',
      ECHARTS_MCP_PORT: '8080',
      ECHARTS_MCP_STORAGE_TTL: '60',
      ECHARTS_MCP_RENDERER: 'svg',
    });
    expect(c.token).toBe('secret');
    expect(c.port).toBe(8080);
    expect(c.storageTtlSeconds).toBe(60);
    expect(c.renderer).toBe(RendererKind.Svg);
  });

  it('非法 renderer 取值抛 ChartError', () => {
    expect(() => loadConfig({ ECHARTS_MCP_RENDERER: 'webgl' })).toThrow(/ECHARTS_MCP_RENDERER/);
  });

  it('非法端口抛 ChartError', () => {
    expect(() => loadConfig({ ECHARTS_MCP_PORT: 'abc' })).toThrow(/ECHARTS_MCP_PORT/);
  });
});
