import { describe, expect, it } from 'vitest';
import { shouldReverseYAxis } from './chart-options';

describe('chart axis direction', () => {
  it('puts better results toward the top of the chart', () => {
    expect(shouldReverseYAxis(false)).toBe(false);
    expect(shouldReverseYAxis(true)).toBe(true);
    expect(shouldReverseYAxis(undefined)).toBe(false);
  });
});
