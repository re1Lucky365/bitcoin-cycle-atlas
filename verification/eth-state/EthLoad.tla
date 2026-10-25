------------------------------ MODULE EthLoad ------------------------------
EXTENDS Naturals, FiniteSets

CONSTANTS RequestLimit, BootOnRender, RespectSuspension, PreserveNavigation,
          GuardResponses, GuardErrors
Ids == 1..RequestLimit
Phases == {"unused", "archive", "live", "done"}
Intervals == {"daily", "weekly"}
VARIABLE s
vars == <<s>>

Init ==
  s = [issued |-> 0, active |-> 0, phase |-> [i \in Ids |-> "unused"],
       forced |-> [i \in Ids |-> FALSE], navigated |-> [i \in Ids |-> FALSE],
       attached |-> TRUE, loading |-> FALSE, prices |-> 0, priceError |-> FALSE,
       refreshError |-> FALSE, renderPending |-> FALSE, ready |-> FALSE,
       readyCount |-> 0, initialDone |-> FALSE, frequency |-> "daily",
       range |-> "auto", badReadiness |-> FALSE, hiddenPublication |-> FALSE,
       stalePublication |-> FALSE, lostNavigation |-> FALSE]

Usable == s.prices > 0 \/ s.priceError
CanRender == s.attached \/ ~RespectSuspension

\* One synchronous load() start, through its first await; a cached non-force
\* daily/weekly load has no awaited HTTP and completes in this same action.
\* dist/eth-view.js:172-199; RequestLimit is a model bound, never a runtime guard.
BeginLoad(force, frequency) ==
  /\ s.issued < RequestLimit \* verification/eth-state/EthLoad.cfg:3 finite bound
  /\ LET id == s.issued + 1
         phase == IF s.prices = 0 THEN "archive" ELSE IF force THEN "live" ELSE "done"
     IN s' = [s EXCEPT !.issued = id, !.active = id, !.attached = TRUE,
               !.phase[id] = phase, !.forced[id] = force, !.navigated[id] = FALSE,
               !.loading = phase # "done", !.priceError = FALSE, !.refreshError = FALSE,
               !.renderPending = TRUE, !.frequency = frequency,
               !.range = IF frequency # s.frequency THEN "auto" ELSE s.range]

\* dist/eth-view.js:245 the initializer opens its first archive.
Open ==
  /\ s.issued = 0 \* dist/eth-view.js:245 single initializer invocation
  /\ BeginLoad(FALSE, "daily")

\* dist/eth-view.js:143,211 refresh/retry is available after the shell is released.
\* The button is disabled only by a later render, so two clicks can start two
\* requests before that frame. Allow refresh while loading: this over-approximates
\* even a painted disabled button rather than assuming a synchronous load guard.
Refresh ==
  /\ s.ready /\ s.attached \* dist/eth-view.js:39,143,211
  /\ BeginLoad(TRUE, s.frequency)

\* dist/eth-view.js:201-203 the interval callback starts a new load and revokes
\* the old generation, including a live refresh. Two supported intervals bound it.
ChangeInterval ==
  /\ s.ready /\ s.attached \* dist/eth-view.js:39,201-203
  /\ \E frequency \in Intervals \ {s.frequency}: BeginLoad(FALSE, frequency)

\* dist/eth-view.js:180; setPayload parses both daily and weekly before publishing.
\* A successful force retry immediately starts its live request in this continuation.
ArchiveArrives(id) ==
  /\ s.phase[id] = "archive" \* dist/eth-view.js:179-180 pending getArchive await
  /\ LET accepted == id = s.active \/ ~GuardResponses
     IN s' = [s EXCEPT
       !.phase[id] = IF accepted /\ s.forced[id] THEN "live" ELSE "done",
       !.prices = IF accepted THEN id ELSE s.prices,
       !.loading = IF id = s.active /\ ~s.forced[id] THEN FALSE ELSE s.loading,
       !.renderPending = s.renderPending \/ (id = s.active /\ ~s.forced[id] /\ (s.attached \/ ~RespectSuspension)),
       !.stalePublication = s.stalePublication \/ (accepted /\ id # s.active)]

\* dist/eth-view.js:181,195-199 error handling/finally runs without another await.
ArchiveFails(id) ==
  /\ s.phase[id] = "archive" \* dist/eth-view.js:180-181 pending getArchive await
  /\ LET accepted == id = s.active \/ ~GuardErrors
     IN s' = [s EXCEPT !.phase[id] = "done",
       !.priceError = s.priceError \/ (accepted /\ s.prices = 0),
       !.refreshError = s.refreshError \/ (accepted /\ s.prices > 0),
       !.loading = IF id = s.active THEN FALSE ELSE s.loading,
       !.renderPending = s.renderPending \/ (id = s.active /\ (s.attached \/ ~RespectSuspension)),
       !.stalePublication = s.stalePublication \/ (accepted /\ id # s.active)]

\* dist/eth-view.js:187-199 the live continuation owns prices only if its generation
\* still matches. A navigation token records whether user input happened since start.
LiveArrives(id) ==
  /\ s.phase[id] = "live" \* dist/eth-view.js:187 pending fetchMarketCandles await
  /\ LET accepted == id = s.active \/ ~GuardResponses
         preserve == PreserveNavigation /\ s.navigated[id]
     IN s' = [s EXCEPT !.phase[id] = "done",
       !.prices = IF accepted THEN id ELSE s.prices,
       !.range = IF accepted /\ ~preserve THEN "auto" ELSE s.range,
       !.loading = IF id = s.active THEN FALSE ELSE s.loading,
       !.renderPending = s.renderPending \/ (id = s.active /\ (s.attached \/ ~RespectSuspension)),
       !.stalePublication = s.stalePublication \/ (accepted /\ id # s.active),
       !.lostNavigation = s.lostNavigation \/ (accepted /\ s.navigated[id] /\ s.range = "custom" /\ ~preserve)]

\* dist/eth-view.js:195-199 failed live refresh keeps the last valid prices.
LiveFails(id) ==
  /\ s.phase[id] = "live" \* dist/eth-view.js:187 pending fetchMarketCandles await
  /\ LET accepted == id = s.active \/ ~GuardErrors
     IN s' = [s EXCEPT !.phase[id] = "done",
       !.refreshError = s.refreshError \/ accepted,
       !.loading = IF id = s.active THEN FALSE ELSE s.loading,
       !.renderPending = s.renderPending \/ (id = s.active /\ (s.attached \/ ~RespectSuspension)),
       !.stalePublication = s.stalePublication \/ (accepted /\ id # s.active)]

\* dist/eth-view.js:90-91 new navigation increments navigationRevision. Equality
\* with each captured token becomes false monotonically; booleans abstract this
\* equality exactly for the bounded set of pending requests, not numeric prices.
\* The post-await history-focus writer at line 106 is the same range class.
\* Daily coverage enables its jump; a cached daily load yields only microtasks.
\* From weekly, ChangeInterval then Pan over-approximates that callback; there
\* is no assumed synchronous load lock or external-event guard inside the await.
Pan ==
  /\ s.ready /\ s.attached /\ s.prices > 0 \* dist/eth-view.js:39,90-91,106,146-155
  /\ s' = [s EXCEPT !.range = "custom", !.navigated = [i \in Ids |-> TRUE], !.renderPending = TRUE]

\* dist/eth-view.js:130-163 a queued render is one synchronous continuation.
Render ==
  /\ s.renderPending \* dist/eth-view.js:163 scheduled requestAnimationFrame
  /\ LET emit == CanRender /\ BootOnRender /\ Usable /\ ~s.ready
     IN s' = [s EXCEPT !.renderPending = FALSE,
       !.ready = s.ready \/ emit, !.readyCount = s.readyCount + IF emit THEN 1 ELSE 0,
       !.hiddenPublication = s.hiddenPublication \/ (CanRender /\ ~s.attached)]

\* dist/eth-view.js:245-246 the first load's promise settles even after revocation.
\* The original baseline emitted atlas:ready unconditionally after this callback.
\* The fixed code delegates readiness to guarded render(), with a chart or retry.
InitialFrame ==
  /\ s.phase[1] = "done" /\ ~s.initialDone \* dist/eth-view.js:245-246 final initializer await
  /\ LET emit == IF BootOnRender THEN CanRender /\ Usable /\ ~s.ready ELSE TRUE
     IN s' = [s EXCEPT !.initialDone = TRUE, !.renderPending = FALSE,
       !.ready = s.ready \/ emit, !.readyCount = s.readyCount + IF emit THEN 1 ELSE 0,
       !.badReadiness = s.badReadiness \/ (emit /\ ~Usable),
       !.hiddenPublication = s.hiddenPublication \/ (~s.attached /\ (CanRender \/ emit))]

\* dist/eth-view.js:232-238 hiding revokes ownership and cancels the tracked frame.
Hide ==
  /\ s.issued > 0 \* dist/eth-view.js:30-245 no event interleaves before first load
  /\ s.attached \* dist/eth-view.js:232 browser pagehide event
  /\ s' = [s EXCEPT !.attached = FALSE, !.active = 0, !.loading = FALSE, !.renderPending = FALSE]

\* dist/eth-view.js:240-243 a BFCache restoration reloads missing prices, or schedules
\* retained valid prices. No invariant assumes abort prevents late completion.
Show ==
  /\ ~s.attached \* dist/eth-view.js:240-242 paired persisted pageshow
  /\ IF s.prices = 0 THEN BeginLoad(FALSE, s.frequency)
     ELSE s' = [s EXCEPT !.attached = TRUE, !.renderPending = TRUE]

\* dist/eth-view.js:230-231 late layout/font notification, including suspension.
Resize ==
  /\ s.issued > 0 \* dist/eth-view.js:30-245 no callback interleaves before first load
  /\ s' = [s EXCEPT !.renderPending = s.renderPending \/ (s.attached \/ ~RespectSuspension)]

Next ==
  \* dist/eth-view.js:30-245 setup and its first load have no intervening await.
  \* Hide/Resize carry this guard so TLC keeps distinct reader action labels.
  Open \/ Refresh \/ ChangeInterval \/ Pan \/ Render \/ InitialFrame \/ Hide \/ Show \/ Resize
  \/ \E id \in Ids: ArchiveArrives(id) \/ ArchiveFails(id) \/ LiveArrives(id) \/ LiveFails(id)

Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ s.issued \in 0..RequestLimit /\ s.active \in 0..RequestLimit
  /\ s.phase \in [Ids -> Phases] /\ s.forced \in [Ids -> BOOLEAN]
  /\ s.navigated \in [Ids -> BOOLEAN] /\ s.prices \in 0..RequestLimit
  /\ s.frequency \in Intervals /\ s.range \in {"auto", "custom"}
  /\ s.readyCount \in 0..2
  /\ \A name \in {"attached","loading","priceError","refreshError","renderPending",
                   "ready","initialDone","badReadiness","hiddenPublication",
                   "stalePublication","lostNavigation"}: s[name] \in BOOLEAN

\* Readiness may be announced only when the selected chart has prices or a
\* rendered actionable error. Guarded by dist/eth-view.js:129,152,161,246.
ReadyHasUsableView == ~s.badReadiness

\* A suspended page must publish neither chart updates nor readiness, even if an
\* old queued callback runs. Guarded by dist/eth-view.js:131,163,233.
NoHiddenPublication == ~s.hiddenPublication

\* Revoked archive/live successes or failures never write current displayed state.
\* Guarded by dist/eth-view.js:180-181,188,196,199,233.
NoStalePublication == ~s.stalePublication

\* A completed refresh may not reset navigation chosen after that request began.
\* Guarded by dist/eth-view.js:90-91,98,106,174,185,192-193,203,205,215.
NavigationSurvivesRefresh == ~s.lostNavigation

\* One document announces readiness once, including retry and BFCache restore.
\* Guarded by dist/eth-view.js:129.
ReadinessOnce == s.readyCount <= 1
=============================================================================
