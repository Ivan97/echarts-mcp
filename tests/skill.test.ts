import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ChartType } from '../src/types.js';
import { VARIANTS } from '../src/charts/variants.js';

const ROOT = 'skills/data-charting';
const skill = readFileSync(join(ROOT, 'SKILL.md'), 'utf8');

/**
 * Skill 的完整性守卫。
 *
 * SKILL.md 里引用的每个文件都必须真实存在 —— 引用到不存在的文件，
 * 模型读的时候只会拿到一个错误，而 skill 本身不会报错，问题很难发现。
 */
describe('data-charting skill', () => {
  it('frontmatter 含 name 与 description', () => {
    const fm = skill.match(/^---\n([\s\S]*?)\n---/);
    expect(fm, '缺少 frontmatter').toBeTruthy();
    expect(fm![1]).toMatch(/^name:\s*data-charting$/m);
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

  it('选型指南覆盖全部 17 种类型', () => {
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

  it('gallery 的每个例子文件都是合法 JSON 且带可直接使用的 option', () => {
    // 序列化器是自己写的（为了让数据紧凑、结构可读），出过把稀疏数组写成裸逗号的 bug。
    // 坏文件不会有人报错，只会在某次真去读它的时候才炸，所以这里全量回读。
    const galleryDir = join(ROOT, 'examples/gallery');
    const categories = readdirSync(galleryDir).filter((d) =>
      statSync(join(galleryDir, d)).isDirectory(),
    );
    expect(categories.length, 'gallery 一个类目都没有').toBe(Object.values(ChartType).length);

    let count = 0;
    for (const cat of categories) {
      for (const file of readdirSync(join(galleryDir, cat))) {
        const raw = readFileSync(join(galleryDir, cat, file), 'utf8');
        let parsed: { id: string; category: string; option: Record<string, unknown> };
        expect(() => {
          parsed = JSON.parse(raw);
        }, `${cat}/${file} 不是合法 JSON`).not.toThrow();
        parsed = JSON.parse(raw);
        expect(parsed.category, `${cat}/${file} 的 category 与所在目录不一致`).toBe(cat);
        expect(parsed.option, `${cat}/${file} 缺少 option`).toBeTruthy();
        const hasSeries =
          parsed.option.series !== undefined ||
          parsed.option.dataset !== undefined ||
          parsed.option.baseOption !== undefined;
        expect(hasSeries, `${cat}/${file} 的 option 里没有 series/dataset/baseOption`).toBe(true);
        count++;
      }
    }
    expect(count, '收录的例子数量异常').toBeGreaterThan(180);
  });

  it('gallery 单个文件不至于大到读不动', () => {
    // 这份目录是给模型按需取用的，一个文件动辄几百 KB 就失去意义了
    const galleryDir = join(ROOT, 'examples/gallery');
    const oversized: string[] = [];
    for (const cat of readdirSync(galleryDir).filter((d) => statSync(join(galleryDir, d)).isDirectory())) {
      for (const file of readdirSync(join(galleryDir, cat))) {
        const size = statSync(join(galleryDir, cat, file)).size;
        if (size > 80_000) oversized.push(`${cat}/${file} ${(size / 1024).toFixed(0)}KB`);
      }
    }
    expect(oversized, `以下例子文件过大：${oversized.join('、')}`).toEqual([]);
  });

  it('每个类型都有 gallery 目录文档，且被总索引引用', () => {
    const entry = readFileSync(join(ROOT, 'references/gallery.md'), 'utf8');
    for (const t of Object.values(ChartType)) {
      const doc = join(ROOT, `references/gallery/${t}.md`);
      expect(existsSync(doc), `缺少 references/gallery/${t}.md`).toBe(true);
      expect(entry, `总索引未引用 ${t}`).toContain(`gallery/${t}.md`);
    }
  });

  it('选型画像覆盖全部 17 种类型，且每项都言之有物', async () => {
    const { CHART_PROFILES } = await import('../skills/data-charting/scripts/chart-profiles.mjs');
    for (const t of Object.values(ChartType)) {
      const p = (CHART_PROFILES as Record<string, Record<string, string>>)[t];
      expect(p, `选型画像缺少 ${t}`).toBeTruthy();
      expect(p.cn?.length ?? 0, `${t} 缺少中文名`).toBeGreaterThan(1);
      // 这几项是选型的依据，写成一两个词就失去了意义
      for (const field of ['data', 'question', 'topics', 'avoid']) {
        expect(p[field]?.length ?? 0, `${t} 的 ${field} 太短，起不到选型作用`).toBeGreaterThan(8);
      }
    }
  });

  it('占位符片段在 SKILL.md 与排错文档里都有警告', () => {
    const trouble = readFileSync(join(ROOT, 'references/troubleshooting.md'), 'utf8');
    expect(skill, 'SKILL.md 未警告占位符').toContain('替换为实际类目');
    expect(trouble, '排错文档未警告占位符').toContain('替换为实际类目');
  });
});
