import { Component, type ReactNode } from 'react';
import { GlGuardCard } from './ContextGuard';

// If creating or running the 3D view throws (e.g. a WebGL context can't be created on a blocklisted GPU,
// or the GPU process is still gone after "Tap to reload"), show the reload card instead of unmounting the app.
export class GlErrorBoundary extends Component<{ onReload(): void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.error('3D view failed', err); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <GlGuardCard state="failed" onReload={() => { this.setState({ failed: false }); this.props.onReload(); }} />;
  }
}
