// One model per bench module.
import { DcMotor } from './DcMotor';
import { OledScreen } from './OledScreen';
import { ServoMotor } from './ServoMotor';
import { SoilSensor } from './SoilSensor';
import { Sonar } from './Sonar';
import { StepperMotor } from './StepperMotor';

export const BenchParts = { motor: DcMotor, servo: ServoMotor, hcsr04: Sonar, stepper: StepperMotor, oled: OledScreen, soil: SoilSensor };
