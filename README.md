# Relevance Logic MCP Server

A Model Context Protocol (MCP) server that helps AI assistants construct logically rigorous explanations and arguments using strict relevance logic principles. Designed to work transparently in the background to enhance AI reasoning quality.

## Overview

This MCP server enables AI assistants to automatically structure their reasoning through relevance logic - a formal system that requires exact syntactic sharing between premises and conclusions, preventing spurious inferences and logical gaps.

## Key Features

- **Automatic Reasoning Enhancement**: Transparently improves AI explanations and arguments
- **Strict Relevance Logic**: Implements formal relevance logic systems (B, T, E, R) with exact syntactic sharing
- **Gap Analysis**: Automatically identifies and suggests fixes for logical gaps
- **Formal Logic Support**: Handles both natural language and formal logical notation (∧, →, ∨, etc.)
- **Multiplicative Connectives**: Supports advanced relevance logic operators (⊗, ⊸, ⅋)

## Usage with Claude Desktop

### Simple Usage (Recommended)
Tell Claude Desktop: **"Use RLMCP to explain [your question]"**

Claude will automatically:
1. Structure your reasoning into formal logical premises
2. Validate the logical connections  
3. Identify any gaps in reasoning
4. Provide recommendations for strengthening arguments
5. Present a logically rigorous response

### Example
```
User: "Use RLMCP to explain why TypeScript is better than JavaScript for large projects"

Claude Desktop will automatically use the relevance logic server to:
- Formalize the comparison arguments
- Ensure proper logical connections between claims and evidence  
- Validate the reasoning chain
- Present a structured, logically sound explanation
```

## How It Works

The server implements **strict relevance logic** which:

1. **Requires Exact Syntactic Sharing**: Premises and conclusions must share identical atomic formulas
2. **Prevents Classical Paradoxes**: Blocks inferences like "false implies anything"
3. **Enforces Logical Rigor**: Every step must have explicit logical justification
4. **Maintains Topic Coherence**: Prevents reasoning from drifting between unrelated topics

### What Gets Blocked vs Allowed

❌ **Blocked**: "The moon is cheese → Either it's raining or not raining"
- No syntactic sharing between premise and conclusion

❌ **Blocked**: "All birds fly → Sparrows fly" 
- Missing connecting premise: "Sparrows are birds"

✅ **Allowed**: "All birds fly ∧ Sparrows are birds → Sparrows fly"
- Exact syntactic sharing through "birds" predicate

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

## Relevance Logic Systems

The server supports multiple relevance logic systems:

- **System B**: Basic relevance (identity only)
- **System T**: Adds contraction rule
- **System E**: Entailment logic  
- **System R**: Full relevance logic (default)

## Benefits for AI Reasoning

- **Prevents Hallucination**: Requires explicit logical connections
- **Reduces Spurious Correlations**: Separates logical necessity from statistical patterns
- **Improves Transparency**: Makes reasoning steps explicit
- **Enhances Reliability**: Catches logical fallacies and gaps
- **Maintains Rigor**: Ensures conclusions actually follow from premises

## Testing

The parser has been comprehensively tested and supports:
- Formal logical syntax parsing (∧, →, ∨, ⊗, ⊸, ⅋)
- Structured argument processing ("Premise 1:", "Conclusion:" format)  
- Natural language to formal logic conversion
- Relevance logic validation with exact syntactic sharing
- Automatic gap analysis and repair recommendations

Test the parser functionality:
```bash
node test-parser.js
```

## Development

For development and debugging:
```bash
npm run dev    # Watch mode compilation
npm run build  # Production build
```

## Version

**2.0.0** - Strict relevance logic compliance with transparent AI integration