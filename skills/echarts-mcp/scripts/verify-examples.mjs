#!/usr/bin/env node
/**
 * 把 examples.json 里的每个例子都送进真实的 echarts-mcp 服务跑一遍，
 * 验证它们确实能渲染出非空图表。
 *
 * 存在的理由：文档里的例子最容易腐烂 —— 参数改了、字段名换了，例子还留在那儿，
 * 照抄的人就掉坑里。这个脚本让例子变成可执行的断言。
 *
 * 用法：
 *   node scripts/verify-examples.mjs                     # 用全局安装的 echarts-mcp
 *   node scripts/verify-examples.mjs --server <path>     # 指定 dist/transport/stdio.js
 *   node scripts/verify-examples.mjs --keep              # 保留产物目录以便查看
 *
 * 退出码：全部通过为 0，有失败为 1。
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const serverPath = argv.includes('--server') ? argv[argv.indexOf('--server') + 1] : null;
const keep = argv.includes('--keep');

const { examples } = JSON.parse(readFileSync(join(here, '../examples/examples.json'), 'utf8'));
const outDir = mkdtempSync(join(tmpdir(), 'echarts-skill-verify-'));

const spawn = serverPath
  ? { command: 'node', args: [serverPath] }
  : { command: 'echarts-mcp', args: [] };

const client = new Client({ name: 'skill-verify', version: '1.0.0' });
await client.connect(
  new StdioClientTransport({ ...spawn, env: { ...process.env, ECHARTS_MCP_STORAGE_DIR: outDir } }),
);

const textOf = (r) => r.content.map((c) => c.text ?? '').join('\n');
const results = [];

for (const ex of examples) {
  const res = await client.callTool({ name: ex.tool, arguments: ex.arguments });
  const text = textOf(res);

  let status = 'ok';
  let detail = '';

  if (res.isError) {
    status = 'error';
    detail = text.split('\n')[0].slice(0, 80);
  } else if (/空图|empty chart|不是 ECharts 支持的类型/.test(text)) {
    // 服务端检测到 option 有问题时会在返回开头加提示，这里必须当成失败
    status = 'empty';
    detail = text.split('\n')[0].slice(0, 80);
  } else {
    // 落盘产物必须真实存在且有实质内容
    const m = text.match(/\((file:\/\/[^)]+)\)/) || text.match(/(\/[^\s)]+\.(svg|png|html))/);
    if (m) {
      const path = m[1].replace('file://', '');
      if (!existsSync(path)) {
        status = 'missing';
        detail = '产物文件不存在';
      } else {
        const size = readFileSync(path).length;
        if (size < 800) {
          status = 'tiny';
          detail = `产物仅 ${size} 字节，疑似空图`;
        } else {
          detail = `${(size / 1024).toFixed(1)} KB`;
        }
      }
    } else if (text.includes('```json')) {
      detail = 'option JSON';
    } else {
      status = 'nooutput';
      detail = '返回中找不到产物';
    }
  }

  results.push({ id: ex.id, status, detail });
}

await client.close();

const pad = (s, n) => String(s).padEnd(n);
console.log();
for (const r of results) {
  const mark = r.status === 'ok' ? '  ok  ' : ` ${r.status.toUpperCase()} `;
  console.log(`${mark} ${pad(r.id, 26)} ${r.detail}`);
}

const failed = results.filter((r) => r.status !== 'ok');
console.log(`\n${results.length - failed.length}/${results.length} 通过`);

if (keep) console.log(`产物保留在 ${outDir}`);
else rmSync(outDir, { recursive: true, force: true });

process.exit(failed.length ? 1 : 0);
