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

  // canvas 用可选 peer 依赖而非 optionalDependency：
  // Docker 里 npm ci --omit=optional 会把 @resvg/resvg-js 的平台原生二进制一并剥掉，
  // 导致运行时报 Cannot find module @resvg/resvg-js-linux-arm64-gnu。
  // 可选 peer 依赖 npm 本来就不会自动安装，不需要 --omit=optional 这个开关。
  it('canvas 是可选 peer 依赖，且不出现在 dependencies 与 optionalDependencies 中', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.peerDependencies?.canvas).toBeTruthy();
    expect(pkg.peerDependenciesMeta?.canvas?.optional).toBe(true);
    expect(pkg.dependencies?.canvas).toBeUndefined();
    expect(pkg.optionalDependencies).toBeUndefined();
  });

  it('Dockerfile 的 RUN 指令中不使用 --omit=optional', () => {
    // 只看指令行，注释里解释「为什么不用」是允许的
    const runLines = readFileSync('Dockerfile', 'utf8')
      .split('\n')
      .filter((l) => l.trimStart().startsWith('RUN'));
    expect(runLines.length).toBeGreaterThan(0);
    for (const line of runLines) {
      expect(line, '剥掉 optional 会一并删除 resvg 的平台原生二进制').not.toMatch(/--omit=optional/);
    }
  });

  it('可选依赖用变量做 import 说明符，缺失时仍能通过类型检查', () => {
    const src = readFileSync('src/render/canvas.ts', 'utf8');
    expect(src).not.toMatch(/import\('canvas'\)/);
    expect(src).toContain('CANVAS_SPECIFIER');
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
