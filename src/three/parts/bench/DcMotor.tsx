import { BenchBlock } from '../../build/partModels';
import type { PartView } from '../partView';

// TODO(model): placeholder until the real model is drawn.
export function DcMotor(_p: PartView) {
  return <BenchBlock type={'motor'} />;
}
