import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { ChartType } from '../../src/types.js';
import { CHART_TEMPLATES } from '../../src/charts/registry.js';
import { registerCartesianTemplates } from '../../src/charts/cartesian.js';
import { registerCategoricalTemplates } from '../../src/charts/categorical.js';
import { registerStructuralTemplates } from '../../src/charts/structural.js';
import { registerCoordinateTemplates } from '../../src/charts/coordinate.js';
import { registerLiquidTemplates } from '../../src/charts/liquid.js';
import { buildOption } from '../../src/option/build.js';
import { ResvgRenderer } from '../../src/render/resvg.js';

const BASELINE = join(process.cwd(), 'tests/__baselines__');
const SIZE = { width: 600, height: 400 };

// 只挑关键类型做像素比对。数量少是刻意的：像素级断言容易 flaky，
// 全类型的结构性覆盖已由 svg.test.ts 承担。
const KEY_TYPES = [ChartType.Bar, ChartType.Line, ChartType.Pie];

beforeAll(() => {
  registerCartesianTemplates();
  registerCategoricalTemplates();
  registerStructuralTemplates();
  registerCoordinateTemplates();
  registerLiquidTemplates();
  mkdirSync(BASELINE, { recursive: true });
});

describe('视觉回归', () => {
  it.each(KEY_TYPES)('%s 的渲染结果与基线一致', async (type) => {
    const png = (
      await new ResvgRenderer(1).render(
        buildOption({ type, data: CHART_TEMPLATES[type]!.example, title: '基线' }),
        SIZE,
      )
    ).bytes;
    const file = join(BASELINE, `${type}.png`);

    if (!existsSync(file)) {
      writeFileSync(file, png);
      // 首次运行生成基线并主动失败。基线必须人工看过再提交，
      // 否则等于把一张错图固化成「正确答案」，后续回归检测全部失效。
      expect.fail(`已生成基线 ${file}，请人工确认图像正确后提交，然后重跑本测试`);
    }

    const actual = PNG.sync.read(png);
    const expected = PNG.sync.read(readFileSync(file));
    expect(actual.width).toBe(expected.width);
    expect(actual.height).toBe(expected.height);

    const diff = pixelmatch(actual.data, expected.data, null, actual.width, actual.height, {
      threshold: 0.1,
    });
    const ratio = diff / (actual.width * actual.height);
    expect(ratio, `${type} 与基线差异 ${(ratio * 100).toFixed(2)}%`).toBeLessThan(0.01);
  });
});
