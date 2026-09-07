import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

describe('分发配置', () => {
  it('Dockerfile 基于 slim 镜像并安装中文字体', () => {
    const df = readFileSync('Dockerfile', 'utf8');
    expect(df).toMatch(/node:\d+-slim/);
    expect(df).toMatch(/fonts-noto-cjk/);
  });

  it('Dockerfile 不安装 cairo/pango 等原生编译依赖', () => {
    const df = readFileSync('Dockerfile', 'utf8');
    expect(df).not.toMatch(/libcairo|libpango|build-essential/);
  });

  it('README 写明两种集成方式与标准 mcpServers 配置', () => {
    expect(existsSync('README.md')).toBe(true);
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toMatch(/stdio/);
    expect(readme).toMatch(/Streamable HTTP/i);
    expect(readme).toContain('"mcpServers"');
    expect(readme).toMatch(/@langchain\/mcp-adapters/);
  });

  it('README 列出的全部环境变量都在 config 中真实存在', () => {
    const readme = readFileSync('README.md', 'utf8');
    const config = readFileSync('src/config.ts', 'utf8');
    const vars = [...readme.matchAll(/`(ECHARTS_MCP_[A-Z_]+)`/g)].map((m) => m[1]);
    expect(vars.length).toBeGreaterThan(5);
    for (const v of new Set(vars)) {
      expect(config, `README 提到的 ${v} 在 config.ts 中不存在`).toContain(v);
    }
  });

  it('README 列出的 17 种类型与 ChartType 枚举一致', async () => {
    const readme = readFileSync('README.md', 'utf8');
    const { ChartType } = await import('../src/types.js');
    for (const t of Object.values(ChartType)) {
      expect(readme, `README 未提到类型 ${t}`).toContain(`\`${t}\``);
    }
  });
});
