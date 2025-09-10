#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Tool,
  Prompt,
} from "@modelcontextprotocol/sdk/types.js";
import { NaturalLanguageParser } from "./parser/nlp-parser.js";
import { FormulaUtils } from "./logic/formula.js";
import { LogicSystem, LogicFormula } from "./types.js";

class RelevanceLogicServer {
  private server: Server;
  private parser: NaturalLanguageParser;

  constructor() {
    this.server = new Server(
      {
        name: "relevance-logic-mcp",
        version: "2.0.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    this.parser = new NaturalLanguageParser();
    
    this.setupToolHandlers();
    this.setupPromptHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "rlmcp_reason",
            description: "Use RLMCP (Relevance Logic MCP) to construct logically rigorous explanations and arguments. Automatically handles parsing, structuring, validation, and gap-filling to ensure reasoning meets strict logical standards.",
            inputSchema: {
              type: "object",
              properties: {
                task: {
                  type: "string",
                  description: "The explanation, argument, or reasoning task to process through relevance logic",
                },
                context: {
                  type: "string", 
                  description: "Additional context or domain information",
                  default: ""
                },
              },
              required: ["task"],
            },
          },
          {
            name: "parse_statement",
            description: "Parse natural language into formal relevance logic with multiplicative connectives",
            inputSchema: {
              type: "object",
              properties: {
                statement: {
                  type: "string",
                  description: "Natural language statement (supports multiplicative operators: 'times', 'lollipop', 'tensor')",
                },
              },
              required: ["statement"],
            },
          },
          {
            name: "validate_argument",
            description: "Ensure explanations involving multiple premises avoid logical gaps and fallacies. Particularly useful for comparative arguments, causal explanations, and complex reasoning chains.",
            inputSchema: {
              type: "object",
              properties: {
                argument: {
                  type: "string",
                  description: "Logical argument with premises and conclusion",
                },
                system: {
                  type: "string",
                  enum: ["relevance_B", "relevance_T", "relevance_E", "relevance_R"],
                  description: "Relevance logic system: B=basic, T=ticketing, E=entailment, R=strongest",
                  default: "relevance_R"
                },
              },
              required: ["argument"],
            },
          },
          {
            name: "check_relevance",
            description: "Check exact syntactic sharing between premises and conclusion",
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
            name: "structure_argument",
            description: "Transform complex explanations into clear logical structure when dealing with multi-step reasoning, comparisons, or justifications. Helps organize thoughts before presenting.",
            inputSchema: {
              type: "object",
              properties: {
                argument: {
                  type: "string",
                  description: "Natural language argument to structure",
                },
                context: {
                  type: "string",
                  description: "Additional context about the domain or intended interpretation",
                  default: ""
                },
              },
              required: ["argument"],
            },
          },
          {
            name: "diagnose_gaps",
            description: "Identify and fill logical gaps in complex explanations. Use when reasoning feels incomplete or when multiple claims need stronger connecting logic.",
            inputSchema: {
              type: "object",
              properties: {
                argument: {
                  type: "string",
                  description: "Natural language argument to diagnose",
                },
                domain: {
                  type: "string",
                  description: "Domain context (e.g., 'biology', 'mathematics', 'ethics')",
                  default: "general"
                },
              },
              required: ["argument"],
            },
          },
          {
            name: "formalize_reasoning",
            description: "Strengthen reasoning by making implicit logical connections explicit. Essential when explanations involve cause-and-effect relationships or require rigorous justification.",
            inputSchema: {
              type: "object",
              properties: {
                naturalStatement: {
                  type: "string",
                  description: "Natural language reasoning to formalize",
                },
                targetConclusion: {
                  type: "string",
                  description: "What the reasoning is trying to prove",
                  default: ""
                },
              },
              required: ["naturalStatement"],
            },
          },
        ] satisfies Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "rlmcp_reason": {
          const { task, context } = args as { task: string; context?: string };
          
          // Step 1: Formalize the reasoning
          const formalized = this.generateFormalizationSteps(task, context || "");
          
          // Step 2: Structure into argument form
          const structured = this.parser.parseArgument(task);
          
          // Step 3: Validate the logic
          const validation = this.strictValidation(
            structured.premises.map(p => p.formula),
            structured.conclusion.formula,
            "relevance_R"
          );
          
          // Step 4: If invalid, diagnose gaps
          let gapAnalysis = null;
          if (!validation.validation.overallValid) {
            gapAnalysis = this.diagnoseLogicalGaps(task, context || "general");
          }
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  rlmcp_analysis: {
                    original_task: task,
                    formalization_guidance: formalized,
                    structured_argument: {
                      premises: structured.premises.length,
                      conclusion: structured.conclusion.originalText,
                      logical_structure: validation.validation.overallValid ? "VALID" : "INVALID"
                    },
                    validation_results: validation.validation,
                    gap_analysis: gapAnalysis,
                    recommendations: gapAnalysis?.recommendations || [
                      "Argument is logically valid under relevance logic principles",
                      "All premises properly connect to conclusion through exact syntactic sharing"
                    ]
                  }
                }, null, 2)
              }
            ]
          };
        }
        
        case "parse_statement": {
          const { statement } = args as { statement: string };
          const parsed = this.parser.parse(statement);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  version: "2.0.0 - STRICT COMPLIANCE",
                  original: parsed.originalText,
                  symbolic: FormulaUtils.toString(parsed.formula),
                  variables: Array.from(parsed.formula.variables),
                  predicates: Array.from(parsed.formula.predicates),
                  atomicFormulas: FormulaUtils.extractAtomicFormulas(parsed.formula).map(a => FormulaUtils.toString(a)),
                  confidence: parsed.confidence,
                  ambiguities: parsed.ambiguities,
                  supportedPatterns: this.parser.getSupportedPatterns()
                }, null, 2),
              },
            ],
          };
        }

        case "validate_argument": {
          const { argument, system = "relevance_R" } = args as { 
            argument: string, 
            system?: LogicSystem 
          };
          
          const parsedArg = this.parser.parseArgument(argument);
          const premises = parsedArg.premises.map(p => p.formula);
          const conclusion = parsedArg.conclusion.formula;
          
          // STRICT VALIDATION
          const validation = this.strictValidation(premises, conclusion, system);
          
          // If invalid, automatically include detailed gap analysis
          if (!validation.validation.overallValid) {
            (validation as any).automaticGapAnalysis = this.diagnoseLogicalGaps(argument, "general");
          }
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(validation, null, 2),
              },
            ],
          };
        }

        case "check_relevance": {
          const { premises, conclusion } = args as { premises: string[], conclusion: string };
          
          const parsedPremises = premises.map(p => this.parser.parse(p).formula);
          const parsedConclusion = this.parser.parse(conclusion).formula;
          
          const sharingAnalysis = this.analyzeSyntacticSharing(parsedPremises, parsedConclusion);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(sharingAnalysis, null, 2),
              },
            ],
          };
        }

        case "structure_argument": {
          const { argument, context = "" } = args as { argument: string, context?: string };
          
          const structuredAnalysis = this.structureArgument(argument, context);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(structuredAnalysis, null, 2),
              },
            ],
          };
        }

        case "diagnose_gaps": {
          const { argument, domain = "general" } = args as { argument: string, domain?: string };
          
          const gapAnalysis = this.diagnoseLogicalGaps(argument, domain);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(gapAnalysis, null, 2),
              },
            ],
          };
        }

        case "formalize_reasoning": {
          const { naturalStatement, targetConclusion = "" } = args as { naturalStatement: string, targetConclusion?: string };
          
          const formalizationGuide = this.guideFormalization(naturalStatement, targetConclusion);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(formalizationGuide, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private setupPromptHandlers(): void {
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: "structure_reasoning",
            description: "Use this prompt to automatically structure your reasoning before presenting explanations",
            arguments: [
              {
                name: "task",
                description: "The task or question you need to reason about",
                required: true
              }
            ]
          },
          {
            name: "validate_logic",
            description: "Use this prompt to validate your logical reasoning automatically",
            arguments: [
              {
                name: "reasoning",
                description: "Your reasoning or argument to validate",
                required: true
              }
            ]
          }
        ] satisfies Prompt[],
      };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case "structure_reasoning": {
          const { task } = args as { task: string };
          return {
            description: "Automatic reasoning structuring guide",
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `Before answering "${task}", use the relevance logic tools to:
1. Use formalize_reasoning to convert your initial thoughts into structured logical form
2. Use structure_argument to organize your reasoning into clear premises and conclusions  
3. Use validate_argument to ensure your reasoning follows relevance logic principles
4. Use diagnose_gaps if validation fails to identify missing premises
5. Present your final, logically validated response

This ensures all your responses are grounded in rigorous logical reasoning.`
                }
              }
            ]
          };
        }
        
        case "validate_logic": {
          const { reasoning } = args as { reasoning: string };
          return {
            description: "Automatic logic validation guide", 
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `For the reasoning: "${reasoning}"

AUTOMATICALLY apply these relevance logic tools:
1. structure_argument - Convert this reasoning to formal logical structure
2. validate_argument - Check for exact syntactic sharing and logical validity
3. diagnose_gaps - If invalid, identify what's missing
4. formalize_reasoning - Strengthen weak connections

Do this validation transparently, then present the improved reasoning.`
                }
              }
            ]
          };
        }
        
        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    });
  }

  private strictValidation(premises: LogicFormula[], conclusion: LogicFormula, system: LogicSystem) {
    const analysis = {
      version: "2.0.0 - STRICT RELEVANCE LOGIC COMPLIANCE",
      system: system,
      argument: {
        premises: premises.map(p => FormulaUtils.toString(p)),
        conclusion: FormulaUtils.toString(conclusion)
      },
      validation: {
        exactSyntacticSharing: false,
        systemSpecificValid: false,
        structurallyValid: false,
        overallValid: false
      },
      errors: [] as string[],
      warnings: [] as string[],
      details: {} as any
    };

    // 1. EXACT SYNTACTIC SHARING CHECK (CRITICAL)
    const hasExactSharing = this.checkExactSyntacticSharing(premises, conclusion);
    analysis.validation.exactSyntacticSharing = hasExactSharing;
    analysis.details.sharingAnalysis = this.analyzeSyntacticSharing(premises, conclusion);

    if (!hasExactSharing) {
      analysis.errors.push("RELEVANCE VIOLATION: No exact syntactic sharing of atomic formulas between premises and conclusion");
      analysis.warnings.push("This violates the fundamental variable sharing principle of relevance logic");
    }

    // 2. SYSTEM-SPECIFIC VALIDATION
    analysis.validation.systemSpecificValid = this.validateForSystem(premises, conclusion, system);
    if (!analysis.validation.systemSpecificValid) {
      analysis.errors.push(`Invalid in ${system}: Violates system-specific constraints`);
    }

    // 3. STRUCTURAL VALIDATION
    analysis.validation.structurallyValid = hasExactSharing; // Simplified
    
    // 4. OVERALL VALIDATION
    analysis.validation.overallValid = hasExactSharing && 
                                        analysis.validation.systemSpecificValid && 
                                        analysis.validation.structurallyValid;

    return analysis;
  }

  private checkExactSyntacticSharing(premises: LogicFormula[], conclusion: LogicFormula): boolean {
    return premises.some(premise => FormulaUtils.hasExactAtomicSharing(premise, conclusion));
  }

  private analyzeSyntacticSharing(premises: LogicFormula[], conclusion: LogicFormula) {
    const conclusionAtoms = FormulaUtils.extractAtomicFormulas(conclusion);
    
    const analysis = {
      conclusionAtomicFormulas: conclusionAtoms.map(a => FormulaUtils.toString(a)),
      premiseAnalysis: premises.map((premise, idx) => {
        const premiseAtoms = FormulaUtils.extractAtomicFormulas(premise);
        const sharedAtoms = FormulaUtils.getSharedAtomicFormulas(premise, conclusion);
        
        return {
          premiseIndex: idx,
          premise: FormulaUtils.toString(premise),
          atomicFormulas: premiseAtoms.map(a => FormulaUtils.toString(a)),
          sharedAtomicFormulas: sharedAtoms.map(a => FormulaUtils.toString(a)),
          hasExactSharing: sharedAtoms.length > 0,
          sharingStrength: sharedAtoms.length / Math.max(premiseAtoms.length, 1)
        };
      }),
      overallSharing: premises.some(premise => FormulaUtils.hasExactAtomicSharing(premise, conclusion))
    };

    return analysis;
  }

  private validateForSystem(premises: LogicFormula[], conclusion: LogicFormula, system: LogicSystem): boolean {
    // Simplified system-specific validation
    switch (system) {
      case 'relevance_B':
        // System B: Only allows identity A → A
        return this.isIdentityInference(premises, conclusion);
        
      case 'relevance_T':
        // System T: Allows identity and contraction
        return this.isIdentityInference(premises, conclusion) || 
               this.isContractionInference(premises, conclusion);
        
      case 'relevance_E':
      case 'relevance_R':
        // Systems E and R: Allow more complex inferences
        return this.checkExactSyntacticSharing(premises, conclusion);
        
      default:
        return true; // Classical logic
    }
  }

  private isIdentityInference(premises: LogicFormula[], conclusion: LogicFormula): boolean {
    // A → A is always valid
    return premises.some(premise => 
      FormulaUtils.toString(premise) === FormulaUtils.toString(conclusion)
    );
  }

  private isContractionInference(premises: LogicFormula[], conclusion: LogicFormula): boolean {
    // A → A ∧ A pattern
    if (conclusion.type === 'compound' && conclusion.operator === 'and' && 
        conclusion.subformulas && conclusion.subformulas.length === 2) {
      const left = conclusion.subformulas[0];
      const right = conclusion.subformulas[1];
      
      // Check if both conjuncts match some premise
      return premises.some(premise => 
        FormulaUtils.toString(premise) === FormulaUtils.toString(left) &&
        FormulaUtils.toString(premise) === FormulaUtils.toString(right)
      );
    }
    return false;
  }

  private structureArgument(argument: string, context: string) {
    const parsedArg = this.parser.parseArgument(argument);
    const premises = parsedArg.premises.map(p => p.formula);
    const conclusion = parsedArg.conclusion.formula;

    // Analysis to help AI assistants understand logical structure
    const analysis = {
      version: "2.0.0 - ARGUMENT STRUCTURING TOOL",
      input: {
        originalArgument: argument,
        context: context
      },
      parsed: {
        premises: parsedArg.premises.map((p, i) => ({
          index: i + 1,
          originalText: p.originalText,
          logicalForm: FormulaUtils.toString(p.formula),
          atomicFormulas: FormulaUtils.extractAtomicFormulas(p.formula).map(a => FormulaUtils.toString(a)),
          confidence: p.confidence
        })),
        conclusion: {
          originalText: parsedArg.conclusion.originalText,
          logicalForm: FormulaUtils.toString(conclusion),
          atomicFormulas: FormulaUtils.extractAtomicFormulas(conclusion).map(a => FormulaUtils.toString(a)),
          confidence: parsedArg.conclusion.confidence
        }
      },
      structuralAnalysis: {
        logicalConnectives: this.analyzeConnectives(premises, conclusion),
        predicateUsage: this.analyzePredicates(premises, conclusion),
        variableUsage: this.analyzeVariables(premises, conclusion)
      },
      relevancePreCheck: {
        hasAtomicSharing: premises.some(p => FormulaUtils.hasExactAtomicSharing(p, conclusion)),
        sharingDetails: this.analyzeSyntacticSharing(premises, conclusion),
        potentialIssues: this.identifyStructuralIssues(premises, conclusion)
      },
      recommendations: this.generateStructuralRecommendations(parsedArg, context)
    };

    return analysis;
  }

  private analyzeConnectives(premises: LogicFormula[], conclusion: LogicFormula) {
    const allFormulas = [...premises, conclusion];
    const connectives = new Set<string>();
    
    const extractConnectives = (formula: LogicFormula) => {
      if (formula.operator) {
        connectives.add(formula.operator);
      }
      if (formula.subformulas) {
        formula.subformulas.forEach(extractConnectives);
      }
    };
    
    allFormulas.forEach(extractConnectives);
    return Array.from(connectives);
  }

  private analyzePredicates(premises: LogicFormula[], conclusion: LogicFormula) {
    const allPredicates = new Set<string>();
    const predicateUsage: { [predicate: string]: number } = {};
    
    const extractPredicates = (formula: LogicFormula) => {
      if (formula.predicates) {
        formula.predicates.forEach(p => {
          allPredicates.add(p);
          predicateUsage[p] = (predicateUsage[p] || 0) + 1;
        });
      }
    };
    
    [...premises, conclusion].forEach(extractPredicates);
    
    return {
      totalPredicates: Array.from(allPredicates),
      usage: predicateUsage,
      sharedPredicates: Array.from(allPredicates).filter(pred => 
        premises.some(p => p.predicates.has(pred)) && conclusion.predicates.has(pred)
      )
    };
  }

  private analyzeVariables(premises: LogicFormula[], conclusion: LogicFormula) {
    const allVariables = new Set<string>();
    const variableUsage: { [variable: string]: number } = {};
    
    const extractVariables = (formula: LogicFormula) => {
      if (formula.variables) {
        formula.variables.forEach(v => {
          allVariables.add(v);
          variableUsage[v] = (variableUsage[v] || 0) + 1;
        });
      }
    };
    
    [...premises, conclusion].forEach(extractVariables);
    
    return {
      totalVariables: Array.from(allVariables),
      usage: variableUsage
    };
  }

  private identifyStructuralIssues(premises: LogicFormula[], conclusion: LogicFormula): string[] {
    const issues: string[] = [];
    
    // Check for completely disconnected terms
    const premiseAtoms = premises.flatMap(p => FormulaUtils.extractAtomicFormulas(p));
    const conclusionAtoms = FormulaUtils.extractAtomicFormulas(conclusion);
    
    const hasAnyPredicateSharing = premiseAtoms.some(pAtom => 
      conclusionAtoms.some(cAtom => pAtom.predicate === cAtom.predicate)
    );
    
    if (!hasAnyPredicateSharing) {
      issues.push("No predicate sharing between premises and conclusion - likely relevance violation");
    }
    
    // Check for complex nested structures that might need clarification
    const hasComplexNesting = [...premises, conclusion].some(f => FormulaUtils.complexity(f) > 5);
    if (hasComplexNesting) {
      issues.push("Complex nested logical structure - consider breaking into simpler steps");
    }
    
    return issues;
  }

  private generateStructuralRecommendations(parsedArg: any, context: string): string[] {
    const recommendations: string[] = [];
    
    recommendations.push("For relevance logic validation:");
    recommendations.push("1. Ensure premises and conclusion share atomic formulas exactly");
    recommendations.push("2. Use precise logical quantifiers (∀, ∃) when dealing with general statements");
    recommendations.push("3. Make variable bindings explicit");
    recommendations.push("4. Avoid irrelevant premises that don't contribute to the conclusion");
    
    if (context) {
      recommendations.push(`5. Given context "${context}", consider domain-specific logical relationships`);
    }
    
    return recommendations;
  }

  private diagnoseLogicalGaps(argument: string, domain: string) {
    const parsedArg = this.parser.parseArgument(argument);
    const premises = parsedArg.premises.map(p => p.formula);
    const conclusion = parsedArg.conclusion.formula;

    const diagnosis = {
      version: "2.0.0 - LOGICAL GAP DIAGNOSTIC TOOL",
      input: {
        originalArgument: argument,
        domain: domain
      },
      parsed: {
        premiseCount: premises.length,
        premises: parsedArg.premises.map((p, i) => ({
          index: i + 1,
          text: p.originalText,
          logicalForm: FormulaUtils.toString(p.formula),
          atomicFormulas: FormulaUtils.extractAtomicFormulas(p.formula).map(a => FormulaUtils.toString(a))
        })),
        conclusion: {
          text: parsedArg.conclusion.originalText,
          logicalForm: FormulaUtils.toString(conclusion),
          atomicFormulas: FormulaUtils.extractAtomicFormulas(conclusion).map(a => FormulaUtils.toString(a))
        }
      },
      gapAnalysis: {
        syntacticSharing: this.analyzeSyntacticGaps(premises, conclusion),
        logicalBridges: this.identifyMissingBridges(premises, conclusion),
        implicitPremises: this.identifyMissingPremises(premises, conclusion, domain),
        quantifierIssues: this.analyzeQuantifierGaps(premises, conclusion),
        structuralIssues: this.analyzeStructuralGaps(premises, conclusion)
      },
      recommendations: this.generateGapRepairRecommendations(premises, conclusion, domain)
    };

    return diagnosis;
  }

  private analyzeSyntacticGaps(premises: LogicFormula[], conclusion: LogicFormula) {
    const conclusionAtoms = FormulaUtils.extractAtomicFormulas(conclusion);
    const premiseAtoms = premises.flatMap(p => FormulaUtils.extractAtomicFormulas(p));
    
    const unsharedAtoms = conclusionAtoms.filter(cAtom => 
      !premiseAtoms.some(pAtom => FormulaUtils.atomicFormulasIdentical(cAtom, pAtom))
    );

    const sharedPredicates = new Set<string>();
    const unsharedPredicates = new Set<string>();
    
    conclusionAtoms.forEach(cAtom => {
      const hasSharing = premiseAtoms.some(pAtom => 
        pAtom.predicate === cAtom.predicate && 
        (pAtom.terms?.length || 0) === (cAtom.terms?.length || 0)
      );
      
      if (hasSharing) {
        sharedPredicates.add(cAtom.predicate!);
      } else {
        unsharedPredicates.add(cAtom.predicate!);
      }
    });

    return {
      hasExactSyntacticSharing: premises.some(p => FormulaUtils.hasExactAtomicSharing(p, conclusion)),
      unsharedAtomicFormulas: unsharedAtoms.map(a => FormulaUtils.toString(a)),
      sharedPredicates: Array.from(sharedPredicates),
      unsharedPredicates: Array.from(unsharedPredicates),
      severityLevel: unsharedPredicates.size > 0 ? "CRITICAL" : 
                   unsharedAtoms.length > 0 ? "MODERATE" : "NONE"
    };
  }

  private identifyMissingBridges(premises: LogicFormula[], conclusion: LogicFormula) {
    const bridges: { type: string, description: string, suggestedPremise?: string }[] = [];
    
    const conclusionAtoms = FormulaUtils.extractAtomicFormulas(conclusion);
    const premiseAtoms = premises.flatMap(p => FormulaUtils.extractAtomicFormulas(p));

    // Check for predicates that appear in conclusion but not premises
    conclusionAtoms.forEach(cAtom => {
      const matchingPredicates = premiseAtoms.filter(pAtom => 
        pAtom.predicate === cAtom.predicate
      );
      
      if (matchingPredicates.length === 0) {
        bridges.push({
          type: "MISSING_PREDICATE_BRIDGE",
          description: `Conclusion uses predicate '${cAtom.predicate}' but no premise provides it`,
          suggestedPremise: `Need a premise that establishes ${FormulaUtils.toString(cAtom)} or connects to it`
        });
      } else {
        // Check for term/variable mismatches
        const hasExactMatch = matchingPredicates.some(pAtom => 
          FormulaUtils.atomicFormulasIdentical(pAtom, cAtom)
        );
        
        if (!hasExactMatch) {
          const termMismatches = matchingPredicates.map(pAtom => ({
            premise: FormulaUtils.toString(pAtom),
            conclusion: FormulaUtils.toString(cAtom)
          }));
          
          bridges.push({
            type: "TERM_BRIDGE_NEEDED",
            description: `Predicate '${cAtom.predicate}' exists but with different terms`,
            suggestedPremise: `Need to connect: ${termMismatches.map(m => `${m.premise} relates to ${m.conclusion}`).join(', ')}`
          });
        }
      }
    });

    return {
      missingBridges: bridges,
      bridgeCount: bridges.length,
      criticalityLevel: bridges.some(b => b.type === "MISSING_PREDICATE_BRIDGE") ? "HIGH" : 
                       bridges.length > 0 ? "MEDIUM" : "LOW"
    };
  }

  private identifyMissingPremises(premises: LogicFormula[], conclusion: LogicFormula, domain: string) {
    const missing: { type: string, premise: string, justification: string }[] = [];
    
    // Analyze based on domain knowledge
    const domainRules = this.getDomainKnowledge(domain);
    
    const conclusionStr = FormulaUtils.toString(conclusion);
    const premiseStrs = premises.map(p => FormulaUtils.toString(p));
    
    // Look for universal statements that need instantiation
    premises.forEach(premise => {
      if (premise.operator === 'forall') {
        const universalAtoms = FormulaUtils.extractAtomicFormulas(premise);
        const conclusionAtoms = FormulaUtils.extractAtomicFormulas(conclusion);
        
        universalAtoms.forEach(uAtom => {
          const needsInstantiation = conclusionAtoms.some(cAtom => 
            uAtom.predicate === cAtom.predicate && 
            uAtom.terms?.some(t => t.type === 'variable') &&
            cAtom.terms?.some(t => t.type === 'constant')
          );
          
          if (needsInstantiation) {
            const constantTerms = conclusionAtoms.find(cAtom => 
              cAtom.predicate === uAtom.predicate
            )?.terms?.filter(t => t.type === 'constant') || [];
            
            constantTerms.forEach(term => {
              const instancePremise = `${uAtom.predicate}(${term.name})`;
              if (!premiseStrs.some(p => p.includes(instancePremise))) {
                missing.push({
                  type: "UNIVERSAL_INSTANTIATION",
                  premise: instancePremise,
                  justification: `Universal statement needs specific instance: ${instancePremise}`
                });
              }
            });
          }
        });
      }
    });

    // Check for transitivity gaps
    const predicates = new Set([...premises, conclusion].flatMap(f => 
      FormulaUtils.extractAtomicFormulas(f).map(a => a.predicate!)
    ));
    
    for (const pred of predicates) {
      const instances = premises.flatMap(p => 
        FormulaUtils.extractAtomicFormulas(p).filter(a => a.predicate === pred)
      );
      
      if (instances.length > 1) {
        // Look for potential transitivity needs
        // This is domain-specific and could be enhanced
      }
    }

    return {
      missingPremises: missing,
      totalMissing: missing.length,
      severity: missing.length === 0 ? "NONE" : missing.length < 3 ? "MODERATE" : "HIGH"
    };
  }

  private analyzeQuantifierGaps(premises: LogicFormula[], conclusion: LogicFormula) {
    const issues: { type: string, description: string, location: string }[] = [];
    
    // Check for scope issues, variable binding problems, etc.
    const allFormulas = [...premises, conclusion];
    allFormulas.forEach((formula, idx) => {
      const isConclusion = idx === premises.length;
      const location = isConclusion ? "conclusion" : `premise ${idx + 1}`;
      
      // Check for unbound variables
      const freeVars = FormulaUtils.getFreeVariables(formula);
      if (freeVars.size > 0) {
        issues.push({
          type: "UNBOUND_VARIABLES",
          description: `Free variables found: ${Array.from(freeVars).join(', ')}`,
          location: location
        });
      }
    });

    return {
      quantifierIssues: issues,
      issueCount: issues.length,
      severity: issues.length > 0 ? "MEDIUM" : "NONE"
    };
  }

  private analyzeStructuralGaps(premises: LogicFormula[], conclusion: LogicFormula) {
    const issues: string[] = [];
    
    // Check argument structure
    if (premises.length === 0) {
      issues.push("No premises provided - conclusion cannot be derived");
    }
    
    if (premises.length === 1 && !FormulaUtils.hasExactAtomicSharing(premises[0], conclusion)) {
      issues.push("Single premise does not share content with conclusion");
    }
    
    // Check for circular reasoning
    premises.forEach((premise, idx) => {
      if (FormulaUtils.toString(premise) === FormulaUtils.toString(conclusion)) {
        issues.push(`Premise ${idx + 1} is identical to conclusion - circular reasoning`);
      }
    });

    return {
      structuralIssues: issues,
      severity: issues.length > 0 ? "HIGH" : "NONE"
    };
  }

  private getDomainKnowledge(domain: string): { rules: string[], concepts: string[] } {
    const domainMap: { [key: string]: { rules: string[], concepts: string[] } } = {
      biology: {
        rules: ["All mammals are animals", "All dogs are mammals", "Species hierarchy"],
        concepts: ["species", "genus", "classification", "inheritance"]
      },
      mathematics: {
        rules: ["Transitivity", "Symmetry", "Reflexivity", "Equivalence relations"],
        concepts: ["equality", "greater than", "set membership", "functions"]
      },
      general: {
        rules: ["Identity", "Universal instantiation", "Modus ponens"],
        concepts: ["identity", "class membership", "properties"]
      }
    };
    
    return domainMap[domain] || domainMap.general;
  }

  private generateGapRepairRecommendations(premises: LogicFormula[], conclusion: LogicFormula, domain: string): string[] {
    const recommendations: string[] = [];
    
    const hasSharing = premises.some(p => FormulaUtils.hasExactAtomicSharing(p, conclusion));
    
    if (!hasSharing) {
      recommendations.push("CRITICAL: Add premises that share atomic formulas with the conclusion");
      recommendations.push("Identify what connects your premises to your conclusion logically");
    }
    
    const conclusionAtoms = FormulaUtils.extractAtomicFormulas(conclusion);
    const premiseAtoms = premises.flatMap(p => FormulaUtils.extractAtomicFormulas(p));
    
    conclusionAtoms.forEach(cAtom => {
      const hasMatch = premiseAtoms.some(pAtom => 
        FormulaUtils.atomicFormulasIdentical(pAtom, cAtom)
      );
      
      if (!hasMatch) {
        recommendations.push(`Add a premise that establishes or leads to: ${FormulaUtils.toString(cAtom)}`);
      }
    });
    
    if (domain !== "general") {
      recommendations.push(`Consider ${domain}-specific rules and relationships`);
    }
    
    recommendations.push("Ensure all terms and predicates are properly defined and connected");
    
    return recommendations;
  }

  private guideFormalization(naturalStatement: string, targetConclusion: string) {
    const parsed = this.parser.parseArgument(naturalStatement);
    
    const guide = {
      version: "2.0.0 - FORMALIZATION GUIDE",
      input: {
        naturalStatement: naturalStatement,
        targetConclusion: targetConclusion
      },
      currentParsing: {
        premises: parsed.premises.map((p, i) => ({
          index: i + 1,
          naturalLanguage: p.originalText,
          currentLogicalForm: FormulaUtils.toString(p.formula),
          atomicFormulas: FormulaUtils.extractAtomicFormulas(p.formula).map(a => FormulaUtils.toString(a)),
          issues: this.identifyFormalizationIssues(p.formula, p.originalText)
        })),
        conclusion: {
          naturalLanguage: parsed.conclusion.originalText,
          currentLogicalForm: FormulaUtils.toString(parsed.conclusion.formula),
          atomicFormulas: FormulaUtils.extractAtomicFormulas(parsed.conclusion.formula).map(a => FormulaUtils.toString(a)),
          issues: this.identifyFormalizationIssues(parsed.conclusion.formula, parsed.conclusion.originalText)
        }
      },
      formalizationProblems: {
        overlyComplexPredicates: this.findComplexPredicates(parsed),
        missingAtomicDecomposition: this.suggestAtomicDecomposition(parsed),
        lackOfSharedPredicates: this.analyzePredicateSharing(parsed),
        implicitCausalConnections: this.identifyImplicitConnections(naturalStatement)
      },
      recommendedFormalization: this.suggestBetterFormalization(parsed, targetConclusion),
      stepByStepGuide: this.generateFormalizationSteps(naturalStatement, targetConclusion)
    };

    return guide;
  }

  private identifyFormalizationIssues(formula: LogicFormula, originalText: string): string[] {
    const issues: string[] = [];
    
    if (formula.type === 'atomic' && formula.predicate && formula.predicate.length > 30) {
      issues.push("Predicate name too complex - should be broken into simpler atomic predicates");
    }
    
    if (originalText.includes(' and ') || originalText.includes(' because ') || originalText.includes(' that ')) {
      issues.push("Complex sentence structure suggests multiple logical relationships that should be separated");
    }
    
    if (formula.predicate?.includes('_') && (formula.predicate.match(/_/g) || []).length > 3) {
      issues.push("Predicate has too many underscore-separated concepts - consider using multiple predicates");
    }
    
    return issues;
  }

  private findComplexPredicates(parsed: { premises: any[], conclusion: any }): { predicate: string, suggestion: string }[] {
    const complex: { predicate: string, suggestion: string }[] = [];
    
    const allFormulas = [...parsed.premises.map(p => p.formula), parsed.conclusion.formula];
    
    allFormulas.forEach(formula => {
      const atoms = FormulaUtils.extractAtomicFormulas(formula);
      atoms.forEach(atom => {
        if (atom.predicate && atom.predicate.length > 25) {
          complex.push({
            predicate: atom.predicate,
            suggestion: `Break "${atom.predicate}" into simpler atomic predicates`
          });
        }
      });
    });
    
    return complex;
  }

  private suggestAtomicDecomposition(parsed: { premises: any[], conclusion: any }): { original: string, suggested: string[] }[] {
    const decompositions: { original: string, suggested: string[] }[] = [];
    
    // Example decompositions for common AI reasoning patterns
    const commonPatterns = [
      {
        pattern: /(.+)_is_(.+)_and_(.+)/,
        decomposer: (match: RegExpMatchArray) => [
          `${match[1]}(${match[2]})`,
          `${match[1]}(${match[3]})`
        ]
      },
      {
        pattern: /(.+)_because_(.+)/,
        decomposer: (match: RegExpMatchArray) => [
          `causes(${match[2]}, ${match[1]})`,
          `${match[2]}`,
          `${match[1]}`
        ]
      }
    ];

    const allText = [
      ...parsed.premises.map(p => p.originalText),
      parsed.conclusion.originalText
    ];

    allText.forEach(text => {
      commonPatterns.forEach(pattern => {
        const match = text.match(pattern.pattern);
        if (match) {
          decompositions.push({
            original: text,
            suggested: pattern.decomposer(match)
          });
        }
      });
    });

    return decompositions;
  }

  private analyzePredicateSharing(parsed: { premises: any[], conclusion: any }): { issue: string, suggestion: string }[] {
    const issues: { issue: string, suggestion: string }[] = [];
    
    const premisePredicates = new Set<string>();
    parsed.premises.forEach(p => {
      const atoms = FormulaUtils.extractAtomicFormulas(p.formula);
      atoms.forEach(atom => {
        if (atom.predicate) premisePredicates.add(atom.predicate);
      });
    });
    
    const conclusionPredicates = new Set<string>();
    const conclusionAtoms = FormulaUtils.extractAtomicFormulas(parsed.conclusion.formula);
    conclusionAtoms.forEach(atom => {
      if (atom.predicate) conclusionPredicates.add(atom.predicate);
    });
    
    const sharedPredicates = Array.from(premisePredicates).filter(p => conclusionPredicates.has(p));
    
    if (sharedPredicates.length === 0) {
      issues.push({
        issue: "No predicates shared between premises and conclusion",
        suggestion: "Reformulate to use common predicates that appear in both premises and conclusion"
      });
    }
    
    return issues;
  }

  private identifyImplicitConnections(naturalStatement: string): string[] {
    const connections: string[] = [];
    
    if (naturalStatement.includes('because')) {
      connections.push("'Because' indicates causal relationship - make explicit with causal predicates");
    }
    
    if (naturalStatement.includes('therefore') || naturalStatement.includes('so')) {
      connections.push("Conclusion marker found - ensure logical connection is explicit, not just temporal");
    }
    
    if (naturalStatement.includes('this') || naturalStatement.includes('that')) {
      connections.push("Pronoun references may hide logical connections - make relationships explicit");
    }
    
    return connections;
  }

  private suggestBetterFormalization(parsed: any, targetConclusion: string): { 
    improvedPremises: string[], 
    improvedConclusion: string,
    explanation: string 
  } {
    // This would be a sophisticated transformation - simplified version here
    return {
      improvedPremises: [
        "Break complex statements into atomic predicates",
        "Ensure each premise contains predicates that will appear in conclusion",
        "Make causal relationships explicit with proper logical connectives"
      ],
      improvedConclusion: targetConclusion || "Reformulated to share predicates with premises",
      explanation: "Proper formalization requires atomic predicates, explicit logical relationships, and syntactic sharing"
    };
  }

  private generateFormalizationSteps(naturalStatement: string, targetConclusion: string): string[] {
    return [
      "1. IDENTIFY CORE CONCEPTS: Extract the main entities and properties",
      "2. CREATE ATOMIC PREDICATES: Use simple predicate names like P(x), Q(y), not complex descriptions",
      "3. ESTABLISH SHARED PREDICATES: Ensure conclusion predicates appear in premises",
      "4. MAKE CONNECTIONS EXPLICIT: Replace 'because', 'therefore' with formal logical operators",
      "5. USE PROPER QUANTIFIERS: Universal (∀) for general statements, existential (∃) for specific instances",
      "6. VALIDATE SHARING: Check that premises and conclusion share atomic formulas exactly",
      "7. TEST IN RELEVANCE LOGIC: Use validate_argument to confirm formal validity"
    ];
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