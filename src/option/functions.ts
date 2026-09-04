const FN_PATTERN =
  /^\s*(function\s*\*?\s*\(|function\s+[A-Za-z_$][\w$]*\s*\(|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/;

export function isFunctionExpression(v: unknown): v is string {
  return typeof v === 'string' && FN_PATTERN.test(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * 剥离 option 中的函数字符串，返回净化后的副本与被剥离字段的路径。
 *
 * 用于 svg / png 静态渲染：静态图不执行 JS，把函数字符串留在 option 里，
 * ECharts 只会把它当成普通字符串直接画到图上。
 */
export function partitionFunctions(option: object): { sanitized: object; functionPaths: string[] } {
  const functionPaths: string[] = [];

  function walk(node: unknown, path: string): unknown {
    if (Array.isArray(node)) return node.map((item, i) => walk(item, `${path}[${i}]`));
    if (isPlainObject(node)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        const child = path ? `${path}.${k}` : k;
        if (isFunctionExpression(v)) {
          functionPaths.push(child);
          continue;
        }
        out[k] = walk(v, child);
      }
      return out;
    }
    return node;
  }

  return { sanitized: walk(option, '') as object, functionPaths };
}

const FN_MARK = '__ECHARTS_MCP_FN__';

/**
 * 序列化为 JS 对象字面量，函数字符串不加引号。
 *
 * 只用于生成 html —— 函数由**浏览器**执行。服务端在任何路径上都不 eval 外来字符串。
 */
export function serializeOptionWithFunctions(option: object): string {
  const replacer = (_k: string, v: unknown): unknown =>
    isFunctionExpression(v) ? `${FN_MARK}${v}${FN_MARK}` : v;
  const marked = JSON.stringify(option, replacer, 2);
  return marked.replace(
    new RegExp(`"${FN_MARK}([\\s\\S]*?)${FN_MARK}"`, 'g'),
    (_m, body: string) => JSON.parse(`"${body}"`) as string,
  );
}
