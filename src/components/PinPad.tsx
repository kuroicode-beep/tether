interface PinPadProps {
  pinLength: number
  maxLength?: number
  onDigit: (d: string) => void
  onDelete: () => void
}

export function PinPad({ pinLength, maxLength = 4, onDigit, onDelete }: PinPadProps) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

  return (
    <div className="flex flex-col items-center gap-xxl w-full">
      <div className="pin-dots">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`pin-dot${i < pinLength ? ' filled' : ''}`}
          />
        ))}
      </div>

      <div className="pin-keypad">
        {digits.map((d, i) => {
          if (d === '') {
            return <div key={i} className="pin-key pin-key--empty" aria-hidden />
          }
          if (d === '⌫') {
            return (
              <button
                key={i}
                type="button"
                onClick={onDelete}
                className="pin-key key-tap"
                aria-label="삭제"
              >
                <span className="material-symbols-outlined text-headline-md">backspace</span>
              </button>
            )
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDigit(d)}
              className="pin-key key-tap"
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}
