import { useCallback, useEffect, useMemo, useState } from 'react';
import { PROJECT_INFO } from '../../content/en/projects';
import { projectById } from '../../content/projects';
import { buildProjectInfo } from '../../content/projectInfo';
import { t, type StringKey } from '../../i18n/en';
import { BuzzerSound } from '../../sim/buzzerSound';
import { SimClock } from '../../sim/SimClock';
import { BuildStoreContext } from '../../state/buildContext';
import { projectStore, useBuildStore } from '../../state/buildStore';
import { useInspectStore } from '../../state/inspectStore';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { isTestMode } from '../../three/shared/motion';
import { Inspectable } from '../../three/inspect/Inspectable';
import { kindOf } from '../../three/inspect/partCatalog';
import { PartTooltip } from '../../three/inspect/PartTooltip';
import { cardOf } from '../../three/inspect/projectParts';
import { BlinkCircuit } from '../../three/scenes/BlinkCircuit';
import { ProjectCircuit } from '../../three/scenes/ProjectCircuit';
import { GlGuardCard, useContextGuard } from '../../three/workbench/ContextGuard';
import { GlErrorBoundary } from '../../three/workbench/GlErrorBoundary';
import { Workbench } from '../../three/workbench/Workbench';
import { CalloutLayer, CalloutProjector, createCalloutBridge } from '../../ui/callouts/CalloutLayer';
import { HOTSPOTS, hotName, hotText } from '../../ui/callouts/hotspots';
import { projectHotspots } from '../../ui/callouts/projectHotspots';
import { BurnCard } from '../build/BurnCard';
import { CodeCard } from './CodeCard';
import type { Panel } from './ExpandButton';
import { StatusPill, ViewerToolbar } from './Dock';
import { AboutSheet, InfoCard } from './InfoSheet';
import { NavBar, type Screen } from './NavBar';
import { ProjectsRow } from './ProjectsRow';
import { FpsProbe, Header, SettingsPanel, SHOW_FPS } from './TopBar';
import './explorer.css';
import './layout.css';

// The first two projects are Home's own views: the board by itself, and the Blink circuit.
const HOME_VIEW = { board: 'board', blink: 'circuit' } as const;

type Props = {
  onNavigate?(s: Screen): void;
  projectId?: string;               // the project the address asks for (#/projects/<id>)
  onOpenProject?(id: string): void;
  onAllProjects?(): void;
  onEditProject?(id: string): void; // the project's own Build page, to change its parts and wires
};

// Home screen. The 3D view sits in its own card with its toolbar; projects, the explanation tabs and the
// code sit beside it (landscape / desktop) or below it (phone held upright). Any project opens right here:
// its circuit builds itself in the 3D card, parts show their name when pointed at, and the cards beside it are its own.
export function ExplorerScreen({ onNavigate, projectId, onOpenProject, onAllProjects, onEditProject }: Props = {}) {
  const view = useWorkbenchStore((s) => s.view);
  const setView = useWorkbenchStore((s) => s.setView);
  const pinHigh = useWorkbenchStore((s) => s.pinHigh);
  const showCurrent = useWorkbenchStore((s) => s.showCurrent);
  const bootLed = useWorkbenchStore((s) => s.bootLed);
  const rxLed = useWorkbenchStore((s) => s.rxLed);
  const txLed = useWorkbenchStore((s) => s.txLed);
  const labels = useWorkbenchStore((s) => s.labels);
  const running = useWorkbenchStore((s) => s.running);
  const circuitState = useWorkbenchStore((s) => s.circuitState);
  const selectedPart = useInspectStore((s) => s.selected);
  const selectPart = useInspectStore((s) => s.select);
  const [callout, setCallout] = useState<string | null>(null);
  const [about, setAbout] = useState(false);
  const [settings, setSettings] = useState(false);
  const [panel, setPanel] = useState<Panel>(null); // the side panel given extra room, if any
  const closeSettings = useCallback(() => setSettings(false), []);
  const bridge = useMemo(createCalloutBridge, []);
  const guard = useContextGuard();

  // which project is open, and whether it is one of Home's own views or a circuit of its own
  const project = projectId ? projectById(projectId) : undefined;
  const homeView = project ? HOME_VIEW[project.id as keyof typeof HOME_VIEW] : undefined;
  const generic = project && !homeView ? project : undefined;
  const store = generic ? projectStore(generic.id, generic.build) : useBuildStore; // (the free build when none: never shown)
  const parts = store((s) => s.parts);
  const wires = store((s) => s.wires);
  const inputs = store((s) => s.inputs);
  const burns = store((s) => s.burns);
  const breadboard = store((s) => s.breadboard);
  const setBurns = store((s) => s.setBurns);
  const setInput = store((s) => s.setInput);
  const circuit = useMemo(() => ({ parts, wires }), [parts, wires]);
  const projectView = generic?.build.parts.some((p) => 'x' in p.at) ? 'bench' : 'circuit';

  // opening a project: its view and its camera (a circuit of its own, or the board / Blink views)
  useEffect(() => {
    if (homeView) setView(homeView);
    else if (generic) setView(projectView);
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // while a project's own circuit is open, the editor holds its sketch (and the Run button runs it on this circuit)
  useEffect(() => {
    if (!generic) return;
    const wb = useWorkbenchStore.getState();
    const home = { code: wb.code, program: wb.program, diagnostics: wb.diagnostics, showCurrent: wb.showCurrent };
    wb.setRunning(false);
    useWorkbenchStore.setState({ diagnostics: [], showCurrent: false });
    wb.setCode(store.getState().code);
    const unsub = useWorkbenchStore.subscribe((s) => { if (s.code !== store.getState().code) store.getState().setCode(s.code); });
    return () => {
      unsub();
      const w = useWorkbenchStore.getState();
      w.setRunning(false);
      useWorkbenchStore.setState({ code: home.code, program: home.program, diagnostics: home.diagnostics, showCurrent: home.showCurrent, circuitState: null });
      if (w.view === 'bench') w.setView('circuit');
    };
  }, [generic?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setCallout(null); }, [project?.id]);
  useEffect(() => { // tests read and change the open project's build like a learner would
    if (generic && isTestMode()) (window.__rq ??= { debug: {} }).debug.build = () => store.getState();
  }, [generic?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const hotspots = useMemo(() => (generic ? projectHotspots(generic, projectView) : HOTSPOTS), [generic, projectView]);
  const info = useMemo(() => (generic ? buildProjectInfo(generic) : PROJECT_INFO[view === 'board' ? 'board' : 'circuit']), [generic, view]);

  const focus = useMemo(() => {
    const kind = selectedPart ? kindOf(selectedPart) : null;
    if (kind) return { title: t(`part.${kind}.name` as StringKey), text: t(`part.${kind}.text` as StringKey) };
    const card = selectedPart ? cardOf(selectedPart) : null;
    if (card) return { title: card.name, text: card.text };
    const h = hotspots.find((x) => x.id === callout);
    return h ? { title: hotName(h), text: hotText(h) } : null;
  }, [selectedPart, callout, hotspots]);

  const clearAll = () => { setCallout(null); setAbout(false); selectPart(null); };
  const [confirmReset, setConfirmReset] = useState(false);
  const resetProject = () => {
    if (!generic) return;
    const wb = useWorkbenchStore.getState();
    wb.setRunning(false);
    for (const id of new Set(store.getState().burns.map((b) => (b.id.startsWith('uno') ? 'uno' : b.id)))) wb.replacePart(id);
    store.getState().restart(generic.build);
    wb.setCode(generic.build.code);
    setConfirmReset(false);
  };

  return (
    <main className="app layout" data-testid="explorer-screen">
      <NavBar current="home" onNavigate={onNavigate} onSettings={() => setSettings(true)} />
      <Header />
      <section className="viewer" data-testid="viewer" aria-label={t('viewer.toolbar')}>
        <GlErrorBoundary onReload={guard.reload}>
          <Workbench key={guard.canvasKey} onCanvas={guard.onCanvas} onBackgroundTap={clearAll}>
            {generic ? <SimClock circuit={circuit} inputs={inputs} burns={burns} onBurns={setBurns} /> : <SimClock />}
            <Inspectable onEmptyTap={clearAll}>
              {generic ? (
                <ProjectCircuit key={generic.id} breadboard={breadboard} parts={parts} wires={wires} inputs={inputs} partStates={circuitState?.parts ?? {}} burns={burns}
                  wireVolts={labels && running ? circuitState?.wireVolts : undefined} pin13={pinHigh} rx={rxLed} tx={txLed} onInput={setInput} />
              ) : (
                <BlinkCircuit pinHigh={pinHigh} bootLed={bootLed} rx={rxLed} tx={txLed} showCircuit={view === 'circuit'} showCurrent={showCurrent} />
              )}
            </Inspectable>
            <CalloutProjector hotspots={hotspots} bridge={bridge} />
            {SHOW_FPS && <FpsProbe />}
          </Workbench>
        </GlErrorBoundary>
        <div className="overlay">
          <CalloutLayer key={generic?.id ?? 'home'} hotspots={hotspots} bridge={bridge} selected={callout}
            onSelect={(id) => { setAbout(false); selectPart(null); setCallout(id === callout ? null : id); }} />
          <PartTooltip />
        </div>
        <StatusPill pin13={!generic} />
        <ViewerToolbar showCurrentButton={!generic} soundButton={!!generic} />
        {generic && <BuzzerSound />}
        <GlGuardCard state={guard.state} onReload={guard.reload} />
      </section>
      <div className="side" data-expand={panel ?? undefined}>
        {generic && <BuildStoreContext.Provider value={store}><BurnCard /></BuildStoreContext.Provider>}
        <InfoCard info={info} infoKey={generic?.id ?? view} focus={focus} expanded={panel === 'info'} onExpand={() => setPanel(panel === 'info' ? null : 'info')}
          footer={!generic ? (project && onEditProject ? <button type="button" onClick={() => onEditProject(project.id)}>{t('project.edit')}</button> : undefined) : (
            <>
              <button type="button" onClick={() => onEditProject?.(generic.id)}>{t('project.edit')}</button>
              {confirmReset
                ? <><button type="button" onClick={resetProject}>{t('project.resetYes')}</button><button type="button" onClick={() => setConfirmReset(false)}>{t('project.resetNo')}</button></>
                : <button type="button" onClick={() => setConfirmReset(true)}>{t('project.reset')}</button>}
            </>
          )} />
        <CodeCard panel={panel} onPanel={setPanel} />
      </div>
      <ProjectsRow current={projectId} onOpen={onOpenProject} onAll={onAllProjects} />
      <AboutSheet open={about} onClose={() => setAbout(false)} />
      <SettingsPanel open={settings} onClose={closeSettings} onAbout={() => { setCallout(null); selectPart(null); setAbout(true); }} />
    </main>
  );
}
