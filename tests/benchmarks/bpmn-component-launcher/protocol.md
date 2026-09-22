# SDD45 BPMN Component Launcher — Moderated Benchmark Protocol

## Purpose and evidence boundary

This protocol measures whether representative human authors can discover and use the
compact BPMN component launcher. It is the human evidence for AC-BCL-015; it does not
replace deterministic catalogue, profile-transition, XML/DI, accessibility or viewport
tests.

Only completed sessions with real human participants count. Automated agents, scripted
browser runs and unmoderated implementation-team walkthroughs may preflight the fixtures
or record format, but they are excluded from participant totals and usability claims.

Do not claim improvement over a previous UI unless the same tasks, fixtures, prompts,
timing rules and participant criteria are separately run against a frozen baseline.

## Participant sample

Recruit 6–8 people who genuinely create or review process diagrams:

- at least 3 `new_or_occasional` authors: relevant authoring responsibility, but no more
  than five BPMN diagrams in the last six months or use less often than monthly;
- at least 3 `regular_or_intermediate` authors: at least monthly BPMN use and enough
  familiarity to explain a task, event and gateway;
- no more than 2 members of the implementation team, disclosed with the boolean
  `implementationTeamMember` field.

Assign pseudonymous IDs such as `p_0001`. Do not put names, email addresses, employer,
recording paths, health information or free-text participant notes in session JSON.
Obtain the consent required by the team's research policy. A participant may withdraw
at any time; record `participant_withdrew` and do not replace or delete that record to
hide an unfavorable result.

## Frozen setup

1. Freeze one candidate build revision for the whole benchmark. A second revision
   requires a new study run; the summarizer fails the frozen-build protocol gate.
2. Use a desktop viewport of 1440 × 900 CSS pixels at 100% browser zoom. Browser and OS
   may vary, but record environmental anomalies outside the session JSON.
3. Start each task from its named clean fixture. Reset between tasks so Recent,
   Favorites, selection and an earlier task's profile do not leak into the next task.
4. Start with the launcher closed and the no-selection inspector collapsed unless a
   task says otherwise.
5. Alternate protocol variants A and B. Their eligible participant counts may differ by
   at most one.
6. Confirm that timers, the recorder worksheet and all five fixtures work before the
   participant arrives. A preflight record uses `participantKind: automated_preflight`,
   `experienceBand: not_applicable` and `disposition: automated_preflight`; it never
   counts as a human session.

Use `technical_failure` only for a lab failure unrelated to the product, such as the
test machine losing power. Product crashes, lost focus, failed requests or unexpected
reloads are task failures and remain in a completed participant session.

## Moderator rules

- Read each prompt verbatim. Start the timer after the final word and stop it only at
  the observable success condition or time cap.
- Do not name a control, point, take the pointer or suggest a path. A directional hint
  makes that task `success_assisted` if it later succeeds.
- A neutral reply such as “Please continue as you normally would” is allowed once and
  is not a directional hint.
- If the time cap is reached, stop the task and record `not_completed` with the capped
  duration. Do not turn a timeout into an assisted success.
- After every task, ask: “Overall, how easy or difficult was this task?” Record the
  participant's 1–7 Single Ease Question (SEQ) answer, where 1 is very difficult and 7
  is very easy. Ask even when the task was not completed.
- Never discard a valid difficult session. Corrections to transcription must retain an
  audit note outside the pseudonymous JSON.

## Measurement definitions

| Field | Counting rule |
|---|---|
| `durationSeconds` | Prompt end to success/timeout, measured to at least 0.1 s. |
| `commandActions` | Each click, tap or command keypress that invokes a UI action. Pointer movement and typed search characters are excluded. |
| `typedCharacters` | Characters entered into search, including corrected characters. |
| `scrollGestures` | One intentional wheel/trackpad burst, scrollbar drag or keyboard page-scroll; a continuous burst is one gesture. |
| `errors` | Each wrong control/tool activation, misplaced node, lost keyboard focus or other observable action that requires recovery. |
| `redundantActivations` | An unnecessary repeat of a component or profile activation, including clicking a profile card after already expressing the component intent. |
| `firstAttemptLauncherDiscovery` | On the participant's first launcher-dependent task, the first deliberate task-relevant control opens the component launcher. Merely moving the pointer does not count. |
| `outcome` | `success_unassisted`, `success_assisted`, or `not_completed` under the rules above. |

Typed search characters are reported but excluded from the deterministic command-step
budget. Scroll and errors are reported separately rather than being silently folded
into action count.

## Tasks and fixtures

The fixture service must restore each fixture without exposing profile cards as task
instructions. Do not demonstrate the launcher before the first task.

| ID | Fixture and exact prompt | Success condition | Cap |
|---|---|---|---:|
| `place_task` | Core starter, empty visible canvas. “Add a Task to the empty area of this process.” | Exactly one Task is placed; no profile request. | 30 s |
| `search_timer_catch` | A model whose durable profile already supports Timer Catch Event. “Find and add a Timer Catch Event to the process.” | Exactly one Timer Catch Event is placed; no profile request. | 45 s |
| `upgrade_subprocess` | Durable Boundary Events profile. “Add an expanded SubProcess to the process.” | One author confirmation covers Boundary → Full Authoring → Activity Containers; the SubProcess appears only after the final durable ACK. | 60 s |
| `cancel_data_store_upgrade` | A profile before Data Authoring. “Find Data Store, but cancel before changing this model's capability.” | Upgrade UI is dismissed, trigger focus returns, and no profile request, XML/history/dirty mutation or Data Store is created. | 45 s |
| `keyboard_quick_add` | One Task selected and keyboard focus in the canvas. “Using only the keyboard, add a following Task from the selected Task.” | One following Task and its flow are created as one undoable quick-add command. | 30 s |

Protocol A order: `place_task`, `search_timer_catch`,
`cancel_data_store_upgrade`, `upgrade_subprocess`, `keyboard_quick_add`.

Protocol B order: `search_timer_catch`, `place_task`, `upgrade_subprocess`,
`cancel_data_store_upgrade`, `keyboard_quick_add`.

For both variants, `firstAttemptLauncherDiscovery` refers to the first task in that
variant that needs the launcher.

## Profile reload boundary

The timed benchmark does not deliberately inject a reload. If a product-caused reload
happens during an upgrade, keep the timer and action counts running. Durable server ACK
is the only source of profile truth. The upgrade plan must not reopen or continue merely
because the page reloaded; it resumes only after the participant reselects the blocked
tool, starting from the last durable acknowledged profile. Record an app-caused failure
as observed rather than reclassifying it as a lab `technical_failure`.

Fault injection and hard-reload behavior still require separate deterministic browser
proof; a human session is not a substitute for that regression test.

## Session record and aggregation

Write one JSON object per session using `session.schema.json`. Filenames should be the
pseudonymous `sessionId`, for example `s_0001.json`. Cross-field rules are enforced by
the summarizer in addition to the JSON Schema:

- complete human sessions contain all five unique tasks and a SEQ response for each;
- automated records cannot be marked complete;
- a participant can contribute at most one complete session;
- raw session data stays in the ignored directory
  `test-results/bpmn-component-launcher-benchmark/`.

Aggregate after transcription review:

```sh
pnpm exec tsx tests/benchmarks/bpmn-component-launcher/summarize.ts \
  --input test-results/bpmn-component-launcher-benchmark \
  --output test-results/bpmn-component-launcher-benchmark/aggregate.json
```

The aggregate reports every required AC-BCL-015 measure: success, duration, actions,
scroll, errors and SEQ. Copy the reviewed aggregate status and metrics into `STATUS.md`;
do not commit raw participant records.

## Decision rules

The result is eligible for a completion decision only with 6–8 complete humans, both
experience bands represented by at least three participants, at most two implementation
team members, one frozen build and balanced A/B variants.

`COMPLETED_MET` additionally requires all of the following:

- at least 90% unassisted success across all eligible task attempts;
- first-attempt launcher discovery by at least 6 participants;
- median unassisted-success time: Task ≤8 s, Timer Catch search ≤15 s, gated
  SubProcess ≤25 s, cancel ≤10 s and keyboard quick-add ≤8 s;
- exactly zero redundant activations across the study;
- mean SEQ at least 5.5/7 across all task ratings.

Time thresholds use unassisted successful attempts. Assisted and incomplete attempts
remain visible in success, action, error and SEQ totals, so fast successful trials cannot
hide unsuccessful ones.

Status meanings:

- `NOT_RUN`: zero eligible humans; automated preflight does not change this.
- `BLOCKED_INSUFFICIENT_HUMANS`: 1–5 eligible humans.
- `BLOCKED_UNREPRESENTATIVE_SAMPLE`: 6–8 humans without both required bands.
- `BLOCKED_PROTOCOL_VIOLATION`: sample above eight, mixed builds, too many implementation
  team members or unbalanced variants.
- `COMPLETED_NOT_MET`: valid 6–8-person study, but one or more usability targets missed.
- `COMPLETED_MET`: valid study and every target met.
