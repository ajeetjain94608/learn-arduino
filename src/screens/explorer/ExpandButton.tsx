// Corner-arrows button that makes a panel take more room (or gives the room back).
export function ExpandButton({ expanded, expandLabel, shrinkLabel, onToggle }: { expanded: boolean; expandLabel: string; shrinkLabel: string; onToggle(): void }) {
  return (
    <button type="button" className="icon-btn" aria-label={expanded ? shrinkLabel : expandLabel} aria-pressed={expanded} onClick={onToggle}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={expanded ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} />
      </svg>
    </button>
  );
}

export type Panel = 'info' | 'code' | 'serial' | null;
