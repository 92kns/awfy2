/**
 * Deployment-prefix validation for the static GitHub Pages build.
 *
 * The dashboard is served from more than one prefix: `/awfy2/` on GitHub Pages
 * and `/gh/awfy2/` behind the perf-labs proxy. Vite is configured with
 * `base: './'` so every asset reference stays relative, but a stray
 * root-absolute `/assets/...` URL still builds and still loads on a local
 * preview at `/`. It only 404s once deployed under a prefix, which is exactly
 * the failure that must not reach production. Asserting the built HTML keeps
 * that guarantee mechanical rather than a convention.
 */

/** Attribute values that legitimately never resolve against the page prefix. */
function isPrefixIndependent(value: string): boolean {
  return (
    value === '' ||
    value.startsWith('#') ||
    value.startsWith('?') ||
    value.startsWith('data:') ||
    value.startsWith('mailto:') ||
    /^[a-z][a-z0-9+.-]*:/i.test(value) ||
    value.startsWith('//')
  );
}

export function extractAssetReferences(html: string): string[] {
  return [...html.matchAll(/(?:src|href)\s*=\s*"([^"]*)"/gi)].map(
    (match) => match[1] ?? '',
  );
}

/**
 * Returns one message per reference that would break under a path prefix.
 * An empty array means the build is safe to publish at any prefix.
 */
export function deployPrefixProblems(html: string): string[] {
  const problems = extractAssetReferences(html)
    .filter((value) => !isPrefixIndependent(value))
    .filter((value) => value.startsWith('/'))
    .map(
      (value) =>
        `Root-absolute asset reference "${value}" breaks when the dashboard is served from a path prefix; keep Vite's base as './'.`,
    );

  if (!/<div id="app"><\/div>/.test(html)) {
    problems.push('The built index.html no longer contains the #app mount.');
  }
  if (
    extractAssetReferences(html).every((value) => !value.includes('assets/'))
  ) {
    problems.push(
      'The built index.html references no hashed assets, so the bundle was not injected.',
    );
  }
  return problems;
}
