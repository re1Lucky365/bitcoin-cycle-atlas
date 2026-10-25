// Retained for historical cycle-model regression probes. The current data page
// displays the separate asset-comparison model.
const scenarioRow = row => row.evidenceKind === 'scenario' || row.selectionKind === 'scenario' || row.kind === 'scenario' || row.kind === 'mixed';

/** Select whole point-to-point rows; their displayed dates and metric baselines never change. */
export function cycleTableRows(model, { cycle = 'recent', evidence = 'all', allRanges = false } = {}) {
  if (!model) return [];
  const cutoff = new Date(`${model.asOf}T00:00:00Z`);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 4);
  const recentStart = cutoff.toISOString().slice(0, 10);
  const eligible = model.rows.filter(row => {
    if (evidence === 'observed' && scenarioRow(row)) return false;
    if (evidence === 'scenario' && !scenarioRow(row)) return false;
    if (cycle === 'recent') return scenarioRow(row) || row.endDate >= recentStart;
    return cycle === 'all' || (row.cycleIds || [row.cycleId]).includes(cycle);
  });
  if (allRanges) return eligible;
  const observedRanges = eligible.filter(row => row.phaseId === 'range' && !scenarioRow(row));
  const recentObserved = observedRanges.findLast(row => !row.rightCensored) || observedRanges.at(-1);
  const nextConditional = eligible.find(row => row.phaseId === 'range' && scenarioRow(row));
  return eligible.filter(row => row.phaseId !== 'range' || row === recentObserved || row === nextConditional);
}
