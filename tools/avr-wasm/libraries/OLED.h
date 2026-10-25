// RoboQuest OLED library — our own, header-only. For a 0.96" 128×64 SSD1306 screen on I²C (SDA A4, SCL A5):
//   OLED screen;            screen.begin();  (address 0x3C)
//   screen.clearDisplay();  screen.setCursor(x, y);  screen.setTextSize(n);  screen.print(…) / println(…)
//   screen.drawPixel(x, y, WHITE);  screen.drawRect / fillRect(x, y, w, h, WHITE);  drawLine(x0, y0, x1, y1, WHITE)
//   screen.display();       (sends the picture to the screen)
// Characters are 6×8 pixels at size 1. The picture lives in a 1 KB buffer in the UNO's RAM.
#pragma once
#include <Arduino.h>
#include <Wire.h>
#include "OLEDFont.h"

#define OLED_WIDTH 128
#define OLED_HEIGHT 64
#define BLACK 0
#define WHITE 1
#define INVERSE 2

class OLED : public Print {
 public:
  bool begin(uint8_t address = 0x3C) {
    address_ = address;
    Wire.begin();
    static const uint8_t INIT[] PROGMEM = {
      0xAE,             // display off
      0xD5, 0x80,       // clock
      0xA8, 0x3F,       // 64 rows
      0xD3, 0x00,       // no offset
      0x40,             // start line 0
      0x8D, 0x14,       // charge pump on
      0x20, 0x00,       // horizontal addressing
      0xA1, 0xC8,       // flip to the usual orientation
      0xDA, 0x12,       // pin layout
      0x81, 0xCF,       // contrast
      0xD9, 0xF1,       // pre-charge
      0xDB, 0x40,       // VCOM
      0xA4, 0xA6,       // show the RAM, not inverted
      0xAF              // display on
    };
    for (uint8_t i = 0; i < sizeof(INIT); i++) if (!command(pgm_read_byte(&INIT[i]))) return false;
    clearDisplay();
    return true;
  }
  void clearDisplay() { memset(buffer_, 0, sizeof(buffer_)); cursorX_ = cursorY_ = 0; }
  void display() {
    command(0x21); command(0); command(OLED_WIDTH - 1);      // columns 0–127
    command(0x22); command(0); command(OLED_HEIGHT / 8 - 1); // pages 0–7
    for (uint16_t i = 0; i < sizeof(buffer_); i += 16) {
      Wire.beginTransmission(address_);
      Wire.write((uint8_t)0x40);                             // data follows
      Wire.write(buffer_ + i, 16);
      Wire.endTransmission();
    }
  }
  void drawPixel(int16_t x, int16_t y, uint8_t color) {
    if (x < 0 || y < 0 || x >= OLED_WIDTH || y >= OLED_HEIGHT) return;
    uint8_t &b = buffer_[x + (y / 8) * OLED_WIDTH];
    uint8_t bit = 1 << (y & 7);
    if (color == WHITE) b |= bit; else if (color == BLACK) b &= ~bit; else b ^= bit;
  }
  void drawFastHLine(int16_t x, int16_t y, int16_t w, uint8_t c) { for (int16_t i = 0; i < w; i++) drawPixel(x + i, y, c); }
  void drawFastVLine(int16_t x, int16_t y, int16_t h, uint8_t c) { for (int16_t i = 0; i < h; i++) drawPixel(x, y + i, c); }
  void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint8_t c) {
    drawFastHLine(x, y, w, c); drawFastHLine(x, y + h - 1, w, c); drawFastVLine(x, y, h, c); drawFastVLine(x + w - 1, y, h, c);
  }
  void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint8_t c) { for (int16_t i = 0; i < h; i++) drawFastHLine(x, y + i, w, c); }
  void fillScreen(uint8_t c) { memset(buffer_, c == WHITE ? 0xFF : 0, sizeof(buffer_)); }
  void drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint8_t c) {
    int16_t dx = abs(x1 - x0), dy = -abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) {
      drawPixel(x0, y0, c);
      if (x0 == x1 && y0 == y1) return;
      int16_t e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  void drawCircle(int16_t cx, int16_t cy, int16_t r, uint8_t c) {
    int16_t x = r, y = 0, err = 1 - r;
    while (x >= y) {
      drawPixel(cx + x, cy + y, c); drawPixel(cx + y, cy + x, c); drawPixel(cx - y, cy + x, c); drawPixel(cx - x, cy + y, c);
      drawPixel(cx - x, cy - y, c); drawPixel(cx - y, cy - x, c); drawPixel(cx + y, cy - x, c); drawPixel(cx + x, cy - y, c);
      y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  }
  void setCursor(int16_t x, int16_t y) { cursorX_ = x; cursorY_ = y; }
  void setTextSize(uint8_t s) { size_ = s ? s : 1; }
  void setTextColor(uint8_t c) { color_ = c; }
  using Print::write;
  size_t write(uint8_t ch) override {
    if (ch == '\n') { cursorX_ = 0; cursorY_ += 8 * size_; return 1; }
    if (ch == '\r') return 1;
    if (cursorX_ + 6 * size_ > OLED_WIDTH) { cursorX_ = 0; cursorY_ += 8 * size_; } // wrap onto the next line
    if (ch >= 32 && ch <= 126) {
      for (uint8_t col = 0; col < 5; col++) {
        uint8_t bits = pgm_read_byte(&OLED_FONT[(ch - 32) * 5 + col]);
        for (uint8_t row = 0; row < 7; row++) if (bits & (1 << row)) fillRect(cursorX_ + col * size_, cursorY_ + row * size_, size_, size_, color_);
      }
    }
    cursorX_ += 6 * size_;
    return 1;
  }
 private:
  bool command(uint8_t c) {
    Wire.beginTransmission(address_);
    Wire.write((uint8_t)0x00); // a command follows
    Wire.write(c);
    return Wire.endTransmission() == 0;
  }
  uint8_t address_ = 0x3C;
  uint8_t buffer_[OLED_WIDTH * OLED_HEIGHT / 8];
  int16_t cursorX_ = 0, cursorY_ = 0;
  uint8_t size_ = 1, color_ = WHITE;
};
