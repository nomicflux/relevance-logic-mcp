#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { NaturalLanguageParser } from "./parser/nlp-parser.js";
import { RelevanceLogicProofEngine } from "./logic/proof-engine.js";
import { FormulaUtils } from "./logic/formula.js";
import { LogicSystem } from "./types.js";

class RelevanceLogicServer {
  private server: Server;
  private parser: NaturalLanguageParser;
  private proofEngine: RelevanceLogicProofEngine;

  constructor() {
    this.server = new Server(
      {
        name: "relevance-logic-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.parser = new NaturalLanguageParser();
    this.proofEngine = new RelevanceLogicProofEngine();
    
    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "parse_statement",
            description: "Parse a natural language statement into formal logic",
            inputSchema: {
              type: "object",
              properties: {
                statement: {
                  type: "string",
                  description: "Natural language statement to parse",
                },
              },
              required: ["statement"],
            },
          },
          {
            name: "validate_argument",
            description: "Validate a logical argument using relevance logic",
            inputSchema: {
              type: "object",
              properties: {
                argument: {
                  type: "string",
                  description: "Logical argument with premises and conclusion (separate with newlines, use 'therefore' for conclusion)",
                },
                system: {
                  type: "string",
                  enum: ["classical", "relevance_R", "relevance_E", "relevance_S"],
                  description: "Logic system to use for validation",
                  default: "relevance_R"
                },
              },
              required: ["argument"],
            },
          },
          {
            name: "check_relevance",
            description: "Check if premises are relevant to a conclusion",
            inputSchema: {
              type: "object",
              properties: {
                premises: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of premise statements",
                },
                conclusion: {
                  type: "string",
                  description: "Conclusion statement",
                },
              },
              required: ["premises", "conclusion"],
            },
          },
          {
            name: "explain_formula",
            description: "Convert a parsed logical formula back to natural language",
            inputSchema: {
              type: "object",
              properties: {
                statement: {
                  type: "string",
                  description: "Statement to parse and explain",
                },
              },
              required: ["statement"],
            },
          },
          {
            name: "analyze_reasoning_chain",
            description: "Analyze a multi-step reasoning chain for logical validity",
            inputSchema: {
              type: "object",
              properties: {
                steps: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of reasoning steps",
                },
                system: {
                  type: "string",
                  enum: ["classical", "relevance_R", "relevance_E", "relevance_S"],
                  description: "Logic system to use",
                  default: "relevance_R"
                },
              },
              required: ["steps"],
            },
          },
        ] satisfies Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "parse_statement": {
          const { statement } = args as { statement: string };
          const parsed = this.parser.parse(statement);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  original: parsed.originalText,
                  symbolic: FormulaUtils.toString(parsed.formula),
                  variables: Array.from(parsed.formula.variables),
                  predicates: Array.from(parsed.formula.predicates),
                  confidence: parsed.confidence,
                  ambiguities: parsed.ambiguities,
                  assumptions: parsed.assumptions.map(f => FormulaUtils.toString(f))
                }, null, 2),
              },
            ],
          };
        }

        case "validate_argument": {
          const { argument, system = "relevance_R" } = args as { argument: string, system?: LogicSystem };
          const parsedArg = this.parser.parseArgument(argument);
          
          const premises = parsedArg.premises.map(p => p.formula);
          const conclusion = parsedArg.conclusion.formula;
          
          const validation = this.proofEngine.validateArgument(
            { premises, conclusion }, 
            system
          );
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  isValid: validation.isValid,
                  hasRelevance: validation.hasRelevance,
                  relevanceScore: validation.relevanceScore,
                  errors: validation.errors,
                  warnings: validation.warnings,
                  premises: premises.map(p => FormulaUtils.toString(p)),
                  conclusion: FormulaUtils.toString(conclusion),
                  proof: validation.proof ? {
                    steps: validation.proof.steps.length,
                    system: validation.proof.system
                  } : null
                }, null, 2),
              },
            ],
          };
        }

        case "check_relevance": {
          const { premises, conclusion } = args as { premises: string[], conclusion: string };
          
          const parsedPremises = premises.map(p => this.parser.parse(p).formula);
          const parsedConclusion = this.parser.parse(conclusion).formula;
          
          let totalRelevance = 0;
          const relevanceDetails: any[] = [];
          
          parsedPremises.forEach((premise, idx) => {
            const sharedVars = FormulaUtils.getSharedVariables(premise, parsedConclusion);
            const hasSharedVars = FormulaUtils.hasSharedVariables(premise, parsedConclusion);
            
            const detail = {
              premiseIndex: idx,
              premise: FormulaUtils.toString(premise),
              sharedVariables: Array.from(sharedVars),
              hasRelevance: hasSharedVars,
              relevanceStrength: sharedVars.size / Math.max(premise.variables.size, parsedConclusion.variables.size, 1)
            };
            
            relevanceDetails.push(detail);
            totalRelevance += detail.relevanceStrength;
          });
          
          const avgRelevance = premises.length > 0 ? totalRelevance / premises.length : 0;
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  overallRelevance: avgRelevance,
                  hasRelevance: avgRelevance > 0.1,
                  conclusion: FormulaUtils.toString(parsedConclusion),
                  details: relevanceDetails
                }, null, 2),
              },
            ],
          };
        }

        case "explain_formula": {
          const { statement } = args as { statement: string };
          const parsed = this.parser.parse(statement);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  original: statement,
                  symbolic: FormulaUtils.toString(parsed.formula),
                  explanation: this.explainFormula(parsed.formula),
                  complexity: FormulaUtils.complexity(parsed.formula),
                  freeVariables: Array.from(FormulaUtils.getFreeVariables(parsed.formula))
                }, null, 2),
              },
            ],
          };
        }

        case "analyze_reasoning_chain": {
          const { steps, system = "relevance_R" } = args as { steps: string[], system?: LogicSystem };
          
          const analyses: any[] = [];
          
          for (let i = 1; i < steps.length; i++) {
            const premises = steps.slice(0, i).map(s => this.parser.parse(s).formula);
            const conclusion = this.parser.parse(steps[i]).formula;
            
            const validation = this.proofEngine.validateArgument(
              { premises, conclusion }, 
              system
            );
            
            analyses.push({
              step: i,
              statement: steps[i],
              isValid: validation.isValid,
              hasRelevance: validation.hasRelevance,
              relevanceScore: validation.relevanceScore,
              errors: validation.errors
            });
          }
          
          const overallValid = analyses.every(a => a.isValid);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  overallValid,
                  stepAnalyses: analyses,
                  totalSteps: steps.length,
                  system
                }, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private explainFormula(formula: any): string {
    if (formula.type === 'atomic') {
      return `Atomic proposition: ${formula.naturalLanguage || FormulaUtils.toString(formula)}`;
    }
    
    switch (formula.operator) {
      case 'and':
        return `Conjunction: Both conditions must be true`;
      case 'or':
        return `Disjunction: At least one condition must be true`;
      case 'not':
        return `Negation: The opposite of the given condition`;
      case 'implies':
        return `Material implication: If the first is true, then the second must be true`;
      case 'relevant_implies':
        return `Relevant implication: If the first is true, then the second must be true, and they must share logical content`;
      case 'forall':
        return `Universal quantification: True for all instances`;
      case 'exists':
        return `Existential quantification: True for at least one instance`;
      default:
        return `Complex formula with operator: ${formula.operator}`;
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Relevance Logic MCP server running on stdio");
  }
}

const server = new RelevanceLogicServer();
server.run().catch((error) => {
  console.error("Failed to run server:", error);
  process.exit(1);
});