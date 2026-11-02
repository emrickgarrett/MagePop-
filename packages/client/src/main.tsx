import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { preloadThemes } from './game/themes';
import { audio } from './game/audio';
import { fitToWindow } from './game/platform';
import './styles.css';

fitToWindow();
preloadThemes();
audio.init();
// UI click sound for every button.
document.addEventListener(
  'click',
  (e) => {
    const b = (e.target as Element | null)?.closest?.('button');
    if (b && !(b as HTMLButtonElement).disabled) audio.play('click');
  },
  { capture: true },
);
createRoot(document.getElementById('root')!).render(<App />);
