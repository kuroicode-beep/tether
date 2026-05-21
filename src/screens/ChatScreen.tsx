import { useState, useRef, useEffect } from 'react'

interface ChatScreenProps {
  onBack: () => void
}

interface Message {
  id: string
  text: string
  isMe: boolean
  time: string
}

const INITIAL_MESSAGES: Message[] = [
  { id: '1', text: 'Good morning! Did you sleep well?', isMe: false, time: '08:42 AM' },
  { id: '2', text: "I was thinking we could try that new cafe this weekend. ☕️", isMe: false, time: '08:42 AM' },
  { id: '3', text: 'Hey! I slept great, dreaming of us. ❤️', isMe: true, time: '09:15 AM' },
  { id: '4', text: "I'd love to try that place! Saturday works best for me.", isMe: true, time: '09:15 AM' },
  { id: '5', text: 'Look at what I found for our garden!', isMe: false, time: '11:30 AM' },
]

export function ChatScreen({ onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text: input.trim(),
        isMe: true,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      {/* Header */}
      <header className="w-full top-0 sticky z-50 bg-surface/80 backdrop-blur-md flex justify-between items-center px-margin-mobile py-sm">
        <div className="flex items-center gap-md">
          <button
            className="hover:bg-surface-container rounded-full p-xs transition-colors"
            onClick={onBack}
          >
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </button>
          <div className="flex items-center gap-sm">
            <div className="relative w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center overflow-hidden">
              <span className="material-symbols-outlined text-primary">person</span>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#4CAF50] border-2 border-surface rounded-full" />
            </div>
            <div className="flex flex-col">
              <span className="font-body-md font-semibold text-primary">자기</span>
              <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                Active now
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main
        className="flex-1 overflow-y-auto px-margin-mobile py-lg flex flex-col gap-lg"
        style={{ paddingBottom: '100px' }}
      >
        <div className="flex justify-center my-md">
          <span className="bg-surface-container-highest px-md py-xs rounded-full text-label-sm text-on-surface-variant">
            오늘
          </span>
        </div>

        {messages.map((msg, i) => {
          const showTime = i === messages.length - 1 || messages[i + 1]?.isMe !== msg.isMe
          return (
            <div key={msg.id}>
              <div className={`flex flex-col gap-xs max-w-[80%] ${msg.isMe ? 'items-end self-end ml-auto' : 'items-start'}`}>
                <div
                  className={`p-md rounded-[18px] shadow-sm ${
                    msg.isMe
                      ? 'bg-primary-container text-on-primary-container message-bubble-me'
                      : 'bg-surface-container-low text-on-surface message-bubble-partner'
                  }`}
                >
                  <p className="font-body-md text-body-md">{msg.text}</p>
                </div>
                {showTime && (
                  <span className={`text-[10px] text-on-surface-variant ${msg.isMe ? 'mr-sm' : 'ml-sm'} mt-xs`}>
                    {msg.time}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <footer className="fixed bottom-0 left-0 w-full bg-surface-container-low/80 backdrop-blur-md pt-sm pb-lg px-margin-mobile flex items-end gap-md shadow-sm">
        <button className="bg-surface-container rounded-full p-md text-secondary hover:text-primary transition-all active:scale-95">
          <span className="material-symbols-outlined">add_photo_alternate</span>
        </button>
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력..."
            rows={1}
            className="w-full bg-surface-container border-none rounded-[24px] px-lg py-md focus:ring-2 focus:ring-primary-container font-body-md text-body-md text-on-surface placeholder-on-surface-variant/50 resize-none overflow-hidden max-h-32 transition-all outline-none"
          />
        </div>
        <button
          onClick={handleSend}
          className="bg-primary-container text-on-primary-container rounded-full p-md shadow-md hover:bg-primary transition-all active:scale-90 flex items-center justify-center"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            send
          </span>
        </button>
      </footer>
    </div>
  )
}
