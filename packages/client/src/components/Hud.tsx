import { CharacterDef, describeSpell, GEM_COLORS, GemColor, PlayerState } from '@magepop/core';
import { useState } from 'react';
import type { FloatFx } from '../game/BattleController';
import { Gem } from './Gem';

export function Portrait({ ch, size = 96, locked = false }: { ch: CharacterDef; size?: number; locked?: boolean }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div
      className={`portrait ${locked ? 'locked' : ''}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, ${ch.palette.secondary}, ${ch.palette.primary} 60%, #1a0b2e 120%)`,
        boxShadow: locked ? 'none' : `0 0 ${size / 4}px ${ch.palette.primary}66`,
      }}
    >
      {imgOk && !locked && (
        <img src={`assets/portraits/${ch.id}.png`} alt="" onError={() => setImgOk(false)} draggable={false} />
      )}
      {(!imgOk || locked) && <span style={{ fontSize: size * 0.5 }}>{locked ? '?' : ch.sigil}</span>}
    </div>
  );
}

function fmtSec(ms: number) {
  return `${Math.max(0, ms / 1000).toFixed(1)}s`;
}

export function PlayerPanel({
  ch,
  pl,
  vitals,
  time,
  side,
  fx,
  shakeAge,
  flash,
  tag,
}: {
  ch: CharacterDef;
  pl: PlayerState;
  vitals: { hp: number; shield: number; maxHp: number };
  time: number;
  side: 0 | 1;
  fx: FloatFx[];
  shakeAge: number;
  flash: { color: string; age: number } | null;
  tag: string;
}) {
  const pct = (vitals.hp / vitals.maxHp) * 100;
  const shieldPct = Math.min(100, (vitals.shield / vitals.maxHp) * 100);
  const chips: { text: string; cls: string }[] = [];
  for (const s of pl.statuses) {
    chips.push({
      cls: s.kind,
      text: s.kind === 'poison' ? `${s.label} ${s.perTick}/s · ${s.matchesLeft} matches · ${fmtSec(s.expiresAt - time)}` : `Regen ${+s.perTick.toFixed(1)}/s · ${fmtSec(s.expiresAt - time)}`,
    });
  }
  if (pl.stunnedUntil > time) chips.push({ cls: 'stun', text: `Stunned ${fmtSec(pl.stunnedUntil - time)}` });
  if (pl.empower) chips.push({ cls: 'empower', text: `Empowered x${pl.empower.mult}${pl.empower.charges > 1 ? ` (${pl.empower.charges})` : ''}` });

  return (
    <div className={`player-panel side-${side} ${shakeAge < 300 ? 'shake' : ''}`}>
      {flash && flash.age < 600 && <div className="cast-flash" style={{ background: flash.color }} />}
      <Portrait ch={ch} size={side === 0 ? 84 : 72} />
      <div className="pp-main">
        <div className="pp-name">
          <span className="pp-tag">{tag}</span>
          {ch.name} <small>{ch.title}</small>
        </div>
        <div className="hp-bar">
          <div className="hp-trail" style={{ width: `${pct}%` }} />
          <div className={`hp-fill ${pct < 30 ? 'low' : ''}`} style={{ width: `${pct}%` }} />
          {vitals.shield > 0 && <div className="hp-shield" style={{ width: `${shieldPct}%` }} />}
          <div className="hp-text">
            {Math.ceil(vitals.hp)} / {vitals.maxHp}
            {vitals.shield > 0 && <span className="shield-num"> +{vitals.shield}</span>}
          </div>
        </div>
        <div className="chips">
          {chips.map((c, i) => (
            <span key={i} className={`chip chip-${c.cls}`}>
              {c.text}
            </span>
          ))}
        </div>
      </div>
      <div className="fx-layer">
        {fx.map((f, i) => (
          <div key={f.id} className={`float float-${f.kind}`} style={{ color: f.kind === 'spell' || f.kind === 'ultimate' ? f.color : undefined, top: `${(i % 5) * 34}px` }}>
            {f.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpellLegend({ ch, spotlight = [], compact = false }: { ch: CharacterDef; spotlight?: GemColor[]; compact?: boolean }) {
  const [hover, setHover] = useState<GemColor | null>(null);
  return (
    <div className={`spell-legend ${compact ? 'compact' : ''}`}>
      {GEM_COLORS.map((c) => {
        const s = ch.spells[c];
        return (
          <div
            key={c}
            className={`legend-row ${spotlight.includes(c) ? 'spotlight' : ''}`}
            onMouseEnter={() => setHover(c)}
            onMouseLeave={() => setHover(null)}
          >
            <Gem kind={c} size={compact ? 24 : 30} theme={ch.id} />
            <div className="legend-names">
              <span className="l-active">{s.active.name}</span>
              <span className="l-ult">{s.ultimate.name}</span>
            </div>
            {hover === c && (
              <div className="legend-tip">
                <p>
                  <b>4-match · {s.active.name}</b> — {describeSpell(s.active, ch)}
                </p>
                <p>
                  <b>5+ · {s.ultimate.name}</b> — {describeSpell(s.ultimate, ch)}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SpellTable({ ch }: { ch: CharacterDef }) {
  return (
    <div className="spell-table">
      {GEM_COLORS.map((c) => {
        const s = ch.spells[c];
        return (
          <div key={c} className="st-row">
            <Gem kind={c} size={44} theme={ch.id} />
            <div>
              <div className="st-line">
                <span className="st-tier">4</span>
                <b>{s.active.name}</b> — {describeSpell(s.active, ch)}
              </div>
              <div className="st-line ult">
                <span className="st-tier">5+</span>
                <b>{s.ultimate.name}</b> — {describeSpell(s.ultimate, ch)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
