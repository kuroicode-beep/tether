interface PinPadProps {
  pinLength: number
  maxLength?: number
  onDigit: (d: string) => void
  onDelete: () => void
}

export function PinPad({ pinLength, maxLength = 4, onDigit, onDelete }: PinPadProps) {
  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="flex flex-col items-center gap-xxl w-full">
      {/* Dots */}
      <div className="flex gap-md justify-center items-center">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`pin-dot w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              i < pinLength
                ? 'bg-primary border-primary scale-110'
                : 'border-[#C8C4B8]'
            }`}
          />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-md w-full max-w-[280px]">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} className="h-16 w-full" />
          if (d === '⌫') {
            return (
              <button
                key={i}
                onClick={onDelete}
                className="key-tap h-16 w-full rounded-xl bg-transparent flex items-center justify-center text-on-surface-variant active:scale-95"
              >
                <span className="material-symbols-outlined text-headline-md">backspace</span>
              </button>
            )
          }
          return (
            <button
              key={i}
              onClick={() => onDigit(d)}
              className="key-tap h-16 w-full rounded-xl bg-[#F5F2EB] shadow-sm flex items-center justify-center text-headline-md font-headline-md text-on-surface active:scale-95"
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}
