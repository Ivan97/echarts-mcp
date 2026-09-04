FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-slim
# 默认渲染链路（ECharts SSR 出 SVG，resvg 栅格化）零原生依赖，
# 因此不需要 cairo/pango 与任何构建工具链，只需要字体：
# resvg 用的是**服务器上**的字体，缺字体会静默丢字而不报错。
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-noto-cjk fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
# 不能用 --omit=optional：@resvg/resvg-js 与 typescript 的平台原生二进制
# 都是通过 optionalDependencies 分发的，剥掉它们会导致运行时找不到模块。
# canvas 已改为可选 peer 依赖，npm 本来就不会自动安装它。
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

ENV ECHARTS_MCP_PORT=3000
ENV ECHARTS_MCP_STORAGE_DIR=/data
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.ECHARTS_MCP_PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/transport/http.js"]
