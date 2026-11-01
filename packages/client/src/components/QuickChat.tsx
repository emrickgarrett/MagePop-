import { QUICK_CHAT } from '@magepop/core';
import { useEffect, useRef, useState } from 'react';
import { pvp } from '../game/pvp';

const BUBBLE_MS = 2600;

export interface ChatLine {
  id: number;
  at: number;
}

/**
 * Quick chat state for an online match: your last message, theirs, and sending via the
 * connection. Number keys 1-8 send (unless typing in a field or `enabled` is false).
 */
export function useQuickChat(enabled: boolean) {
  const [mine, setMine] = useState<ChatLine | null>(null);
  const [theirs, setTheirs] = useState<ChatLine | null>(null);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const off = pvp.on((m) => {
      if (m.t === 'chat' && !pvp.chatMuted) setTheirs({ id: m.id, at: performance.now() });
    });
    return () => void off();
  }, [enabled]);

  const send = (id: number) => {
    if (enabled && pvp.sendChat(id)) setMine({ id, at: performance.now() });
  };
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= QUICK_CHAT.length) sendRef.current(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);

  const toggleMute = () => {
    pvp.chatMuted = !pvp.chatMuted;
    if (pvp.chatMuted) setTheirs(null);
    bump((x) => x + 1);
  };

  return { mine, theirs, send, muted: pvp.chatMuted, toggleMute };
}

/** A speech bubble that pops in and fades after a couple of seconds. */
export function ChatBubble({ line, side, now, name }: { line: ChatLine | null; side: 'me' | 'them'; now: number; name?: string }) {
  if (!line) return null;
  const age = now - line.at;
  if (age > BUBBLE_MS) return null;
  return (
    <div key={line.at} className={`chat-bubble ${side}`} style={{ opacity: age > BUBBLE_MS - 400 ? (BUBBLE_MS - age) / 400 : 1 }}>
      {name && <small>{name}</small>}
      {QUICK_CHAT[line.id]}
    </div>
  );
}

/** The 💬 button and its menu of presets (for mouse players; keys 1-8 do the same). */
export function ChatMenu({ onPick }: { onPick: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="chat-menu" ref={ref}>
      <button className={`chat-toggle ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)} title="Quick chat (keys 1-8)" aria-label="Quick chat">
        💬
      </button>
      {open && (
        <div className="chat-pop">
          {QUICK_CHAT.map((text, i) => (
            <button
              key={i}
              onClick={() => {
                onPick(i);
                setOpen(false);
              }}
            >
              <kbd>{i + 1}</kbd>
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Quick chat on the result screen (for a minute after an online match: "GG!"). */
export function ResultChat({ opponent }: { opponent: string }) {
  const chat = useQuickChat(true);
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="result-chat">
      <div className="result-chat-lines">
        <ChatBubble line={chat.mine} side="me" now={now} name="You" />
        <ChatBubble line={chat.theirs} side="them" now={now} name={opponent} />
      </div>
      <div className="result-chat-chips">
        {QUICK_CHAT.map((text, i) => (
          <button key={i} className="chip-btn" onClick={() => chat.send(i)}>
            <kbd>{i + 1}</kbd> {text}
          </button>
        ))}
      </div>
    </div>
  );
}
