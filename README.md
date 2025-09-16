# Atomic Reason MCP Server

A Model Context Protocol (MCP) server for building logically rigorous arguments using atomic reasoning. Solves Claude Desktop's text matching issues by using symbolic atom-based validation with connected component analysis.

## Overview

This MCP server validates logical arguments through a three-step atomic reasoning process that eliminates text matching failures. Instead of relying on exact phrase matching, it uses symbolic atoms to represent concepts, making argument validation more reliable and accessible.

## Key Features

- **Atomic Reasoning Workflow**: Extract atoms → Group concepts → Build symbolic arguments
- **Text Matching Solution**: Uses symbols instead of exact phrases to avoid Claude Desktop matching failures
- **Connected Component Validation**: Ensures all premises connect to the conclusion through shared predicates
- **Evidence Integration**: Tracks evidence requirements for both atoms and logical relationships
- **Interactive Three-Step Process**: Guides users through atom extraction, grouping, and symbolic argument construction
- **Natural Language Output**: Converts validated symbolic arguments back to readable natural language

## Usage with Claude Desktop

### Primary Workflow: Atomic Reasoning

Tell Claude Desktop: **"Show [argument] using atomic reasoning"**

Claude will automatically:
1. Extract atomic building blocks from your argument
2. Help you group related concepts under symbols
3. Build and validate the symbolic argument structure
4. Provide evidence requirements if needed

### Example Workflow
```
User: "Show that C++ is better than PHP for performance using atomic reasoning"

Step 1 - Extract Atoms:
→ atomic_reason(step="extract_atoms", argument_text="...")
Result: ["C++ is compiled", "PHP is interpreted", "compiled languages execute faster", ...]

Step 2 - Group Atoms:
→ atomic_reason(step="group_atoms", ...)
Guidance: Group related concepts like "CPP_COMPILED", "PHP_INTERPRETED", "FASTER_EXECUTION"

Step 3 - Build Argument:
→ atomic_reason(step="build_symbolic_argument",
    atom_groupings=[...],
    premises=["CPP_COMPILED", "CPP_COMPILED -> FASTER_EXECUTION"],
    conclusion="FASTER_EXECUTION")
Result: VALID + natural language output
```

## How It Works

The server validates arguments through atomic reasoning:

1. **Atom Extraction**: Splits text on periods/newlines and uses the logic parser to extract atomic building blocks
2. **Concept Grouping**: Groups related atoms under symbolic names (e.g., "AUTH_IMPL", "DATABASE_CONFIG")
3. **Symbolic Validation**: Uses symbols to build logical relationships and validates using connected component analysis
4. **Natural Language Generation**: Converts validated symbolic arguments back to readable form

### Supported Premise Formats
```
- Standalone: "AUTH" → atomic(AUTH)
- Conjunction: "AUTH && CONFIG" → and(AUTH, CONFIG)
- Disjunction: "AUTH || CONFIG" → or(AUTH, CONFIG)
- Implication: "AUTH -> READY" → implies(AUTH, READY)
- UNKNOWN: "AUTH enables READY" → implies(AUTH, READY)
```

### Validation Examples

❌ **INVALID**: Undefined symbols
```
Ignored premise 'CPP_FAST && BETTER -> SUPERIOR' because 'SUPERIOR' is not a defined atom.
Use only symbols from your atom_groupings: CPP_FAST, BETTER.
```

✅ **VALID**: All symbols defined and connected
```
Symbolic Argument:
P1: CPP_COMPILED
P2: CPP_COMPILED → FASTER_EXECUTION
C: FASTER_EXECUTION

Natural Language:
C++ is a compiled language. C++ is a compiled language implies faster execution.
Therefore, faster execution.
```

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
    "atomic-logic-mcp": {
      "command": "node",
      "args": ["/path/to/atomic-logic-mcp/build/index.js"],
      "cwd": "/path/to/atomic-logic-mcp"
    }
  }
}
```

## Available Tools

### Primary Tool: `atomic_reason`
The main tool with three interactive steps:

**Step 1: Extract Atoms**
```json
{
  "step": "extract_atoms",
  "argument_text": "Your natural language argument"
}
```

**Step 2: Group Atoms**
```json
{
  "step": "group_atoms",
  "extracted_atoms": ["atom1", "atom2", ...],
  "guidance_request": "help with grouping"
}
```

**Step 3: Build Symbolic Argument**
```json
{
  "step": "build_symbolic_argument",
  "atom_groupings": [{"symbol": "AUTH", "concept_description": "...", "text_variants": [...]}],
  "premises": ["AUTH", "AUTH -> READY"],
  "conclusion": "READY"
}
```

### Supporting Tools
- **`evidence_gathering`**: Validate evidence for atoms and implications (requires atomic_reason output)
- **`prepare_logical_plan`**: Create implementation plans for atomic_reason validation
- **`parse_statement`**: Parse individual statements into logical formulas
- **`validate_argument`**: Direct validation using natural language (for comparison)
- **`structure_argument`**: Transform arguments into clear logical structure
- **`diagnose_gaps`**: Identify structural issues in arguments

## Implementation

The server uses atomic reasoning to solve text matching problems:

- **Symbol-Based Validation**: Uses symbolic atoms instead of exact text matching
- **Connected Component Analysis**: All premises must connect to conclusion through shared predicates
- **Flexible Input Formats**: Supports both symbolic notation and natural language patterns
- **Evidence Requirements**: Tracks evidence needs for both atomic concepts and logical relationships
- **Natural Language Output**: Converts validated symbolic arguments back to readable form

**Three-Step Process**: Extract atoms → Group concepts → Validate symbolic structure

## Benefits for AI Reasoning

- **Eliminates Text Matching Failures**: Uses symbols instead of exact phrase matching
- **Maintains Logical Rigor**: Connected component validation pushes agents to explicitly specify connections between all parts of the argument
- **Interactive Guidance**: Helps users through each step of argument construction
- **Clear Error Messages**: Specific feedback about undefined symbols and structural issues
- **Evidence Integration**: Seamless evidence gathering for validated arguments
- **Accessible to Non-Experts**: No logic background required to use effectively

## Testing

The implementation has comprehensive test coverage:

### Test Coverage
- **Atomic Reason Tests**: All three steps individually tested
- **Symbol Extraction Tests**: Parser integration and atom collection
- **Validation Tests**: Connected component analysis and circular reasoning detection
- **Evidence Integration Tests**: End-to-end evidence gathering workflow
- **Natural Language Tests**: Conversion between symbolic and natural language forms

### Run Tests
```bash
npm test           # Run all tests (79 tests)
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

**3.0.0** - Atomic reasoning with symbol-based validation, connected component analysis, and evidence integration