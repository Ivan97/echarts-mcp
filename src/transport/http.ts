#!/usr/bin/env node
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { TransportKind } from '../types.js';
import { loadConfig } from '../config.js';
import { LocalDiskStore } from '../deliver/local-disk.js';
import { createServer, type ServerDeps } from '../core/server.js';

/** 配了 token 就校验，没配就开放。内网与本机调试时不必强制加密钥。 */
function bearerGuard(token?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!token) {
      next();
      return;
    }
    if (req.headers.authorization === `Bearer ${token}`) {
      next();
      return;
    }
    res.status(401).json({ error: 'unauthorized' });
  };
}

export function createApp(deps: ServerDeps): Express {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  // 健康检查不鉴权，否则探针得配密钥
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // 静态图。express.static 自身会拒绝路径穿越
  app.use('/files', express.static(deps.config.storageDir, { index: false, dotfiles: 'deny' }));

  app.post('/mcp', bearerGuard(deps.config.token), async (req, res) => {
    // 无状态模式：每个请求独立的 server + transport，响应结束即销毁。
    // 请求之间不共享任何状态，因此可水平扩展、无需粘性路由。
    const server = createServer(deps);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // 无状态模式不支持服务端主动推送，GET/DELETE 一律拒绝
  const methodNotAllowed = (_req: Request, res: Response): void => {
    res.status(405).json({ error: 'method not allowed in stateless mode' });
  };
  app.get('/mcp', methodNotAllowed);
  app.delete('/mcp', methodNotAllowed);

  return app;
}

export async function main(): Promise<void> {
  const config = loadConfig();
  const store = new LocalDiskStore(config.storageDir, config.storageTtlSeconds, config.publicUrl);
  await store.sweep();
  // 定期清理过期图片。unref 让定时器不阻止进程退出。
  setInterval(() => void store.sweep(), config.storageTtlSeconds * 1000).unref();

  createApp({ config, store, transport: TransportKind.Http }).listen(config.port, () => {
    console.error(
      `echarts-mcp HTTP 已启动：http://localhost:${config.port}/mcp` +
        `（鉴权：${config.token ? '开启' : '关闭'}）`,
    );
  });
}

if (process.argv[1]?.endsWith('http.js')) {
  main().catch((e: unknown) => {
    console.error('启动失败：', e);
    process.exit(1);
  });
}
