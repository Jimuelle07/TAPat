import { describe, expect, it } from 'vitest';
import { deviceTarget } from './device-route';

describe('deviceTarget', () => {
  it('sends a laptop on a mobile path to the desktop app', () => {
    expect(deviceTarget('/dashboard', true)).toBe('/desktop');
    expect(deviceTarget('/station/A', true)).toBe('/desktop/station/A');
  });

  it('sends a phone on a desktop path to the mobile app', () => {
    expect(deviceTarget('/desktop', false)).toBe('/dashboard');
    expect(deviceTarget('/desktop/intake/beneficiaries/b1', false)).toBe('/intake/beneficiaries/b1');
  });

  it('leaves the landing page alone on every screen', () => {
    expect(deviceTarget('/', true)).toBeNull();
    expect(deviceTarget('/', false)).toBeNull();
  });

  it('leaves a path already in the right app alone, so the two never loop', () => {
    expect(deviceTarget('/desktop', true)).toBeNull();
    expect(deviceTarget('/desktop/cards', true)).toBeNull();
    expect(deviceTarget('/dashboard', false)).toBeNull();
    expect(deviceTarget('/cards', false)).toBeNull();
  });
});
