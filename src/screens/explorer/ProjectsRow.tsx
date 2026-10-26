import { useEffect, useRef, useState } from 'react';
import { PROJECTS } from '../../content/projects';
import { projectThumb } from '../../content/projects/thumbs';
import { t } from '../../i18n/en';
import { useWorkbenchStore } from '../../state/workbenchStore';
import type { View } from '../../three/workbench/cameraViews';

// The ready-made projects. The first two play right here on Home (the board, and the Blink circuit); the others open
// their own page. Each card shows a picture of the project's real 3D build (npm run bake:projects).
const HOME_VIEW: Record<string, View> = { board: 'board', blink: 'circuit' };
export const PROJECT_ICON: Record<string, string> = {
  board: 'M6 6h12v12H6zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4',
  blink: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z',
  button: 'M4 14h16v4H4zM8 14v-3a4 4 0 0 1 8 0v3',
  knob: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 13V7',
  rgb: 'M9 9a4 4 0 1 0 0 .01M15 9a4 4 0 1 0 0 .01M12 14a4 4 0 1 0 0 .01',
  'night-light': 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  distance: 'M3 12h3M8 8a6 6 0 0 1 0 8M12 5a10 10 0 0 1 0 14M16 3a13 13 0 0 1 0 18',
  tune: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  piano: 'M3 5h18v14H3zM7 5v9M11 5v9M15 5v9M19 5v9',
  motor: 'M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M12 3v6M12 15v6M3 12h6M15 12h6',
  thermostat: 'M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z',
  servo: 'M4 16h16v4H4zM12 16V8M12 8l6-4',
  wheel: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4',
  plant: 'M12 21v-8M12 13c0-4 3-7 7-7 0 4-3 7-7 7zM12 15c0-3-2-5-6-5 0 3 2 5 6 5zM7 21h10',
  strength: 'M4 20a8 8 0 0 1 16 0M12 20l4-6M12 4v2',
  parking: 'M8 3h8v18H8zM12 7m-1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M12 12m-1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M12 17m-1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0',
};

export function ProjectsRow({ onOpen, onAll }: { onOpen?(id: string): void; onAll?(): void } = {}) {
  const view = useWorkbenchStore((s) => s.view);
  const setView = useWorkbenchStore((s) => s.setView);
  const row = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState({ start: true, end: false }); // which arrows have nowhere to go
  const measure = () => {
    const el = row.current; if (!el) return;
    setEnds({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  useEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined' || !row.current) return; // jsdom
    const ro = new ResizeObserver(measure); ro.observe(row.current);
    return () => ro.disconnect();
  }, []);
  const page = (dir: number) => { const el = row.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8 }); };
  const arrow = (dir: number) => (
    <button type="button" className="icon-btn projects__arrow" aria-label={t(dir < 0 ? 'projects.earlier' : 'projects.more')}
      disabled={dir < 0 ? ends.start : ends.end} onClick={() => page(dir)}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={dir < 0 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} /></svg>
    </button>
  );
  return (
    <section className="projects" data-testid="projects" aria-label={t('projects.title')}>
      <div className="projects__head">
        <h2>{t('projects.title')}</h2>
        {onAll && <button type="button" className="projects__all" onClick={onAll}>{t('projects.all')}</button>}
        <p className="credit">{t('credits.boardLayout')}</p>
      </div>
      <div className="projects__strip">
      {arrow(-1)}
      <div className="projects__row" ref={row} onScroll={measure}>
        {PROJECTS.map((p, i) => {
          const here = HOME_VIEW[p.id];
          return (
            <button key={p.id} type="button"
              className={`project${here && view === here ? ' is-on' : ''}`}
              onClick={() => (here ? setView(here) : onOpen?.(p.id))}>
              {projectThumb(p.id)
                ? <img className="project__thumb" src={projectThumb(p.id)} alt="" width={88} height={62} draggable={false} />
                : <span className="project__icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={PROJECT_ICON[p.id]} /></svg>
                  </span>}
              <span className="project__text"><b>{i + 1}. {p.title}</b></span>
            </button>
          );
        })}
      </div>
      {arrow(1)}
      </div>
    </section>
  );
}
