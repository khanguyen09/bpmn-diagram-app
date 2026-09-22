import type { ProcessModelSaveResponse } from "./process-model-persistence-client";
import {
  canTransitionBpmnProfile,
  type BpmnProfileId,
} from "../domain/core-profile";
import {
  planBpmnProfileUpgrade,
  type ProfileUpgradePlan,
} from "./bpmn-profile-upgrade-plan";

export interface AcknowledgedProfileState {
  readonly profileId: BpmnProfileId;
  readonly revisionToken: string;
}

export interface ProfileUpgradeStep {
  readonly fromProfileId: BpmnProfileId;
  readonly targetProfileId: BpmnProfileId;
  readonly expectedRevisionToken: string;
  readonly idempotencyKey: string;
  readonly ordinal: number;
  readonly total: number;
}

type ProfileUpgradeSuccess = Extract<
  ProcessModelSaveResponse,
  { readonly revisionToken: string }
>;

type ProfileUpgradeFailure = Exclude<
  ProcessModelSaveResponse,
  ProfileUpgradeSuccess
>;

export type ProfileUpgradeRecovery =
  | "RETRY_SAME_STEP"
  | "REAUTHENTICATE_AND_RETRY"
  | "RELOAD_AND_REPLAN"
  | "RESELECT_OR_REPLAN";

interface ProfileUpgradeIntentBase {
  readonly intentId: string;
  readonly requestedToolId: string;
  readonly minimumProfileId: BpmnProfileId;
  readonly acknowledged: AcknowledgedProfileState;
  readonly plannedSteps: readonly BpmnProfileId[];
  readonly acknowledgedSteps: readonly BpmnProfileId[];
  readonly remainingSteps: readonly BpmnProfileId[];
}

export interface ReadyProfileUpgradeIntent extends ProfileUpgradeIntentBase {
  readonly status: "ready";
}

export interface InFlightProfileUpgradeIntent extends ProfileUpgradeIntentBase {
  readonly status: "in-flight";
  readonly pendingStep: ProfileUpgradeStep;
}

export interface BlockedProfileUpgradeIntent extends ProfileUpgradeIntentBase {
  readonly status: "blocked";
  readonly failedStep: ProfileUpgradeStep;
  readonly failure: ProfileUpgradeFailure;
  readonly recovery: ProfileUpgradeRecovery;
}

export interface CompletedProfileUpgradeIntent extends ProfileUpgradeIntentBase {
  readonly status: "completed";
  readonly completion: "already-satisfied" | "upgraded";
  readonly remainingSteps: readonly [];
}

export interface CancelledProfileUpgradeIntent extends ProfileUpgradeIntentBase {
  readonly status: "cancelled";
}

export interface IncompatibleProfileUpgradeIntent
  extends ProfileUpgradeIntentBase {
  readonly status: "incompatible";
  readonly reason: Extract<
    ProfileUpgradePlan,
    { readonly kind: "incompatible" }
  >["reason"];
  readonly plannedSteps: readonly [];
  readonly acknowledgedSteps: readonly [];
  readonly remainingSteps: readonly [];
}

export type ProfileUpgradeIntentState =
  | ReadyProfileUpgradeIntent
  | InFlightProfileUpgradeIntent
  | BlockedProfileUpgradeIntent
  | CompletedProfileUpgradeIntent
  | CancelledProfileUpgradeIntent
  | IncompatibleProfileUpgradeIntent;

export type CancellableProfileUpgradeIntent =
  | ReadyProfileUpgradeIntent
  | BlockedProfileUpgradeIntent;

export interface CreateProfileUpgradeIntentInput {
  readonly intentId: string;
  readonly requestedToolId: string;
  readonly acknowledged: AcknowledgedProfileState;
  readonly minimumProfileId: BpmnProfileId;
}

export type PersistBpmnProfileUpgradeStep = (
  step: ProfileUpgradeStep,
  state: InFlightProfileUpgradeIntent,
) => Promise<ProcessModelSaveResponse>;

export interface RunBpmnProfileUpgradeIntentOptions {
  readonly persistStep: PersistBpmnProfileUpgradeStep;
  readonly onStateChange?: (state: ProfileUpgradeIntentState) => void;
}

function freezeIds(values: readonly BpmnProfileId[]) {
  return Object.freeze([...values]);
}

function freezeAcknowledgedProfileState(
  state: AcknowledgedProfileState,
): AcknowledgedProfileState {
  return Object.freeze({ ...state });
}

function assertIntentInput(input: CreateProfileUpgradeIntentInput): void {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(input.intentId) ||
    input.requestedToolId.trim().length === 0 ||
    input.acknowledged.revisionToken.trim().length === 0
  ) {
    throw new TypeError("Invalid BPMN profile upgrade intent input.");
  }
}

function idempotencyKeyForStep(
  intentId: string,
  targetProfileId: BpmnProfileId,
): string {
  return `save-model:profile-upgrade:${intentId}:${targetProfileId}`;
}

function recoveryForFailure(
  failure: ProfileUpgradeFailure,
): ProfileUpgradeRecovery {
  if (failure.kind === "unavailable") return "RETRY_SAME_STEP";
  if (failure.kind === "unauthenticated") {
    return "REAUTHENTICATE_AND_RETRY";
  }
  if (failure.kind === "conflict") return "RELOAD_AND_REPLAN";
  return "RESELECT_OR_REPLAN";
}

function isProfileUpgradeSuccess(
  result: ProcessModelSaveResponse,
): result is ProfileUpgradeSuccess {
  return result.kind === "acknowledged" || result.kind === "idempotent";
}

function blockProfileUpgradeStep(
  state: InFlightProfileUpgradeIntent,
  failure: ProfileUpgradeFailure,
): BlockedProfileUpgradeIntent {
  return {
    intentId: state.intentId,
    requestedToolId: state.requestedToolId,
    minimumProfileId: state.minimumProfileId,
    acknowledged: state.acknowledged,
    plannedSteps: state.plannedSteps,
    acknowledgedSteps: state.acknowledgedSteps,
    remainingSteps: state.remainingSteps,
    status: "blocked",
    failedStep: state.pendingStep,
    failure,
    recovery: recoveryForFailure(failure),
  };
}

export function createBpmnProfileUpgradeIntent(
  input: CreateProfileUpgradeIntentInput,
): ProfileUpgradeIntentState {
  assertIntentInput(input);
  const plan = planBpmnProfileUpgrade(
    input.acknowledged.profileId,
    input.minimumProfileId,
  );
  const base = {
    intentId: input.intentId,
    requestedToolId: input.requestedToolId,
    minimumProfileId: input.minimumProfileId,
    acknowledged: freezeAcknowledgedProfileState(input.acknowledged),
  } as const;

  if (plan.kind === "incompatible") {
    return {
      ...base,
      status: "incompatible",
      reason: plan.reason,
      plannedSteps: [],
      acknowledgedSteps: [],
      remainingSteps: [],
    };
  }

  if (plan.kind === "already-satisfied") {
    return {
      ...base,
      status: "completed",
      completion: "already-satisfied",
      plannedSteps: [],
      acknowledgedSteps: [],
      remainingSteps: [],
    };
  }

  const plannedSteps = freezeIds(plan.steps);
  return {
    ...base,
    status: "ready",
    plannedSteps,
    acknowledgedSteps: [],
    remainingSteps: plannedSteps,
  };
}

export function startNextBpmnProfileUpgradeStep(
  state: ReadyProfileUpgradeIntent,
): InFlightProfileUpgradeIntent;
export function startNextBpmnProfileUpgradeStep(
  state: ProfileUpgradeIntentState,
): ProfileUpgradeIntentState;
export function startNextBpmnProfileUpgradeStep(
  state: ProfileUpgradeIntentState,
): ProfileUpgradeIntentState {
  if (state.status !== "ready") return state;
  const targetProfileId = state.remainingSteps[0];
  if (
    !targetProfileId ||
    !canTransitionBpmnProfile(
      state.acknowledged.profileId,
      targetProfileId,
    )
  ) {
    throw new Error("Invalid BPMN profile upgrade plan state.");
  }

  return {
    ...state,
    status: "in-flight",
    pendingStep: {
      fromProfileId: state.acknowledged.profileId,
      targetProfileId,
      expectedRevisionToken: state.acknowledged.revisionToken,
      idempotencyKey: idempotencyKeyForStep(state.intentId, targetProfileId),
      ordinal: state.acknowledgedSteps.length + 1,
      total: state.plannedSteps.length,
    },
  };
}

export function settleBpmnProfileUpgradeStep(
  state: InFlightProfileUpgradeIntent,
  result: ProcessModelSaveResponse,
):
  | ReadyProfileUpgradeIntent
  | BlockedProfileUpgradeIntent
  | CompletedProfileUpgradeIntent;
export function settleBpmnProfileUpgradeStep(
  state: ProfileUpgradeIntentState,
  result: ProcessModelSaveResponse,
): ProfileUpgradeIntentState;
export function settleBpmnProfileUpgradeStep(
  state: ProfileUpgradeIntentState,
  result: ProcessModelSaveResponse,
): ProfileUpgradeIntentState {
  if (state.status !== "in-flight") return state;

  if (isProfileUpgradeSuccess(result)) {
    if (result.revisionToken.trim().length === 0) {
      return blockProfileUpgradeStep(state, { kind: "unavailable" });
    }
    const acknowledgedSteps = freezeIds([
      ...state.acknowledgedSteps,
      state.pendingStep.targetProfileId,
    ]);
    const remainingSteps = freezeIds(state.remainingSteps.slice(1));
    const acknowledged = freezeAcknowledgedProfileState({
      profileId: state.pendingStep.targetProfileId,
      revisionToken: result.revisionToken,
    });

    if (remainingSteps.length === 0) {
      return {
        intentId: state.intentId,
        requestedToolId: state.requestedToolId,
        minimumProfileId: state.minimumProfileId,
        acknowledged,
        plannedSteps: state.plannedSteps,
        acknowledgedSteps,
        remainingSteps: [],
        status: "completed",
        completion: "upgraded",
      };
    }

    return {
      intentId: state.intentId,
      requestedToolId: state.requestedToolId,
      minimumProfileId: state.minimumProfileId,
      acknowledged,
      plannedSteps: state.plannedSteps,
      acknowledgedSteps,
      remainingSteps,
      status: "ready",
    };
  }

  return blockProfileUpgradeStep(state, result);
}

export function resumeBpmnProfileUpgradeIntent(
  state: BlockedProfileUpgradeIntent,
): ReadyProfileUpgradeIntent | BlockedProfileUpgradeIntent;
export function resumeBpmnProfileUpgradeIntent(
  state: ProfileUpgradeIntentState,
): ProfileUpgradeIntentState;
export function resumeBpmnProfileUpgradeIntent(
  state: ProfileUpgradeIntentState,
): ProfileUpgradeIntentState {
  if (state.status !== "blocked") return state;
  if (
    state.recovery !== "RETRY_SAME_STEP" &&
    state.recovery !== "REAUTHENTICATE_AND_RETRY"
  ) {
    return state;
  }
  return {
    intentId: state.intentId,
    requestedToolId: state.requestedToolId,
    minimumProfileId: state.minimumProfileId,
    acknowledged: state.acknowledged,
    plannedSteps: state.plannedSteps,
    acknowledgedSteps: state.acknowledgedSteps,
    remainingSteps: state.remainingSteps,
    status: "ready",
  };
}

export function cancelBpmnProfileUpgradeIntent(
  state: CancellableProfileUpgradeIntent,
): CancelledProfileUpgradeIntent;
export function cancelBpmnProfileUpgradeIntent(
  state: ProfileUpgradeIntentState,
): ProfileUpgradeIntentState;
export function cancelBpmnProfileUpgradeIntent(
  state: ProfileUpgradeIntentState,
): ProfileUpgradeIntentState {
  if (state.status !== "ready" && state.status !== "blocked") return state;
  return {
    intentId: state.intentId,
    requestedToolId: state.requestedToolId,
    minimumProfileId: state.minimumProfileId,
    acknowledged: state.acknowledged,
    plannedSteps: state.plannedSteps,
    acknowledgedSteps: state.acknowledgedSteps,
    remainingSteps: state.remainingSteps,
    status: "cancelled",
  };
}

/**
 * Runs a planned profile upgrade one immediate successor at a time.
 *
 * The runner deliberately leaves in-flight intents untouched because their
 * persistence outcome is unknown. A blocked intent is resumed only when the
 * pure facade marks its recovery as safe to retry in-session.
 */
export async function runBpmnProfileUpgradeIntent(
  initialState: ProfileUpgradeIntentState,
  options: RunBpmnProfileUpgradeIntentOptions,
): Promise<ProfileUpgradeIntentState> {
  let state =
    initialState.status === "blocked"
      ? resumeBpmnProfileUpgradeIntent(initialState)
      : initialState;

  while (state.status === "ready") {
    const inFlight = startNextBpmnProfileUpgradeStep(state);
    options.onStateChange?.(inFlight);

    let result: ProcessModelSaveResponse;
    try {
      result = await options.persistStep(inFlight.pendingStep, inFlight);
    } catch {
      result = { kind: "unavailable" };
    }

    state = settleBpmnProfileUpgradeStep(inFlight, result);
    options.onStateChange?.(state);
  }

  return state;
}
