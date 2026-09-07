---
name: data-charting
description: "Turn data into a chart with Apache ECharts through the `@ivan97/echarts-mcp` server (generate_chart, render_option, list_chart_types). Use when asked to chart, plot, graph or visualize data, when 画图/图表/柱状图/折线图/饼图/散点图/热力图/桑基图/K线图/日历图 come up, and whenever an answer about a trend, comparison, breakdown or distribution would land better as a chart than a table. Read it before reaching for another charting tool or telling the user something cannot be drawn — it lists what this server does and does not support. Covers type selection, the three input shapes, variants via optionOverrides, light and dark themes, and the silently blank chart ECharts hands back instead of an error."
---

# Charting data with ECharts

## The server this skill needs

This skill drives **`@ivan97/echarts-mcp`** — the scoped package. Configure it before using
anything below:

```json
{
  "mcpServers": {
    "echarts": { "command": "npx", "args": ["-y", "@ivan97/echarts-mcp"] }
  }
}
```

With Claude Code: `claude mcp add echarts -- npx -y @ivan97/echarts-mcp`

**Do not install the unscoped `echarts-mcp`.** That name belongs to an unrelated package by a
different author. It exposes one tool, `generate-echarts`, which takes a raw ECharts option plus
a width and height and returns a PNG — none of the three tools below exist there, and none of
the templates, themes or `optionOverrides` in this skill apply to it. If the tools you see are
named `generate-echarts` rather than `generate_chart`, you have the wrong server: stop and say
so rather than trying to adapt.

## Three tools

Reach for `generate_chart` first.

| Tool | Use it when |
|---|---|
| `generate_chart` | Default. You have a chart type and data |
| `render_option` | Templates cannot express it: multiple coordinate systems, custom series combinations |
| `list_chart_types` | You are unsure of a type's data shape or want its ready-made variant fragments |

**The one thing to internalize: ECharts does not throw on a bad option, it silently draws a blank chart.** A tool call that "succeeded" can still have produced nothing. The server detects this and prefixes the response with a note; read the note before doing anything else.

## Pick the type from the question

Match what the user is asking, not what the numbers look like.

| The user is asking | Type |
|---|---|
| How does this change over time? | `line` |
| How do these categories compare? | `bar` |
| What share does each part hold? | `pie` |
| Do these two measures relate? | `scatter` |
| Where do people drop off? | `funnel` for linear stages, `sankey` when the flow branches |
| How does one subject score across several axes? | `radar` |
| Which cell is hot in a two-dimension grid? | `heatmap` |
| How is a whole broken into nested parts? | `treemap` for area, `sunburst` for rings |
| How is this distribution spread? | `boxplot` |
| How did this price move? | `candlestick` |
| How are these entities connected? | `graph` |
| What is the hierarchy? | `tree` |
| How do many samples compare across many measures? | `parallel` |
| Which days were busy, over a year? | `calendar` |
| Which cell of a cross-tab is large, read value by value? | `matrix` — `heatmap` when you want the colour pattern instead |
| Is this one metric full yet? | `liquid` — one ratio, progress-board style. Anything you need to compare or read precisely belongs in a `bar` |

`map`, `geo`, `lines` and 3D types are **not supported**. If the user wants a map, say so; do not substitute `scatter`.

`gauge`, `pictorialBar` and `themeRiver` were **deliberately dropped**: the first two are skeuomorphic or infographic decoration (dials, clocks, bars made of repeated icons) and the third cannot be read to an exact value. For several series shifting over time, use a stacked area chart.

For a single metric against a target, a plain number or a `bar` is usually the honest answer. `liquid` is the one exception kept, and only for progress boards, which are read for the "how full" impression rather than for the value. The moment the reader has to compare that metric with anything else, it is the wrong pick — that is the same reason `gauge` is gone.

The table above picks a type. **When the choice is not obvious, or you want to know when a type is the wrong call, read `references/choosing-and-options.md`.** It covers, per type, what it is good for, what it is not, and the misuse that shows up most often — a pie chart with nine slices, a bar chart whose axis does not start at zero, a funnel used for a branching flow.

## The official gallery: drill down, never bulk-load

The Apache ECharts gallery has 227 examples in 17 of our 18 types (`liquid` comes from a third-party extension and has none). **200 are bundled here**, each evaluated into a plain option and verified to render in both light and dark. The other 27 cannot be drawn by this server — they need `geo`/`map`, a `custom` series, a third-party data transform, or a browser `Image`; `references/gallery-support.md` names every one with its reason. They are the fallback for "I need something the templates do not cover".

**Work down the funnel — one file per step. Never read a whole directory.**

| Step | Read | Size |
|---|---|---|
| 1. Which type fits the question? | `references/gallery.md` — data shape, question answered and typical topics for all 18 types | ~11 KB |
| 2. Which example within that type? | `references/gallery/<type>.md` — the examples with feature tags (stacked, polar, dataZoom, time axis…) | 1–6 KB |
| 3. Get the option | `examples/gallery/<type>/<id>.json` → its `option` field, straight into `render_option` | ~4 KB median |

Skip step 1 when the type is already obvious. Never read more than one file at step 3 — the catalogue is 2.4 MB in total and you need exactly one option out of it.

**Prefer the curated examples when a template can do the job.** Skim `references/examples.md` (3 KB) and pull the one payload you want out of `examples/examples.json` by `id` — do not read the whole 23 KB file for one payload. Those are `generate_chart` payloads: data and styling stay separate, the theme applies, spacing is handled. Gallery entries are raw upstream options — broader coverage, but you own every field, and any colour they hardcode will not follow `theme`.

## Three data shapes

**Tabular** (15 types) — first dimension is the category axis, each remaining one becomes a series:

```json
{ "dimensions": ["Month", "Sales", "Profit"], "source": [["Jan", 120, 30], ["Feb", 200, 60]] }
```

Rows may be objects keyed by `dimensions` instead of arrays. Some types need an exact dimension count and will tell you the expected number if you get it wrong: `pie`/`funnel`/`treemap`/`sunburst`/`calendar`/`liquid` need 2, `heatmap`/`matrix` need 3, `candlestick` needs 5, `boxplot` needs 6 (a precomputed five-number summary, not raw observations).

**Node-link** (`sankey`, `graph`) — `source` and `target` must name entries in `nodes`:

```json
{ "nodes": [{ "name": "Visit" }, { "name": "Signup" }],
  "links": [{ "source": "Visit", "target": "Signup", "value": 60 }] }
```

**Tree** (`tree`) — one root, recursive `children`:

```json
{ "name": "Company", "children": [{ "name": "Engineering", "children": [{ "name": "Frontend" }] }] }
```

For anything beyond `bar`/`line`/`pie`/`scatter`, read `references/chart-types.md` rather than guessing. It is generated from the source, so it cannot drift.

## Variants are option fragments, not new types

Stacked, horizontal, polar, smooth, area, rose, dual-axis are the same `type` plus `optionOverrides`. Merging is recursive and **arrays merge by index**, so touching `series[0]` will not wipe its `data`.

```json
{ "type": "bar",
  "data": { "dimensions": ["Month", "Sub", "Svc"], "source": [["Jan", 182, 61], ["Feb", 214, 74]] },
  "optionOverrides": { "series": [{ "stack": "total" }, { "stack": "total" }] } }
```

Common fragments:

| Want | `optionOverrides` |
|---|---|
| Stacked | `{"series":[{"stack":"t"},{"stack":"t"}]}` — one entry per series |
| Area | `{"series":[{"areaStyle":{}}]}` |
| Smooth | `{"series":[{"smooth":true}]}` |
| Value labels | `{"series":[{"label":{"show":true,"position":"top"}}]}` |
| Custom colors | `{"color":["#c23531","#2f4554"]}` |
| Dual Y axis | `{"yAxis":[{"type":"value"},{"type":"value"}],"series":[{},{"yAxisIndex":1,"type":"line"}]}` |
| Rose pie | `{"series":[{"roseType":"area","radius":["15%","72%"]}]}` |
| Percent labels on pie | `{"series":[{"label":{"show":true,"formatter":"{b}: {d}%"}}]}` |
| Mean line and extremes | `{"series":[{"markLine":{"data":[{"type":"average"}]},"markPoint":{"data":[{"type":"max"}]}}]}` |

### Four charts that look unsupported but are not

There is no `waterfall`, `histogram`, `orgchart` or `mindmap` in the type list, and
that reads as "cannot do it". All four are an existing type plus a few lines of
`optionOverrides` — reach for these before telling the user no or switching tools.

| Want | Type | `optionOverrides` |
|---|---|---|
| Waterfall | `bar` | Two series stacked, the lower one invisible. Give each row a `[placeholder, delta]` pair: `{"series":[{"stack":"t","itemStyle":{"color":"transparent"},"emphasis":{"itemStyle":{"color":"transparent"}}},{"stack":"t","label":{"show":true,"position":"top"}}],"legend":{"show":false}}` |
| Histogram | `bar` | `{"series":[{"barCategoryGap":"0%","itemStyle":{"borderColor":"#fff","borderWidth":1}}],"legend":{"show":false}}` — **bin the data yourself**, ECharts does no automatic bucketing |
| Org chart | `tree` | `{"series":[{"orient":"TB","symbol":"rect","symbolSize":[58,26],"edgeShape":"polyline","initialTreeDepth":-1,"label":{"position":"inside","align":"center","verticalAlign":"middle","color":"#fff"}}]}` — shrink `symbolSize` or widen the canvas when sibling boxes touch |
| Mind map | `tree` | `{"series":[{"orient":"LR","edgeShape":"curve","symbol":"emptyCircle","symbolSize":9,"initialTreeDepth":-1,"label":{"position":"right"},"right":"22%"}]}` — branches fan out one side only, not both |

Flowcharts and fishbone diagrams are technically reachable through `graph` with
hand-placed `x`/`y`, but edge labels come out rotated and the diagonal arrowheads
drop — use a Mermaid diagram instead. Venn, violin, word cloud and pivot tables
have no workable equivalent here.

**`calendar` dates must be `YYYY-MM-DD`.** ECharts does not reject a date it cannot parse — it drops the point, so a wrong format yields a blank calendar with no warning. The template checks this and errors instead.

**`liquid` needs an extension.** It is the one type not built into ECharts — it
comes from `echarts-liquidfill`, which ships with the server. It has no official
gallery examples for the same reason. It holds exactly one ratio per ball; give it
`0.62` or `62` and both read as 62%, but a column is interpreted as one or the
other, never mixed.

**Two fragments carry a placeholder you must replace.** The horizontal (`横向`) and polar (`极坐标`) variants for `bar` ship with `"data": ["替换为实际类目"]`. Paste one verbatim and the axis renders that literal text with none of the real categories — the chart looks plausible, has a normal file size, and triggers no warning. Substitute the actual categories first.

## Output and delivery

Leave both unset unless you have a reason; the defaults follow the transport and cost the fewest tokens.

| Goal | Set |
|---|---|
| Just show a chart | nothing |
| Show it inline in a chat window | `"delivery": "inline"` — forces PNG, since most clients do not render SVG |
| Hand the config to a frontend | `"output": "option"` |
| Interactive page with tooltips and animation | `"output": "html"` — about 1.1 MB, returned as a file or link, never inline |

## Light and dark

`"theme": "default"` (light, the default) or `"theme": "dark"`. Both accept the same payload; the theme sets palette, background, text, axis and gridline colours. `"vintage"` also exists.

Set `dark` when the chart lands somewhere dark — a dark-mode page, a slide deck on a dark background — or when the user asks. Otherwise leave it alone.

**The theme is merged *underneath* your option, so anything you set wins.** That is the intended precedence, but it has a consequence worth knowing: raw gallery options frequently hardcode `itemStyle.color`, `backgroundColor`, or `visualMap.inRange.color`, and those keep their original colours under `dark` — the chart renders, but only the chrome goes dark. If you need a chart that genuinely follows the theme, use `generate_chart` (templates hardcode no colours) or delete the offending fields from the gallery option.

All 200 bundled gallery examples were verified to render in **both** themes — see `references/gallery-support.md`.

## Functions cannot be sent

Tool arguments are JSON. Use string templates (`{b}`, `{c}`, `{d}%`) for labels, and per-point `symbolSize` on each data item for bubble charts. Function strings execute only under `"output": "html"`, where the browser runs them.

## Do not

- **Do not use `render_option` for an ordinary chart.** It bypasses the templates, so you lose sensible grid spacing, legends and theming, and must get every field right yourself.
- **Do not fabricate data.** If numbers are missing, ask.
- **Do not retry the same arguments after an empty-chart note.** The note names the field to fix.
- **Do not restate the chart in prose.** The response is already `![title](path)`; pass it through and add only what the chart does not show.

## Bundled files

| Path | What it is | When to read it |
|---|---|---|
| `references/choosing-and-options.md` | Per type: what it suits, what it does not, the usual misuse. Then all 33 option fragments grouped by concern, each with its visual effect | Choosing between two types, or configuring anything beyond the basics |
| `references/chart-types.md` | All 18 types: data shape, runnable example, every variant fragment. Generated from source, so it cannot drift | Working with a type not covered in this file |
| `references/troubleshooting.md` | Every error code and silent-failure mode, with measured behavior | A chart came back empty or wrong |
| `references/gallery.md` | Entry point to the official gallery: per-type data shape, question answered, typical topics, and where each type's examples live | Choosing a type, or looking for an example beyond the basics |
| `references/gallery/<type>.md` | One per type: that type's selection profile plus its examples with feature tags | You know the type and want the closest example |
| `references/gallery-support.md` | What actually rendered, light and dark, and the 27 official examples we cannot draw with the reason for each | Asked whether some official example works here |
| `references/examples.md` | Index of the curated examples: id, purpose, type, the gotcha for each. Generated from the JSON | Picking a starting point — read this before the JSON |
| `examples/examples.json` | The 22 curated `generate_chart` payloads themselves, copy-pasteable | You picked an id and want its full payload |
| `examples/gallery/<type>/<id>.json` | One official example: its `option` plus tags, upstream link and any trimming note | Step 3 of the drill-down — read exactly one |
| `examples/option-effects.json` | The 33 option fragments with their described effect. The readable version is the options table in `choosing-and-options.md` | Programmatic use, or regenerating that table |
| `scripts/verify-examples.mjs` | Runs every example through a live server, asserts non-empty output | After changing the examples or upgrading the server |
| `scripts/verify-option-effects.mjs` | Applies each fragment to a baseline chart, asserts it renders **and differs from the baseline** — catching fragments that silently do nothing | Same |
| `scripts/generate-references.mjs` | Regenerates `references/chart-types.md` from source and `references/examples.md` from the curated JSON | After the server adds types or variants, or the examples change |
| `scripts/build-gallery.mjs` | Re-fetches the official gallery and rebuilds `examples/gallery/` and the catalogues | Upstream added examples |
| `scripts/verify-gallery.mjs` | Renders every gallery example in both themes and rewrites `references/gallery-support.md` | After rebuilding the gallery or upgrading the server |
| `scripts/chart-profiles.mjs` | The per-type selection profiles that feed the catalogues | Changing the selection guidance |

All verification scripts are green as committed: 22/22 curated examples render, 33/33 option fragments take effect, and 200/200 gallery examples render in both light and dark.
