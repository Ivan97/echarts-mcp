import { describe, it, expect } from 'vitest';
import { buildStandaloneHtml } from '../../src/html/standalone.js';

const SIZE = { width: 600, height: 400 };

describe('buildStandaloneHtml', () => {
  it('产出完整 HTML 文档且内联了 ECharts 运行时', () => {
    const html = buildStandaloneHtml({ series: [{ type: 'bar', data: [1] }] }, SIZE);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html.length).toBeGreaterThan(500_000);
    expect(html).not.toContain('src="http');
  });

  it('函数字符串以可执行 JS 形式写入，不被引号包裹', () => {
    const html = buildStandaloneHtml({ tooltip: { formatter: '(p) => p.name' } }, SIZE);
    expect(html).toContain('"formatter": (p) => p.name');
  });

  it('容器尺寸与请求一致', () => {
    const html = buildStandaloneHtml({}, { width: 900, height: 300 });
    expect(html).toContain('900px');
    expect(html).toContain('300px');
  });

  it('title 写入 <title> 且转义尖括号', () => {
    const html = buildStandaloneHtml({}, SIZE, '<销售>报表');
    expect(html).toContain('<title>&lt;销售&gt;报表</title>');
  });

  // 断言一律只看页面外壳。内联的 ECharts 运行时里本来就含 Inter / #ffffff 这类字串，
  // 扫全文会误报，还会把 1MB 的运行时打进失败信息。
  const shellOf = (html: string) => html.slice(0, html.indexOf('<script>'));

  it('使用 Apple 系统字体栈而非 Inter 之类的通用字体', () => {
    const shell = shellOf(buildStandaloneHtml({}, SIZE));
    expect(shell).toContain('-apple-system');
    expect(shell).not.toContain('Inter');
  });

  it('页面主题锁定到图表主题：深色图表得到深色外壳', () => {
    const dark = buildStandaloneHtml({ backgroundColor: '#161617' }, SIZE);
    expect(dark).toContain('data-theme="dark"');
    const light = buildStandaloneHtml({ backgroundColor: '#fbfbfd' }, SIZE);
    expect(light).toContain('data-theme="light"');
  });

  it('不使用纯黑纯白，且尊重 prefers-reduced-motion', () => {
    const shell = shellOf(buildStandaloneHtml({}, SIZE));
    expect(shell).not.toMatch(/#000000|#ffffff/i);
    expect(shell).toContain('prefers-reduced-motion');
  });

  it('页面文案中不出现 em-dash', () => {
    expect(shellOf(buildStandaloneHtml({}, SIZE, '报表'))).not.toMatch(/[—–]/);
  });

  it('标题上提到页面后不在图表里重复渲染', () => {
    const html = buildStandaloneHtml({ title: { text: '季度收入' }, series: [] }, SIZE);
    expect(html).toContain('<h1>季度收入</h1>');
    // 图表 option 里不应再有 title
    const script = html.slice(html.lastIndexOf('var option ='));
    expect(script).not.toContain('季度收入');
  });

  it('副标题从 option.title.subtext 上提', () => {
    const html = buildStandaloneHtml({ title: { text: '收入', subtext: '单位：万元' } }, SIZE);
    expect(html).toContain('<p>单位：万元</p>');
  });

  it('标题上提后收回模板为它预留的 grid.top 留白', () => {
    const html = buildStandaloneHtml({ title: { text: 'T' }, grid: { top: 70, left: 60 } }, SIZE);
    const script = html.slice(html.lastIndexOf('var option ='));
    expect(script).toContain('"top": 28');
    expect(script).toContain('"left": 60');
  });

  it('调用方自设的紧凑 grid.top 不被改动', () => {
    const html = buildStandaloneHtml({ title: { text: 'T' }, grid: { top: 10 } }, SIZE);
    const script = html.slice(html.lastIndexOf('var option ='));
    expect(script).toContain('"top": 10');
  });
});
