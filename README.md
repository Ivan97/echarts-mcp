# @ivan97/echarts-mcp

[![npm](https://img.shields.io/npm/v/%40ivan97%2Fecharts-mcp)](https://www.npmjs.com/package/@ivan97/echarts-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/Ivan97/echarts-mcp/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/%40ivan97%2Fecharts-mcp)](https://nodejs.org)

**English** · [简体中文](https://github.com/Ivan97/echarts-mcp/blob/main/README_CN.md)

An MCP server for Apache ECharts. Give an LLM a chart type and some data, get back a chart it can render.

Works over **stdio** and **Streamable HTTP**, and produces SVG, PNG, ECharts option JSON, or a self-contained interactive HTML page.

- **17 chart types.** Variants like stacked, horizontal, polar, dual-axis and rose need no separate tool
- **No native dependencies by default.** ECharts renders SVG server-side; PNG goes through `@resvg/resvg-js`, which ships prebuilt binaries, so there is nothing to compile
- **No cloud vendor lock-in.** Storage sits behind a `StorageAdapter` interface with a local-disk implementation built in
- **Markdown output.** Clients that render Markdown show the chart inline instead of a bare path

## Quick start

### Install

```bash
npm install -g @ivan97/echarts-mcp
```

You can also skip the installation and point your client at `npx`.

> **Mind the scope.** The unscoped `echarts-mcp` on npm is a different package by another
> author — one tool, `generate-echarts`, raw option in, PNG out. Everything below assumes
> `@ivan97/echarts-mcp`. If your client shows a tool named `generate-echarts`, you installed
> the other one.

### stdio

Standard `mcpServers` config, works with Claude Desktop, Claude Code, Cherry Studio and others:

```json
{
  "mcpServers": {
    "echarts": {
      "command": "npx",
      "args": ["-y", "@ivan97/echarts-mcp"]
    }
  }
}
```

With Claude Code, one command does it:

```bash
claude mcp add echarts -- npx -y @ivan97/echarts-mcp
```

### Remote over HTTP

```bash
docker run -d -p 3000:3000 \
  -e ECHARTS_MCP_TOKEN=your-secret \
  -e ECHARTS_MCP_PUBLIC_URL=https://charts.example.com \
  -v echarts-data:/data \
  echarts-mcp
```

Client config:

```json
{
  "mcpServers": {
    "echarts": {
      "type": "http",
      "url": "https://charts.example.com/mcp",
      "headers": { "Authorization": "Bearer your-secret" }
    }
  }
}
```

### From LangChain

This is a standard MCP server, so no adapter work is needed:

```ts
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

const client = new MultiServerMCPClient({
  echarts: { transport: 'stdio', command: 'npx', args: ['-y', '@ivan97/echarts-mcp'] },
});
const tools = await client.getTools();
```

## Optional: the charting skill

The repository also ships a [Claude Code skill](https://github.com/Ivan97/echarts-mcp/tree/main/skills/data-charting)
that teaches a model **when** to reach for each chart type, not just how to call the tools:
selection guidance per type, 22 verified `generate_chart` payloads, and 200 official ECharts
gallery examples pre-evaluated into plain options and render-tested in both light and dark.

**It is not part of the npm package.** `npm install` gives you the server only — the skill is
2.7 MB of reference material and lives in the repository. Install it separately.

The quickest way is the [`skills`](https://github.com/vercel-labs/skills) CLI, which reads the
skill straight out of this repository — nothing is published to a registry:

```bash
npx skills add Ivan97/echarts-mcp@data-charting
```

That installs into `.agents/skills/` for the current project and symlinks it into every agent
directory it detects, `.claude/skills/` included. Add `-g` to install for your user instead of
one project, and `--list` to look before installing.

If you would rather not use the CLI, pull the directory out of the GitHub tarball:

```bash
mkdir -p ~/.claude/skills
curl -sL https://github.com/Ivan97/echarts-mcp/archive/refs/heads/main.tar.gz \
  | tar xz --strip-components=2 -C ~/.claude/skills \
    echarts-mcp-main/skills/data-charting
```

For one project only, point `-C` at `<project>/.claude/skills` instead.

Already cloned the repository? Symlink it so it follows your checkout — run this from the
repository root:

```bash
ln -s "$PWD/skills/data-charting" ~/.claude/skills/data-charting
```

Check it landed — the path depends on which method you used — then restart your agent, since
skills are read at startup:

```bash
npx skills list                                   # CLI install
head -2 ~/.claude/skills/data-charting/SKILL.md   # manual install: name: data-charting
```

The directory name must stay `data-charting`; it has to match the `name` in the skill's
frontmatter. The skill assumes the MCP server above is already configured — without it, the
tools the skill names do not exist.

## Three tools

| Tool | What it is for |
|---|---|
| `generate_chart` | The main one. Give it a chart type and data; variants come from `optionOverrides` |
| `render_option` | Expert mode. Pass a complete ECharts option; the ceiling is ECharts itself |
| `list_chart_types` | Look up a type's data shape, a copy-pasteable example, and its available variants |

The tool count is fixed at three on purpose. Giving every chart type its own tool means 20-odd schemas sitting in the model's context at all times. Here that information moves into `list_chart_types`, which the model calls only when it needs it.

### Variants do not need new tools

A stacked bar chart is not a new chart type. It is `bar` plus one option fragment:

```json
{
  "type": "bar",
  "data": { "dimensions": ["Month", "Subscription", "Services"], "source": [["Jan", 182, 61], ["Feb", 214, 74]] },
  "optionOverrides": { "series": [{ "stack": "total" }, { "stack": "total" }] }
}
```

Ready-made fragments come from `list_chart_types`: pass a `type` and it returns that type's `variants`.

## Supported chart types

17 in four groups. Data shapes, example data and rendered samples for each are in
[`docs/chart-types.md`](https://github.com/Ivan97/echarts-mcp/blob/main/docs/chart-types.md).

- **Cartesian**: `bar` `line` `scatter` `heatmap` `boxplot` `candlestick`
- **Non-cartesian**: `pie` `funnel` `radar` `parallel` `treemap` `sunburst`
- **Coordinate-system based**: `calendar` `matrix`
- **Extension-backed**: `liquid` (via `echarts-liquidfill`)
- **Structural**: `sankey` `graph` `tree`

Maps (`map` / `geo`) and 3D types are out of scope for now: maps need GeoJSON distribution, which is its own subsystem, and 3D depends on WebGL, which is unavailable in a server-side rendering environment.

## Output formats and delivery

`output` decides what gets produced, `delivery` decides how it reaches the caller. Leave both unset and the defaults follow the transport, picking whichever costs the fewest tokens:

| Transport | Default delivery | Default output | Why |
|---|---|---|---|
| stdio | `file` | `svg` | Writes to disk and returns the path, which the client can open directly |
| HTTP | `url` | `svg` | A single line in the conversation |

Two rules worth knowing:

- **`delivery: "inline"` forces PNG.** Most chat clients do not render `image/svg+xml`.
- **`output: "html"` cannot be inlined.** It bundles the ECharts runtime and weighs about 1.1 MB, so it goes to a file or a link.

The `html` artifact is a single self-contained page with no external network dependencies. Open it and you get a real chart with tooltips, legend interaction and animation.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `ECHARTS_MCP_TOKEN` | empty | Set it to require a Bearer token; leave it unset for open access |
| `ECHARTS_MCP_PORT` | 3000 | HTTP port |
| `ECHARTS_MCP_PUBLIC_URL` | empty | Base URL for links produced by the `url` channel |
| `ECHARTS_MCP_STORAGE_DIR` | system temp dir | Where chart files are written |
| `ECHARTS_MCP_STORAGE_TTL` | 3600 | Seconds a chart file is kept before cleanup |
| `ECHARTS_MCP_RENDERER` | `auto` | `auto` \| `svg` \| `resvg` \| `canvas` |
| `ECHARTS_MCP_MAX_OPTION_BYTES` | 2000000 | Serialized option size limit |
| `ECHARTS_MCP_MAX_DATA_POINTS` | 50000 | Total data point limit |
| `ECHARTS_MCP_FONT_FILES` | empty | Comma-separated font file paths, overriding auto-detection |

## About fonts

PNG is rasterized on the server using **the server's** fonts. SVG carries font names verbatim and is resolved by **the viewer's** device. The two paths do not see the same fonts.

A container without CJK fonts drops those glyphs silently rather than failing, which is why the image preinstalls `fonts-noto-cjk`.

Rendering a PNG with CJK text takes roughly 90ms. Most of that is parsing the CJK font file itself: Noto Sans CJK is around 20MB and gets reparsed on every rasterization, with no way to reuse a font database. SVG takes about 2ms, which is why it is the default.

## Development

```bash
npm install
npm test            # unit, render regression, visual regression, transport integration
npm run coverage
npm run build
```

## Documentation

- Usage guide: [`docs/usage.md`](https://github.com/Ivan97/echarts-mcp/blob/main/docs/usage.md)
- Chart types with rendered samples: [`docs/chart-types.md`](https://github.com/Ivan97/echarts-mcp/blob/main/docs/chart-types.md)
- The Claude Code skill: [`skills/data-charting/`](https://github.com/Ivan97/echarts-mcp/tree/main/skills/data-charting)
- Design docs and implementation plan: `docs/superpowers/`

## License

MIT
