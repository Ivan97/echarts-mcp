import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ChartType } from '../src/types.js';
import { VARIANTS } from '../src/charts/variants.js';

const ROOT = 'skills/echarts-mcp';
const skill = readFileSync(join(ROOT, 'SKILL.md'), 'utf8');

/**
 * Skill 的完整性守卫。
 *
 * SKILL.md 里引用的每个文件都必须真实存在 —— 引用到不存在的文件，
 * 模型读的时候只会拿到一个错误，而 skill 本身不会报错，问题很难发现。
 */
describe('echarts-mcp skill', () => {
  it('frontmatter 含 name 与 description', () => {
    const fm = skill.match(/^---\n([\s\S]*?)\n---/);
    expect(fm, '缺少 frontmatter').toBeTruthy();
    expect(fm![1]).toMatch(/^name:\s*echarts-mcp$/m);
    expect(fm![1]).toMatch(/^description:\s*.+/m);
  });

  it('description 含中英文触发词，否则中文提问时不会被激活', () => {
    const desc = skill.match(/^description:\s*"?(.+?)"?$/m)![1];
    expect(desc.length, 'description 过短，触发面不够').toBeGreaterThan(120);
    for (const kw of ['chart', 'visualize', '图表', '柱状图', 'generate_chart']) {
      expect(desc, `description 缺少触发词 ${kw}`).toContain(kw);
    }
  });

  it('SKILL.md 里引用的每个文件都存在', () => {
    const refs = [...skill.matchAll(/`((?:references|examples|scripts)\/[\w.-]+)`/g)].map((m) => m[1]);
    expect(new Set(refs).size).toBeGreaterThan(4);
    for (const r of new Set(refs)) {
      expect(existsSync(join(ROOT, r)), `SKILL.md 引用了不存在的文件 ${r}`).toBe(true);
    }
  });

  it('examples 里的图表类型都是真实支持的类型', () => {
    const { examples } = JSON.parse(readFileSync(join(ROOT, 'examples/examples.json'), 'utf8'));
    expect(examples.length).toBeGreaterThan(10);
    const valid = new Set<string>(Object.values(ChartType));
    for (const ex of examples) {
      expect(['generate_chart', 'render_option'], `${ex.id} 用了不存在的工具`).toContain(ex.tool);
      if (ex.arguments.type) {
        expect(valid.has(ex.arguments.type), `${ex.id} 用了不支持的类型 ${ex.arguments.type}`).toBe(true);
      }
    }
  });

  it('examples 的 id 不重复', () => {
    const { examples } = JSON.parse(readFileSync(join(ROOT, 'examples/examples.json'), 'utf8'));
    const ids = examples.map((e: { id: string }) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('option-effects 每条都有 id、effect 与非空 overrides', () => {
    const cat = JSON.parse(readFileSync(join(ROOT, 'examples/option-effects.json'), 'utf8'));
    expect(cat.base.type).toBeTruthy();
    const items = cat.groups.flatMap((g: { items: unknown[] }) => g.items);
    expect(items.length).toBeGreaterThan(20);
    for (const it of items as { id: string; effect: string; overrides: object }[]) {
      expect(it.effect.length, `${it.id} 的 effect 描述过短`).toBeGreaterThan(6);
      expect(Object.keys(it.overrides).length, `${it.id} 的 overrides 为空`).toBeGreaterThan(0);
    }
  });

  it('选型指南覆盖全部 18 种类型', () => {
    const guide = readFileSync(join(ROOT, 'references/choosing-and-options.md'), 'utf8');
    for (const t of Object.values(ChartType)) {
      expect(guide, `选型指南未覆盖 ${t}`).toContain(`\`${t}\``);
    }
  });

  it('生成的类型参考与代码中的变体数量一致', () => {
    const ref = readFileSync(join(ROOT, 'references/chart-types.md'), 'utf8');
    for (const [type, list] of Object.entries(VARIANTS)) {
      for (const v of list!) {
        expect(ref, `类型参考缺少 ${type} 的变体「${v.name}」`).toContain(v.name);
      }
    }
  });

  it('占位符片段在 SKILL.md 与排错文档里都有警告', () => {
    const trouble = readFileSync(join(ROOT, 'references/troubleshooting.md'), 'utf8');
    expect(skill, 'SKILL.md 未警告占位符').toContain('替换为实际类目');
    expect(trouble, '排错文档未警告占位符').toContain('替换为实际类目');
  });
});
