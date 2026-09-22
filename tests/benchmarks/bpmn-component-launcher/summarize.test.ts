import { describe, expect, it } from "vitest";
import {
  BENCHMARK_SCHEMA_VERSION,
  BENCHMARK_STUDY_ID,
  BENCHMARK_TASK_IDS,
  summarizeBenchmarkSessions,
  type BenchmarkSessionRecord,
  type BenchmarkTaskId,
  type BenchmarkTaskRecord,
} from "./summarize";

function task(
  taskId: BenchmarkTaskId,
  overrides: Partial<BenchmarkTaskRecord> = {},
): BenchmarkTaskRecord {
  const durationByTask: Readonly<Record<BenchmarkTaskId, number>> = {
    place_task: 6,
    search_timer_catch: 12,
    upgrade_subprocess: 20,
    cancel_data_store_upgrade: 7,
    keyboard_quick_add: 6,
  };

  return {
    taskId,
    outcome: "success_unassisted",
    durationSeconds: durationByTask[taskId],
    commandActions: 3,
    typedCharacters: taskId === "search_timer_catch" ? 5 : 0,
    scrollGestures: 0,
    redundantActivations: 0,
    errors: [],
    seq: 6,
    ...overrides,
  };
}

function humanSession(
  index: number,
  overrides: Partial<BenchmarkSessionRecord> = {},
): BenchmarkSessionRecord {
  return {
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    studyId: BENCHMARK_STUDY_ID,
    sessionId: `s_${String(index).padStart(4, "0")}`,
    participantId: `p_${String(index).padStart(4, "0")}`,
    participantKind: "human",
    experienceBand:
      index < 3 ? "new_or_occasional" : "regular_or_intermediate",
    disposition: "complete",
    implementationTeamMember: false,
    protocolVariant: index % 2 === 0 ? "A" : "B",
    buildRevision: "abc1234",
    startedAt: "2026-09-04T01:00:00.000Z",
    firstAttemptLauncherDiscovery: true,
    tasks: BENCHMARK_TASK_IDS.map((taskId) => task(taskId)),
    ...overrides,
  };
}

describe("SDD45 BPMN component launcher benchmark summary", () => {
  it("keeps an empty or automated-only study at NOT_RUN", () => {
    expect(summarizeBenchmarkSessions([]).status).toBe("NOT_RUN");

    const automatedPreflight: BenchmarkSessionRecord = {
      schemaVersion: BENCHMARK_SCHEMA_VERSION,
      studyId: BENCHMARK_STUDY_ID,
      sessionId: "s_auto_001",
      participantId: "p_auto_001",
      participantKind: "automated_preflight",
      experienceBand: "not_applicable",
      disposition: "automated_preflight",
      implementationTeamMember: false,
      protocolVariant: "A",
      buildRevision: "abc1234",
      startedAt: "2026-09-04T01:00:00.000Z",
      firstAttemptLauncherDiscovery: null,
      tasks: [],
    };
    const summary = summarizeBenchmarkSessions([automatedPreflight]);

    expect(summary.status).toBe("NOT_RUN");
    expect(summary.eligibleHumanParticipantCount).toBe(0);
    expect(summary.exclusions.automatedPreflight).toBe(1);
  });

  it("does not treat fewer than six humans as completed evidence", () => {
    const summary = summarizeBenchmarkSessions([humanSession(0)]);

    expect(summary.status).toBe("BLOCKED_INSUFFICIENT_HUMANS");
    expect(summary.thresholds.participantCount.met).toBe(false);
  });

  it("reports COMPLETED_MET only for a representative, balanced passing sample", () => {
    const summary = summarizeBenchmarkSessions(
      Array.from({ length: 6 }, (_, index) => humanSession(index)),
    );

    expect(summary.status).toBe("COMPLETED_MET");
    expect(summary.eligibleHumanParticipantCount).toBe(6);
    expect(summary.overall.unassistedTaskSuccessRate).toBe(1);
    expect(summary.overall.firstAttemptDiscoveryCount).toBe(6);
    expect(summary.overall.meanSeq).toBe(6);
    expect(summary.thresholds.representativeSample.met).toBe(true);
    expect(summary.thresholds.balancedProtocolVariants.met).toBe(true);
    expect(
      Object.values(summary.thresholds.durationSeconds).every(({ met }) => met),
    ).toBe(true);
  });

  it("blocks unrepresentative or protocol-violating samples without grading them", () => {
    const unrepresentative = Array.from({ length: 6 }, (_, index) =>
      humanSession(index, { experienceBand: "new_or_occasional" }),
    );
    expect(summarizeBenchmarkSessions(unrepresentative).status).toBe(
      "BLOCKED_UNREPRESENTATIVE_SAMPLE",
    );

    const tooManyImplementationTeamMembers = Array.from(
      { length: 6 },
      (_, index) =>
        humanSession(index, { implementationTeamMember: index < 3 }),
    );
    const protocolViolation = summarizeBenchmarkSessions(
      tooManyImplementationTeamMembers,
    );
    expect(protocolViolation.status).toBe("BLOCKED_PROTOCOL_VIOLATION");
    expect(protocolViolation.thresholds.implementationTeamCap.met).toBe(false);
  });

  it("reports completed-but-not-met without hiding failed targets", () => {
    const sessions = Array.from({ length: 6 }, (_, index) => humanSession(index));
    sessions[0] = humanSession(0, {
      firstAttemptLauncherDiscovery: false,
      tasks: BENCHMARK_TASK_IDS.map((taskId) =>
        task(
          taskId,
          taskId === "upgrade_subprocess"
            ? {
                outcome: "success_assisted",
                durationSeconds: 32,
                redundantActivations: 1,
                errors: [{ code: "unexpected_profile_card", recovered: true }],
                seq: 4,
              }
            : {},
        ),
      ),
    });

    const summary = summarizeBenchmarkSessions(sessions);

    expect(summary.status).toBe("COMPLETED_NOT_MET");
    expect(summary.thresholds.firstAttemptDiscoverability.met).toBe(false);
    expect(summary.thresholds.redundantActivations).toMatchObject({
      actual: 1,
      met: false,
    });
    expect(summary.tasks.find(({ taskId }) => taskId === "upgrade_subprocess"))
      .toMatchObject({
        assistedSuccessCount: 1,
        totalErrors: 1,
        totalRedundantActivations: 1,
      });
  });

  it("fails closed for incomplete complete-sessions and duplicate participants", () => {
    expect(() =>
      summarizeBenchmarkSessions([
        {
          ...humanSession(0),
          tasks: [task("place_task")],
        },
      ]),
    ).toThrow("complete sessions require exactly");

    expect(() =>
      summarizeBenchmarkSessions([
        humanSession(0),
        humanSession(1, { participantId: humanSession(0).participantId }),
      ]),
    ).toThrow("more than one complete session");
  });

  it("rejects free-text or identifying fields outside the privacy-safe schema", () => {
    expect(() =>
      summarizeBenchmarkSessions([
        {
          ...humanSession(0),
          participantName: "must-not-be-collected",
        },
      ]),
    ).toThrow("unexpected field(s): participantName");

    expect(() =>
      summarizeBenchmarkSessions([
        {
          ...humanSession(0),
          participantId: "person@example.com",
        },
      ]),
    ).toThrow("expected a pseudonymous p_ identifier");
  });
});
