import { randomBytes } from 'node:crypto';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ChartError, ErrorCode } from '../errors.js';
import { extensionFor, type StorageAdapter, type StoredObject } from './types.js';

export class LocalDiskStore implements StorageAdapter {
  private readonly root: string;

  constructor(
    dir: string,
    private readonly ttlSeconds: number,
    private readonly publicUrl?: string,
  ) {
    this.root = resolve(dir);
  }

  async put(bytes: Buffer, mimeType: string): Promise<StoredObject> {
    // 32 位十六进制随机名：不可猜，避免通过遍历 URL 拿到别人的图。
    // 图片链接本身就是访问凭证，用自增 ID 等于把所有人的图都公开了。
    const id = randomBytes(16).toString('hex');
    const file = `${id}.${extensionFor(mimeType)}`;
    const path = join(this.root, file);

    try {
      await mkdir(this.root, { recursive: true });
      await writeFile(path, bytes);
    } catch (e) {
      throw new ChartError(ErrorCode.StorageFailed, `写入存储失败：${(e as Error).message}`);
    }

    const url = this.publicUrl
      ? `${this.publicUrl.replace(/\/+$/, '')}/files/${file}`
      : pathToFileURL(path).href;
    return { id, url, path };
  }

  async sweep(): Promise<number> {
    const deadline = Date.now() - this.ttlSeconds * 1000;
    let entries: string[];
    try {
      entries = await readdir(this.root);
    } catch {
      // 目录还不存在，没什么可清理的
      return 0;
    }

    let removed = 0;
    for (const name of entries) {
      const path = join(this.root, name);
      try {
        if ((await stat(path)).mtimeMs < deadline) {
          await unlink(path);
          removed++;
        }
      } catch {
        // 并发清理导致的竞态，忽略即可
      }
    }
    return removed;
  }
}
