import { TemplateRenderer, interpolate } from './template.renderer';

describe('TemplateRenderer', () => {
  const renderer = new TemplateRenderer();

  it('interpolates {{Variables}} and drops unknowns', () => {
    expect(interpolate('Hi {{Name}} - {{Missing}}', { Name: 'Sara' })).toBe('Hi Sara - ');
  });

  it('renders the built-in bilingual StudentAbsent template', () => {
    const r = renderer.render('StudentAbsent', {
      StudentName: 'Omar',
      AttendanceDate: '2026-06-21',
    });
    expect(r.titleEn).toBe('Absence alert');
    expect(r.bodyEn).toContain('Omar');
    expect(r.bodyEn).toContain('2026-06-21');
    expect(r.titleAr).toContain('غياب');
    expect(r.bodyAr).toContain('Omar');
  });

  it('prefers tenant overrides over the default', () => {
    const r = renderer.render(
      'StudentAbsent',
      { StudentName: 'Lina' },
      { en: { subject: 'Custom', body: '{{StudentName}} absent' } },
    );
    expect(r.titleEn).toBe('Custom');
    expect(r.bodyEn).toBe('Lina absent');
  });

  it('falls back to the generic template for unknown events', () => {
    const r = renderer.render('SomethingNew', { SchoolName: 'Munaxa', Body: 'Hello' });
    expect(r.titleEn).toContain('Munaxa');
    expect(r.bodyEn).toBe('Hello');
  });

  it('builds an RTL-aware HTML email + text fallback and escapes HTML', () => {
    const out = renderer.email({ title: 'Hi', body: '<script>x</script>', language: 'ar' });
    expect(out.html).toContain('dir="rtl"');
    expect(out.html).toContain('&lt;script&gt;');
    expect(out.html).not.toContain('<script>x');
    expect(out.text).toContain('Hi');
  });
});
