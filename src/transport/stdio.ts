#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TransportKind } from '../types.js';
import { loadConfig } from '../config.js';
import { LocalDiskStore } from '../deliver/local-disk.js';
import { createServer } from '../core/server.js';

/**
 * stdio 入口。
 *
 * **stdout 归 MCP 协议独占**，任何写到 stdout 的内容都会污染协议帧，
 * 所以本文件里的日志一律走 stderr。
 */
export async function main(): Promise<void> {
  const config = loadConfig();
  const store = new LocalDiskStore(config.storageDir, config.storageTtlSeconds, config.publicUrl);
  await store.sweep();

  const server = createServer({ config, store, transport: TransportKind.Stdio });
  await server.connect(new StdioServerTransport());
  console.error(`echarts-mcp 已通过 stdio 启动，存储目录：${config.storageDir}`);
}

main().catch((e: unknown) => {
  console.error('echarts-mcp 启动失败：', e);
  process.exit(1);
});
