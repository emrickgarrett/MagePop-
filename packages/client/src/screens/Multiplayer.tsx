import { CHARACTERS, getCharacter, LIMITS, normalizeRoomCode, ROOM_CODE_LENGTH, sanitizeName, ServerMessage } from '@magepop/core';
import { useEffect, useRef, useState } from 'react';
import { Portrait } from '../components/Hud';
import { pvp } from '../game/pvp';
import type { SaveData, Settings } from '../game/save';
import { ScreenFrame } from './Menus';

type MatchFound = Extract<ServerMessage, { t: 'matchFound' }>;

/**
 * Copy text, falling back to the old select-and-copy trick where the Clipboard API is blocked
 * (some browsers inside embedded pages like itch.io's game frame).
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** How long Quick Match waits before offering a bot game in the meantime. */
const WAIT_BOT_AFTER_S = 25;

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`;

/**
 * Online lobby: pick a name and a mage, then either Quick Match (random opponent) or a Friend
 * Battle (host a room code, or join a friend's). The connection stays open between matches.
 */
export function MultiplayerLobby({
  save,
  autoQueue,
  onBack,
  onSettings,
  onMatch,
  onWaitBot,
}: {
  save: SaveData;
  /** Queue immediately (coming back from "Rematch" after a Quick Match). */
  autoQueue?: boolean;
  onBack: () => void;
  onSettings: (s: Settings) => void;
  onMatch: (found: MatchFound) => void;
  /** Play a bot while staying in the Quick Match queue. */
  onWaitBot: (mage: string) => void;
}) {
  const [name, setName] = useState(save.settings.playerName);
  const [mage, setMage] = useState(
    save.settings.pvpMage && save.unlocked.includes(save.settings.pvpMage) ? save.settings.pvpMage : save.unlocked[0],
  );
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  /** Which Friend Battle button is waiting on the server (connecting, then creating/joining). */
  const [friendPending, setFriendPending] = useState<'create' | 'join' | null>(null);
  const [pendingSince, setPendingSince] = useState(0);
  const pendingRef = useRef(friendPending);
  pendingRef.current = friendPending;
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
    pvp.wake();
    return () => {
      offStatus();
      offMsg();
      clearInterval(tick);
    };
  }, []);

  const cleanName = sanitizeName(name);
  const status = pvp.status;
  // The server answered (room made, match found, or an error): stop showing "connecting".
  useEffect(() => {
    if (friendPending && (status === 'hosting' || status === 'inMatch' || status === 'closed' || (status === 'ready' && pvp.error))) setFriendPending(null);
  }, [status, friendPending, pvp.error]); // eslint-disable-line react-hooks/exhaustive-deps
  const searching = status === 'queued' || (status === 'connecting' && searchStart !== null);
  const hosting = status === 'hosting';
  const busy = searching || hosting || status === 'connecting';

  /** Save the name and mage, connect if needed. False if the server can't be reached. */
  const ready = async () => {
    onSettings({ ...save.settings, playerName: cleanName, pvpMage: mage });
    try {
      await pvp.connect(cleanName);
      return true;
    } catch {
      return false;
    }
  };

  const findMatch = async () => {
    setSearchStart(Date.now());
    if (await ready()) pvp.queue(mage);
    else setSearchStart(null);
  };
  const cancelSearch = () => {
    pvp.cancelQueue();
    setSearchStart(null);
  };
  const createRoom = async () => {
    setCopied(null);
    setFriendPending('create');
    pendingRef.current = 'create';
    setPendingSince(Date.now());
    const ok = await ready();
    if (pendingRef.current !== 'create') return; // cancelled while connecting
    if (ok) pvp.createRoom(mage);
    else setFriendPending(null);
  };
  const joinRoom = async () => {
    const c = normalizeRoomCode(code);
    if (!c) return;
    setFriendPending('join');
    pendingRef.current = 'join';
    setPendingSince(Date.now());
    const ok = await ready();
    if (pendingRef.current !== 'join') return; // cancelled while connecting
    if (ok) pvp.joinRoom(c, mage);
    else setFriendPending(null);
  };
  const copyCode = async () => {
    if (!pvp.roomCode) return;
    setCopied((await copyText(pvp.roomCode)) ? 'yes' : 'no');
  };

  // "Rematch" after a Quick Match lands here and searches again right away.
  const auto = useRef(autoQueue);
  useEffect(() => {
    if (auto.current) {
      auto.current = false;
      void findMatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => {
    if (searching) cancelSearch();
    if (hosting) pvp.closeRoom();
    onBack();
  };

  const ch = getCharacter(mage);
  const queuedSince = searchStart ?? pvp.queuedAt;
  const waited = queuedSince ? Math.max(0, Math.floor((now - queuedSince) / 1000)) : 0;
  const roomLeft = Math.ceil((pvp.roomExpiresAt - now) / 1000);
  const codeOk = normalizeRoomCode(code) !== null;

  return (
    <ScreenFrame title="Multiplayer" onBack={leave}>
      <div className="mp-lobby" style={{ '--accent': ch.palette.primary } as React.CSSProperties}>
        <div className="mp-panel">
          <h3>You</h3>
          <label className="mp-field">
            <span>Your name</span>
            <input
              value={name}
              maxLength={LIMITS.nameMax}
              placeholder="Mage"
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <div className="mp-field">
            <span>Your mage</span>
            <div className="mp-mages">
              {CHARACTERS.filter((c) => save.unlocked.includes(c.id)).map((c) => (
                <button key={c.id} className={`char-card small ${mage === c.id ? 'picked' : ''}`} disabled={busy} onClick={() => setMage(c.id)}>
                  <Portrait ch={c} size={56} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
            {save.unlocked.length < CHARACTERS.length && <small className="muted">Recruit more mages in Story mode.</small>}
          </div>
          <p className="muted small-print">Online wins count toward your stats, history and achievements.</p>
        </div>

        <div className="mp-col">
          <div className="mp-panel">
            <h3>Quick Match</h3>
            <p className="muted">Get paired with a random mage online.</p>
            {searching ? (
              <div className="mp-search">
                <div className="mp-spinner" />
                <div>
                  <b>{status === 'connecting' ? 'Connecting…' : 'Searching for an opponent…'}</b>
                  <small className="muted">{mmss(waited)}</small>
                </div>
                <button className="btn small ghost" onClick={cancelSearch}>
                  Cancel
                </button>
              </div>
            ) : null}
            {searching && status === 'queued' && waited >= WAIT_BOT_AFTER_S && (
              <div className="mp-wait-bot">
                <p>
                  <b>No one&apos;s around right now.</b> Play a bot while you wait? You stay in the queue, and if someone joins you&apos;ll
                  jump straight into the real match.
                </p>
                <button className="btn" onClick={() => onWaitBot(mage)}>
                  Play a bot while I wait
                </button>
              </div>
            )}
            {!searching && (
              <button className="btn big" disabled={busy} onClick={findMatch}>
                Find Match
                <small>as {ch.name}</small>
              </button>
            )}
          </div>

          <div className="mp-panel">
            <h3>Friend Battle</h3>
            {hosting && pvp.roomCode ? (
              <>
                <p className="muted">Send this code to your friend. The match starts as soon as they join.</p>
                <button className="room-code" onClick={copyCode} title="Click to copy" aria-label={`Room code ${pvp.roomCode}. Click to copy.`}>
                  {pvp.roomCode.split('').map((ch, i) => (
                    <span key={i}>{ch}</span>
                  ))}
                </button>
                {copied === 'yes' && <p className="room-copied">Copied! Paste it to your friend.</p>}
                {copied === 'no' && (
                  <p className="room-copied">
                    Couldn't copy automatically. Your code is <b className="selectable">{pvp.roomCode}</b>
                  </p>
                )}
                <div className="mp-search">
                  <div className="mp-spinner" />
                  <div>
                    <b>Waiting for your friend…</b>
                    <small className="muted">Code expires in {mmss(roomLeft)}</small>
                  </div>
                  <button className="btn small" onClick={copyCode}>
                    {copied === 'yes' ? 'Copied!' : 'Copy code'}
                  </button>
                  <button className="btn small ghost" onClick={() => pvp.closeRoom()}>
                    Cancel
                  </button>
                </div>
              </>
            ) : friendPending ? (
              <div className="mp-search">
                <div className="mp-spinner" />
                <div>
                  <b>
                    {status === 'connecting' ? 'Connecting to the server…' : friendPending === 'create' ? 'Creating your room…' : 'Joining the room…'}
                  </b>
                  <small className="muted">
                    {now - pendingSince > 3000 ? 'Waking up the server. This can take up to 20 seconds.' : 'One moment.'}
                  </small>
                </div>
                <button
                  className="btn small ghost"
                  onClick={() => {
                    setFriendPending(null);
                    pendingRef.current = null;
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <p className="muted">Play someone you know: make a room and share the code, or enter theirs.</p>
                <div className="friend-row">
                  <button className="btn" disabled={busy} onClick={createRoom}>
                    Create room
                  </button>
                  <span className="muted">or</span>
                  <input
                    className="code-input"
                    value={code}
                    maxLength={ROOM_CODE_LENGTH + 2}
                    placeholder="CODE"
                    disabled={busy}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && codeOk && joinRoom()}
                    spellCheck={false}
                    autoComplete="off"
                    aria-label="Friend's room code"
                  />
                  <button className="btn" disabled={busy || !codeOk} onClick={joinRoom}>
                    Join
                  </button>
                </div>
              </>
            )}
          </div>

          {pvp.error && !busy && <div className="mp-error">{pvp.error}</div>}

          <div className="mp-card slim">
            <span className="mp-soon">Coming soon</span>
            <h3>Ranked</h3>
            <p className="muted">Climb the ladder. Wins and losses move your rating.</p>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

/**
 * Rematch controls on the result screen after a friend battle. Starts the next match as soon as
 * both players have asked.
 */
export function FriendRematch({ friend, onMatch }: { friend: string; onMatch: (found: MatchFound) => void }) {
  type S = 'available' | 'waiting' | 'opponentWants' | 'cancelled' | 'pending';
  const [state, setState] = useState<S>(pvp.rematchStatus ?? 'pending');
  const onMatchRef = useRef(onMatch);
  onMatchRef.current = onMatch;
  useEffect(() => {
    const off = pvp.on((m) => {
      if (m.t === 'rematch') setState(m.status);
      if (m.t === 'matchFound') onMatchRef.current(m);
    });
    return () => void off();
  }, []);
  const text: Record<S, string> = {
    pending: '',
    available: `Press Rematch to play ${friend} again.`,
    waiting: `Waiting for ${friend}…`,
    opponentWants: `${friend} wants a rematch!`,
    cancelled: `${friend} left, so no rematch this time.`,
  };
  if (!text[state]) return null;
  return <div className={`rematch-note ${state}`}>{text[state]}</div>;
}
