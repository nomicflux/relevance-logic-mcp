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
import { FormulaUtils, FormulaBuilder } from "./logic/formula.js";
import { LogicFormula, ValidationResult } from "./types.js";
import { EvidenceModule } from "./evidence/evidence-module.js";
import { AtomicReasonModule } from "./logic/atomic-reason.js";

class RelevanceLogicServer {
  private server: Server;
  private parser: NaturalLanguageParser;
  private evidenceModule: EvidenceModule;
  private atomicReasonModule: AtomicReasonModule;

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
    this.evidenceModule = new EvidenceModule();
    this.atomicReasonModule = new AtomicReasonModule();
    
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
            description: "Construct logically rigorous arguments using relevance logic. Validates premise-conclusion connections and identifies logical gaps.",
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
                previous_argument: {
                  type: "string",
                  description: "Optional previous version of the argument for comparison and change tracking"
                },
              },
              required: ["task"],
            },
          },
          {
            name: "parse_statement",
            description: "Parse natural language into formal logical structure",
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
            description: "[HELPER TOOL] Validate argument logical structure. User-requested only.",
            inputSchema: {
              type: "object",
              properties: {
                argument: {
                  type: "string",
                  description: "Argument to validate",
                },
              },
              required: ["argument"],
            },
          },
          {
            name: "check_relevance",
            description: "[HELPER TOOL] Check premise-conclusion relevance. User-requested only.",
            inputSchema: {
              type: "object",
              properties: {
                premises: {
                  type: "array",
                  items: { type: "string" },
                  description: "Premise statements",
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
            description: "[HELPER TOOL] Structure natural language into logical argument form. User-requested only.",
            inputSchema: {
              type: "object",
              properties: {
                argument: {
                  type: "string",
                  description: "Argument to structure",
                },
                context: {
                  type: "string",
                  description: "Domain context",
                  default: ""
                },
              },
              required: ["argument"],
            },
          },
          {
            name: "diagnose_gaps",
            description: "[HELPER TOOL] Diagnose logical gaps in invalid arguments. User-requested only.",
            inputSchema: {
              type: "object",
              properties: {
                argument: {
                  type: "string",
                  description: "Argument to diagnose",
                },
              },
              required: ["argument"],
            },
          },
          {
            name: "formalize_reasoning",
            description: "[HELPER TOOL] Convert natural language to formal logical structure. User-requested only.",
            inputSchema: {
              type: "object",
              properties: {
                naturalStatement: {
                  type: "string",
                  description: "Reasoning to formalize",
                },
                targetConclusion: {
                  type: "string",
                  description: "Target conclusion",
                  default: ""
                },
              },
              required: ["naturalStatement"],
            },
          },
          {
            name: "evidence_gathering",
            description: "Validate evidence AND force analysis of conflicts. Provide evidence_items as ARRAY OF OBJECTS, each object containing: {target, summary, strength (-1 to 1, negative=contradicts, positive=supports, zero=neutral), citation}. Tool will analyze conflicts and present requirements for self-analysis. Only succeeds when ALL evidence complete.",
            inputSchema: {
              type: "object",
              properties: {
                rlmcp_output: {
                  type: "string",
                  description: "rlmcp_reason JSON output"
                },
                evidence_items: {
                  type: "array",
                  description: "Evidence for each atom/implication",
                  items: {
                    type: "object",
                    properties: {
                      target: { type: "string", description: "The atom/implication this evidence is for" },
                      summary: { type: "string", description: "Evidence text" },
                      strength: { type: "number", description: "Evidence strength -1.0 to 1.0. Negative values contradict the claim, positive values support it, values close to zero are neutral", minimum: -1, maximum: 1 },
                      citation: { type: "string", description: "Source of evidence" }
                    },
                    required: ["target", "summary", "strength", "citation"]
                  }
                }
              },
              required: ["rlmcp_output", "evidence_items"],
            },
          },
          {
            name: "prepare_logical_plan",
            description: "Create a logical plan structure for validation with RLMCP. Triggered by 'Plan to do X using RLMCP'. The argument you create IS the implementation plan. REQUIREMENTS: Each premise must be a specific, actionable implementation step. You must specify how steps relate to each other. Each implication must show the logical dependency between concrete steps. The conclusion should only be reachable through the chain of specific implementation steps.",
            inputSchema: {
              type: "object",
              properties: {
                goal: {
                  type: "string",
                  description: "The goal/objective that will become the conclusion. Must be reachable only through the chain of specific implementation steps."
                },
                actionable_implementation_steps: {
                  type: "array",
                  description: "Array of specific, actionable implementation steps that will become premises. Each must be concrete and executable, not abstract concepts.",
                  items: {
                    type: "string",
                    description: "A specific, actionable implementation step (e.g., 'Create user authentication module', not 'Handle security')"
                  }
                },
                step_relationships: {
                  type: "array",
                  description: "REQUIRED: How do the steps relate to each other? Which steps enable other steps? Which steps are necessary for others? For example: 'Step 1 enables Step 2', 'Step 3 is necessary for Step 4', 'If Step 5, then Step 6'.",
                  items: {
                    type: "string",
                    description: "A relationship between steps using enabling/dependency language (e.g., 'Creating database schema enables populating initial data')"
                  },
                  minItems: 1
                }
              },
              required: ["goal", "actionable_implementation_steps", "step_relationships"],
            },
          },
          {
            name: "atomic_reason",
            description: "Interactive logical argument validation using atom-symbol mapping to avoid text matching issues.\n\nUSAGE: Ask Claude Desktop to 'Show <argument> using AtomicReason' or 'Show <argument> using AtomicReason with evidence' (if evidence_gathering is also required).\n\nThis tool works in 3 interactive steps:\n1. extract_atoms: Identifies basic argument building blocks\n2. group_atoms: Group different ways of saying the same thing and assign symbols\n3. build_symbolic_argument: Create premises using your symbols and specify conclusion, then validate",
            inputSchema: {
              type: "object",
              properties: {
                step: {
                  type: "string",
                  enum: ["extract_atoms", "group_atoms", "build_symbolic_argument"],
                  description: "Which step of the atomic reasoning process to perform"
                },
                argument_text: {
                  type: "string",
                  description: "The natural language argument to validate. Required for extract_atoms step."
                },
                atom_groupings: {
                  type: "array",
                  description: "Groups of equivalent atoms with assigned symbol names. Each group represents one concept from your argument. Example: {symbol: 'AUTH', concept_description: 'Authentication works', text_variants: ['auth implemented', 'login system ready']}. Required for build_symbolic_argument step.",
                  items: {
                    type: "object",
                    properties: {
                      symbol: { type: "string", description: "Short name for this concept (e.g., AUTH, DB_SETUP, USER_LOGIN)" },
                      concept_description: { type: "string", description: "What this atom means in plain English" },
                      text_variants: { type: "array", items: { type: "string" }, description: "All the different ways this concept appeared in your argument" }
                    },
                    required: ["symbol", "concept_description", "text_variants"]
                  }
                },
                conclusion: {
                  type: "string",
                  description: "Which atom (symbol) you're trying to prove. Must be one of your symbols from atom_groupings. Required for build_symbolic_argument step."
                },
                premises: {
                  type: "array",
                  description: "Your argument's premises using your symbols. Format options: standalone atoms ('AUTH'), conjunctions ('AUTH && IMPL'), disjunctions ('AUTH || IMPL'), implications ('AUTH -> IMPL'), or semi-natural language ('IMPL enables AUTH'). Required for build_symbolic_argument step.",
                  items: { type: "string", description: "One premise using your symbols" }
                }
              },
              required: ["step"],
            },
          },
          {
            name: "rlmcp_help",
            description: "Get guidance for RLMCP validation struggles. Provides solutions for common logical issues.",
            inputSchema: {
              type: "object",
              properties: {
                struggling_with: {
                  type: "string",
                  description: "What you're struggling with",
                  default: "general guidance"
                }
              },
              required: []
            }
          },
          {
            name: "dig_in",
            description: "[USER-INITIATED ONLY] When user says 'dig in to [atom/implication]': take the evidence already provided for that atom/implication as the new premise, take the atom/implication as the new conclusion, build valid logical chain between them. Example: If evidence 'Studies show correlation' was provided for atom 'smoking causes cancer', this creates sub-argument: P1: 'Studies show correlation', C: 'smoking causes cancer'. You must add missing logical steps to make this valid, then merge back into original argument.",
            inputSchema: {
              type: "object",
              properties: {
                mode: {
                  type: "string",
                  enum: ["setup", "merge_subargument"],
                  description: "setup: Create new sub-argument. merge_subargument: Merge completed sub-argument back."
                },
                evidence_text: {
                  type: "string",
                  description: "THE EVIDENCE TEXT ALREADY PROVIDED - this becomes the NEW PREMISE in the sub-argument (required for setup mode)"
                },
                atom_or_implication: {
                  type: "string",
                  description: "THE ATOM OR IMPLICATION this evidence was provided for - this becomes the NEW CONCLUSION in the sub-argument (required for setup mode)"
                },
                original_argument: {
                  type: "string",
                  description: "The original full argument text (required for merge_subargument mode)"
                },
                completed_subargument: {
                  type: "string",
                  description: "The completed logically valid sub-argument (required for merge_subargument mode)"
                }
              },
              required: ["mode", "evidence_text", "atom_or_implication", "original_argument", "completed_subargument"],
              additionalProperties: false
            }
          },
        ] satisfies Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "rlmcp_reason": {
          const { task, context, previous_argument } = args as { task: string; context?: string; previous_argument?: string };
          
          // Step 1: Formalize the reasoning
          const formalized = this.generateFormalizationSteps(task, context || "");
          
          // Step 2: Structure into argument form
          const structured = this.parser.parseArgument(task);

          // Check for empty premises - indicates tool misuse
          if (structured.premises.length === 0) {
            return {
              content: [{
                type: "text",
text: JSON.stringify({
                  error: "NO_PREMISES_FOUND",
                  message: "❌ No premises detected. Use helper tools first:",
                  steps: [
                    "1. formalize_reasoning - convert to logical form",
                    "2. structure_argument - organize premises/conclusion",
                    "3. rlmcp_reason - validate structured argument",
                    "If struggling: use rlmcp_help for general guidance"
                  ],
                  need: "Format: 'Premise 1: ... Conclusion: ...'"
                }, null, 2)
              }]
            };
          }

          // Check for premise reduction if previous_argument provided
          let premiseReductionWarning = null;
          if (previous_argument) {
            const previousStructured = this.parser.parseArgument(previous_argument);
            if (structured.premises.length < previousStructured.premises.length) {
              premiseReductionWarning = {
                status: "WARNING",
                message: "Number of premises has decreased. Please give reasons for simplifying the argument.",
                premise_count_change: {
                  previous: previousStructured.premises.length,
                  current: structured.premises.length,
                  reduction: previousStructured.premises.length - structured.premises.length
                },
                concern: "AI agent may be trying to cheat the system by making the argument overly general and vacuous."
              };
            }
          }
          
          // Step 3: Validate the logic
          const validation = this.strictValidation(
            structured.premises.map(p => p.formula),
            structured.conclusion.formula
          );
          
          // Step 4: If invalid, diagnose gaps
          let gapAnalysis = null;
          if (!validation.validation_results.overallValid) {
            gapAnalysis = this.diagnoseLogicalGaps(task);
          }
          
          // Check if evidence is required based on task wording
          const evidenceRequired = /with evidence|using evidence|including evidence/i.test(task);

          let finalStatus = "invalid";
          let finalGuidance = "";
          let finalNextSteps: string[] = [];

          const isCircular = validation.validation_results.failures.some((f: { constraint_violated: string }) => f.constraint_violated.includes('CIRCULAR REASONING'));

          // Determine base status from validation results
          if (!validation.validation_results.overallValid) {
            // Logic is invalid - must fix first
            finalStatus = "invalid";
            finalGuidance = isCircular ?
              "❌ CIRCULAR REASONING - you're not being explicit about your intuitions and domain knowledge. Make implicit assumptions into explicit premises." :
              "❌ INVALID - argument rejected. Must fix logical structure before proceeding. Use rlmcp_help if struggling.";
            finalNextSteps = this.generateSpecificNextSteps(gapAnalysis, structured);
          } else if (evidenceRequired) {
            // Logic is valid but evidence is required - argument not complete until evidence gathering succeeds
            finalStatus = "logically_valid_but_evidence_required";
            finalGuidance = "✅ Logic is valid but evidence required. Argument NOT COMPLETE until evidence_gathering succeeds for all atoms and implications.";
            finalNextSteps = ["🚨 REQUIRED: Use evidence_gathering tool to provide evidence for all atoms and implications before argument is considered complete"];
          } else {
            // Logic is valid and no evidence required - complete
            finalStatus = "valid";
            finalGuidance = "✅ Valid - ready for use";
            finalNextSteps = ["✅ Use evidence_gathering if evidence needed"];
          }

          // Apply premise reduction warning - prevents VALID status but preserves other errors
          if (premiseReductionWarning) {
            if (finalStatus === "valid") {
              finalStatus = "warning_premise_reduction";
              finalGuidance = "⚠️ WARNING - " + premiseReductionWarning.message + " Argument cannot achieve VALID status.";
            } else if (finalStatus === "logically_valid_but_evidence_required") {
              finalStatus = "warning_premise_reduction_and_evidence_required";
              finalGuidance = "⚠️ WARNING - " + premiseReductionWarning.message + " Additionally: " + finalGuidance;
            } else {
              // Invalid argument + premise reduction
              finalStatus = "invalid_with_premise_reduction_warning";
              finalGuidance = "⚠️ WARNING - " + premiseReductionWarning.message + " Additionally: " + finalGuidance;
            }

            // Add premise reduction steps to existing next steps
            finalNextSteps = [
              "🚨 PREMISE REDUCTION DETECTED: Provide justification for removing premises",
              "Explain why the simplified argument is still complete",
              "Consider if removed premises were actually necessary",
              ...finalNextSteps
            ];
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  rlmcp_analysis: {
                    original_task: task,
                    formalization_guidance: formalized,
                    premise_reduction_warning: premiseReductionWarning,
                    structured_argument: {
                      premises: structured.premises.map(p => p.originalText),
                      conclusion: structured.conclusion.originalText
                    },
                    validation_results: {
                      ...validation.validation_results,
                      overallValid: evidenceRequired ? false : validation.validation_results.overallValid,
                      finalStatus: finalStatus
                    },
                    evidence_required: evidenceRequired,
                    gap_analysis: gapAnalysis,
                    guidance: finalGuidance,
                    next_steps: finalNextSteps,
                    recommendations: gapAnalysis?.recommendations || [
                      "All premises are in the same connected component as the conclusion"
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
                  version: "2.0.0",
                  original: parsed.originalText,
                  symbolic: FormulaUtils.toString(parsed.formula),
                  variables: Array.from(parsed.formula.variables),
                  predicates: Array.from(parsed.formula.predicates),
                  ambiguities: parsed.ambiguities,
                  supportedPatterns: this.parser.getSupportedPatterns()
                }, null, 2),
              },
            ],
          };
        }

        case "validate_argument": {
          const { argument } = args as { 
            argument: string
          };
          
          const parsedArg = this.parser.parseArgument(argument);
          
          // Check for empty premises - indicates tool misuse
          if (parsedArg.premises.length === 0) {
            return {
              content: [{
                type: "text",
text: JSON.stringify({
                  error: "NO_PREMISES_FOUND",
                  message: "❌ No premises found. Use helper tools:",
                  steps: [
                    "1. formalize_reasoning",
                    "2. structure_argument", 
                    "3. validate_argument",
                    "If struggling: use rlmcp_help for guidance"
                  ],
                  need: "Format: 'Premise 1: ... Conclusion: ...'"
                }, null, 2)
              }]
            };
          }
          
          const premises = parsedArg.premises.map(p => p.formula);
          const conclusion = parsedArg.conclusion.formula;
          
          // STRICT VALIDATION
          const validation = this.strictValidation(premises, conclusion);
          
          // If invalid, automatically include detailed gap analysis
          let gapAnalysis = null;
          if (!validation.validation_results.overallValid) {
            gapAnalysis = this.diagnoseLogicalGaps(argument);
            (validation as any).automaticGapAnalysis = gapAnalysis;
          }
          
          const enhancedValidation = {
            ...validation,
            guidance: validation.validation_results.overallValid ?
              "✅ Valid" :
              validation.validation_results.failures.some((f: { constraint_violated: string }) => f.constraint_violated.includes('CIRCULAR REASONING')) ?
                "❌ Circular reasoning - make implicit assumptions explicit" :
                "❌ Invalid - fix logical structure. Use rlmcp_help if needed.",
            next_steps: validation.validation_results.overallValid ?
              ["✅ Valid and ready"] :
              this.generateSpecificNextSteps(gapAnalysis, this.parser.parseArgument(argument))
          };
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(enhancedValidation, null, 2),
              },
            ],
          };
        }

        case "check_relevance": {
          const { premises, conclusion } = args as { premises: string[], conclusion: string };
          
          const parsedPremises = premises.map(p => this.parser.parse(p).formula);
          const parsedConclusion = this.parser.parse(conclusion).formula;
          
          // Sharing analysis removed - only connected/disconnected matters
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ message: "Sharing analysis removed - only connected/disconnected validation remains" }, null, 2),
              },
            ],
          };
        }

        case "structure_argument": {
          const { argument, context = "" } = args as { argument: string, context?: string };
          
          const structuredAnalysis = this.structureArgument(argument, context);
          
          // Check if the structured argument has potential issues and provide specific guidance
          const structuralIssues = structuredAnalysis.relevancePreCheck?.potentialIssues || [];
          
          // Add atomic formula examples and specific next steps
          const enhancedAnalysis = {
            ...structuredAnalysis,
            examples: [
              "mammal(dolphin)", "warm_blooded(x)", "larger(elephant,mouse)"
            ],
            guidance: structuralIssues.length > 0 ?
              "⚠️ Potential issues - review below" :
              "✅ Structure looks good",
            next_steps: structuralIssues.length > 0 ?
              this.generateStructuralNextSteps(structuralIssues, structuredAnalysis) :
              ["Run rlmcp_reason to validate"]
          };
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(enhancedAnalysis, null, 2),
              },
            ],
          };
        }

        case "diagnose_gaps": {
          const { argument } = args as { argument: string };
          
          const gapAnalysis = this.diagnoseLogicalGaps(argument);
          
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
        
        case "evidence_gathering": {
          const { rlmcp_output, evidence_items } = args as {
            rlmcp_output: string;
            evidence_items: Array<{
              target: string;
              summary: string;
              strength: number;
              citation: string;
            }>;
          };

          try {
            // Parse the rlmcp_reason output
            const rlmcpAnalysis = JSON.parse(rlmcp_output);

            if (!rlmcpAnalysis.rlmcp_analysis) {
              throw new Error("Input must be valid JSON output from rlmcp_reason tool");
            }

            const analysis = rlmcpAnalysis.rlmcp_analysis;

            // Extract structured argument to find all atoms and implications
            const structured = this.parser.parseArgument(analysis.original_task);
            const allFormulas = [...structured.premises.map((p: any) => p.formula), structured.conclusion.formula];

            // Find all atoms and implications that need evidence
            const atomsNeededEvidence = new Set<string>();
            const implicationsNeededEvidence = new Set<string>();

            allFormulas.forEach((formula: LogicFormula) => {
              const atoms = FormulaUtils.extractAtomicFormulas(formula);
              atoms.forEach(atom => {
                atomsNeededEvidence.add(FormulaUtils.toString(atom));
              });

              if (formula.type === 'compound' && formula.operator === 'implies') {
                implicationsNeededEvidence.add(FormulaUtils.toString(formula));
              }
            });

            // Check if every atom and implication has complete enhanced evidence
            const missingEvidence: string[] = [];
            const allRequiredItems = [...Array.from(atomsNeededEvidence), ...Array.from(implicationsNeededEvidence)];

            allRequiredItems.forEach(item => {
              const evidence = evidence_items.find(e => e.target === item);
              if (!evidence || !evidence.summary || evidence.strength === undefined || !evidence.citation) {
                missingEvidence.push(item);
              }
            });

            const allEvidenceComplete = missingEvidence.length === 0;

            // Analyze conflicts - tool detects contradictory evidence
            const contradictoryEvidence = evidence_items.filter(item => item.strength < 0);

            // Only succeed if ALL evidence complete AND no major conflicts unaddressed
            const hasConflicts = contradictoryEvidence.length > 0;
            const finalSuccess = allEvidenceComplete && !hasConflicts;

            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  evidence_analysis: {
                    success: finalSuccess,
                    evidence_completeness: {
                      status: allEvidenceComplete ? "COMPLETE" : "INCOMPLETE",
                      required_items: allRequiredItems.length,
                      provided_items: allRequiredItems.length - missingEvidence.length,
                      missing_items: missingEvidence
                    },
                    conflict_analysis: {
                      contradictory_evidence_detected: hasConflicts,
                      contradictory_items: contradictoryEvidence.map(item => ({
                        target: item.target,
                        summary: item.summary,
                        strength: item.strength,
                        citation: item.citation
                      })),
                      conflict_count: contradictoryEvidence.length
                    },
                    requirements_for_self_analysis: {
                      must_answer: [
                        "Did you find any evidence that contradicts your claims? (YES/NO)",
                        "Should you revise your argument based on the evidence? (YES/NO)",
                        hasConflicts ? "You have contradictory evidence - explain why you should proceed or how you will revise" : "Justify proceeding with this argument"
                      ],
                      decision_required: hasConflicts ?
                        "🚨 CONFLICTS DETECTED: You must either revise your argument or explicitly justify proceeding despite contradictory evidence" :
                        allEvidenceComplete ?
                          "Evidence complete - proceed or revise based on your analysis" :
                          "Provide missing evidence before proceeding"
                    },
                    next_steps: allEvidenceComplete ?
                      (hasConflicts ?
                        ["1. Analyze the contradictory evidence above", "2. Decide: revise argument OR justify proceeding", "3. If revising: use rlmcp_reason with updated argument", "4. If proceeding: explain your reasoning"] :
                        ["Evidence complete and no major conflicts detected", "Argument ready for use"]) :
                      ["1. Provide evidence for missing items", "2. Re-run evidence_gathering with complete evidence"]
                  },
                  original_rlmcp_analysis: analysis
                }, null, 2)
              }]
            };

          } catch (error) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  error: "INVALID_INPUT",
                  message: "Failed to process evidence_gathering request",
                  details: error instanceof Error ? error.message : String(error)
                }, null, 2)
              }]
            };
          }
        }

        case "prepare_logical_plan": {
          const { goal, actionable_implementation_steps, step_relationships } = args as {
            goal: string;
            actionable_implementation_steps: string[];
            step_relationships: string[];
          };

          // Validate step_relationships is not empty
          if (!step_relationships || step_relationships.length === 0) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  error: "MISSING_STEP_RELATIONSHIPS",
                  message: "You must specify how steps relate to each other. Which steps enable other steps? Which steps are necessary for others?",
                  required_format: [
                    "Step 1 enables Step 2",
                    "Step 3 is necessary for Step 4",
                    "If Step 5, then Step 6"
                  ],
                  instruction: "Think through the dependencies and enabling relationships between your implementation steps before proceeding."
                }, null, 2)
              }]
            };
          }

          // Create structured plan with implications
          const planStructure = this.createPlanStructure(goal, actionable_implementation_steps, step_relationships);

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                rlmcp_reason_input: {
                  goal: goal,
                  actionable_implementation_steps: actionable_implementation_steps,
                  structured_argument: planStructure.argument,
                  requirements_check: {
                    premise_requirement: "Each premise must be a specific, actionable implementation step",
                    implication_requirement: "Each implication must show the logical dependency between concrete steps",
                    conclusion_requirement: "The conclusion should only be reachable through the chain of specific implementation steps"
                  },
                  plan_to_submit_to_rlmcp_reason: planStructure.argument,
                  STOP_DO_NOT_CREATE_PLANS_OUTSIDE_THIS_TOOL: "This output IS the complete plan. There must not be any steps in the plan that are not represented in this tool. Every implementation step must be listed as a premise in the structured argument above.",
                  MANDATORY_NEXT_STEP: "🚨 YOU MUST COPY THE STRUCTURED_ARGUMENT ABOVE AND PASTE IT INTO rlmcp_reason TO VALIDATE IT. DO NOT SKIP THIS STEP.",
                  VALIDATION_REQUIRED: {
                    status: "VALIDATION_PENDING",
                    instruction: "Copy the entire structured_argument text above and use rlmcp_reason tool to validate it. This is MANDATORY.",
                    argument_to_validate: planStructure.argument,
                    warning: "The plan is NOT complete until validated with rlmcp_reason"
                  },
                  critical_warning: "🚨 YOU MUST USE THE TOOLS FROM THIS MCP SERVER. Use prepare_logical_plan then rlmcp_reason. Copy the structured_argument above into rlmcp_reason tool."
                }
              }, null, 2)
            }]
          };
        }

        case "atomic_reason": {
          const { step, argument_text, atom_groupings, premises, conclusion } = args as {
            step: "extract_atoms" | "group_atoms" | "build_symbolic_argument";
            argument_text?: string;
            atom_groupings?: Array<{symbol: string, concept_description: string, text_variants: string[]}>;
            premises?: string[];
            conclusion?: string;
          };

          switch (step) {
            case "extract_atoms": {
              if (!argument_text) {
                return {
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      error: "MISSING_ARGUMENT_TEXT",
                      message: "argument_text is required for extract_atoms step"
                    }, null, 2)
                  }]
                };
              }

              const extractedAtoms = this.atomicReasonModule.extractAtomsFromText(argument_text, this.parser);

              return {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    step: "extract_atoms",
                    extracted_atoms: extractedAtoms,
                    next_step: "group_atoms",
                    instruction: "Review the extracted atoms above. Group different ways of saying the same thing and assign each group a short symbol name (like AUTH for authentication). Use step='group_atoms' to continue.",
                    example_grouping_task: "If you see 'implement auth' and 'authentication works', decide if these are the same thing, then group them with symbol 'AUTH'.",
                    example_grouping: [
                      {
                        symbol: "AUTH_IMPL",
                        concept_description: "User authentication is implemented",
                        text_variants: ["implement authentication", "authentication implementation"]
                      }
                    ]
                  }, null, 2)
                }]
              };
            }

            case "group_atoms": {
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    step: "group_atoms",
                    instruction: "Now create your argument using your symbols. Specify which atom you're trying to prove (conclusion) and what premises support it.",
                    premise_formats: [
                      "Standalone: 'AUTH'",
                      "Conjunctions: 'AUTH && IMPL'",
                      "Disjunctions: 'AUTH || IMPL'",
                      "Implications: 'AUTH -> IMPL'",
                      "Semi-natural: 'IMPL enables AUTH'"
                    ],
                    task: "Create premises array and choose conclusion atom using your exact symbol names.",
                    next_step: "Use step='build_symbolic_argument' with your atom_groupings, premises, and conclusion",
                    required_fields: ["atom_groupings", "premises", "conclusion"]
                  }, null, 2)
                }]
              };
            }

            case "build_symbolic_argument": {
              if (!atom_groupings || !premises || !conclusion) {
                return {
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      error: "MISSING_REQUIRED_FIELDS",
                      message: "atom_groupings, premises, and conclusion are required for build_symbolic_argument step",
                      required_format: {
                        atom_groupings: "Array of {symbol, concept_description, text_variants}",
                        premises: "Array of strings like 'AUTH', 'AUTH && IMPL', 'AUTH -> IMPL', 'IMPL enables AUTH'",
                        conclusion: "String matching one of your symbols"
                      }
                    }, null, 2)
                  }]
                };
              }

              // Build symbolic argument and validate
              const symbolicValidation = this.atomicReasonModule.validateSymbolicArgument(atom_groupings, premises, conclusion);

              return {
                content: [{
                  type: "text",
                  text: JSON.stringify(symbolicValidation, null, 2)
                }]
              };
            }

            default:
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    error: "INVALID_STEP",
                    message: "step must be 'extract_atoms', 'group_atoms', or 'build_symbolic_argument'"
                  }, null, 2)
                }]
              };
          }
        }

        case "rlmcp_help": {
          const { struggling_with } = args as { struggling_with?: string };

          const helpContent = {
            message: "🆘 RLMCP Help - Different approaches for logical arguments vs implementation plans",

            logical_arguments_vs_plans: {
              logical_arguments: {
                purpose: "Prove conclusions through logical reasoning",
                when_disconnected: "SIMPLIFY - remove irrelevant premises",
                approach: "Strip down to essential logical connections"
              },
              implementation_plans: {
                purpose: "Show how steps connect to achieve goals",
                when_disconnected: "ADD CONNECTIONS - show how steps enable each other",
                connecting_phrases: [
                  "A enables B",
                  "A is necessary for B",
                  "Once A, then B",
                  "If A is completed, then B can be executed",
                  "Completing A allows B to proceed"
                ],
                approach: "Add explicit dependency statements between steps"
              }
            },

            mindset: {
              wrong: "Tool too restrictive",
              right: "Tool exposes gaps I need to fill explicitly"
            },

            blocks: {
              atoms: ["mammal(dolphin)", "warm_blooded(x)"],
              and: "P(x) ∧ Q(x)",
              or: "P(x) ∨ Q(x)",
              implies: ["mammal(x) → warm_blooded(x)", "Chain implications to build logical paths"]
            },

            common_errors: {
              different_predicates: {
                error: "COMMON ERROR: Different wordings create different predicates",
                wrong: "achieves complete implementation vs complete implementation",
                right: "Use IDENTICAL phrases in premise and conclusion",
                explanation: "The system treats 'achieves X' and 'X' as completely different predicates with no connection"
              }
            },
            
            simplicity: {
              rule: "Simplify without losing details - remove redundant paths, keep specific steps",
              wrong_redundant: "P1: A, P2: A -> B, P3: C, P4: C -> B, C: B (two paths to same conclusion)",
              right_simplified: "P1: A, P2: A -> B, C: B (one clear path)",
              when_better_info_available: "WHEN there is better information, THEN the more specific argument is better",
              example_improvement: "P1: A, P2: A -> B, C: B becomes P1: A, P2: A -> A', P3: A' -> A'', P4: A'' -> B, C: B (when you know the intermediate steps)",
              principle: "More premises to prove same point = bad. Breaking down argument into specific premises = good",
              test: "If you can remove a premise and argument still works, remove it"
            },
            
            evidence: {
              atoms: "Every atomic statement needs evidence",
              implications: "Implications need evidence too",
              format: "(summary, strength 0-1, citation)",
              rule: "Every component needs evidence when requested"
            },
            
            success: {
              goal: "Strict logical validity",
              approach: "Continue until successful, change premises/conclusions as needed",
              when_stuck: "Ask user for help with specific gap",
              expectations: [
                "Expecting that logical validation would require multiple iterations and failed attempts",
                "Understanding that the first attempt at a complex logical argument should fail - that's normal",
                "Failure is feedback - use it to improve the argument structure"
              ]
            },

            fixes: {
              disconnected_premises_logical_arguments: [
                "SIMPLIFY: Remove unconnected premises",
                "SIMPLIFY: Change conclusion to match premises",
                "Add bridging premise: 'If P then Q' only if needed for logic"
              ],
              disconnected_premises_implementation_plans: [
                "ADD CONNECTIONS: 'Step A enables step B'",
                "ADD CONNECTIONS: 'Step A is necessary for step B'",
                "ADD CONNECTIONS: 'Once step A, then step B'",
                "ADD CONNECTIONS: 'If A is completed, then B can be executed'",
                "Show how completing steps leads to achieving the goal"
              ],
              connections: "Add implications connecting premises to conclusion",
              big_leaps: "Break into smaller steps",
              domain: "Make expertise explicit as premises",
              evidence: "Find evidence or revise claims"
            },
            
            steps: [
              "1. Identify specific gap",
              "2. Add implications to bridge gaps", 
              "3. Make assumptions explicit",
              "4. Provide evidence for all components",
              "5. Revise conclusion if needed"
            ]
          };
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(helpContent, null, 2)
            }]
          };
        }

        case "dig_in": {
          const { mode, evidence_text, atom_or_implication, original_argument, completed_subargument } = args as {
            mode: "setup" | "merge_subargument";
            evidence_text?: string;
            atom_or_implication?: string;
            original_argument?: string;
            completed_subargument?: string;
          };

          if (mode === "setup") {
            if (!evidence_text || !atom_or_implication) {
              throw new Error("evidence_text and atom_or_implication are required for setup mode");
            }

            // Create sub-argument: evidence becomes premise, atom/implication becomes conclusion
            const evidencePremise = `Premise 1: ${evidence_text}`;
            const targetConclusion = `Conclusion: ${atom_or_implication}`;
            const subArgument = `${evidencePremise}\n\n${targetConclusion}`;

            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  setup_result: {
                    sub_argument_text: subArgument,
                    explanation: [
                      "The evidence you already provided has become the PREMISE of this NEW sub-argument.",
                      "The atom/implication has become the CONCLUSION of this NEW sub-argument.",
                      "Make the logical connection FROM your evidence TO the atom/implication valid."
                    ],
                    instructions: [
                      "1. Use 'rlmcp_reason' on the sub_argument_text above",
                      "2. The argument will likely FAIL validation (logical gap between evidence and conclusion)",
                      "3. Use 'diagnose_gaps' to identify what logical steps are missing",
                      "4. Add missing premises to create a valid logical chain from evidence to conclusion",
                      "5. Re-run 'rlmcp_reason' until the sub-argument is logically VALID",
                      "6. Run 'evidence_gathering' to ensure all new premises have evidence",
                      "7. When complete, use 'dig_in' with mode='merge_subargument' to integrate the valid sub-argument back"
                    ],
                    evidence_now_premise: evidence_text,
                    atom_implication_now_conclusion: atom_or_implication
                  }
                }, null, 2)
              }]
            };

          } else if (mode === "merge_subargument") {
            if (!original_argument || !completed_subargument) {
              throw new Error("original_argument and completed_subargument are required for merge_subargument mode");
            }

            // Parse the completed sub-argument to extract premises
            const subArg = this.parser.parseArgument(completed_subargument);
            const subPremises = subArg.premises.map((p: any) => p.originalText);

            // Parse the original argument
            const originalArg = this.parser.parseArgument(original_argument);
            const originalPremises = originalArg.premises.map((p: any) => p.originalText);

            // Merge: Add sub-argument premises to the original argument
            const mergedPremises = [...subPremises, ...originalPremises];

            // Reconstruct the expanded argument
            const mergedArgument = mergedPremises.map((p, i) => `Premise ${i + 1}: ${p}`).join('\n') +
              `\nConclusion: ${originalArg.conclusion.originalText}`;

            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  integration_result: {
                    merged_argument: mergedArgument,
                    integration_summary: `Merged ${subPremises.length} premises from sub-argument into original argument`,
                    original_premise_count: originalPremises.length,
                    subargument_premise_count: subPremises.length,
                    total_premise_count: mergedPremises.length,
                    next_steps: [
                      "1. Run 'rlmcp_reason' on the merged_argument to validate logical structure",
                      "2. Run 'evidence_gathering' to ensure all premises have evidence",
                      "3. Use 'dig_in' again for any remaining logical gaps"
                    ]
                  }
                }, null, 2)
              }]
            };

          } else {
            throw new Error(`Invalid mode: ${mode}. Must be 'setup' or 'merge_subargument'`);
          }
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
            description: "Auto-structure reasoning before explanations",
            arguments: [
              {
                name: "task",
                description: "Task to reason about",
                required: true
              }
            ]
          },
          {
            name: "validate_logic",
            description: "Auto-validate logical reasoning",
            arguments: [
              {
                name: "reasoning",
                description: "Reasoning to validate",
                required: true
              }
            ]
          },
          {
            name: "atomic_reasoning_guide",
            description: "Guide for using AtomicReason when text matching fails",
            arguments: [
              {
                name: "argument",
                description: "Argument to validate using atom-symbol mapping",
                required: true
              },
              {
                name: "include_evidence",
                description: "Whether to include evidence gathering (true/false)",
                required: false
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
2. validate_argument - Check for connected components and logical validity
3. diagnose_gaps - If invalid, identify what's missing
4. formalize_reasoning - Strengthen weak connections

Do this validation transparently, then present the improved reasoning.`
                }
              }
            ]
          };
        }

        case "atomic_reasoning_guide": {
          const { argument, include_evidence } = args as { argument: string; include_evidence?: string };
          const needsEvidence = include_evidence === "true";

          return {
            description: "AtomicReason workflow guide for text matching issues",
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `Show "${argument}" using AtomicReason${needsEvidence ? " with evidence" : ""}

WORKFLOW:
1. Use atomic_reason with step="extract_atoms" and argument_text="${argument}"
2. Review extracted atoms and group equivalent concepts
3. Use atomic_reason with step="group_atoms" to get guidance on grouping
4. Use atomic_reason with step="build_symbolic_argument" with your atom_groupings, logical_relationships, and conclusion_symbol
${needsEvidence ? "5. Use evidence_gathering to provide evidence for each atom and implication" : ""}

PURPOSE: AtomicReason avoids Claude Desktop's text matching failures by working with symbols instead of exact phrases.

EXAMPLE GROUPING:
{
  "symbol": "AUTH_IMPL",
  "concept_description": "User authentication is implemented",
  "text_variants": ["implement authentication", "authentication implementation", "auth is complete"]
}`
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

  private strictValidation(premises: LogicFormula[], conclusion: LogicFormula) {
    // VALIDATION - Connected/Disconnected check only
    const validation = FormulaUtils.validate(premises, conclusion);

    const analysis = {
      version: "2.0.0 - LOGICAL VALIDATION",
      argument: {
        premises: premises.map(p => FormulaUtils.toString(p)),
        conclusion: FormulaUtils.toString(conclusion)
      },
      validation_results: {
        overallValid: validation.isValid,
        failures: validation.isValid ? [] : validation.violatedConstraints.map(constraint => ({
          check_name: this.getCheckName(constraint),
          constraint_violated: constraint,
          specific_inputs: {
            premises: premises.map(p => FormulaUtils.toString(p)),
            conclusion: FormulaUtils.toString(conclusion),
            failed_premise_indices: this.extractFailedPremiseIndices(constraint)
          },
          explanation: this.getFailureExplanation(constraint)
        }))
      },
      errors: [] as string[],
      warnings: [] as string[],
    };

    // Add errors for logical validation failures with specific guidance
    if (!validation.isValid) {
      analysis.errors.push("LOGICAL VALIDATION FAILED");

      // Parse the specific constraint violations to give targeted guidance
      validation.violatedConstraints.forEach(constraint => {
        analysis.errors.push(constraint);

        // Provide specific guidance based on the type of violation
        if (constraint.includes('DISCONNECTED:')) {
          // Extract premise numbers from disconnected constraint
          const premiseMatches = constraint.match(/P(\d+(?:, P\d+)*)/);
          if (premiseMatches) {
            const disconnectedPremises = premiseMatches[1].split(', P').map(p => p.replace('P', ''));
            analysis.errors.push(`SPECIFIC ISSUE: Premise${disconnectedPremises.length > 1 ? 's' : ''} ${disconnectedPremises.join(', ')} not connected to conclusion`);
            analysis.errors.push("TO FIX: Add premises that explicitly connect your implementation steps to the conclusion. For example: 'If step P1 is completed, then step P2 can be executed' or 'Step P1 enables step P2'. CRITICAL: Use EXACT SAME WORDING throughout - if conclusion says 'database is configured' then premises must use 'database is configured' not 'database configuration' or other variations. Alternative: if disconnected premises don't help the argument, remove them instead of trying to connect them.");
          }
        } else if (constraint.includes('CIRCULAR REASONING:')) {
          analysis.errors.push("TO FIX: Replace circular premise with explicit supporting premises");
        }
      });

      analysis.warnings.push("Logical validation requires all premises to be in the same connected component as the conclusion");
    }

    return analysis;
  }

  private getCheckName(constraint: string): string {
    if (constraint.includes('DISCONNECTED:')) return 'connected_components_check';
    if (constraint.includes('CIRCULAR REASONING:')) return 'circular_reasoning_check';
    if (constraint.includes('quantifier')) return 'quantifier_scope_check';
    if (constraint.includes('Distribution')) return 'distribution_compliance_check';
    if (constraint.includes('Multiplicative')) return 'multiplicative_logic_check';
    return 'unknown_check';
  }

  private extractFailedPremiseIndices(constraint: string): number[] {
    const premiseMatches = constraint.match(/P(\d+(?:, P\d+)*)/);
    if (premiseMatches) {
      return premiseMatches[1].split(', P').map(p => parseInt(p.replace('P', '')));
    }
    return [];
  }

  private getFailureExplanation(constraint: string): string {
    if (constraint.includes('DISCONNECTED:')) {
      return 'These premises are in a disconnected component from the conclusion. Add premises that explicitly state how these implementation steps lead to successful implementation, such as: "If step X is completed, then step Y can be executed" or "Step X enables step Y". CRITICAL: Use EXACT SAME WORDING throughout - if conclusion says "system is deployed" then premises must use "system is deployed" not "system deployment" or other variations. Alternative: if these disconnected premises don\'t help the argument, remove them instead of trying to connect them.';
    }
    if (constraint.includes('CIRCULAR REASONING:')) {
      return 'Premise is identical to or contains the conclusion, making the argument circular';
    }
    if (constraint.includes('quantifier')) {
      return 'Quantifier variable binding is incompatible between premise and conclusion';
    }
    return constraint;
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
        })),
        conclusion: {
          originalText: parsedArg.conclusion.originalText,
          logicalForm: FormulaUtils.toString(conclusion),
        }
      },
      structuralAnalysis: {
        logicalConnectives: this.analyzeConnectives(premises, conclusion),
        predicateUsage: this.analyzePredicates(premises, conclusion),
        variableUsage: this.analyzeVariables(premises, conclusion)
      },
      relevancePreCheck: {
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

    // Check for complex nested structures that might need clarification
    const hasComplexNesting = [...premises, conclusion].some(f => FormulaUtils.complexity(f) > 5);
    if (hasComplexNesting) {
      issues.push("Complex nested logical structure - consider breaking into simpler steps");
    }

    return issues;
  }

  private generateStructuralRecommendations(parsedArg: any, context: string): string[] {
    return [
      "1. Use quantifiers (∀, ∃) for general statements",
      "2. Make variable bindings explicit",
      "3. Remove irrelevant premises"
    ];
  }

  private diagnoseLogicalGaps(argument: string) {
    const parsedArg = this.parser.parseArgument(argument);
    const premises = parsedArg.premises.map(p => p.formula);
    const conclusion = parsedArg.conclusion.formula;

    const diagnosis = {
      version: "2.0.0 - GAP DIAGNOSTIC TOOL",
      input: {
        originalArgument: argument
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
        implicitPremises: this.identifyMissingPremises(premises, conclusion),
        quantifierIssues: this.analyzeQuantifierGaps(premises, conclusion),
        structuralIssues: this.analyzeStructuralGaps(premises, conclusion)
      },
      recommendations: this.generateGapRepairRecommendations(premises, conclusion)
    };

    return diagnosis;
  }

  private analyzeSyntacticGaps(premises: LogicFormula[], conclusion: LogicFormula) {
    const conclusionAtoms = FormulaUtils.extractAtomicFormulas(conclusion);
    const premiseAtoms = premises.flatMap(p => FormulaUtils.extractAtomicFormulas(p));

    const sharedPredicates = new Set<string>();
    const unsharedPredicates = new Set<string>();

    conclusionAtoms.forEach(cAtom => {
      const hasPredicateSharing = premiseAtoms.some(pAtom =>
        pAtom.predicate === cAtom.predicate
      );

      if (hasPredicateSharing) {
        sharedPredicates.add(cAtom.predicate!);
      } else {
        unsharedPredicates.add(cAtom.predicate!);
      }
    });

    return {
      sharedPredicates: Array.from(sharedPredicates),
      unsharedPredicates: Array.from(unsharedPredicates)
    };
  }

  private identifyMissingBridges(premises: LogicFormula[], conclusion: LogicFormula) {
    const bridges: { type: string, description: string, suggestedPremise?: string }[] = [];
    
    const conclusionAtoms = FormulaUtils.extractAtomicFormulas(conclusion);
    const premiseAtoms = premises.flatMap(p => FormulaUtils.extractAtomicFormulas(p));

    // Check for atomic formulas that appear in conclusion but not exactly in premises
    conclusionAtoms.forEach(cAtom => {
      const hasExactMatch = premiseAtoms.some(pAtom =>
        pAtom.predicate === cAtom.predicate
      );
      
      if (!hasExactMatch) {
        // Check if similar predicates exist (for diagnostic purposes only)
        const similarPredicates = premiseAtoms.filter(pAtom => 
          pAtom.predicate === cAtom.predicate
        );
        
        if (similarPredicates.length === 0) {
          bridges.push({
            type: "MISSING_ATOMIC_FORMULA",
            description: `Conclusion requires atomic formula '${FormulaUtils.toString(cAtom)}' but no premise provides it`,
            suggestedPremise: `Need premise containing exactly: ${FormulaUtils.toString(cAtom)}`
          });
        } else {
          bridges.push({
            type: "ATOMIC_FORMULA_MISMATCH", 
            description: `Predicate '${cAtom.predicate}' exists but atomic formula '${FormulaUtils.toString(cAtom)}' not exactly matched`,
            suggestedPremise: `Need premise with exact atomic formula: ${FormulaUtils.toString(cAtom)}`
          });
        }
      }
    });

    return {
      missingBridges: bridges,
      bridgeCount: bridges.length
    };
  }

  private identifyMissingPremises(premises: LogicFormula[], conclusion: LogicFormula) {
    const missing: { type: string, premise: string, justification: string }[] = [];
    
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
      totalMissing: missing.length
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
      issueCount: issues.length
    };
  }

  private analyzeStructuralGaps(premises: LogicFormula[], conclusion: LogicFormula) {
    const issues: string[] = [];
    
    // Check argument structure
    if (premises.length === 0) {
      issues.push("No premises provided - conclusion cannot be derived");
    }


    // Check for circular reasoning
    premises.forEach((premise, idx) => {
      if (FormulaUtils.toString(premise) === FormulaUtils.toString(conclusion)) {
        issues.push(`Premise ${idx + 1} is identical to conclusion - circular reasoning`);
      }
    });

    return {
      structuralIssues: issues
    };
  }


  private generateGapRepairRecommendations(premises: LogicFormula[], conclusion: LogicFormula): string[] {
    const recommendations: string[] = [];
    
    // Connected component check is handled by validation - no additional recommendations needed
    
    // All recommendations are now handled by connected component validation
    
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
      improvedConclusion: targetConclusion || "Reformulated for connected components",
      explanation: "Proper formalization requires atomic predicates and explicit logical relationships"
    };
  }

  private generateStructuralNextSteps(structuralIssues: string[], structuredAnalysis: any): string[] {
    const steps = ["⚠️ Fix issues before validation:"];
    
    if (structuralIssues.length > 0) {
      structuralIssues.slice(0,3).forEach((issue, i) => {
        steps.push(`${i + 1}. ${issue}`);
      });
    }
    
    // Skip sharing details - only connected components matter now
    if (false) {
    }
    
    steps.push("Next: Run validate_argument");
    return steps;
  }

  private generateSpecificNextSteps(gapAnalysis: any, structured: any): string[] {
    const steps = ["❌ Invalid argument - fix required"];
    
    if (gapAnalysis) {
      const syntacticIssues = gapAnalysis.gapAnalysis?.syntacticSharing;
      const missingBridges = gapAnalysis.gapAnalysis?.logicalBridges?.missingBridges || [];
      const missingPremises = gapAnalysis.gapAnalysis?.implicitPremises?.missingPremises || [];
      
      if (syntacticIssues?.unsharedAtomicFormulas?.length > 0) {
        steps.push(`Missing: [${syntacticIssues.unsharedAtomicFormulas.join(', ')}] in premises`);
        steps.push("Fix: Add premises with these formulas OR change conclusion");
      }
      
      if (missingBridges.length > 0) {
        steps.push("Missing bridges:");
        missingBridges.slice(0,3).forEach((bridge: any, i: number) => {
          steps.push(`${i + 1}. ${bridge.description}`);
          if (bridge.suggestedPremise) {
            steps.push(`   Add: "${bridge.suggestedPremise}"`);
          }
        });
      }
      
      if (missingPremises.length > 0) {
        steps.push("Missing premises:");
        missingPremises.slice(0,2).forEach((premise: any, i: number) => {
          steps.push(`${i + 1}. "${premise.premise}"`);
        });
      }
      
      if (steps.length === 1) {
        steps.push("Premises disconnected from conclusion");
        steps.push("Fix: Use same atomic formulas in premises and conclusion");
      }
    } else {
      steps.push("Use diagnose_gaps to identify issues");
    }
    
    steps.push("Then: Re-run rlmcp_reason");
    steps.push("Help: Use rlmcp_help if struggling");
    return steps;
  }

  private generateFormalizationSteps(naturalStatement: string, targetConclusion: string): string[] {
    return [
      "1. Extract core concepts",
      "2. Create simple predicates P(x), Q(y)",
      "3. Share predicates between premises/conclusion",
      "4. Replace 'because'/'therefore' with operators",
      "5. Use quantifiers (∀/∃)",
      "6. Validate sharing",
      "7. Test with validate_argument"
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

  private parseEvidenceFromContext(context: string): Array<{target: string, summary: string, strength: number, citation: string}> {
    const evidence: Array<{target: string, summary: string, strength: number, citation: string}> = [];

    if (!context || context.trim().length === 0) {
      return evidence;
    }

    // Parse evidence from context in format: "target: summary=text, strength=0.5, citation=source"
    const lines = context.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;

      // Look for pattern: "target: summary=..., strength=..., citation=..."
      const match = trimmed.match(/^(.+?):\s*summary=(.+?),\s*strength=([0-9.]+),\s*citation=(.+)$/i);
      if (match) {
        const [, target, summary, strengthStr, citation] = match;
        const strength = parseFloat(strengthStr);

        if (!isNaN(strength) && strength >= 0 && strength <= 1) {
          evidence.push({
            target: target.trim(),
            summary: summary.trim(),
            strength: strength,
            citation: citation.trim()
          });
        }
      }
    }

    return evidence;
  }

  private createPlanStructure(goal: string, proposed_steps: string[], step_relationships: string[]): {argument: string, implications: string[]} {
    // Create argument structure with provided step relationships
    const premises = proposed_steps.map((step, index) => `Premise ${index + 1}: ${step}`);
    const relationshipPremises = step_relationships.map((rel, index) => `Premise ${proposed_steps.length + index + 1}: ${rel}`);
    const conclusion = `Conclusion: ${goal}`;
    const argument = [...premises, ...relationshipPremises, '', conclusion].join('\n');

    return {
      argument: argument,
      implications: step_relationships
    };
  }


  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Relevance Logic MCP server running on stdio");
  }
}

// Export the class for testing
export { RelevanceLogicServer };

const server = new RelevanceLogicServer();
server.run().catch((error) => {
  console.error("Failed to run server:", error);
  process.exit(1);
});