import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ChartType, ThemeName, OutputFormat, DeliveryRequest } from '../src/types.js';
import { VARIANTS } from '../src/charts/variants.js';

const usage = readFileSync('docs/usage.md', 'utf8');
const config = readFileSync('src/config.ts', 'utf8');

/**
 * 文档与代码的一致性守卫。
 *
 * 使用文档里写的类型、参数、配置项一旦和代码对不上，文档就成了谎言，
 * 比没有文档更糟。这些断言让文档跟着代码一起过 CI。
 */
describe('使用文档与代码一致', () => {
  it('提到的每个环境变量都在 config.ts 中真实存在', () => {
    const vars = [...usage.matchAll(/`(ECHARTS_MCP_[A-Z_]+)`/g)].map((m) => m[1]);
    expect(new Set(vars).size).toBeGreaterThan(5);
    for (const v of new Set(vars)) {
      expect(config, `文档提到的 ${v} 在 config.ts 中不存在`).toContain(v);
    }
  });

  it('config.ts 中的每个环境变量都写进了文档', () => {
    const inCode = [...config.matchAll(/env\.(ECHARTS_MCP_[A-Z_]+)/g)].map((m) => m[1]);
    expect(inCode.length).toBeGreaterThan(5);
    for (const v of new Set(inCode)) {
      expect(usage, `config.ts 里的 ${v} 没写进文档`).toContain(v);
    }
  });

  it('18 种图表类型都在文档中出现', () => {
    for (const t of Object.values(ChartType)) {
      expect(usage, `文档未提到类型 ${t}`).toContain(`\`${t}\``);
    }
  });

  it('主题、输出格式、交付方式的取值与枚举一致', () => {
    for (const v of Object.values(ThemeName)) {
      expect(usage, `文档未提到主题 ${v}`).toContain(v);
    }
    for (const v of Object.values(OutputFormat)) {
      expect(usage, `文档未提到输出格式 ${v}`).toContain(`\`${v}\``);
    }
    for (const v of Object.values(DeliveryRequest)) {
      expect(usage, `文档未提到交付方式 ${v}`).toContain(`\`${v}\``);
    }
  });

  it('文档里列出的细分样式与 variants 目录一致', () => {
    for (const [type, list] of Object.entries(VARIANTS)) {
      for (const v of list!) {
        expect(usage, `文档未列出 ${type} 的变体「${v.name}」`).toContain(v.name);
      }
    }
  });

  it('README 指向使用文档', () => {
    expect(readFileSync('README.md', 'utf8')).toContain('docs/usage.md');
  });
});
