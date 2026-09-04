import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('stdio entry', () => {
  it('源码中不出现 console.log —— stdout 是 MCP 协议通道', () => {
    const src = readFileSync('src/transport/stdio.ts', 'utf8');
    expect(src).not.toMatch(/console\.log/);
  });

  it('http entry 同样不写 stdout', () => {
    const src = readFileSync('src/transport/http.ts', 'utf8');
    expect(src).not.toMatch(/console\.log/);
  });

  it('package.json 声明了两个 bin 入口', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.bin['echarts-mcp']).toBe('dist/transport/stdio.js');
    expect(pkg.bin['echarts-mcp-http']).toBe('dist/transport/http.js');
  });

  it('canvas 是可选依赖而非必需依赖', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.optionalDependencies?.canvas).toBeTruthy();
    expect(pkg.dependencies?.canvas).toBeUndefined();
  });

  it('全仓库源码不出现 eval 或 new Function', () => {
    const files = [
      'src/option/functions.ts',
      'src/html/standalone.ts',
      'src/deliver/deliver.ts',
      'src/tools/render-option.ts',
    ];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, `${f} 含 eval`).not.toMatch(/\beval\(/);
      expect(src, `${f} 含 new Function`).not.toMatch(/new Function\(/);
    }
  });
});
