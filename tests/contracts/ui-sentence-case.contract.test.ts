import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const productRoots = ["app", "modules", "platform", "shared"] as const;

// Acronyms remain uppercase because changing their case would change their meaning.
// Product headings, labels and descriptions are not added here.
const allowedUppercaseTokens = new Set([
  "AI",
  "API",
  "BPMN",
  "BPMNDI",
  "CSS",
  "CSV",
  "DB",
  "DI",
  "DOM",
  "EN",
  "HTML",
  "HTTP",
  "HTTPS",
  "ID",
  "IDS",
  "ISO",
  "JSON",
  "JWT",
  "OR",
  "PDF",
  "RFC",
  "SEO",
  "SQL",
  "TEB",
  "UI",
  "URL",
  "UUID",
  "UX",
  "VI",
  "WCAG",
  "XML",
  "XOR",
]);

type CopyCandidate = {
  readonly file: string;
  readonly line: number;
  readonly origin: "rendered copy" | "static uppercase phrase";
  readonly text: string;
};

const uiCopyPropertyNames = new Set([
  "caption",
  "description",
  "eyebrow",
  "helperText",
  "hint",
  "label",
  "stateLabel",
  "title",
]);

function sourceFiles(extension: ".css" | ".ts" | ".tsx"): string[] {
  const files: string[] = [];
  const visitDirectory = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visitDirectory(path);
        continue;
      }
      if (extname(entry.name) !== extension) continue;
      if (/\.(?:test|spec)\.[^.]+$/.test(entry.name) || entry.name.endsWith(".d.ts")) {
        continue;
      }
      files.push(path);
    }
  };

  for (const root of productRoots) visitDirectory(join(process.cwd(), root));
  return files.sort();
}

function normalizeCopy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uppercaseWords(value: string): string[] {
  return value.match(/[\p{L}][\p{L}\p{N}]*/gu) ?? [];
}

function isAllCapsCopy(value: string): boolean {
  const normalized = normalizeCopy(value);
  const letters = normalized.match(/\p{L}/gu) ?? [];
  if (letters.length < 2) return false;
  return (
    normalized === normalized.toLocaleUpperCase("vi-VN") &&
    normalized !== normalized.toLocaleLowerCase("vi-VN")
  );
}

function isAllowedAcronymCopy(value: string): boolean {
  const words = uppercaseWords(value);
  return (
    words.length > 0 &&
    words.every((word) => allowedUppercaseTokens.has(word.toLocaleUpperCase("en-US")))
  );
}

function isAllowedMachineCode(value: string): boolean {
  // Database liveness probe; never rendered as product copy.
  if (normalizeCopy(value) === "SELECT 1") return true;
  // ISO 8601 duration values are persisted machine codes, not product prose.
  return /^P(?=\d|T\d)(?:\d+(?:[.,]\d+)?[YMWD])*(?:T(?:\d+(?:[.,]\d+)?[HMS])*)?$/.test(
    normalizeCopy(value),
  );
}

function collectStaticCopy(file: string): CopyCandidate[] {
  const sourceText = readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const candidates = new Map<string, CopyCandidate>();

  const record = (
    node: ts.Node,
    rawText: string,
    origin: CopyCandidate["origin"],
  ) => {
    const text = normalizeCopy(rawText);
    if (
      !isAllCapsCopy(text) ||
      isAllowedAcronymCopy(text) ||
      isAllowedMachineCode(text)
    ) {
      return;
    }
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const candidate = {
      file: relative(process.cwd(), file),
      line,
      origin,
      text,
    } as const;
    const key = `${candidate.file}:${line}:${text}`;
    if (!candidates.has(key)) candidates.set(key, candidate);
  };

  const renderedExpression = (expression: ts.Expression): void => {
    if (
      ts.isStringLiteral(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression)
    ) {
      record(expression, expression.text, "rendered copy");
      return;
    }
    if (ts.isTemplateExpression(expression)) {
      record(expression.head, expression.head.text, "rendered copy");
      for (const span of expression.templateSpans) {
        record(span.literal, span.literal.text, "rendered copy");
      }
      return;
    }
    if (ts.isConditionalExpression(expression)) {
      renderedExpression(expression.whenTrue);
      renderedExpression(expression.whenFalse);
      return;
    }
    if (ts.isBinaryExpression(expression)) {
      const operator = expression.operatorToken.kind;
      if (
        operator === ts.SyntaxKind.AmpersandAmpersandToken ||
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken ||
        operator === ts.SyntaxKind.PlusToken
      ) {
        renderedExpression(expression.left);
        renderedExpression(expression.right);
      }
      return;
    }
    if (ts.isArrayLiteralExpression(expression)) {
      for (const element of expression.elements) {
        if (ts.isExpression(element)) renderedExpression(element);
      }
      return;
    }
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isTypeAssertionExpression(expression)
    ) {
      renderedExpression(expression.expression);
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) record(node, node.getText(source), "rendered copy");
    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      record(node.initializer, node.initializer.text, "rendered copy");
    }
    if (ts.isJsxExpression(node) && node.expression) {
      renderedExpression(node.expression);
    }
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      uiCopyPropertyNames.has(node.name.text) &&
      (ts.isStringLiteral(node.initializer) ||
        ts.isNoSubstitutionTemplateLiteral(node.initializer))
    ) {
      record(node.initializer, node.initializer.text, "rendered copy");
    }

    // Multi-word static literals cover helper-returned labels such as profile stage
    // copy without treating one-token command/status enums as product prose.
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      normalizeCopy(node.text).split(/\s+/).length > 1
    ) {
      record(node, node.text, "static uppercase phrase");
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return [...candidates.values()];
}

describe("global UI sentence-case contract", () => {
  it("limits exemptions to real acronyms and persisted machine codes", () => {
    expect(isAllowedAcronymCopy("BPMN XML API SQL ID TEB VI EN UI UX")).toBe(
      true,
    );
    expect(isAllowedAcronymCopy("BPMN REFERENCE")).toBe(false);
    expect(isAllowedMachineCode("PT30M")).toBe(true);
    expect(isAllowedMachineCode("TO_BE")).toBe(false);
  });

  it("does not visually force product copy to uppercase", () => {
    const violations = [
      ...sourceFiles(".css").flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return source.split(/\r?\n/).flatMap((line, index) =>
          /text-transform\s*:\s*uppercase\b/i.test(line)
            ? [`${relative(process.cwd(), file)}:${index + 1}: ${line.trim()}`]
            : [],
        );
      }),
      ...sourceFiles(".tsx").flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return source.split(/\r?\n/).flatMap((line, index) =>
          /textTransform\s*:\s*["'`]uppercase\b/i.test(line) ||
          /["'`][^"'`]*\buppercase\b[^"'`]*["'`]/i.test(line)
            ? [`${relative(process.cwd(), file)}:${index + 1}: ${line.trim()}`]
            : [],
        );
      }),
    ];

    expect(violations).toEqual([]);
  });

  it("keeps static product copy in sentence case while preserving real acronyms", () => {
    const violations = [...sourceFiles(".ts"), ...sourceFiles(".tsx")]
      .flatMap(collectStaticCopy)
      .sort((left, right) =>
        `${left.file}:${left.line}:${left.text}`.localeCompare(
          `${right.file}:${right.line}:${right.text}`,
        ),
      )
      .map(
        ({ file, line, origin, text }) =>
          `${file}:${line} [${origin}] ${JSON.stringify(text)}`,
      );

    expect(violations).toEqual([]);
  });
});
