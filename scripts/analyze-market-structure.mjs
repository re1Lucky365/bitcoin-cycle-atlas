#!/usr/bin/env node
/** Rebuild the saved analysis from the bundled, attributed UTC daily closes. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeMarketStructure } from '../dist/market-structure.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = resolve(root, 'dist/data/btc-daily.json');
const outputPath = process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'docs/MARKET_STRUCTURE_RESULTS.json');
const summaryPath = process.argv[3] ? resolve(process.argv[3]) : resolve(root, 'dist/data/market-structure-summary.json');
const raw = await readFile(inputPath, 'utf8');
const input = JSON.parse(raw);
const analysis = analyzeMarketStructure(input);
analysis.reproducibility = {
  sourceFile: 'dist/data/btc-daily.json', inputFileSha256: createHash('sha256').update(raw).digest('hex'),
  sourceMetadata: input.meta, command: 'node scripts/analyze-market-structure.mjs',
  clockOrRandomnessUsed: false,
};

// UI tables need the same values, but not 5,939 detailed feature rows or 850 bars.
const {
  dailyStates, weeklyStates, dailyEpisodes, weeklyEpisodes, weeklyBars, ...summary
} = analysis;
summary.summaryProfile = 'tables-and-audit';
summary.omittedForSize = ['dailyStates', 'weeklyStates', 'dailyEpisodes', 'weeklyEpisodes', 'weeklyBars'];
summary.stateObservationCounts = { daily: dailyStates.length, weekly: weeklyStates.length };
const fullText = `${JSON.stringify(analysis, null, 2)}\n`;
const summaryText = `${JSON.stringify(summary)}\n`;
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, fullText);
await mkdir(dirname(summaryPath), { recursive: true });
await writeFile(summaryPath, summaryText);
console.log(JSON.stringify({
  asOf: analysis.asOf, observations: analysis.coverage.observations,
  output: relative(root, outputPath), bytes: Buffer.byteLength(fullText),
  summary: relative(root, summaryPath), summaryBytes: Buffer.byteLength(summaryText),
  dailyState: analysis.currentState.state, weeklyState: analysis.currentWeeklyState.state,
  completedMacroCycles: analysis.macroCycles.filter((c) => c.complete).length,
  matureBullSlopeDaysPerCycle: analysis.durationTrends.bullMatureIncludingLatestPeak.slopeDaysPerCycle,
  fibonacciCycleDifferencePP: analysis.fibonacci.completedCycleComparison.meanCycleDifferencePercentagePoints,
}, null, 2));
