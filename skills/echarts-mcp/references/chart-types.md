# 图表类型与数据结构参考

> 本文件由 `scripts/generate-references.mjs` 从 echarts-mcp 源码生成，不要手工编辑。
> 代码改动后重新运行该脚本即可同步。

共 17 种类型。

## 直角坐标系

### `bar`

**data 结构**：Dataset：dimensions 第 1 项为类目轴，其余每项生成一条柱系列。source 每行为 [类目, 值1, 值2, ...]

**可直接使用的示例**：

```json
{
  "type": "bar",
  "data": {
    "dimensions": [
      "月份",
      "销量"
    ],
    "source": [
      [
        "1月",
        120
      ],
      [
        "2月",
        200
      ],
      [
        "3月",
        150
      ],
      [
        "4月",
        80
      ]
    ]
  }
}
```

**细分样式**（4 种，放进 `optionOverrides`）：

- **堆叠** — 多条系列叠加显示总量。需要为每条系列指定同一个 stack 名

  ```json
  {
    "series": [
      {
        "stack": "总量"
      },
      {
        "stack": "总量"
      }
    ]
  }
  ```

- **横向** — 条形图。把类目轴换到 Y 轴，适合类目名较长的场景。yAxis.data 要填实际类目

  ```json
  {
    "xAxis": {
      "type": "value",
      "data": null
    },
    "yAxis": {
      "type": "category",
      "data": [
        "替换为实际类目"
      ]
    }
  }
  ```

- **极坐标** — 南丁格尔式柱状图。需同时把 grid/xAxis/yAxis 置为 null 并声明 polar

  ```json
  {
    "grid": null,
    "xAxis": null,
    "yAxis": null,
    "polar": {
      "radius": [
        28,
        "75%"
      ]
    },
    "angleAxis": {
      "type": "category",
      "data": [
        "替换为实际类目"
      ]
    },
    "radiusAxis": {},
    "series": [
      {
        "coordinateSystem": "polar"
      }
    ]
  }
  ```

- **圆角与数值标签** — 柱顶显示数值并加圆角，用于强调具体数字

  ```json
  {
    "series": [
      {
        "label": {
          "show": true,
          "position": "top"
        },
        "itemStyle": {
          "borderRadius": [
            6,
            6,
            0,
            0
          ]
        }
      }
    ]
  }
  ```

### `line`

**data 结构**：Dataset：同 bar，dimensions 第 1 项为类目轴，其余每项一条折线

**可直接使用的示例**：

```json
{
  "type": "line",
  "data": {
    "dimensions": [
      "月份",
      "销量",
      "利润"
    ],
    "source": [
      [
        "1月",
        120,
        30
      ],
      [
        "2月",
        200,
        60
      ],
      [
        "3月",
        150,
        45
      ],
      [
        "4月",
        180,
        70
      ]
    ]
  }
}
```

**细分样式**（6 种，放进 `optionOverrides`）：

- **面积** — 折线下方填充色块，强调累积量

  ```json
  {
    "series": [
      {
        "areaStyle": {}
      }
    ]
  }
  ```

- **阶梯** — 阶梯状折线，适合状态跳变类数据

  ```json
  {
    "series": [
      {
        "step": "end"
      }
    ]
  }
  ```

- **平滑** — 曲线平滑处理

  ```json
  {
    "series": [
      {
        "smooth": true
      }
    ]
  }
  ```

- **平滑堆叠面积** — 多条系列堆叠的平滑面积图

  ```json
  {
    "series": [
      {
        "smooth": true,
        "areaStyle": {},
        "stack": "t"
      },
      {
        "smooth": true,
        "areaStyle": {},
        "stack": "t"
      }
    ]
  }
  ```

- **双 Y 轴** — 量纲不同的两条系列共存，第二条走右侧轴并改为折线

  ```json
  {
    "yAxis": [
      {
        "type": "value",
        "name": "左轴"
      },
      {
        "type": "value",
        "name": "右轴"
      }
    ],
    "series": [
      {},
      {
        "type": "line",
        "yAxisIndex": 1,
        "smooth": true
      }
    ]
  }
  ```

- **均值线与极值点** — 标出最大值、最小值与平均线，无需自行计算

  ```json
  {
    "series": [
      {
        "markPoint": {
          "data": [
            {
              "type": "max",
              "name": "最大值"
            },
            {
              "type": "min",
              "name": "最小值"
            }
          ]
        },
        "markLine": {
          "data": [
            {
              "type": "average",
              "name": "平均值"
            }
          ]
        }
      }
    ]
  }
  ```

### `scatter`

**data 结构**：Dataset：dimensions 第 1 项为 x 轴类目，其余每项一组散点

**可直接使用的示例**：

```json
{
  "type": "scatter",
  "data": {
    "dimensions": [
      "x",
      "y"
    ],
    "source": [
      [
        "A",
        10
      ],
      [
        "B",
        25
      ],
      [
        "C",
        18
      ],
      [
        "D",
        32
      ],
      [
        "E",
        22
      ]
    ]
  }
}
```

**细分样式**（1 种，放进 `optionOverrides`）：

- **气泡图** — 逐点指定 symbolSize 表达第三个维度。注意 symbolSize 不能写成回调函数，必须逐点给数值

  ```json
  {
    "series": [
      {
        "data": [
          {
            "value": [
              10,
              200
            ],
            "symbolSize": 20
          },
          {
            "value": [
              20,
              150
            ],
            "symbolSize": 42
          }
        ]
      }
    ]
  }
  ```

### `heatmap`

**data 结构**：Dataset：dimensions 恰好 3 项 [x 类目, y 类目, 数值]，source 每行为 [x, y, value]

**可直接使用的示例**：

```json
{
  "type": "heatmap",
  "data": {
    "dimensions": [
      "星期",
      "时段",
      "访问量"
    ],
    "source": [
      [
        "周一",
        "上午",
        5
      ],
      [
        "周一",
        "下午",
        9
      ],
      [
        "周二",
        "上午",
        2
      ],
      [
        "周二",
        "下午",
        7
      ],
      [
        "周三",
        "上午",
        8
      ],
      [
        "周三",
        "下午",
        3
      ]
    ]
  }
}
```

**细分样式**（1 种，放进 `optionOverrides`）：

- **自定义色带** — 用 visualMap.inRange.color 指定连续配色，纯声明式，无需函数

  ```json
  {
    "visualMap": {
      "inRange": {
        "color": [
          "#34c759",
          "#ffcc00",
          "#ff3b30"
        ]
      }
    }
  }
  ```

### `boxplot`

**data 结构**：Dataset：dimensions 恰好 6 项，source 每行为 [名称, min, Q1, median, Q3, max]。五数概括需调用方预先算好

**可直接使用的示例**：

```json
{
  "type": "boxplot",
  "data": {
    "dimensions": [
      "分组",
      "min",
      "Q1",
      "median",
      "Q3",
      "max"
    ],
    "source": [
      [
        "A",
        1,
        3,
        5,
        7,
        9
      ],
      [
        "B",
        2,
        4,
        6,
        8,
        12
      ],
      [
        "C",
        0,
        2,
        4,
        6,
        10
      ]
    ]
  }
}
```

### `candlestick`

**data 结构**：Dataset：dimensions 恰好 5 项，source 每行为 [日期, open, close, low, high]

**可直接使用的示例**：

```json
{
  "type": "candlestick",
  "data": {
    "dimensions": [
      "日期",
      "open",
      "close",
      "low",
      "high"
    ],
    "source": [
      [
        "01-02",
        10,
        12,
        9,
        13
      ],
      [
        "01-03",
        12,
        11,
        10,
        14
      ],
      [
        "01-04",
        11,
        15,
        10,
        16
      ],
      [
        "01-05",
        15,
        13,
        12,
        17
      ]
    ]
  }
}
```

## 非直角坐标系

### `pie`

**data 结构**：Dataset：dimensions 恰好 2 项 [名称, 数值]，source 每行为 [名称, 数值]

**可直接使用的示例**：

```json
{
  "type": "pie",
  "data": {
    "dimensions": [
      "渠道",
      "占比"
    ],
    "source": [
      [
        "直销",
        40
      ],
      [
        "分销",
        35
      ],
      [
        "线上",
        25
      ]
    ]
  }
}
```

**细分样式**（2 种，放进 `optionOverrides`）：

- **南丁格尔玫瑰** — 扇区半径随数值变化，适合数值差异明显的场景

  ```json
  {
    "series": [
      {
        "roseType": "area",
        "radius": [
          "15%",
          "72%"
        ]
      }
    ]
  }
  ```

- **外部百分比标签** — 在扇区外标注名称与百分比。formatter 用字符串模板，不需要函数

  ```json
  {
    "series": [
      {
        "radius": "62%",
        "label": {
          "show": true,
          "formatter": "{b}: {d}%"
        }
      }
    ]
  }
  ```

### `funnel`

**data 结构**：Dataset：dimensions 恰好 2 项 [阶段名, 数值]

**可直接使用的示例**：

```json
{
  "type": "funnel",
  "data": {
    "dimensions": [
      "阶段",
      "人数"
    ],
    "source": [
      [
        "访问",
        100
      ],
      [
        "注册",
        60
      ],
      [
        "下单",
        35
      ],
      [
        "付费",
        20
      ]
    ]
  }
}
```

### `radar`

**data 结构**：Dataset：dimensions 第 1 项为系列名，其余每项为一个雷达指标。source 每行为 [系列名, 指标1值, 指标2值, ...]

**可直接使用的示例**：

```json
{
  "type": "radar",
  "data": {
    "dimensions": [
      "角色",
      "攻击",
      "防御",
      "速度",
      "智力"
    ],
    "source": [
      [
        "战士",
        90,
        80,
        40,
        30
      ],
      [
        "法师",
        70,
        40,
        60,
        95
      ]
    ]
  }
}
```

### `parallel`

**data 结构**：Dataset：dimensions 第 1 项为线名，其余每项为一根平行坐标轴。source 每行为 [线名, 轴1值, 轴2值, ...]

**可直接使用的示例**：

```json
{
  "type": "parallel",
  "data": {
    "dimensions": [
      "样本",
      "价格",
      "销量",
      "评分"
    ],
    "source": [
      [
        "A",
        10,
        200,
        4.5
      ],
      [
        "B",
        20,
        150,
        4.8
      ],
      [
        "C",
        15,
        300,
        4.2
      ]
    ]
  }
}
```

### `treemap`

**data 结构**：Dataset：dimensions 恰好 2 项 [层级路径, 数值]。路径用 / 分隔表示层级，例如 "华东/上海"

**可直接使用的示例**：

```json
{
  "type": "treemap",
  "data": {
    "dimensions": [
      "路径",
      "销售额"
    ],
    "source": [
      [
        "华东/上海",
        120
      ],
      [
        "华东/杭州",
        80
      ],
      [
        "华北/北京",
        100
      ],
      [
        "华南/深圳",
        90
      ]
    ]
  }
}
```

### `sunburst`

**data 结构**：Dataset：同 treemap，dimensions 恰好 2 项 [层级路径, 数值]，路径用 / 分隔

**可直接使用的示例**：

```json
{
  "type": "sunburst",
  "data": {
    "dimensions": [
      "路径",
      "数量"
    ],
    "source": [
      [
        "动物/猫",
        5
      ],
      [
        "动物/狗",
        8
      ],
      [
        "植物/树",
        3
      ],
      [
        "植物/花",
        6
      ]
    ]
  }
}
```

## 结构型

### `sankey`

**data 结构**：NodeLinkData：{ nodes: [{ name, value? }], links: [{ source, target, value }] }。links 里的 source/target 必须是 nodes 中出现过的 name

**可直接使用的示例**：

```json
{
  "type": "sankey",
  "data": {
    "nodes": [
      {
        "name": "访问"
      },
      {
        "name": "注册"
      },
      {
        "name": "下单"
      },
      {
        "name": "付费"
      }
    ],
    "links": [
      {
        "source": "访问",
        "target": "注册",
        "value": 60
      },
      {
        "source": "注册",
        "target": "下单",
        "value": 35
      },
      {
        "source": "下单",
        "target": "付费",
        "value": 20
      }
    ]
  }
}
```

### `graph`

**data 结构**：NodeLinkData：{ nodes: [{ name, value? }], links: [{ source, target, value? }] }。使用力导向布局自动排布，node.value 越大节点画得越大

**可直接使用的示例**：

```json
{
  "type": "graph",
  "data": {
    "nodes": [
      {
        "name": "A",
        "value": 10
      },
      {
        "name": "B",
        "value": 6
      },
      {
        "name": "C",
        "value": 4
      },
      {
        "name": "D",
        "value": 8
      }
    ],
    "links": [
      {
        "source": "A",
        "target": "B"
      },
      {
        "source": "A",
        "target": "C"
      },
      {
        "source": "B",
        "target": "D"
      }
    ]
  }
}
```

### `tree`

**data 结构**：TreeNode：{ name, value?, children?: TreeNode[] } 的递归结构，只传一个根节点

**可直接使用的示例**：

```json
{
  "type": "tree",
  "data": {
    "name": "公司",
    "children": [
      {
        "name": "研发",
        "children": [
          {
            "name": "前端"
          },
          {
            "name": "后端"
          }
        ]
      },
      {
        "name": "销售",
        "children": [
          {
            "name": "华东"
          }
        ]
      }
    ]
  }
}
```

## 需要替换占位符的片段

以下片段含 `"替换为实际类目"` 占位符，**照抄不改会把占位文字直接画到坐标轴上，真实类目一个都不显示**：

- bar / 横向
- bar / 极坐标

使用前把 `data` 数组换成实际的类目值。
