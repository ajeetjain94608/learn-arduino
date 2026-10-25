import { BoardBlock } from './BoardBlock';
import type { PartView } from '../partView';

// TODO(model): placeholder until the real model is drawn.
export function Fsr(p: PartView) {
  return <BoardBlock {...p} />;
}
