import { AI_LEVELS, chapterId, chapterOpen, CHARACTERS, DialogueLine, getCharacter, STORY, StoryChapter, StoryNode } from '@magepop/core';
import { achievementScore } from '../game/achievements';
import { HowToPlay } from '../components/HowToPlay';
import { UpdateBanner } from '../components/UpdateBanner';
import { ReactNode, useEffect, useState } from 'react';
import { Gem } from '../components/Gem';
import { Portrait, SpellTable } from '../components/Hud';
import { audio } from '../game/audio';
import { isDesktop, isFullscreen, setFullscreen } from '../game/platform';
import {
  formatTime,
  mageStatsOf,
  nextStoryNode,
  STORY_DIFFICULTY,
  nodeOpen,
  storyHeroFor,
  storyNodesCleared,
  storyStarsEarned,
  TOTAL_STORY_NODES,
  TOTAL_STORY_STARS,
} from '../game/save';
import type { RecordStats, SaveData, Settings, StoryDifficulty } from '../game/save';

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
  const cleared = storyNodesCleared(save);
  const next = nextStoryNode(save);
  return (
    <div className="screen menu-screen">
      <UpdateBanner />
      <Logo />
      <div className="menu-buttons">
        <button className="btn big" onClick={() => go('story')}>
          Story
          <small>
            {cleared === 0 ? 'Start your journey' : next ? `${cleared}/${TOTAL_STORY_NODES} steps · ★ ${storyStarsEarned(save)}` : `Complete! ★ ${storyStarsEarned(save)}/${TOTAL_STORY_STARS}`}
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
        <button className="btn big alt3" onClick={() => go('pvp')}>
          Multiplayer
          <small>Quick Match or battle a friend</small>
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

const NODE_ICON: Record<StoryNode['kind'], string> = { lesson: '📖', fight: '⚔️', survival: '⏳', boss: '👑', gauntlet: '🔥' };
const NODE_KIND: Record<StoryNode['kind'], string> = { lesson: 'Lesson', fight: 'Battle', survival: 'Survival', boss: 'Boss', gauntlet: 'Gauntlet' };

/**
 * Was star goal `i` (0 = win) ever met on this node? Saves from before goals were tracked only
 * know the count; we only claim what's certain (clearing = the first star; 3 stars = all three).
 */
function goalMet(save: SaveData, nodeId: string, i: number): boolean {
  const goals = save.storyGoals[nodeId];
  if (goals) return !!goals[i];
  const n = save.storyStars[nodeId] ?? 0;
  return n >= 3 || (i === 0 && save.storyCleared.includes(nodeId));
}

function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span className="stars" style={{ fontSize: size }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? 'on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

export function StoryMap({
  save,
  onBack,
  onPlay,
  onDifficulty,
  onHero,
}: {
  save: SaveData;
  onBack: () => void;
  onPlay: (ch: StoryChapter, node: StoryNode) => void;
  onDifficulty: (d: StoryDifficulty) => void;
  /** Pick the mage for "any mage" chapters (the finale). */
  onHero: (id: string) => void;
}) {
  const difficulty = save.settings.storyDifficulty ?? 'normal';
  const next = nextStoryNode(save);
  const cleared = storyNodesCleared(save);
  const stars = storyStarsEarned(save);
  const [chapIdx, setChapIdx] = useState(() => Math.max(0, STORY.findIndex((c) => c === (next?.chap ?? STORY[0]))));
  const chap = STORY[chapIdx];
  const [nodeId, setNodeId] = useState<string>(() => next?.node.id ?? chap.nodes[0].id);
  const nodeIdx = Math.max(0, chap.nodes.findIndex((n) => n.id === nodeId));
  const node = chap.nodes[nodeIdx];
  const heroOf = (c: StoryChapter) => getCharacter(c.anyHero ? storyHeroFor(save) : c.hero);
  const hero = heroOf(chap);
  const open = nodeOpen(save, chap, nodeIdx);
  const pickChapter = (i: number) => {
    setChapIdx(i);
    const c = STORY[i];
    const firstOpen = c.nodes.find((n, j) => !save.storyCleared.includes(n.id) && !n.optional && nodeOpen(save, c, j));
    setNodeId((firstOpen ?? c.nodes[0]).id);
  };

  return (
    <ScreenFrame title="Story" onBack={onBack}>
      <div className="story-summary">
        <div className="ss-progress">
          <div className="ss-label">
            <b>
              {cleared}/{TOTAL_STORY_NODES}
            </b>{' '}
            steps cleared · <Stars n={3} size={13} /> <b>{stars}</b>/{TOTAL_STORY_STARS} stars
          </div>
          <div className="ss-bar">
            <div style={{ width: `${(cleared / TOTAL_STORY_NODES) * 100}%` }} />
          </div>
        </div>
        <div className="seg story-diff" title={STORY_DIFFICULTY[difficulty].desc}>
          {(Object.keys(STORY_DIFFICULTY) as StoryDifficulty[]).map((d) => (
            <button key={d} className={`seg-btn ${difficulty === d ? 'on' : ''}`} onClick={() => onDifficulty(d)} title={STORY_DIFFICULTY[d].desc}>
              {STORY_DIFFICULTY[d].label}
            </button>
          ))}
        </div>
        {next ? (
          <button className="btn" onClick={() => onPlay(next.chap, next.node)}>
            {cleared === 0 ? 'Begin' : 'Continue'}: {heroOf(next.chap).name} · {next.node.title}
          </button>
        ) : (
          <div className="ss-done">Every chapter cleared! Go back for stars.</div>
        )}
      </div>

      <div className="story-layout">
        <div className="chapter-list">
          {STORY.map((c, ci) => {
            const h = getCharacter(c.cover ?? c.hero);
            const unlocked = chapterOpen(c, save.storyCleared, save.unlocked);
            const req = c.nodes.filter((n) => !n.optional);
            const done = req.filter((n) => save.storyCleared.includes(n.id)).length;
            const st = c.nodes.reduce((t, n) => t + (save.storyStars[n.id] ?? 0), 0);
            return (
              <button
                key={chapterId(c)}
                className={`chapter-tab ${ci === chapIdx ? 'on' : ''} ${unlocked ? '' : 'locked'} ${c.anyHero ? 'finale' : ''}`}
                style={{ '--accent': h.palette.primary } as React.CSSProperties}
                onClick={() => pickChapter(ci)}
              >
                <Portrait ch={h} size={46} locked={!unlocked} />
                <span className="ct-text">
                  <small>{c.anyHero ? 'Finale' : `Chapter ${ci + 1}`}</small>
                  <b>{unlocked ? c.title : '???'}</b>
                  <span className="muted">
                    {unlocked ? (
                      <>
                        {done}/{req.length} · ★ {st}/{c.nodes.length * 3}
                      </>
                    ) : (
                      `Finish ${getCharacter(c.requires ?? STORY[ci - 1]?.hero ?? 'ember').name}'s chapter`
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="chapter-view" style={{ '--accent': hero.palette.primary } as React.CSSProperties}>
          <div className="cv-head">
            <h3>{chap.anyHero ? `Finale: ${chap.title}` : `${hero.name}: ${chap.title}`}</h3>
            {chap.unlocks && (
              <span className="muted">
                Reward: {save.unlocked.includes(chap.unlocks) ? getCharacter(chap.unlocks).name : 'a new mage'}
              </span>
            )}
          </div>
          {chap.anyHero && (
            <div className="hero-pick">
              <span className="muted">Play as:</span>
              {CHARACTERS.filter((c) => save.unlocked.includes(c.id)).map((c) => (
                <button
                  key={c.id}
                  className={`hero-pick-btn ${c.id === hero.id ? 'on' : ''}`}
                  style={{ '--accent': c.palette.primary } as React.CSSProperties}
                  onClick={() => onHero(c.id)}
                  title={`${c.name} ${c.title}`}
                  aria-pressed={c.id === hero.id}
                >
                  <Portrait ch={c} size={38} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="node-path">
            {chap.nodes.map((n, i) => {
              const isCleared = save.storyCleared.includes(n.id);
              const isOpen = nodeOpen(save, chap, i);
              const isNext = next?.node.id === n.id;
              return (
                <button
                  key={n.id}
                  className={`path-node k-${n.kind} ${n.optional ? 'optional' : ''} ${isCleared ? 'cleared' : ''} ${isOpen ? '' : 'locked'} ${isNext ? 'next' : ''} ${n.id === node.id ? 'sel' : ''}`}
                  onClick={() => setNodeId(n.id)}
                >
                  <span className="pn-icon">{isOpen ? NODE_ICON[n.kind] : '🔒'}</span>
                  <span className="pn-title">{n.optional ? 'Challenge' : NODE_KIND[n.kind]}</span>
                  {isCleared ? <Stars n={save.storyStars[n.id] ?? 1} size={12} /> : <span className="pn-gap" />}
                </button>
              );
            })}
          </div>

          <div className="node-card">
            <div className="nc-head">
              <span className="nc-kind">
                {NODE_ICON[node.kind]} {node.optional ? 'Optional challenge' : NODE_KIND[node.kind]}
              </span>
              {save.storyCleared.includes(node.id) && <Stars n={save.storyStars[node.id] ?? 1} size={20} />}
            </div>
            <h3>{node.title}</h3>
            {node.kind === 'lesson' ? (
              <>
                <p className="muted">A puzzle with a fixed board and a few moves.</p>
                <ul className="nc-goals">
                  {['Complete the lesson', 'Finish every stage', 'No hints'].map((text, i) => {
                    const met = goalMet(save, node.id, i);
                    return (
                      <li key={text} className={met ? 'met' : ''}>
                        {met ? '★' : '☆'} {text}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <>
                {node.kind === 'gauntlet' ? (
                  <div className="nc-waves">
                    {node.waves.map((w, i) => (
                      <div key={i} className="nc-foe">
                        <span className={w.echo ? 'echo-portrait' : ''}>
                          <Portrait ch={getCharacter(w.opponent)} size={44} />
                        </span>
                        <div>
                          <b>{w.echo ? `Echo of ${getCharacter(w.opponent).name}` : getCharacter(w.opponent).name}</b>
                          <div className="muted">{AI_LEVELS[w.aiLevel].name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="nc-foe">
                    <span className={node.echo ? 'echo-portrait' : ''}>
                      <Portrait ch={getCharacter(node.opponent)} size={54} locked={!!node.mystery} />
                    </span>
                    <div>
                      <b>{node.mystery?.name ?? (node.echo ? `Echo of ${getCharacter(node.opponent).name}` : getCharacter(node.opponent).name)}</b>
                      <div className="muted">
                        {node.mystery ? '???' : AI_LEVELS[node.aiLevel].name}
                        {node.opponentHp && node.opponentHp !== 250 && !node.mystery ? ` · ${node.opponentHp} HP` : ''}
                        {node.playerHp && node.playerHp !== 250 ? ` · you: ${node.playerHp} HP` : ''}
                      </div>
                    </div>
                  </div>
                )}
                {node.twist && <p className="nc-twist">{node.twist}</p>}
                <ul className="nc-goals">
                  {[node.kind === 'survival' ? 'Survive' : 'Win', ...node.goals.map((g) => g.text)].map((text, i) => {
                    const met = goalMet(save, node.id, i);
                    return (
                      <li key={text} className={met ? 'met' : ''} title={met ? 'Earned' : 'Not earned yet'}>
                        {met ? '★' : '☆'} {text}
                      </li>
                    );
                  })}
                </ul>
                {save.storyBest[node.id] !== undefined && node.kind !== 'survival' && (
                  <div className="muted">Best time {formatTime(save.storyBest[node.id])}</div>
                )}
              </>
            )}
            <button className="btn" disabled={!open} onClick={() => onPlay(chap, node)}>
              {!open ? '🔒 Locked' : save.storyCleared.includes(node.id) ? '↻ Replay' : '▶ Play'}
            </button>
          </div>
        </div>
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
          <Toggle label="Quick chat" desc="Preset messages in online matches (keys 1-8)." on={st.quickChat} onChange={(v) => set({ quickChat: v })} />
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
      <RecordRow label="Online" rec={st.pvp} />
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
  /** Extra live content under the buttons (e.g. friend rematch status). */
  extra?: ReactNode;
  /** Story: stars earned and which goals were met. */
  stars?: { earned: number; goals: { text: string; ok: boolean }[] };
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
      {info.stars && (
        <div className="result-stars">
          <div className="rs-big">
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < info.stars!.earned ? 'on' : ''} style={{ animationDelay: `${0.25 + i * 0.22}s` }}>
                ★
              </span>
            ))}
          </div>
          <ul>
            {info.stars.goals.map((g) => (
              <li key={g.text} className={g.ok ? 'ok' : ''}>
                {g.ok ? '★' : '☆'} {g.text}
              </li>
            ))}
          </ul>
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
      {info.extra}
    </div>
  );
}

