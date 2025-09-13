# Dig-In Tool Implementation Plan

## Overview
The `dig_in` tool is a **simple orchestration tool** that leverages existing analysis tools. It extracts weak evidence into focused sub-arguments, then hands control back to the agent to use existing tools (`rlmcp_reason`, `evidence_gathering`, etc.) to strengthen the reasoning chain.

## Core Concept - Setup AND Cleanup Orchestration
- **Setup**: Extract evidence-backed premise and create sub-argument structure (evidence → original premise)
- **Handoff**: Return control to agent with clear guidance to use existing tools
- **Cleanup**: Take validated sub-argument results and integrate back into original argument
- **Complete Cycle**: Handle both ends of the sub-argument workflow

## Example Flow

### Original Argument
```
P1. TypeScript has static typing (Evidence: TypeScript docs)
P2. Static typing is better for large projects (Evidence: Microsoft research - 15% support load reduction)
C. Therefore TypeScript is better for large projects
```

### User: "dig in" to P2

### Generated Sub-Argument
```
Sub-argument for: "Static typing is better for large projects"
P'1. Microsoft research shows static typing decreases support load by 15%
P'2. [NEEDS EVIDENCE] ????
P'3. [NEEDS EVIDENCE] ????
C. Static typing is better for large projects
```

### Agent Uses Existing Tools to Fill Gaps
**Agent workflow using existing tools:**
1. Runs `rlmcp_reason` on the sub-argument → Gets logical validation failure
2. Uses `diagnose_gaps` or `rlmcp_help` to understand what's missing
3. Iteratively improves the argument structure
4. Once logically valid, runs `evidence_gathering` to ensure all claims have evidence
5. Final validated sub-argument:

```
P'1. Microsoft research shows static typing decreases support load by 15% (Evidence: Microsoft research)
P'2. Decreased support load improves developer productivity (Evidence: Microsoft study)
P'3. Improved developer productivity is better for large projects (Evidence: Google engineering practices)  
C. Static typing is better for large projects
```

### Automatic Integration Back to Original
**`dig_in` cleanup phase automatically integrates the validated sub-argument:**
```
P1. TypeScript has static typing (Evidence: TypeScript docs)
P2. Microsoft research shows static typing decreases support load by 15% (Evidence: Microsoft research)
P3. Decreased support load improves developer productivity (Evidence: Microsoft study)  
P4. Improved developer productivity is better for large projects (Evidence: Google engineering practices)
C. Therefore TypeScript is better for large projects
```

**Result**: Original weak premise P2 is now expanded into a logical chain (P2→P3→P4) with proper evidence.

## Tool Interface

### Input Parameters
**Setup Mode:**
```typescript
{
  mode: "setup",
  evidence_output: string,  // JSON output from evidence_gathering tool
  target_requirement_index: number  // Index of evidence requirement to dig into
}
```

**Cleanup Mode:**
```typescript
{
  mode: "cleanup", 
  original_evidence_output: string,  // Original evidence_gathering output
  target_requirement_index: number,  // Same index from setup
  completed_subargument: string  // Validated sub-argument from agent's work
}
```

### Output
**Setup Mode Output:**
```typescript
{
  setup_result: {
    sub_argument_text: string,  // Ready to use with rlmcp_reason
    original_context: object,   // Preserved for cleanup phase
    instructions: string[],     // Step-by-step workflow for agent
    target_conclusion: string   // What the sub-argument should prove
  }
}
```

**Cleanup Mode Output:**
```typescript
{
  integration_result: {
    updated_argument: string,         // Original argument with sub-argument integrated
    integration_summary: string,     // What changed
    evidence_requirements: object[], // Updated evidence requirements
    validation_status: string        // Confirmation of integration success
  }
}
```

## Implementation Steps - Keep It Simple!

### 1. Dual-Mode Tool Handler (`dig_in`)
**Setup Mode - Extract and Format:**
- Parse `evidence_gathering` output  
- Validate target requirement index
- Extract the evidence and premise it supports
- Format as new argument: Evidence → Original Premise
- Return formatted sub-argument with workflow instructions

**Cleanup Mode - Integrate Results:**
- Parse completed sub-argument from agent's work
- Validate it's logically sound and evidence-complete
- Replace original weak premise with expanded logical chain
- Preserve argument structure and renumber premises
- Return integrated argument

### 2. Simple Sub-Argument Setup
**No complex gap analysis - let existing tools do the work:**
- Convert evidence summary into premise P1
- Set original premise as conclusion C
- Create basic argument structure: "P1. [Evidence]. C. [Original Premise]"
- **That's it** - no gap filling, no placeholder generation

### 3. Agent Workflow Instructions
**Clear directions to use existing tools:**
- "Use `rlmcp_reason` to validate this sub-argument"
- "Use `diagnose_gaps` if validation fails"  
- "Add missing premises based on gap analysis"
- "Use `evidence_gathering` once logically valid"
- "Call `merge_subargument` when complete"

### 4. Integration Strategy
**Reuse everything:**
- **Input**: `evidence_gathering` output (existing format)
- **Process**: Agent uses `rlmcp_reason`, `diagnose_gaps`, `evidence_gathering` (existing tools)
- **Output**: Standard argument format compatible with existing tools
- **Validation**: Existing System R validation handles correctness

### 5. Scope Limitations
**What dig_in does NOT do:**
- ❌ Complex gap analysis (use `diagnose_gaps`)
- ❌ Logic validation (use `rlmcp_reason`) 
- ❌ Evidence validation (use `evidence_gathering`)
- ❌ Premise generation (agent does this guided by existing tools)
- ✅ **Setup**: Extract evidence → Format sub-argument → Give instructions
- ✅ **Cleanup**: Parse completed work → Integrate → Return updated argument

## Error Handling

### Invalid Inputs
- Not valid `evidence_gathering` output → Clear error message
- Invalid requirement index → Show available indices
- Requirement already has strong evidence → Suggest alternatives

### Logical Issues
- No logical gap detected → Inform user evidence is already sufficient
- Complex gap requiring multiple steps → Break down into specific missing pieces
- Circular reasoning detection → Warn and suggest alternative approaches

## File Structure - Minimal Changes

### New Files
- **NONE** - Keep it simple, add directly to existing files

### Modified Files  
- `src/index.ts` - Add simple `dig_in` tool handler (maybe 50 lines total)
- Existing test files - Add a few tests for the basic extraction functionality

### Dependencies
- Reuse existing: `EvidenceModule`, `NaturalLanguageParser`, all validation logic
- No new modules needed - this is just orchestration

## User Experience Flow - Complete Cycle Orchestration

1. User runs `evidence_gathering` on argument → Gets evidence requirements
2. User calls `dig_in mode="setup"` with requirement index → Gets sub-argument setup
3. **Agent takes over using existing tools:**
   - Runs `rlmcp_reason` on sub-argument → Likely fails validation  
   - Uses `diagnose_gaps` → Gets specific missing premises
   - Adds missing premises → Re-runs `rlmcp_reason` until valid
   - Runs `evidence_gathering` → Ensures all premises have evidence
4. User calls `dig_in mode="cleanup"` with completed sub-argument → Gets integrated result

**Complete cycle handled by one tool - no separate merge tool needed!**

## Success Metrics - Simplicity First
- ✅ Tool extracts evidence and creates basic sub-argument structure
- ✅ Agent successfully uses existing tools to improve sub-argument  
- ✅ No complex logic duplication - existing tools do the work
- ✅ Clear instructions guide agent through workflow

## Implementation Priority
1. **Phase 1**: `dig_in` setup mode - extraction and formatting
2. **Phase 2**: `dig_in` cleanup mode - integration and merging
3. **Phase 3**: Enhanced error handling and conflict detection

**Key Principle**: One tool handles complete cycle, existing tools do the analysis work