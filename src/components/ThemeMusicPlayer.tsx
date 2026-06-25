// src/components/ThemeMusicPlayer.tsx
// Shows the smallest global loop player for the selected Tether theme track.
import { useEffect, useRef, useState } from 'react'

export interface ThemeTrack {
  title: string
  url: string
}

interface ThemeMusicPlayerProps {
  track: ThemeTrack
  onClear?: () => void
}

// Renders a compact top player that keeps one selected track looping.
export function ThemeMusicPlayer({ track, onClear }: ThemeMusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.loop = true
    audio.currentTime = 0
    void audio.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false))
  }, [track.url])

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false))
      return
    }
    audio.pause()
    setPlaying(false)
  }

  return (
    <div className="theme-music-player" role="region" aria-label="메인테마 플레이어">
      <audio
        ref={audioRef}
        src={track.url}
        loop
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <span className="material-symbols-outlined theme-music-icon" aria-hidden="true">
        graphic_eq
      </span>
      <span className="theme-music-title" title={track.title}>
        {track.title}
      </span>
      <button
        type="button"
        className="theme-music-button"
        onClick={togglePlayback}
        aria-label={playing ? '메인테마 일시정지' : '메인테마 재생'}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          {playing ? 'pause' : 'play_arrow'}
        </span>
      </button>
      {onClear && (
        <button
          type="button"
          className="theme-music-button theme-music-button--ghost"
          onClick={onClear}
          aria-label="메인테마 닫기"
        >
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      )}
    </div>
  )
}
