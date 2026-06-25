// src/components/ThemeMusicPlayer.tsx
// Shows the smallest global loop player for the selected Tether theme track.
import { useEffect, useRef, useState } from 'react'

export interface ThemeTrack {
  id?: string
  title: string
  url: string
  ownerUid?: string
}

interface ThemeMusicPlayerProps {
  tracks: ThemeTrack[]
  onHide?: () => void
}

function pickRandomIndex(length: number, currentIndex: number): number {
  if (length <= 1) return 0
  let next = currentIndex
  while (next === currentIndex) {
    next = Math.floor(Math.random() * length)
  }
  return next
}

// Renders a compact top player that random-repeats the active couple playlist.
export function ThemeMusicPlayer({ tracks, onHide }: ThemeMusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [trackIndex, setTrackIndex] = useState(0)
  const track = tracks[trackIndex] ?? tracks[0]

  useEffect(() => {
    setTrackIndex((current) => current < tracks.length ? current : 0)
  }, [tracks.length])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track) return
    audio.loop = true
    audio.currentTime = 0
    void audio.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false))
  }, [track?.url])

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

  const playRandomNext = () => {
    if (tracks.length === 0) return
    setTrackIndex((current) => pickRandomIndex(tracks.length, current))
  }

  if (!track) return null

  return (
    <div className="theme-music-player" role="region" aria-label="같이듣기 플레이어">
      <audio
        ref={audioRef}
        src={track.url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={playRandomNext}
      />
      <span className="material-symbols-outlined theme-music-icon" aria-hidden="true">
        graphic_eq
      </span>
      <span className="theme-music-title" title={track.title}>
        {track.title} {tracks.length > 1 ? `(${trackIndex + 1}/${tracks.length})` : ''}
      </span>
      <button
        type="button"
        className="theme-music-button theme-music-button--ghost"
        onClick={playRandomNext}
        aria-label="랜덤 다음 곡"
      >
        <span className="material-symbols-outlined" aria-hidden="true">shuffle</span>
      </button>
      <button
        type="button"
        className="theme-music-button"
        onClick={togglePlayback}
        aria-label={playing ? '같이듣기 일시정지' : '같이듣기 재생'}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          {playing ? 'pause' : 'play_arrow'}
        </span>
      </button>
      {onHide && (
        <button
          type="button"
          className="theme-music-button theme-music-button--ghost"
          onClick={onHide}
          aria-label="같이듣기 플레이어 숨기기"
        >
          <span className="material-symbols-outlined" aria-hidden="true">keyboard_arrow_up</span>
        </button>
      )}
    </div>
  )
}
