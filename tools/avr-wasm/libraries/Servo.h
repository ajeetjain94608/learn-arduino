// RoboQuest Servo library — our own, header-only. Same API as the usual Arduino Servo library:
//   Servo s; s.attach(pin); s.write(angle 0–180 or microseconds); s.writeMicroseconds(us); s.read(); s.detach();
// Up to 8 servos. Timer1 makes the pulses (one after another, every 20 ms), so analogWrite() on pins 9 and 10
// stops working while a servo is attached — as on a real UNO.
#pragma once
#include <Arduino.h>

#define MAX_SERVOS 8
#define MIN_PULSE_WIDTH 544      // µs at 0°
#define MAX_PULSE_WIDTH 2400     // µs at 180°
#define DEFAULT_PULSE_WIDTH 1500
#define SERVO_FRAME_TICKS 40000  // 20 ms in Timer1 ticks (prescaler 8 at 16 MHz: 0.5 µs a tick)

struct ServoSlot_ { uint8_t pin; volatile uint16_t ticks; volatile bool on; };
static ServoSlot_ servoSlots_[MAX_SERVOS];
static uint8_t servoCount_ = 0;
static volatile int8_t servoNow_ = -1; // the servo whose pulse is high now; -1 = the gap until the next frame

ISR(TIMER1_COMPA_vect) {
  if (servoNow_ >= 0) { if (servoSlots_[servoNow_].on) digitalWrite(servoSlots_[servoNow_].pin, LOW); }
  else TCNT1 = 0;                                      // a new 20 ms frame
  servoNow_++;
  if (servoNow_ < servoCount_) {
    if (servoSlots_[servoNow_].on) digitalWrite(servoSlots_[servoNow_].pin, HIGH);
    OCR1A = TCNT1 + servoSlots_[servoNow_].ticks;
  } else {
    OCR1A = (TCNT1 + 8 < SERVO_FRAME_TICKS) ? SERVO_FRAME_TICKS : TCNT1 + 8;
    servoNow_ = -1;
  }
}

class Servo {
 public:
  Servo() : index_(MAX_SERVOS), min_(MIN_PULSE_WIDTH), max_(MAX_PULSE_WIDTH) {}
  uint8_t attach(int pin) { return attach(pin, MIN_PULSE_WIDTH, MAX_PULSE_WIDTH); }
  uint8_t attach(int pin, int min, int max) {
    if (index_ >= MAX_SERVOS) {
      if (servoCount_ >= MAX_SERVOS) return 0;
      index_ = servoCount_++;
      servoSlots_[index_].ticks = DEFAULT_PULSE_WIDTH * 2;
    }
    min_ = min; max_ = max;
    servoSlots_[index_].pin = pin;
    pinMode(pin, OUTPUT);
    servoSlots_[index_].on = true;
    if (!(TIMSK1 & _BV(OCIE1A))) { // the first servo starts Timer1
      TCCR1A = 0; TCCR1B = _BV(CS11); TCNT1 = 0; OCR1A = 100;
      TIFR1 = _BV(OCF1A); TIMSK1 |= _BV(OCIE1A);
    }
    return index_;
  }
  void detach() { if (index_ < MAX_SERVOS) { servoSlots_[index_].on = false; digitalWrite(servoSlots_[index_].pin, LOW); } }
  // below 200: an angle in degrees; otherwise a pulse width in microseconds
  void write(int value) {
    if (value < 200) value = map(constrain(value, 0, 180), 0, 180, min_, max_);
    writeMicroseconds(value);
  }
  void writeMicroseconds(int us) {
    if (index_ >= MAX_SERVOS) return;
    us = constrain(us, min_, max_);
    uint8_t s = SREG; cli(); servoSlots_[index_].ticks = us * 2; SREG = s;
  }
  int readMicroseconds() { return index_ < MAX_SERVOS ? servoSlots_[index_].ticks / 2 : 0; }
  int read() { return map(readMicroseconds() + 1, min_, max_, 0, 180); }
  bool attached() { return index_ < MAX_SERVOS && servoSlots_[index_].on; }
 private:
  uint8_t index_;
  int min_, max_;
};
