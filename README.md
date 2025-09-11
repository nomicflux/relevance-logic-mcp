# System R Relevance Logic MCP Server

A Model Context Protocol (MCP) server implementing **complete System R relevance logic** for strict logical validation. Provides binary validation (VALID/INVALID) with no approximations, designed to prevent classical logical paradoxes while maintaining theoretical rigor.

## Overview

This MCP server implements the **strongest relevance logic system (System R)** with complete theoretical compliance. It validates natural language arguments using strict relevance principles that require exact atomic formula sharing between premises and conclusions.

## Key Features

- **Complete System R Implementation**: Full theoretical compliance with Anderson & Belnap's System R
- **Binary Validation**: Strict VALID/INVALID results with no approximations
- **Ternary Relation Semantics**: Three-place relation evaluation for proper relevance
- **Exact Variable Sharing**: Requires identical atomic formulas between premises and conclusions
- **Quantifier Scope Handling**: Proper variable binding validation
- **Distribution Axioms**: Classical distribution laws with relevance constraints
- **Multiplicative Logic Semantics**: Linear logic resource consciousness (⊗, ⊸, ⅋)
- **Classical Paradox Prevention**: Blocks ex falso quodlibet and material implication paradoxes

## Usage with Claude Desktop

### Simple Usage (Recommended)
Tell Claude Desktop: **"Validate this argument using System R relevance logic"**

Claude will automatically:
1. Parse the argument into formal logical structure
2. Apply strict System R validation rules
3. Check ternary relation semantics
4. Validate exact atomic formula sharing
5. Return VALID/INVALID with detailed violation explanations

### Example
```
User: "Validate this argument: All humans are mortal. Socrates is human. Therefore, Socrates is mortal."

System R Response: VALID
- Ternary relations established through shared atomic formulas
- Proper variable sharing maintained
- No classical paradox violations detected

User: "Validate this argument: The moon is cheese. Therefore, it's raining or not raining."

System R Response: INVALID
- No ternary relation between premise and conclusion
- Violates System R variable sharing principle
- Classical material implication paradox detected
```

## How System R Works

The server implements **complete System R relevance logic** with:

1. **Ternary Relation Semantics**: Uses three-place relations R(a,b,c) to evaluate logical implications
2. **Exact Atomic Formula Sharing**: Premises and conclusions must share identical atomic formulas (not just similar predicates)
3. **Quantifier Scope Handling**: Proper variable binding with explicit scope detection
4. **Distribution Axioms**: Classical distribution laws with relevance constraints 
5. **Multiplicative Logic**: Linear logic resource consciousness for ⊗, ⊸, ⅋ connectives
6. **Classical Paradox Prevention**: Blocks ex falso quodlibet and material implication paradoxes

### System R Validation Examples

❌ **INVALID**: "Dog(fido) → (Raining ∨ ¬Raining)"
- No ternary relation possible between premise and conclusion
- Violates System R variable sharing principle

❌ **INVALID**: "P(x) ∧ Q(x) → R(x)" 
- P(x) from premise doesn't appear in conclusion R(x)
- Violates exact atomic formula sharing requirement

✅ **VALID**: "Mortal(socrates) → Mortal(socrates)"
- Perfect ternary relation through identical atomic formulas
- Satisfies all System R constraints

✅ **VALID**: "∀x(Human(x) → Mortal(x)) ∧ Human(socrates) → Mortal(socrates)"
- Proper quantifier scope and variable sharing
- Valid instantiation with ternary relations

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Start the server:
   ```bash
   npm start
   ```

## Claude Desktop Configuration

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "relevance-logic-mcp": {
      "command": "node",
      "args": ["/path/to/relevance-logic-mcp/build/index.js"],
      "cwd": "/path/to/relevance-logic-mcp"
    }
  }
}
```

## Available Tools

### Primary Tool: `rlmcp_reason`
The main tool that handles all relevance logic processing transparently. Takes any reasoning task and automatically:
- Formalizes natural language into logical structure
- Validates relevance logic principles
- Identifies logical gaps
- Provides strengthening recommendations

### Advanced Tools (for explicit use)
- `validate_argument`: Ensure explanations involving multiple premises avoid logical gaps and fallacies
- `structure_argument`: Transform complex explanations into clear logical structure  
- `formalize_reasoning`: Strengthen reasoning by making implicit logical connections explicit
- `diagnose_gaps`: Identify and fill logical gaps in complex explanations
- `parse_statement`: Parse natural language into formal relevance logic
- `check_relevance`: Check exact syntactic sharing between premises and conclusion

## System R Implementation

The server implements **System R (the strongest relevance logic system)** with complete theoretical compliance:

- **Ternary Relation Semantics**: Three-place relations for proper relevance evaluation
- **Variable Sharing Principle**: Exact atomic formula identity requirement
- **Quantifier Scope Handling**: Explicit variable binding with scope detection
- **Distribution Axioms**: Classical distribution laws with relevance constraints
- **Multiplicative Logic Semantics**: Linear logic resource consciousness
- **Classical Paradox Prevention**: Blocks all classical logic paradoxes

**Binary Success Criteria**: If ANY theoretical System R requirement is missing or approximated, the validation fails.

## Benefits for AI Reasoning

- **Prevents Hallucination**: Requires explicit logical connections
- **Reduces Spurious Correlations**: Separates logical necessity from statistical patterns
- **Improves Transparency**: Makes reasoning steps explicit
- **Enhances Reliability**: Catches logical fallacies and gaps
- **Maintains Rigor**: Ensures conclusions actually follow from premises

## Testing

The System R implementation has comprehensive test coverage:

### Test Coverage
- **Unit Tests**: All core System R functions individually tested
- **Integration Tests**: End-to-end argument validation scenarios
- **Ternary Relation Tests**: Three-place relation evaluation
- **Variable Sharing Tests**: Exact atomic formula identity checking
- **Quantifier Scope Tests**: Variable binding and scope detection
- **Distribution Tests**: Classical distribution with relevance constraints  
- **Multiplicative Logic Tests**: Linear logic resource consciousness
- **Classical Paradox Tests**: Verification that all paradoxes are blocked

### Run Tests
```bash
npm test           # Run all tests
npm run build      # Build TypeScript to JavaScript
npm start          # Start the MCP server
```

## Development

For development and debugging:
```bash
npm run dev    # Watch mode compilation
npm run build  # Production build
```

## Version

**2.0.0** - Strict relevance logic compliance with transparent AI integration