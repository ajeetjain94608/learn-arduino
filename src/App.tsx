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

// The pages, chosen by the address: #/ (Home) · #/projects (all projects) · #/projects/<id> (Home with that project open)
// · #/projects/<id>/build (its Build page) · #/components · #/components/<type> · #/build
export default function App() {
  const [route, go] = useRoute();
  const nav = (s: Screen) => go(PAGE_OF[s]);
  const projectId = route.page === 'project' || route.page === 'project-build' ? route.id : undefined;
  const project = projectId ? projectById(projectId) : undefined;
  const store = useMemo(() => (project ? projectStore(project.id, project.build) : undefined), [project]);
  const unknownProject = projectId !== undefined && !project;
  const unknownPart = route.page === 'component' && !(route.type in COMPONENTS);
  useEffect(() => {
    if (unknownProject) history.replaceState(null, '', routeHash({ page: 'projects' }));
    else if (unknownPart) history.replaceState(null, '', routeHash({ page: 'components' }));
  }, [unknownProject, unknownPart]);
  const openProject = (id: string) => go({ page: 'project', id });
  const list = <ProjectsScreen onNavigate={nav} onOpen={openProject} />;
  switch (route.page) {
    case 'projects': return list;
    case 'project':
      if (!project) return list;
      return <ExplorerScreen onNavigate={nav} projectId={project.id} onOpenProject={openProject} onAllProjects={() => go({ page: 'projects' })} onEditProject={(id) => go({ page: 'project-build', id })} />;
    case 'project-build':
      if (!project || !store) return list;
      return <BuildScreen key={project.id} onNavigate={nav} store={store} project={project} />;
    case 'components': return <ComponentsScreen onNavigate={nav} onOpen={(type) => go({ page: 'component', type })} />;
    case 'component':
      if (unknownPart) return <ComponentsScreen onNavigate={nav} onOpen={(type) => go({ page: 'component', type })} />;
      return <ComponentScreen key={route.type} type={route.type} onNavigate={nav} onOpen={openProject} onUse={() => go({ page: 'build' })} />;
    case 'build': return <BuildScreen key="free" onNavigate={nav} />;
    default: return <ExplorerScreen onNavigate={nav} onOpenProject={openProject} onAllProjects={() => go({ page: 'projects' })} />;
  }
}
