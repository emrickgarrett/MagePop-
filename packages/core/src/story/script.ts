/**
 * The story's visual-novel scenes: what's said before and after every story node.
 * Approved script: claude/MagePop-Story-Script.md in the project.
 *
 * Each line picks a speaker, an expression and optionally a background, a staging effect or a
 * portrait variant. Chapter files pull their scenes in with scene('<node id>').
 */
import { GemColor } from '../types';
import { DialogueLine, Expression } from './types';

type Opts = Partial<Omit<DialogueLine, 'speaker' | 'text' | 'expr'>>;
const say =
  (speaker: string) =>
  (expr: Expression, text: string, o: Opts = {}): DialogueLine => ({ speaker, expr, text, ...o });

const ember = say('ember');
const rime = say('rime');
const briar = say('briar');
const nyx = say('nyx');
const volt = say('volt');
const hollow = say('hollow');
const n = (text: string, o: Opts = {}): DialogueLine => ({ speaker: 'narrator', text, ...o });
const guide = (text: string, gem?: GemColor): DialogueLine => ({ speaker: 'guide', text, ...(gem ? { gem } : {}) });
/** The mage the player picked (finale): one line per mage. */
const hero = (expr: Expression, heroText: Record<string, string>, o: Opts = {}): DialogueLine => ({
  speaker: 'hero',
  expr,
  text: heroText.ember,
  heroText,
  ...o,
});

export interface Scene {
  intro: DialogueLine[];
  outro: DialogueLine[];
}

const SCRIPT: Record<string, Scene> = {
  // ---------------------------------------------------------------- Chapter 1: Ember
  'ember-first-spark': {
    intro: [
      n('The Academy of Gems. Every spring, hopefuls line up at its gates. Every spring, most go home.', { bg: 'gate' }),
      ember('happy', "Not me. I've been practicing fireballs since I was six."),
      ember('neutral', "Mostly on my uncle's hedges. He has fewer hedges now."),
      ember('surprised', "Wait, there's a written part? Nobody said there was a written part."),
      n("There isn't. Just the basics, first."),
      guide('Gems are magic. Match them, and they answer.'),
    ],
    outro: [ember('happy', 'Fireball, Meteor, cascades. Easy. Where do I sign up?', { bg: 'gate' })],
  },
  'ember-trial': {
    intro: [
      n('The Trial Arena hums with a hundred voices. Two boards glow in the center.', { bg: 'arena' }),
      volt('happy', "Hi! Hi. You're my trial? Cool! I'm Volt. I'm fast. That's the whole introduction."),
      ember('happy', "Ember. I'm on fire. Usually on purpose."),
      volt('happy', "Ha! Okay, I'll go easy on you. Mostly. Like, forty percent."),
      ember('angry', "Don't you dare go easy on me."),
      volt('surprised', '...Okay, a hundred percent then. Your funeral! Nice funeral. Lots of sparks.'),
      guide('Each mage has her own board. Wear the other one down before she wears you down.'),
      guide('Topaz casts Ignite: a burn that hurts every second until your opponent makes enough matches.', 'topaz'),
      ember('happy', 'Burn and blast. My kind of plan.'),
    ],
    outro: [
      volt('surprised', "Okay, OKAY, you're good. That was like ninety seconds of pure rude.", { bg: 'arena' }),
      ember('happy', 'Thank you.'),
      volt('neutral', 'Hey... did the floor just hum? Like, under the floor?'),
      ember('happy', "That's the sound of me winning."),
      n('Far below, something answers the hum. Nobody in the arena notices.', { fx: 'shake' }),
    ],
  },
  'ember-wild-magic': {
    intro: [
      n('Deep under the Academy beats the Heartstone, the source of all gem magic. Today, it skips a beat.', { bg: 'heartstone-hall', fx: 'flash' }),
      briar('surprised', 'Oh! Did you feel that? The gems flinched.'),
      ember('neutral', "Gems don't flinch. Gems are rocks."),
      briar('sad', 'Rocks remember, sprout. Something is wrong with the Heartstone.'),
      ember('happy', "Or something's wrong with your strategy. Are we dueling or are we talking to rocks?"),
      briar('happy', "Both, if you like. I'm very good at both."),
      guide(
        "Amethyst casts Scorch, which burns holes in your opponent's board. Frozen gems can't be swapped; matching next to them breaks the ice.",
        'amethyst',
      ),
    ],
    outro: [
      briar('happy', 'You fight well. Loud, but well.', { bg: 'heartstone-hall' }),
      briar('neutral', "Those pulses weren't part of any trial, though. Be careful, firebrand."),
      ember('neutral', "It's probably just the instructors being dramatic."),
      ember('sad', '...Right?'),
      briar('sad', "The roots say otherwise. They're cold, and they're never cold."),
    ],
  },
  'ember-hold-the-line': {
    intro: [
      n('Night in the dorm common room. Ember is practicing in front of the fireplace. Badly.', { bg: 'dorm' }),
      ember('angry', 'Defense. Shields. Healing. Who wins a fight by not getting hit?'),
      guide('Offense wins trials. Defense survives them. Shields, healing and ice: learn them now.'),
      ember('neutral', "Fine. But I'm still setting things on fire afterwards."),
    ],
    outro: [ember('happy', 'Shield up, heal up, break the ice. Got it.', { bg: 'dorm' }), ember('neutral', '...Now where were we? Oh, right. Fire.')],
  },
  'ember-first-echo': {
    intro: [
      n('The final trial. The arena goes dark.', { bg: 'arena' }),
      n('When the lights return, a figure stands at the other board. Gray, flickering, with hollow eyes.', { fx: 'flicker' }),
      ember('surprised', "Nyx? No. Nyx doesn't... crackle."),
      nyx('neutral', '...hhh... trial... continues...', { echo: true, name: 'Echo of Nyx' }),
      ember('angry', "Okay, that's creepy. That's a creepy copy of a person."),
      ember('surprised', 'Why is it getting stronger? Why is everybody running?!'),
      guide('This Echo is too strong to beat. Survive 45 seconds, until the instructors arrive.'),
    ],
    outro: [
      n('The Echo shatters into gray dust as the instructors burst in.', { bg: 'arena', fx: 'flash' }),
      ember('surprised', 'What WAS that?'),
      ember('sad', '...And why is everyone looking at me like I did it?'),
      nyx('happy', 'Because, darling, it was wearing my face at your trial.'),
      nyx('neutral', "I'll be honest, I'd have made it prettier."),
      ember('angry', 'Not helping!'),
      nyx('happy', 'I never am. Goodnight, firebrand.'),
    ],
  },
  'ember-glass-cannon': {
    intro: [
      volt('happy', 'Practice round! No shields, tiny health bars. First to blink loses!', { bg: 'arena' }),
      ember('happy', "I don't blink. I burn."),
      volt('surprised', "That's not... how eyes work. Okay go GO GO!"),
    ],
    outro: [volt('sad', 'Rematch.', { bg: 'arena' }), ember('happy', 'No.'), volt('happy', "Rematch later. I'm writing it down.")],
  },
  'ember-boss': {
    intro: [
      n('Snow falls on the frozen fountain. Someone has been waiting.', { bg: 'fountain' }),
      rime('neutral', 'Ember.'),
      ember('neutral', "That's me. Who are you, the welcome committee?"),
      rime('neutral', 'Rime. I keep records. The Echo appeared at your trial. The Heartstone cracked on your first day. Two data points.'),
      ember('angry', "So it's my fault? You think I broke the Heartstone with a fireball?"),
      rime('neutral', 'I think fire breaks things. That is what fire does.'),
      rime('angry', 'Prove me wrong. If you can.'),
      ember('happy', "Oh, I can. I'm going to melt your whole equation."),
    ],
    outro: [
      rime('surprised', '...', { bg: 'fountain' }),
      rime('neutral', 'You fight like someone with nothing to hide. Reckless. Honest. Inefficient.'),
      ember('happy', 'I\'m choosing to hear "honest."'),
      rime('neutral', "Then someone else is doing this. On purpose. And they're good at it."),
      rime('happy', "I'll find out who. You're coming with me, firebrand."),
      ember('surprised', 'Is that... an invitation?'),
      rime('neutral', 'It is an assignment. Try to keep up.'),
    ],
  },

  // ---------------------------------------------------------------- Chapter 2: Rime
  'rime-cold-equation': {
    intro: [
      rime('neutral', 'Ember sets things on fire and hopes. I prefer equations.', { bg: 'fountain' }),
      rime('neutral', 'Freeze their gems. Then shatter the ice for damage. Two moves, one answer.'),
      guide('Freeze, then Shatter: the more ice on their board, the harder it hits.'),
    ],
    outro: [rime('happy', 'Freeze, shatter, strike. Clean. Now: the cracks.', { bg: 'fountain' })],
  },
  'rime-mirror': {
    intro: [
      n('Rime follows a hairline crack across the courtyard to the frozen fountain. Something waits in the ice.', { bg: 'fountain', fx: 'flicker' }),
      rime('surprised', '...That is my face.'),
      ember('surprised', "Whoa. It's you, but gray. And sadder. Somehow sadder."),
      rime('angry', 'An Echo of me. How unflattering.'),
      ember('happy', 'Want me to melt it?'),
      rime('neutral', 'No. If it fights like me, I already know every mistake it will make. I wrote them.'),
      guide('Sapphire casts Flash Freeze. Topaz, Shatter, cashes the ice in.', 'sapphire'),
    ],
    outro: [
      rime('neutral', 'Four percent faster than me. Nine percent less patient. Interesting.', { bg: 'fountain' }),
      ember('surprised', 'You measured that? During the fight?'),
      rime('neutral', "The Echoes aren't random. Each one appears where a crack in the Heartstone reaches the surface."),
      ember('happy', "So we follow the cracks, and we find whoever's making them."),
      rime('happy', "Exactly. You're learning."),
    ],
  },
  'rime-thaw': {
    intro: [
      ember('happy', "If we're hunting Echoes, you need to beat someone who doesn't stand still. Spar with me.", { bg: 'arena' }),
      rime('neutral', 'Your heat melts my ice. That changes the equation.'),
      ember('happy', 'Does it scare the equation?'),
      rime('neutral', 'Nothing scares the equation.'),
      rime('sad', '...It makes it longer.'),
      guide("Your frozen gems melt fast on Ember's board. Ice Shard (ruby) and Chill (amethyst) keep her busy while it holds.", 'amethyst'),
    ],
    outro: [
      ember('happy', 'Okay, that was cold. In a good way. I think?', { bg: 'arena' }),
      rime('happy', 'It was. Thank you for the variable, firebrand.'),
      ember('surprised', 'Was that a compliment? Did Rime just compliment me?'),
      rime('neutral', 'I will deny it.'),
    ],
  },
  'rime-echo-hunt': {
    intro: [
      n('The cracks lead to the greenhouse wing. Frost spreads across the glass. Two gray figures wait among the plants.', { bg: 'greenhouse', fx: 'flicker' }),
      ember('surprised', "Two at once? That's cheating."),
      rime('neutral', "That's arithmetic. Pace yourself. Breathe between them."),
      guide('Frost Armor (emerald) keeps you standing. Your HP carries over between Echoes.', 'emerald'),
    ],
    outro: [
      rime('neutral', "The cracks don't stop here. They run under the grove.", { bg: 'greenhouse' }),
      ember('sad', "Briar's grove. She's going to love hearing that."),
      rime('neutral', "She will not. I'll do the talking."),
      ember('happy', 'You? Talking? To people?'),
      rime('angry', 'I talk to people.'),
      ember('happy', 'You talk at people.'),
    ],
  },
  'rime-frostbitten': {
    intro: [
      volt('happy', "Bet you can't win without freezing anything! Loser buys lunch!", { bg: 'fountain' }),
      rime('neutral', "I calculate a seventy percent chance you'll regret that."),
    ],
    outro: [volt('sad', "...I'll get lunch.", { bg: 'fountain' }), rime('happy', "Soup. Something warm. I'm told that's funny.")],
  },
  'rime-boss': {
    intro: [
      n('The grove is quiet in the wrong way. Frost on the leaves, cracks under the roots.', { bg: 'grove' }),
      briar('angry', 'Frost on my saplings. Cracks under my roots. And here you are, ice queen.'),
      rime('neutral', "I'm following the cracks, not making them. Let me pass, Briar."),
      briar('angry', 'The grove has been crying for three days. Do you know what that sounds like?'),
      rime('sad', '...No.'),
      briar('neutral', 'Then you will listen first. The grove will decide whether you pass.'),
    ],
    outro: [
      briar('sad', "Your ice is cold, but it isn't rotten. I'm sorry, Rime.", { bg: 'grove' }),
      rime('neutral', "Apology accepted. I'd have been angry too. Probably more efficiently."),
      briar('neutral', 'The sickness is something else. Something gray. It tastes like an empty cup.'),
      rime('neutral', 'Then show me where it starts.'),
      briar('happy', "Come, then. Mind the moss. It bites when it's nervous."),
    ],
  },

  // ---------------------------------------------------------------- Chapter 3: Briar
  'briar-deep-roots': {
    intro: [
      briar('happy', "A grove survives by healing faster than it's hurt. So do I.", { bg: 'grove' }),
      briar('neutral', "Mend, Barkskin, and when it's needed... thorns."),
      guide('Heal through the damage, then punish with Thorn Lash.'),
    ],
    outro: [briar('happy', 'Roots deep, thorns sharp. The grove is waiting.', { bg: 'grove' })],
  },
  'briar-sapling': {
    intro: [
      n('At the heart of the grove grows the Heartwood Sapling. Gray rot creeps up its trunk.', { bg: 'grove' }),
      briar('sad', "Oh, little one. Hold on. I'm here."),
      briar('angry', 'Something is feeding on it. And here comes its guard dog.'),
      n('An Echo of Nyx steps out from behind the trees.', { fx: 'flicker' }),
      guide('Keep the Sapling alive. Mend (emerald) and Regrowth (sapphire) heal it instead of you.', 'emerald'),
    ],
    outro: [
      briar('happy', 'It lives. Good girl. Drink up.', { bg: 'grove' }),
      briar('neutral', "But this rot... it smells of curses. Nyx's curses."),
      rime('neutral', "Echoes copy people, Briar. Don't assume."),
      briar('sad', "I'm trying not to. It's hard when it looks like her."),
    ],
  },
  'briar-blight': {
    intro: [
      rime('neutral', 'The rot is turning your roots to stone. Fight in it. Learn how it moves.', { bg: 'grove' }),
      briar('neutral', 'You want to spar? Now?'),
      rime('neutral', 'You learn faster when someone is hitting you. I have data.'),
      briar('happy', 'That explains so much about you.'),
      guide("Matches next to stone crumble it. Entangle (amethyst) turns your opponent's gems to stone too.", 'amethyst'),
    ],
    outro: [
      briar('surprised', 'The stone follows a path. Like a trail of breadcrumbs.', { bg: 'grove' }),
      rime('neutral', 'Toward the old curse library.'),
      briar('sad', 'Of course it does.'),
    ],
  },
  'briar-ashes': {
    intro: [
      n('At the library doors an Echo of Ember stands among scorched leaves.', { bg: 'library', fx: 'flicker' }),
      ember('angry', 'Hey! That is NOT what my hair looks like.'),
      briar('neutral', 'Stand back, sprout.'),
      ember('surprised', 'Did you just call me sprout?'),
      briar('happy', "Fire is a grove's oldest enemy. I know exactly how to fight it."),
      ember('sad', '...Why does that make me feel personally attacked?'),
    ],
    outro: [
      ember('happy', 'Thanks. Weird to watch myself lose. Weirder to cheer.', { bg: 'library' }),
      briar('happy', 'You cheered very loudly.'),
      ember('happy', 'I do everything loudly.'),
    ],
  },
  'briar-withered': {
    intro: [volt('happy', 'A healer with no heals? This I gotta see!', { bg: 'grove' }), briar('happy', 'Then watch closely. Thorns grow fast.')],
    outro: [briar('happy', 'Thorns are enough, when they must be.', { bg: 'grove' }), volt('surprised', 'Remind me never to touch your plants.')],
  },
  'briar-boss': {
    intro: [
      n("Candles flicker between the chained books. Someone is sitting on the librarian's desk, eating an apple.", { bg: 'library' }),
      nyx('happy', 'The gardener. In MY library. What a lovely surprise.'),
      briar('angry', 'Your curses are in my grove, Nyx.'),
      nyx('neutral', "My curses are wherever I put them, darling. And I didn't put them there."),
      briar('angry', 'The rot smells like you.'),
      nyx('angry', 'Everything smells like me in here. I live here.'),
      nyx('sad', "...But you won't believe that, will you? Nobody ever does."),
      nyx('happy', "Fine. Let's do this the fun way."),
    ],
    outro: [
      n("Briar's cleansing light washes over Nyx. The curse marks don't fade. They crack, and gray dust spills out.", { bg: 'library', fx: 'flash' }),
      briar('surprised', "This isn't your magic. It's hollow. Someone wore your curses like a mask."),
      nyx('surprised', '...Someone framed me?'),
      nyx('angry', 'Someone framed me with BAD curses? Sloppy, gray, tasteless curses?'),
      briar('sad', "Nyx, I'm sorry. I should have listened."),
      nyx('happy', 'Apology accepted. Mostly. Now step aside, gardener. I have a hunt to start.'),
    ],
  },

  // ---------------------------------------------------------------- Chapter 4: Nyx
  'nyx-venom-and-burst': {
    intro: [
      nyx('happy', 'Lesson one in curse-craft: poison first, payoff second.', { bg: 'library' }),
      nyx('angry', 'Lesson two: never, ever frame a hexweaver.'),
      guide('Stack poison, then Toxic Burst hits harder on a cursed target.'),
    ],
    outro: [nyx('happy', "Venom, Burst, Siphon. Now let's find our little impostor.", { bg: 'library' })],
  },
  'nyx-the-hunt': {
    intro: [
      n('Nyx traces the gray dust with a finding-hex. It leads down, into the catacombs, and the catacombs are full.', { bg: 'catacombs', fx: 'flicker' }),
      nyx('neutral', 'Copies of my friends. Rude.'),
      nyx('surprised', '...Friends. Did I say friends? I meant "associates."'),
      briar('happy', 'You said friends.'),
      nyx('angry', 'I will curse you.'),
      guide('Three Echoes in a row. Your HP carries over, with some restored between each.'),
    ],
    outro: [
      nyx('neutral', 'Every Echo I break leaves more dust. It all drifts the same way.', { bg: 'catacombs' }),
      briar('neutral', 'Down. Toward the Heartstone.'),
      nyx('happy', 'Then down we go. I love a dramatic staircase.'),
    ],
  },
  'nyx-hex-trial': {
    intro: [
      briar('neutral', 'The tunnel is sealed with petrified roots. Rime is looking for a way through.', { bg: 'catacombs' }),
      briar('happy', "Spar with me while we wait. It's good for the circulation."),
      nyx('neutral', 'You want to duel to pass the time?'),
      briar('happy', "I want to see how you fight when nobody's watching."),
      nyx('sad', "...That's oddly personal, gardener."),
      guide("Stone everywhere. Matching next to stone crumbles it; Hex (topaz) adds more to your opponent's board.", 'topaz'),
    ],
    outro: [
      briar('happy', 'You fight cleaner than your reputation.', { bg: 'catacombs' }),
      nyx('neutral', "Don't tell anyone. I have an image."),
      briar('happy', 'Your secret is safe with the moss.'),
    ],
  },
  'nyx-turned-curse': {
    intro: [
      n('At the bottom of the stairs waits an Echo of Nyx, wearing her curse marks like a stolen coat.', { bg: 'catacombs', fx: 'flicker' }),
      nyx('angry', "So THAT's who's been walking around in my face."),
      nyx('neutral', "The posture's wrong. And the smirk. Nobody does the smirk right."),
      guide('It throws your own curse back at you. Night Veil (sapphire) shields you and cleanses poison.', 'sapphire'),
    ],
    outro: [
      nyx('surprised', 'It whispered before it broke. "The storm will open the way."', { bg: 'catacombs' }),
      rime('neutral', 'The storm. Volt.'),
      nyx('sad', "Of course it's the loud one."),
    ],
  },
  'nyx-quick-venom': {
    intro: [volt('happy', 'Poison takes seconds. I only need one!', { bg: 'dorm' }), nyx('happy', "Then I'll only need two.")],
    outro: [
      nyx('happy', "Even lightning slows down when it's dying, darling.", { bg: 'dorm' }),
      volt('sad', "That's the meanest thing anyone's said to me today. And Rime talked to me."),
    ],
  },
  'nyx-boss': {
    intro: [
      n('The dorm common room, after midnight. Volt has been waiting by the fireplace, bouncing on her heels.', { bg: 'dorm' }),
      volt('angry', 'The gray stuff, the Echoes, all of it started when YOU went into the catacombs. Explain. Fast.'),
      nyx('neutral', "I'm hunting the one who did this. Same as you, if you'd slow down for one second."),
      volt('angry', "I don't DO slow. Slow is how people get hurt."),
      nyx('surprised', "...Is that what this is? You're scared?"),
      volt('angry', "I'm not scared! I'm FAST! It's different!"),
      nyx('happy', "Then let's see how fast."),
    ],
    outro: [
      volt('sad', 'Okay. Okay! Not you. Sorry. Sorry sorry sorry.', { bg: 'dorm' }),
      volt('neutral', "But I know who it might be. There's someone living in the old Observatory. Hood. Gray eyes. Doesn't talk."),
      volt('happy', "I'm gonna go look. Alone. I'm fastest!"),
      nyx('angry', "That's a terrible plan."),
      volt('happy', "It's a FAST plan!"),
      n("She's gone before anyone can argue."),
    ],
  },

  // ---------------------------------------------------------------- Chapter 5: Volt
  'volt-overcharge': {
    intro: [
      volt('happy', 'Speed is great. Speed plus a supercharged hit? Better!', { bg: 'dorm' }),
      volt('neutral', "Charge up. Wait for it... wait for it... that's the hard part."),
      guide('Overcharge empowers your next damage spell. Charge, then let it rip.'),
    ],
    outro: [volt('happy', 'Charged. Fast. Ready. To the Observatory!', { bg: 'dorm' })],
  },
  'volt-ambush': {
    intro: [
      n('The Observatory is silent. Gray dust covers the telescope, the maps, the floor.', { bg: 'observatory' }),
      volt('surprised', 'Okay, this is extremely haunted. Cool. Cool cool cool.'),
      n('In the center stands a hooded figure, one hand on a cracked shard of the Heartstone.', { fx: 'flicker' }),
      volt('angry', "Hey! You! You're the one making the Echoes!"),
      hollow('neutral', 'Little storm. You came alone. How convenient.', { name: '???' }),
      volt('surprised', "How do you know my... okay, that's not the point. Give that back!"),
      guide("You can't beat this one yet. Survive for 50 seconds."),
    ],
    outro: [
      n('The hooded figure raises a hand. Lightning drains out of Volt like water from a cracked jar.', { bg: 'observatory', fx: 'shake' }),
      hollow('neutral', 'Your speed is mine now. Run along, if you still can.', { name: '???' }),
      volt('sad', "...I can't feel the storm. Everything's so slow."),
      volt('sad', "Everything's so quiet."),
    ],
  },
  'volt-drained': {
    intro: [
      n('Volt limps back to the Academy. The Echoes follow, sensing weakness. Rime meets her at the door.', { bg: 'dorm' }),
      rime('neutral', 'You went alone.'),
      volt('sad', 'I know.'),
      rime('neutral', 'Which part of "alone" did you think was faster than "together"?'),
      volt('sad', '...The alone part.'),
      rime('happy', 'Then we fix it. Spar with me. Slowly.'),
      guide('Your speed was stolen, so every move takes 25% longer. Static Shock (sapphire) stuns; Recharge (emerald) keeps you up.', 'sapphire'),
    ],
    outro: [
      volt('happy', 'Still got it. Slower. But still got it!', { bg: 'dorm' }),
      rime('happy', 'Seventy-five percent of you is still more than most people.'),
      volt('surprised', 'Was that a compliment? Rime did a compliment!'),
      rime('neutral', 'I will deny it.'),
    ],
  },
  'volt-recharge': {
    intro: [
      nyx('neutral', 'There you are. Alone, slow, and surrounded. Terrible plan, as predicted.', { bg: 'arena' }),
      volt('sad', 'You can say "I told you so."'),
      nyx('happy', 'I told you so. That felt wonderful. Now: help.'),
      volt('neutral', 'Every Echo I break, I feel a little more charge come back.'),
      nyx('happy', "Then let's break a lot of Echoes."),
      guide('Polarity (amethyst) rewires your own gems into Spark gems. Set up big chains.', 'amethyst'),
    ],
    outro: [
      volt('happy', "There it is! The storm's back! Not all of it, but enough!", { bg: 'arena' }),
      nyx('happy', 'Good. You were unbearable slow.'),
      volt('happy', "I'm unbearable fast too!"),
      nyx('neutral', "Yes. I'm aware."),
    ],
  },
  'volt-nightmare-echo': {
    intro: [
      rime('neutral', 'This one is stronger than the rest. It fights like it learned from all of them.', { bg: 'fountain' }),
      volt('happy', 'Learned from them, sure. Learned from ME? Nope!'),
    ],
    outro: [volt('happy', 'Too slow! Too slow!', { bg: 'fountain' }), rime('neutral', "I'm going to pretend that wasn't directed at my face.")],
  },
  'volt-boss': {
    intro: [
      n('The Trial Arena, empty and quiet. Ember is sitting on the edge of a gem board.', { bg: 'arena' }),
      ember('neutral', "The Hollow is under the Heartstone. We're going down there together."),
      ember('sad', "But I've seen what she did to you. I'm not taking anyone down there who isn't ready."),
      volt('surprised', 'Final exam?'),
      ember('happy', "Final exam. Everything I've got. Show me the storm is back."),
      volt('happy', "Oh, it's SO back."),
    ],
    outro: [
      ember('happy', "...Yeah. The storm's back.", { bg: 'arena' }),
      volt('happy', 'Told you! Told everyone!'),
      n('Five mages stand at the top of the stairway down to the Heartstone: fire, ice, root, venom and storm.', { bg: 'stairway' }),
      rime('neutral', "Whoever the Hollow is, she's waiting for us."),
      nyx('happy', "Then let's not keep her waiting. It's rude."),
      briar('neutral', 'Stay close. All of us. No more alone.'),
      n('The Finale is open. Pick any mage and go down into the Fracture.'),
    ],
  },

  // ---------------------------------------------------------------- Finale: The Hollow
  'finale-fracture': {
    intro: [
      n('Beneath the Academy, the stairway ends at a wound in the world: the Fracture. Gray light leaks up from below.', { bg: 'stairway' }),
      rime('neutral', "Every Echo we've fought came from down there. Expect all of them at once."),
      nyx('happy', 'Copies of all five of us. Finally, a fair fight. For them.'),
      volt('happy', 'Pick who goes first! The rest of us hold the stairs! Go go go!'),
      hero('happy', {
        ember: 'Me. Obviously.',
        rime: "I'll go. I have their numbers.",
        briar: "I'll go. Somebody has to be gentle with them.",
        nyx: "Me, darling. I've been dying to hit myself.",
        volt: "ME. I've been waiting all chapter!",
        hollow: 'I will go. They are mine, after all.',
      }),
      guide('Echoes of all five mages in a row. Half your HP comes back between each.'),
    ],
    outro: [
      n('The last Echo crumbles. The dust drifts down, toward the heart of the Fracture.', { bg: 'stairway' }),
      briar('sad', "They aren't being destroyed. They're going home."),
    ],
  },
  'finale-gray-garden': {
    intro: [
      n("A garden of stone flowers, every petal gray. An Echo of Briar tends it, humming someone else's tune.", { bg: 'gray-garden', fx: 'flicker' }),
      briar('sad', 'She grew this from my grove. From everything she took.'),
      briar('angry', "I'd like to have a word with that Echo."),
      guide("Hollow gems are drained gray shells. They can't be matched or moved; a match right next to one breaks it free."),
    ],
    outro: [
      n('A voice drifts up from below, calm and tired.', { bg: 'gray-garden' }),
      hollow('neutral', 'You keep breaking my things.', { offstage: true, name: '???' }),
      hollow('neutral', 'Come down, then. Let us finish it.', { offstage: true, name: '???' }),
    ],
  },
  'finale-colorless': {
    intro: [
      hollow('neutral', 'No tricks. No healing. No walls. Just us.', { bg: 'heartstone', revealed: true }),
      hollow('angry', 'Are you as good as the Academy thinks you are?'),
    ],
    outro: [hollow('sad', '...Better than I was. Annoying.', { bg: 'heartstone' })],
  },
  'finale-boss': {
    intro: [
      n('At the bottom of the Fracture floats the Heartstone, split down the middle. The hooded figure stands before it.', { bg: 'heartstone' }),
      hollow('neutral', '...', { name: '???' }),
      n('She lowers her hood.', { fx: 'flash' }),
      hollow('neutral', 'I failed the trials, you know. Six years ago. In the same arena where you all passed yours.', { revealed: true }),
      hollow('sad', 'They said my magic had no color. So they sent me home.'),
      hollow('angry', 'So I learned to take color from everything else. Your grove. Your curses. Your storm.'),
      hero('angry', {
        ember: 'And now you want the Heartstone too.',
        rime: 'And now the Heartstone. The last variable.',
        briar: "And now the Heartstone. You'd take the roots of everything.",
        nyx: 'And now the Heartstone. Greedy, darling.',
        volt: 'And now you want the Heartstone too?!',
        hollow: 'And now I want the Heartstone too. I remember.',
      }),
      hollow('neutral', 'I want what you were all handed. A place. A color.', { revealed: true }),
      hollow('angry', 'Come. Take it back, if you can.'),
    ],
    outro: [
      n('The Hollow falls to one knee. The gray drains out of the Heartstone, and color floods back into the Fracture: red, blue, green, gold, violet.', {
        bg: 'heartstone',
        fx: 'flash',
      }),
      hollow('sad', '...Then finish it. That is what heroes do.'),
      briar('neutral', 'No. Roots grow back. So can people.'),
      rime('neutral', "The trials were wrong about you. Your magic has a color. It just isn't one anyone tested for."),
      nyx('happy', 'And frankly, anyone who framed me this well belongs at the Academy.'),
      volt('happy', 'Rematch tomorrow? Fair fight! Bring your weird gray gems!'),
      ember('happy', 'The Academy has room for one more. If you want it.'),
      hollow('surprised', '...'),
      hollow('happy', 'Fine. But I am keeping the gray gems.'),
      hero('happy', {
        ember: "Welcome to the Academy. Try not to set anything on fire. That's my job.",
        rime: 'I am adding you to my notes. Under "friends." Tentatively.',
        briar: 'Everything grows back, little sprout. Even you. Especially you.',
        nyx: "Welcome, darling. You'll love it here. I'll make sure of it. Mostly.",
        volt: "Rematch tomorrow, nine sharp! Nine-oh-one if you're slow!",
        hollow: 'Strange. Of everyone down here, I was the easiest to beat.',
      }),
      n('The Heartstone is whole again. The Fracture is closed, and the Academy has a sixth student.'),
      n('The Hollow has joined your mages! Thanks for playing The Fracture.'),
    ],
  },
};

/** A node's scene; throws if the script is missing one, so a typo can't silently drop a scene. */
export function scene(nodeId: string): Scene {
  const s = SCRIPT[nodeId];
  if (!s) throw new Error(`No scene written for story node ${nodeId}`);
  return s;
}

export const SCRIPTED_NODES = Object.keys(SCRIPT);
