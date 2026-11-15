import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';

const transpile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }
}).outputText;
const contrastUrl = `data:text/javascript;base64,${Buffer.from(await transpile('../src/color/contrast.ts')).toString('base64')}`;
const paletteSource = (await transpile('../src/color/palette.ts')).replace("'./contrast.ts'", `'${contrastUrl}'`);
const paletteUrl = `data:text/javascript;base64,${Buffer.from(paletteSource).toString('base64')}`;
const { contrastRatio, parseHex, pickReadable, relativeLuminance, srgbToLinear } = await import(contrastUrl);
const { buildPalette } = await import(paletteUrl);

test('sRGB channels convert to linear light and luminance endpoints', () => {
  assert.equal(srgbToLinear(0), 0);
  assert.equal(srgbToLinear(1), 1);
  assert.ok(Math.abs(srgbToLinear(0.04045) - 0.0031308) < 0.000001);
  assert.equal(relativeLuminance('#000000'), 0);
  assert.equal(relativeLuminance('#ffffff'), 1);
  assert.deepEqual(parseHex('#abc'), { r: 170, g: 187, b: 204 });
});

test('WCAG contrast and readable candidate selection', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.ok(contrastRatio('#767676', '#ffffff') > 4.5);
  assert.equal(pickReadable('#ffffff', ['#111111', '#fff9e8']), '#111111');
  assert.equal(pickReadable('#111111', ['#111111', '#fff9e8']), '#fff9e8');
});

test('20 high-variance album colors produce readable, separated palettes', () => {
  const sampleAlbumColors = [
    '#ffff00', '#ffffff', '#000000', '#808080', '#00ffff', '#ff1493', '#000080', '#ff0000', '#00ff00', '#0000ff',
    '#ff7f00', '#4b0082', '#8b4513', '#c0c0c0', '#2f4f4f', '#f0e68c', '#7cfc00', '#ff69b4', '#1e90ff', '#708090'
  ];
  for (const albumColor of sampleAlbumColors) {
    const palette = buildPalette([albumColor], {
      bg: '#537cf2', surface: '#f6f0dd', accent: '#ff4fa1', accent2: '#f3c43a'
    });
    assert.ok(contrastRatio(palette.bg, palette.onBg) >= 4.5, `${albumColor}: on-bg`);
    assert.ok(contrastRatio(palette.surface, palette.onSurface) >= 4.5, `${albumColor}: on-surface`);
    assert.ok(contrastRatio(palette.accent, palette.onAccent) >= 4.5, `${albumColor}: on-accent`);
    assert.ok(contrastRatio(palette.accent2, palette.ink) >= 3, `${albumColor}: accent-2 border`);
    assert.ok(contrastRatio(palette.bg, palette.ink) >= 3, `${albumColor}: bg border`);
    assert.ok(contrastRatio(palette.surface, palette.ink) >= 3, `${albumColor}: surface border`);
    assert.ok(contrastRatio(palette.accent, palette.ink) >= 3, `${albumColor}: accent border`);
    assert.ok(contrastRatio(palette.bg, palette.surface) >= 1.5, `${albumColor}: bg/surface separation`);
    assert.ok(contrastRatio(palette.surface, palette.accent) >= 1.5, `${albumColor}: surface/accent separation`);
    assert.ok(contrastRatio(palette.bg, palette.accent) >= 1.5, `${albumColor}: bg/accent separation`);
    assert.ok(contrastRatio(palette.bg, palette.accent2) >= 1.5, `${albumColor}: bg/accent-2 separation`);
    assert.ok(contrastRatio(palette.surface, palette.accent2) >= 1.5, `${albumColor}: surface/accent-2 separation`);
  }
});

test('scene fallback and curated palettes retain readable foreground and outline roles', () => {
  const presets = [
    ['#6FE7FF', '#F8F8F2', '#FF4FA1', '#07121A'], ['#537CF2', '#B9D6FF', '#161A33', '#FC6F58'],
    ['#1A1C29', '#4C5BD4', '#FFE600', '#0D0E15'], ['#F3C43A', '#FFF4BD', '#122A4A', '#EF5B43'],
    ['#A7DB55', '#F5EE9E', '#1F3722', '#FF6F59'], ['#F05232', '#FFCB46', '#24130F', '#F8EFD8'],
    ['#F59E0B', '#EF4444', '#78350F', '#FEF3C7'], ['#27B8B1', '#B3EEE2', '#123F51', '#F37F5B'],
    ['#0B0C1A', '#8B5CF6', '#38BDF8', '#F3F4F6'], ['#FF815A', '#FFD35B', '#65284F', '#F8E9C9'],
    ['#EB5BC3', '#70F1DE', '#211B43', '#F5E650'], ['#F5A8C7', '#FFE9DA', '#772B58', '#F4CC48']
  ];
  for (const [bg, surface, accent, accent2] of presets) {
    const palette = buildPalette(undefined, { bg, surface, accent, accent2 }, { bg: '#72c9df', surface: '#eef9fb', accent: '#f07191', accent2: '#e8c75b' });
    assert.ok(contrastRatio(palette.bg, palette.onBg) >= 4.5, `${bg}: fallback bg text`);
    assert.ok(contrastRatio(palette.surface, palette.onSurface) >= 4.5, `${bg}: fallback surface text`);
    assert.ok(contrastRatio(palette.accent, palette.onAccent) >= 4.5, `${bg}: fallback accent text`);
    assert.ok(contrastRatio(palette.bg, palette.ink) >= 3, `${bg}: fallback outline`);
    assert.ok(contrastRatio(palette.accent, palette.ink) >= 3, `${bg}: accent outline`);
    assert.ok(contrastRatio(palette.bg, palette.surface) >= 1.5, `${bg}: fallback bg/surface separation`);
    assert.ok(contrastRatio(palette.surface, palette.accent) >= 1.5, `${bg}: fallback surface/accent separation`);
    assert.ok(contrastRatio(palette.bg, palette.accent) >= 1.5, `${bg}: fallback bg/accent separation`);
  }
});
