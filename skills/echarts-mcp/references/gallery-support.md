# 官方示例渲染实测

`scripts/verify-gallery.mjs` 把 `examples/gallery/` 里每个例子都送进真实的 echarts-mcp 服务，
**浅色（`default`）与深色（`dark`）各渲染一次**，两次都出图才记通过。

为什么要实测：ECharts 对非法 option 不抛异常，只会安静地画一张空图。
「调用返回成功」证明不了任何事，只有看产物才算数。

实测结果：**189/189 通过**，两种模式表现一致。

| 类型 | 例子数 | 通过 | 说明 |
|---|---|---|---|
| `bar` 柱状图 | 43 | 43 | 全部通过 |
| `line` 折线图 | 38 | 38 | 全部通过 |
| `pie` 饼图 | 16 | 16 | 全部通过 |
| `scatter` 散点图 | 22 | 22 | 全部通过 |
| `radar` 雷达图 | 5 | 5 | 全部通过 |
| `heatmap` 热力图 | 5 | 5 | 全部通过 |
| `boxplot` 箱线图 | 3 | 3 | 全部通过 |
| `candlestick` K 线图 | 9 | 9 | 全部通过 |
| `funnel` 漏斗图 | 4 | 4 | 全部通过 |
| `sankey` 桑基图 | 7 | 7 | 全部通过 |
| `treemap` 矩形树图 | 7 | 7 | 全部通过 |
| `sunburst` 旭日图 | 7 | 7 | 全部通过 |
| `graph` 关系图 | 12 | 12 | 全部通过 |
| `tree` 树图 | 7 | 7 | 全部通过 |
| `parallel` 平行坐标 | 4 | 4 | 全部通过 |

## 构建期未收录

这些例子在抓取求值阶段就没进 gallery：

- `custom-ohlc` —— custom 系列的 renderItem 是函数，静态渲染时被剥离后无法成图
- `scatter-clustering` —— 需要服务端注册 echarts-stat 的 clustering 变换
- `scatter-clustering-process` —— custom 系列的 renderItem 是函数，静态渲染时被剥离后无法成图
- `scatter-exponential-regression` —— 需要服务端注册 echarts-stat 的 regression 变换
- `pie-pattern` —— 用位图做图案填充，需要浏览器的 Image 对象，svg-ssr 下报 Image width/height must be given
- `scatter-linear-regression` —— 需要服务端注册 echarts-stat 的 regression 变换
- `scatter-polynomial-regression` —— 需要服务端注册 echarts-stat 的 regression 变换
- `geo-graph` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `data-transform-aggregate` —— 需要服务端注册 echarts-simple-transform 的 aggregate 变换
- `geo-choropleth-scatter` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `map-iceland-pie` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `scatter-nebula` —— 数据是 8MB 的 Float32 二进制（约 66 万个点），超出服务端 50,000 点的渲染配额，抓下来也画不出
- `bar-race-country` —— 数据要在浏览器里对 CDN 资源做二次解析，构建期沙箱拿不到可用的 dataset
- `matrix-mini-bar-geo` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `watermark` —— 水印用 canvas 现画图案，服务端没有 canvas 2d 上下文
- `scatter-world-population` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `scatter-logarithmic-regression` —— 需要服务端注册 echarts-stat 的 regression 变换
- `effectScatter-map` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `heatmap-bmap` —— 画在百度地图（bmap）上，需要地图扩展与 API key
- `heatmap-map` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `scatter-map` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `scatter-map-brush` —— 画在 geo 坐标系上，本工具不支持 map / geo
- `scatter-weibo` —— 画在 geo 坐标系上，本工具不支持 map / geo

## 深色模式的边界

主题是 `deepMerge` 垫在调用方 option **底下**的，所以：

- 例子没写死颜色的部分（背景、文字、坐标轴、图例）会跟着 `theme` 走
- 例子自己写死的 `itemStyle.color`、`backgroundColor`、`visualMap.inRange.color` **不会**被主题改掉 ——
  这是有意的，覆盖调用方显式给的颜色属于越权
- 官方例子里有相当一部分自带配色（尤其是渐变和 visualMap 那些），
  在深色下仍然是原来的颜色。要整体转深色，把这些字段一起删掉或改掉

换句话说：**两种模式都能出图，但「出图」不等于「配色适配」**。需要严格深色的场合，
优先用 `generate_chart`（模板不写死颜色，主题能完全生效），而不是直接套官方 option。
