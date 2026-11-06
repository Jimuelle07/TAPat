// The mobile app lives at /x and the desktop app at /desktop/x, chosen by screen width (Tailwind's `lg`).
export const DESKTOP_MEDIA = '(min-width: 1024px)';

/** Where this path belongs on this screen, or null when it is already in the right app. */
export function deviceTarget(path: string, isDesktop: boolean): string | null {
  const inDesktop = path === '/desktop' || path.startsWith('/desktop/');
  if (isDesktop === inDesktop) return null;
  if (isDesktop) return path === '/' ? '/desktop' : `/desktop${path}`;
  return path === '/desktop' ? '/' : path.slice('/desktop'.length);
}
