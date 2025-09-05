# Relevance Logic MCP Server

A Model Context Protocol (MCP) server for relevance logic operations that helps AI assistants reason more rigorously by enforcing logical relevance between premises and conclusions.

## Features

- **Parse natural language** into formal logical expressions
- **Validate arguments** using relevance logic principles
- **Check relevance** between premises and conclusions
- **Prevent spurious inferences** based on word similarity alone
- **Explain logical structures** in natural language
- **Analyze reasoning chains** for logical validity

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Test the server:
   ```bash
   node simple-test.js
   ```

## Claude Desktop Integration

To use this server with Claude Desktop:

1. Copy the configuration from `claude_desktop_config.json`
2. Add it to your Claude Desktop MCP configuration
3. Restart Claude Desktop
4. The server will appear as "relevance-logic" with the following tools:

## Available Tools

### `parse_statement`
Converts natural language statements into formal logic notation.

**Example:**
```
Statement: "All birds can fly"
Result: ∀x (Bird(x) →ᵣ CanFly(x))
```

### `validate_argument` 
Validates logical arguments using relevance logic principles. **Requires all necessary premises to be explicitly stated.**

**Valid Example:**
```
Argument: "All mammals need oxygen. Whales are mammals. Therefore, whales need oxygen."
Result: Valid with high relevance score
```

**Invalid Example (Missing Premise):**
```
Argument: "All birds fly. Therefore, sparrows fly."
Result: Invalid - missing premise "Sparrows are birds"
Error: "Conclusion does not share sufficient variables with premises"
```

### `check_relevance`
Analyzes whether premises are logically relevant to a conclusion.

**Example:**
```
Premises: ["Dogs are loyal", "Loyal animals make good pets"]
Conclusion: "Dogs make good pets"
Result: High relevance (shared variables: loyal, animals)
```

### `explain_formula`
Breaks down logical formulas into natural language explanations.

### `analyze_reasoning_chain`
Validates multi-step reasoning processes for logical consistency.

## How It Works

This server implements **relevance logic**, a non-classical logic system that:

1. **Enforces variable sharing**: Premises and conclusions must share meaningful logical variables
2. **Prevents classical paradoxes**: Rejects inferences like "false implies anything"  
3. **Blocks topic drift**: Stops reasoning from jumping between unrelated domains
4. **Maintains logical rigor**: Uses formal proof methods while requiring relevance

## Example Usage

The server helps prevent common logical fallacies:

❌ **Blocked**: "The moon is cheese → Either it's raining or not raining"
- No shared variables between premise and conclusion

❌ **Blocked**: "All birds fly → Sparrows fly" 
- Missing premise: "Sparrows are birds" 
- No shared variables between "birds" and "sparrows" without connecting premise

✅ **Allowed**: "All birds fly + Sparrows are birds → Sparrows fly"
- Complete argument with proper variable sharing through all premises

## Benefits for AI Reasoning

- **Prevents hallucination** by requiring explicit logical connections
- **Reduces bias** by separating logical necessity from statistical correlation
- **Improves transparency** by making reasoning steps explicit  
- **Enhances reliability** by catching spurious inferences
- **Maintains rigor** while allowing contextually appropriate reasoning

## Testing

Run the comprehensive test suite:
```bash
node demo-test.js
```

This demonstrates the server's ability to:
- Identify relevant vs irrelevant logical connections
- Parse complex natural language statements
- Explain logical structures clearly
- Prevent classical logical paradoxes