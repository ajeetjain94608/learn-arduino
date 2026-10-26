// Learn Arduino Wire library — our own, header-only. The I²C controller side of the usual Arduino Wire API:
//   Wire.begin(); Wire.beginTransmission(address); Wire.write(byte or buffer); Wire.endTransmission();
// SDA is A4, SCL is A5. Up to 32 bytes per transmission. endTransmission() returns 0 when the device answered,
// 2 when no device has that address, 3 when the device refused a byte, 4 on another bus error, 5 on a timeout.
#pragma once
#include <Arduino.h>

#define WIRE_BUFFER 32

class TwoWire {
 public:
  void begin() { TWSR = 0; TWBR = ((F_CPU / 100000UL) - 16) / 2; TWCR = _BV(TWEN); }
  void setClock(unsigned long hz) { TWBR = ((F_CPU / hz) - 16) / 2; }
  void beginTransmission(uint8_t address) { address_ = address; length_ = 0; }
  void beginTransmission(int address) { beginTransmission((uint8_t)address); }
  size_t write(uint8_t b) { if (length_ >= WIRE_BUFFER) return 0; buffer_[length_++] = b; return 1; }
  size_t write(const uint8_t *data, size_t n) { size_t k = 0; while (k < n && write(data[k])) k++; return k; }
  uint8_t endTransmission(bool sendStop = true) {
    uint8_t r = send(_BV(TWINT) | _BV(TWSTA) | _BV(TWEN));
    if (r) return r;
    if ((TWSR & 0xF8) != 0x08 && (TWSR & 0xF8) != 0x10) return stop(4);
    TWDR = address_ << 1;
    if ((r = send(_BV(TWINT) | _BV(TWEN)))) return r;
    if ((TWSR & 0xF8) != 0x18) return stop(2);       // nobody answered at that address
    for (uint8_t i = 0; i < length_; i++) {
      TWDR = buffer_[i];
      if ((r = send(_BV(TWINT) | _BV(TWEN)))) return r;
      if ((TWSR & 0xF8) != 0x28) return stop(3);
    }
    return sendStop ? stop(0) : 0;
  }
 private:
  uint8_t send(uint8_t twcr) {
    TWCR = twcr;
    for (uint16_t t = 0; !(TWCR & _BV(TWINT)); t++) if (t > 20000) return 5;
    return 0;
  }
  uint8_t stop(uint8_t result) {
    TWCR = _BV(TWINT) | _BV(TWSTO) | _BV(TWEN);
    for (uint16_t t = 0; (TWCR & _BV(TWSTO)) && t < 20000; t++) {}
    return result;
  }
  uint8_t address_ = 0;
  uint8_t buffer_[WIRE_BUFFER];
  uint8_t length_ = 0;
};

static TwoWire Wire;
