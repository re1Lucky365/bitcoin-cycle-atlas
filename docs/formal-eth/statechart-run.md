# pstack statechart execution receipt

## Tools and inputs

- Official source: https://github.com/cursor/plugins/tree/main/pstack
- Checked-out plugin commit: 9580c23696ac8d7abed0c166f2f9918800afb819
- Skills read: create-formal-verification-skill and statechart.
- CLI help was read before execution. The existing checksum-pinned TLC 1.7.4
  jar was used; no replacement Java/TLC toolchain was downloaded.
- Node 24.22.1; Java 17.0.20; embedded checker banner TLC2 version 2.19,
  revision 5a47802. Renderer packages: pele 1.8.0 and @resvg/resvg-js 2.6.2.
- Inputs are copied from verification/eth-state into scratch before execution.
  statechart/inputs-sha256.json records the final source/model/replay hashes.

## Actual regeneration command

The following was run from /tmp/eth-statechart-audit, after copying every file
from verification/eth-state into that directory. Adjust the two checkout paths
for another machine; the generated project skill delegates evolving options to
the pstack /statechart skill.

    cd /tmp/eth-statechart-audit
    XDG_CACHE_HOME=/tmp/eth-statechart-cache \
    TLA2TOOLS=/workspace/scratch/f6561dd83ec0/bitcoin-cycle-atlas/build/formal-tools/tla2tools-1.7.4.jar \
    node /tmp/cursor-plugins-system-audit/pstack/skills/statechart/scripts/statechart.mjs \
      from-spec /tmp/eth-statechart-audit/EthLoadBaseline.tla \
      --config /tmp/eth-statechart-audit/baseline.cfg \
      --map /tmp/eth-statechart-audit/EthLoad.map.mjs \
      --fixed /tmp/eth-statechart-audit/EthLoad.tla \
      --fixed-config /tmp/eth-statechart-audit/EthLoad.cfg \
      --label 'ETH lifecycle fix' \
      --expect-broken ReadyHasUsableView,NoHiddenPublication,NavigationSurvivesRefresh \
      --cover --png \
      --title 'ETH lifecycle and refresh ownership' \
      --out /tmp/eth-statechart-audit/result

Exit status: 0, with exactly the three preserved baseline failures.
The pipeline ran TLC 10 times for the baseline and 7 times for the fixed model.
Every fixed-model invariant held. No uncited conditions were reported, and the
action/guard correspondence was also reviewed manually in README.md.

The synchronous initializer setup and first load cannot be interrupted by a
browser event. That boundary is represented in the Open/Hide/Resize guards.
The Next definition is a disjunction of individually named actions so TLC keeps
the actual step labels; a conditional Next that obscured them was discarded
before this receipt was generated.

Independent cold review found that an earlier model incorrectly treated loading
as an immediate refresh lock. The current model removes that condition and
permits repeated refresh while loading. The new seventeenth initializer replay
confirms that two clicks before the disabled state is painted start two requests,
abort the first, and preserve the newer result after the old response arrives.
No production runtime change was needed for this model correspondence correction.
The expanded model and every chart/receipt below were rerun after the correction.

## Counts from pstack's summary.json

| Field | Value |
| --- | ---: |
| modelStates | 3,503 |
| modelTransitions | 12,879 |
| chartStates | 10 |
| chartTransitions | 12 |
| chartStatus.works | 11 |
| chartStatus.wrong | 0 |
| chartStatus.fixed | 3 |
| chartStatus.mixed / after / worse | 0 / 0 / 0 |

These model counts describe pstack's baseline graph. The separate exhaustive
fixed-model check in verification.json generated 11,109 states, found 2,243
distinct states, and left zero on its queue. Do not confuse graph-state counts
with generated successor counts or with an unbounded proof.

The cover view omits 4 of 14 reader states and 34 of 46 reader transitions.
The omitted states are Loading after retry, Observed chart with refresh error,
Retry available, and Retry waiting for first display. All omissions remain
listed in summary.json, and the check still explored them.

## Each shortest bug story was replayed

| Chart | Preserved invariant and shortest reader actions | Real initializer replay | Fixed result |
| --- | --- | --- | --- |
| bug-1 | NoHiddenPublication: open → hide → layout notification → render | ETH shortest hidden-layout counterexample does not update an empty suspended page | No hidden status write; render is not scheduled |
| bug-2 | ReadyHasUsableView: open → hide → revoked saved prices arrive → initial frame | ETH shortest revoked-initializer counterexample cannot release a suspended empty page | Loading shell stays unreleased until restored current data or retry exists |
| bug-3 | NavigationSurvivesRefresh: open → saved prices → initial frame → refresh → pan → live prices | ETH refresh preserves a date range chosen while its request was pending | The newer selected range remains displayed |

pstack's classes contain 355, 13 and 18 counterexample endpoints for these
respective bug classes. The shortest reader paths have 4, 4 and 6 actions.
Their fix labels are Page suspended, Page suspended, and Observed chart at
chosen range. The preserved baseline implementation produces the expected
assertion failures; baseline-replay.txt records 17 tests, 10 passes and 7 failures.
The fixed module passes all 17, and the verifier detects all nine deliberate
real-code mutations before restoring and passing the original source again.
The verifier enforces a complete 17-case TAP plan and totals: original/restored
17 passes and zero failures, skips, cancellations and todos; all nine mutation
runs execute 17 cases with an intended assertion failure and no skipped,
cancelled or todo cases.

Hidden callback scheduling is a deliberate over-approximation. It establishes
the defensive guard contract, not a claim that a browser normally paints a
frozen BFCache document. A separate restored-page replay proves the premature
readiness failure with the old callback after pageshow.

## Visual inspection and saved evidence

All four PNGs were opened and inspected after the final run:

- chart.png: ten-state cover view, visible baseline/fix branching, complete labels.
- bug-1.png: numbered steps 1–4, hidden-render block and fix loop readable.
- bug-2.png: numbered steps 1–4, revoked arrival and guarded completion readable.
- bug-3.png: numbered steps 1–6, refresh/navigation branch and preserved range readable.

No cropped node text, overlapping step labels or unreadable numbering was found.
The green boundary means a baseline failure was fixed or a state is new in the
fix; the legend explicitly describes that comparison. It does not mean the
baseline's erroneous behavior is desirable.

The Mermaid, PNG, stories.md and summary.json are copied unchanged from the
official tool output. tlc-receipt.tar.gz preserves its full raw TLC directory,
including configurations, checker output, generated rule modules and DOT graphs;
compression avoids committing many megabytes of repetitive state text.
