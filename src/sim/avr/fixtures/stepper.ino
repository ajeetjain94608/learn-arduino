#include <Stepper.h>
Stepper wheel(2048, 8, 10, 9, 11);

void setup() {
  wheel.setSpeed(15);
  wheel.step(512);
  wheel.step(-256);
}

void loop() {
}
