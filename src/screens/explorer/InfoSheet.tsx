import { t } from '../../i18n/en';
import { CREDITS } from '../../legal/credits';

// Explanation of the selected label or part.
export function InfoSheet({ info }: { info: { title: string; text: string } | null }) {
  if (!info) return null;
  return (
    <section className="sheet" data-testid="info-sheet" aria-live="polite">
      <h2>{info.title}</h2>
      <p>{info.text}</p>
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
