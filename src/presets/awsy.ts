import type {
  BenchmarkMap,
  BenchmarkPreset,
  CategoryMap,
} from '../domain/types';
import { ALT_PROJECT } from './constants';

const AWSY_FRAMEWORK_ID = 4;

const PALETTE = {
  red: '#dc4c4e',
  orange: '#FFA056',
};

const DESKTOP_FIREFOX_APPS = {
  firefox: {
    name: 'firefox',
    label: 'Firefox',
    color: PALETTE.orange,
    project: ALT_PROJECT,
    extraOptions: ['fission'],
  },
};

const AWSY_TESTS: Record<string, { extraOptions?: string[]; label?: string }> =
  {
    'Base Content Explicit': {},
    'Base Content Heap Unclassified': {},
    'Base Content JS': {},
    'Base Content Resident Unique Memory': {},
    'Explicit Memory': { extraOptions: ['tp6'] },
    'Heap Unclassified': { extraOptions: ['tp6'] },
    Images: { extraOptions: ['tp6'] },
    JS: { extraOptions: ['tp6'] },
    'Resident Memory': { extraOptions: ['tp6'] },
  };

export const BENCHMARKS: BenchmarkMap = {};
Object.entries(AWSY_TESTS).forEach(([testKey, test]) => {
  const docUrl = `https://firefox-source-docs.mozilla.org/testing/perfdocs/awsy.html#${testKey.toLowerCase().replace(/[_\s]/g, '-')}`;
  const benchmark: BenchmarkPreset = {
    compare: {},
    label: test.label || testKey,
    yLabel: 'Bytes',
    docUrl,
  };
  BENCHMARKS[testKey] = benchmark;
  Object.entries(DESKTOP_FIREFOX_APPS).forEach(([appKey, app]) => {
    const extraOptions = [...(test.extraOptions ?? []), ...app.extraOptions];
    benchmark.compare[appKey] = {
      color: app.color,
      label: app.label,
      frameworkId: AWSY_FRAMEWORK_ID,
      suite: testKey,
      project: app.project,
      option: 'opt',
      ...(extraOptions.length > 0 ? { extraOptions } : {}),
    };
  });
});

export const DEFAULT_CATEGORIES: CategoryMap = {
  memory: {
    suites: Object.keys(BENCHMARKS),
    label: 'Memory',
  },
};
