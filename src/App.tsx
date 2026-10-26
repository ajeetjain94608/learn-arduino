import { useEffect, useMemo } from 'react';
import { routeHash, useRoute, type Route } from './app/route';
import { COMPONENTS } from './content/components';
import { projectById } from './content/projects';
import { BuildScreen } from './screens/build/BuildScreen';
import { ComponentScreen, ComponentsScreen } from './screens/components/ComponentsScreen';
import { ExplorerScreen } from './screens/explorer/ExplorerScreen';
import type { Screen } from './screens/explorer/NavBar';
import { ProjectsScreen } from './screens/projects/ProjectsScreen';
import { projectStore } from './state/buildStore';
import { applyTestParams } from './testMode';
import './theme/themeStore';

applyTestParams();

const PAGE_OF: Record<Screen, Route> = { home: { page: 'home' }, projects: { page: 'projects' }, components: { page: 'components' }, build: { page: 'build' } };

// The pages, chosen by the address (#/projects/blink …).
export default function App() {
  const [route, go] = useRoute();
  const nav = (s: Screen) => go(PAGE_OF[s]);
  const project = route.page === 'project' ? projectById(route.id) : undefined;
  const store = useMemo(() => (project ? projectStore(project.id, project.build) : undefined), [project]);
  const unknownProject = route.page === 'project' && !project;
  const unknownPart = route.page === 'component' && !(route.type in COMPONENTS);
  useEffect(() => {
    if (unknownProject) history.replaceState(null, '', routeHash({ page: 'projects' }));
    else if (unknownPart) history.replaceState(null, '', routeHash({ page: 'components' }));
  }, [unknownProject, unknownPart]);
  switch (route.page) {
    case 'projects': return <ProjectsScreen onNavigate={nav} onOpen={(id) => go({ page: 'project', id })} />;
    case 'project':
      if (!project || !store) return <ProjectsScreen onNavigate={nav} onOpen={(id) => go({ page: 'project', id })} />;
      return <BuildScreen key={project.id} onNavigate={nav} store={store} project={project} />;
    case 'components': return <ComponentsScreen onNavigate={nav} onOpen={(type) => go({ page: 'component', type })} />;
    case 'component':
      if (unknownPart) return <ComponentsScreen onNavigate={nav} onOpen={(type) => go({ page: 'component', type })} />;
      return <ComponentScreen key={route.type} type={route.type} onNavigate={nav} onOpen={(type) => go({ page: 'component', type })} onUse={() => go({ page: 'build' })} />;
    case 'build': return <BuildScreen key="free" onNavigate={nav} />;
    default: return <ExplorerScreen onNavigate={nav} onOpenProject={(id) => go({ page: 'project', id })} onAllProjects={() => go({ page: 'projects' })} />;
  }
}
