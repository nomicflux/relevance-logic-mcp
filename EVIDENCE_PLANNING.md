# Evidence Module Planning Document

## Overview
This document outlines the requirements and implementation plan for adding evidence support to the Relevance Logic MCP server. This module will be a **separate, optional tool** that requires evidence for both logical atoms and implications.

## Requirements

### 1. Architecture
- Evidence module is a **separate tool** that operates **after** `rlmcp_reason`
- It takes the output from `rlmcp_reason` and augments it with evidence requirements
- User workflow: First use `rlmcp_reason`, then optionally use evidence tool on the results

### 2. Trigger Condition
- The evidence module is invoked when the user includes the phrase "_using evidence_" in their request
- Example: User runs `rlmcp_reason` first, then uses evidence tool to add evidence to the logical atoms and implications

### 3. Evidence Validation & Recording
- **AI assistant must provide evidence** for every logical atom: `(summary, strength, citation)`
- **AI assistant must provide evidence** for every implication: `(summary, strength, citation)`
- **Module validates and records** the AI-provided evidence, ensuring compliance

### 3. Evidence Structure
```typescript
interface Evidence {
  summary: string;        // Brief description of what the evidence shows
  strength: number;       // 0-1 likelihood that evidence supports the premise
  citation: string;       // Source: code, docs, research, conversation, experiment
}
```

## Current Codebase Analysis

### Existing Architecture
- **Main entry point**: `src/index.ts` - RelevanceLogicServer class
- **Type definitions**: `src/types.ts` - LogicFormula, SystemRValidation interfaces
- **Logic operations**: `src/logic/formula.ts` - FormulaBuilder and FormulaUtils
- **Parsing**: `src/parser/nlp-parser.ts` - Natural language to logic conversion

### Current Tools
1. `rlmcp_reason` - Main reasoning tool
2. `parse_statement` - Natural language parsing
3. `validate_argument` - Logic validation
4. `check_relevance` - Syntactic sharing analysis
5. `structure_argument` - Argument organization
6. `diagnose_gaps` - Gap identification
7. `formalize_reasoning` - Formalization guidance

## Implementation Plan

### Phase 1: Type Extensions
Add evidence-related types to `src/types.ts`:

```typescript
interface Evidence {
  summary: string;
  strength: number;      // 0-1 scale
  citation: string;
}

interface EvidenceRequiredAtom extends LogicFormula {
  evidence: Evidence;
}

interface EvidenceRequiredImplication {
  premise: EvidenceRequiredAtom;
  conclusion: EvidenceRequiredAtom;
  evidence: Evidence;    // Evidence supporting the implication itself
}

interface EvidenceRequiredArgument {
  premises: EvidenceRequiredAtom[];
  implications: EvidenceRequiredImplication[];
  conclusion: EvidenceRequiredAtom;
}
```

### Phase 2: Evidence Tool Implementation
Add a new tool `rlmcp_with_evidence` to the existing tools list:

```typescript
{
  name: "rlmcp_with_evidence", 
  description: "Use RLMCP reasoning with evidence requirements. Takes natural language tasks containing '_using evidence_' or similar phrases and provides logical reasoning with evidence requirements for each atom and implication.",
  inputSchema: {
    type: "object",
    properties: {
      task: {
        type: "string",
        description: "Natural language reasoning task that includes evidence requirements (e.g., 'Show that X using RLMCP with evidence')"
      },
      context: {
        type: "string",
        description: "Additional context for reasoning and evidence gathering",
        default: ""
      }
    },
    required: ["task"]
  }
}
```

### Phase 3: Evidence Module Creation
Create `src/evidence/evidence-module.ts`:

```typescript
export class EvidenceModule {
  // Prompt AI to provide evidence for each atom and validate completeness
  requireAtomEvidence(atom: LogicFormula): EvidenceValidation
  
  // Prompt AI to provide evidence for each implication and validate completeness
  requireImplicationEvidence(premise: LogicFormula, conclusion: LogicFormula): EvidenceValidation
  
  // Validate that all evidence has summary, strength, citation
  validateEvidence(evidence: Evidence): ValidationResult
  
  // Check complete argument has evidence for all atoms and implications
  enforceEvidenceCompliance(structuredArgument: any): ComplianceReport
}
```

### Phase 4: Integration with Existing Logic
- Leverage existing `rlmcp_reason` processing (formalization, parsing, validation)
- Detect "_using evidence_" trigger to activate evidence provision
- Attach evidence to logical structure after existing System R validation

### Phase 5: Tool Handler Implementation
Add handler in `src/index.ts`:

```typescript
case "rlmcp_with_evidence": {
  const { task, context } = args as { task: string; context?: string };
  
  // Step 1: Use existing rlmcp_reason logic to get structured reasoning
  const formalized = this.generateFormalizationSteps(task, context || "");
  const structured = this.parser.parseArgument(task);
  const validation = this.strictValidation(
    structured.premises.map(p => p.formula),
    structured.conclusion.formula
  );
  
  // Step 2: Require AI to provide evidence and validate compliance
  const complianceReport = this.evidenceModule.enforceEvidenceCompliance({
    premises: structured.premises,
    conclusion: structured.conclusion,
    validation: validation
  });
  
  // Step 3: Return combined analysis with evidence compliance status
  return {
    content: [{
      type: "text", 
      text: JSON.stringify({
        rlmcp_analysis: {
          original_task: task,
          logical_structure: validation.validation.overallValid ? "VALID" : "INVALID",
          formalization_guidance: formalized,
          structured_argument: {
            premises: structured.premises.length,
            conclusion: structured.conclusion.originalText
          },
          validation_results: validation.validation
        },
        evidence_compliance: {
          status: complianceReport.isCompliant ? "COMPLIANT" : "NON_COMPLIANT",
          missing_evidence: complianceReport.missingEvidence,
          invalid_evidence: complianceReport.invalidEvidence,
          evidence_requirements: complianceReport.requirements
        }
      }, null, 2)
    }]
  };
}
```

## Constraints and Design Principles

### 1. Separation of Concerns
- Evidence module operates independently of existing logic validation
- No modifications to core relevance logic tools
- Evidence is an additional layer, not a replacement

### 2. Backward Compatibility
- All existing tools continue to work without changes
- Evidence module only activates with explicit "_using evidence_" trigger

### 3. Evidence Types by Citation Source
- **Code**: References to actual source code files and line numbers
- **Documentation**: API docs, technical specifications, user manuals
- **Research**: Academic papers, studies, published research
- **Conversation**: Previous parts of the current conversation or historical discussions  
- **Experiment**: Results from REPL experiments, testing, empirical validation

### 4. Strength Assessment Guidelines
- **0.9-1.0**: Direct, unambiguous evidence (code implementation, formal proof)
- **0.7-0.9**: Strong empirical evidence (comprehensive testing, peer-reviewed research)
- **0.5-0.7**: Moderate evidence (documentation, expert opinion, partial testing)
- **0.3-0.5**: Weak evidence (anecdotal, limited scope, outdated)
- **0.1-0.3**: Very weak evidence (speculation, unverified claims)

### 5. Example Usage Flow

**Single Step**: User runs `rlmcp_with_evidence`
Input: `"Show that TypeScript is better than JavaScript for large projects using RLMCP with evidence"`

**Internal Processing**:
1. **Logical Analysis** (reuses `rlmcp_reason` logic):
   - Parse: `∀x (LargeProject(x) → Better(TypeScript, JavaScript, x))`
   - Validate logical structure using System R
   - Identify premises and conclusion

2. **Evidence Enforcement** (new functionality):
   - Require AI to provide evidence for atoms: `LargeProject(x)` needs `Evidence{summary, strength, citation}`
   - Require AI to provide evidence for implications: `LargeProject(x) → Better(TypeScript, JavaScript, x)` needs `Evidence{summary, strength, citation}`
   - Validate AI-provided evidence is complete and properly formatted

**Output**: Combined logical analysis + evidence compliance report showing what AI must provide

## Files to Create/Modify

### New Files
- `src/evidence/evidence-module.ts` - Core evidence logic
- `src/evidence/types.ts` - Evidence-specific type definitions

### Modified Files
- `src/index.ts` - Add new tool handler (minimal addition)
- `src/types.ts` - Add evidence-related interfaces

### No Changes Required
- `src/logic/formula.ts` - Remains unchanged
- `src/parser/nlp-parser.ts` - Remains unchanged
- All existing tool handlers - Remain unchanged

## Success Criteria

1. **Functional**: Evidence tool correctly identifies and validates evidence for atoms and implications
2. **Isolated**: No changes to existing relevance logic functionality
3. **Optional**: Standard tools work exactly as before
4. **Triggered**: Only activates with "_using evidence_" phrase
5. **Complete**: Covers all evidence types (code, docs, research, conversation, experiment)
6. **Assessed**: Provides strength ratings and quality analysis

This implementation maintains the modularity and separation requested while providing comprehensive evidence support for logical reasoning.