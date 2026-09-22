import { describe, expect, it } from "vitest";
import {
  coreActivityContainersBpmnProfile,
  coreBoundaryEventsBpmnProfile,
  coreComplexRoutingBpmnProfile,
  coreFullAuthoringBpmnProfile,
} from "../domain/core-profile";
import { collaborationActivityContainersBpmnProfile } from "../domain/collaboration-profile";
import {
  cancelBpmnProfileUpgradeIntent,
  createBpmnProfileUpgradeIntent,
  resumeBpmnProfileUpgradeIntent,
  runBpmnProfileUpgradeIntent,
  settleBpmnProfileUpgradeStep,
  startNextBpmnProfileUpgradeStep,
  type BlockedProfileUpgradeIntent,
  type ProfileUpgradeIntentState,
  type ReadyProfileUpgradeIntent,
} from "./bpmn-profile-upgrade-intent";

function requireReady(
  state: ProfileUpgradeIntentState,
): ReadyProfileUpgradeIntent {
  expect(state.status).toBe("ready");
  if (state.status !== "ready") throw new Error("Expected a ready intent.");
  return state;
}

function requireBlocked(
  state: ProfileUpgradeIntentState,
): BlockedProfileUpgradeIntent {
  expect(state.status).toBe("blocked");
  if (state.status !== "blocked") throw new Error("Expected a blocked intent.");
  return state;
}

function createBoundaryToActivityIntent() {
  return createBpmnProfileUpgradeIntent({
    intentId: "intent-boundary-activity",
    requestedToolId: "expanded-subprocess",
    acknowledged: {
      profileId: coreBoundaryEventsBpmnProfile.id,
      revisionToken: "revision-boundary",
    },
    minimumProfileId: coreActivityContainersBpmnProfile.id,
  });
}

describe("BPMN profile upgrade intent facade", () => {
  it("completes an already-satisfied minimum without creating a persistence step", () => {
    const state = createBpmnProfileUpgradeIntent({
      intentId: "intent-already-satisfied",
      requestedToolId: "expanded-subprocess",
      acknowledged: {
        profileId: coreComplexRoutingBpmnProfile.id,
        revisionToken: "revision-complex",
      },
      minimumProfileId: coreActivityContainersBpmnProfile.id,
    });

    expect(state).toMatchObject({
      status: "completed",
      completion: "already-satisfied",
      acknowledged: {
        profileId: coreComplexRoutingBpmnProfile.id,
        revisionToken: "revision-complex",
      },
      plannedSteps: [],
      remainingSteps: [],
    });
    expect(startNextBpmnProfileUpgradeStep(state)).toBe(state);
  });

  it("does not complete Boundary to Activity until Full and Activity both ACK", () => {
    const ready = requireReady(createBoundaryToActivityIntent());
    expect(ready.plannedSteps).toEqual([
      coreFullAuthoringBpmnProfile.id,
      coreActivityContainersBpmnProfile.id,
    ]);

    const fullStep = startNextBpmnProfileUpgradeStep(ready);
    expect(fullStep.acknowledged).toEqual({
      profileId: coreBoundaryEventsBpmnProfile.id,
      revisionToken: "revision-boundary",
    });
    expect(fullStep.pendingStep).toMatchObject({
      fromProfileId: coreBoundaryEventsBpmnProfile.id,
      targetProfileId: coreFullAuthoringBpmnProfile.id,
      expectedRevisionToken: "revision-boundary",
      ordinal: 1,
      total: 2,
    });
    expect(startNextBpmnProfileUpgradeStep(fullStep)).toBe(fullStep);

    const afterFull = settleBpmnProfileUpgradeStep(fullStep, {
      kind: "acknowledged",
      revisionToken: "revision-full",
    });
    expect(afterFull).toMatchObject({
      status: "ready",
      acknowledged: {
        profileId: coreFullAuthoringBpmnProfile.id,
        revisionToken: "revision-full",
      },
      acknowledgedSteps: [coreFullAuthoringBpmnProfile.id],
      remainingSteps: [coreActivityContainersBpmnProfile.id],
    });

    const activityStep = startNextBpmnProfileUpgradeStep(
      requireReady(afterFull),
    );
    expect(activityStep.pendingStep).toMatchObject({
      fromProfileId: coreFullAuthoringBpmnProfile.id,
      targetProfileId: coreActivityContainersBpmnProfile.id,
      expectedRevisionToken: "revision-full",
      ordinal: 2,
      total: 2,
    });

    const completed = settleBpmnProfileUpgradeStep(activityStep, {
      kind: "idempotent",
      revisionToken: "revision-activity",
    });
    expect(completed).toMatchObject({
      status: "completed",
      completion: "upgraded",
      acknowledged: {
        profileId: coreActivityContainersBpmnProfile.id,
        revisionToken: "revision-activity",
      },
      acknowledgedSteps: [
        coreFullAuthoringBpmnProfile.id,
        coreActivityContainersBpmnProfile.id,
      ],
      remainingSteps: [],
    });
  });

  it("keeps the last durable ACK and remaining path when a later step is rejected", () => {
    const firstStep = startNextBpmnProfileUpgradeStep(
      requireReady(createBoundaryToActivityIntent()),
    );
    const afterFull = settleBpmnProfileUpgradeStep(firstStep, {
      kind: "acknowledged",
      revisionToken: "revision-full",
    });
    const activityStep = startNextBpmnProfileUpgradeStep(
      requireReady(afterFull),
    );
    const blocked = requireBlocked(
      settleBpmnProfileUpgradeStep(activityStep, { kind: "rejected" }),
    );

    expect(blocked).toMatchObject({
      recovery: "RESELECT_OR_REPLAN",
      acknowledged: {
        profileId: coreFullAuthoringBpmnProfile.id,
        revisionToken: "revision-full",
      },
      failedStep: {
        targetProfileId: coreActivityContainersBpmnProfile.id,
      },
      remainingSteps: [coreActivityContainersBpmnProfile.id],
    });
    expect(resumeBpmnProfileUpgradeIntent(blocked)).toBe(blocked);
  });

  it("retries an unavailable step in-session with the same idempotency identity", () => {
    const firstAttempt = startNextBpmnProfileUpgradeStep(
      requireReady(createBoundaryToActivityIntent()),
    );
    const blocked = requireBlocked(
      settleBpmnProfileUpgradeStep(firstAttempt, { kind: "unavailable" }),
    );

    expect(blocked.recovery).toBe("RETRY_SAME_STEP");
    expect(blocked.acknowledged).toEqual({
      profileId: coreBoundaryEventsBpmnProfile.id,
      revisionToken: "revision-boundary",
    });

    const retried = startNextBpmnProfileUpgradeStep(
      requireReady(resumeBpmnProfileUpgradeIntent(blocked)),
    );
    expect(retried.pendingStep.idempotencyKey).toBe(
      firstAttempt.pendingStep.idempotencyKey,
    );
    expect(retried.pendingStep.expectedRevisionToken).toBe(
      firstAttempt.pendingStep.expectedRevisionToken,
    );
  });

  it("does not promote a pending profile from a malformed empty ACK token", () => {
    const firstAttempt = startNextBpmnProfileUpgradeStep(
      requireReady(createBoundaryToActivityIntent()),
    );
    const blocked = requireBlocked(
      settleBpmnProfileUpgradeStep(firstAttempt, {
        kind: "acknowledged",
        revisionToken: "",
      }),
    );

    expect(blocked.recovery).toBe("RETRY_SAME_STEP");
    expect(blocked.acknowledged).toEqual({
      profileId: coreBoundaryEventsBpmnProfile.id,
      revisionToken: "revision-boundary",
    });
    expect(blocked.remainingSteps).toEqual([
      coreFullAuthoringBpmnProfile.id,
      coreActivityContainersBpmnProfile.id,
    ]);
  });

  it("blocks conflicts for hard reload and replan instead of stale-token resume", () => {
    const firstAttempt = startNextBpmnProfileUpgradeStep(
      requireReady(createBoundaryToActivityIntent()),
    );
    const blocked = requireBlocked(
      settleBpmnProfileUpgradeStep(firstAttempt, {
        kind: "conflict",
        currentRevisionToken: "revision-server-newer",
      }),
    );

    expect(blocked.recovery).toBe("RELOAD_AND_REPLAN");
    expect(blocked.failure).toEqual({
      kind: "conflict",
      currentRevisionToken: "revision-server-newer",
    });
    expect(blocked.acknowledged.profileId).toBe(
      coreBoundaryEventsBpmnProfile.id,
    );
    expect(resumeBpmnProfileUpgradeIntent(blocked)).toBe(blocked);
  });

  it("allows re-authentication to resume the same pending step", () => {
    const firstAttempt = startNextBpmnProfileUpgradeStep(
      requireReady(createBoundaryToActivityIntent()),
    );
    const blocked = requireBlocked(
      settleBpmnProfileUpgradeStep(firstAttempt, {
        kind: "unauthenticated",
      }),
    );
    expect(blocked.recovery).toBe("REAUTHENTICATE_AND_RETRY");

    const retried = startNextBpmnProfileUpgradeStep(
      requireReady(resumeBpmnProfileUpgradeIntent(blocked)),
    );
    expect(retried.pendingStep.idempotencyKey).toBe(
      firstAttempt.pendingStep.idempotencyKey,
    );
  });

  it("cancels only settled states and preserves any partial durable progress", () => {
    const ready = requireReady(createBoundaryToActivityIntent());
    const cancelledBeforeStart = cancelBpmnProfileUpgradeIntent(ready);
    expect(cancelledBeforeStart).toMatchObject({
      status: "cancelled",
      acknowledged: {
        profileId: coreBoundaryEventsBpmnProfile.id,
        revisionToken: "revision-boundary",
      },
      acknowledgedSteps: [],
    });

    const inFlight = startNextBpmnProfileUpgradeStep(ready);
    expect(cancelBpmnProfileUpgradeIntent(inFlight)).toBe(inFlight);

    const afterFull = settleBpmnProfileUpgradeStep(inFlight, {
      kind: "acknowledged",
      revisionToken: "revision-full",
    });
    const cancelledAfterAck = cancelBpmnProfileUpgradeIntent(
      requireReady(afterFull),
    );
    expect(cancelledAfterAck).toMatchObject({
      status: "cancelled",
      acknowledged: {
        profileId: coreFullAuthoringBpmnProfile.id,
        revisionToken: "revision-full",
      },
      acknowledgedSteps: [coreFullAuthoringBpmnProfile.id],
      remainingSteps: [coreActivityContainersBpmnProfile.id],
    });
  });

  it("rejects a cross-family target without exposing a pending step", () => {
    const state = createBpmnProfileUpgradeIntent({
      intentId: "intent-cross-family",
      requestedToolId: "collaboration-subprocess",
      acknowledged: {
        profileId: coreBoundaryEventsBpmnProfile.id,
        revisionToken: "revision-core",
      },
      minimumProfileId: collaborationActivityContainersBpmnProfile.id,
    });

    expect(state).toMatchObject({
      status: "incompatible",
      reason: "CROSS_FAMILY",
      plannedSteps: [],
      remainingSteps: [],
      acknowledged: {
        profileId: coreBoundaryEventsBpmnProfile.id,
        revisionToken: "revision-core",
      },
    });
    expect(startNextBpmnProfileUpgradeStep(state)).toBe(state);
  });

  it("rejects malformed intent identity before any step can exist", () => {
    expect(() =>
      createBpmnProfileUpgradeIntent({
        intentId: "",
        requestedToolId: "expanded-subprocess",
        acknowledged: {
          profileId: coreBoundaryEventsBpmnProfile.id,
          revisionToken: "revision-boundary",
        },
        minimumProfileId: coreActivityContainersBpmnProfile.id,
      }),
    ).toThrow("Invalid BPMN profile upgrade intent input.");
  });
});

describe("BPMN profile upgrade intent runner", () => {
  it("persists Boundary to Full to Activity in order with ACK revision chaining", async () => {
    const persistedSteps: Array<{
      targetProfileId: string;
      expectedRevisionToken: string;
      concurrentCalls: number;
    }> = [];
    const emittedStatuses: string[] = [];
    let concurrentCalls = 0;

    const finalState = await runBpmnProfileUpgradeIntent(
      createBoundaryToActivityIntent(),
      {
        async persistStep(step) {
          concurrentCalls += 1;
          persistedSteps.push({
            targetProfileId: step.targetProfileId,
            expectedRevisionToken: step.expectedRevisionToken,
            concurrentCalls,
          });
          await Promise.resolve();
          concurrentCalls -= 1;
          return {
            kind: "acknowledged",
            revisionToken:
              step.targetProfileId === coreFullAuthoringBpmnProfile.id
                ? "revision-full"
                : "revision-activity",
          };
        },
        onStateChange(state) {
          emittedStatuses.push(state.status);
        },
      },
    );

    expect(persistedSteps).toEqual([
      {
        targetProfileId: coreFullAuthoringBpmnProfile.id,
        expectedRevisionToken: "revision-boundary",
        concurrentCalls: 1,
      },
      {
        targetProfileId: coreActivityContainersBpmnProfile.id,
        expectedRevisionToken: "revision-full",
        concurrentCalls: 1,
      },
    ]);
    expect(emittedStatuses).toEqual([
      "in-flight",
      "ready",
      "in-flight",
      "completed",
    ]);
    expect(finalState).toMatchObject({
      status: "completed",
      completion: "upgraded",
      acknowledged: {
        profileId: coreActivityContainersBpmnProfile.id,
        revisionToken: "revision-activity",
      },
      acknowledgedSteps: [
        coreFullAuthoringBpmnProfile.id,
        coreActivityContainersBpmnProfile.id,
      ],
    });
  });

  it("stops on a later failure and preserves the last durable ACK", async () => {
    const requestedTargets: string[] = [];
    const emittedStates: ProfileUpgradeIntentState[] = [];

    const finalState = await runBpmnProfileUpgradeIntent(
      createBoundaryToActivityIntent(),
      {
        async persistStep(step) {
          requestedTargets.push(step.targetProfileId);
          return step.targetProfileId === coreFullAuthoringBpmnProfile.id
            ? { kind: "acknowledged", revisionToken: "revision-full" }
            : { kind: "rejected" };
        },
        onStateChange(state) {
          emittedStates.push(state);
        },
      },
    );

    expect(requestedTargets).toEqual([
      coreFullAuthoringBpmnProfile.id,
      coreActivityContainersBpmnProfile.id,
    ]);
    expect(finalState).toMatchObject({
      status: "blocked",
      recovery: "RESELECT_OR_REPLAN",
      acknowledged: {
        profileId: coreFullAuthoringBpmnProfile.id,
        revisionToken: "revision-full",
      },
      remainingSteps: [coreActivityContainersBpmnProfile.id],
    });
    expect(emittedStates.at(-1)).toBe(finalState);
  });

  it("maps a thrown persistence error to an unavailable retry state", async () => {
    const initialState = createBoundaryToActivityIntent();
    const firstStep = startNextBpmnProfileUpgradeStep(
      requireReady(initialState),
    );
    const emittedStates: ProfileUpgradeIntentState[] = [];

    const finalState = await runBpmnProfileUpgradeIntent(initialState, {
      async persistStep(step) {
        expect(step.idempotencyKey).toBe(firstStep.pendingStep.idempotencyKey);
        throw new Error("network unavailable");
      },
      onStateChange(state) {
        emittedStates.push(state);
      },
    });

    expect(emittedStates.map((state) => state.status)).toEqual([
      "in-flight",
      "blocked",
    ]);
    expect(finalState).toMatchObject({
      status: "blocked",
      failure: { kind: "unavailable" },
      recovery: "RETRY_SAME_STEP",
      acknowledged: {
        profileId: coreBoundaryEventsBpmnProfile.id,
        revisionToken: "revision-boundary",
      },
      remainingSteps: [
        coreFullAuthoringBpmnProfile.id,
        coreActivityContainersBpmnProfile.id,
      ],
    });
  });

  it("resumes only retryable blocked states without changing step identity", async () => {
    const firstAttempt = startNextBpmnProfileUpgradeStep(
      requireReady(createBoundaryToActivityIntent()),
    );
    const retryable = requireBlocked(
      settleBpmnProfileUpgradeStep(firstAttempt, { kind: "unavailable" }),
    );
    const retriedStepIds: string[] = [];

    const completed = await runBpmnProfileUpgradeIntent(retryable, {
      async persistStep(step) {
        retriedStepIds.push(step.idempotencyKey);
        return {
          kind: "acknowledged",
          revisionToken:
            step.targetProfileId === coreFullAuthoringBpmnProfile.id
              ? "revision-full-retry"
              : "revision-activity",
        };
      },
    });

    expect(retriedStepIds[0]).toBe(firstAttempt.pendingStep.idempotencyKey);
    expect(completed.status).toBe("completed");

    const nonRetryable = requireBlocked(
      settleBpmnProfileUpgradeStep(firstAttempt, {
        kind: "conflict",
        currentRevisionToken: "revision-server-newer",
      }),
    );
    let persistenceCalls = 0;
    const unchanged = await runBpmnProfileUpgradeIntent(nonRetryable, {
      async persistStep() {
        persistenceCalls += 1;
        return { kind: "unavailable" };
      },
    });

    expect(unchanged).toBe(nonRetryable);
    expect(persistenceCalls).toBe(0);
  });

  it("does not resume an in-flight state or skip its unresolved step", async () => {
    const inFlight = startNextBpmnProfileUpgradeStep(
      requireReady(createBoundaryToActivityIntent()),
    );
    let persistenceCalls = 0;
    let emittedStates = 0;

    const unchanged = await runBpmnProfileUpgradeIntent(inFlight, {
      async persistStep() {
        persistenceCalls += 1;
        return { kind: "acknowledged", revisionToken: "revision-full" };
      },
      onStateChange() {
        emittedStates += 1;
      },
    });

    expect(unchanged).toBe(inFlight);
    expect(persistenceCalls).toBe(0);
    expect(emittedStates).toBe(0);
  });
});
