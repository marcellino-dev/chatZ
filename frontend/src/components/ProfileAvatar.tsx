import { useState } from 'react';

interface ProfileAvatarProps {
  name: string;
  pictureUrl?: string | null;
  sizeClass?: string;
  textClass?: string;
}

export function ProfileAvatar({
  name,
  pictureUrl,
  sizeClass = 'w-11 h-11',
  textClass = 'text-sm',
}: ProfileAvatarProps) {
  const [failedPictureUrl, setFailedPictureUrl] = useState<string | null>(null);
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={`${sizeClass} shrink-0 rounded-full bg-gradient-to-br
                  from-chatz-purple to-chatz-pink flex items-center
                  justify-center overflow-hidden text-white font-semibold ${textClass}`}
    >
      {pictureUrl && failedPictureUrl !== pictureUrl ? (
        <img
          src={pictureUrl}
          alt={`Foto de ${name}`}
          className="w-full h-full object-cover"
          onError={() => setFailedPictureUrl(pictureUrl)}
        />
      ) : (
        initials
      )}
    </div>
  );
}
