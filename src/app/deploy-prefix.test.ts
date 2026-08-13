import { describe, expect, it } from 'vitest';
import { deployPrefixProblems, extractAssetReferences } from './deploy-prefix';

const BUILT = `<!doctype html>
<html lang="en"><head>
<script type="module" crossorigin src="./assets/index-abc123.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-def456.css">
</head><body><div id="app"></div></body></html>`;

describe('deployment prefix validation', () => {
  it('accepts a relative build that works under any path prefix', () => {
    expect(deployPrefixProblems(BUILT)).toEqual([]);
  });

  it('rejects root-absolute asset references', () => {
    const problems = deployPrefixProblems(
      BUILT.replace('./assets/index-abc123.js', '/assets/index-abc123.js'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('/assets/index-abc123.js');
  });

  it('ignores references that never resolve against the page prefix', () => {
    const html = BUILT.replace(
      '<div id="app"></div>',
      '<a href="https://treeherder.mozilla.org/">Treeherder</a><a href="#main">Skip</a><div id="app"></div>',
    );
    expect(deployPrefixProblems(html)).toEqual([]);
  });

  it('fails when the bundle or mount point is missing', () => {
    expect(
      deployPrefixProblems('<html><body><div id="app"></div></body></html>'),
    ).toEqual([
      'The built index.html references no hashed assets, so the bundle was not injected.',
    ]);
    expect(
      deployPrefixProblems(BUILT.replace('<div id="app"></div>', '')),
    ).toEqual(['The built index.html no longer contains the #app mount.']);
  });

  it('extracts both src and href references', () => {
    expect(extractAssetReferences(BUILT)).toEqual([
      './assets/index-abc123.js',
      './assets/index-def456.css',
    ]);
  });
});
