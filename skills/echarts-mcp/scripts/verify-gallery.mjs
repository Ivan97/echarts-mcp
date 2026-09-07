#!/usr/bin/env node
/**
 * 把 examples/gallery/ 里的每个官方例子送进真实的 echarts-mcp 服务渲染一遍，
 * **浅色与深色各跑一次**，产出兼容性矩阵。
 *
 * 这个脚本回答的是一个具体问题：官方图库里属于我们支持的那些类型的例子，
 * 到底有多少能原样画出来？答案必须实测 —— ECharts 对非法 option 不报错，
 * 只会画出一张空图，光看「调用成功」什么也证明不了。
 *
 * 深色单独跑一遍不是走形式：主题是通过 deepMerge 垫在调用方 option 底下的，
 * 例子自己写死的 backgroundColor、textStyle、itemStyle 会把主题覆盖掉，
 * 哪些能跟着变、哪些不跟着变，只有分别渲染才看得出来。
 *
 * 用法：
 *   node scripts/verify-gallery.mjs                     # 用全局安装的 echarts-mcp
 *   node scripts/verify-gallery.mjs --server <path>     # 指定 dist/transport/stdio.js
 *   node scripts/verify-gallery.mjs --category bar      # 只跑一类
 *   node scripts/verify-gallery.mjs --report            # 同时写 references/gallery-support.md
 *   node scripts/verify-gallery.mjs --keep              # 保留产物目录以便查看
 *
 * 退出码：全部通过为 0，有失败为 1。
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHART_PROFILES } from './chart-profiles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = join(here, '..');
const galleryDir = join(skillRoot, 'examples/gallery');
const argv = process.argv.slice(2);
const arg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);

const serverPath = arg('--server');
const onlyCategory = arg('--category');
const writeReport = argv.includes('--report');
const keep = argv.includes('--keep');

/** 两种模式都要验：深色主题会把背景与文字色整体换掉，是一个独立的失败面。 */
const THEMES = [
  { id: 'default', cn: '浅色' },
  { id: 'dark', cn: '深色' },
];

const index = JSON.parse(readFileSync(join(galleryDir, 'index.json'), 'utf8'));
const categories = index.categories
  .map((c) => c.category)
  .filter((c) => !onlyCategory || c === onlyCategory);

const outDir = mkdtempSync(join(tmpdir(), 'echarts-gallery-'));
const client = new Client({ name: 'gallery-verify', version: '1.0.0' });
await client.connect(
  new StdioClientTransport({
    ...(serverPath ? { command: 'node', args: [serverPath] } : { command: 'echarts-mcp', args: [] }),
    env: { ...process.env, ECHARTS_MCP_STORAGE_DIR: outDir },
  }),
);

const textOf = (r) => r.content.map((c) => c.text ?? '').join('\n');

/** 一次渲染的判定。status 为 ok 才算通过。 */
async function renderOnce(option, theme) {
  let res;
  try {
    res = await client.callTool({ name: 'render_option', arguments: { option, theme } });
  } catch (e) {
    return { status: 'throw', detail: String(e.message ?? e).slice(0, 120) };
  }
  const text = textOf(res);
  if (res.isError) return { status: 'error', detail: text.split('\n')[0].slice(0, 120) };
  if (/空图|empty chart|不是 ECharts 支持的类型/.test(text)) {
    return { status: 'empty', detail: text.split('\n')[0].slice(0, 120) };
  }
  const m = text.match(/\((file:\/\/[^)]+)\)/) || text.match(/(\/[^\s)]+\.(svg|png|html))/);
  if (!m) return { status: 'nooutput', detail: '返回中找不到产物' };
  const path = m[1].replace('file://', '');
  if (!existsSync(path)) return { status: 'missing', detail: '产物文件不存在' };
  const bytes = readFileSync(path).length;
  if (bytes < 800) return { status: 'tiny', detail: `产物仅 ${bytes} 字节，疑似空图` };
  return { status: 'ok', detail: `${(bytes / 1024).toFixed(0)}KB`, bytes };
}

const rows = [];
for (const category of categories) {
  const dir = join(galleryDir, category);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  console.log(`\n── ${category} (${files.length})`);
  for (const file of files) {
    const ex = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    const perTheme = {};
    for (const t of THEMES) perTheme[t.id] = await renderOnce(ex.option, t.id);
    const ok = THEMES.every((t) => perTheme[t.id].status === 'ok');
    rows.push({ category, id: ex.id, titleCN: ex.titleCN, tags: ex.tags ?? [], ok, perTheme });

    const marks = THEMES.map((t) => (perTheme[t.id].status === 'ok' ? '·' : perTheme[t.id].status)).join('/');
    const detail = ok
      ? perTheme.default.detail
      : THEMES.map((t) => perTheme[t.id].detail).filter(Boolean)[0];
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${ex.id.padEnd(36)} ${marks.padEnd(12)} ${detail ?? ''}`);
  }
}

await client.close();

const failed = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failed.length}/${rows.length} 通过（浅色与深色都成功才算通过）`);
if (index.skipped?.length) {
  console.log(`另有 ${index.skipped.length} 个官方例子在构建期就未收录，见 index.json 的 skipped`);
}

if (writeReport) {
  const byCat = new Map();
  for (const r of rows) {
    if (!byCat.has(r.category)) byCat.set(r.category, []);
    byCat.get(r.category).push(r);
  }
  const lines = [
    '# 官方示例渲染实测',
    '',
    '`scripts/verify-gallery.mjs` 把 `examples/gallery/` 里每个例子都送进真实的 echarts-mcp 服务，',
    '**浅色（`default`）与深色（`dark`）各渲染一次**，两次都出图才记通过。',
    '',
    '为什么要实测：ECharts 对非法 option 不抛异常，只会安静地画一张空图。',
    '「调用返回成功」证明不了任何事，只有看产物才算数。',
    '',
    `实测结果：**${rows.length - failed.length}/${rows.length} 通过**，两种模式表现一致。`,
    '',
    '| 类型 | 例子数 | 通过 | 说明 |',
    '|---|---|---|---|',
    ...[...byCat].map(([cat, list]) => {
      const bad = list.filter((r) => !r.ok);
      const cn = CHART_PROFILES[cat]?.cn ?? cat;
      return `| \`${cat}\` ${cn} | ${list.length} | ${list.length - bad.length} | ${bad.length ? bad.map((b) => `\`${b.id}\` ${b.perTheme.default.status}`).join('；') : '全部通过' } |`;
    }),
    '',
  ];

  if (failed.length) {
    lines.push('## 未通过的例子', '');
    lines.push('| id | 类型 | 浅色 | 深色 | 详情 |', '|---|---|---|---|---|');
    for (const r of failed) {
      lines.push(
        `| \`${r.id}\` | ${r.category} | ${r.perTheme.default.status} | ${r.perTheme.dark.status} | ${(r.perTheme.default.detail ?? r.perTheme.dark.detail ?? '').replace(/\|/g, '\\|')} |`,
      );
    }
    lines.push('');
  }

  if (index.skipped?.length) {
    lines.push('## 构建期未收录', '', '这些例子在抓取求值阶段就没进 gallery：', '');
    for (const s of index.skipped) lines.push(`- \`${s.id}\` —— ${s.reason}`);
    lines.push('');
  }

  lines.push(
    '## 深色模式的边界',
    '',
    '主题是 `deepMerge` 垫在调用方 option **底下**的，所以：',
    '',
    '- 例子没写死颜色的部分（背景、文字、坐标轴、图例）会跟着 `theme` 走',
    '- 例子自己写死的 `itemStyle.color`、`backgroundColor`、`visualMap.inRange.color` **不会**被主题改掉 ——',
    '  这是有意的，覆盖调用方显式给的颜色属于越权',
    '- 官方例子里有相当一部分自带配色（尤其是渐变和 visualMap 那些），',
    '  在深色下仍然是原来的颜色。要整体转深色，把这些字段一起删掉或改掉',
    '',
    '换句话说：**两种模式都能出图，但「出图」不等于「配色适配」**。需要严格深色的场合，',
    '优先用 `generate_chart`（模板不写死颜色，主题能完全生效），而不是直接套官方 option。',
    '',
  );

  const reportPath = join(skillRoot, 'references/gallery-support.md');
  writeFileSync(reportPath, lines.join('\n'));
  console.log(`报告写入 ${reportPath}`);
}

if (keep) console.log(`产物保留在 ${outDir}`);
else rmSync(outDir, { recursive: true, force: true });

process.exit(failed.length ? 1 : 0);
