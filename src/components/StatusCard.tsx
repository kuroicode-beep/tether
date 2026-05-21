import { MoodChip } from './MoodChip'

interface StatusCardProps {
  name: string
  isMe?: boolean
  mood: string
  tags: string[]
  message: string
  updatedAt: string
  online?: boolean
}

const MOOD_EMOJIS = ['😊', '😐', '😴']

export function StatusCard({ name, isMe, mood, tags, message, updatedAt, online }: StatusCardProps) {
  return (
    <div
      className={`bg-[#F5F2EB] rounded-xl p-md shadow-sm flex flex-col items-center text-center space-y-sm ${
        isMe ? 'border-2 border-primary-container' : 'border border-transparent'
      }`}
    >
      <div className="flex items-center gap-xs">
        <span className="font-label-md text-label-md text-on-surface">{name}</span>
        <div className={`w-2 h-2 rounded-full ${online ? 'bg-primary' : 'bg-outline-variant'}`} />
      </div>

      <div className="flex justify-around w-full py-xs">
        {MOOD_EMOJIS.map((emoji) => (
          <div
            key={emoji}
            className={`text-xl p-xs ${
              mood === emoji ? '' : 'grayscale opacity-50'
            }`}
          >
            {emoji}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-xs">
        {tags.map((tag) => (
          <MoodChip key={tag} label={tag} active />
        ))}
      </div>

      <p className="font-body-md text-label-md text-on-surface-variant leading-tight h-10 flex items-center text-center">
        {message}
      </p>

      <span className="font-label-sm text-[10px] text-outline-variant">{updatedAt}</span>
    </div>
  )
}
