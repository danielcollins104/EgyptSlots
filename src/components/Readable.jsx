import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';
import { speak, stopSpeaking, speechSupported } from '../services/speech';
import './readable.css';

/**
 * Readable — wraps a block of text with comfortable typography and an optional tiny speaker icon that
 * reads the block aloud in a natural-sounding voice (Web Speech API; fully on-device).
 *
 *   <Readable className="legal-text-block" label="Terms section"> ...any markup... </Readable>
 *
 * Clicking the icon again (or opening another reader, or unmounting) stops playback.
 */
export default function Readable({ children, className = '', label = 'this section', as: Tag = 'div', ...rest }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const supported = speechSupported();

  useEffect(() => () => { if (playing) stopSpeaking(); }, [playing]);

  const toggle = useCallback((e) => {
    e.stopPropagation();
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    const text = ref.current ? ref.current.innerText : '';
    if (speak(text, { onEnd: () => setPlaying(false) })) setPlaying(true);
  }, [playing]);

  return (
    <Tag ref={ref} className={`readable ${supported ? 'has-reader' : ''} ${className}`} {...rest}>
      {supported && (
        <button
          type="button"
          className={`readable-speaker ${playing ? 'is-playing' : ''}`}
          onClick={toggle}
          aria-pressed={playing}
          aria-label={playing ? `Stop reading ${label}` : `Read ${label} aloud`}
          title={playing ? 'Stop reading' : 'Read this section aloud'}
          data-readable-ignore
        >
          {playing ? <Square size={12} fill="currentColor" /> : <Volume2 size={14} />}
        </button>
      )}
      {children}
    </Tag>
  );
}
