import { Shell } from '@/components/shell';

/**
 * Layout for all authenticated pages. Mounting {@link Shell} here (rather than inside each page)
 * keeps the sidebar and auth state alive across client-side navigation — clicking a nav item swaps
 * only the page content, so the nav no longer remounts, reloads, or loses its scroll position.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
