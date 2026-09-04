export interface StoredObject {
  id: string;
  url: string;
  path: string;
}

/**
 * 存储抽象。
 *
 * 这一层存在的唯一理由是**不硬绑任何云厂商** ——
 * 官方 apache/echarts-mcp 直接依赖百度云 SDK，没有这层抽象，
 * 换存储就得改业务代码。
 */
export interface StorageAdapter {
  /** 存入字节流，返回可访问信息 */
  put(bytes: Buffer, mimeType: string): Promise<StoredObject>;
  /** 清理过期对象，返回删除个数 */
  sweep(): Promise<number>;
}

const EXTENSIONS: Record<string, string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'text/html': 'html',
  'application/json': 'json',
};

export function extensionFor(mimeType: string): string {
  return EXTENSIONS[mimeType] ?? 'bin';
}
