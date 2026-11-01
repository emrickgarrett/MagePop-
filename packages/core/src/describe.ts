import { CharacterDef, Effect, SpellTier } from './types';

const sec = (ms: number) => `${+(ms / 1000).toFixed(1)}s`;

/**
 * Rules text for a spell. Pass the caster so gem references read as that mage's spell names
 * ("Spark gems") instead of colors, since every mage's gems look different.
 */
export function describeEffect(e: Effect, ch?: CharacterDef): string {
  switch (e.kind) {
    case 'damage':
      return `Deal ${e.amount} damage`;
    case 'multiHit':
      return `Strike ${e.hits} times for ${e.amount} damage each`;
    case 'heal':
      return `Heal ${e.amount}`;
    case 'shield':
      return `Gain ${e.amount} shield`;
    case 'drain':
      return `Drain ${e.amount} HP from the opponent`;
    case 'poison':
      return `${e.label ?? 'Poison'}: ${e.perSecond} damage/sec until they make ${e.matches} matches (max ${sec(e.maxMs)}). Ignores shields`;
    case 'regen':
      return `Regenerate ${e.perSecond} HP/sec for ${sec(e.durationMs)}`;
    case 'freeze':
      return `Freeze ${e.count} enemy gems for ${sec(e.durationMs)}`;
    case 'petrify':
      return `Turn ${e.count} enemy gems to stone`;
    case 'hollow':
      return `Hollow out ${e.count} enemy gems (gray and unmatchable until a match next to them breaks them)`;
    case 'destroy':
      return `Destroy ${e.count} enemy gems (${e.damagePerGem} damage each)`;
    case 'shatter':
      return `Shatter all frozen enemy gems: ${e.damagePerGem} damage each (min ${e.minDamage})`;
    case 'stun':
      return `Stun the opponent for ${sec(e.durationMs)}`;
    case 'empower':
      return `Next ${e.charges > 1 ? `${e.charges} damage spells deal` : 'damage spell deals'} x${e.mult} damage`;
    case 'convert':
      return ch
        ? `Turn ${e.count} of your gems into ${ch.spells[e.to].active.name} gems`
        : `Turn ${e.count} of your gems into ${e.to} gems`;
    case 'cleanse':
      return 'Cleanse your poisons, ice and stone';
    case 'damageIfPoisoned':
      return `Deal ${e.amount} damage, +${e.bonus} if they are poisoned or burning`;
  }
}

export function describeSpell(t: SpellTier, ch?: CharacterDef): string {
  return t.effects.map((e) => describeEffect(e, ch)).join('. ') + '.';
}
