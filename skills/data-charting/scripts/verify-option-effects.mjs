#!/usr/bin/env node
/**
 * 把 option-effects.json 里的每个片段套到基准图上渲染，验证它们确实生效。
 *
 * 两项断言：
 *   1. 渲染出的图非空（服务端不会报错，只会静默画空图，所以必须查）
 *   2. 产物与不加该片段的基准图**不同**（片段没生效时产物会一模一样，
 *      这种「写了等于没写」的情况最难发现）
 *
 * 用法：
 *   node scripts/verify-option-effects.mjs
 *   node scripts/verify-option-effects.mjs --server <path/to/dist/transport/stdio.js>
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const serverPath = argv.includes('--server') ? argv[argv.indexOf('--server') + 1] : null;

const catalog = JSON.parse(readFileSync(join(here, '../examples/option-effects.json'), 'utf8'));
const outDir = mkdtempSync(join(tmpdir(), 'echarts-opt-verify-'));

const client = new Client({ name: 'option-verify', version: '1.0.0' });
await client.connect(
  new StdioClientTransport({
    ...(serverPath ? { command: 'node', args: [serverPath] } : { command: 'echarts-mcp', args: [] }),
    env: { ...process.env, ECHARTS_MCP_STORAGE_DIR: outDir },
  }),
);

const textOf = (r) => r.content.map((c) => c.text ?? '').join('\n');

async function render(overrides) {
  const args = { ...catalog.base };
  if (overrides) args.optionOverrides = overrides;
  const res = await client.callTool({ name: 'generate_chart', arguments: args });
  const text = textOf(res);
  if (res.isError) return { err: text.split('\n')[0].slice(0, 70) };
  if (/空图|不是 ECharts 支持的类型/.test(text)) return { err: '触发空图提示' };
  const m = text.match(/\((file:\/\/[^)]+)\)/);
  if (!m) return { err: '找不到产物' };
  const path = m[1].replace('file://', '');
  if (!existsSync(path)) return { err: '产物不存在' };
  const bytes = readFileSync(path);
  return { hash: createHash('sha1').update(bytes).digest('hex'), size: bytes.length };
}

const baseline = await render(null);
if (baseline.err) {
  console.error('基准图渲染失败：', baseline.err);
  process.exit(1);
}
console.log(`基准图 ${(baseline.size / 1024).toFixed(1)} KB\n`);

const failures = [];
let total = 0;

for (const group of catalog.groups) {
  console.log(group.name);
  for (const item of group.items) {
    total++;
    const r = await render(item.overrides);
    let mark;
    let note = '';
    if (r.err) {
      mark = ' FAIL ';
      note = r.err;
      failures.push(item.id);
    } else if (r.hash === baseline.hash) {
      // 产物与基准完全一致，说明这段 override 根本没起作用
      mark = ' NOOP ';
      note = '与基准图完全一致，片段未生效';
      failures.push(item.id);
    } else {
      mark = '  ok  ';
      note = `${(r.size / 1024).toFixed(1)} KB`;
    }
    console.log(`  ${mark} ${item.id.padEnd(24)} ${note}`);
  }
}

await client.close();
rmSync(outDir, { recursive: true, force: true });

console.log(`\n${total - failures.length}/${total} 生效`);
if (failures.length) {
  console.log('未生效或失败：', failures.join(', '));
  process.exit(1);
}
