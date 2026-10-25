import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/nunito';
import './styles/themes.css';
import './styles/global.css';
import App from './App';
import { setCompiler } from './build/compiler/compiler';
import { wasmCompiler } from './build/compiler/wasmCompiler';

// Real Arduino compiling, offline: GCC as WebAssembly in a worker (Android app and website; iOS later brings its own).
setCompiler(wasmCompiler);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
