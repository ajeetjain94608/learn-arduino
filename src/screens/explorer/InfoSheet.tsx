import { t } from '../../i18n/en';
import { CREDITS } from '../../legal/credits';
import type { Hotspot } from '../../ui/callouts/hotspots';

export function InfoSheet({ hotspot }: { hotspot: Hotspot | null }) {
  if (!hotspot) return null;
  return (
    <section className="sheet" data-testid="info-sheet" aria-live="polite">
      <h2>{t(hotspot.nameKey)}</h2>
      <p>{t(hotspot.textKey)}</p>
    </section>
  );
}

export function AboutSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  if (!open) return null;
  return (
    <section className="sheet sheet--about" role="dialog" aria-label={t('about.title')}>
      <h2>{t('about.title')}</h2>
      <p>{t('about.body')}</p>
      <ul>{CREDITS.map((c) => <li key={c}>{c}</li>)}</ul>
      <button type="button" className="sheet__close" onClick={onClose}>{t('about.close')}</button>
    </section>
  );
}
