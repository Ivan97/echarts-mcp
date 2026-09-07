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

  it('17 种图表类型都在文档中出现', () => {
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

/**
 * 双语 README 的同步守卫。
 *
 * 双语文档最容易出的问题是改了一边忘了另一边，读者拿到的信息就不一致。
 * 这里只锁「事实性内容」—— 图表类型、环境变量、包名 —— 不管行文措辞。
 */
describe('中英文 README 同步', () => {
  const en = readFileSync('README.md', 'utf8');
  const cn = readFileSync('README_CN.md', 'utf8');

  it('两份 README 都存在且互相链接', () => {
    expect(en).toContain('README_CN.md');
    expect(cn).toContain('README.md');
  });

  it('17 种图表类型在两份 README 中都完整列出', () => {
    for (const t of Object.values(ChartType)) {
      expect(en, `英文 README 未提到 ${t}`).toContain(`\`${t}\``);
      expect(cn, `中文 README 未提到 ${t}`).toContain(`\`${t}\``);
    }
  });

  it('环境变量在两份 README 中一致', () => {
    const varsOf = (s: string) =>
      new Set([...s.matchAll(/`(ECHARTS_MCP_[A-Z_]+)`/g)].map((m) => m[1]));
    const enVars = varsOf(en);
    const cnVars = varsOf(cn);
    expect(enVars.size).toBeGreaterThan(5);
    expect([...enVars].sort()).toEqual([...cnVars].sort());
  });

  it('两份 README 用的都是 scoped 包名', () => {
    for (const [label, s] of [['英文', en], ['中文', cn]] as const) {
      expect(s, `${label} README 缺少 scoped 包名`).toContain('@ivan97/echarts-mcp');
    }
  });
});
