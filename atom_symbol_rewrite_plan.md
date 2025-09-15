# RLMCP Atom Symbol Rewrite Plan

## Problem Statement

Claude Desktop consistently fails at exact phrase matching despite extensive guidance. Different wordings like "implement Dijkstra's algorithm" vs "an implementation of Dijkstra's algorithm" vs "Dijkstra implementation complete" are treated as separate predicates, causing disconnection errors that Claude Desktop cannot resolve.

## Core Insight

Instead of fighting Claude Desktop's inability to maintain exact wording, we should:
1. Extract conceptual atoms from natural language
2. Let Claude Desktop identify semantic equivalences
3. Work with symbols representing concepts, not raw text
4. Build logical arguments using symbols + connectors

## New Tool: `atomic_reason`

Single tool that handles the entire atom-symbol flow, replacing the complexity of multiple tools with one comprehensive interface.

## Tool Interface Design

### Input Schema

```typescript
{
  name: "atomic_reason",
  description: "Validate logical arguments using atom-symbol mapping to avoid text matching issues",
  inputSchema: {
    type: "object",
    properties: {
      argument_text: {
        type: "string",
        description: "The natural language argument to validate"
      },
      atom_definitions: {
        type: "array",
        description: "Define conceptual atoms found in the argument. Each atom represents a single concept regardless of how it's phrased.",
        items: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
              description: "Short symbol name you choose for this concept (e.g., AUTH_IMPL, CACHE_INIT)"
            },
            concept_description: {
              type: "string",
              description: "What this atom represents conceptually"
            },
            text_variants: {
              type: "array",
              items: { type: "string" },
              description: "All the different ways this concept appears in the argument text"
            }
          },
          required: ["symbol", "concept_description", "text_variants"]
        }
      },
      logical_relationships: {
        type: "array",
        description: "How the atoms connect to each other using symbols and logical operators",
        items: {
          type: "string",
          description: "Logical statement using symbols, e.g., 'AUTH_IMPL → ACCESS_CTRL' or 'INIT_CACHE enables DATABASE_READY'"
        }
      },
      conclusion_symbol: {
        type: "string",
        description: "Which symbol represents the main conclusion of the argument"
      }
    },
    required: ["argument_text", "atom_definitions", "logical_relationships", "conclusion_symbol"]
  }
}
```

### Example Input

```json
{
  "argument_text": "First initialize the cache, then implement user authentication. User authentication implementation enables access control. Therefore, access control is working.",
  "atom_definitions": [
    {
      "symbol": "CACHE_INIT",
      "concept_description": "Initialize cache/data structures",
      "text_variants": ["initialize the cache"]
    },
    {
      "symbol": "AUTH_IMPL",
      "concept_description": "Implement user authentication system",
      "text_variants": ["implement user authentication", "User authentication implementation"]
    },
    {
      "symbol": "ACCESS_CTRL",
      "concept_description": "Access control functionality is working",
      "text_variants": ["access control", "access control is working"]
    }
  ],
  "logical_relationships": [
    "CACHE_INIT → AUTH_IMPL",
    "AUTH_IMPL → ACCESS_CTRL"
  ],
  "conclusion_symbol": "ACCESS_CTRL"
}
```

### Output Structure

```json
{
  "validation_result": "VALID|INVALID|WARNING",
  "symbolic_argument": {
    "premises": ["P1: CACHE_INIT", "P2: CACHE_INIT → AUTH_IMPL", "P3: AUTH_IMPL → ACCESS_CTRL"],
    "conclusion": "C: ACCESS_CTRL"
  },
  "symbol_definitions": {
    "CACHE_INIT": "Initialize cache/data structures",
    "AUTH_IMPL": "Implement user authentication system",
    "ACCESS_CTRL": "Access control functionality is working"
  },
  "validation_details": {
    "connected_components": [...],
    "violations": [...],
    "errors": [...]
  },
  "text_mapping": {
    "original_argument": "...",
    "symbol_substituted": "P1: CACHE_INIT, P2: CACHE_INIT → AUTH_IMPL..."
  }
}

## Integration with Existing Validation

### Validation Flow

1. **Symbol Construction**: Convert input into symbolic argument using atom_definitions and logical_relationships
2. **Existing Validation**: Run the SAME connected component analysis on symbolic formulas
3. **Error Mapping**: Map symbolic validation errors back to original text using symbol definitions

### Key Principle: Validation Logic Unchanged

- `FormulaUtils.validateConnectedComponents()` works on symbols instead of text
- All existing validation rules apply (circular reasoning, disconnected premises, etc.)
- Premise reduction warnings still work by comparing symbolic premise counts
- Evidence gathering still works on symbolic atoms/implications

### Symbol to Formula Conversion

```typescript
// Convert symbolic relationships to LogicFormula objects
"AUTH_IMPL → ACCESS_CTRL" → FormulaBuilder.relevantImplies(
  FormulaBuilder.atomic("AUTH_IMPL", []),
  FormulaBuilder.atomic("ACCESS_CTRL", [])
)

// Existing validation then processes these formulas normally
const validation = FormulaUtils.validateConnectedComponents(premises, conclusion);
```

### Error Translation

When validation fails on symbols, translate back to natural language:

```json
{
  "validation_error": "DISCONNECTED: Symbol AUTH_IMPL not connected to conclusion ACCESS_CTRL",
  "natural_language_error": "The concept 'implement user authentication' is not connected to the conclusion 'access control is working'",
  "affected_text_variants": ["implement user authentication", "User authentication implementation"],
  "guidance": "Add logical connections between authentication implementation and access control"
}
```

## Implementation Strategy

### Phase 1: Core Tool Creation
- Implement `atomic_reason` tool with schema above
- Build symbol-to-formula conversion logic
- Integrate with existing `FormulaUtils.validateConnectedComponents()`
- Test basic validation flow

### Phase 2: Error Handling & Translation
- Map symbolic validation errors back to natural language
- Ensure premise reduction warnings work with symbolic arguments
- Test edge cases and error scenarios

### Phase 3: Integration Testing
- Run parallel validation (original vs atomic_reason) on test cases
- Verify identical logical validation results
- Confirm better handling of text variation issues

### Migration Path
- `atomic_reason` exists alongside `rlmcp_reason`
- No changes to existing tools initially
- Future: detect text-matching failures in `rlmcp_reason` → suggest `atomic_reason`

## Benefits

1. **Eliminates text matching problems** - work with fixed symbols
2. **Forces explicit semantic decisions** - agent must state equivalences
3. **Clearer logical structure** - symbols make relationships obvious
4. **Maintains precision** - formal validation on symbols
5. **Human readable** - symbol definitions map back to concepts

## Migration Strategy

1. **Phase 1**: Implement new tools alongside existing ones
2. **Phase 2**: Add detection for text-matching failures → redirect to atom extraction
3. **Phase 3**: Make atom-symbol flow the primary path
4. **Phase 4**: Deprecate direct text-based argument validation

## Success Metrics

- Reduction in "disconnected premise" errors due to text variations
- Agent successfully groups equivalent concepts
- Clean symbolic arguments that validate correctly
- Agent stops trying to achieve exact text matching

## Complete Example Walkthrough

### Failing Case with Current System

**Argument:** "Implement user authentication. User authentication implementation enables access control. Therefore, access control is implemented."

**Current problem:**
- "Implement user authentication" ≠ "User authentication implementation"
- Treated as different predicates → disconnection error
- Claude Desktop cannot resolve despite guidance

### Success with atomic_reason

**Input to atomic_reason:**
```json
{
  "argument_text": "Implement user authentication. User authentication implementation enables access control. Therefore, access control is implemented.",
  "atom_definitions": [
    {
      "symbol": "AUTH_IMPL",
      "concept_description": "User authentication system is implemented",
      "text_variants": ["Implement user authentication", "User authentication implementation"]
    },
    {
      "symbol": "ACCESS_CTRL",
      "concept_description": "Access control functionality is working",
      "text_variants": ["access control", "access control is implemented"]
    }
  ],
  "logical_relationships": ["AUTH_IMPL → ACCESS_CTRL"],
  "conclusion_symbol": "ACCESS_CTRL"
}
```

**Internal Processing:**
1. **Symbol conversion:** Creates LogicFormula objects using AUTH_IMPL, ACCESS_CTRL symbols
2. **Validation:** Runs existing `validateConnectedComponents()` on symbolic formulas
3. **Result:** Clean validation - AUTH_IMPL connects to ACCESS_CTRL conclusion

**Output:**
```json
{
  "validation_result": "VALID",
  "symbolic_argument": {
    "premises": ["P1: AUTH_IMPL", "P2: AUTH_IMPL → ACCESS_CTRL"],
    "conclusion": "C: ACCESS_CTRL"
  },
  "validation_details": {
    "connected_components": 1,
    "violations": []
  }
}
```

### Key Benefits Demonstrated

1. **No text matching required** - Claude Desktop works with fixed symbols
2. **Explicit semantic mapping** - Agent must consciously group equivalent text variants
3. **Same validation rigor** - Connected component analysis unchanged
4. **Clear error mapping** - Symbolic errors translate back to natural language
5. **Works with Claude Desktop's capabilities** - Symbol assignment vs exact text matching

This approach eliminates the fundamental mismatch between Claude Desktop's natural language processing and the precision required for logical validation.