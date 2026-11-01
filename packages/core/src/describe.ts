import { COLOR_LABEL, Effect, SpellTier } from './types';

const sec = (ms: number) => `${+(ms / 1000).toFixed(1)}s`;

export function describeEffect(e: Effect): string {
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
    case 'destroy':
      return `Destroy ${e.count} enemy gems (${e.damagePerGem} damage each)`;
    case 'shatter':
      return `Shatter all frozen enemy gems: ${e.damagePerGem} damage each (min ${e.minDamage})`;
    case 'stun':
      return `Stun the opponent for ${sec(e.durationMs)}`;
    case 'empower':
      return `Next ${e.charges > 1 ? `${e.charges} damage spells deal` : 'damage spell deals'} x${e.mult} damage`;
    case 'convert':
      return `Convert ${e.count} of your gems to ${COLOR_LABEL[e.to]}`;
    case 'cleanse':
      return 'Cleanse your poisons, ice and stone';
    case 'damageIfPoisoned':
      return `Deal ${e.amount} damage, +${e.bonus} if they are poisoned or burning`;
  }
}

export function describeSpell(t: SpellTier): string {
  return t.effects.map(describeEffect).join('. ') + '.';
}
