import { aiLevel, BattleRules, CHARACTERS, DialogueLine, FightSummary, GemColor, getCharacter, LESSONS, RULES, ServerMessage, StoryChapter, StoryNode } from '@magepop/core';
import { useEffect, useRef, useState } from 'react';
import { audio, MusicTrack } from './game/audio';
import { BattleController, BattleResult, BattleSetup } from './game/BattleController';
import { isDesktop, quitApp } from './game/platform';
import {
  addHistory,
  clearStoryNode,
  STORY_DIFFICULTY,
  StoryDifficulty,
  formatTime,
  loadSave,
  MatchMode,
  MatchRecord,
  recordMatch,
  resetProgress,
  SaveData,
  Settings,
  storyHeroFor,
  writeSave,
} from './game/save';
import { BattleScreen } from './screens/BattleScreen';
import { PuzzleScreen } from './screens/PuzzleScreen';
import { FriendRematch, MultiplayerLobby } from './screens/Multiplayer';
import { ResultChat } from './components/QuickChat';
import { NetBattleController, pvp } from './game/pvp';
import { AchievementsScreen, AchievementToasts, Toast, toastsFor } from './screens/Achievements';
import { evaluateAchievements } from './game/achievements';
import { MatchHistory } from './screens/MatchHistory';
import { CharacterSelect, Collection, DialogueScreen, MainMenu, ResultInfo, ResultScreen, SettingsScreen, StoryMap } from './screens/Menus';

type Screen =
  | { name: 'menu' }
  | { name: 'story' }
  | { name: 'collection' }
  | { name: 'pvp'; autoQueue?: boolean }
  | { name: 'settings' }
  | { name: 'select'; mode: 'quick' | 'endless' }
  | {
      name: 'dialogue';
      lines: DialogueLine[];
      title?: string;
      theme?: string;
      then: () => void;
      music?: MusicTrack;
    }
  | {
      name: 'battle';
      setup: BattleSetup;
      header: string;
      /** For stats and match history. */
      mode: MatchMode;
      detail: string;
      /** Endless wave number. */
      wave?: number;
      /** Online: the opponent's display name and a controller fed by the server. */
      opponentName?: string;
      makeController?: (onEnd: (r: BattleResult) => void) => BattleController;
      spotlight?: GemColor[];
      /** Label on the opponent's panel (e.g. ECHO). */
      opponentTag?: string;
      onEnd: (r: BattleResult) => void;
      music: MusicTrack;
    }
  | { name: 'history'; mage?: string; from?: 'collection' }
  | { name: 'achievements' }
  | { name: 'result'; info: ResultInfo }
  | { name: 'puzzle'; title: string; hero: string; lesson: string; onDone: (r: { hintsUsed: number }) => void };

/** Each mage's battle music; mages without a track yet (the Hollow) borrow the Endless theme. */
const THEMED_MUSIC = new Set(['ember', 'rime', 'briar', 'nyx', 'volt']);
const battleTheme = (championId: string): MusicTrack => (THEMED_MUSIC.has(championId) ? (`battle-${championId}` as MusicTrack) : 'endless');

/** Which music each screen plays. */
function musicFor(s: Screen): MusicTrack {
  switch (s.name) {
    case 'battle':
      return s.music;
    case 'dialogue':
      return s.music ?? 'story';
    case 'story':
    case 'puzzle':
      return 'story';
    case 'result':
      return s.info.won ? 'victory' : 'defeat';
    default:
      return 'menu';
  }
}

const newSeed = () => (Math.random() * 2 ** 32) >>> 0;

function statsOf(r: BattleResult): ResultInfo['stats'] {
  const me = r.state.players[0].stats;
  return [
    {
      label: 'Time',
      value: `${Math.floor(r.durationMs / 60000)}:${String(Math.floor((r.durationMs % 60000) / 1000)).padStart(2, '0')}`,
    },
    { label: 'Damage dealt', value: String(me.damageDealt) },
    { label: 'Spells cast', value: String(me.spells) },
    { label: 'Ultimates', value: String(me.ultimates) },
    { label: 'Best combo', value: `x${me.biggestCombo}` },
    { label: 'Healed', value: String(me.healed) },
  ];
}

function historyEntry(screen: Extract<Screen, { name: 'battle' }>, r: BattleResult, result: MatchRecord['result']): MatchRecord {
  const [me, foe] = r.state.players;
  return {
    at: Date.now(),
    mode: screen.mode,
    detail: screen.detail,
    player: screen.setup.player,
    opponent: screen.setup.opponent,
    opponentName: screen.opponentName,
    level: screen.mode === 'pvp' ? undefined : screen.setup.aiLevel.name,
    levelId: screen.mode === 'pvp' ? undefined : screen.setup.aiLevel.id,
    result,
    durationMs: Math.round(r.state.time),
    damageDealt: me.stats.damageDealt,
    damageTaken: foe.stats.damageDealt,
    spells: me.stats.spells,
    ultimates: me.stats.ultimates,
    biggestCombo: me.stats.biggestCombo,
    healed: me.stats.healed,
    gemMatches: me.stats.matches,
    startHp: r.startHp,
    hpLeft: me.hp,
    lowestHp: r.lowestHp,
    maxHp: me.maxHp,
    wave: screen.wave,
    overkill: me.stats.overkill,
    frozenAndStunned: r.frozenAndStunned,
  };
}

export function App() {
  const [save, setSaveState] = useState<SaveData>(loadSave);
  // Battle callbacks outlive renders; always read the latest save through this ref.
  const saveRef = useRef(save);
  const setSave = (s: SaveData) => {
    saveRef.current = s;
    setSaveState(s);
  };
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [toasts, setToasts] = useState<Toast[]>([]);

  /** Stamp any newly earned achievements into the save, queue their toasts and save to disk. */
  const unlockAchievements = (s: SaveData, matches: MatchRecord[] = [], catchUp = false): SaveData => {
    const { save: s2, unlocked } = evaluateAchievements(s, matches);
    if (unlocked.length) {
      writeSave(s2);
      // Catching up on an older save (or newly added achievements): one summary toast.
      const batch = catchUp
        ? toastsFor(unlocked, { individually: 0, summaryTitle: `${unlocked.length} achievement${unlocked.length === 1 ? '' : 's'} earned` })
        : toastsFor(unlocked);
      setToasts((t) => [...t, ...batch]);
    }
    return s2;
  };

  // Progress-based achievements (story, roster, Endless, lifetime totals) can change from any save
  // update. On first load this also checks all saved history, so new achievements are retroactive.
  const checkedHistory = useRef(false);
  useEffect(() => {
    const firstCheck = !checkedHistory.current;
    checkedHistory.current = true;
    const s2 = unlockAchievements(save, firstCheck ? save.history : [], firstCheck);
    if (s2 !== save) setSave(s2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save]);
  const menu = () => setScreen({ name: 'menu' });

  useEffect(() => {
    audio.setVolumes(save.settings.musicVolume, save.settings.sfxVolume);
  }, [save.settings.musicVolume, save.settings.sfxVolume]);

  // Battles always restart their theme; other screens keep playing if the track is unchanged.
  useEffect(() => {
    audio.playMusic(musicFor(screen), { restart: screen.name === 'battle' });
  }, [screen]);

  // ---- Story --------------------------------------------------------------
  /** After a story node: save stars, show the result, offer the next node. */
  const finishNode = (chap: StoryChapter, node: StoryNode, res: { stars: number; timeMs: number | null; goals: { text: string; ok: boolean }[] }, r?: BattleResult) => {
    const { save: s2, unlocked, newBest } = clearStoryNode(saveRef.current, node.id, res.timeMs, res.goals.map((g) => g.ok));
    setSave(s2);
    const idx = chap.nodes.indexOf(node);
    // Next required node in this chapter (challenges are optional, so skip past them).
    const nextNode = chap.nodes.slice(idx + 1).find((n) => !n.optional);
    const bossDone = node.kind === 'boss';
    const showResult = () =>
      setScreen({
        name: 'result',
        info: {
          won: true,
          title: node.kind === 'lesson' ? 'Lesson complete!' : node.kind === 'survival' ? 'Survived!' : 'Victory!',
          subtitle:
            (bossDone
              ? chap.anyHero
                ? 'Finale complete! The Fracture is closed.'
                : `${getCharacter(chap.hero).name}'s chapter complete`
              : `${node.title} cleared`) +
            (newBest && res.timeMs !== null ? ` · New best time ${formatTime(res.timeMs)}!` : ''),
          unlocked,
          stars: { earned: res.stars, goals: res.goals },
          stats: r ? statsOf(r) : [],
          actions: [
            ...(nextNode ? [{ label: `Next: ${nextNode.title}`, primary: true, onClick: () => playStory(chap, nextNode) }] : []),
            { label: 'Rematch', onClick: () => playStory(chap, node, true) },
            { label: 'Story map', primary: !nextNode, onClick: () => setScreen({ name: 'story' }) },
          ],
        },
      });
    const skip = saveRef.current.settings.skipReplayDialogue && saveRef.current.storyCleared.includes(node.id);
    if (skip || !node.outro.length) showResult();
    else setScreen({ name: 'dialogue', lines: node.outro, then: showResult, music: 'victory' });
  };

  const playStory = (chapter: StoryChapter, node: StoryNode, rematch = false) => {
    // "Pick any mage" chapters (the finale) play as the mage chosen on the story map.
    const chap = chapter.anyHero ? { ...chapter, hero: storyHeroFor(saveRef.current) } : chapter;
    const hero = getCharacter(chap.hero);
    const skipDialogue = rematch || (saveRef.current.settings.skipReplayDialogue && saveRef.current.storyCleared.includes(node.id));

    const start = () => {
      if (node.kind === 'lesson') {
        setScreen({
          name: 'puzzle',
          title: `${hero.name} · ${node.title}`,
          hero: chap.hero,
          lesson: node.lesson,
          onDone: ({ hintsUsed }) =>
            finishNode(chap, node, {
              stars: hintsUsed === 0 ? 3 : 2,
              timeMs: null,
              goals: [
                { text: 'Complete the lesson', ok: true },
                { text: 'Finish every stage', ok: true },
                { text: 'No hints', ok: hintsUsed === 0 },
              ],
            }),
        });
        return;
      }
      // One battle of this node: a whole fight, or one wave of a gauntlet.
      type Wave = { opponent: string; aiLevel: number; echo?: boolean; opponentHp?: number; rules?: BattleRules };
      const waves: Wave[] = node.kind === 'gauntlet' ? node.waves : [node];
      const fightNode = node.kind === 'gauntlet' ? null : node;
      const foeNameOf = (w: Wave) =>
        fightNode?.mystery?.name ?? (w.echo ? `Echo of ${getCharacter(w.opponent).name}` : getCharacter(w.opponent).name);
      const lose = (r: BattleResult, w: Wave) =>
        setScreen({
          name: 'result',
          info: {
            won: false,
            title: 'Defeated',
            subtitle:
              r.state.ally && r.state.ally.hp <= 0
                ? `The ${node.kind !== 'gauntlet' && node.rules?.protect?.name} fell. Keep it healed!`
                : node.kind === 'survival'
                  ? `${foeNameOf(w)} was too much this time. Hold out a little longer!`
                  : `${foeNameOf(w)} wins this round. Check the spell list and try again!` +
                    (saveRef.current.settings.storyDifficulty !== 'relaxed' ? ' (Too tough? Try Relaxed difficulty on the Story screen.)' : ''),
            stats: statsOf(r),
            actions: [
              { label: 'Rematch', primary: true, onClick: () => playStory(chap, node, true) },
              { label: 'Story map', onClick: () => setScreen({ name: 'story' }) },
            ],
          },
        });

      // Running totals across gauntlet waves (a single fight is a gauntlet of one).
      const fightWave = (i: number, hp: number | undefined, acc: FightSummary | null) => {
        const w = waves[i];
        // Story difficulty: bot skill one level up/down, enemy HP and ally drain scaled (survival foes are untouchable anyway).
        const diff = STORY_DIFFICULTY[saveRef.current.settings.storyDifficulty ?? 'normal'];
        const foeHp = node.kind === 'survival' ? (w.opponentHp ?? RULES.maxHp) : Math.round((w.opponentHp ?? RULES.maxHp) * diff.hp);
        const rules: BattleRules | undefined = w.rules?.protect
          ? { ...w.rules, protect: { ...w.rules.protect, drainPerSec: w.rules.protect.drainPerSec * diff.drain } }
          : w.rules;
        const maxHp: [number, number] = [fightNode?.playerHp ?? RULES.maxHp, foeHp];
        setScreen({
          name: 'battle',
          setup: {
            seed: newSeed(),
            player: chap.hero,
            opponent: w.opponent,
            aiLevel: aiLevel(w.aiLevel + diff.level),
            maxHp,
            hp: hp !== undefined ? [hp, maxHp[1]] : undefined,
            rules,
            echo: w.echo,
            barks: fightNode?.barks,
            mysteryName: fightNode?.mystery?.name,
          },
          header: `Story · ${hero.name} · ${node.title}${waves.length > 1 ? ` · ${i + 1}/${waves.length}` : ''}`,
          mode: 'story',
          detail: node.title,
          opponentTag: fightNode?.mystery ? '???' : w.echo ? 'ECHO' : undefined,
          spotlight: node.spotlight,
          music: battleTheme(node.kind === 'boss' ? w.opponent : chap.hero),
          onEnd: (r) => {
            if (!r.won) return lose(r, w);
            const me = r.state.players[0];
            const total: FightSummary = {
              won: true,
              durationMs: (acc?.durationMs ?? 0) + r.durationMs,
              hpLeft: me.hp,
              maxHp: me.maxHp,
              lowestHp: Math.min(acc?.lowestHp ?? Infinity, r.lowestHp),
              spells: (acc?.spells ?? 0) + me.stats.spells,
              ultimates: (acc?.ultimates ?? 0) + me.stats.ultimates,
              healed: (acc?.healed ?? 0) + me.stats.healed,
              damageDealt: (acc?.damageDealt ?? 0) + me.stats.damageDealt,
            };
            if (i + 1 < waves.length) {
              // Between waves: a breather, some HP back, then the next Echo.
              const heal = Math.round((me.maxHp * (node.kind === 'gauntlet' ? (node.healBetweenPct ?? 15) : 0)) / 100);
              const carried = Math.min(me.maxHp, me.hp + heal);
              const nextFoe = foeNameOf(waves[i + 1]);
              setScreen({
                name: 'result',
                info: {
                  won: true,
                  title: `${i + 1} down, ${waves.length - i - 1} to go!`,
                  subtitle: `HP restored to ${carried}/${me.maxHp}. Next: ${nextFoe}.`,
                  stats: statsOf(r),
                  actions: [
                    { label: `Next: ${nextFoe}`, primary: true, onClick: () => fightWave(i + 1, carried, total) },
                    { label: 'Give up', onClick: () => setScreen({ name: 'story' }) },
                  ],
                },
              });
              return;
            }
            const goals = [
              { text: node.kind === 'survival' ? 'Survive' : 'Win', ok: true },
              ...node.goals.map((g) => ({ text: g.text, ok: g.check(total) })),
            ];
            finishNode(chap, node, { stars: goals.filter((g) => g.ok).length, timeMs: node.kind === 'survival' ? null : total.durationMs, goals }, r);
          },
        });
      };
      fightWave(0, undefined, null);
    };
    if (skipDialogue) start();
    else setScreen({ name: 'dialogue', lines: node.intro, title: `${hero.name} · ${node.title}`, theme: chap.hero, then: start });
  };

  // ---- Online -------------------------------------------------------------
  const playOnline = (found: Extract<ServerMessage, { t: 'matchFound' }>) => {
    const mine = found.state.players[found.you].characterId;
    const name = found.opponent.name;
    const friendly = !!found.friendly;
    setScreen({
      name: 'battle',
      // seed only keys the screen; the server owns the real battle.
      setup: { seed: newSeed(), player: mine, opponent: found.opponent.characterId, aiLevel: aiLevel(0) },
      header: `${friendly ? 'Friend Battle' : 'Online'} · vs ${name} (${getCharacter(found.opponent.characterId).name})`,
      mode: 'pvp',
      detail: friendly ? 'Friend battle' : 'Online',
      opponentName: name,
      music: battleTheme(mine),
      makeController: (onEnd) => new NetBattleController(pvp, found, onEnd),
      onEnd: (r) => {
        const draw = r.state.winner === null && r.reason === 'timeout';
        const why: Record<string, string> = r.won
          ? { ko: `You beat ${name}!`, forfeit: `${name} forfeited.`, disconnect: `${name} disconnected.`, timeout: "Time's up, and you had more HP." }
          : { ko: `${name} wins this round.`, disconnect: 'You lost connection to the match.', timeout: "Time's up, and they had more HP.", forfeit: 'You forfeited.' };
        const cancelled = r.reason === 'server';
        setScreen({
          name: 'result',
          info: {
            won: r.won,
            title: cancelled ? 'Match cancelled' : draw ? 'Draw!' : r.won ? 'Victory!' : 'Defeated',
            subtitle: cancelled ? "The server restarted, so this match doesn't count." : draw ? "Time's up with HP tied." : why[r.reason ?? 'ko'],
            stats: statsOf(r),
            actions: [
              friendly
                ? // Friend battles: ask the same friend for another round (starts when both agree).
                  { label: 'Rematch', primary: true, onClick: () => pvp.requestRematch() }
                : { label: 'Rematch', primary: true, onClick: () => setScreen({ name: 'pvp', autoQueue: true }) },
              {
                label: 'Multiplayer',
                onClick: () => {
                  if (friendly) pvp.declineRematch();
                  setScreen({ name: 'pvp' });
                },
              },
              {
                label: 'Main menu',
                onClick: () => {
                  pvp.close();
                  menu();
                },
              },
            ],
            extra: (
              <>
                {!cancelled && saveRef.current.settings.quickChat && <ResultChat opponent={name} />}
                {friendly && !cancelled && <FriendRematch friend={name} onMatch={playOnline} />}
              </>
            ),
          },
        });
      },
    });
  };

  // ---- Quick --------------------------------------------------------------
  const playQuick = (player: string, opponent: string, level: number) => {
    const lvl = aiLevel(level);
    setScreen({
      name: 'battle',
      setup: { seed: newSeed(), player, opponent, aiLevel: lvl },
      header: `Quick Battle · vs ${getCharacter(opponent).name} (${lvl.name})`,
      mode: 'quick',
      detail: 'Quick Battle',
      music: battleTheme(player),
      onEnd: (r) =>
        setScreen({
          name: 'result',
          info: {
            won: r.won,
            title: r.won ? 'Victory!' : 'Defeated',
            stats: statsOf(r),
            actions: [
              {
                label: 'Rematch',
                primary: true,
                onClick: () => playQuick(player, opponent, level),
              },
              {
                label: 'Change setup',
                onClick: () => setScreen({ name: 'select', mode: 'quick' }),
              },
              { label: 'Main menu', onClick: menu },
            ],
          },
        }),
    });
  };

  // ---- Endless ------------------------------------------------------------
  const playEndless = (player: string, wave: number, hp: number, prev?: string) => {
    const pool = CHARACTERS.map((c) => c.id).filter((id) => id !== prev);
    const opponent = pool[Math.floor(Math.random() * pool.length)];
    const lvl = aiLevel(Math.floor((wave - 1) / 2));
    setScreen({
      name: 'battle',
      setup: {
        seed: newSeed(),
        player,
        opponent,
        aiLevel: lvl,
        hp: [hp, RULES.maxHp],
      },
      header: `Endless · Wave ${wave} · vs ${getCharacter(opponent).name} (${lvl.name})`,
      mode: 'endless',
      detail: `Wave ${wave}`,
      wave,
      music: 'endless',
      onEnd: (r) => {
        if (r.won) {
          const carried = Math.min(RULES.maxHp, r.state.players[0].hp + Math.round(RULES.maxHp * 0.25));
          setScreen({
            name: 'result',
            info: {
              won: true,
              title: `Wave ${wave} cleared!`,
              subtitle: `HP restored to ${carried}/${RULES.maxHp}. Next up: wave ${wave + 1}.`,
              stats: statsOf(r),
              actions: [
                {
                  label: `Continue to wave ${wave + 1}`,
                  primary: true,
                  onClick: () => playEndless(player, wave + 1, carried, opponent),
                },
                {
                  label: 'Cash out',
                  onClick: () => finishEndless(player, wave),
                },
              ],
            },
          });
        } else {
          finishEndless(player, wave - 1, r);
        }
      },
    });
  };

  const finishEndless = (player: string, wavesCleared: number, r?: BattleResult) => {
    const cur = saveRef.current;
    const best = cur.endlessBest;
    const isBest = !best || wavesCleared > best.wave;
    if (isBest && wavesCleared > 0) {
      const s2 = {
        ...cur,
        endlessBest: { wave: wavesCleared, characterId: player },
      };
      writeSave(s2);
      setSave(s2);
    }
    setScreen({
      name: 'result',
      info: {
        won: wavesCleared > 0,
        title: r ? 'Run over' : 'Cashed out',
        subtitle: `${wavesCleared} wave${wavesCleared === 1 ? '' : 's'} cleared${isBest && wavesCleared > 0 ? ' — new best!' : ''}`,
        stats: r ? statsOf(r) : [],
        actions: [
          {
            label: 'Rematch',
            primary: true,
            onClick: () => playEndless(player, 1, RULES.maxHp),
          },
          { label: 'Main menu', onClick: menu },
        ],
      },
    });
  };

  return (
    <>
      {renderScreen()}
      <AchievementToasts toasts={toasts} onDone={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </>
  );

  function renderScreen() {
    switch (screen.name) {
      case 'achievements':
        return <AchievementsScreen save={save} onBack={menu} />;
      case 'menu':
        return (
          <MainMenu
            save={save}
            go={(s) => {
              if (s === 'quick' || s === 'endless') setScreen({ name: 'select', mode: s });
              else setScreen({ name: s } as Screen);
            }}
            onQuit={isDesktop ? quitApp : undefined}
          />
        );
      case 'story':
        return (
          <StoryMap
            save={save}
            onBack={menu}
            onPlay={(c, n) => playStory(c, n)}
            onDifficulty={(d) => {
              const s2 = { ...saveRef.current, settings: { ...saveRef.current.settings, storyDifficulty: d } };
              writeSave(s2);
              setSave(s2);
            }}
            onHero={(id) => {
              const s2 = { ...saveRef.current, settings: { ...saveRef.current.settings, storyHero: id } };
              writeSave(s2);
              setSave(s2);
            }}
          />
        );
      case 'puzzle':
        return (
          <PuzzleScreen
            key={screen.lesson}
            title={screen.title}
            hero={screen.hero}
            stages={LESSONS[screen.lesson]}
            settings={save.settings}
            onDone={screen.onDone}
            onQuit={() => setScreen({ name: 'story' })}
          />
        );
      case 'collection':
        return <Collection save={save} onBack={menu} onHistory={(mage) => setScreen({ name: 'history', mage, from: 'collection' })} />;
      case 'pvp':
        return (
          <MultiplayerLobby
            key={screen.autoQueue ? `auto-${Date.now()}` : 'lobby'}
            save={save}
            autoQueue={screen.autoQueue}
            onBack={() => {
              pvp.close();
              menu();
            }}
            onSettings={(settings) => {
              const s2 = { ...saveRef.current, settings };
              writeSave(s2);
              setSave(s2);
            }}
            onMatch={playOnline}
          />
        );
      case 'history':
        return (
          <MatchHistory save={save} initialMage={screen.mage} onBack={() => (screen.from === 'collection' ? setScreen({ name: 'collection' }) : menu())} />
        );
      case 'settings':
        return (
          <SettingsScreen
            save={save}
            onBack={menu}
            onChange={(settings: Settings) => {
              const s2 = { ...saveRef.current, settings };
              writeSave(s2);
              setSave(s2);
            }}
            onReset={() => setSave(resetProgress(saveRef.current))}
          />
        );
      case 'select':
        return (
          <CharacterSelect
            key={screen.mode}
            save={save}
            mode={screen.mode}
            onBack={menu}
            onStart={(p, o, l) => (screen.mode === 'quick' ? playQuick(p, o, l) : playEndless(p, 1, RULES.maxHp))}
          />
        );
      case 'dialogue':
        return <DialogueScreen key={screen.lines[0]?.text} lines={screen.lines} title={screen.title} theme={screen.theme} onDone={screen.then} />;
      case 'battle':
        return (
          <BattleScreen
            key={screen.setup.seed}
            setup={screen.setup}
            header={screen.header}
            spotlight={screen.spotlight}
            settings={save.settings}
            firstBattle={!save.seenHowToPlay && screen.mode !== 'pvp'}
            makeController={screen.makeController}
            opponentTag={screen.opponentName ?? screen.opponentTag}
            onGuideSeen={() => {
              const s2 = { ...saveRef.current, seenHowToPlay: true };
              writeSave(s2);
              setSave(s2);
            }}
            onEnd={(r) => {
              // Record first: the mode's own handler builds on the latest save.
              const kind = screen.mode === 'pvp' ? 'pvp' : 'bots';
              const cancelled = r.reason === 'server';
              const draw = !r.won && r.state.winner === null && r.reason === 'timeout';
              if (!cancelled) {
                const s2 = draw ? saveRef.current : recordMatch(saveRef.current, screen.setup.player, kind, { won: r.won, durationMs: r.durationMs });
                const rec = historyEntry(screen, r, r.won ? 'win' : draw ? 'draw' : 'loss');
                setSave(unlockAchievements(addHistory(s2, rec), [rec]));
              }
              screen.onEnd(r);
            }}
            onQuit={(r) => {
              const kind = screen.mode === 'pvp' ? 'pvp' : 'bots';
              const s2 = recordMatch(saveRef.current, screen.setup.player, kind, { won: false });
              const rec = historyEntry(screen, r, 'forfeit');
              setSave(unlockAchievements(addHistory(s2, rec), [rec]));
              // Leaving an online match for the menu: hang up (the forfeit has already been sent).
              if (screen.mode === 'pvp') pvp.close();
              menu();
            }}
          />
        );
      case 'result':
        return <ResultScreen info={screen.info} />;
    }
  }
}
