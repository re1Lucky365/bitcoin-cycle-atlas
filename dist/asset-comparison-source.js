/** Share only active requests. The view owns the resolved model and explicit refresh. */
export function createAssetComparisonLoader({ embeddedData = () => null, fetchImpl = globalThis.fetch } = {}) {
  let pending = null;
  return function getComparisonDataset() {
    if (pending) return pending;
    pending = Promise.resolve().then(async () => {
      const embedded = embeddedData();
      if (embedded != null) return JSON.parse(embedded);
      const response = await fetchImpl('./data/asset-comparison.json', {
        cache: 'no-cache', signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`자산 비교 자료를 불러오지 못했습니다 (${response.status}).`);
      return response.json();
    }).finally(() => { pending = null; });
    return pending;
  };
}
