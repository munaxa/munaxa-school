import Image from 'next/image';
import { cn } from '@axa/platform';

/**
 * The official Munaxa logo. `variant` picks the lockup — horizontal (header, default), wordmark
 * (footer, text-only), stacked (hero), or symbol (icon-only). Theme assets are swapped with the
 * `dark:` variant; the symbol is a single teal mark for both themes. Height comes from `className`
 * (defaults per usage); width follows the intrinsic ratio.
 */
type Variant = 'horizontal' | 'wordmark' | 'stacked' | 'symbol';

const MAP: Record<Variant, { base: string; w: number; h: number; single?: boolean }> = {
  horizontal: { base: 'logo', w: 800, h: 111 },
  wordmark: { base: 'logo-wordmark', w: 800, h: 102 },
  stacked: { base: 'logo-stacked', w: 440, h: 229 },
  symbol: { base: 'logo-mark', w: 256, h: 160, single: true },
};

export function Wordmark({
  variant = 'horizontal',
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const { base, w, h, single } = MAP[variant];
  const common = { alt: 'Munaxa', width: w, height: h, unoptimized: true } as const;
  if (single) {
    return (
      <Image src={`/${base}.png`} {...common} className={cn('h-9 w-auto object-contain', className)} />
    );
  }
  return (
    <>
      <Image src={`/${base}-light.png`} {...common} className={cn('h-9 w-auto object-contain dark:hidden', className)} />
      <Image src={`/${base}-dark.png`} {...common} className={cn('hidden h-9 w-auto object-contain dark:block', className)} />
    </>
  );
}
