import { CharacterDef } from './types';

/**
 * Launch roster. Every number here is a first-pass guess — run `npm run sim` to see
 * bot-vs-bot win rates and tune from there.
 *
 * Scale reference: 100 HP each, a basic 3-match hits for 3.
 * Active (4-match) spells are worth ~8-12 HP of value, ultimates (5+) ~18-28.
 */
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'ember',
    name: 'Ember',
    title: 'the Pyromancer',
    role: 'Burst damage · Burn',
    blurb: 'A hot-headed prodigy who solves every problem with a fireball. Hits hard and fast, burns what she can\'t smash.',
    palette: { primary: '#ff5a36', secondary: '#ffb347' },
    sigil: '✶',
    spells: {
      ruby: {
        active: { name: 'Fireball', effects: [{ kind: 'damage', amount: 11 }], flavor: 'The classic.' },
        ultimate: { name: 'Meteor', effects: [{ kind: 'damage', amount: 24 }], flavor: 'The sky is falling. On you.' },
      },
      topaz: {
        active: { name: 'Ignite', effects: [{ kind: 'poison', perSecond: 2, matches: 3, maxMs: 12000, label: 'Burn' }] },
        ultimate: {
          name: 'Wildfire',
          effects: [
            { kind: 'damage', amount: 6 },
            { kind: 'poison', perSecond: 3, matches: 5, maxMs: 16000, label: 'Burn' },
          ],
        },
      },
      amethyst: {
        active: { name: 'Scorch', effects: [{ kind: 'destroy', count: 5, damagePerGem: 1 }], flavor: 'Burns holes in their plans.' },
        ultimate: { name: 'Firestorm', effects: [{ kind: 'destroy', count: 12, damagePerGem: 1 }, { kind: 'damage', amount: 6 }] },
      },
      sapphire: {
        active: { name: 'Heat Shield', effects: [{ kind: 'shield', amount: 7 }] },
        ultimate: { name: 'Phoenix Mantle', effects: [{ kind: 'shield', amount: 12 }, { kind: 'empower', mult: 1.5, charges: 1 }] },
      },
      emerald: {
        active: { name: 'Warmth', effects: [{ kind: 'heal', amount: 6 }] },
        ultimate: { name: 'Rekindle', effects: [{ kind: 'heal', amount: 14 }] },
      },
    },
  },
  {
    id: 'rime',
    name: 'Rime',
    title: 'the Cryomancer',
    role: 'Freeze · Stall · Shatter',
    blurb: 'Patient and cold as a glacier. Locks down your board, then shatters the ice for a payday.',
    palette: { primary: '#5cc8ff', secondary: '#c9f0ff' },
    sigil: '❄',
    spells: {
      sapphire: {
        active: { name: 'Flash Freeze', effects: [{ kind: 'freeze', count: 5, durationMs: 8000 }] },
        ultimate: { name: 'Deep Freeze', effects: [{ kind: 'freeze', count: 10, durationMs: 12000 }, { kind: 'stun', durationMs: 1000 }] },
      },
      topaz: {
        active: { name: 'Shatter', effects: [{ kind: 'shatter', damagePerGem: 3, minDamage: 6 }], flavor: 'Breaks every frozen gem on their board.' },
        ultimate: { name: 'Avalanche', effects: [{ kind: 'shatter', damagePerGem: 4, minDamage: 12 }, { kind: 'damage', amount: 6 }] },
      },
      ruby: {
        active: { name: 'Ice Shard', effects: [{ kind: 'damage', amount: 10 }] },
        ultimate: { name: 'Glacial Spike', effects: [{ kind: 'damage', amount: 20 }, { kind: 'freeze', count: 4, durationMs: 8000 }] },
      },
      emerald: {
        active: { name: 'Frost Armor', effects: [{ kind: 'shield', amount: 9 }] },
        ultimate: { name: 'Permafrost', effects: [{ kind: 'shield', amount: 18 }, { kind: 'cleanse' }] },
      },
      amethyst: {
        active: { name: 'Chill', effects: [{ kind: 'stun', durationMs: 1500 }] },
        ultimate: { name: 'Absolute Zero', effects: [{ kind: 'stun', durationMs: 3200 }, { kind: 'freeze', count: 4, durationMs: 9000 }] },
      },
    },
  },
  {
    id: 'briar',
    name: 'Briar',
    title: 'the Wildwarden',
    role: 'Healing · Regen · Entangle',
    blurb: 'Keeper of the old grove. Outlasts anyone, and her vines turn your gems to stone.',
    palette: { primary: '#4cd97b', secondary: '#c3f5a0' },
    sigil: '❀',
    spells: {
      emerald: {
        active: { name: 'Mend', effects: [{ kind: 'heal', amount: 8 }] },
        ultimate: { name: 'Full Bloom', effects: [{ kind: 'heal', amount: 18 }, { kind: 'cleanse' }] },
      },
      sapphire: {
        active: { name: 'Regrowth', effects: [{ kind: 'regen', perSecond: 1.5, durationMs: 8000 }] },
        ultimate: { name: 'Spring Rain', effects: [{ kind: 'regen', perSecond: 2.5, durationMs: 12000 }, { kind: 'heal', amount: 5 }] },
      },
      ruby: {
        active: { name: 'Thorn Lash', effects: [{ kind: 'damage', amount: 8 }] },
        ultimate: { name: 'Bramble Storm', effects: [{ kind: 'multiHit', hits: 4, amount: 5 }] },
      },
      topaz: {
        active: { name: 'Barkskin', effects: [{ kind: 'shield', amount: 8 }] },
        ultimate: { name: 'Ironbark', effects: [{ kind: 'shield', amount: 16 }, { kind: 'cleanse' }] },
      },
      amethyst: {
        active: { name: 'Entangle', effects: [{ kind: 'petrify', count: 3 }] },
        ultimate: { name: 'Overgrowth', effects: [{ kind: 'petrify', count: 6 }, { kind: 'damage', amount: 5 }] },
      },
    },
  },
  {
    id: 'nyx',
    name: 'Nyx',
    title: 'the Hexweaver',
    role: 'Poison · Drain · Curse',
    blurb: 'Smiles sweetly while you wither. Poisons stack up, then her Toxic Burst cashes them in.',
    palette: { primary: '#b26bff', secondary: '#ff7ad9' },
    sigil: '☾',
    spells: {
      amethyst: {
        active: { name: 'Venom', effects: [{ kind: 'poison', perSecond: 2.5, matches: 4, maxMs: 14000, label: 'Poison' }] },
        ultimate: { name: 'Plague', effects: [{ kind: 'poison', perSecond: 3.5, matches: 6, maxMs: 18000, label: 'Poison' }] },
      },
      ruby: {
        active: { name: 'Siphon', effects: [{ kind: 'drain', amount: 8 }] },
        ultimate: { name: 'Soul Feast', effects: [{ kind: 'drain', amount: 18 }] },
      },
      emerald: {
        active: { name: 'Toxic Burst', effects: [{ kind: 'damageIfPoisoned', amount: 5, bonus: 6 }] },
        ultimate: { name: 'Necrotic Bloom', effects: [{ kind: 'damageIfPoisoned', amount: 10, bonus: 12 }] },
      },
      topaz: {
        active: { name: 'Hex', effects: [{ kind: 'petrify', count: 3 }] },
        ultimate: { name: 'Medusa\'s Gaze', effects: [{ kind: 'petrify', count: 5 }, { kind: 'stun', durationMs: 1200 }] },
      },
      sapphire: {
        active: { name: 'Night Veil', effects: [{ kind: 'shield', amount: 6 }, { kind: 'cleanse' }] },
        ultimate: { name: 'Eclipse', effects: [{ kind: 'shield', amount: 12 }, { kind: 'cleanse' }, { kind: 'empower', mult: 1.5, charges: 1 }] },
      },
    },
  },
  {
    id: 'volt',
    name: 'Volt',
    title: 'the Stormcaller',
    role: 'Stun · Empower · Board control',
    blurb: 'Wired, loud, and impossible to keep up with. Stuns you, charges up, and rewires her own board for combos.',
    palette: { primary: '#ffd93b', secondary: '#7ae0ff' },
    sigil: 'ϟ',
    spells: {
      topaz: {
        active: { name: 'Spark', effects: [{ kind: 'damage', amount: 8 }] },
        ultimate: { name: 'Chain Lightning', effects: [{ kind: 'multiHit', hits: 3, amount: 7 }] },
      },
      sapphire: {
        active: { name: 'Static Shock', effects: [{ kind: 'stun', durationMs: 1200 }, { kind: 'damage', amount: 2 }] },
        ultimate: { name: 'Thunderclap', effects: [{ kind: 'stun', durationMs: 2400 }, { kind: 'damage', amount: 6 }] },
      },
      ruby: {
        active: { name: 'Overcharge', effects: [{ kind: 'empower', mult: 1.5, charges: 1 }, { kind: 'damage', amount: 3 }] },
        ultimate: { name: 'Supercell', effects: [{ kind: 'empower', mult: 1.6, charges: 2 }, { kind: 'damage', amount: 5 }] },
      },
      amethyst: {
        active: { name: 'Polarity', effects: [{ kind: 'convert', count: 4, to: 'topaz' }], flavor: 'Rewires your own gems into Topaz.' },
        ultimate: { name: 'Magnetic Storm', effects: [{ kind: 'convert', count: 7, to: 'topaz' }, { kind: 'damage', amount: 4 }] },
      },
      emerald: {
        active: { name: 'Recharge', effects: [{ kind: 'heal', amount: 5 }, { kind: 'shield', amount: 4 }] },
        ultimate: { name: 'Power Surge', effects: [{ kind: 'heal', amount: 11 }, { kind: 'shield', amount: 8 }] },
      },
    },
  },
];

export const CHARACTER_BY_ID: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

export function getCharacter(id: string): CharacterDef {
  const c = CHARACTER_BY_ID[id];
  if (!c) throw new Error(`Unknown character ${id}`);
  return c;
}

export const STARTER_CHARACTER = 'ember';
