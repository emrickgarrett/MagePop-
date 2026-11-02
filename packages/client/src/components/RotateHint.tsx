import { useEffect, useState } from 'react';
import { isShortLandscape } from '../game/platform';

/**
 * Phones on their side are too short for the landscape layout (everything shrinks to half size),
 * so suggest turning the phone upright, where the stacked portrait layout kicks in.
 * "Play anyway" hides it until the page reloads.
 */
export function RotateHint() {
  const [short, setShort] = useState(isShortLandscape);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const on = () => setShort(isShortLandscape());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  if (!short || dismissed) return null;
  return (
    <div className="rotate-hint" role="dialog" aria-label="Turn your phone upright">
      <div>
        <div className="rotate-icon">📱</div>
        <h3>Turn your phone upright</h3>
        <p>MagePop! plays best in portrait on phones.</p>
        <button className="btn small ghost" onClick={() => setDismissed(true)}>
          Play anyway
        </button>
      </div>
    </div>
  );
}
