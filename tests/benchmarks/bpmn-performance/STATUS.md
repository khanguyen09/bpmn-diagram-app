# BPMN workspace performance status

> Status: `MEASURED` (non-strict reference run)
> Scope: deterministic automated browser measurement, not human usability
> Last updated: 2026-09-05

The harness is prepared for three SDD09/SDD56 reference fixtures:

| Fixture | Nodes | Connectors | Measurement result |
| --- | ---: | ---: | --- |
| Small | 50 | 75 | Ready 218 ms; zoom frame p95 9.2 ms; validation 74 ms; XML 181 ms |
| Medium | 200 | 300 | Ready 246 ms; zoom frame p95 9.2 ms; validation 123 ms; XML 304 ms |
| Large | 500 | 700 | Ready 399 ms; zoom frame p95 16.7 ms; validation 237 ms; XML 569 ms |

Measured on 2026-09-05: Apple M4 Pro, 24 GiB, macOS 15.7.4, Node 24.19.0,
Playwright 1.62.0 Chromium; 4/4 cases passed, zero retries, 22.2 seconds. The run used
the guarded disposable database `experience_blogs_e2e_sdd56_20260905_b1` and its
exact cleanup hooks. No normal application records were used.

Medium command/Undo p95 were 95.8/116.5 ms, including browser automation and assertion
overhead, not isolated engine latency. Frame samples start at a requestAnimationFrame
boundary. Reciprocal sampled frame cadence was 117/109/70 Hz; this is not a sustained
FPS benchmark. Strict budgets were disabled; this measurement does not certify them.

Final application source fingerprint (401 app/modules/shared files, excluding
AppleDouble metadata):
`4349974024e3e6ac7644abef8b24a1ade1daccaa583c4a49a7c279979674d2d6`.

Run the isolated harness with:

```text
pnpm exec playwright test --config playwright.performance.config.ts
```

Set `BPMN_PERFORMANCE_STRICT=1` only on the frozen reference machine. Normal runs
record measurements without turning machine variance into an arbitrary pass claim.
The Medium strict targets remain: zoom frame p95 at most 32 ms, sustained zoom at
least 45 FPS, local command commit p95 at most 100 ms, Undo p95 at most 150 ms and
full validation at most 2 seconds.

Actual browser zoom at 200%, live VoiceOver/NVDA and the 6–8-author benchmark are
separate gates and remain `NOT_RUN`; this performance harness cannot satisfy them.
