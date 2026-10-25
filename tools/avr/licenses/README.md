# Licences of the precompiled Uno core

- `core.a` is built from the **Arduino AVR core 1.8.7** (`cores/arduino`, `variants/standard`), licensed under the
  **GNU Lesser General Public License 2.1** (`LGPL-2.1.txt`). Source: https://github.com/arduino/ArduinoCore-avr/tree/1.8.7 —
  rebuild with `npm run avr:core` (see `tools/avr/build-core.mjs` for the exact flags).
- It links against **AVR-LibC** (Modified BSD License, `avr-libc-LICENSE.txt`) and **libgcc** (GPL-3.0 with the
  GCC Runtime Library Exception, so programs compiled with it are not covered by the GPL).
