import Image from 'next/image';
import { cn } from '@axa/platform';

/**
 * The Munaxa logo, per the brand system. `variant` selects the lockup: horizontal (headers/nav,
 * default), stacked (login/hero), wordmark (footers), symbol (icon-only). `size` is the rendered
 * height in px; width follows the variant's intrinsic ratio. Theme-aware; the symbol is a single
 * teal mark for both themes. Served as static assets (unoptimized).
 */
type Variant = 'horizontal' | 'stacked' | 'wordmark' | 'symbol';

const RATIO: Record<Variant, number> = {
  horizontal: 1468 / 203,
  stacked: 1162 / 604,
  wordmark: 1502 / 191,
  symbol: 891 / 557,
};

const SRC: Record<Variant, string> = {
  horizontal: 'munaxa-horizontal',
  stacked: 'munaxa-stacked',
  wordmark: 'munaxa-wordmark',
  symbol: 'munaxa-symbol',
};

export function Logo({
  variant = 'horizontal',
  size = 32,
  className,
  priority = false,
}: {
  variant?: Variant;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const width = Math.round(size * RATIO[variant]);
  const base = SRC[variant];
  const common = { alt: 'Munaxa', width, height: size, priority, unoptimized: true } as const;

  if (variant === 'symbol') {
    return <Image src={`/${base}.png`} {...common} className={cn('object-contain', className)} />;
  }
  return (
    <>
      <Image
        src={`/${base}-light.png`}
        {...common}
        className={cn('object-contain dark:hidden', className)}
      />
      <Image
        src={`/${base}-dark.png`}
        {...common}
        className={cn('hidden object-contain dark:block', className)}
      />
    </>
  );
}
