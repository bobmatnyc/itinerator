import { describe, expect, it } from 'vitest';
import { BUILD_NUMBER, SEMVER, VERSION, getVersionInfo } from '../../src/utils/version.js';

describe('Version utilities', () => {
  it('should export SEMVER from package.json', () => {
    expect(SEMVER).toBe('0.2.0');
  });

  it('should export BUILD_NUMBER as a number', () => {
    expect(typeof BUILD_NUMBER).toBe('number');
    expect(BUILD_NUMBER).toBeGreaterThanOrEqual(0);
  });

  it('should format VERSION correctly', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+\+build\.\d+$/);
    expect(VERSION).toBe(`${SEMVER}+build.${BUILD_NUMBER}`);
  });

  it('should return version info object', () => {
    const info = getVersionInfo();
    expect(info).toEqual({
      semver: SEMVER,
      buildNumber: BUILD_NUMBER,
      full: VERSION,
    });
  });
});
