import { t, type StringKey } from '../../i18n/en';
import { useInspectStore } from '../../state/inspectStore';
import { kindOf } from './partCatalog';

// Small name card next to the pointer (hover) or the tap point (selection).
export function PartTooltip() {
  const { hovered, pointer, selected, selectedAt } = useInspectStore();
  const id = hovered ?? selected;
  const at = hovered ? pointer : selectedAt;
  const kind = id ? kindOf(id) : null;
  if (!id || !at || !kind) return null;
  return (
    <div className="part-tooltip" data-testid="part-tooltip" style={{ transform: `translate(${at.x + 14}px, ${at.y + 14}px)` }} role="tooltip">
      <b>{t(`part.${kind}.name` as StringKey)}</b>
      <span>{t(`part.${kind}.line` as StringKey)}</span>
    </div>
  );
}
