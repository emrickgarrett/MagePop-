import { getCharacter } from '@magepop/core';
import { Portrait } from '../components/Hud';
import { equippedFrame, myBoardTheme, nextReward, rewardUnlocked, STAR_REWARDS, StarReward } from '../game/rewards';
import {
  DIFFICULTY_ORDER,
  SaveData,
  Settings,
  STORY_DIFFICULTY,
  storyHeroFor,
  storyStarsEarned,
  storyStarsOn,
  TOTAL_STARS_ALL_DIFFICULTIES,
} from '../game/save';
import { boardImagePath } from '../game/themes';
import { ScreenFrame, Stars } from './Menus';

/** Story stars → cosmetics. Pick a portrait frame and a board background for your side. */
export function RewardsScreen({ save, onBack, onEquip }: { save: SaveData; onBack: () => void; onEquip: (patch: Partial<Settings>) => void }) {
  const stars = storyStarsEarned(save);
  const next = nextReward(save);
  const hero = getCharacter(storyHeroFor(save));
  const frame = equippedFrame(save);
  const boardPicked = save.settings.boardSkin && myBoardTheme(save, '') === save.settings.boardSkin ? save.settings.boardSkin : null;

  const isEquipped = (r: StarReward) => (r.kind === 'frame' ? frame === r.frame : boardPicked === r.board);
  const toggle = (r: StarReward) => {
    if (r.kind === 'frame') onEquip({ frame: isEquipped(r) ? null : r.frame });
    else onEquip({ boardSkin: isEquipped(r) ? null : r.board });
  };

  return (
    <ScreenFrame title="Star Rewards" onBack={onBack}>
      <div className="rewards">
        <div className="rewards-head">
          <Portrait ch={hero} size={72} frame={frame} />
          <div className="rh-stars">
            <Stars n={3} size={18} /> {stars}/{TOTAL_STARS_ALL_DIFFICULTIES}
          </div>
          <div className="rh-next muted">
            {next ? (
              <>
                Next: <b>{next.name}</b> at {next.stars} stars ({next.stars - stars} to go). Stars count on every difficulty, and a clear on a harder one earns
                the easier ones too.
              </>
            ) : (
              'Every reward unlocked. You found every star!'
            )}
            <div>{DIFFICULTY_ORDER.map((d) => `${STORY_DIFFICULTY[d].label} ${storyStarsOn(save, d)}`).join(' · ')}</div>
            <div>
              Frame: <b>{frame ? STAR_REWARDS.find((r) => r.kind === 'frame' && r.frame === frame)?.name : 'None'}</b> · Board:{' '}
              <b>{boardPicked ? STAR_REWARDS.find((r) => r.kind === 'board' && r.board === boardPicked)?.name : "Your mage's own"}</b>
            </div>
          </div>
        </div>
        <div className="rewards-grid">
          {STAR_REWARDS.map((r) => {
            const owned = rewardUnlocked(save, r);
            const on = owned && isEquipped(r);
            return (
              <div key={r.id} className={`reward-card ${owned ? '' : 'locked'} ${on ? 'equipped' : ''}`}>
                {r.kind === 'frame' ? (
                  <div className="reward-preview">
                    <Portrait ch={hero} size={80} frame={r.frame} />
                  </div>
                ) : (
                  <div className="reward-board" style={{ backgroundImage: `url(${boardImagePath(r.board)})` }} />
                )}
                <b>{r.name}</b>
                <span className="rc-need">{owned ? (r.kind === 'frame' ? 'Portrait frame' : 'Board for your side') : `🔒 ${r.stars} stars`}</span>
                <button className={`btn small ${on ? '' : 'ghost'}`} disabled={!owned} onClick={() => toggle(r)}>
                  {on ? 'Equipped ✓' : 'Equip'}
                </button>
              </div>
            );
          })}
        </div>
        <p className="muted">Cosmetics only change how your side looks to you. They never affect gameplay.</p>
      </div>
    </ScreenFrame>
  );
}
