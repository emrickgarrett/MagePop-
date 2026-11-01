import { AI_LEVELS, CHARACTERS, DialogueLine, getCharacter, STORY, StoryChapter, StoryFight } from '@magepop/core';
import { achievementScore } from '../game/achievements';
import { HowToPlay } from '../components/HowToPlay';
import { UpdateBanner } from '../components/UpdateBanner';
import { ReactNode, useEffect, useState } from 'react';
import { Gem } from '../components/Gem';
import { Portrait, SpellTable } from '../components/Hud';
import { audio } from '../game/audio';
import { isDesktop, isFullscreen, setFullscreen } from '../game/platform';
import { fightAvailable, formatTime, mageStatsOf, nextStoryFight, TOTAL_STORY_FIGHTS } from '../game/save';
import type { RecordStats, SaveData, Settings } from '../game/save';

export function Logo() {
  return (
    <div className="logo">
      <div className="logo-gems">
        {(['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst'] as const).map((k, i) => (
          <span key={k} style={{ animationDelay: `${i * 0.15}s` }}>
            <Gem kind={k} size={40} />
          </span>
        ))}
      </div>
      <h1>
        Mage<span>Pop!</span>
      </h1>
      <div className="logo-sub">Match-3 Spell Duels</div>
    </div>
  );
}

export type MenuTarget = 'story' | 'quick' | 'endless' | 'pvp' | 'collection' | 'settings' | 'history' | 'achievements';

export function MainMenu({ save, go, onQuit }: { save: SaveData; go: (s: MenuTarget) => void; onQuit?: () => void }) {
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [howTo, setHowTo] = useState(false);
  const cleared = save.storyCleared.length;
  const next = nextStoryFight(save);
  return (
    <div className="screen menu-screen">
      <UpdateBanner />
      <Logo />
      <div className="menu-buttons">
        <button className="btn big" onClick={() => go('story')}>
          Story
          <small>
            {cleared === 0 ? 'Start your journey' : next ? `${cleared}/${TOTAL_STORY_FIGHTS} fights cleared` : 'Complete! Replay any fight'}
          </small>
        </button>
        <button className="btn big alt" onClick={() => go('quick')}>
          Quick Battle
          <small>Any mage vs any bot</small>
        </button>
        <button className="btn big alt2" onClick={() => go('endless')}>
          Endless
          <small>{save.endlessBest ? `Best: wave ${save.endlessBest.wave} with ${getCharacter(save.endlessBest.characterId).name}` : 'How long can you last?'}</small>
        </button>
        <button className="btn big muted-btn" onClick={() => go('pvp')}>
          Multiplayer
          <small>Online battles · coming soon</small>
        </button>
      </div>
      <div className="menu-row">
        <button className="btn mid ghost" onClick={() => go('collection')}>
          Mages <span className="count">{save.unlocked.length}/{CHARACTERS.length}</span>
        </button>
        <button className="btn mid ghost" onClick={() => go('history')}>
          History
        </button>
        <button className="btn mid ghost" onClick={() => go('achievements')}>
          Achievements{' '}
          <span className="count">
            {achievementScore(save).unlocked}/{achievementScore(save).total}
          </span>
        </button>
        <button className="btn mid ghost" onClick={() => setHowTo(true)}>
          How to Play
        </button>
        <button className="btn mid ghost" onClick={() => go('settings')}>
          Settings
        </button>
        {onQuit && (
          <button className="btn mid ghost" onClick={() => setConfirmQuit(true)}>
            Quit
          </button>
        )}
      </div>
      {howTo && <HowToPlay onClose={() => setHowTo(false)} />}
      {confirmQuit && onQuit && (
        <div className="overlay" onClick={() => setConfirmQuit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Quit MagePop?</h2>
            <p className="muted">Your progress is saved automatically.</p>
            <button className="btn danger" onClick={onQuit}>
              Quit game
            </button>
            <button className="btn ghost" onClick={() => setConfirmQuit(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScreenFrame({ title, onBack, children, right }: { title: string; onBack: () => void; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="screen framed">
      <div className="frame-top">
        <button className="btn small ghost" onClick={onBack}>
          ← Back
        </button>
        <h2>{title}</h2>
        <div className="frame-right">{right}</div>
      </div>
      {children}
    </div>
  );
}

export function StoryMap({
  save,
  onBack,
  onPlay,
}: {
  save: SaveData;
  onBack: () => void;
  onPlay: (ch: StoryChapter, f: StoryFight) => void;
}) {
  const cleared = save.storyCleared.length;
  const chaptersDone = STORY.filter((c) => c.fights.every((f) => save.storyCleared.includes(f.id))).length;
  const next = nextStoryFight(save);
  const pct = (cleared / TOTAL_STORY_FIGHTS) * 100;
  return (
    <ScreenFrame title="Story" onBack={onBack}>
      <div className="story-summary">
        <div className="ss-progress">
          <div className="ss-label">
            <b>
              {cleared}/{TOTAL_STORY_FIGHTS}
            </b>{' '}
            fights cleared · <b>{chaptersDone}/{STORY.length}</b> chapters complete
            {next && <span className="muted"> · {TOTAL_STORY_FIGHTS - cleared} to go</span>}
          </div>
          <div className="ss-bar">
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>
        {next ? (
          <button className="btn" onClick={() => onPlay(next.chap, next.fight)}>
            {cleared === 0 ? 'Begin' : 'Continue'}: {getCharacter(next.chap.hero).name} · {next.fight.title}
          </button>
        ) : (
          <div className="ss-done">Story complete! Replay any fight below.</div>
        )}
      </div>
      <div className="chapters">
        {STORY.map((chap, ci) => {
          const hero = getCharacter(chap.hero);
          const unlocked = save.unlocked.includes(chap.hero);
          const prevHero = ci > 0 ? getCharacter(STORY[ci - 1].hero).name : '';
          const done = chap.fights.filter((f) => save.storyCleared.includes(f.id)).length;
          const status = !unlocked ? 'locked' : done === chap.fights.length ? 'complete' : done > 0 ? 'progress' : 'new';
          const statusText = { locked: 'Locked', complete: 'Complete', progress: 'In progress', new: 'New' }[status];
          return (
            <div key={chap.hero} className={`chapter ${unlocked ? '' : 'locked'}`} style={{ '--accent': hero.palette.primary } as React.CSSProperties}>
              <Portrait ch={hero} size={88} locked={!unlocked} />
              <div className="chapter-body">
                <div className="chapter-num">
                  Chapter {ci + 1}
                  <span className={`ch-status st-${status}`}>{statusText}</span>
                  {unlocked && (
                    <span className="ch-count">
                      {done}/{chap.fights.length}
                    </span>
                  )}
                </div>
                <h3>{unlocked ? `${hero.name}: ${chap.title}` : '???'}</h3>
                <div className="muted">{unlocked ? `Play as ${hero.name} · ${hero.role}` : `Finish ${prevHero}'s chapter to unlock`}</div>
                {unlocked && (
                  <div className="fights">
                    {chap.fights.map((f, fi) => {
                      const isCleared = save.storyCleared.includes(f.id);
                      const available = fightAvailable(save, chap, fi);
                      const isNext = next?.fight.id === f.id;
                      const best = save.storyBest[f.id];
                      return (
                        <button
                          key={f.id}
                          className={`fight-node ${isCleared ? 'cleared' : ''} ${f.boss ? 'boss' : ''} ${isNext ? 'next' : ''}`}
                          disabled={!available}
                          onClick={() => onPlay(chap, f)}
                          title={available ? `vs ${getCharacter(f.opponent).name} (${AI_LEVELS[f.aiLevel].name})` : 'Clear the previous fight first'}
                        >
                          <span className="fn-title">{f.title}</span>
                          <span className="fn-sub">
                            vs {getCharacter(f.opponent).name} · {AI_LEVELS[f.aiLevel].name}
                          </span>
                          <span className="fn-state">
                            {isCleared ? (
                              <>
                                <span className="fn-replay">↻ Replay</span>
                                {best !== undefined && <span className="muted">Best {formatTime(best)}</span>}
                              </>
                            ) : isNext ? (
                              <span className="fn-next">▶ Play</span>
                            ) : (
                              <span className="muted">🔒 Locked</span>
                            )}
                          </span>
                          {isCleared && <span className="fn-check">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {chap.unlocks && (
                <div className="chapter-reward">
                  <div className="muted">Reward</div>
                  <Portrait ch={getCharacter(chap.unlocks)} size={48} locked={!save.unlocked.includes(chap.unlocks)} />
                  <div className="muted">{save.unlocked.includes(chap.unlocks) ? getCharacter(chap.unlocks).name : '???'}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScreenFrame>
  );
}

function Slider({ label, value, onChange, onRelease }: { label: string; value: number; onChange: (v: number) => void; onRelease?: () => void }) {
  return (
    <label className="setting">
      <div className="setting-label">{label}</div>
      <div className="slider-wrap">
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(value * 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          onPointerUp={onRelease}
          onKeyUp={onRelease}
          style={{ '--pct': `${Math.round(value * 100)}%` } as React.CSSProperties}
        />
        <span className="slider-val">{value === 0 ? 'Off' : `${Math.round(value * 100)}%`}</span>
      </div>
    </label>
  );
}

function Toggle({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting">
      <div>
        <div className="setting-label">{label}</div>
        <div className="setting-desc">{desc}</div>
      </div>
      <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
        <span />
      </button>
    </label>
  );
}

export function SettingsScreen({
  save,
  onChange,
  onReset,
  onBack,
}: {
  save: SaveData;
  onChange: (s: Settings) => void;
  onReset: () => void;
  onBack: () => void;
}) {
  const st = save.settings;
  const set = (patch: Partial<Settings>) => onChange({ ...st, ...patch });
  const [full, setFull] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  useEffect(() => {
    isFullscreen().then(setFull);
  }, []);
  return (
    <ScreenFrame title="Settings" onBack={onBack}>
      <div className="settings">
        <section>
          <h4>Audio</h4>
          <Slider label="Music" value={st.musicVolume} onChange={(v) => set({ musicVolume: v })} />
          <Slider label="Sound effects" value={st.sfxVolume} onChange={(v) => set({ sfxVolume: v })} onRelease={() => audio.play('match')} />
        </section>
        <section>
          <h4>Display</h4>
          <Toggle
            label="Fullscreen"
            desc={isDesktop ? 'Also toggled with F11.' : 'Uses your browser\'s fullscreen mode.'}
            on={full}
            onChange={async (v) => {
              await setFullscreen(v);
              setTimeout(() => isFullscreen().then(setFull), 250);
            }}
          />
          <Toggle label="Spell effects" desc="Projectiles, board auras and ultimate banners." on={st.spellEffects} onChange={(v) => set({ spellEffects: v })} />
          <Toggle label="Screen shake" desc="Health panels shake when a hit lands." on={st.screenShake} onChange={(v) => set({ screenShake: v })} />
          <Toggle label="Combat text" desc="Floating damage, healing and spell names." on={st.combatText} onChange={(v) => set({ combatText: v })} />
          <Toggle label="Battle hints" desc="Show the controls reminder at the top of battles." on={st.battleHints} onChange={(v) => set({ battleHints: v })} />
        </section>
        <section>
          <h4>Story</h4>
          <Toggle
            label="Skip dialogue on replays"
            desc="Jump straight into fights you've already cleared."
            on={st.skipReplayDialogue}
            onChange={(v) => set({ skipReplayDialogue: v })}
          />
        </section>
        <section>
          <h4>Data</h4>
          <div className="setting">
            <div>
              <div className="setting-label">Reset progress</div>
              <div className="setting-desc">
                Erases story progress, unlocked mages, mage stats, match history, achievements and Endless records. Settings are kept.
                {resetDone && <b className="reset-done"> Progress reset.</b>}
              </div>
            </div>
            {confirmReset ? (
              <div className="setting-actions">
                <button
                  className="btn small danger"
                  onClick={() => {
                    onReset();
                    setConfirmReset(false);
                    setResetDone(true);
                  }}
                >
                  Erase everything
                </button>
                <button className="btn small ghost" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="btn small ghost" onClick={() => setConfirmReset(true)}>
                Reset…
              </button>
            )}
          </div>
        </section>
      </div>
    </ScreenFrame>
  );
}

export function DialogueScreen({ lines, onDone, title, theme }: { lines: DialogueLine[]; onDone: () => void; title?: string; theme?: string }) {
  const [i, setI] = useState(0);
  const line = lines[i];
  const next = () => (i + 1 >= lines.length ? onDone() : setI(i + 1));
  const speaker = line.speaker === 'narrator' ? null : getCharacter(line.speaker);
  return (
    <div className="screen dialogue-screen" onClick={next}>
      {title && <div className="dialogue-title">{title}</div>}
      <div className="dialogue-stage">
        {speaker ? (
          <Portrait ch={speaker} size={220} />
        ) : line.gem ? (
          <div className="stage-gem" key={line.gem}>
            <Gem kind={line.gem} size={190} theme={theme} />
          </div>
        ) : (
          <div className="logo-gems stage-row">
            {(['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst'] as const).map((k, j) => (
              <span key={k} style={{ animationDelay: `${j * 0.15}s` }}>
                <Gem kind={k} size={90} />
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={`dialogue-box ${speaker ? '' : 'narrator'}`} style={speaker ? ({ '--accent': speaker.palette.primary } as React.CSSProperties) : undefined}>
        <div className="speaker">{speaker ? `${speaker.name} ${speaker.title}` : 'Guide'}</div>
        <p>{line.text}</p>
        <div className="dialogue-nav">
          <span className="muted">
            {i + 1}/{lines.length} · click to continue
          </span>
          <button
            className="btn small ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDone();
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

export function CharacterSelect({
  save,
  mode,
  onBack,
  onStart,
}: {
  save: SaveData;
  mode: 'quick' | 'endless';
  onBack: () => void;
  onStart: (player: string, opponent: string, level: number) => void;
}) {
  const [pick, setPick] = useState(save.unlocked[0]);
  const [opp, setOpp] = useState<string>('random');
  const [level, setLevel] = useState(1);
  const ch = getCharacter(pick);
  return (
    <ScreenFrame title={mode === 'quick' ? 'Quick Battle' : 'Endless'} onBack={onBack}>
      <div className="select-layout">
        <div>
          <h4>Your mage</h4>
          <div className="char-grid">
            {CHARACTERS.map((c) => {
              const un = save.unlocked.includes(c.id);
              return (
                <button key={c.id} className={`char-card ${pick === c.id ? 'picked' : ''}`} disabled={!un} onClick={() => setPick(c.id)} title={un ? c.role : 'Unlock in Story mode'}>
                  <Portrait ch={c} size={72} locked={!un} />
                  <span>{un ? c.name : 'Locked'}</span>
                </button>
              );
            })}
          </div>
          {mode === 'quick' && (
            <>
              <h4>Opponent</h4>
              <div className="pill-row">
                <button className={`pill ${opp === 'random' ? 'on' : ''}`} onClick={() => setOpp('random')}>
                  Random
                </button>
                {CHARACTERS.map((c) => (
                  <button key={c.id} className={`pill ${opp === c.id ? 'on' : ''}`} onClick={() => setOpp(c.id)}>
                    {c.name}
                  </button>
                ))}
              </div>
              <h4>Bot difficulty</h4>
              <div className="pill-row">
                {AI_LEVELS.map((l, i) => (
                  <button key={l.id} className={`pill ${level === i ? 'on' : ''}`} onClick={() => setLevel(i)}>
                    {l.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {mode === 'endless' && (
            <p className="muted endless-rules">
              Fight random mages back to back. Your HP carries over, with 25% restored after each win. Bots get tougher every two waves.
              {save.endlessBest && ` Your best: wave ${save.endlessBest.wave}.`}
            </p>
          )}
          <button
            className="btn big start"
            onClick={() => {
              const pool = CHARACTERS.map((c) => c.id);
              const o = opp === 'random' ? pool[Math.floor(Math.random() * pool.length)] : opp;
              onStart(pick, o, level);
            }}
          >
            {mode === 'quick' ? 'Fight!' : 'Begin'}
          </button>
        </div>
        <div className="char-detail" style={{ '--accent': ch.palette.primary } as React.CSSProperties}>
          <div className="cd-head">
            <Portrait ch={ch} size={110} />
            <div>
              <h3>
                {ch.name} <small>{ch.title}</small>
              </h3>
              <div className="cd-role">{ch.role}</div>
              <p className="muted">{ch.blurb}</p>
            </div>
          </div>
          <SpellTable ch={ch} />
        </div>
      </div>
    </ScreenFrame>
  );
}

export function Collection({ save, onBack, onHistory }: { save: SaveData; onBack: () => void; onHistory?: (mage: string) => void }) {
  const [pick, setPick] = useState(save.unlocked[0]);
  const ch = getCharacter(pick);
  const unlocked = save.unlocked.includes(pick);
  return (
    <ScreenFrame title="Mages" onBack={onBack}>
      <div className="select-layout">
        <div className="char-grid tall">
          {CHARACTERS.map((c) => {
            const un = save.unlocked.includes(c.id);
            return (
              <button key={c.id} className={`char-card ${pick === c.id ? 'picked' : ''}`} onClick={() => setPick(c.id)}>
                <Portrait ch={c} size={72} locked={!un} />
                <span>{un ? c.name : 'Locked'}</span>
              </button>
            );
          })}
        </div>
        <div className="char-detail" style={{ '--accent': ch.palette.primary } as React.CSSProperties}>
          {unlocked ? (
            <>
              <div className="cd-head">
                <Portrait ch={ch} size={110} />
                <div>
                  <h3>
                    {ch.name} <small>{ch.title}</small>
                  </h3>
                  <div className="cd-role">{ch.role}</div>
                  <p className="muted">{ch.blurb}</p>
                </div>
              </div>
              <MageStatsPanel save={save} id={ch.id} />
              {onHistory && save.history.some((m) => m.player === ch.id) && (
                <button className="btn small ghost history-link" onClick={() => onHistory(ch.id)}>
                  {ch.name}'s match history →
                </button>
              )}
              <SpellTable ch={ch} />
            </>
          ) : (
            <div className="locked-detail">
              <Portrait ch={ch} size={110} locked />
              <p>Locked. Clear {getCharacter(STORY.find((s) => s.unlocks === ch.id)?.hero ?? 'ember').name}'s story chapter to recruit this mage.</p>
            </div>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}

function RecordRow({ label, rec, note }: { label: string; rec: RecordStats; note?: string }) {
  const games = rec.wins + rec.losses;
  const cells = [
    { l: 'Games', v: String(games) },
    { l: 'Wins', v: String(rec.wins) },
    { l: 'Losses', v: String(rec.losses) },
    { l: 'Win rate', v: games ? `${Math.round((rec.wins / games) * 100)}%` : '–' },
    { l: 'Fastest win', v: rec.fastestWinMs !== null ? formatTime(rec.fastestWinMs) : '–' },
  ];
  return (
    <div className={`mage-record ${note ? 'pending' : ''}`}>
      <div className="mr-label">
        {label}
        {note && <small>{note}</small>}
      </div>
      {cells.map((c) => (
        <div key={c.l} className="mr-cell">
          <div className="mr-v">{c.v}</div>
          <div className="mr-l">{c.l}</div>
        </div>
      ))}
    </div>
  );
}

function MageStatsPanel({ save, id }: { save: SaveData; id: string }) {
  const st = mageStatsOf(save, id);
  return (
    <div className="mage-stats">
      <RecordRow label="vs Bots" rec={st.bots} />
      <RecordRow label="Online" rec={st.pvp} note={st.pvp.wins + st.pvp.losses ? undefined : 'coming soon'} />
    </div>
  );
}

export interface ResultInfo {
  won: boolean;
  title: string;
  subtitle?: string;
  unlocked?: string | null;
  stats: { label: string; value: string }[];
  actions: { label: string; onClick: () => void; primary?: boolean }[];
}

export function ResultScreen({ info }: { info: ResultInfo }) {
  // R = rematch, Enter = the highlighted button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const a =
        e.key === 'r' || e.key === 'R' ? info.actions.find((x) => x.label === 'Rematch') : e.key === 'Enter' ? info.actions.find((x) => x.primary) : undefined;
      if (a) {
        e.preventDefault();
        a.onClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [info]);
  return (
    <div className={`screen result-screen ${info.won ? 'win' : 'lose'}`}>
      <h1 className="result-title">{info.title}</h1>
      {info.subtitle && <div className="result-sub">{info.subtitle}</div>}
      {info.unlocked && (
        <div className="unlock-banner">
          <Portrait ch={getCharacter(info.unlocked)} size={96} />
          <div>
            <div className="muted">New mage unlocked!</div>
            <h3>
              {getCharacter(info.unlocked).name} {getCharacter(info.unlocked).title}
            </h3>
            <div>Their story chapter is now open.</div>
          </div>
        </div>
      )}
      <div className="result-stats">
        {info.stats.map((s) => (
          <div key={s.label} className="stat">
            <div className="stat-v">{s.value}</div>
            <div className="stat-l">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="result-actions">
        {info.actions.map((a) => (
          <button key={a.label} className={`btn ${a.primary ? '' : 'ghost'}`} onClick={a.onClick}>
            {a.label}
            {a.label === 'Rematch' && <kbd className="hotkey">R</kbd>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PvpComingSoon({ onBack }: { onBack: () => void }) {
  const modes = [
    { name: 'Quick Match', desc: 'Get paired with a random opponent online.' },
    { name: 'Ranked', desc: 'Climb the ladder. Wins and losses move your rating.' },
    { name: 'Friend Battle', desc: 'Share a room code and duel a friend.' },
  ];
  return (
    <ScreenFrame title="Multiplayer" onBack={onBack}>
      <div className="mp-modes">
        {modes.map((m) => (
          <div key={m.name} className="mp-card">
            <span className="mp-soon">Coming soon</span>
            <h3>{m.name}</h3>
            <p className="muted">{m.desc}</p>
          </div>
        ))}
      </div>
      <p className="muted mp-foot">Online battles are on the way. Until then, sharpen your skills against the bots in Story, Quick Battle and Endless.</p>
    </ScreenFrame>
  );
}
