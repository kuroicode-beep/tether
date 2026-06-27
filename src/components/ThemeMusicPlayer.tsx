// src/components/ThemeMusicPlayer.tsx
// Shows the smallest global random-repeat player for the selected Tether playlist.
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ThemeTrack {
  id?: string
  title: string
  url: string
  ownerUid?: string
}

interface ThemeMusicPlayerProps {
  tracks: ThemeTrack[]
  hidden?: boolean
  shouldPlay?: boolean
  onHide?: () => void
  onPlayingChange?: (playing: boolean) => void
  onTrackChange?: (track: ThemeTrack | null) => void
}

function pickInitialRandomIndex(length: number): number {
  return length > 0 ? Math.floor(Math.random() * length) : 0
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
export function ThemeMusicPlayer({
  tracks,
  hidden = false,
  shouldPlay = false,
  onHide,
  onPlayingChange,
  onTrackChange,
}: ThemeMusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const advancingRef = useRef(false)
  const suppressPauseReportRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [trackIndex, setTrackIndex] = useState(() => pickInitialRandomIndex(tracks.length))
  const track = tracks[trackIndex] ?? tracks[0]
  const playlistKey = tracks.map((item) => `${item.id ?? item.url}:${item.url}`).join('|')

  useEffect(() => {
    setTrackIndex(pickInitialRandomIndex(tracks.length))
  }, [playlistKey, tracks.length])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track) return
    audio.loop = false
    audio.currentTime = 0
    suppressPauseReportRef.current = true
    audio.load()
    onTrackChange?.(track)
    if (!shouldPlay) {
      audio.pause()
      setPlaying(false)
      suppressPauseReportRef.current = false
      return
    }
    void audio.play()
      .then(() => {
        suppressPauseReportRef.current = false
        setPlaying(true)
        onPlayingChange?.(true)
      })
      .catch(() => {
        suppressPauseReportRef.current = false
        setPlaying(false)
        onPlayingChange?.(false)
      })
  }, [track, track?.url, shouldPlay, onPlayingChange, onTrackChange])

  const advanceRandom = useCallback(() => {
    if (tracks.length === 0) return
    advancingRef.current = true
    setTrackIndex((current) => pickRandomIndex(tracks.length, current))
    window.setTimeout(() => {
      advancingRef.current = false
    }, 500)
  }, [tracks.length])

  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio || tracks.length === 0 || advancingRef.current) return
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return
    if (audio.duration - audio.currentTime <= 0.05) advanceRandom()
  }

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play()
        .then(() => {
          setPlaying(true)
          onPlayingChange?.(true)
        })
        .catch(() => {
          setPlaying(false)
          onPlayingChange?.(false)
        })
      return
    }
    suppressPauseReportRef.current = false
    audio.pause()
    setPlaying(false)
    onPlayingChange?.(false)
  }

  if (!track) return null

  return (
    <div className={`theme-music-player${hidden ? ' theme-music-player--hidden' : ''}`} role="region" aria-label="같이듣기 플레이어" aria-hidden={hidden}>
      <audio
        ref={audioRef}
        src={track.url}
        preload="metadata"
        onPlay={() => {
          setPlaying(true)
          onPlayingChange?.(true)
        }}
        onPause={() => {
          setPlaying(false)
          if (suppressPauseReportRef.current || advancingRef.current) return
          onPlayingChange?.(false)
        }}
        onEnded={advanceRandom}
        onTimeUpdate={handleTimeUpdate}
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
        onClick={advanceRandom}
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
