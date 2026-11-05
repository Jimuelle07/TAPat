import { describe, expect, it } from 'vitest';
import { formatPhp } from '@tapat/shared';

describe('@tapat/shared from apps/web', () => {
  it('formats 350 PHP from @tapat/shared in apps/web', () => {
    expect(formatPhp(350_000_000n)).toBe('₱350.00');
  });
});
