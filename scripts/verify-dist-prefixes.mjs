/**
 * Asserts that `dist/` can be published under any path prefix.
 *
 * Run after `vite build` so a regression in `base` or a hand-written absolute
 * URL fails CI rather than 404ing only once deployed to GitHub Pages.
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const INDEX_URL = new URL('../dist/index.html', import.meta.url);

const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
});

try {
  const { deployPrefixProblems } = await vite.ssrLoadModule(
    '/src/app/deploy-prefix.ts',
  );

  let html;
  try {
    html = await readFile(INDEX_URL, 'utf8');
  } catch (error) {
    console.error(
      `Could not read dist/index.html; run \`npm run build\` first. (${error.message})`,
    );
    process.exitCode = 1;
    html = undefined;
  }

  if (html !== undefined) {
    const problems = deployPrefixProblems(html);
    if (problems.length === 0) {
      console.log(
        'dist/index.html uses only prefix-relative references; safe to publish at /awfy2/ or behind a proxy prefix.',
      );
    } else {
      for (const problem of problems) console.error(`- ${problem}`);
      process.exitCode = 1;
    }
  }
} finally {
  await vite.close();
}
