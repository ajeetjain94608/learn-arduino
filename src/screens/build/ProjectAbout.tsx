import { useState } from 'react';
import type { Project } from '../../content/projects';
import { t } from '../../i18n/en';
import { useBuild, useBuildApi } from '../../state/buildContext';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { partsInWords } from '../projects/ProjectsScreen';
import { pinLabel } from './WiringTable';

// A project's About tab: what it is, what you learn, what to try, how it is wired, and a way back to the original.
export function ProjectAbout({ project, onRun }: { project: Project; onRun(): void }) {
  const api = useBuildApi();
  const wires = useBuild((s) => s.wires);
  const [confirm, setConfirm] = useState(false);
  const reset = () => {
    useWorkbenchStore.getState().setRunning(false);
    api.getState().restart(project.build);
    useWorkbenchStore.getState().setCode(project.build.code);
    setConfirm(false);
  };
  return (
    <div className="project-about">
      <h2>{project.title}</h2>
      <p>{project.about}</p>
      <h3>{t('project.learn')}</h3>
      <ul>{project.learn.map((s) => <li key={s}>{s}</li>)}</ul>
      <h3>{t('project.try')}</h3>
      <ol>{project.tryIt.map((s) => <li key={s}>{s}</li>)}</ol>
      <h3>{t('project.parts')}</h3>
      <ul className="chips"><li>{t('build.uno')}</li>{partsInWords(project.build.parts.map((p) => p.type)).map((s) => <li key={s}>{s}</li>)}</ul>
      {wires.length > 0 && (
        <>
          <h3>{t('project.wiring')}</h3>
          <table className="project-about__wiring">
            <thead><tr><th>{t('build.wiring.from')}</th><th>{t('build.wiring.to')}</th></tr></thead>
            <tbody>
              {wires.map((w) => (
                <tr key={w.id}><td><span className="dot" style={{ background: w.color }} aria-hidden /> {pinLabel(w.from)}</td><td>{pinLabel(w.to)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <div className="project-about__actions">
        <button type="button" className="project-about__run" onClick={onRun}>{t('project.toCode')}</button>
        {confirm ? (
          <span className="project-about__confirm" role="group" aria-label={t('project.reset')}>
            <button type="button" onClick={reset}>{t('project.resetYes')}</button>
            <button type="button" onClick={() => setConfirm(false)}>{t('project.resetNo')}</button>
          </span>
        ) : <button type="button" onClick={() => setConfirm(true)}>{t('project.reset')}</button>}
      </div>
    </div>
  );
}
