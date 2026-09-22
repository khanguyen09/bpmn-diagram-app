import type {
  BpmnInspectionIssue,
  CoreBpmnElement,
} from "./core-profile";
import { countGraphemes } from "./swimlane-role-authoring";

function issue(
  ruleId: string,
  message: string,
  recovery: string,
  disposition: "fatal" | "recoverable",
  elementId: string,
): BpmnInspectionIssue {
  return {
    ruleId,
    severity: disposition === "fatal" ? "error" : "warning",
    disposition,
    elementId,
    message,
    recovery,
  };
}

export function inspectComplexRouting(
  elements: readonly CoreBpmnElement[],
): readonly BpmnInspectionIssue[] {
  return elements
    .filter((element) => element.type === "bpmn:ComplexGateway")
    .flatMap((gateway): readonly BpmnInspectionIssue[] => {
      const issues: BpmnInspectionIssue[] = [];
      if (
        gateway.gatewayDirection !== undefined &&
        gateway.gatewayDirection !== "Converging"
      ) {
        issues.push(issue(
          "BPMN-COMPLEX-001",
          "Complex Gateway v1 chỉ hỗ trợ gatewayDirection=Converging.",
          "Đổi sang join có tối thiểu hai incoming và một outgoing.",
          "fatal",
          gateway.id,
        ));
      }
      if (gateway.defaultFlowId) {
        issues.push(issue(
          "BPMN-COMPLEX-002",
          "Complex join không hỗ trợ default flow.",
          "Xóa default reference.",
          "fatal",
          gateway.id,
        ));
      }
      if (gateway.incoming.length < 2 || gateway.outgoing.length !== 1) {
        issues.push(issue(
          "BPMN-COMPLEX-003",
          "Complex join cần tối thiểu hai incoming và đúng một outgoing.",
          "Hoàn thiện topology join trước khi seal.",
          gateway.outgoing.length <= 1
            ? "recoverable"
            : "fatal",
          gateway.id,
        ));
      }
      const expression = gateway.activationCondition ?? "";
      if (!expression.trim()) {
        issues.push(issue(
          "BPMN-COMPLEX-004",
          "Complex join chưa có activationCondition.",
          "Nhập plain-text FormalExpression 1..500 grapheme.",
          "recoverable",
          gateway.id,
        ));
      } else if (
        countGraphemes(expression) > 500 ||
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(expression)
      ) {
        issues.push(issue(
          "BPMN-COMPLEX-004",
          "activationCondition nằm ngoài bounded plain-text contract.",
          "Dùng plain text tối đa 500 grapheme, không control characters.",
          "fatal",
          gateway.id,
        ));
      }
      return issues;
    });
}
