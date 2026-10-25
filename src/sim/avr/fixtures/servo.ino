#include <Servo.h>
Servo arm;

void setup() {
  arm.attach(9);
  arm.write(90);
  delay(500);
  arm.write(0);
}

void loop() {
}
