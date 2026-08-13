import type { ResolvedSeries } from '../domain/types';
import { TREEHERDER } from '../presets/constants';

const DEFAULT_PROJECT = 'mozilla-central';

export function signaturesUrl(project = DEFAULT_PROJECT): URL {
  return new URL(`/api/project/${project}/performance/signatures/`, TREEHERDER);
}

export function platformSignaturesUrl(series: ResolvedSeries): URL {
  const url = signaturesUrl(series.project);
  url.searchParams.set('framework', String(series.frameworkId));
  url.searchParams.set('platform', series.platform);
  url.searchParams.set('subtests', '0');
  return url;
}

export function subtestsUrl(
  project: string | undefined,
  parentHash: string,
): URL {
  const url = signaturesUrl(project);
  url.searchParams.set('parent_signature', parentHash);
  return url;
}

export function optionCollectionsUrl(): URL {
  return new URL('/api/optioncollectionhash/', TREEHERDER);
}

export function repositoriesUrl(): URL {
  return new URL('/api/repository/', TREEHERDER);
}

export function alertSummaryUrl(
  signatureId: number,
  repositoryId: number,
  intervalSeconds: number,
  limit = 100,
): URL {
  const url = new URL('/api/performance/alertsummary/', TREEHERDER);
  url.searchParams.set('alerts__series_signature', String(signatureId));
  url.searchParams.set('repository', String(repositoryId));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('timerange', String(intervalSeconds));
  return url;
}

/** A stable Treeherder jobs view for one revision in a repository. */
export function treeherderPushUrl(
  project: string | undefined,
  revision: string,
): string {
  const url = new URL('/jobs', TREEHERDER);
  url.searchParams.set('repo', project ?? DEFAULT_PROJECT);
  url.searchParams.set('revision', revision);
  return url.toString();
}

export function performanceDataUrls(
  series: Pick<ResolvedSeries, 'frameworkId' | 'project'>,
  signatureIds: readonly number[],
  intervalSeconds: number,
): URL[] {
  const sortedIds = [...signatureIds].sort((a, b) => a - b);
  const urls: URL[] = [];

  for (let offset = 0; offset < sortedIds.length; offset += 100) {
    const url = new URL(
      `/api/project/${series.project ?? DEFAULT_PROJECT}/performance/data/`,
      TREEHERDER,
    );
    url.searchParams.set('framework', String(series.frameworkId));
    url.searchParams.set('interval', String(intervalSeconds));
    url.searchParams.set('no_retriggers', 'true');
    for (const id of sortedIds.slice(offset, offset + 100)) {
      url.searchParams.append('signature_id', String(id));
    }
    urls.push(url);
  }

  return urls;
}

export function perfherderGraphUrl(
  series: Pick<ResolvedSeries, 'frameworkId' | 'project'>,
  signatureIds: readonly number[],
  intervalSeconds: number,
): string {
  const url = new URL('/perf.html', TREEHERDER);
  const params = new URLSearchParams({ timerange: String(intervalSeconds) });
  const project = series.project ?? DEFAULT_PROJECT;
  for (const id of [...signatureIds].sort((a, b) => a - b)) {
    params.append('series', `${project},${id},1,${series.frameworkId}`);
  }
  url.hash = `/graphs?${params.toString()}`;
  return url.toString();
}
