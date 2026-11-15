import { useEffect, useState } from 'react';
import { contrastRatio, parseHex } from '../color/contrast';

type Pair = { label: string; text: string; foreground: string; background: string; ratio: number };

function cssHex(value: string): string | null {
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const channels = match[1].split(/[\s,\/]+/).filter(Boolean).slice(0, 3).map(Number);
    if (channels.length === 3 && channels.every(Number.isFinite)) {
      return `#${channels.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
    }
  }
  try { parseHex(value); return value.startsWith('#') ? value : `#${value}`; } catch { return null; }
}

function mix(foreground: string, background: string, alpha: number): string {
  const fg = parseHex(foreground), bg = parseHex(background);
  return `#${[fg.r, fg.g, fg.b].map((channel, index) => Math.round(channel * alpha + [bg.r, bg.g, bg.b][index] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
}

function inspectTextPairs(): Pair[] {
  const root = document.querySelector<HTMLElement>('.app-shell');
  if (!root) return [];
  const fallback = getComputedStyle(root).getPropertyValue('--bg').trim() || '#f3c43a';
  const pairs: Pair[] = [];
  for (const node of root.querySelectorAll<HTMLElement>('*')) {
    const text = [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    if (rect.width === 0 || rect.height === 0 || rect.right < 0 || rect.bottom < 0 || rect.left > innerWidth || rect.top > innerHeight || style.display === 'none' || style.visibility === 'hidden') continue;
    let effectiveOpacity = 1;
    for (let parent: HTMLElement | null = node; parent && parent !== root; parent = parent.parentElement) effectiveOpacity *= Number(getComputedStyle(parent).opacity || 1);
    if (effectiveOpacity <= 0.03) continue;
    const foreground = cssHex(style.color);
    if (!foreground) continue;
    let ancestor: HTMLElement | null = node;
    let background: string | null = null;
    while (ancestor && ancestor !== root) {
      const bg = getComputedStyle(ancestor).backgroundColor;
      const rgba = bg.match(/rgba?\(([^)]+)\)/i);
      const alpha = rgba?.[1].split(/[\s,\/]+/).filter(Boolean)[3];
      if (bg !== 'transparent' && (!alpha || Number(alpha) >= 0.98)) {
        background = cssHex(bg);
        if (background) break;
      }
      ancestor = ancestor.parentElement;
    }
    background ||= cssHex(fallback) || '#f3c43a';
    const effectiveForeground = mix(foreground, background, effectiveOpacity);
    const label = `${node.tagName.toLowerCase()}${node.classList.length ? `.${[...node.classList].join('.')}` : ''}`;
    const shortText = text.length > 52 ? `${text.slice(0, 49)}…` : text;
    pairs.push({ label, text: shortText, foreground: effectiveForeground, background, ratio: contrastRatio(effectiveForeground, background) });
  }
  return pairs.sort((a, b) => a.ratio - b.ratio);
}

export function ContrastDebugOverlay() {
  const [open, setOpen] = useState(false);
  const [pairs, setPairs] = useState<Pair[]>([]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'd' || event.ctrlKey || event.altKey || event.metaKey) return;
      if ((event.target as HTMLElement).matches('input,textarea,button,[contenteditable="true"]')) return;
      setOpen(value => !value);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  useEffect(() => {
    if (open) setPairs(inspectTextPairs());
  }, [open]);
  if (!import.meta.env.DEV || !open) return null;
  return (
    <aside className="contrast-debug" aria-label="Development contrast report">
      <header><b>CONTRAST REPORT / {pairs.length}</b><button onClick={() => setOpen(false)} aria-label="Close contrast report">×</button></header>
      <p>Computed text and nearest solid background pairs. WCAG AA target: 4.5:1.</p>
      <div className="contrast-debug-list">
        {pairs.map((pair, index) => <div key={`${pair.label}-${index}`} className={pair.ratio < 4.5 ? 'is-failing' : ''}>
          <strong>{pair.text}</strong><small>{pair.label}</small><code>{pair.foreground} on {pair.background} · {pair.ratio.toFixed(2)}:1</code>
        </div>)}
      </div>
    </aside>
  );
}
