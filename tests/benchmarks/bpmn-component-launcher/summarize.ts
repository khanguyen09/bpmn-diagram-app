import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const BENCHMARK_SCHEMA_VERSION = "1.0.0" as const;
export const BENCHMARK_STUDY_ID = "sdd45-bpmn-component-launcher" as const;

export const BENCHMARK_TASK_IDS = [
  "place_task",
  "search_timer_catch",
  "upgrade_subprocess",
  "cancel_data_store_upgrade",
  "keyboard_quick_add",
] as const;

export type BenchmarkTaskId = (typeof BENCHMARK_TASK_IDS)[number];

const TASK_DURATION_LIMIT_SECONDS: Readonly<Record<BenchmarkTaskId, number>> = {
  place_task: 8,
  search_timer_catch: 15,
  upgrade_subprocess: 25,
  cancel_data_store_upgrade: 10,
  keyboard_quick_add: 8,
};

const PARTICIPANT_KINDS = ["human", "automated_preflight"] as const;
const EXPERIENCE_BANDS = [
  "new_or_occasional",
  "regular_or_intermediate",
  "not_applicable",
] as const;
const DISPOSITIONS = [
  "complete",
  "participant_withdrew",
  "technical_failure",
  "automated_preflight",
] as const;
const PROTOCOL_VARIANTS = ["A", "B"] as const;
const TASK_OUTCOMES = [
  "success_unassisted",
  "success_assisted",
  "not_completed",
] as const;
const ERROR_CODES = [
  "wrong_control",
  "wrong_tool",
  "unexpected_profile_card",
  "duplicate_confirmation",
  "placement_miss",
  "keyboard_focus_loss",
  "unexpected_scroll",
  "other_observed",
] as const;

type ParticipantKind = (typeof PARTICIPANT_KINDS)[number];
type ExperienceBand = (typeof EXPERIENCE_BANDS)[number];
type SessionDisposition = (typeof DISPOSITIONS)[number];
type ProtocolVariant = (typeof PROTOCOL_VARIANTS)[number];
type TaskOutcome = (typeof TASK_OUTCOMES)[number];
type ErrorCode = (typeof ERROR_CODES)[number];

export interface BenchmarkTaskRecord {
  readonly taskId: BenchmarkTaskId;
  readonly outcome: TaskOutcome;
  readonly durationSeconds: number;
  readonly commandActions: number;
  readonly typedCharacters: number;
  readonly scrollGestures: number;
  readonly redundantActivations: number;
  readonly errors: readonly {
    readonly code: ErrorCode;
    readonly recovered: boolean;
  }[];
  readonly seq: number | null;
}

export interface BenchmarkSessionRecord {
  readonly schemaVersion: typeof BENCHMARK_SCHEMA_VERSION;
  readonly studyId: typeof BENCHMARK_STUDY_ID;
  readonly sessionId: string;
  readonly participantId: string;
  readonly participantKind: ParticipantKind;
  readonly experienceBand: ExperienceBand;
  readonly disposition: SessionDisposition;
  readonly implementationTeamMember: boolean;
  readonly protocolVariant: ProtocolVariant;
  readonly buildRevision: string;
  readonly startedAt: string;
  readonly firstAttemptLauncherDiscovery: boolean | null;
  readonly tasks: readonly BenchmarkTaskRecord[];
}

export type BenchmarkStatus =
  | "NOT_RUN"
  | "BLOCKED_INSUFFICIENT_HUMANS"
  | "BLOCKED_UNREPRESENTATIVE_SAMPLE"
  | "BLOCKED_PROTOCOL_VIOLATION"
  | "COMPLETED_NOT_MET"
  | "COMPLETED_MET";

interface ThresholdResult<T> {
  readonly actual: T | null;
  readonly target: string;
  readonly met: boolean;
}

export interface BenchmarkTaskSummary {
  readonly taskId: BenchmarkTaskId;
  readonly attemptCount: number;
  readonly unassistedSuccessCount: number;
  readonly assistedSuccessCount: number;
  readonly notCompletedCount: number;
  readonly unassistedSuccessRate: number | null;
  readonly medianUnassistedSuccessDurationSeconds: number | null;
  readonly medianCommandActions: number | null;
  readonly totalScrollGestures: number;
  readonly totalErrors: number;
  readonly totalRedundantActivations: number;
  readonly meanSeq: number | null;
}

export interface BenchmarkSummary {
  readonly schemaVersion: typeof BENCHMARK_SCHEMA_VERSION;
  readonly studyId: typeof BENCHMARK_STUDY_ID;
  readonly status: BenchmarkStatus;
  readonly rawSessionCount: number;
  readonly eligibleHumanParticipantCount: number;
  readonly excludedSessionCount: number;
  readonly exclusions: {
    readonly automatedPreflight: number;
    readonly participantWithdrew: number;
    readonly technicalFailure: number;
  };
  readonly sample: {
    readonly newOrOccasional: number;
    readonly regularOrIntermediate: number;
    readonly implementationTeamMembers: number;
    readonly protocolVariantA: number;
    readonly protocolVariantB: number;
    readonly buildRevisions: readonly string[];
  };
  readonly overall: {
    readonly taskAttemptCount: number;
    readonly unassistedSuccessCount: number;
    readonly unassistedTaskSuccessRate: number | null;
    readonly firstAttemptDiscoveryCount: number;
    readonly firstAttemptDiscoveryRate: number | null;
    readonly totalScrollGestures: number;
    readonly totalErrors: number;
    readonly totalRedundantActivations: number;
    readonly meanSeq: number | null;
  };
  readonly tasks: readonly BenchmarkTaskSummary[];
  readonly thresholds: {
    readonly participantCount: ThresholdResult<number>;
    readonly representativeSample: ThresholdResult<boolean>;
    readonly implementationTeamCap: ThresholdResult<boolean>;
    readonly frozenBuild: ThresholdResult<boolean>;
    readonly balancedProtocolVariants: ThresholdResult<boolean>;
    readonly unassistedTaskSuccessRate: ThresholdResult<number>;
    readonly firstAttemptDiscoverability: ThresholdResult<number>;
    readonly meanSeq: ThresholdResult<number>;
    readonly redundantActivations: ThresholdResult<number>;
    readonly durationSeconds: Readonly<
      Record<BenchmarkTaskId, ThresholdResult<number>>
    >;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(pathLabel: string, message: string): never {
  throw new Error(`Invalid benchmark record at ${pathLabel}: ${message}`);
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  pathLabel: string,
): void {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    fail(
      pathLabel,
      `unexpected field(s): ${unexpected.sort().join(", ")}`,
    );
  }
}

function requiredString(
  value: unknown,
  pathLabel: string,
  minimumLength = 1,
): string {
  if (typeof value !== "string" || value.length < minimumLength) {
    fail(pathLabel, `expected a string of at least ${minimumLength} characters`);
  }
  return value;
}

function requiredPseudonymousId(
  value: unknown,
  prefix: "p" | "s",
  pathLabel: string,
): string {
  const id = requiredString(value, pathLabel, 6);
  const pattern = new RegExp(`^${prefix}_[a-z0-9_-]{4,64}$`);
  if (!pattern.test(id)) {
    fail(
      pathLabel,
      `expected a pseudonymous ${prefix}_ identifier with no PII`,
    );
  }
  return id;
}

function requiredEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  pathLabel: string,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    fail(pathLabel, `expected one of ${allowed.join(", ")}`);
  }
  return value as T[number];
}

function requiredCount(value: unknown, pathLabel: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    fail(pathLabel, "expected a non-negative safe integer");
  }
  return value;
}

function requiredDuration(value: unknown, pathLabel: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(pathLabel, "expected a finite non-negative number");
  }
  return value;
}

function nullableSeq(value: unknown, pathLabel: string): number | null {
  if (value === null) {
    return null;
  }
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 1 ||
    value > 7
  ) {
    fail(pathLabel, "expected null or a number from 1 through 7");
  }
  return value;
}

function parseTask(value: unknown, pathLabel: string): BenchmarkTaskRecord {
  if (!isRecord(value)) {
    fail(pathLabel, "expected an object");
  }
  assertOnlyKeys(
    value,
    [
      "taskId",
      "outcome",
      "durationSeconds",
      "commandActions",
      "typedCharacters",
      "scrollGestures",
      "redundantActivations",
      "errors",
      "seq",
    ],
    pathLabel,
  );
  if (!Array.isArray(value.errors)) {
    fail(`${pathLabel}.errors`, "expected an array");
  }

  const errors = value.errors.map((entry, index) => {
    const errorPath = `${pathLabel}.errors[${index}]`;
    if (!isRecord(entry)) {
      fail(errorPath, "expected an object");
    }
    assertOnlyKeys(entry, ["code", "recovered"], errorPath);
    if (typeof entry.recovered !== "boolean") {
      fail(`${errorPath}.recovered`, "expected a boolean");
    }
    return {
      code: requiredEnum(entry.code, ERROR_CODES, `${errorPath}.code`),
      recovered: entry.recovered,
    };
  });

  return {
    taskId: requiredEnum(value.taskId, BENCHMARK_TASK_IDS, `${pathLabel}.taskId`),
    outcome: requiredEnum(value.outcome, TASK_OUTCOMES, `${pathLabel}.outcome`),
    durationSeconds: requiredDuration(
      value.durationSeconds,
      `${pathLabel}.durationSeconds`,
    ),
    commandActions: requiredCount(
      value.commandActions,
      `${pathLabel}.commandActions`,
    ),
    typedCharacters: requiredCount(
      value.typedCharacters,
      `${pathLabel}.typedCharacters`,
    ),
    scrollGestures: requiredCount(
      value.scrollGestures,
      `${pathLabel}.scrollGestures`,
    ),
    redundantActivations: requiredCount(
      value.redundantActivations,
      `${pathLabel}.redundantActivations`,
    ),
    errors,
    seq: nullableSeq(value.seq, `${pathLabel}.seq`),
  };
}

export function validateBenchmarkSession(
  value: unknown,
  sourceLabel = "session",
): BenchmarkSessionRecord {
  if (!isRecord(value)) {
    fail(sourceLabel, "expected an object");
  }
  assertOnlyKeys(
    value,
    [
      "schemaVersion",
      "studyId",
      "sessionId",
      "participantId",
      "participantKind",
      "experienceBand",
      "disposition",
      "implementationTeamMember",
      "protocolVariant",
      "buildRevision",
      "startedAt",
      "firstAttemptLauncherDiscovery",
      "tasks",
    ],
    sourceLabel,
  );
  if (value.schemaVersion !== BENCHMARK_SCHEMA_VERSION) {
    fail(
      `${sourceLabel}.schemaVersion`,
      `expected ${BENCHMARK_SCHEMA_VERSION}`,
    );
  }
  if (value.studyId !== BENCHMARK_STUDY_ID) {
    fail(`${sourceLabel}.studyId`, `expected ${BENCHMARK_STUDY_ID}`);
  }
  if (!Array.isArray(value.tasks)) {
    fail(`${sourceLabel}.tasks`, "expected an array");
  }

  const participantKind = requiredEnum(
    value.participantKind,
    PARTICIPANT_KINDS,
    `${sourceLabel}.participantKind`,
  );
  const experienceBand = requiredEnum(
    value.experienceBand,
    EXPERIENCE_BANDS,
    `${sourceLabel}.experienceBand`,
  );
  const disposition = requiredEnum(
    value.disposition,
    DISPOSITIONS,
    `${sourceLabel}.disposition`,
  );
  const tasks = value.tasks.map((task, index) =>
    parseTask(task, `${sourceLabel}.tasks[${index}]`),
  );
  const uniqueTaskIds = new Set(tasks.map(({ taskId }) => taskId));
  if (uniqueTaskIds.size !== tasks.length) {
    fail(`${sourceLabel}.tasks`, "taskId values must be unique within a session");
  }

  if (
    value.firstAttemptLauncherDiscovery !== null &&
    typeof value.firstAttemptLauncherDiscovery !== "boolean"
  ) {
    fail(
      `${sourceLabel}.firstAttemptLauncherDiscovery`,
      "expected a boolean or null",
    );
  }
  if (typeof value.implementationTeamMember !== "boolean") {
    fail(`${sourceLabel}.implementationTeamMember`, "expected a boolean");
  }

  if (participantKind === "automated_preflight") {
    if (
      disposition !== "automated_preflight" ||
      experienceBand !== "not_applicable"
    ) {
      fail(
        sourceLabel,
        "automated preflight records must use automated_preflight disposition and not_applicable experience",
      );
    }
  } else {
    if (
      disposition === "automated_preflight" ||
      experienceBand === "not_applicable"
    ) {
      fail(
        sourceLabel,
        "human records require a human experience band and non-preflight disposition",
      );
    }
  }

  if (disposition === "complete") {
    if (participantKind !== "human") {
      fail(sourceLabel, "only human sessions can be complete benchmark sessions");
    }
    if (
      tasks.length !== BENCHMARK_TASK_IDS.length ||
      BENCHMARK_TASK_IDS.some((taskId) => !uniqueTaskIds.has(taskId))
    ) {
      fail(
        `${sourceLabel}.tasks`,
        `complete sessions require exactly: ${BENCHMARK_TASK_IDS.join(", ")}`,
      );
    }
    if (typeof value.firstAttemptLauncherDiscovery !== "boolean") {
      fail(
        `${sourceLabel}.firstAttemptLauncherDiscovery`,
        "complete sessions require a boolean observation",
      );
    }
    if (tasks.some(({ seq }) => seq === null)) {
      fail(`${sourceLabel}.tasks`, "complete sessions require SEQ for every task");
    }
  }

  const startedAt = requiredString(value.startedAt, `${sourceLabel}.startedAt`);
  if (Number.isNaN(Date.parse(startedAt))) {
    fail(`${sourceLabel}.startedAt`, "expected an ISO 8601 date-time");
  }

  return {
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    studyId: BENCHMARK_STUDY_ID,
    sessionId: requiredPseudonymousId(
      value.sessionId,
      "s",
      `${sourceLabel}.sessionId`,
    ),
    participantId: requiredPseudonymousId(
      value.participantId,
      "p",
      `${sourceLabel}.participantId`,
    ),
    participantKind,
    experienceBand,
    disposition,
    implementationTeamMember: value.implementationTeamMember,
    protocolVariant: requiredEnum(
      value.protocolVariant,
      PROTOCOL_VARIANTS,
      `${sourceLabel}.protocolVariant`,
    ),
    buildRevision: (() => {
      const revision = requiredString(
        value.buildRevision,
        `${sourceLabel}.buildRevision`,
        7,
      );
      if (revision.length > 120) {
        fail(`${sourceLabel}.buildRevision`, "expected at most 120 characters");
      }
      return revision;
    })(),
    startedAt,
    firstAttemptLauncherDiscovery: value.firstAttemptLauncherDiscovery,
    tasks,
  };
}

function round(value: number, decimalPlaces = 3): number {
  const scale = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : round(numerator / denominator);
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? round((sorted[middle - 1] + sorted[middle]) / 2)
    : round(sorted[middle]);
}

function threshold<T>(
  actual: T | null,
  target: string,
  met: boolean,
): ThresholdResult<T> {
  return { actual, target, met };
}

export function summarizeBenchmarkSessions(
  rawSessions: readonly unknown[],
): BenchmarkSummary {
  const sessions = rawSessions.map((session, index) =>
    validateBenchmarkSession(session, `sessions[${index}]`),
  );

  const sessionIds = new Set<string>();
  for (const session of sessions) {
    if (sessionIds.has(session.sessionId)) {
      fail("sessions", `duplicate sessionId ${session.sessionId}`);
    }
    sessionIds.add(session.sessionId);
  }

  const eligible = sessions.filter(
    (session) =>
      session.participantKind === "human" && session.disposition === "complete",
  );
  const participantIds = new Set<string>();
  for (const session of eligible) {
    if (participantIds.has(session.participantId)) {
      fail(
        "sessions",
        `participantId ${session.participantId} has more than one complete session`,
      );
    }
    participantIds.add(session.participantId);
  }

  const newOrOccasional = eligible.filter(
    ({ experienceBand }) => experienceBand === "new_or_occasional",
  ).length;
  const regularOrIntermediate = eligible.filter(
    ({ experienceBand }) => experienceBand === "regular_or_intermediate",
  ).length;
  const implementationTeamMembers = eligible.filter(
    ({ implementationTeamMember }) => implementationTeamMember,
  ).length;
  const protocolVariantA = eligible.filter(
    ({ protocolVariant }) => protocolVariant === "A",
  ).length;
  const protocolVariantB = eligible.length - protocolVariantA;
  const buildRevisions = [
    ...new Set(eligible.map(({ buildRevision }) => buildRevision)),
  ].sort();

  const taskSummaries = BENCHMARK_TASK_IDS.map((taskId) => {
    const attempts = eligible.flatMap(({ tasks }) =>
      tasks.filter((task) => task.taskId === taskId),
    );
    const unassisted = attempts.filter(
      ({ outcome }) => outcome === "success_unassisted",
    );
    const assisted = attempts.filter(
      ({ outcome }) => outcome === "success_assisted",
    );
    const notCompleted = attempts.filter(
      ({ outcome }) => outcome === "not_completed",
    );
    const seqValues = attempts.flatMap(({ seq }) => (seq === null ? [] : [seq]));

    return {
      taskId,
      attemptCount: attempts.length,
      unassistedSuccessCount: unassisted.length,
      assistedSuccessCount: assisted.length,
      notCompletedCount: notCompleted.length,
      unassistedSuccessRate: rate(unassisted.length, attempts.length),
      medianUnassistedSuccessDurationSeconds: median(
        unassisted.map(({ durationSeconds }) => durationSeconds),
      ),
      medianCommandActions: median(
        attempts.map(({ commandActions }) => commandActions),
      ),
      totalScrollGestures: attempts.reduce(
        (total, { scrollGestures }) => total + scrollGestures,
        0,
      ),
      totalErrors: attempts.reduce(
        (total, { errors }) => total + errors.length,
        0,
      ),
      totalRedundantActivations: attempts.reduce(
        (total, { redundantActivations }) => total + redundantActivations,
        0,
      ),
      meanSeq: mean(seqValues),
    } satisfies BenchmarkTaskSummary;
  });

  const allAttempts = eligible.flatMap(({ tasks }) => tasks);
  const unassistedSuccessCount = allAttempts.filter(
    ({ outcome }) => outcome === "success_unassisted",
  ).length;
  const firstAttemptDiscoveryCount = eligible.filter(
    ({ firstAttemptLauncherDiscovery }) => firstAttemptLauncherDiscovery,
  ).length;
  const totalScrollGestures = taskSummaries.reduce(
    (total, task) => total + task.totalScrollGestures,
    0,
  );
  const totalErrors = taskSummaries.reduce(
    (total, task) => total + task.totalErrors,
    0,
  );
  const totalRedundantActivations = taskSummaries.reduce(
    (total, task) => total + task.totalRedundantActivations,
    0,
  );
  const seqValues = allAttempts.flatMap(({ seq }) => (seq === null ? [] : [seq]));
  const unassistedTaskSuccessRate = rate(
    unassistedSuccessCount,
    allAttempts.length,
  );
  const firstAttemptDiscoveryRate = rate(
    firstAttemptDiscoveryCount,
    eligible.length,
  );
  const overallMeanSeq = mean(seqValues);

  const participantCountMet = eligible.length >= 6 && eligible.length <= 8;
  const representativeSampleMet =
    newOrOccasional >= 3 && regularOrIntermediate >= 3;
  const implementationTeamCapMet = implementationTeamMembers <= 2;
  const frozenBuildMet = eligible.length > 0 && buildRevisions.length === 1;
  const balancedProtocolVariantsMet =
    eligible.length > 0 && Math.abs(protocolVariantA - protocolVariantB) <= 1;

  const durationSeconds = Object.fromEntries(
    taskSummaries.map((task) => {
      const limit = TASK_DURATION_LIMIT_SECONDS[task.taskId];
      const actual = task.medianUnassistedSuccessDurationSeconds;
      return [
        task.taskId,
        threshold(actual, `median <= ${limit}s`, actual !== null && actual <= limit),
      ];
    }),
  ) as Record<BenchmarkTaskId, ThresholdResult<number>>;

  const unassistedSuccessMet =
    unassistedTaskSuccessRate !== null && unassistedTaskSuccessRate >= 0.9;
  const discoveryMet = firstAttemptDiscoveryCount >= 6;
  const seqMet = overallMeanSeq !== null && overallMeanSeq >= 5.5;
  const redundantActivationMet = totalRedundantActivations === 0;
  const performanceTargetsMet =
    unassistedSuccessMet &&
    discoveryMet &&
    seqMet &&
    redundantActivationMet &&
    Object.values(durationSeconds).every(({ met }) => met);

  let status: BenchmarkStatus;
  if (eligible.length === 0) {
    status = "NOT_RUN";
  } else if (eligible.length < 6) {
    status = "BLOCKED_INSUFFICIENT_HUMANS";
  } else if (eligible.length > 8) {
    status = "BLOCKED_PROTOCOL_VIOLATION";
  } else if (!representativeSampleMet) {
    status = "BLOCKED_UNREPRESENTATIVE_SAMPLE";
  } else if (
    !implementationTeamCapMet ||
    !frozenBuildMet ||
    !balancedProtocolVariantsMet
  ) {
    status = "BLOCKED_PROTOCOL_VIOLATION";
  } else {
    status = performanceTargetsMet ? "COMPLETED_MET" : "COMPLETED_NOT_MET";
  }

  return {
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    studyId: BENCHMARK_STUDY_ID,
    status,
    rawSessionCount: sessions.length,
    eligibleHumanParticipantCount: eligible.length,
    excludedSessionCount: sessions.length - eligible.length,
    exclusions: {
      automatedPreflight: sessions.filter(
        ({ disposition }) => disposition === "automated_preflight",
      ).length,
      participantWithdrew: sessions.filter(
        ({ disposition }) => disposition === "participant_withdrew",
      ).length,
      technicalFailure: sessions.filter(
        ({ disposition }) => disposition === "technical_failure",
      ).length,
    },
    sample: {
      newOrOccasional,
      regularOrIntermediate,
      implementationTeamMembers,
      protocolVariantA,
      protocolVariantB,
      buildRevisions,
    },
    overall: {
      taskAttemptCount: allAttempts.length,
      unassistedSuccessCount,
      unassistedTaskSuccessRate,
      firstAttemptDiscoveryCount,
      firstAttemptDiscoveryRate,
      totalScrollGestures,
      totalErrors,
      totalRedundantActivations,
      meanSeq: overallMeanSeq,
    },
    tasks: taskSummaries,
    thresholds: {
      participantCount: threshold(
        eligible.length,
        "6-8 eligible human participants",
        participantCountMet,
      ),
      representativeSample: threshold(
        representativeSampleMet,
        ">=3 new/occasional and >=3 regular/intermediate",
        representativeSampleMet,
      ),
      implementationTeamCap: threshold(
        implementationTeamCapMet,
        "<=2 implementation-team participants",
        implementationTeamCapMet,
      ),
      frozenBuild: threshold(
        frozenBuildMet,
        "exactly one build revision",
        frozenBuildMet,
      ),
      balancedProtocolVariants: threshold(
        balancedProtocolVariantsMet,
        "variant counts differ by at most 1",
        balancedProtocolVariantsMet,
      ),
      unassistedTaskSuccessRate: threshold(
        unassistedTaskSuccessRate,
        ">= 0.9",
        unassistedSuccessMet,
      ),
      firstAttemptDiscoverability: threshold(
        firstAttemptDiscoveryCount,
        ">= 6 participants",
        discoveryMet,
      ),
      meanSeq: threshold(overallMeanSeq, ">= 5.5/7", seqMet),
      redundantActivations: threshold(
        totalRedundantActivations,
        "exactly 0",
        redundantActivationMet,
      ),
      durationSeconds,
    },
  };
}

interface CliOptions {
  readonly inputDirectory: string;
  readonly outputPath?: string;
}

function parseCliOptions(argumentsList: readonly string[]): CliOptions {
  let inputDirectory: string | undefined;
  let outputPath: string | undefined;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];
    if (argument === "--input" && value) {
      inputDirectory = value;
      index += 1;
    } else if (argument === "--output" && value) {
      outputPath = value;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  if (!inputDirectory) {
    throw new Error("--input <session-directory> is required");
  }
  return { inputDirectory, outputPath };
}

async function loadSessionFiles(inputDirectory: string): Promise<unknown[]> {
  const entries = await readdir(inputDirectory, { withFileTypes: true });
  const filenames = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        entry.name !== "aggregate.json",
    )
    .map(({ name }) => name)
    .sort();

  return Promise.all(
    filenames.map(async (filename) => {
      const filePath = path.join(inputDirectory, filename);
      try {
        return JSON.parse(await readFile(filePath, "utf8")) as unknown;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot read ${filename}: ${message}`);
      }
    }),
  );
}

async function runCli(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const sessions = await loadSessionFiles(options.inputDirectory);
  const summary = summarizeBenchmarkSessions(sessions);
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;

  if (options.outputPath) {
    await mkdir(path.dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, serialized, "utf8");
  } else {
    process.stdout.write(serialized);
  }
}

const entryPath = process.argv[1];
if (
  entryPath &&
  import.meta.url === pathToFileURL(path.resolve(entryPath)).href
) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
