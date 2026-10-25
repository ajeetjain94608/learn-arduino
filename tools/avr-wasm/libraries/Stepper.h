// RoboQuest Stepper library — our own, header-only. Same API as the usual Arduino Stepper library (4 wires):
//   Stepper motor(stepsPerTurn, in1, in2, in3, in4); motor.setSpeed(rpm); motor.step(n);  (n < 0 turns back)
// For a 28BYJ-48 on a ULN2003 board: Stepper motor(2048, 8, 10, 9, 11) — pins IN1, IN3, IN2, IN4.
// step() waits until the motor has made every step.
#pragma once
#include <Arduino.h>

class Stepper {
 public:
  Stepper(int stepsPerTurn, int p1, int p2, int p3, int p4)
    : steps_(stepsPerTurn), at_(0), delayUs_(60000000UL / stepsPerTurn / 10), last_(0) {
    pins_[0] = p1; pins_[1] = p2; pins_[2] = p3; pins_[3] = p4;
    for (uint8_t i = 0; i < 4; i++) pinMode(pins_[i], OUTPUT);
  }
  void setSpeed(long rpm) { if (rpm > 0) delayUs_ = 60000000UL / steps_ / rpm; }
  void step(int n) {
    int dir = n > 0 ? 1 : -1;
    for (int left = abs(n); left > 0;) {
      unsigned long now = micros();
      if (now - last_ < delayUs_) continue;
      last_ = now;
      at_ = (at_ + dir + steps_) % steps_;
      coils(at_ % 4);
      left--;
    }
  }
 private:
  // the four-wire full-step pattern (two coils on at a time)
  void coils(uint8_t phase) {
    static const uint8_t PATTERN[4] = { 0b1010, 0b0110, 0b0101, 0b1001 };
    for (uint8_t i = 0; i < 4; i++) digitalWrite(pins_[i], (PATTERN[phase] >> (3 - i)) & 1);
  }
  int steps_;
  int at_;
  unsigned long delayUs_;
  unsigned long last_;
  uint8_t pins_[4];
};
