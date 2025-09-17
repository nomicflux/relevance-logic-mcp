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

class AtomicLogicServer {
  private server: Server;
  private parser: NaturalLanguageParser;
  private evidenceModule: EvidenceModule;
  private atomicReasonModule: AtomicReasonModule;

  constructor() {
    this.server = new Server(
      {
        name: "atomic-logic-mcp",
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
            description: "Validate evidence AND force analysis of conflicts. Provide evidence_items as ARRAY OF OBJECTS, each object containing: {target, summary, strength (-1 to 1, negative=contradicts, positive=supports, zero=neutral), citation}. Tool will analyze conflicts and present requirements for self-analysis. Only succeeds when ALL evidence complete. When evidence_gathering returns results, present the premises and evidence in the exact order shown in present_this_order_to_user. Each premise should be immediately followed by its supporting evidence before moving to the next premise.",
            inputSchema: {
              type: "object",
              properties: {
                atomic_reason_output: {
                  type: "string",
                  description: "atomic_reason JSON output from build_symbolic_argument step"
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
              required: ["atomic_reason_output", "evidence_items"],
            },
          },
          {
            name: "prepare_logical_plan",
            description: "Create a logical plan structure for validation with atomic_reason. Triggered by 'Plan to do X using atomic reasoning'. The argument you create IS the implementation plan. REQUIREMENTS: Each premise must be a specific, actionable implementation step. You must specify how steps relate to each other. Each implication must show the logical dependency between concrete steps. The conclusion should only be reachable through the chain of specific implementation steps.",
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
            name: "atomic_help",
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
            description: "[USER-INITIATED ONLY] When user says 'dig in to [atom/implication]': take the evidence already provided for that atom/implication as the new premise, take the atom/implication as the new conclusion, build valid logical chain between them. Example: If evidence 'Studies show correlation between smoking and lung disease' was provided for atom 'JS_MAINTENANCE_HARD', this creates sub-argument: P1: 'Studies show correlation between smoking and lung disease', C: 'JS_MAINTENANCE_HARD'. You must add missing logical steps to make this valid to strengthen your argument.",
            inputSchema: {
              type: "object",
              properties: {
                evidence_becomes_premise: {
                  type: "string",
                  description: "THE EVIDENCE TEXT ALREADY PROVIDED - this becomes the NEW PREMISE in the sub-argument. Example: 'Studies show correlation between smoking and lung disease'"
                },
                original_atom_becomes_conclusion: {
                  type: "string",
                  description: "THE ATOM OR IMPLICATION this evidence was provided for - this becomes the NEW CONCLUSION in the sub-argument. Example: 'JS_MAINTENANCE_HARD'"
                },
                original_argument: {
                  type: "string",
                  description: "The original structured argument as atomic_reason JSON output (for reference)"
                }
              },
              required: ["evidence_becomes_premise", "original_atom_becomes_conclusion", "original_argument"],
              additionalProperties: false
            }
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
                    "If struggling: use atomic_help for guidance"
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
                "❌ Invalid - fix logical structure. Use atomic_help if needed.",
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


        case "structure_argument": {
          const { argument, context = "" } = args as { argument: string, context?: string };
          
          const structuredAnalysis = this.structureArgument(argument, context);
          
          // Provide guidance for argument structure
          
          // Add atomic formula examples and specific next steps
          const enhancedAnalysis = {
            ...structuredAnalysis,
            examples: [
              "mammal(dolphin)", "warm_blooded(x)", "larger(elephant,mouse)"
            ],
            guidance: "✅ Structure looks good",
            next_steps: ["Run atomic_reason to validate"]
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
          const { atomic_reason_output, evidence_items } = args as {
            atomic_reason_output: string;
            evidence_items: Array<{
              target: string;
              summary: string;
              strength: number;
              citation: string;
            }>;
          };

          try {
            // Parse the atomic_reason output
            const atomicReasonAnalysis = JSON.parse(atomic_reason_output);

            if (!atomicReasonAnalysis.validation_result || !atomicReasonAnalysis.symbolic_argument) {
              throw new Error("Input must be valid JSON output from atomic_reason build_symbolic_argument step");
            }

            // Extract atoms and implications from atomic_reason output
            const symbolicArgument = atomicReasonAnalysis.symbolic_argument;
            const symbolDefinitions = atomicReasonAnalysis.symbol_definitions || {};

            // Get ALL atoms that need evidence from the argument
            const atomsNeededEvidence = new Set<string>();
            const implicationsNeededEvidence = new Set<string>();

            // Get atoms from symbol_definitions, but exclude the conclusion atom
            const conclusionAtom = symbolicArgument.conclusion?.replace(/^C:\s*/, '');

            Object.keys(symbolDefinitions).forEach(atom => {
              if (atom !== conclusionAtom) {
                atomsNeededEvidence.add(atom);
              }
            });

            // Add all premises as implications needing evidence (use the symbolic form)
            if (symbolicArgument && symbolicArgument.premises) {
              symbolicArgument.premises.forEach((premise: string) => {
                const cleanPremise = premise.replace(/^P\d+:\s*/, '');
                // Only add compound formulas (implications, conjunctions, disjunctions) as needing evidence
                if (cleanPremise.includes('→') || cleanPremise.includes('∧') || cleanPremise.includes('∨')) {
                  implicationsNeededEvidence.add(cleanPremise);
                }
              });
            }

            // Check if every atom and implication has complete evidence
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

            // Succeed if ALL evidence complete - conflicts are separate concern
            const hasConflicts = contradictoryEvidence.length > 0;
            const finalSuccess = allEvidenceComplete;


            // Create presentation order based on first appearance in premises
            const assignedEvidence = new Set<string>();
            const presentationOrder: any[] = [];

            if (symbolicArgument && symbolicArgument.premises) {
              symbolicArgument.premises.forEach((premise: string) => {
                const cleanPremise = premise.replace(/^P\d+:\s*/, '');
                const premiseNumber = premise.match(/^P(\d+):/)?.[1] || '';

                const evidenceForThisPremise: any[] = [];

                // Check for exact implication match first
                if (cleanPremise.includes('→') || cleanPremise.includes('∧') || cleanPremise.includes('∨')) {
                  const implicationEvidence = evidence_items.filter(e => e.target === cleanPremise);
                  if (implicationEvidence.length > 0 && !assignedEvidence.has(cleanPremise)) {
                    evidenceForThisPremise.push({
                      type: 'implication',
                      target: cleanPremise,
                      evidence: implicationEvidence
                    });
                    assignedEvidence.add(cleanPremise);
                  }
                }

                // Check for atoms in this premise (prefer lone atoms)
                const atoms = cleanPremise.match(/[A-Z_]+/g) || [];

                // First, check if this premise is a lone atom
                if (atoms.length === 1 && cleanPremise === atoms[0]) {
                  const atomEvidence = evidence_items.filter(e => e.target === atoms[0]);
                  if (atomEvidence.length > 0 && !assignedEvidence.has(atoms[0])) {
                    evidenceForThisPremise.push({
                      type: 'atom',
                      target: atoms[0],
                      definition: symbolDefinitions[atoms[0]],
                      evidence: atomEvidence
                    });
                    assignedEvidence.add(atoms[0]);
                  }
                }

                // Then check for atoms in conjunctions/disjunctions/implications
                atoms.forEach(atom => {
                  if (!assignedEvidence.has(atom)) {
                    const atomEvidence = evidence_items.filter(e => e.target === atom);
                    if (atomEvidence.length > 0) {
                      evidenceForThisPremise.push({
                        type: 'atom',
                        target: atom,
                        definition: symbolDefinitions[atom],
                        evidence: atomEvidence
                      });
                      assignedEvidence.add(atom);
                    }
                  }
                });

                presentationOrder.push({
                  premise: premise,
                  premise_number: premiseNumber,
                  premise_formula: cleanPremise,
                  evidence_items: evidenceForThisPremise
                });
              });
            }

            // Add conclusion
            presentationOrder.push({
              conclusion: symbolicArgument.conclusion,
              conclusion_symbol: conclusionAtom,
              conclusion_definition: symbolDefinitions[conclusionAtom || '']
            });

            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  ...(hasConflicts && {
                    "🚨 CONTRADICTORY_EVIDENCE_DETECTED": {
                      conflicting_evidence: contradictoryEvidence.map(item => ({
                        target: item.target,
                        summary: item.summary,
                        strength: item.strength,
                        citation: item.citation
                      })),
                      REQUIRED_CONFRONTATION: [
                        "Did you find any evidence that contradicts your claims? (YES/NO)",
                        "Should you revise your argument based on the evidence? (YES/NO)",
                        "You have contradictory evidence - explain why you should proceed or how you will revise"
                      ]
                    }
                  }),
                  present_this_order_to_user: {
                    presentation_instructions: "Present the premises and evidence in the exact order shown below. Each premise should be immediately followed by its supporting evidence before moving to the next premise.",
                    argument_flow: presentationOrder
                  },
                  evidence_validation: {
                    status: finalSuccess ? "VALID" : "INVALID",
                    evidence_complete: allEvidenceComplete,
                    missing_evidence: missingEvidence,
                    total_required: allRequiredItems.length,
                    total_provided: allRequiredItems.length - missingEvidence.length
                  },
                  original_atomic_reason_analysis: atomicReasonAnalysis,
                  PRESENTATION_SUMMARY: `Present ${presentationOrder.filter(item => item.premise).length} premises with their supporting evidence, followed by ${presentationOrder.filter(item => item.premise && item.evidence_items.some((e: any) => e.type === 'implication')).length} implications with their supporting evidence, followed by the conclusion.`
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
                atomic_reason_input: {
                  goal: goal,
                  actionable_implementation_steps: actionable_implementation_steps,
                  structured_argument: planStructure.argument,
                  requirements_check: {
                    premise_requirement: "Each premise must be a specific, actionable implementation step",
                    implication_requirement: "Each implication must show the logical dependency between concrete steps",
                    conclusion_requirement: "The conclusion should only be reachable through the chain of specific implementation steps"
                  },
                  MANDATORY_NEXT_STEP: "🚨 YOU MUST USE atomic_reason WITH THE EXACT PARAMETERS BELOW. DO NOT SKIP THIS STEP.",
                  atomic_reason_step_1: {
                    step: "extract_atoms",
                    argument_text: planStructure.argument
                  },
                  VALIDATION_REQUIRED: {
                    status: "VALIDATION_PENDING",
                    instruction: "Use atomic_reason tool with step='extract_atoms' and argument_text copied from above. This is MANDATORY.",
                    exact_call: `atomic_reason(step="extract_atoms", argument_text="${planStructure.argument}")`,
                    warning: "The plan is NOT complete until validated through atomic_reason workflow"
                  },
                  critical_warning: "🚨 YOU MUST USE atomic_reason WITH step='extract_atoms' and the argument_text above."
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

        case "atomic_help": {
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
          const { evidence_becomes_premise, original_atom_becomes_conclusion, original_argument } = args as {
            evidence_becomes_premise: string;
            original_atom_becomes_conclusion: string;
            original_argument: string;
          };

          if (!evidence_becomes_premise || !original_atom_becomes_conclusion) {
            throw new Error("evidence_becomes_premise and original_atom_becomes_conclusion are required");
          }

          // Validation: Reject if same text used for both premise and conclusion
          if (evidence_becomes_premise.trim() === original_atom_becomes_conclusion.trim()) {
            throw new Error("evidence_becomes_premise and original_atom_becomes_conclusion cannot be the same text");
          }

          // Create sub-argument: evidence becomes premise, atom/implication becomes conclusion
          const subArgumentText = `${evidence_becomes_premise}. Therefore, ${original_atom_becomes_conclusion}.`;

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                dig_in_result: {
                  atomic_reason_input: {
                    step: "extract_atoms",
                    argument_text: subArgumentText
                  },
                  explanation: [
                    "The evidence you already provided has become the PREMISE of this NEW sub-argument.",
                    "The atom/implication has become the CONCLUSION of this NEW sub-argument.",
                    "Make the logical connection FROM your evidence TO the atom/implication valid."
                  ],
                  instructions: [
                    "1. Use 'atomic_reason' with the exact input above",
                    "2. Follow the 3-step atomic_reason workflow (extract_atoms → group_atoms → build_symbolic_argument)",
                    "3. The argument will likely FAIL validation (logical gap between evidence and conclusion)",
                    "4. Add missing premises to create a valid logical chain from evidence to conclusion",
                    "5. Re-run 'atomic_reason' step 3 until the sub-argument is logically VALID",
                    "6. When complete, you have successfully 'dug in' to strengthen this part of your argument"
                  ],
                  evidence_now_premise: evidence_becomes_premise,
                  atom_implication_now_conclusion: original_atom_becomes_conclusion,
                  original_argument_reference: original_argument
                }
              }, null, 2)
            }]
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
                  text: `Before answering "${task}", use the atomic reasoning tools to:
1. Use formalize_reasoning to convert your initial thoughts into structured logical form
2. Use structure_argument to organize your reasoning into clear premises and conclusions  
3. Use validate_argument to ensure all premises connect to your conclusion
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

AUTOMATICALLY apply these atomic reasoning tools:
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
    
    steps.push("Then: Re-run atomic_reason");
    steps.push("Help: Use atomic_help if struggling");
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
    console.error("Atomic Logic MCP server running on stdio");
  }
}

// Export the class for testing
export { AtomicLogicServer };

const server = new AtomicLogicServer();
server.run().catch((error) => {
  console.error("Failed to run server:", error);
  process.exit(1);
});