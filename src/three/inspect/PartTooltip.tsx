import { useLayoutEffect, useRef, useState } from 'react';
import { t, type StringKey } from '../../i18n/en';
import { useInspectStore } from '../../state/inspectStore';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { kindOf } from './partCatalog';
import { cardOf } from './projectParts';
import { placeTooltip } from './tooltipPlacement';

const TOOLBAR_SPACE = 66; // the 3D card's toolbar along its bottom edge

// Name card for the hovered (beside the pointer) or tapped part (centred at the bottom of the 3D view).
export function PartTooltip() {
  const { hovered, pointer, selected, selectedAt } = useInspectStore();
  const labels = useWorkbenchStore((s) => s.labels);
  const ref = useRef<HTMLDivElement>(null);
  const [, relayout] = useState(0);
  // A clicked/tapped part keeps its centred card even while the mouse still rests on it.
  const showHover = hovered !== null && hovered !== selected;
  const id = showHover ? hovered : selected;
  const mode = showHover ? 'hover' : 'selected';
  const at = showHover ? pointer : selectedAt;
  // the UNO's own parts and the Blink circuit have their strings; the parts of any other project come from the library
  const kind = id ? kindOf(id) : null;
  const card = kind ? { name: t(`part.${kind}.name` as StringKey), line: t(`part.${kind}.line` as StringKey) } : id ? cardOf(id) : null;

  useLayoutEffect(() => {
    const el = ref.current, view = el?.parentElement;
    if (!el || !view) return;
    const p = placeTooltip({ mode, at, card: { w: el.offsetWidth, h: el.offsetHeight }, viewport: { w: view.clientWidth, h: view.clientHeight }, reserveBottom: TOOLBAR_SPACE });
    el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  });

  useLayoutEffect(() => {
    const onResize = () => relayout((n) => n + 1);
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, []);

  if (!id || !card || (mode === 'hover' && !labels)) return null; // with Labels off, pointing at a part shows no name (a tap still does)
  return (
    <div ref={ref} className={`part-tooltip part-tooltip--${mode}`} data-testid="part-tooltip" role="tooltip">
      <b>{card.name}</b>
      <span>{card.line}</span>
    </div>
  );
}
