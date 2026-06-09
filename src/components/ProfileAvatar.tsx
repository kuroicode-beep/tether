interface ProfileAvatarProps {
  src?: string | null
  name?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASS: Record<NonNullable<ProfileAvatarProps['size']>, string> = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-lg',
}

// Renders a resilient profile thumbnail with an accessible text fallback.
export function ProfileAvatar({ src, name, size = 'md', className = '' }: ProfileAvatarProps) {
  const fallback = name?.trim()?.slice(0, 1) || ''

  return (
    <div
      className={`${SIZE_CLASS[size]} profile-avatar shrink-0 rounded-full overflow-hidden bg-secondary-container text-primary flex items-center justify-center font-bold ${className}`}
      aria-label={name ? `${name} profile photo` : 'profile photo'}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : fallback ? (
        <span>{fallback}</span>
      ) : (
        <span className="material-symbols-outlined text-[1.2em]">person</span>
      )}
    </div>
  )
}
