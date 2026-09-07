import { describe, it, expect } from 'vitest';
import { ChartType } from '../../src/types.js';
import { CHART_TEMPLATES } from '../../src/charts/registry.js';
import { registerCartesianTemplates } from '../../src/charts/cartesian.js';
import { registerCategoricalTemplates } from '../../src/charts/categorical.js';
import { registerStructuralTemplates } from '../../src/charts/structural.js';
import { registerCoordinateTemplates } from '../../src/charts/coordinate.js';
import { registerLiquidTemplates } from '../../src/charts/liquid.js';

describe('模板覆盖度', () => {
  it('18 种 ChartType 全部有模板，且 example 都能 build 出 series', () => {
    registerCartesianTemplates();
    registerCategoricalTemplates();
    registerStructuralTemplates();
  registerCoordinateTemplates();
  registerLiquidTemplates();

    const missing = Object.values(ChartType).filter((t) => !CHART_TEMPLATES[t]);
    expect(missing).toEqual([]);

    for (const type of Object.values(ChartType)) {
      const tpl = CHART_TEMPLATES[type]!;
      expect(tpl.build({ data: tpl.example }).series, `${type} 的 example 没能 build 出 series`).toBeDefined();
    }
  });
});
