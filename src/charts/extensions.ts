import { createRequire } from 'node:module';
import Module from 'node:module';
import * as echarts from 'echarts';
import { ChartError, ErrorCode } from '../errors.js';

/**
 * 加载 ECharts 的第三方扩展系列。
 *
 * 为什么需要这么一层，而不是直接 `import 'echarts-liquidfill'`：
 *
 * 1. **ESM 入口是坏的。** 这个包的 `index.js` 写的是 `import './src/liquidFill'`，
 *    没有扩展名。它当年是给 webpack 用的，Node 的 ESM 解析器不接受省略扩展名，
 *    直接 import 会 ERR_MODULE_NOT_FOUND。能用的只有 UMD 的 `dist/`，而 UMD
 *    在 Node 里走的是 CommonJS 分支。
 *
 * 2. **CommonJS 分支会拿到另一个 echarts。** echarts 6 的 exports 把
 *    `import` 指向 `index.js`、`require` 指向 `dist/echarts.js` —— 两份代码、
 *    两套内部注册表。扩展在 CJS 那份上调 `extendSeriesModel` 注册了 liquidFill，
 *    而我们的渲染器用的是 ESM 那份，于是 setOption 时报 "Unknown series liquidFill"，
 *    **画出一张没有任何报错的空图**。这就是典型的 dual-package hazard。
 *
 * 所以这里在 require 之前先把 CJS 模块缓存里 'echarts' 这一项换成我们的 ESM
 * 命名空间：扩展内部 `require('echarts')` 拿到的就是渲染器用的那一个实例，
 * 注册才落在对的地方。代价是依赖了 require.cache 这个实现细节，
 * 换来的是服务端其余部分完全不用改（继续用 ESM echarts）。
 *
 * 另一个选择是把整个服务切到 CJS echarts，或者把扩展源码抄进仓库自己维护。
 * 前者为了一个图表类型动全局，后者要长期跟一份三年没更新的第三方代码，
 * 都比这里这十几行贵。
 */

const require = createRequire(import.meta.url);

let liquidFillLoaded = false;

/**
 * 确保 liquidFill 系列已注册到**我们这个** echarts 实例上。幂等，可以随便调。
 */
export function ensureLiquidFill(): void {
  if (liquidFillLoaded) return;

  try {
    const echartsCjsPath = require.resolve('echarts');

    // 只在缓存里还没有这一项时注入。若宿主程序已经 require 过 echarts，
    // 覆盖它会把别人手上的实例换掉，那是越界的副作用。
    if (!require.cache[echartsCjsPath]) {
      const stub = new Module(echartsCjsPath, undefined);
      stub.filename = echartsCjsPath;
      stub.loaded = true;
      stub.exports = echarts;
      require.cache[echartsCjsPath] = stub;
    }

    // liquidfill 的 UMD 包在模块顶层引用了浏览器全局 self
    (globalThis as Record<string, unknown>).self ??= globalThis;

    require('echarts-liquidfill');
    liquidFillLoaded = true;
  } catch (e) {
    throw new ChartError(
      ErrorCode.RendererUnavailable,
      `liquidFill 扩展加载失败：${(e as Error).message}。` +
        '水波图依赖可选扩展 echarts-liquidfill，其余图表类型不受影响。',
    );
  }
}
