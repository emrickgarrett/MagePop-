/**
 * Game audio: crossfading, looping music + event sound effects.
 *
 * Music files: public/assets/music/<track>.mp3 (missing tracks are silently skipped).
 * Sound effects: public/assets/sfx/<name>.(ogg|mp3|wav). Until a file exists, each effect is
 * synthesized with Web Audio so the game is never silent.
 */

export type MusicTrack =
  | 'menu'
  | 'story'
  | 'endless'
  | 'victory'
  | 'defeat'
  | 'battle-ember'
  | 'battle-rime'
  | 'battle-briar'
  | 'battle-nyx'
  | 'battle-volt';

interface TrackInfo {
  /** Measured integrated loudness (LUFS); used to level every track to the same volume. */
  lufs: number;
  loop: boolean;
  /** Loop window in seconds. The loop crossfades from loopEnd back to loopStart. */
  loopStart?: number;
  loopEnd?: number;
}

// Measured with ffmpeg loudnorm. Suno tracks end with a hard cut, so loops crossfade a bit early.
const TRACKS: Record<MusicTrack, TrackInfo> = {
  menu: { lufs: -15.95, loop: true, loopEnd: 141 },
  story: { lufs: -15.35, loop: true, loopEnd: 133 },
  endless: { lufs: -15.32, loop: true, loopStart: 1, loopEnd: 287 },
  victory: { lufs: -19.94, loop: false },
  defeat: { lufs: -15.32, loop: false },
  'battle-ember': { lufs: -16.06, loop: true, loopEnd: 182 },
  'battle-rime': { lufs: -16.31, loop: true, loopStart: 1, loopEnd: 132 },
  'battle-briar': { lufs: -15.1, loop: true, loopEnd: 149 },
  'battle-nyx': { lufs: -15.63, loop: true, loopEnd: 149 },
  'battle-volt': { lufs: -15.6, loop: true, loopEnd: 176 },
};

const TARGET_LUFS = -16;
const LOOP_XFADE = 2.5;
const SWITCH_FADE = 0.9;

export type Sfx =
  | 'click'
  | 'swap'
  | 'invalid'
  | 'match'
  | 'spell'
  | 'ultimate'
  | 'hit'
  | 'heal'
  | 'shield'
  | 'freeze'
  | 'stone'
  | 'poison'
  | 'stun'
  | 'shatter'
  | 'ready';

export const SFX_NAMES: Sfx[] = ['click', 'swap', 'invalid', 'match', 'spell', 'ultimate', 'hit', 'heal', 'shield', 'freeze', 'stone', 'poison', 'stun', 'shatter', 'ready'];

interface Deck {
  el: HTMLAudioElement;
  gain: GainNode;
  track: MusicTrack;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private decks: Deck[] = [];
  private current: Deck | null = null;
  private wanted: MusicTrack | null = null;
  private musicVolume = 0.6;
  private sfxVolume = 0.8;
  private buffers = new Map<Sfx, AudioBuffer | null>();
  private missingTracks = new Set<MusicTrack>();
  private noise: AudioBuffer | null = null;
  private lastPlayed = new Map<Sfx, number>();
  private timer: number | null = null;
  private musicMeter: AnalyserNode | null = null;
  /** Recently played sound names (for tests). */
  debugLog: Sfx[] = [];
  private sfxMeter: AnalyserNode | null = null;

  /** Must be called from (or after) a user gesture in browsers; Electron allows autoplay. */
  private ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return null;
    }
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.sfxBus.gain.value = this.sfxVolume;
    this.musicBus.connect(this.ctx.destination);
    this.sfxBus.connect(this.ctx.destination);
    this.musicMeter = this.ctx.createAnalyser();
    this.sfxMeter = this.ctx.createAnalyser();
    this.musicBus.connect(this.musicMeter);
    this.sfxBus.connect(this.sfxMeter);
    void this.loadSfxFiles();
    this.timer = window.setInterval(() => this.watchLoop(), 100);
    return this.ctx;
  }

  /** Call once at startup: unlocks audio on the first click/key in browsers. */
  init() {
    const unlock = () => {
      this.ensure();
      if (this.wanted && !this.current) this.playMusic(this.wanted);
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    // Electron (and browsers with autoplay allowed) can start right away.
    this.ensure();
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.musicBus.gain.setTargetAtTime(music, t, 0.05);
      this.sfxBus.gain.setTargetAtTime(sfx, t, 0.05);
    }
  }

  // ---------------------------------------------------------------- music

  playMusic(track: MusicTrack | null, opts: { restart?: boolean } = {}) {
    this.wanted = track;
    const ctx = this.ensure();
    if (!ctx) return;
    if (!opts.restart && this.current && this.current.track === track) return;
    if (this.current) this.fadeOut(this.current, SWITCH_FADE);
    this.current = null;
    if (!track || this.missingTracks.has(track)) return;
    this.current = this.startDeck(track, TRACKS[track].loopStart ?? 0, SWITCH_FADE);
  }

  private startDeck(track: MusicTrack, at: number, fadeIn: number): Deck | null {
    const ctx = this.ctx!;
    const el = new Audio(`assets/music/${track}.mp3`);
    el.preload = 'auto';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    try {
      ctx.createMediaElementSource(el).connect(gain);
    } catch {
      return null;
    }
    gain.connect(this.musicBus);
    const level = Math.min(2, Math.pow(10, (TARGET_LUFS - TRACKS[track].lufs) / 20));
    const deck: Deck = { el, gain, track };
    el.addEventListener('error', () => {
      this.missingTracks.add(track);
      this.dropDeck(deck);
      if (this.current === deck) this.current = null;
    });
    el.addEventListener('ended', () => {
      this.dropDeck(deck);
      if (this.current === deck) this.current = null;
    });
    el.currentTime = at;
    el.play()
      .then(() => {
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(level, t + fadeIn);
      })
      .catch(() => {
        // Autoplay blocked: the unlock listener will retry on the first interaction.
        this.dropDeck(deck);
        if (this.current === deck) this.current = null;
      });
    this.decks.push(deck);
    return deck;
  }

  private fadeOut(deck: Deck, secs: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    deck.gain.gain.cancelScheduledValues(t);
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, t);
    deck.gain.gain.linearRampToValueAtTime(0, t + secs);
    window.setTimeout(() => this.dropDeck(deck), secs * 1000 + 100);
  }

  private dropDeck(deck: Deck) {
    deck.el.pause();
    deck.el.removeAttribute('src');
    deck.gain.disconnect();
    this.decks = this.decks.filter((d) => d !== deck);
  }

  /** Crossfade a looping track back to its loop start just before it ends. */
  private watchLoop() {
    const d = this.current;
    if (!d) return;
    const info = TRACKS[d.track];
    if (!info.loop) return;
    const end = Math.min(info.loopEnd ?? Infinity, (d.el.duration || Infinity) - 0.2);
    if (Number.isFinite(end) && d.el.currentTime >= end - LOOP_XFADE) {
      this.fadeOut(d, LOOP_XFADE);
      this.current = this.startDeck(d.track, info.loopStart ?? 0, LOOP_XFADE);
    }
  }

  // ---------------------------------------------------------------- sfx

  /** assets/sfx/manifest.json (written by tools/process_sfx.py) maps sound names to files. */
  private async loadSfxFiles() {
    for (const name of SFX_NAMES) this.buffers.set(name, null);
    const raw = await loadBytes('assets/sfx/manifest.json');
    if (!raw) return;
    let manifest: Record<string, string> = {};
    try {
      manifest = JSON.parse(new TextDecoder().decode(raw));
    } catch {
      return;
    }
    await Promise.all(
      SFX_NAMES.filter((n) => manifest[n]).map(async (name) => {
        try {
          const data = await loadBytes(`assets/sfx/${manifest[name]}`);
          if (data) this.buffers.set(name, await this.ctx!.decodeAudioData(data));
        } catch {
          /* keep the synthesized fallback */
        }
      }),
    );
  }

  /** Test hook: jump the current music to just before its loop point. */
  debugSeekToLoop() {
    const d = this.current;
    const end = d && TRACKS[d.track].loopEnd;
    if (d && end) d.el.currentTime = end - LOOP_XFADE - 1;
  }

  /** Which sound effects come from files (vs. synthesized). For the debug overlay/tests. */
  sfxSources(): Record<string, 'file' | 'synth'> {
    return Object.fromEntries(SFX_NAMES.map((n) => [n, this.buffers.get(n) ? 'file' : 'synth']));
  }

  /** Current RMS level (dBFS) of the music and sfx buses; used to verify audio actually plays. */
  levels(): { music: number; sfx: number; track: MusicTrack | null } {
    const rms = (a: AnalyserNode | null) => {
      if (!a) return -Infinity;
      const d = new Float32Array(a.fftSize);
      a.getFloatTimeDomainData(d);
      let sum = 0;
      for (const v of d) sum += v * v;
      return 10 * Math.log10(sum / d.length + 1e-12);
    };
    return { music: rms(this.musicMeter), sfx: rms(this.sfxMeter), track: this.current?.track ?? null };
  }

  /**
   * Play a sound effect. `pitch` > 1 raises it (used for combo chains), `volume` scales it
   * (the opponent's sounds play quieter than yours).
   */
  play(name: Sfx, opts: { pitch?: number; volume?: number } = {}) {
    const ctx = this.ensure();
    if (!ctx || this.sfxVolume <= 0) return;
    // Don't stack the same sound more than once every 35ms.
    const now = performance.now();
    if (now - (this.lastPlayed.get(name) ?? 0) < 35) return;
    this.lastPlayed.set(name, now);

    const pitch = opts.pitch ?? 1;
    const vol = opts.volume ?? 1;
    this.debugLog.push(name);
    if (this.debugLog.length > 300) this.debugLog.shift();
    const out = ctx.createGain();
    out.gain.value = vol;
    out.connect(this.sfxBus);
    const buf = this.buffers.get(name);
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = pitch;
      src.connect(out);
      src.start();
      return;
    }
    this.synth(name, out, pitch);
  }

  // Placeholder sound design, built from oscillators and filtered noise.
  private synth(name: Sfx, out: GainNode, pitch: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.005;
    const tone = (type: OscillatorType, f0: number, f1: number, start: number, dur: number, peak: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0 * pitch, t + start);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * pitch), t + start + dur);
      g.gain.setValueAtTime(0.0001, t + start);
      g.gain.exponentialRampToValueAtTime(peak, t + start + Math.min(0.012, dur / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      o.connect(g).connect(out);
      o.start(t + start);
      o.stop(t + start + dur + 0.02);
    };
    const noise = (filter: BiquadFilterType, f0: number, f1: number, start: number, dur: number, peak: number, q = 1) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      const bq = ctx.createBiquadFilter();
      bq.type = filter;
      bq.Q.value = q;
      bq.frequency.setValueAtTime(f0, t + start);
      bq.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + start + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + start);
      g.gain.exponentialRampToValueAtTime(peak, t + start + Math.min(0.01, dur / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      src.connect(bq).connect(g).connect(out);
      src.start(t + start);
      src.stop(t + start + dur + 0.02);
    };

    switch (name) {
      case 'click':
        tone('sine', 1100, 900, 0, 0.05, 0.18);
        break;
      case 'swap':
        noise('bandpass', 700, 2400, 0, 0.14, 0.22, 1.2);
        break;
      case 'invalid':
        tone('square', 240, 220, 0, 0.08, 0.08);
        tone('square', 200, 180, 0.1, 0.1, 0.08);
        break;
      case 'match':
        tone('sine', 720, 360, 0, 0.12, 0.32);
        tone('triangle', 1440, 1100, 0, 0.06, 0.12);
        noise('highpass', 3000, 5000, 0, 0.04, 0.08);
        break;
      case 'spell':
        [0, 0.06, 0.12].forEach((s, i) => tone('triangle', [880, 1109, 1319][i], [880, 1109, 1319][i], s, 0.22, 0.2));
        noise('highpass', 5000, 9000, 0.02, 0.3, 0.05);
        break;
      case 'ultimate':
        tone('sine', 120, 45, 0, 0.6, 0.5);
        [0, 0.05, 0.1, 0.15, 0.2].forEach((s, i) => tone('triangle', [659, 880, 1109, 1319, 1760][i], [659, 880, 1109, 1319, 1760][i], s, 0.35, 0.18));
        noise('bandpass', 400, 4000, 0, 0.5, 0.18, 0.7);
        break;
      case 'hit':
        tone('sine', 160, 60, 0, 0.18, 0.45);
        noise('lowpass', 2500, 300, 0, 0.12, 0.3);
        break;
      case 'heal':
        tone('sine', 520, 1040, 0, 0.35, 0.18);
        tone('triangle', 780, 1560, 0.06, 0.3, 0.1);
        break;
      case 'shield':
        tone('square', 1500, 1450, 0, 0.25, 0.06);
        tone('sine', 750, 740, 0, 0.35, 0.14);
        break;
      case 'freeze':
        noise('highpass', 4000, 8000, 0, 0.45, 0.14);
        [0, 0.05, 0.11].forEach((s, i) => tone('sine', [2093, 2637, 3136][i], [2093, 2637, 3136][i], s, 0.25, 0.08));
        break;
      case 'stone':
        tone('sine', 110, 50, 0, 0.3, 0.45);
        noise('lowpass', 900, 200, 0, 0.25, 0.3);
        break;
      case 'poison':
        [0, 0.07, 0.14].forEach((s) => tone('sine', 300, 520, s, 0.09, 0.14));
        break;
      case 'stun':
        tone('sawtooth', 1800, 300, 0, 0.3, 0.1);
        noise('bandpass', 3000, 1200, 0, 0.3, 0.15, 3);
        break;
      case 'shatter':
        for (let i = 0; i < 5; i++) noise('highpass', 3000 + i * 800, 6000, i * 0.03, 0.18, 0.18);
        tone('triangle', 2400, 1800, 0, 0.2, 0.08);
        break;
      case 'ready':
        tone('triangle', 660, 660, 0, 0.18, 0.2);
        tone('triangle', 990, 990, 0.18, 0.3, 0.2);
        break;
    }
  }

  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise;
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return buf;
  }
}

/** XHR rather than fetch: fetch can't read file:// URLs, which the Electron build uses. */
function loadBytes(url: string): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => resolve((xhr.status === 200 || xhr.status === 0) && xhr.response?.byteLength ? xhr.response : null);
    xhr.onerror = () => resolve(null);
    xhr.send();
  });
}

export const audio = new AudioEngine();
(window as unknown as { __magepopAudio?: AudioEngine }).__magepopAudio = audio;
