import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/nunito';
import './styles/themes.css';
import './styles/global.css';
import App from './App';
import { setCompiler } from './build/compiler/compiler';
import { devCompiler } from './build/compiler/devCompiler';

// DEVELOPMENT ONLY until the WebAssembly compiler is built (Build plan B1, Task 7): the dev server compiles with
// the native toolchain through the same pipeline. Production builds contain no compiler yet.
if (import.meta.env.DEV) setCompiler(devCompiler);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
