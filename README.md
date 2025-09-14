# Logical Argument Validator MCP Server

A Model Context Protocol (MCP) server for validating logical arguments and analyzing their structure. Provides binary validation (VALID/INVALID) with detailed failure analysis, designed to identify disconnected premises and structural issues in arguments.

## Overview

This MCP server validates the logical structure of natural language arguments using connected component analysis. It checks whether all premises are logically connected to the conclusion and identifies unused or irrelevant premises that should be removed.

## Key Features

- **Connected Component Validation**: Ensures all premises connect to the conclusion through shared predicates
- **Binary Validation**: Strict VALID/INVALID results with detailed failure explanations
- **Natural Language Parsing**: Converts natural language to formal logical structure, including causal statements with "because"
- **Gap Analysis**: Identifies structural issues, missing premises, and quantifier problems
- **Evidence Integration**: Tracks evidence requirements for empirical claims
- **Circular Reasoning Detection**: Identifies when conclusions appear as premises

## Usage with Claude Desktop

### Simple Usage (Recommended)
Tell Claude Desktop: **"Validate this argument"**

Claude will automatically:
1. Parse the argument into formal logical structure
2. Check if all premises connect to the conclusion
3. Identify disconnected or unused premises
4. Return VALID/INVALID with specific failure reasons

### Example
```
User: "Validate this argument: All humans are mortal. Socrates is human. Therefore, Socrates is mortal."

Response: VALID
- All premises are in the same connected component as the conclusion
- Proper predicate sharing between premises and conclusion

User: "Validate this argument: The moon is cheese. Therefore, it's raining."

Response: INVALID
- Premise "moon is cheese" is disconnected from conclusion "it's raining"
- No shared predicates between premise and conclusion
- Remove disconnected premises
```

## How It Works

The server validates arguments by:

1. **Parsing Natural Language**: Converts statements to formal logical structure
2. **Connected Component Analysis**: Groups formulas that share predicates
3. **Validation Check**: Ensures all premises are in the same component as the conclusion
4. **Gap Analysis**: Identifies structural problems and missing elements
5. **Evidence Tracking**: Manages evidence requirements for empirical claims

### Parsing Features

- **Causal Statements**: "X because Y" → "Y implies X"
- **Conditionals**: "if X then Y", "X implies Y"
- **Quantifiers**: "all X are Y", "some X are Y"
- **Logical Connectives**: and, or, not, implies
- **Formal Logic**: P(x) → Q(y), ∀x(P(x)), etc.

### Validation Examples

❌ **INVALID**: "Dogs are animals. Therefore, it's Tuesday."
- No shared predicates between premise and conclusion
- Premise is disconnected from conclusion

❌ **INVALID**: "P(x). Q(y). Therefore, R(z)."
- All formulas use different predicates
- Multiple disconnected components

✅ **VALID**: "All humans are mortal. Socrates is human. Therefore, Socrates is mortal."
- Shared predicates: "human", "mortal"
- All premises connect to conclusion

✅ **VALID**: "It rains because clouds are heavy. Therefore, clouds are heavy implies it rains."
- Causal statement parsed correctly
- Proper logical structure maintained

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
The main tool that handles all logical argument validation transparently. Takes any reasoning task and automatically:
- Parses natural language into formal logical structure
- Validates connected component requirements
- Identifies disconnected premises
- Reports specific validation failures

### Advanced Tools (for explicit use)
- `validate_argument`: Check argument validity using connected component analysis
- `structure_argument`: Transform arguments into clear logical structure
- `formalize_reasoning`: Convert natural language to formal logic representation
- `diagnose_gaps`: Identify structural issues in arguments
- `parse_statement`: Parse natural language statements into logical formulas
- `check_relevance`: Verify predicate sharing between premises and conclusion

## Implementation

The server validates logical arguments using connected component analysis:

- **Connected Component Validation**: All premises must connect to conclusion through shared predicates
- **Predicate Sharing**: Formulas are connected when they share at least one predicate
- **Circular Reasoning Detection**: Prevents premises from being identical to conclusions
- **Quantifier Scope Handling**: Manages variable binding in quantified statements
- **Natural Language Parsing**: Converts statements to formal logic, including causal "because" patterns

**Binary Validation**: Arguments are either VALID (all premises connected to conclusion) or INVALID (with specific failure reasons).

## Benefits for AI Reasoning

- **Prevents Invalid Inferences**: Requires explicit logical connections between premises and conclusions
- **Identifies Irrelevant Premises**: Detects premises that don't contribute to the argument
- **Structural Analysis**: Reveals gaps and issues in argument construction
- **Clear Feedback**: Provides specific reasons when arguments fail validation
- **Formal Rigor**: Ensures conclusions actually follow from connected premises

## Testing

The implementation has comprehensive test coverage:

### Test Coverage
- **Unit Tests**: All core validation functions individually tested
- **Integration Tests**: End-to-end argument validation scenarios
- **Connected Component Tests**: Predicate sharing and component analysis
- **Quantifier Scope Tests**: Variable binding and scope detection
- **Natural Language Tests**: "Because" pattern parsing and conversion
- **Circular Reasoning Tests**: Detection of premises identical to conclusions

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

**2.0.0** - Connected component argument validation with natural language parsing