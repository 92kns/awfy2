import type {
  BenchmarkMap,
  BenchmarkPreset,
  CategoryMap,
  DashboardConfig,
  DashboardPreset,
} from '../domain/types';
import { PROJECT, ALT_PROJECT } from './constants';
import {
  BENCHMARKS as AWSY_BENCHMARKS,
  DEFAULT_CATEGORIES as AWSY_CATEGORIES,
} from './awsy';
import {
  BENCHMARKS as H3_BENCHMARKS,
  DEFAULT_SUITES as H3_SUITES,
} from './network';

interface AppDefinition {
  applicablePlatforms?: readonly string[];
  color: string;
  extraOptions?: string[];
  label: string;
  name: string;
  platform?: string;
  platformSuffix?: string;
  project?: string;
  suiteSuffix?: string;
}

interface TestDefinition {
  label?: string;
  test?: string;
}

const TALOS_FRAMEWORK_ID = 1;
const JSBENCH_FRAMEWORK_ID = 11;
const BROWSERTIME_FRAMEWORK_ID = 13;

const CURRENT_MAC_PLATFORMS = [
  'macosx1500-aarch64-shippable',
  'macosx1470-64-shippable',
] as const;
const SAFARI_TP_PLATFORMS = ['macosx1500-aarch64-shippable'] as const;
const JSBENCH_PLATFORMS = ['linux2404-64-shippable'] as const;
const UNITY_FIREFOX_PLATFORMS = [
  'linux1804-64-shippable-qr',
  'linux2404-64-shippable',
  'macosx1470-64-shippable',
  'windows11-64-24h2-shippable',
] as const;
const UNITY_CHROME_PLATFORMS = [
  'linux1804-64-shippable-qr',
  'macosx1470-64-shippable',
] as const;

const PALETTE = {
  blue: '#446e9e',
  emerald: '#4f9745',
  indigo: '#6F4E7C',
  red: '#dc4c4e',
  orange: '#FFA056',
  yellow: '#ebc23f',
  violet: '#a66e97',
  pink: '#fe939e',
};

export const AWFY_BENCHMARKS: BenchmarkMap = {
  'speedometer3-android': {
    compare: {
      'chrome-m': {
        color: PALETTE.blue,
        label: 'Chrome',
        frameworkId: BROWSERTIME_FRAMEWORK_ID,
        suite: 'speedometer3',
        option: 'opt',
        application: 'chrome-m',
        project: PROJECT,
      },
      fenix: {
        color: PALETTE.orange,
        label: 'Fenix',
        frameworkId: BROWSERTIME_FRAMEWORK_ID,
        suite: 'speedometer3',
        option: 'opt',
        application: 'fenix',
        project: ALT_PROJECT,
        extraOptions: ['webrender'],
      },
    },
    label: 'Speedometer 3',
  },
  'jetstream3-android': {
    compare: {
      'chrome-m': {
        color: PALETTE.blue,
        label: 'Chrome',
        frameworkId: BROWSERTIME_FRAMEWORK_ID,
        suite: 'jetstream3',
        option: 'opt',
        application: 'chrome-m',
        project: PROJECT,
      },
      fenix: {
        color: PALETTE.orange,
        label: 'Fenix',
        frameworkId: BROWSERTIME_FRAMEWORK_ID,
        suite: 'jetstream3',
        option: 'opt',
        application: 'fenix',
        project: ALT_PROJECT,
        extraOptions: ['webrender'],
      },
    },
    label: 'JetStream 3',
  },
};

const DESKTOP_FIREFOX_APPS: Record<string, AppDefinition> = {
  firefox: {
    name: 'firefox',
    label: 'Firefox',
    color: PALETTE.orange,
    project: ALT_PROJECT,
    extraOptions: ['fission', 'webrender'],
  },
};

const DESKTOP_APPS: Record<string, AppDefinition> = {
  ...DESKTOP_FIREFOX_APPS,
  chrome: {
    name: 'chrome',
    label: 'Chrome',
    color: PALETTE.blue,
  },
  safari: {
    name: 'safari',
    label: 'Safari',
    color: PALETTE.yellow,
    applicablePlatforms: CURRENT_MAC_PLATFORMS,
  },
  safari_tp: {
    name: 'safari-tp',
    label: 'Safari Technology Preview',
    color: PALETTE.indigo,
    applicablePlatforms: SAFARI_TP_PLATFORMS,
  },
};

const WASM_APPS: Record<string, AppDefinition> = {
  ...DESKTOP_APPS,
  firefox: {
    name: 'firefox',
    label: 'Firefox (tiering)',
    color: PALETTE.orange,
    project: PROJECT,
    extraOptions: ['fission', 'webrender'],
  },
  'baseline-firefox': {
    name: 'firefox',
    label: 'Firefox (wasm-baseline)',
    color: PALETTE.violet,
    project: PROJECT,
    suiteSuffix: 'baseline',
    extraOptions: ['fission', 'webrender'],
  },
  'optimizing-firefox': {
    name: 'firefox',
    label: 'Firefox (wasm-optimizing)',
    color: PALETTE.pink,
    project: PROJECT,
    suiteSuffix: 'optimizing',
    extraOptions: ['fission', 'webrender'],
  },
};

const DESKTOP_CATEGORIES: CategoryMap = {
  benchmarks: {
    suites: [],
    label: 'Benchmarks',
  },
  'cold-page-load': {
    suites: [],
    label: 'Cold Page Load (Recorded)',
  },
  'cold-page-load-live': {
    suites: [],
    label: 'Cold Page Load (Live)',
  },
  'warm-page-load': {
    suites: [],
    label: 'Warm Page Load (Recorded)',
  },
  'warm-page-load-live': {
    suites: [],
    label: 'Warm Page Load (Live)',
  },
  ...AWSY_CATEGORIES,
  network: {
    suites: H3_SUITES,
    label: 'Network',
  },
};

const TALOS_TESTS: Record<string, TestDefinition> = {
  displaylist_mutate: { label: 'Displaylist mutate' },
  glvideo: { label: 'Gl Video', test: 'Mean tick time across 100 ticks: ' },
  kraken: { label: 'Kraken' },
  rasterflood_gradient: { label: 'Rasterflood (Gradient)' },
  rasterflood_svg: { label: 'Rasterflood SVG' },
  tabpaint: {},
  tart: {},
  tp5o: {},
  ts_paint: {},
  tsvg_static: {},
  tsvgr_opacity: {},
  tsvgx: {},
  sessionrestore: {},
  sessionrestore_no_auto_restore: {},
};

const TALOS_BENCHMARKS: BenchmarkMap = {};
Object.entries(TALOS_TESTS).forEach(([testKey, test]) => {
  const docUrl = `https://firefox-source-docs.mozilla.org/testing/perfdocs/talos.html#${testKey.replace(/_/g, '-')}`;
  const benchmark: BenchmarkPreset = {
    compare: {},
    label: test.label || testKey,
    docUrl,
  };
  TALOS_BENCHMARKS[testKey] = benchmark;
  Object.entries(DESKTOP_FIREFOX_APPS).forEach(([appKey, app]) => {
    benchmark.compare[appKey] = {
      color: app.color,
      label: app.label,
      frameworkId: TALOS_FRAMEWORK_ID,
      suite: testKey,
      test: test.test,
      platformSuffix: app.platformSuffix,
      project: app.project,
      option: 'opt',
      extraOptions: ['e10s', 'stylo', ...(app.extraOptions ?? [])],
    };
  });
  DESKTOP_CATEGORIES.benchmarks!.suites.push(testKey);
});

const RAPTOR_TESTS: Record<string, TestDefinition> = {
  'assorted-dom': { label: 'Assorted DOM' },
  'motionmark-1-3': { label: 'MotionMark 1.3' },
  'motionmark-htmlsuite-1-3': { label: 'MotionMark HtmlSuite 1.3' },
  speedometer3: { label: 'Speedometer 3' },
  stylebench: { label: 'StyleBench' },
  sunspider: { label: 'SunSpider' },
  webaudio: { label: 'WebAudio' },
  'unity-webgl': { label: 'Unity WebGL' },
  ares6: { label: 'Ares6' },
  'wasm-godot': { label: 'WebAssembly Godot' },
  'wasm-misc': { label: 'WebAssembly Embenchen' },
  jetstream2: { label: 'JetStream 2' },
  jetstream3: { label: 'JetStream 3' },
  'matrix-react-bench': { label: 'Matrix React' },
};

const RAPTOR_BENCHMARKS: BenchmarkMap = {};
const UNITY_WEBGL_APPS: Record<string, AppDefinition> = {
  firefox: {
    ...DESKTOP_FIREFOX_APPS.firefox!,
    // Unity has live Firefox data on mozilla-central, not autoland.
    applicablePlatforms: UNITY_FIREFOX_PLATFORMS,
    project: PROJECT,
  },
  chrome: {
    ...DESKTOP_APPS.chrome!,
    applicablePlatforms: UNITY_CHROME_PLATFORMS,
  },
};
Object.entries(RAPTOR_TESTS).forEach(([testKey, test]) => {
  const bmKey = `raptor-desktop-${testKey}`;
  const benchmark: BenchmarkPreset = {
    compare: {},
    label: test.label ?? testKey,
  };
  RAPTOR_BENCHMARKS[bmKey] = benchmark;
  const apps =
    testKey === 'unity-webgl'
      ? UNITY_WEBGL_APPS
      : testKey.startsWith('wasm')
        ? WASM_APPS
        : DESKTOP_APPS;
  Object.entries(apps).forEach(([appKey, app]) => {
    benchmark.compare[appKey] = {
      color: app.color,
      label: app.label,
      applicablePlatforms: app.applicablePlatforms,
      frameworkId: BROWSERTIME_FRAMEWORK_ID,
      suite: [testKey, app.suiteSuffix].filter(Boolean).join('-'),
      application: app.name,
      platformSuffix: app.platformSuffix,
      project: app.project,
      option: 'opt',
      extraOptions: app.extraOptions,
    };
  });
  DESKTOP_CATEGORIES.benchmarks!.suites.push(bmKey);
});

export const BENCHMARKS: BenchmarkMap = {
  ...TALOS_BENCHMARKS,
  ...RAPTOR_BENCHMARKS,
  ...AWFY_BENCHMARKS,
  ...AWSY_BENCHMARKS,
  ...H3_BENCHMARKS,
};

const JSBENCH_APPS: Record<string, Omit<AppDefinition, 'name'>> = {
  sm: {
    label: 'SpiderMonkey',
    color: PALETTE.violet,
    project: ALT_PROJECT,
  },
  v8: {
    label: 'Chromium v8',
    color: PALETTE.pink,
  },
};

const JSBENCH_TESTS: Record<string, TestDefinition> = {
  ares6: { label: 'Ares 6' },
  octane: { label: 'Octane' },
  'six-speed': { label: 'Six Speed' },
  sunspider: { label: 'SunSpider' },
  'web-tooling-benchmark': { label: 'Web Tooling' },
};

Object.entries(JSBENCH_TESTS).forEach(([testKey, test]) => {
  if (!(testKey in BENCHMARKS)) {
    BENCHMARKS[testKey] = {
      compare: {},
      label: test.label ?? testKey,
    };
    DESKTOP_CATEGORIES.benchmarks!.suites.push(testKey);
  }
  const benchmark = BENCHMARKS[testKey]!;
  Object.entries(JSBENCH_APPS).forEach(([appKey, app]) => {
    benchmark.compare[appKey] = {
      color: app.color,
      label: app.label,
      applicablePlatforms: JSBENCH_PLATFORMS,
      frameworkId: JSBENCH_FRAMEWORK_ID,
      suite: `${testKey}-${appKey}`,
      project: app.project,
      option: 'opt',
    };
  });
});

const SITES: Record<string, string> = {
  allrecipes: 'All Recipes',
  amazon: 'Amazon',
  'amazon-search': 'Amazon (search)',
  bing: 'Bing',
  'bing-search': 'Bing',
  'bing-search-restaurants': 'Bing (restaurants)',
  booking: 'Booking',
  'booking-sf': 'Booking (hotel)',
  buzzfeed: 'BuzzFeed',
  cnn: 'CNN',
  'cnn-ampstories': 'CNN AMP Stories',
  dailymail: 'Daily Mail',
  discord: 'Discord',
  docs: 'Google Docs',
  ebay: 'Ebay',
  'ebay-kleinanzeigen': 'Ebay Kleinanzeigen',
  'ebay-kleinanzeigen-search': 'Ebay Kleinanzeigen (search)',
  espn: 'ESPN',
  expedia: 'Expedia',
  facebook: 'Facebook',
  'facebook-cristiano': 'Facebook (page)',
  fandom: 'Fandom',
  fashionbeans: 'FashionBeans',
  google: 'Google',
  'google-accounts': 'Google Accounts',
  'google-docs': 'Google Docs',
  'google-docs-canvas': 'Google Docs Canvas Preview',
  'google-search': 'Google',
  'google-search-restaurants': 'Google Restaurants',
  'google-slides': 'Google Slides',
  'google-mail': 'Google Mail',
  'google-maps': 'Google Maps',
  imdb: 'IMDb',
  'imdb-firefox': 'IMDb (title)',
  imgur: 'Imgur',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  'medium-article': 'Medium',
  microsoft: 'Microsoft',
  'microsoft-support': 'Microsoft Support',
  netflix: 'Netflix',
  nytimes: 'The New York Times',
  office: 'Office',
  outlook: 'Outlook',
  paypal: 'PayPal',
  'people-article': 'People',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  'reddit-thread': 'Reddit (thread)',
  'rumble-fox': 'Rumble',
  sheets: 'Google Sheets',
  sina: 'Sina',
  slides: 'Google Slides',
  stackoverflow: 'StackOverflow',
  'stackoverflow-question': 'StackOverflow (question)',
  tumblr: 'Tumblr',
  twitch: 'Twitch',
  twitter: 'Twitter',
  'urbandictionary-define': 'Urban Dictionary',
  'web-de': 'Web De',
  wikia: 'Wikia',
  'wikia-marvel': 'Wikia',
  wikipedia: 'Wikipedia',
  'yahoo-mail': 'Yahoo Mail',
  youtube: 'YouTube',
  'youtube-watch': 'YouTube Watch',
};

Object.entries(SITES).forEach(([siteKey, siteLabel]) => {
  ['cold', 'warm'].forEach((cacheVariant) => {
    [true, false].forEach((live) => {
      let category = `${cacheVariant}-page-load`;
      let bmKey = `tp6-${siteKey}-${cacheVariant}`;
      if (live) {
        bmKey += '-live';
        category += '-live';
      }
      const benchmark: BenchmarkPreset = { compare: {}, label: siteLabel };
      BENCHMARKS[bmKey] = benchmark;
      Object.entries(DESKTOP_APPS).forEach(([appKey, app]) => {
        benchmark.compare[appKey] = {
          color: app.color,
          label: app.label,
          frameworkId: BROWSERTIME_FRAMEWORK_ID,
          suite: siteKey,
          test: 'SpeedIndex',
          application: app.name,
          platformSuffix: app.platformSuffix,
          project: live ? PROJECT : app.project,
          option: 'opt',
          extraOptions: [
            cacheVariant,
            ...(live ? ['live'] : []),
            ...(app.extraOptions ?? []),
          ],
        };
      });
      DESKTOP_CATEGORIES[category]!.suites.push(bmKey);
    });
  });
});

const MOBILE_APPS: Record<string, AppDefinition> = {
  'chrome-m': {
    name: 'chrome-m',
    label: 'Chrome',
    color: PALETTE.blue,
  },
  fenix: {
    name: 'fenix',
    label: 'Fenix-nofis',
    color: PALETTE.orange,
    project: ALT_PROJECT,
    extraOptions: ['webrender'],
  },
  'fenix-fission': {
    name: 'fenix',
    label: 'Fenix-fission',
    color: PALETTE.emerald,
    project: PROJECT,
    extraOptions: ['webrender', 'fission'],
  },
  geckoview: {
    name: 'geckoview',
    label: 'GeckoView-nofis',
    color: PALETTE.indigo,
    project: ALT_PROJECT,
    extraOptions: ['webrender'],
  },
  'geckoview-fission': {
    name: 'geckoview',
    label: 'GeckoView-fission',
    color: PALETTE.red,
    project: PROJECT,
    extraOptions: ['webrender', 'fission'],
  },
};

const MOBILE_CATEGORIES: CategoryMap = {
  benchmarks: {
    suites: ['speedometer3-android', 'jetstream3-android'],
    label: 'Benchmarks',
  },
  'cold-page-load': {
    suites: [],
    label: 'Cold Page Load (Recorded)',
  },
  'cold-page-load-live': {
    suites: [],
    label: 'Cold Page Load (Live)',
  },
  'warm-page-load': {
    suites: [],
    label: 'Warm Page Load (Recorded)',
  },
  'warm-page-load-live': {
    suites: [],
    label: 'Warm Page Load (Live)',
  },
};

Object.entries(SITES).forEach(([siteKey, siteLabel]) => {
  ['cold', 'warm'].forEach((cacheVariant) => {
    [true, false].forEach((live) => {
      let category = `${cacheVariant}-page-load`;
      let bmKey = `tp6m-${siteKey}-${cacheVariant}`;
      if (live) {
        bmKey += '-live';
        category += '-live';
      }
      const benchmark: BenchmarkPreset = { compare: {}, label: siteLabel };
      BENCHMARKS[bmKey] = benchmark;
      Object.entries(MOBILE_APPS).forEach(([appKey, app]) => {
        benchmark.compare[appKey] = {
          color: app.color,
          label: app.label,
          frameworkId: BROWSERTIME_FRAMEWORK_ID,
          suite: siteKey,
          test: 'SpeedIndex',
          application: app.name,
          platformSuffix: app.platformSuffix,
          project: live ? PROJECT : app.project,
          option: 'opt',
          extraOptions: [
            cacheVariant,
            ...(live ? ['live'] : []),
            ...(app.extraOptions ?? []),
          ],
        };
      });
      MOBILE_CATEGORIES[category]!.suites.push(bmKey);
    });
  });
});

export const CONFIG: DashboardConfig = {
  default: {
    category: 'benchmarks',
    dayRange: 60, // # days
    platform: 'win11',
  },
  dayRange: [1, 2, 7, 14, 30, 60, 90, 365],
  views: {
    linux64: {
      label: 'Linux 64bit',
      platforms: ['linux64-shippable', 'linux1804-64-shippable-qr'],
      categories: DESKTOP_CATEGORIES,
    },
    linux2404: {
      label: 'Ubuntu 24.04 64bit',
      platforms: ['linux2404-64-shippable'],
      categories: DESKTOP_CATEGORIES,
    },
    // mac11m1: {
    //   label: 'macOS 11 "Big Sur" (M1)',
    //   platforms: ['macosx1100-64-shippable-qr'],
    //   categories: DESKTOP_CATEGORIES,
    // },
    mac1500: {
      label: 'macOS 15.0 "Sequoia" (AArch64)',
      platforms: ['macosx1500-aarch64-shippable'],
      categories: DESKTOP_CATEGORIES,
    },
    mac1470: {
      label: 'macOS 14.7 "Sonoma" (x64)',
      platforms: ['macosx1470-64-shippable'],
      categories: DESKTOP_CATEGORIES,
    },
    win11: {
      label: 'Windows 11 64bit',
      platforms: ['windows11-64-shippable-qr', 'windows11-64-24h2-shippable'],
      categories: DESKTOP_CATEGORIES,
    },
    androidGalaxyA55: {
      label: 'Android (Samsung Galaxy A55)',
      platforms: ['android-hw-a55-14-0-aarch64-shippable'],
      categories: MOBILE_CATEGORIES,
    },
  },
};

export const AWFY_PRESET: DashboardPreset = {
  benchmarks: BENCHMARKS,
  config: CONFIG,
  id: 'awfy',
  maxDayRange: 365,
  title: 'Are We Fast Yet?',
};

export default AWFY_PRESET;
