import type {
  BpmnInspectionIssue,
  BpmnIssueDisposition,
  BpmnIssueSeverity,
} from "../domain/core-profile";

export type BpmnInspectionFilter = "all" | BpmnIssueSeverity;

export interface BpmnInspectionIssueGroup {
  readonly fingerprint: string;
  readonly ruleId: string;
  readonly disposition?: BpmnIssueDisposition;
  readonly effectiveSeverity: BpmnIssueSeverity;
  readonly message: string;
  readonly recovery: string;
  readonly occurrences: readonly BpmnInspectionIssue[];
  readonly firstOccurrenceIndex: number;
}

export interface BpmnInspectionSeverityCount {
  readonly groupCount: number;
  readonly occurrenceCount: number;
}

export interface BpmnInspectionSummary {
  readonly groupCount: number;
  readonly occurrenceCount: number;
  readonly bySeverity: Readonly<
    Record<BpmnIssueSeverity, BpmnInspectionSeverityCount>
  >;
}

export interface BpmnInspectionPlainLanguageCopy {
  readonly title: string;
  readonly guidance: string;
  readonly source: "catalogue" | "fallback";
}

interface BpmnInspectionPlainLanguageRule {
  readonly matches: (ruleId: string) => boolean;
  readonly title: string;
  readonly guidance: string;
}

const plainLanguageRules: readonly BpmnInspectionPlainLanguageRule[] = [
  {
    matches: (ruleId) => ruleId === "BPMN-MSG-004",
    title: "Sự kiện thông điệp chưa chọn nội dung",
    guidance: "Chọn thông điệp cần gửi hoặc nhận cho sự kiện này.",
  },
  {
    matches: (ruleId) => ruleId === "BPMN-MESSAGE-003",
    title: "Các bên tham gia chưa trao đổi thông điệp",
    guidance: "Nối hai bên tham gia bằng một đường trao đổi thông điệp.",
  },
  {
    matches: (ruleId) => ruleId === "BPMN-PAR-001",
    title: "Điểm chạy song song chưa đủ nhánh",
    guidance: "Giữ một đường vào và thêm ít nhất hai đường ra, hoặc làm ngược lại để hợp nhánh.",
  },
  {
    matches: (ruleId) => ruleId === "BPMN-XOR-001",
    title: "Điểm chọn một hướng chưa đủ nhánh",
    guidance: "Giữ một đường vào và thêm ít nhất hai lựa chọn đi ra, hoặc làm ngược lại để hợp nhánh.",
  },
  {
    matches: (ruleId) => ruleId === "BPMN-INC-001",
    title: "Điểm chọn nhiều hướng chưa đủ nhánh",
    guidance: "Giữ một đường vào và thêm ít nhất hai lựa chọn đi ra, hoặc làm ngược lại để hợp nhánh.",
  },
  {
    matches: (ruleId) => ruleId === "BPMN-EVG-001",
    title: "Điểm chờ sự kiện chưa đủ nhánh",
    guidance: "Thêm ít nhất hai nhánh chờ sau điểm này.",
  },
  {
    matches: (ruleId) => ruleId === "BPMN-EVT-001",
    title: "Sự kiện chờ chưa chọn cách kích hoạt",
    guidance: "Chọn chờ thông điệp hoặc chờ thời gian cho sự kiện này.",
  },
  {
    matches: (ruleId) => ruleId === "BPMN-THROW-001",
    title: "Sự kiện gửi chưa nối đủ đường đi",
    guidance: "Nối một đường đi vào và một đường đi ra cho sự kiện này.",
  },
  {
    matches: (ruleId) => ruleId === "BPMN-CONNECT-001",
    title: "Khu vực quy trình chưa có đường đi hoàn chỉnh",
    guidance: "Bổ sung điểm bắt đầu, điểm kết thúc và đường nối giữa các bước.",
  },
  {
    matches: (ruleId) => ruleId === "BPMN-CONNECT-003",
    title: "Có bước chưa nằm trên đường đi hoàn chỉnh",
    guidance: "Nối các bước liên quan vào đường đi từ điểm bắt đầu đến điểm kết thúc.",
  },
  {
    matches: (ruleId) => ruleId === "TASK-NAME",
    title: "Công việc chưa có tên",
    guidance: "Đặt một tên ngắn gọn để người đọc hiểu bước này dùng để làm gì.",
  },
  {
    matches: (ruleId) => ruleId === "PROCESS-OWNER",
    title: "Sơ đồ còn thiếu thông tin bắt buộc",
    guidance: "Bổ sung thông tin được yêu cầu trước khi hoàn tất sơ đồ.",
  },
  {
    matches: (ruleId) => /(?:^|-)NAME(?:-|$)/u.test(ruleId),
    title: "Có phần tử chưa được đặt tên",
    guidance: "Đặt tên ngắn gọn, rõ hành động hoặc vai trò của phần tử.",
  },
  {
    matches: (ruleId) =>
      /(?:CONNECT|FLOW|ASSOCIATION|DATA-ASSOC)/u.test(ruleId),
    title: "Có đường nối chưa hoàn chỉnh",
    guidance: "Kiểm tra lại điểm bắt đầu, điểm kết thúc và loại đường nối.",
  },
  {
    matches: (ruleId) => /(?:MESSAGE|MSG)/u.test(ruleId),
    title: "Có thông điệp chưa được liên kết đúng",
    guidance: "Kiểm tra nơi gửi, nơi nhận và thông điệp được sử dụng.",
  },
  {
    matches: (ruleId) => /(?:BOUNDARY|EVT|TIMER|THROW|RECEIVE)/u.test(ruleId),
    title: "Có sự kiện chưa được thiết lập đúng",
    guidance: "Chọn vị trí liên quan và hoàn thiện cách sự kiện bắt đầu hoặc kết thúc.",
  },
  {
    matches: (ruleId) => /(?:TASK)/u.test(ruleId),
    title: "Có công việc cần hoàn thiện",
    guidance: "Chọn công việc liên quan và bổ sung thông tin còn thiếu.",
  },
  {
    matches: (ruleId) =>
      /(?:XOR|PAR|INC|COMPLEX|COND|DEFAULT|EVG|MIX)/u.test(ruleId),
    title: "Có điểm rẽ nhánh chưa hoàn chỉnh",
    guidance: "Kiểm tra các nhánh đi vào, đi ra và điều kiện lựa chọn.",
  },
  {
    matches: (ruleId) => /(?:LANE|COLLAB)/u.test(ruleId),
    title: "Có khu vực vai trò cần sắp xếp lại",
    guidance: "Kiểm tra vai trò, phần việc bên trong và ranh giới giữa các khu vực.",
  },
  {
    matches: (ruleId) => /(?:SUBPROCESS|CALL)/u.test(ruleId),
    title: "Có quy trình con chưa hoàn chỉnh",
    guidance: "Kiểm tra nội dung bên trong hoặc quy trình được dùng lại.",
  },
  {
    matches: (ruleId) => /(?:DATA)/u.test(ruleId),
    title: "Có dữ liệu chưa được liên kết đúng",
    guidance: "Kiểm tra dữ liệu được tạo, sử dụng và nơi lưu trữ liên quan.",
  },
  {
    matches: (ruleId) => /(?:ANNOTATION|GROUP|CATEGORY|COLOR|VISUAL)/u.test(ruleId),
    title: "Có phần trình bày cần xem lại",
    guidance: "Kiểm tra nội dung hoặc cách hiển thị của phần tử liên quan.",
  },
  {
    matches: (ruleId) => /(?:^|-)DI(?:-|$)/u.test(ruleId),
    title: "Có phần tử chưa hiển thị đúng vị trí",
    guidance: "Đặt lại phần tử vào vùng hợp lệ rồi kiểm tra sơ đồ lần nữa.",
  },
  {
    matches: (ruleId) => /(?:PROFILE)/u.test(ruleId),
    title: "Sơ đồ có thành phần chưa được hỗ trợ",
    guidance: "Thay thành phần đó bằng một lựa chọn đang có trong thư viện.",
  },
  {
    matches: (ruleId) => /(?:REF|ID)/u.test(ruleId),
    title: "Có liên kết tới phần tử không còn hợp lệ",
    guidance: "Chọn vị trí liên quan và tạo lại liên kết bị thiếu.",
  },
  {
    matches: (ruleId) => /(?:LIMIT)/u.test(ruleId),
    title: "Sơ đồ vượt quá giới hạn hỗ trợ",
    guidance: "Giảm số lượng hoặc kích thước nội dung rồi thử kiểm tra lại.",
  },
  {
    matches: (ruleId) => /(?:SEC|XML|ROUNDTRIP)/u.test(ruleId),
    title: "Không thể đọc sơ đồ một cách an toàn",
    guidance: "Giữ nguyên bản gốc và dùng một tệp sơ đồ hợp lệ để thử lại.",
  },
  {
    matches: (ruleId) => /(?:CONVERT)/u.test(ruleId),
    title: "Chưa thể chuẩn bị bố cục vai trò",
    guidance: "Kiểm tra lại sơ đồ hiện tại trước khi thêm khu vực vai trò.",
  },
];

const fallbackCopy: Readonly<
  Record<BpmnIssueSeverity, Omit<BpmnInspectionPlainLanguageCopy, "source">>
> = {
  error: {
    title: "Sơ đồ có phần chưa hợp lệ",
    guidance: "Xem vị trí liên quan và hoàn thiện trước khi tiếp tục.",
  },
  warning: {
    title: "Sơ đồ còn một bước cần hoàn thiện",
    guidance: "Xem vị trí liên quan và bổ sung thông tin còn thiếu.",
  },
  info: {
    title: "Có thông tin cần xem lại",
    guidance: "Kiểm tra vị trí liên quan trước khi hoàn tất sơ đồ.",
  },
};

/**
 * Converts validator output into primary UI copy without exposing raw rule
 * vocabulary. The raw issue remains the diagnostic source of truth and is
 * rendered separately behind an explicit technical disclosure.
 */
export function presentBpmnInspectionIssueGroup(
  group: Pick<BpmnInspectionIssueGroup, "ruleId" | "effectiveSeverity">,
): BpmnInspectionPlainLanguageCopy {
  const ruleId = group.ruleId.toUpperCase();
  const match = plainLanguageRules.find((rule) => rule.matches(ruleId));
  if (match) {
    return {
      title: match.title,
      guidance: match.guidance,
      source: "catalogue",
    };
  }
  return {
    ...fallbackCopy[group.effectiveSeverity],
    source: "fallback",
  };
}

const severityOrder: Readonly<Record<BpmnIssueSeverity, number>> = {
  error: 0,
  warning: 1,
  info: 2,
};

interface MutableIssueGroup {
  readonly fingerprint: string;
  readonly ruleId: string;
  readonly disposition?: BpmnIssueDisposition;
  readonly effectiveSeverity: BpmnIssueSeverity;
  readonly message: string;
  readonly recovery: string;
  readonly occurrences: BpmnInspectionIssue[];
  readonly firstOccurrenceIndex: number;
}

/**
 * Presentation severity never rewrites the raw validator result. Disposition
 * is the stronger signal because it describes whether the current inspection
 * can continue safely.
 */
export function effectiveBpmnIssueSeverity(
  issue: BpmnInspectionIssue,
): BpmnIssueSeverity {
  if (issue.disposition === "fatal") return "error";
  if (issue.disposition === "recoverable") return "warning";
  return issue.severity;
}

/**
 * Element identity and raw severity are deliberately excluded so repeated
 * instances of the same effective finding can be read as one group without
 * losing their raw occurrences.
 */
export function bpmnInspectionIssueFingerprint(
  issue: BpmnInspectionIssue,
): string {
  return JSON.stringify([
    effectiveBpmnIssueSeverity(issue),
    issue.disposition ?? null,
    issue.ruleId,
    issue.message,
    issue.recovery,
  ]);
}

export function groupBpmnInspectionIssues(
  issues: readonly BpmnInspectionIssue[],
): readonly BpmnInspectionIssueGroup[] {
  const groupsByFingerprint = new Map<string, MutableIssueGroup>();

  issues.forEach((issue, index) => {
    const fingerprint = bpmnInspectionIssueFingerprint(issue);
    const existing = groupsByFingerprint.get(fingerprint);

    if (existing) {
      existing.occurrences.push(issue);
      return;
    }

    groupsByFingerprint.set(fingerprint, {
      fingerprint,
      ruleId: issue.ruleId,
      disposition: issue.disposition,
      effectiveSeverity: effectiveBpmnIssueSeverity(issue),
      message: issue.message,
      recovery: issue.recovery,
      occurrences: [issue],
      firstOccurrenceIndex: index,
    });
  });

  return [...groupsByFingerprint.values()]
    .sort(
      (left, right) =>
        severityOrder[left.effectiveSeverity] -
          severityOrder[right.effectiveSeverity] ||
        left.firstOccurrenceIndex - right.firstOccurrenceIndex,
    )
    .map((group) => ({
      ...group,
      occurrences: [...group.occurrences],
    }));
}

export function summarizeBpmnInspectionGroups(
  groups: readonly BpmnInspectionIssueGroup[],
): BpmnInspectionSummary {
  const bySeverity: Record<BpmnIssueSeverity, BpmnInspectionSeverityCount> = {
    error: { groupCount: 0, occurrenceCount: 0 },
    warning: { groupCount: 0, occurrenceCount: 0 },
    info: { groupCount: 0, occurrenceCount: 0 },
  };

  let occurrenceCount = 0;
  for (const group of groups) {
    const groupOccurrenceCount = group.occurrences.length;
    const current = bySeverity[group.effectiveSeverity];
    bySeverity[group.effectiveSeverity] = {
      groupCount: current.groupCount + 1,
      occurrenceCount: current.occurrenceCount + groupOccurrenceCount,
    };
    occurrenceCount += groupOccurrenceCount;
  }

  return {
    groupCount: groups.length,
    occurrenceCount,
    bySeverity,
  };
}

export function filterBpmnInspectionGroups(
  groups: readonly BpmnInspectionIssueGroup[],
  filter: BpmnInspectionFilter,
): readonly BpmnInspectionIssueGroup[] {
  if (filter === "all") return groups;
  return groups.filter((group) => group.effectiveSeverity === filter);
}
