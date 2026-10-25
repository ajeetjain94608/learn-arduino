void setup() {
  Serial.begin(9600);
  pinMode(9, OUTPUT);
  pinMode(10, INPUT);
}

void loop() {
  digitalWrite(9, HIGH);
  delayMicroseconds(10);
  digitalWrite(9, LOW);
  long us = pulseIn(10, HIGH);
  Serial.println(us / 58);
  delay(60);
}
