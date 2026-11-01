import { aiLevel, CHARACTERS, DialogueLine, getCharacter, RULES, StoryChapter, StoryFight } from '@magepop/core';
import { useEffect, useRef, useState } from 'react';
import { audio, MusicTrack } from './game/audio';
import { BattleResult, BattleSetup } from './game/BattleController';
import { isDesktop, quitApp } from './game/platform';
import {
  addHistory,
  clearStoryFight,
  formatTime,
  loadSave,
  MatchMode,
  MatchRecord,
  recordMatch,
  resetProgress,
  SaveData,
  Settings,
  writeSave,
} from './game/save';
import { BattleScreen } from './screens/BattleScreen';
import { AchievementsScreen, AchievementToasts, Toast, toastsFor } from './screens/Achievements';
import { evaluateAchievements } from './game/achievements';
import { MatchHistory } from './screens/MatchHistory';
import { CharacterSelect, Collection, DialogueScreen, MainMenu, PvpComingSoon, ResultInfo, ResultScreen, SettingsScreen, StoryMap } from './screens/Menus';

type Screen =
  | { name: 'menu' }
  | { name: 'story' }
  | { name: 'collection' }
  | { name: 'pvp' }
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
      spotlight?: StoryFight['spotlight'];
      onEnd: (r: BattleResult) => void;
      music: MusicTrack;
    }
  | { name: 'history'; mage?: string; from?: 'collection' }
  | { name: 'achievements' }
  | { name: 'result'; info: ResultInfo };

const battleTheme = (championId: string) => `battle-${championId}` as MusicTrack;

/** Which music each screen plays. */
function musicFor(s: Screen): MusicTrack {
  switch (s.name) {
    case 'battle':
      return s.music;
    case 'dialogue':
      return s.music ?? 'story';
    case 'story':
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
  const playStory = (chap: StoryChapter, fight: StoryFight) => {
    const hero = getCharacter(chap.hero);
    const skipDialogue = saveRef.current.settings.skipReplayDialogue && saveRef.current.storyCleared.includes(fight.id);
    const startBattle = () =>
      setScreen({
        name: 'battle',
        setup: {
          seed: newSeed(),
          player: chap.hero,
          opponent: fight.opponent,
          aiLevel: aiLevel(fight.aiLevel),
        },
        header: `Story · ${hero.name} · ${fight.title}`,
        mode: 'story',
        detail: fight.title,
        spotlight: fight.spotlight,
        music: battleTheme(fight.boss ? fight.opponent : chap.hero),
        onEnd: (r) => {
          if (r.won) {
            const { save: s2, unlocked, newBest } = clearStoryFight(saveRef.current, fight.id, r.durationMs);
            setSave(s2);
            const nextIdx = chap.fights.indexOf(fight) + 1;
            const nextFight = chap.fights[nextIdx];
            const showResult = () =>
              setScreen({
                name: 'result',
                info: {
                  won: true,
                  title: 'Victory!',
                  subtitle:
                    (fight.boss ? `${hero.name}'s chapter complete` : `${fight.title} cleared`) +
                    (newBest ? ` · New best time ${formatTime(r.durationMs)}!` : ''),
                  unlocked,
                  stats: statsOf(r),
                  actions: [
                    ...(nextFight
                      ? [
                          {
                            label: `Next: ${nextFight.title}`,
                            primary: true,
                            onClick: () => playStory(chap, nextFight),
                          },
                        ]
                      : []),
                    { label: 'Rematch', onClick: () => startBattle() },
                    {
                      label: 'Story map',
                      primary: !nextFight,
                      onClick: () => setScreen({ name: 'story' }),
                    },
                  ],
                },
              });
            if (skipDialogue) showResult();
            else
              setScreen({
                name: 'dialogue',
                lines: fight.outro,
                then: showResult,
                music: 'victory',
              });
          } else {
            setScreen({
              name: 'result',
              info: {
                won: false,
                title: 'Defeated',
                subtitle: `${getCharacter(fight.opponent).name} wins this round. Check the spell list and try again!`,
                stats: statsOf(r),
                actions: [
                  {
                    label: 'Rematch',
                    primary: true,
                    onClick: () => startBattle(),
                  },
                  {
                    label: 'Story map',
                    onClick: () => setScreen({ name: 'story' }),
                  },
                ],
              },
            });
          }
        },
      });
    if (skipDialogue) startBattle();
    else
      setScreen({
        name: 'dialogue',
        lines: fight.intro,
        title: `${hero.name} · ${fight.title}`,
        theme: chap.hero,
        then: startBattle,
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
        return <StoryMap save={save} onBack={menu} onPlay={playStory} />;
      case 'collection':
        return <Collection save={save} onBack={menu} onHistory={(mage) => setScreen({ name: 'history', mage, from: 'collection' })} />;
      case 'pvp':
        return <PvpComingSoon onBack={menu} />;
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
            firstBattle={!save.seenHowToPlay}
            onGuideSeen={() => {
              const s2 = { ...saveRef.current, seenHowToPlay: true };
              writeSave(s2);
              setSave(s2);
            }}
            onEnd={(r) => {
              // Record first: the mode's own handler builds on the latest save.
              const kind = screen.mode === 'pvp' ? 'pvp' : 'bots';
              const s2 = recordMatch(saveRef.current, screen.setup.player, kind, { won: r.won, durationMs: r.durationMs });
              const rec = historyEntry(screen, r, r.won ? 'win' : 'loss');
              setSave(unlockAchievements(addHistory(s2, rec), [rec]));
              screen.onEnd(r);
            }}
            onQuit={(r) => {
              const kind = screen.mode === 'pvp' ? 'pvp' : 'bots';
              const s2 = recordMatch(saveRef.current, screen.setup.player, kind, { won: false });
              const rec = historyEntry(screen, r, 'forfeit');
              setSave(unlockAchievements(addHistory(s2, rec), [rec]));
              menu();
            }}
          />
        );
      case 'result':
        return <ResultScreen info={screen.info} />;
    }
  }
}
