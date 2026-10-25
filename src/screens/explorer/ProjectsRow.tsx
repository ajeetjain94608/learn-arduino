import { useEffect, useRef, useState } from 'react';
import { t, type StringKey } from '../../i18n/en';
import { useWorkbenchStore } from '../../state/workbenchStore';
import type { View } from '../../three/workbench/cameraViews';
import ledThumb from '../../assets/thumbs/led-red.png';
import unoThumb from '../../assets/thumbs/uno.png';

// Pre-built projects. Two are playable in Stage 1; the rest are the launch sensors, coming with the component library.
// thumb: picture rendered from our own 3D model (npm run bake:thumbs); icon: placeholder until the part's model exists.
const PROJECTS: { id: string; view?: View; icon: string; thumb?: string }[] = [
  { id: 'board', view: 'board', thumb: unoThumb, icon: 'M6 6h12v12H6zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4' },
  { id: 'blink', view: 'circuit', thumb: ledThumb, icon: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z' },
  { id: 'button', icon: 'M4 14h16v4H4zM8 14v-3a4 4 0 0 1 8 0v3' },
  { id: 'ldr', icon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z' },
  { id: 'ultrasonic', icon: 'M3 12h3M8 8a6 6 0 0 1 0 8M12 5a10 10 0 0 1 0 14M16 3a13 13 0 0 1 0 18' },
  { id: 'dht', icon: 'M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z' },
  { id: 'pir', icon: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
];

export function ProjectsRow() {
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
      <div className="projects__head"><h2>{t('projects.title')}</h2><p className="credit">{t('credits.boardLayout')}</p></div>
      <div className="projects__strip">
      {arrow(-1)}
      <div className="projects__row" ref={row} onScroll={measure}>
        {PROJECTS.map((p, i) => {
          const playable = Boolean(p.view);
          const name = t(`project.${p.id}.name` as StringKey);
          return (
            <button key={p.id} type="button" disabled={!playable}
              className={`project${playable && view === p.view ? ' is-on' : ''}`}
              onClick={() => p.view && setView(p.view)}>
              {p.thumb
                ? <img className="project__thumb" src={p.thumb} alt="" width={88} height={62} draggable={false} />
                : <span className="project__icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={p.icon} /></svg>
                  </span>}
              <span className="project__text"><b>{i + 1}. {name}</b>{!playable && <small>{t('projects.soon')}</small>}</span>
            </button>
          );
        })}
      </div>
      {arrow(1)}
      </div>
    </section>
  );
}
