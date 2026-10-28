import { useMemo } from 'react';
import { checkWiring } from '../../circuit/check';
import { t, type StringKey } from '../../i18n/en';
import { useBuild } from '../../state/buildContext';
import { useWorkbenchStore } from '../../state/workbenchStore';

const SUPPLY_WORDS: Record<string, string> = { '5V': '5 V', '3V3': '3.3 V', VIN: 'VIN', GND: 'GND' };

// What burnt, in plain words, and the way back: Replace part (an LED) or Replace board (a short or a damaged pin).
export function BurnCard() {
  const burns = useBuild((s) => s.burns);
  const replaceInSim = useWorkbenchStore((s) => s.replacePart);
  const replaceBurn = useBuild((s) => s.replaceBurn);
  const replace = (id: string) => { replaceBurn(id); replaceInSim(id); };
  const parts = useBuild((s) => s.parts);
  const wires = useBuild((s) => s.wires);
  const warnings = useMemo(() => checkWiring({ parts, wires }), [parts, wires]);
  if (!burns.length) return null;
  const lines = burns.map((b) => {
    if (b.reason === 'reversed') return { key: b.id, text: t('burn.reversed'), action: { label: t('burn.replacePart'), id: b.id } };
    if (b.reason === 'led-overcurrent') return { key: b.id, text: t('burn.led'), action: { label: t('burn.replacePart'), id: b.id } };
    if (b.reason === 'short') return { key: b.id, text: t('burn.short').replace('{supply}', SUPPLY_WORDS[b.supply ?? '5V']), action: { label: t('burn.replaceBoard'), id: 'uno' } };
    const pin = b.id.slice(4);
    const to = warnings.find((w) => w.kind === 'pin' && w.pin === pin);
    const text = t('burn.pin').replace('{pin}', pin).replace('{to}', to && to.kind === 'pin' ? SUPPLY_WORDS[to.to] : t('burn.pinOther'));
    return { key: b.id, text, action: { label: t('burn.replaceBoard'), id: 'uno' } };
  });
  return (
    <section className="burn-card" data-testid="burn-card" role="alert">
      {lines.map((l) => (
        <div key={l.key} className="burn-card__item">
          <p>{l.text}</p>
          <button type="button" onClick={() => replace(l.action.id)}>{l.action.label}</button>
        </div>
      ))}
    </section>
  );
}

// Dangerous wiring spotted before Run (it still runs — then the consequences show).
export function WiringWarnings() {
  const parts = useBuild((s) => s.parts);
  const wires = useBuild((s) => s.wires);
  const warnings = useMemo(() => checkWiring({ parts, wires }), [parts, wires]);
  if (!warnings.length) return null;
  return (
    <ul className="wiring-warnings" aria-label={t('build.warnings')}>
      {warnings.map((w, i) => (
        <li key={i}>
          {w.kind === 'short' ? t(`warn.short.${w.supply}` as StringKey)
            : w.kind === 'clash' ? t('warn.clash').replace('{a}', SUPPLY_WORDS[w.a]).replace('{b}', SUPPLY_WORDS[w.b])
            : t('warn.pin').replace('{pin}', w.pin).replace('{to}', SUPPLY_WORDS[w.to])}
        </li>
      ))}
    </ul>
  );
}
