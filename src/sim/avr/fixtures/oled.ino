#include <OLED.h>
OLED screen;

void setup() {
  screen.begin();
  screen.setTextSize(1);
  screen.print("Hi");
  screen.fillRect(0, 40, 10, 10, WHITE);
  screen.display();
}

void loop() {
}
