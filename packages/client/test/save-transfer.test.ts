import { describe, expect, it } from 'vitest';
import { exportSave, importSave, loadSave } from '../src/game/save';

describe('save export / import', () => {
  it('round-trips a save', () => {
    const s = {
      ...loadSave(),
      storyCleared: ['ember-first-spark'],
      unlocked: ['ember', 'rime'],
    };
    const back = importSave(exportSave(s));
    expect(back.storyCleared).toEqual(['ember-first-spark']);
    expect(back.unlocked).toContain('rime');
    expect(back.settings).toEqual(s.settings);
  });

  it('fills in fields missing from a partial save', () => {
    const back = importSave(
      JSON.stringify({
        game: 'magepop-save',
        format: 1,
        save: { storyCleared: ['x'] },
      }),
    );
    expect(back.storyCleared).toEqual(['x']);
    expect(back.history).toEqual([]);
    expect(back.unlocked.length).toBeGreaterThan(0);
  });

  it('rejects files that are not MagePop saves', () => {
    expect(() => importSave('not json')).toThrow(/isn't a MagePop save/);
    expect(() => importSave('{"hello":1}')).toThrow(/isn't a MagePop save/);
    expect(() => importSave('null')).toThrow(/isn't a MagePop save/);
    expect(() => importSave(JSON.stringify({ game: 'magepop-save', save: [] }))).toThrow(/damaged/);
    expect(() => importSave(JSON.stringify({ game: 'magepop-save', save: { unlocked: 'all' } }))).toThrow(/damaged/);
    expect(() => importSave('x'.repeat(2_000_001))).toThrow();
  });
});
