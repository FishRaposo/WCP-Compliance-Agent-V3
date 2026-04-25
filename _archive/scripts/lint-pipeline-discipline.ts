#!/usr/bin/env tsx
/**
 * Pipeline Discipline Lint Script
 *
 * Enforces the three-layer decision architecture via AST analysis.
 * This script runs in CI to catch architectural violations.
 *
 * Checks:
 * 1. No direct LLM calls outside layer2-llm-verdict.ts
 * 2. generateWcpDecision must return TrustScoredDecision
 * 3. No bypassing the orchestrator
 * 4. Layer 2 must validate referencedCheckIds
 *
 * @usage npx tsx scripts/lint-pipeline-discipline.ts
 * @exit 0 if no violations, 1 if violations found
 */

import { Project, SyntaxKind, CallExpression, SourceFile } from "ts-morph";
import { join } from "path";
import { fileURLToPath } from "url";

// ============================================================================
// Configuration
// ============================================================================

const PROJECT_ROOT = join(process.cwd(), "src");
const VIOLATIONS: Array<{ file: string; line: number; message: string }> = [];

// Files allowed to call LLM/Agent.generate
const ALLOWED_LLM_FILES = [
  "src/pipeline/layer2-llm-verdict.ts",
];

// ============================================================================
// Violation Helpers
// ============================================================================

function addViolation(file: string, line: number, message: string): void {
  VIOLATIONS.push({ file, line, message });
}

// ============================================================================
// Check 1: No Direct LLM Calls Outside Allowed Files
// ============================================================================

function checkDirectLLMCalls(sourceFile: SourceFile): void {
  const filePath = sourceFile.getFilePath();
  const relativePath = filePath.replace(process.cwd() + "/", "");

  // Skip allowed files
  if (ALLOWED_LLM_FILES.some((allowed) => relativePath.includes(allowed))) {
    return;
  }

  // Look for Agent.generate calls
  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const callExpr = node as CallExpression;
      const expression = callExpr.getExpression();
      const text = expression.getText();

      // Check for patterns like agent.generate(...)
      if (text.includes(".generate") || text.includes("Agent")) {
        // Get the full call chain
        const fullText = expression.getText();
        if (
          fullText.includes("generate") &&
          (fullText.includes("agent") || fullText.includes("Agent"))
        ) {
          addViolation(
            relativePath,
            node.getStartLineNumber(),
            `Direct LLM call detected: "${text}". LLM calls must go through layer2-llm-verdict.ts`
          );
        }
      }
    }
  });
}

// ============================================================================
// Check 2: generateWcpDecision Return Type
// ============================================================================

function checkGenerateWcpDecisionReturnType(sourceFile: SourceFile): void {
  const filePath = sourceFile.getFilePath();
  const relativePath = filePath.replace(process.cwd() + "/", "");

  // Only check the entrypoint file
  if (!relativePath.includes("wcp-entrypoint.ts")) {
    return;
  }

  const functionDecl = sourceFile.getFunction("generateWcpDecision");
  if (!functionDecl) {
    addViolation(relativePath, 1, "generateWcpDecision function not found");
    return;
  }

  // Check return type annotation
  const returnType = functionDecl.getReturnTypeNode()?.getText();
  if (!returnType) {
    addViolation(
      relativePath,
      functionDecl.getStartLineNumber(),
      "generateWcpDecision missing return type annotation"
    );
    return;
  }

  if (!returnType.includes("TrustScoredDecision")) {
    addViolation(
      relativePath,
      functionDecl.getStartLineNumber(),
      `generateWcpDecision must return TrustScoredDecision, got: ${returnType}`
    );
  }
}

// ============================================================================
// Check 3: Orchestrator Import Check
// ============================================================================

function checkOrchestratorUsage(sourceFile: SourceFile): void {
  const filePath = sourceFile.getFilePath();
  const relativePath = filePath.replace(process.cwd() + "/", "");

  // Only check entrypoint
  if (!relativePath.includes("wcp-entrypoint.ts")) {
    return;
  }

  // Check that executeDecisionPipeline is imported and used
  const imports = sourceFile.getImportDeclarations();
  const hasOrchestratorImport = imports.some((imp) => {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    return (
      moduleSpecifier.includes("orchestrator") &&
      imp.getNamedImports().some((named) => named.getName() === "executeDecisionPipeline")
    );
  });

  if (!hasOrchestratorImport) {
    addViolation(
      relativePath,
      1,
      "wcp-entrypoint.ts must import executeDecisionPipeline from orchestrator"
    );
    return;
  }

  // Check that executeDecisionPipeline is called
  let hasOrchestratorCall = false;
  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const callExpr = node as CallExpression;
      if (callExpr.getExpression().getText() === "executeDecisionPipeline") {
        hasOrchestratorCall = true;
      }
    }
  });

  if (!hasOrchestratorCall) {
    addViolation(
      relativePath,
      1,
      "wcp-entrypoint.ts must call executeDecisionPipeline (the only valid path)"
    );
  }
}

// ============================================================================
// Check 4: Layer 2 Referenced Check IDs Validation
// ============================================================================

function checkLayer2Validation(sourceFile: SourceFile): void {
  const filePath = sourceFile.getFilePath();
  const relativePath = filePath.replace(process.cwd() + "/", "");

  // Only check layer2 file
  if (!relativePath.includes("layer2-llm-verdict.ts")) {
    return;
  }

  // Check for validateReferencedCheckIds usage
  let hasValidation = false;
  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const callExpr = node as CallExpression;
      if (callExpr.getExpression().getText().includes("validateReferencedCheckIds")) {
        hasValidation = true;
      }
    }
  });

  if (!hasValidation) {
    addViolation(
      relativePath,
      1,
      "layer2-llm-verdict.ts must call validateReferencedCheckIds to enforce check ID validation"
    );
  }
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  console.log("🔍 Pipeline Discipline Lint\n");

  // Initialize ts-morph project
  const project = new Project({
    tsConfigFilePath: join(process.cwd(), "tsconfig.json"),
  });

  // Add source files
  project.addSourceFilesAtPaths(join(PROJECT_ROOT, "**/*.ts"));

  const sourceFiles = project.getSourceFiles();
  console.log(`Analyzing ${sourceFiles.length} source files...\n`);

  // Run checks on each file
  for (const sourceFile of sourceFiles) {
    checkDirectLLMCalls(sourceFile);
    checkGenerateWcpDecisionReturnType(sourceFile);
    checkOrchestratorUsage(sourceFile);
    checkLayer2Validation(sourceFile);
  }

  // Report results
  if (VIOLATIONS.length === 0) {
    console.log("✅ No architectural violations found!");
    console.log("   All checks passed:");
    console.log("   • No direct LLM calls outside allowed files");
    console.log("   • generateWcpDecision returns TrustScoredDecision");
    console.log("   • Orchestrator is the only entry point");
    console.log("   • Layer 2 validates referencedCheckIds\n");
    process.exit(0);
  } else {
    console.log(`❌ Found ${VIOLATIONS.length} architectural violation(s):\n`);

    for (const v of VIOLATIONS) {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.message}\n`);
    }

    console.log("Fix these violations to maintain three-layer architecture integrity.");
    process.exit(1);
  }
}

// Run if executed directly (ESM-compatible)
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}

export { main, VIOLATIONS };
