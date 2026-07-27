import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { useSpeechRecognition } from './voice/useSpeechRecognition'
import { VoiceButton } from './voice/VoiceButton'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  voice?: boolean
  onVoiceResult?: (transcript: string) => void
  onVoiceError?: (error: string) => void
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, voice, onVoiceResult, onVoiceError, onChange, ...props }, ref) => {
    const speech = useSpeechRecognition({
      onResult: (transcript) => {
        onVoiceResult?.(transcript)
        onChange?.({ target: { value: transcript } } as React.ChangeEvent<HTMLInputElement>)
      },
      onError: onVoiceError,
    })

    return (
      <div className="relative flex items-center">
        <input
          ref={ref}
          className={cn(
            'flex h-9 w-full rounded border border-input-border bg-transparent px-3 py-1 text-sm',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            voice && 'pr-9',
            className
          )}
          onChange={onChange}
          {...props}
        />
        {voice && (
          <VoiceButton
            supported={speech.supported}
            listening={speech.listening}
            onClick={speech.toggle}
            className="absolute right-2"
          />
        )}
        {speech.interimTranscript && (
          <span
            role="status"
            className="pointer-events-none absolute right-9 max-w-[70%] truncate rounded bg-surface px-1.5 py-0.5 text-xs text-muted-foreground shadow"
          >
            {speech.interimTranscript}
          </span>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
