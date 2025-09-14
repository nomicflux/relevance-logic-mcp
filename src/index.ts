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
import { LogicFormula, ValidationResult } from "./types.js";
import { EvidenceModule } from "./evidence/evidence-module.js";

class RelevanceLogicServer {
  private server: Server;
  private parser: NaturalLanguageParser;
  private evidenceModule: EvidenceModule;

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
            description: "Evidence gathering for logically valid arguments. Requires evidence for atoms and implications. Works with rlmcp_reason output.",
            inputSchema: {
              type: "object",
              properties: {
                rlmcp_output: {
                  type: "string",
                  description: "rlmcp_reason JSON output"
                },
                context: {
                  type: "string",
                  description: "Evidence context",
                  default: ""
                }
              },
              required: ["rlmcp_output"],
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
            description: "[USER-INITIATED ONLY] Expand specific evidence into sub-arguments. User must explicitly request and specify target requirement.",
            inputSchema: {
              type: "object",
              properties: {
                mode: {
                  type: "string",
                  enum: ["setup", "cleanup"],
                  description: "setup or cleanup mode"
                },
                evidence_output: {
                  type: "string",
                  description: "evidence_gathering output"
                },
                target_requirement_index: {
                  type: "number",
                  description: "Evidence requirement index"
                },
                completed_subargument: {
                  type: "string", 
                  description: "Completed sub-argument"
                }
              },
              required: ["mode", "target_requirement_index"]
            }
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
          
          const logicalStatus = validation.validation_results.overallValid ? "valid" : "invalid";

          const isCircular = validation.validation_results.failures.some((f: { constraint_violated: string }) => f.constraint_violated.includes('CIRCULAR REASONING'));
          const guidance = validation.validation_results.overallValid ? 
            "✅ Valid - ready for use" :
            isCircular ? 
              "❌ CIRCULAR REASONING - you're not being explicit about your intuitions and domain knowledge. Make implicit assumptions into explicit premises." :
              "❌ INVALID - argument rejected. Must fix logical structure before proceeding. Use rlmcp_help if struggling.";

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  rlmcp_analysis: {
                    original_task: task,
                    formalization_guidance: formalized,
                    structured_argument: {
                      premises: structured.premises.map(p => p.originalText),
                      conclusion: structured.conclusion.originalText
                    },
                    validation_results: validation.validation_results,
                    gap_analysis: gapAnalysis,
                    guidance: guidance,
                    next_steps: validation.validation_results.overallValid ? 
                      ["✅ Use evidence_gathering if evidence needed"] :
                      this.generateSpecificNextSteps(gapAnalysis, structured),
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
          const { rlmcp_output, context } = args as { rlmcp_output: string; context?: string };
          
          try {
            // Parse the rlmcp_reason output
            const rlmcpAnalysis = JSON.parse(rlmcp_output);
            
            // Verify it's valid rlmcp_reason output
            if (!rlmcpAnalysis.rlmcp_analysis) {
              throw new Error("Input must be valid JSON output from rlmcp_reason tool");
            }
            
            const analysis = rlmcpAnalysis.rlmcp_analysis;
            
            // Check logical validity first - evidence only applies to valid arguments
            if (analysis.validation_results && !analysis.validation_results.overallValid) {
              return {
                content: [{
                  type: "text",
text: JSON.stringify({
                    error: "LOGICAL_VALIDATION_FAILED",
                    message: "Fix logic first with rlmcp_reason. Use rlmcp_help if struggling.",
                    issues: analysis.gap_analysis || analysis.validation_results
                  }, null, 2)
                }]
              };
            }
            
            // Extract structured argument from original task - need to re-parse to get full structure
            const structured = this.parser.parseArgument(analysis.original_task);
            
            // Generate evidence requirements for all logical components
            const complianceReport = this.evidenceModule.enforceEvidenceCompliance({
              premises: structured.premises,
              conclusion: structured.conclusion,
              validation: { validation: analysis.validation_results }
            });
            
            // Return combined validation: BOTH logic AND evidence must pass
            const overallValid = analysis.validation_results.overallValid && complianceReport.isCompliant;
            
            const evidenceSummary = this.evidenceModule.generateComplianceSummary(complianceReport.requirements);
            
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  original_rlmcp_analysis: analysis,
                  evidence_analysis: {
                    overall_status: overallValid ? "valid_with_evidence" : (analysis.validation_results.overallValid ? "invalid_and_not_supported" : "invalid"),
                    progress: `${evidenceSummary.totalProvided}/${evidenceSummary.totalRequired} evidence provided`,
                    guidance: overallValid ? 
                      "✅ Success - valid with complete evidence" :
                      "❌ Incomplete - need both logic AND evidence. Use rlmcp_help if struggling.",
                    evidence_requirements: complianceReport.requirements.map(req => ({
                      type: req.type,
                      target: req.target,
                      description: req.description,
                      provided: req.provided,
                      evidence: req.evidence || null
                    })),
                    evidence_summary: evidenceSummary
                  }
                }, null, 2)
              }]
            };
            
          } catch (error) {
            return {
              content: [{
                type: "text", 
                text: JSON.stringify({
                  error: "INVALID_INPUT",
                  message: "Failed to parse rlmcp_reason output. Ensure input is valid JSON from rlmcp_reason tool.",
                  details: error instanceof Error ? error.message : String(error)
                }, null, 2)
              }]
            };
          }
        }

        case "rlmcp_help": {
          const { struggling_with } = args as { struggling_with?: string };
          
          const helpContent = {
            message: "🆘 RLMCP Help - This tool works with proper approach",
            
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
            
            simplicity: {
              rule: "Single premise + implication can be perfect",
              wrong: "6 premises comparing every feature",
              right: "P1: has_static_typing(ts), P2: static_typing_better_large_projects, C: ts_better_large_projects",
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
              when_stuck: "Ask user for help with specific gap"
            },
            
            fixes: {
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
          const { mode, evidence_output, target_requirement_index, completed_subargument } = args as { 
            mode: "setup" | "cleanup"; 
            evidence_output?: string; 
            target_requirement_index: number; 
            completed_subargument?: string 
          };

          if (mode === "setup") {
            // Setup mode: Extract evidence and create sub-argument
            if (!evidence_output) {
              throw new Error("evidence_output is required for setup mode");
            }

            try {
              const evidenceAnalysis = JSON.parse(evidence_output);
              if (!evidenceAnalysis.evidence_analysis?.evidence_requirements) {
                throw new Error("Invalid evidence_gathering output - missing evidence_requirements");
              }

              const requirements = evidenceAnalysis.evidence_analysis.evidence_requirements;
              if (target_requirement_index < 0 || target_requirement_index >= requirements.length) {
                return {
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      error: "INVALID_INDEX",
                      message: `Index ${target_requirement_index} out of range. Available indices: 0-${requirements.length - 1}`,
                      available_requirements: requirements.map((req: any, i: number) => ({
                        index: i,
                        type: req.type,
                        target: req.target,
                        provided: req.provided
                      }))
                    }, null, 2)
                  }]
                };
              }

              const targetRequirement = requirements[target_requirement_index];
              if (!targetRequirement.evidence) {
                return {
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      error: "NO_EVIDENCE",
                      message: `Requirement ${target_requirement_index} has no evidence to dig into yet. Provide evidence first.`,
                      requirement: targetRequirement
                    }, null, 2)
                  }]
                };
              }

              // Create sub-argument structure
              const evidencePremise = `Premise 1: ${targetRequirement.evidence.summary}`;
              const targetConclusion = `Conclusion: ${targetRequirement.target.replace(/[()]/g, '').replace(/→/g, 'implies').replace(/∧/g, 'and').replace(/∨/g, 'or')}`;
              const subArgument = `${evidencePremise}\n\n${targetConclusion}`;

              return {
                content: [{
                  type: "text", 
                  text: JSON.stringify({
                    setup_result: {
                      sub_argument_text: subArgument,
                      original_context: {
                        evidence_output: evidence_output,
                        target_requirement_index: target_requirement_index,
                        original_requirement: targetRequirement
                      },
                      instructions: [
                        "1. Use 'rlmcp_reason' on the sub_argument_text above",
                        "2. The argument will likely FAIL validation (logical gap between evidence and conclusion)",
                        "3. Use 'diagnose_gaps' to identify missing logical bridges", 
                        "4. Add missing premises to create a valid logical chain",
                        "5. Re-run 'rlmcp_reason' until the sub-argument is logically valid",
                        "6. Run 'evidence_gathering' to ensure all premises have evidence",
                        "7. When complete, use 'dig_in' with mode='cleanup' to integrate back"
                      ],
                      target_conclusion: targetRequirement.target,
                      evidence_strength: targetRequirement.evidence.strength,
                      evidence_citation: targetRequirement.evidence.citation
                    }
                  }, null, 2)
                }]
              };

            } catch (error) {
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    error: "INVALID_INPUT",
                    message: "Failed to parse evidence_gathering output",
                    details: error instanceof Error ? error.message : String(error)
                  }, null, 2)
                }]
              };
            }

          } else if (mode === "cleanup") {
            // Cleanup mode: Integrate completed sub-argument back into original
            if (!evidence_output || !completed_subargument) {
              throw new Error("evidence_output and completed_subargument are required for cleanup mode");
            }

            try {
              const evidenceAnalysis = JSON.parse(evidence_output);
              const originalAnalysis = evidenceAnalysis.original_rlmcp_analysis;
              
              if (!originalAnalysis) {
                throw new Error("Invalid evidence_gathering output - missing original_rlmcp_analysis");
              }

              // Parse the completed sub-argument to extract logical chain
              const subArg = this.parser.parseArgument(completed_subargument);
              const subPremises = subArg.premises.map((p: any) => p.originalText);

              // Extract the original argument premises
              const originalArg = this.parser.parseArgument(originalAnalysis.original_task);
              const originalPremises = originalArg.premises.map((p: any) => p.originalText);
              
              // Replace the target premise with the expanded logical chain
              const updatedPremises = [...originalPremises];
              
              // Find and replace the target premise with sub-argument premises
              const requirements = evidenceAnalysis.evidence_analysis.evidence_requirements;
              const targetRequirement = requirements[target_requirement_index];
              const targetText = targetRequirement.target.replace(/[()]/g, '').replace(/→/g, 'implies').replace(/∧/g, 'and').replace(/∨/g, 'or');
              
              // Replace with expanded premises from sub-argument
              updatedPremises.splice(target_requirement_index, 0, ...subPremises);

              // Reconstruct the argument
              const updatedArgument = updatedPremises.map((p, i) => `P${i + 1}. ${p}`).join('\n') + 
                `\nConclusion: ${originalArg.conclusion.originalText}`;

              return {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    integration_result: {
                      updated_argument: updatedArgument,
                      integration_summary: `Replaced premise ${target_requirement_index + 1} with ${subPremises.length} expanded premises from sub-argument`,
                      original_premise_count: originalPremises.length,
                      new_premise_count: updatedPremises.length,
                      expanded_premises: subPremises,
                      validation_status: "Integration complete - run 'rlmcp_reason' and 'evidence_gathering' to validate expanded argument"
                    }
                  }, null, 2)
                }]
              };

            } catch (error) {
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    error: "INTEGRATION_FAILED", 
                    message: "Failed to integrate completed sub-argument",
                    details: error instanceof Error ? error.message : String(error)
                  }, null, 2)
                }]
              };
            }

          } else {
            throw new Error(`Invalid mode: ${mode}. Must be 'setup' or 'cleanup'`);
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
            analysis.errors.push("TO FIX: Remove disconnected premises");
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
      return 'These premises are in a disconnected component from the conclusion and must be removed';
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