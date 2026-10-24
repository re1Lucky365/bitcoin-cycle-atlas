------------------------------ MODULE EquityLoad ------------------------------
EXTENDS Naturals

CONSTANTS RequestLimit, BootOnRender, RespectSuspension, PreserveRange,
          GuardPrices, GuardProjection, GuardErrors, ClearProjection
Ids == 1..RequestLimit
Phases == {"unused", "prices", "coin", "paint1", "paint2", "project", "done"}
VARIABLES issued, active, phase, attached, loading, prices, projection,
          priceError, forecastError, renderPending, painted, errorPainted,
          ready, initialFrameDone, staleWrite, hiddenReady, frequency, customRange, range
vars == <<issued, active, phase, attached, loading, prices, projection,
          priceError, forecastError, renderPending, painted, errorPainted,
          ready, initialFrameDone, staleWrite, hiddenReady, frequency, customRange, range>>

Init == /\ issued = 0 /\ active = 0 /\ phase = [i \in Ids |-> "unused"]
        /\ attached = TRUE /\ loading = FALSE /\ prices = 0 /\ projection = 0
        /\ priceError = FALSE /\ forecastError = FALSE /\ renderPending = FALSE
        /\ painted = 0 /\ errorPainted = FALSE /\ ready = FALSE
        /\ initialFrameDone = FALSE /\ staleWrite = FALSE /\ hiddenReady = FALSE
        /\ frequency = "daily" /\ customRange = FALSE /\ range = "auto"

\* dist/equity-view.js:123-125 load refuses an overlapping load.
\* The finite RequestLimit bounds exploration, not production behavior.
Load ==
  /\ issued < RequestLimit
  /\ ~loading \* dist/equity-view.js:125
  /\ issued' = issued + 1 /\ active' = issued + 1
  /\ phase' = [phase EXCEPT ![issued + 1] = "prices"]
  /\ loading' = TRUE /\ priceError' = FALSE /\ renderPending' = TRUE
  /\ UNCHANGED <<prices, projection, forecastError, attached, painted, errorPainted,
                 ready, initialFrameDone, staleWrite, hiddenReady, frequency, customRange, range>>

\* dist/equity-view.js:127-131 continuation after the equity archive resolves.
PricesArrive(id) ==
  /\ phase[id] = "prices"
  /\ LET accepted == id = active \/ ~GuardPrices IN
     /\ phase' = [phase EXCEPT ![id] = IF accepted THEN "coin" ELSE "done"]
     /\ prices' = IF accepted THEN id ELSE prices
     /\ projection' = IF accepted /\ ClearProjection THEN 0 ELSE projection
     /\ forecastError' = IF accepted THEN FALSE ELSE forecastError
     /\ renderPending' = (renderPending \/ (accepted /\ attached))
     /\ staleWrite' = (staleWrite \/ (accepted /\ id # active))
  /\ UNCHANGED <<issued, active, attached, loading, priceError, painted, errorPainted,
                 ready, initialFrameDone, hiddenReady, frequency, customRange, range>>

\* dist/equity-view.js:144-145 catch/finally after a failed equity archive.
PricesFail(id) ==
  /\ phase[id] = "prices"
  /\ phase' = [phase EXCEPT ![id] = "done"]
  /\ priceError' = IF id = active \/ ~GuardErrors THEN TRUE ELSE priceError
  /\ staleWrite' = (staleWrite \/ (~GuardErrors /\ id # active))
  /\ loading' = IF id = active THEN FALSE ELSE loading
  /\ renderPending' = (renderPending \/ (id = active /\ attached))
  /\ UNCHANGED <<issued, active, attached, prices, projection, forecastError, painted, errorPainted,
                 ready, initialFrameDone, hiddenReady, frequency, customRange, range>>

\* dist/equity-view.js:133-136 coin continuation and first scheduled paint yield.
CoinArrives(id) ==
  /\ phase[id] = "coin"
  /\ phase' = [phase EXCEPT ![id] = IF id = active THEN "paint1" ELSE "done"]
  /\ UNCHANGED <<issued, active, attached, loading, prices, projection, priceError, forecastError,
                 renderPending, painted, errorPainted, ready, initialFrameDone, staleWrite,
                 hiddenReady, frequency, customRange, range>>

\* dist/equity-view.js:143-145 a coin archive failure keeps observed prices.
CoinFails(id) ==
  /\ phase[id] = "coin"
  /\ phase' = [phase EXCEPT ![id] = "done"]
  /\ projection' = IF id = active \/ ~GuardErrors THEN 0 ELSE projection
  /\ forecastError' = IF id = active \/ ~GuardErrors THEN TRUE ELSE forecastError
  /\ staleWrite' = (staleWrite \/ (~GuardErrors /\ id # active))
  /\ loading' = IF id = active THEN FALSE ELSE loading
  /\ renderPending' = (renderPending \/ (id = active /\ attached))
  /\ UNCHANGED <<issued, active, attached, prices, priceError, painted, errorPainted,
                 ready, initialFrameDone, hiddenReady, frequency, customRange, range>>

\* dist/equity-view.js:136 the first requestAnimationFrame queues the second.
FirstPaint(id) ==
  /\ phase[id] = "paint1"
  /\ phase' = [phase EXCEPT ![id] = "paint2"]
  /\ UNCHANGED <<issued, active, attached, loading, prices, projection, priceError, forecastError,
                 renderPending, painted, errorPainted, ready, initialFrameDone, staleWrite,
                 hiddenReady, frequency, customRange, range>>

\* dist/equity-view.js:136 the second requestAnimationFrame resolves the yield.
SecondPaint(id) ==
  /\ phase[id] = "paint2"
  /\ phase' = [phase EXCEPT ![id] = "project"]
  /\ UNCHANGED <<issued, active, attached, loading, prices, projection, priceError, forecastError,
                 renderPending, painted, errorPainted, ready, initialFrameDone, staleWrite,
                 hiddenReady, frequency, customRange, range>>

\* dist/equity-view.js:137-145 synchronous computation/publication after both yields.
Project(id) ==
  /\ phase[id] = "project"
  /\ phase' = [phase EXCEPT ![id] = "done"]
  /\ projection' = IF id = active \/ ~GuardProjection THEN id ELSE projection
  /\ staleWrite' = (staleWrite \/ (~GuardProjection /\ id # active))
  /\ range' = IF (id = active \/ ~GuardProjection) /\ (~customRange \/ ~PreserveRange) THEN "auto" ELSE range
  /\ loading' = IF id = active THEN FALSE ELSE loading
  /\ renderPending' = (renderPending \/ (id = active /\ attached))
  /\ UNCHANGED <<issued, active, attached, prices, priceError, forecastError, painted, errorPainted,
                 ready, initialFrameDone, hiddenReady, frequency, customRange>>

\* dist/equity-view.js:137-145 synchronous calculation may throw into the same catch.
ProjectFails(id) ==
  /\ phase[id] = "project"
  /\ (id = active \/ ~GuardProjection) \* dist/equity-view.js:137
  /\ phase' = [phase EXCEPT ![id] = "done"]
  /\ projection' = IF id = active \/ ~GuardErrors THEN 0 ELSE projection
  /\ forecastError' = IF id = active \/ ~GuardErrors THEN TRUE ELSE forecastError
  /\ staleWrite' = (staleWrite \/ (~GuardErrors /\ id # active))
  /\ loading' = IF id = active THEN FALSE ELSE loading
  /\ renderPending' = (renderPending \/ (id = active /\ attached))
  /\ UNCHANGED <<issued, active, attached, prices, priceError, painted, errorPainted,
                 ready, initialFrameDone, hiddenReady, frequency, customRange, range>>

\* dist/equity-view.js:111-115 render plus one-shot readiness, same JS continuation.
Render ==
  /\ renderPending
  /\ (attached \/ ~RespectSuspension) \* dist/equity-view.js:110
  /\ renderPending' = FALSE /\ painted' = prices /\ errorPainted' = priceError
  /\ ready' = (ready \/ (BootOnRender /\ (prices > 0 \/ priceError)))
  /\ hiddenReady' = (hiddenReady \/ (~ready /\ BootOnRender /\ (prices > 0 \/ priceError) /\ ~attached))
  /\ UNCHANGED <<issued, active, phase, attached, loading, prices, projection, priceError,
                 forecastError, initialFrameDone, staleWrite, frequency, customRange, range>>

\* dist/equity-view.js:155 the original init continuation still has one final RAF.
\* It may complete after pagehide; render now checks suspended before publishing ready.
InitialFrame ==
  /\ issued > 0 \* dist/equity-view.js:155
  /\ phase[1] = "done" \* dist/equity-view.js:155
  /\ ~initialFrameDone
  /\ initialFrameDone' = TRUE
  /\ LET canRender == attached \/ ~RespectSuspension
         release == canRender /\ (~BootOnRender \/ prices > 0 \/ priceError) IN
     /\ painted' = IF canRender THEN prices ELSE painted
     /\ errorPainted' = IF canRender THEN priceError ELSE errorPainted
     /\ ready' = (ready \/ release)
     /\ hiddenReady' = (hiddenReady \/ (~ready /\ release /\ ~attached))
  /\ UNCHANGED <<issued, active, phase, attached, loading, prices, projection, priceError,
                 forecastError, renderPending, staleWrite, frequency, customRange, range>>

\* dist/equity-view.js:153 pagehide revokes the token even if abort is ignored.
Hide ==
  /\ attached
  /\ attached' = FALSE /\ active' = 0 /\ loading' = FALSE /\ renderPending' = FALSE
  /\ UNCHANGED <<issued, phase, prices, projection, priceError, forecastError, painted,
                 errorPainted, ready, initialFrameDone, staleWrite, hiddenReady, frequency, customRange, range>>

\* dist/equity-view.js:154 pageshow resumes the document; Load models a missing projection retry.
Show ==
  /\ attached' = TRUE /\ renderPending' = TRUE
  /\ UNCHANGED <<issued, active, phase, loading, prices, projection, priceError, forecastError,
                 painted, errorPainted, ready, initialFrameDone, staleWrite, hiddenReady,
                 frequency, customRange, range>>

\* dist/equity-view.js:49 user pan changes the range independently of pending input.
Pan ==
  /\ customRange' = TRUE /\ range' = "custom" /\ renderPending' = TRUE
  /\ UNCHANGED <<issued, active, phase, attached, loading, prices, projection, priceError,
                 forecastError, painted, errorPainted, ready, initialFrameDone, staleWrite, hiddenReady, frequency>>

\* dist/equity-view.js:148 interval changes reset the range without restarting calculation.
ChangeInterval ==
  /\ frequency' = IF frequency = "daily" THEN "weekly" ELSE "daily"
  /\ customRange' = FALSE /\ range' = "auto" /\ renderPending' = TRUE
  /\ UNCHANGED <<issued, active, phase, attached, loading, prices, projection, priceError,
                 forecastError, painted, errorPainted, ready, initialFrameDone, staleWrite, hiddenReady>>

System == (\E id \in Ids: PricesArrive(id) \/ PricesFail(id) \/ CoinArrives(id) \/ CoinFails(id)
                            \/ FirstPaint(id) \/ SecondPaint(id) \/ Project(id) \/ ProjectFails(id)) \/ Render \/ InitialFrame
Next == Load \/ Hide \/ Show \/ Pan \/ ChangeInterval \/ System
Spec == Init /\ [][Next]_vars

TypeOK == /\ issued \in 0..RequestLimit /\ active \in 0..issued
          /\ phase \in [Ids -> Phases] /\ prices \in 0..issued /\ projection \in 0..issued
          /\ painted \in 0..issued /\ frequency \in {"daily", "weekly"}
          /\ range \in {"auto", "custom"}
          /\ <<attached, loading, priceError, forecastError, renderPending, errorPainted,
                ready, initialFrameDone, staleWrite, hiddenReady, customRange>> \in [1..11 -> BOOLEAN]

\* A revoked load never publishes prices, forecast values, or errors.
NoStalePublication == ~staleWrite
\* A published projection uses the same request generation as its displayed prices.
ProjectionMatchesPrices == projection = 0 \/ projection = prices
\* An observed or actionable-error render releases the loading shell immediately.
UsableRenderReleasesBoot == (painted > 0 \/ errorPainted) => ready
\* A suspended document never publishes its first ready event.
NoHiddenReadiness == ~hiddenReady
\* Pending computation preserves the latest user range unless the user resets it.
UserRangePreserved == customRange => range = "custom"
=============================================================================
