import { CHARACTERS, getCharacter, LIMITS, sanitizeName, ServerMessage } from '@magepop/core';
import { useEffect, useRef, useState } from 'react';
import { Portrait } from '../components/Hud';
import { pvp } from '../game/pvp';
import type { SaveData, Settings } from '../game/save';
import { ScreenFrame } from './Menus';

type MatchFound = Extract<ServerMessage, { t: 'matchFound' }>;

/**
 * Online lobby: pick a name and a mage, then Quick Match. The connection stays open between
 * matches so "Rematch" can queue straight away.
 */
export function MultiplayerLobby({
  save,
  autoQueue,
  onBack,
  onSettings,
  onMatch,
}: {
  save: SaveData;
  /** Queue immediately (coming back from "Rematch"). */
  autoQueue?: boolean;
  onBack: () => void;
  onSettings: (s: Settings) => void;
  onMatch: (found: MatchFound) => void;
}) {
  const [name, setName] = useState(save.settings.playerName);
  const [mage, setMage] = useState(
    save.settings.pvpMage && save.unlocked.includes(save.settings.pvpMage) ? save.settings.pvpMage : save.unlocked[0],
  );
  const [, bump] = useState(0);
  const [searchStart, setSearchStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const onMatchRef = useRef(onMatch);
  onMatchRef.current = onMatch;

  useEffect(() => {
    const offStatus = pvp.onStatus(() => bump((x) => x + 1));
    const offMsg = pvp.on((m) => {
      if (m.t === 'matchFound') onMatchRef.current(m);
    });
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      offStatus();
      offMsg();
      clearInterval(tick);
    };
  }, []);

  const cleanName = sanitizeName(name);
  const searching = pvp.status === 'queued' || pvp.status === 'connecting';

  const find = async () => {
    onSettings({ ...save.settings, playerName: cleanName, pvpMage: mage });
    setSearchStart(Date.now());
    try {
      await pvp.connect(cleanName);
      pvp.queue(mage);
    } catch {
      setSearchStart(null);
    }
  };

  const cancel = () => {
    pvp.cancelQueue();
    setSearchStart(null);
  };

  // "Rematch" from the result screen lands here and searches again right away.
  const auto = useRef(autoQueue);
  useEffect(() => {
    if (auto.current) {
      auto.current = false;
      void find();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => {
    if (searching) cancel();
    onBack();
  };

  const waited = searchStart ? Math.floor((now - searchStart) / 1000) : 0;
  const ch = getCharacter(mage);

  return (
    <ScreenFrame title="Multiplayer" onBack={leave}>
      <div className="mp-lobby">
        <div className="mp-panel">
          <h3>Quick Match</h3>
          <p className="muted">Get paired with another mage online. Your stats, history and achievements count online wins too.</p>

          <label className="mp-field">
            <span>Your name</span>
            <input
              value={name}
              maxLength={LIMITS.nameMax}
              placeholder="Mage"
              disabled={searching}
              onChange={(e) => setName(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </label>

          <div className="mp-field">
            <span>Your mage</span>
            <div className="mp-mages">
              {CHARACTERS.filter((c) => save.unlocked.includes(c.id)).map((c) => (
                <button key={c.id} className={`char-card small ${mage === c.id ? 'picked' : ''}`} disabled={searching} onClick={() => setMage(c.id)}>
                  <Portrait ch={c} size={56} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
            {save.unlocked.length < CHARACTERS.length && <small className="muted">Recruit more mages in Story mode.</small>}
          </div>

          {searching ? (
            <div className="mp-search" style={{ '--accent': ch.palette.primary } as React.CSSProperties}>
              <div className="mp-spinner" />
              <div>
                <b>{pvp.status === 'connecting' ? 'Connecting…' : 'Searching for an opponent…'}</b>
                <small className="muted">
                  {Math.floor(waited / 60)}:{String(waited % 60).padStart(2, '0')}
                </small>
              </div>
              <button className="btn small ghost" onClick={cancel}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="btn big" onClick={find}>
              Find Match
              <small>as {ch.name}</small>
            </button>
          )}
          {pvp.error && !searching && <div className="mp-error">{pvp.error}</div>}
        </div>

        <div className="mp-modes side">
          {[
            { name: 'Ranked', desc: 'Climb the ladder. Wins and losses move your rating.' },
            { name: 'Friend Battle', desc: 'Share a room code and duel a friend.' },
          ].map((m) => (
            <div key={m.name} className="mp-card">
              <span className="mp-soon">Coming soon</span>
              <h3>{m.name}</h3>
              <p className="muted">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </ScreenFrame>
  );
}
