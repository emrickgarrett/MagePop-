import { CHARACTERS, getCharacter } from '@magepop/core';
import { useMemo, useState } from 'react';
import { Portrait } from '../components/Hud';
import { formatTime, MatchMode, MatchRecord, SaveData, HISTORY_LIMIT } from '../game/save';
import { ScreenFrame } from './Menus';

const MODE_LABEL: Record<MatchMode, string> = { story: 'Story', quick: 'Quick', endless: 'Endless', pvp: 'Online' };
const MODES: (MatchMode | 'all')[] = ['all', 'story', 'quick', 'endless', 'pvp'];

function when(at: number): string {
  const diff = Date.now() - at;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function MatchHistory({ save, onBack, initialMage = 'all' }: { save: SaveData; onBack: () => void; initialMage?: string }) {
  const [mode, setMode] = useState<MatchMode | 'all'>('all');
  const [mage, setMage] = useState<string>(initialMage);

  const rows = useMemo(
    () => save.history.filter((m) => (mode === 'all' || m.mode === mode) && (mage === 'all' || m.player === mage)),
    [save.history, mode, mage],
  );
  const played = new Set(save.history.map((m) => m.player));

  const wins = rows.filter((m) => m.result === 'win').length;
  const avgMs = rows.length ? rows.reduce((t, m) => t + m.durationMs, 0) / rows.length : 0;
  const summary = [
    { l: 'Games', v: String(rows.length) },
    { l: 'Record', v: `${wins}–${rows.length - wins}` },
    { l: 'Win rate', v: rows.length ? `${Math.round((wins / rows.length) * 100)}%` : '–' },
    { l: 'Avg length', v: rows.length ? formatTime(avgMs) : '–' },
    { l: 'Damage dealt', v: String(rows.reduce((t, m) => t + m.damageDealt, 0)) },
  ];

  return (
    <ScreenFrame title="Match History" onBack={onBack}>
      <div className="history">
        <div className="history-filters">
          <div className="seg">
            {MODES.map((m) => (
              <button key={m} className={`seg-btn ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>
                {m === 'all' ? 'All' : MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <div className="seg">
            <button className={`seg-btn ${mage === 'all' ? 'on' : ''}`} onClick={() => setMage('all')}>
              All mages
            </button>
            {CHARACTERS.filter((c) => played.has(c.id)).map((c) => (
              <button key={c.id} className={`seg-btn icon ${mage === c.id ? 'on' : ''}`} onClick={() => setMage(c.id)} title={c.name}>
                <Portrait ch={c} size={26} />
              </button>
            ))}
          </div>
        </div>

        <div className="history-summary">
          {summary.map((s) => (
            <div key={s.l} className="mr-cell">
              <div className="mr-v">{s.v}</div>
              <div className="mr-l">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="history-list">
          {rows.length === 0 && (
            <div className="history-empty">
              {save.history.length === 0 ? 'No matches yet. Go win (or lose) a few!' : 'No matches match these filters.'}
            </div>
          )}
          {rows.map((m) => (
            <HistoryRow key={m.at + m.player + m.detail} m={m} />
          ))}
        </div>
        {save.history.length >= HISTORY_LIMIT && <div className="history-note">Showing your last {HISTORY_LIMIT} matches.</div>}
      </div>
    </ScreenFrame>
  );
}

function HistoryRow({ m }: { m: MatchRecord }) {
  const me = getCharacter(m.player);
  const foe = getCharacter(m.opponent);
  return (
    <div className={`history-row ${m.result}`} style={{ '--accent': me.palette.primary } as React.CSSProperties}>
      <div className={`result-pill ${m.result}`}>{m.result === 'win' ? 'WIN' : m.result === 'loss' ? 'LOSS' : m.result === 'draw' ? 'DRAW' : 'QUIT'}</div>
      <div className="hr-mages">
        <Portrait ch={me} size={40} />
        <span className="hr-vs">vs</span>
        <Portrait ch={foe} size={40} />
      </div>
      <div className="hr-what">
        <b>
          {me.name} vs {m.opponentName ? `${m.opponentName} (${foe.name})` : foe.name}
        </b>
        <small>
          {MODE_LABEL[m.mode]}
          {m.mode !== 'quick' && m.mode !== 'pvp' && ` · ${m.detail}`}
          {m.level && ` · ${m.level}`}
        </small>
      </div>
      <div className="hr-stat">
        <b>{formatTime(m.durationMs)}</b>
        <small>time</small>
      </div>
      <div className="hr-stat">
        <b>
          {m.damageDealt} <span className="muted">/ {m.damageTaken}</span>
        </b>
        <small>dealt / taken</small>
      </div>
      <div className="hr-stat">
        <b>
          {m.spells}
          {m.ultimates > 0 && <span className="ult"> · {m.ultimates} ult</span>}
        </b>
        <small>spells</small>
      </div>
      <div className="hr-stat">
        <b>x{m.biggestCombo}</b>
        <small>best combo</small>
      </div>
      <div className="hr-when">{when(m.at)}</div>
    </div>
  );
}
