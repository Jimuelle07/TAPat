// The mobile app lives at /x and the desktop app at /desktop/x, chosen by screen width (Tailwind's `lg`).
export const DESKTOP_MEDIA = '(min-width: 1024px)';

/** Where this path belongs on this screen, or null when it is already in the right app. */
export function deviceTarget(path: string, isDesktop: boolean): string | null {
  // The landing page is responsive, so it belongs to neither app.
  if (path === '/') return null;
  const inDesktop = path === '/desktop' || path.startsWith('/desktop/');
  if (isDesktop === inDesktop) return null;
  if (isDesktop) return path === '/dashboard' ? '/desktop' : `/desktop${path}`;
  return path === '/desktop' ? '/dashboard' : path.slice('/desktop'.length);
}
