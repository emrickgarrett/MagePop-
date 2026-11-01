import { useEffect, useState } from 'react';
import { appVersion, updater, UpdateState } from '../game/platform';

/** Small corner notice on the main menu when a new version is out. Never shown mid-battle. */
export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    updater.get().then(setState);
    appVersion().then(setVersion);
    return updater.onChange(setState);
  }, []);

  return (
    <div className="update-corner">
      {state.status === 'downloading' && (
        <div className="update-banner">Downloading v{state.version}… {state.percent}%</div>
      )}
      {state.status === 'ready' && (
        <div className="update-banner ready">
          <span>v{state.version} is ready!</span>
          <button className="btn small" onClick={updater.install}>
            Restart &amp; update
          </button>
        </div>
      )}
      {state.status === 'available' && (
        <div className="update-banner ready">
          <span>v{state.version} is out!</span>
          <button className="btn small" onClick={updater.openPage}>
            Download
          </button>
        </div>
      )}
      {version && <div className="version-tag">v{version}</div>}
    </div>
  );
}
