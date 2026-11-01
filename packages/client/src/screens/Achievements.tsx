import { useEffect, useMemo, useRef, useState } from 'react';
import { AchievementCategory, AchievementDef, achievementScore, ACHIEVEMENTS, CATEGORY_LABEL, TIER_POINTS } from '../game/achievements';
import { audio } from '../game/audio';
import type { SaveData } from '../game/save';
import { ScreenFrame } from './Menus';

function Medal({ def, earned, size = 56 }: { def: AchievementDef; earned: boolean; size?: number }) {
  const hidden = def.secret && !earned;
  return (
    <div className={`medal ${def.tier} ${earned ? 'earned' : ''}`} style={{ width: size, height: size, fontSize: size * 0.46 }}>
      <span>{hidden ? '?' : def.icon}</span>
    </div>
  );
}

export function AchievementsScreen({ save, onBack }: { save: SaveData; onBack: () => void }) {
  const [cat, setCat] = useState<AchievementCategory | 'all'>('all');
  const score = achievementScore(save);
  const cats = useMemo(() => [...new Set(ACHIEVEMENTS.map((a) => a.category))], []);

  const shown = ACHIEVEMENTS.filter((a) => (!a.retired || save.achievements[a.id]) && (cat === 'all' || a.category === cat))
    // Earned first (newest first), then closest to done.
    .map((a) => {
      const at = save.achievements[a.id];
      const prog = a.progress && !at && !a.secret ? a.progress(save) : null;
      return {
        a,
        at,
        prog,
        pct: at ? 2 : prog ? Math.min(1, prog[0] / prog[1]) : 0,
      };
    })
    .sort((x, y) => (x.at && y.at ? y.at - x.at : y.pct - x.pct));

  return (
    <ScreenFrame title="Achievements" onBack={onBack}>
      <div className="ach">
        <div className="ach-summary">
          <div>
            <div className="ach-big">
              {score.unlocked}
              <span>/{score.total}</span>
            </div>
            <div className="mr-l">unlocked</div>
          </div>
          <div className="ach-bar">
            <div
              style={{
                width: `${(score.unlocked / Math.max(1, score.total)) * 100}%`,
              }}
            />
          </div>
          <div>
            <div className="ach-big gold">{score.points}</div>
            <div className="mr-l">of {score.maxPoints} points</div>
          </div>
        </div>

        <div className="seg ach-cats">
          <button className={`seg-btn ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>
            All
          </button>
          {cats.map((c) => {
            const list = ACHIEVEMENTS.filter((a) => a.category === c && !a.retired);
            const got = list.filter((a) => save.achievements[a.id]).length;
            return (
              <button key={c} className={`seg-btn ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
                {CATEGORY_LABEL[c]}{' '}
                <small>
                  {got}/{list.length}
                </small>
              </button>
            );
          })}
        </div>

        <div className="ach-grid">
          {shown.map(({ a, at, prog }) => {
            const hidden = a.secret && !at;
            return (
              <div key={a.id} className={`ach-card ${at ? 'earned' : ''} ${a.tier}`}>
                <Medal def={a} earned={!!at} />
                <div className="ach-text">
                  <b>{hidden ? 'Secret achievement' : a.name}</b>
                  <p>{hidden ? 'Keep playing to discover it.' : a.description}</p>
                  {at ? (
                    <small className="ach-date">
                      Unlocked{' '}
                      {new Date(at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </small>
                  ) : (
                    prog && (
                      <div className="ach-prog">
                        <div className="ach-bar small">
                          <div
                            style={{
                              width: `${Math.min(100, (prog[0] / prog[1]) * 100)}%`,
                            }}
                          />
                        </div>
                        <small>
                          {Math.min(prog[0], prog[1]).toLocaleString()} / {prog[1].toLocaleString()}
                        </small>
                      </div>
                    )
                  )}
                </div>
                <div className="ach-pts">{TIER_POINTS[a.tier]}</div>
              </div>
            );
          })}
        </div>
      </div>
    </ScreenFrame>
  );
}

// ---- Unlock toasts -------------------------------------------------------------------

/** One unlocked achievement, or a summary of several ("+5 more"). */
export interface Toast {
  id: string;
  def?: AchievementDef;
  summary?: { count: number; title: string; best: AchievementDef };
}

/** Big batches would queue a toast per unlock; show the first couple, then one summary. */
export function toastsFor(unlocked: AchievementDef[], opts: { summaryTitle?: string; individually?: number } = {}): Toast[] {
  const stamp = Date.now();
  const n = opts.individually ?? 2;
  if (unlocked.length <= n + 1) return unlocked.map((def) => ({ id: `${def.id}-${stamp}`, def }));
  const rest = unlocked.slice(n);
  const order = { gold: 3, silver: 2, bronze: 1 };
  const best = [...rest].sort((a, b) => order[b.tier] - order[a.tier])[0];
  return [
    ...unlocked.slice(0, n).map((def) => ({ id: `${def.id}-${stamp}`, def })),
    { id: `summary-${stamp}`, summary: { count: rest.length, title: opts.summaryTitle ?? `+${rest.length} more achievements`, best } },
  ];
}

const TOAST_MS = 4200;

/** Shows one toast at a time (queued), top-center, over any screen. */
export function AchievementToasts({ toasts, onDone }: { toasts: Toast[]; onDone: (id: string) => void }) {
  const current = toasts[0];
  // The parent re-renders every frame during battles; keep the timer keyed to the toast only.
  const done = useRef(onDone);
  done.current = onDone;
  const id = current?.id;
  useEffect(() => {
    if (!id) return;
    audio.play('ultimate', { pitch: 1.35, volume: 0.55 });
    const t = setTimeout(() => done.current(id), TOAST_MS);
    return () => clearTimeout(t);
  }, [id]);
  if (!current) return null;
  const def = current.def ?? current.summary!.best;
  return (
    <div className="ach-toast-wrap">
      <div key={current.id} className={`ach-toast ${def.tier}`} onClick={() => onDone(current.id)}>
        <Medal def={def} earned size={48} />
        {current.summary ? (
          <div>
            <small>Achievements unlocked</small>
            <b>{current.summary.title}</b>
            <span>Including {def.name}. See them all under Achievements.</span>
          </div>
        ) : (
          <div>
            <small>Achievement unlocked</small>
            <b>{def.name}</b>
            <span>{def.description}</span>
          </div>
        )}
      </div>
    </div>
  );
}
