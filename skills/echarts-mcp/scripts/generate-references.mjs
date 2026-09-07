#!/usr/bin/env node
/**
 * 从 echarts-mcp 的源码生成 references/ 下的参考文档。
 *
 * 存在的理由：图表类型清单、data 结构说明、细分样式片段这些内容，
 * 手写一份就等于埋一颗定时炸弹 —— 代码改了文档不会跟着改。
 * 这里直接从注册表和变体目录里读，生成的内容不可能与代码脱节。
 *
 * 用法：
 *   node scripts/generate-references.mjs                # 自动定位已安装的包
 *   node scripts/generate-references.mjs --dist <path>  # 指定 dist 目录
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

function locateDist() {
  const i = argv.indexOf('--dist');
  if (i >= 0) return resolve(argv[i + 1]);

  // 优先用仓库内的 dist（本文件位于 <repo>/skills/echarts-mcp/scripts）
  const inRepo = resolve(here, '../../../dist');
  if (existsSync(join(inRepo, 'types.js'))) return inRepo;

  // 退回到全局安装的包
  try {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const p = join(root, '@ivan97/echarts-mcp/dist');
    if (existsSync(join(p, 'types.js'))) return p;
  } catch { /* 没装全局包就继续报错 */ }

  throw new Error('找不到 echarts-mcp 的 dist 目录，请用 --dist 指定');
}

const dist = locateDist();
const load = (p) => import(pathToFileURL(join(dist, p)).href);

const { ChartType } = await load('types.js');
const { CHART_TEMPLATES } = await load('charts/registry.js');
const { registerCartesianTemplates } = await load('charts/cartesian.js');
const { registerCategoricalTemplates } = await load('charts/categorical.js');
const { registerStructuralTemplates } = await load('charts/structural.js');
const { registerCoordinateTemplates } = await load('charts/coordinate.js');
const { VARIANTS } = await load('charts/variants.js');

registerCartesianTemplates();
registerCategoricalTemplates();
registerStructuralTemplates();
registerCoordinateTemplates();

const GROUPS = {
  '直角坐标系': ['bar', 'line', 'scatter', 'pictorialBar', 'heatmap', 'boxplot', 'candlestick', 'themeRiver'],
  '非直角坐标系': ['pie', 'funnel', 'gauge', 'radar', 'parallel', 'treemap', 'sunburst'],
  '结构型': ['sankey', 'graph', 'tree'],
};

const B = String.fromCharCode(96);
const FENCE = B + B + B;
const L = [];
const p = (s = '') => L.push(s);

p('# 图表类型与数据结构参考');
p();
p('> 本文件由 `scripts/generate-references.mjs` 从 echarts-mcp 源码生成，不要手工编辑。');
p('> 代码改动后重新运行该脚本即可同步。');
p();
p(`共 ${Object.values(ChartType).length} 种类型。`);
p();

for (const [group, types] of Object.entries(GROUPS)) {
  p(`## ${group}`);
  p();
  for (const t of types) {
    const tpl = CHART_TEMPLATES[t];
    if (!tpl) continue;
    p(`### ${B}${t}${B}`);
    p();
    p(`**data 结构**：${tpl.dataShape}`);
    p();
    p('**可直接使用的示例**：');
    p();
    p(FENCE + 'json');
    p(JSON.stringify({ type: t, data: tpl.example }, null, 2));
    p(FENCE);
    p();
    const vs = VARIANTS[t] ?? [];
    if (vs.length) {
      p(`**细分样式**（${vs.length} 种，放进 ${B}optionOverrides${B}）：`);
      p();
      for (const v of vs) {
        p(`- **${v.name}** — ${v.description}`);
        p();
        p('  ' + FENCE + 'json');
        for (const line of JSON.stringify(v.optionOverrides, null, 2).split('\n')) p('  ' + line);
        p('  ' + FENCE);
        p();
      }
    }
  }
}

const placeholders = [];
for (const [t, list] of Object.entries(VARIANTS)) {
  for (const v of list) {
    if (JSON.stringify(v.optionOverrides).includes('替换')) placeholders.push(`${t} / ${v.name}`);
  }
}

p('## 需要替换占位符的片段');
p();
if (placeholders.length) {
  p('以下片段含 `"替换为实际类目"` 占位符，**照抄不改会把占位文字直接画到坐标轴上，真实类目一个都不显示**：');
  p();
  for (const x of placeholders) p(`- ${x}`);
  p();
  p('使用前把 `data` 数组换成实际的类目值。');
} else {
  p('当前没有含占位符的片段。');
}
p();

writeFileSync(join(here, '../references/chart-types.md'), L.join('\n'));
console.log('已生成 references/chart-types.md');
console.log(`  类型 ${Object.values(ChartType).length} 种，含变体的类型 ${Object.keys(VARIANTS).length} 个，占位符片段 ${placeholders.length} 处`);
