import { getCharacter, GemColor } from '@magepop/core';
import { ReactNode, useEffect, useState } from 'react';
import { Gem } from './Gem';

/** A tiny gem diagram: rows of colors ('.' = empty, 'x' = off-color filler). */
function Diagram({ rows, theme, glow }: { rows: string[]; theme: string; glow?: string }) {
  const map: Record<string, GemColor> = { r: 'ruby', b: 'sapphire', g: 'emerald', y: 'topaz', p: 'amethyst' };
  return (
    <div className="htp-diagram">
      {rows.map((row, i) => (
        <div key={i} className="htp-row">
          {[...row].map((ch, j) => (
            <div key={j} className={`htp-cell ${ch === glow ? 'lit' : ''} ${ch === '.' ? 'empty' : ''}`}>
              {ch !== '.' && <Gem kind={map[ch] ?? 'emerald'} size={34} theme={theme} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

interface Page {
  title: string;
  body: ReactNode;
  art?: ReactNode;
}

/**
 * First-launch guide (also reachable from the main menu and the pause menu).
 * `theme` picks which mage's gem set to draw the examples with.
 */
export function HowToPlay({ onClose, theme = 'ember' }: { onClose: () => void; theme?: string }) {
  const [page, setPage] = useState(0);
  const ch = getCharacter(theme);
  const ruby = ch.spells.ruby;
  const pages: Page[] = [
    {
      title: 'Swap to match',
      body: (
        <>
          Drag a gem onto a neighbor (or click one, then the other) to swap them. Line up <b>3 of the same gem</b> and they pop,
          chipping a little damage off your opponent. Swaps that don't make a match bounce back.
        </>
      ),
      art: <Diagram theme={theme} glow="r" rows={['grrrb', 'bpygp']} />,
    },
    {
      title: 'Match 4 to cast a spell',
      body: (
        <>
          Every gem is a spell. Match <b>4</b> to cast it: with {ch.name}, 4 of these gems casts <b>{ruby.active.name}</b>. Hover the spell
          list under your board any time to see what each gem does.
        </>
      ),
      art: <Diagram theme={theme} glow="r" rows={['rrrrb', 'bpygp']} />,
    },
    {
      title: '5+ for an ultimate',
      body: (
        <>
          Match <b>5 or more</b> (a long line, an L or a T) for that gem's supercharged ultimate: <b>{ruby.ultimate.name}</b>. Cascades
          (new matches as gems fall) power up everything they trigger.
        </>
      ),
      art: <Diagram theme={theme} glow="r" rows={['rrrbg', 'pryby', 'grgpb']} />,
    },
    {
      title: 'Outlast your rival',
      body: (
        <>
          You both play at the same time on your own boards. Drop their HP to zero to win. Watch out for their spells: <b>frozen</b> gems
          can't be swapped, <b>stone</b> and gray <b>hollow</b> gems break when you match next to them, <b>poison and burn</b> tick until you make enough matches, and a{' '}
          <b>stun</b> locks your board for a moment.
        </>
      ),
    },
    {
      title: 'Learn every mage',
      body: (
        <>
          Story mode is a chapter per mage that teaches their spells one at a time, and beating each chapter recruits a new mage. Press{' '}
          <b>Esc</b> to pause, and you can reopen this guide from the pause menu or the main menu.
        </>
      ),
    },
  ];
  const last = page === pages.length - 1;
  const p = pages[page];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') (last ? onClose() : setPage((x) => x + 1));
      else if (e.key === 'ArrowLeft') setPage((x) => Math.max(0, x - 1));
      else if (e.key === 'Escape') onClose();
      else return;
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [last, onClose]);

  return (
    <div className="overlay htp-overlay">
      <div className="modal htp" style={{ '--accent': ch.palette.primary } as React.CSSProperties}>
        <div className="htp-step">
          How to play · {page + 1}/{pages.length}
        </div>
        <h2>{p.title}</h2>
        {p.art}
        <p className="htp-body">{p.body}</p>
        <div className="htp-dots">
          {pages.map((_, i) => (
            <button key={i} className={`htp-dot ${i === page ? 'on' : ''}`} onClick={() => setPage(i)} aria-label={`Page ${i + 1}`} />
          ))}
        </div>
        <div className="htp-nav">
          <button className="btn small ghost" onClick={onClose}>
            {last ? 'Close' : 'Skip'}
          </button>
          {page > 0 && (
            <button className="btn small ghost" onClick={() => setPage(page - 1)}>
              Back
            </button>
          )}
          <button className="btn small" onClick={() => (last ? onClose() : setPage(page + 1))}>
            {last ? "Let's play!" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
