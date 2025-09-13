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
import { LogicFormula, SystemRValidation } from "./types.js";
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
            description: "[HELPER TOOL] Only use when user explicitly requests argument validation. Works with rlmcp_reason to validate logical structure. Do not use proactively.",
            inputSchema: {
              type: "object",
              properties: {
                argument: {
                  type: "string",
                  description: "Logical argument with premises and conclusion",
                },
              },
              required: ["argument"],
            },
          },
          {
            name: "check_relevance",
            description: "[HELPER TOOL] Only use when user asks to check relevance. Works with rlmcp_reason for premise-conclusion analysis. Do not use proactively.",
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
            description: "[HELPER TOOL] Only use when user asks to structure an argument. Works with rlmcp_reason for argument organization. Do not use proactively.",
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
            description: "[HELPER TOOL] Only use when user asks to diagnose gaps or when rlmcp_reason validation fails. Works with rlmcp_reason for gap analysis. Do not use proactively.",
            inputSchema: {
              type: "object",
              properties: {
                argument: {
                  type: "string",
                  description: "Natural language argument to diagnose for System R compliance",
                },
              },
              required: ["argument"],
            },
          },
          {
            name: "formalize_reasoning",
            description: "[HELPER TOOL] Only use when user asks to formalize reasoning. Works with rlmcp_reason for logical formalization. Do not use proactively.",
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
          {
            name: "evidence_gathering",
            description: "Optional add-on tool for rlmcp_reason. Takes the structured logical output from rlmcp_reason and requires evidence for each atom and implication. Validates both logical structure AND evidence completeness.",
            inputSchema: {
              type: "object",
              properties: {
                rlmcp_output: {
                  type: "string",
                  description: "JSON output from rlmcp_reason containing structured logical analysis"
                },
                context: {
                  type: "string",
                  description: "Additional context for evidence gathering",
                  default: ""
                }
              },
              required: ["rlmcp_output"],
            },
          },
          {
            name: "rlmcp_help",
            description: "Get help when struggling with RLMCP logical validation or evidence gathering. Provides guidance on common issues and approaches.",
            inputSchema: {
              type: "object",
              properties: {
                struggling_with: {
                  type: "string",
                  description: "What specific aspect are you struggling with? (e.g., 'logical validity', 'evidence gathering', 'connecting premises', 'tool seems too restrictive')",
                  default: "general guidance"
                }
              },
              required: []
            }
          },
          {
            name: "dig_in",
            description: "[USER-INITIATED ONLY] Use ONLY when user explicitly asks to 'dig in' or strengthen specific evidence. Never use proactively. Requires user to specify which evidence requirement to expand.",
            inputSchema: {
              type: "object",
              properties: {
                mode: {
                  type: "string",
                  enum: ["setup", "cleanup"],
                  description: "Setup extracts evidence for sub-argument work. Cleanup integrates completed sub-argument back."
                },
                evidence_output: {
                  type: "string",
                  description: "JSON output from evidence_gathering tool (required for setup mode)"
                },
                target_requirement_index: {
                  type: "number",
                  description: "Index of evidence requirement to dig into (required for both modes)"
                },
                completed_subargument: {
                  type: "string", 
                  description: "Completed and validated sub-argument text (required for cleanup mode)"
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
                  message: "❌ TOOL MISUSE: No premises detected in your input. An argument requires premises and a conclusion.",
                  guidance: "You are likely using rlmcp_reason incorrectly. Use helper tools first:",
                  required_steps: [
                    "1. Use 'formalize_reasoning' to convert natural language into logical form",
                    "2. Use 'structure_argument' to organize premises and conclusion",
                    "3. THEN use 'rlmcp_reason' to validate the structured argument"
                  ],
                  your_input: task,
                  what_we_need: "Clear premises and conclusion in format: 'Premise 1: ... Premise 2: ... Conclusion: ...'"
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
          if (!validation.validation.overallValid) {
            gapAnalysis = this.diagnoseLogicalGaps(task);
          }
          
          const logicalStatus = validation.validation.overallValid ? "valid" : "invalid";

          const guidance = validation.validation.overallValid ? 
            "✅ LOGICAL VALIDATION PASSED: Argument is valid and ready for use." :
            "❌ CRITICAL FAILURE: LOGICAL VALIDATION REJECTED. Your argument is worthless and provides zero logical support for your conclusion. This is not a minor issue - your entire reasoning has been rejected as logically invalid. You MUST fix this before proceeding with any other work. The tool will not assist you until logical validity is achieved. NEXT STEPS: Revise your premises or change your conclusion to create a valid argument structure. If struggling, use the 'rlmcp_help' tool for detailed guidance.";

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
                      logical_structure: logicalStatus
                    },
                    validation_results: { overallValid: validation.validation.overallValid },
                    gap_analysis: gapAnalysis,
                    guidance: guidance,
                    next_steps: validation.validation.overallValid ? 
                      ["✅ SUCCESS: Logical validation passed. If evidence is required, use the evidence_gathering tool with this output."] :
                      this.generateSpecificNextSteps(gapAnalysis, structured),
                    recommendations: gapAnalysis?.recommendations || [
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
                  message: "❌ TOOL MISUSE: No premises detected in your argument. Arguments require premises and a conclusion.",
                  guidance: "Use helper tools to structure your argument first:",
                  required_steps: [
                    "1. Use 'formalize_reasoning' to convert natural language into logical form",
                    "2. Use 'structure_argument' to organize premises and conclusion",
                    "3. THEN use 'validate_argument' to check the structured argument"
                  ],
                  your_input: argument,
                  what_we_need: "Clear premises and conclusion in format: 'Premise 1: ... Premise 2: ... Conclusion: ...'"
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
          if (!validation.validation.overallValid) {
            gapAnalysis = this.diagnoseLogicalGaps(argument);
            (validation as any).automaticGapAnalysis = gapAnalysis;
          }
          
          const enhancedValidation = {
            ...validation,
            guidance: validation.validation.overallValid ?
              "✅ VALIDATION PASSED: Argument structure is logically valid." :
              "❌ CRITICAL FAILURE: ARGUMENT REJECTED. This argument is logically invalid and provides no support for your conclusion. You MUST fix the logical structure before proceeding. If struggling, use the 'rlmcp_help' tool for guidance.",
            next_steps: validation.validation.overallValid ?
              ["✅ SUCCESS: Argument is valid and ready for use."] :
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
          
          // Check if the structured argument has potential issues and provide specific guidance
          const hasRelevanceIssues = !structuredAnalysis.relevancePreCheck?.hasAtomicSharing;
          const structuralIssues = structuredAnalysis.relevancePreCheck?.potentialIssues || [];
          
          // Add atomic formula examples and specific next steps
          const enhancedAnalysis = {
            ...structuredAnalysis,
            atomic_formula_examples: {
              description: "Atomic formulas are the basic building blocks - simple predicate statements that cannot be broken down further",
              examples: [
                "mammal(dolphin) - 'dolphin is a mammal'",
                "warm_blooded(x) - 'x is warm-blooded'", 
                "larger(elephant, mouse) - 'elephant is larger than mouse'",
                "student(john) - 'john is a student'",
                "studies_hard(x) - 'x studies hard'"
              ],
              note: "These atomic formulas must appear EXACTLY in both premises and conclusion for valid relevance logic"
            },
            guidance: hasRelevanceIssues ?
              "⚠️ WARNING: This argument structure has potential logical issues that will likely cause validation failure. Review the identified issues below." :
              "✅ STRUCTURE LOOKS PROMISING: This argument structure appears to have proper atomic sharing for relevance logic.",
            next_steps: hasRelevanceIssues ?
              this.generateStructuralNextSteps(structuralIssues, structuredAnalysis) :
              ["Structure appears valid", "Run rlmcp_reason or validate_argument to confirm logical validity"]
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
                    message: "Evidence cannot be gathered for logically invalid arguments. Fix logical structure first using 'rlmcp_reason' tool, then return with valid output. If struggling with logical validity, use the 'rlmcp_help' tool.",
                    original_analysis: analysis,
                    logical_issues: analysis.gap_analysis || analysis.validation_results
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
                    progress: `Evidence provided for ${evidenceSummary.totalProvided}/${evidenceSummary.totalRequired} requirements`,
                    guidance: overallValid ? 
                      "✅ COMPLETE SUCCESS: Argument is logically valid with complete evidence support. Task completed successfully." :
                      "❌ CRITICAL FAILURE: TASK REJECTED. Full success requires BOTH logical validity AND complete evidence for every logical component. Your current work is INCOMPLETE and does not meet requirements. You MUST continue providing evidence for all missing components, or revise your argument structure. DO NOT CLAIM SUCCESS UNTIL BOTH CONDITIONS ARE MET. If struggling, use the 'rlmcp_help' tool for guidance.",
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
            message: "🆘 RLMCP Help - Don't Give Up! This tool can work with proper approach.",
            
            mindset_shift: {
              title: "❌ WRONG THINKING vs ✅ RIGHT THINKING",
              wrong: "This logical validity tool is too restrictive for real-world tasks",
              right: "If I struggle to fit my argument to the tool, there's something in my argument I'm not making explicit. I need to be clearer about my intuitions, domain knowledge, and assumptions.",
              key_point: "The tool exposes gaps in reasoning that need to be filled, not avoided."
            },
            
            logical_building_blocks: {
              title: "🧱 Basic Logical Building Blocks You Can Use:",
              atomic_facts: {
                description: "Simple statements about the world",
                examples: ["mammal(dolphin)", "warm_blooded(x)", "large_project(x)", "maintainable(typescript_code)"]
              },
              conjunctions: {
                description: "AND statements - both things are true",
                examples: ["P(x) ∧ Q(x) - 'x has both property P and property Q'"],
                usage: "Use when multiple conditions must be met"
              },
              disjunctions: {
                description: "OR statements - at least one thing is true", 
                examples: ["P(x) ∨ Q(x) - 'x has either property P or property Q (or both)'"],
                usage: "Use when multiple paths lead to the same conclusion"
              },
              implications: {
                description: "IF-THEN statements - the most important connector",
                examples: [
                  "mammal(x) → warm_blooded(x) - 'if x is a mammal, then x is warm-blooded'",
                  "large_project(x) → needs_structure(x) - 'if x is a large project, then x needs structure'",
                  "needs_structure(x) → typescript_better(x) - 'if x needs structure, then typescript is better for x'"
                ],
                critical_usage: "Use implications to connect premises to each other AND to your conclusion. Chain them together to build logical paths."
              }
            },
            
            evidence_gathering_guidance: {
              title: "📋 When Evidence is Required:",
              atoms_need_evidence: "Every atomic statement needs evidence: mammal(dolphin) needs proof that dolphins are mammals",
              implications_need_evidence: "⚠️ CRITICAL: Implications need evidence too! mammal(x) → warm_blooded(x) needs evidence that mammals are warm-blooded",
              evidence_format: "Each piece of evidence needs: (summary, strength 0-1, citation)",
              no_shortcuts: "There are no shortcuts - every logical component needs evidence when requested"
            },
            
            success_mindset: {
              title: "🎯 What Success Looks Like:",
              user_expectation: "If the user asked for this tool, they want STRICT LOGICAL VALIDITY. They do not want a half-done job.",
              your_job: "Continue until successful. Change premises and conclusions as needed to match what is actually supported by evidence and contains logically valid connections.",
              when_stuck: "If you cannot fill a logical gap, return to the user for help with that SPECIFIC gap. Don't give up - ask for clarification on the specific missing piece.",
              persistence: "The tool rewards persistence and precision, not shortcuts."
            },
            
            common_fixes: {
              title: "🔧 Common Solutions When Stuck:",
              missing_connections: "Add implication premises that connect your existing premises to your conclusion",
              too_big_a_leap: "Break down large logical jumps into smaller, more obvious steps",
              domain_knowledge: "Make your domain expertise explicit as premises rather than assuming it",
              evidence_gaps: "If evidence is missing, either find it or revise your claims to match available evidence",
              wrong_conclusion: "Sometimes the logic leads to a different conclusion than you started with - follow the logic!"
            },
            
            next_steps: [
              "1. Identify the specific gap or error message you're getting",
              "2. Use implications to bridge logical gaps between premises and conclusion", 
              "3. Make implicit assumptions explicit as premises",
              "4. If using evidence, provide evidence for EVERY atom and implication",
              "5. Be willing to revise your conclusion to match what the logic actually supports",
              "6. If truly stuck, ask the user for help with the specific missing piece"
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

  private strictValidation(premises: LogicFormula[], conclusion: LogicFormula) {
    // SYSTEM R TERNARY RELATION VALIDATION - This is the CORRECT implementation
    const systemRValidation = FormulaUtils.validateSystemR(premises, conclusion);
    
    const analysis = {
      version: "2.0.0 - SYSTEM R TERNARY RELATION SEMANTICS",
      argument: {
        premises: premises.map(p => FormulaUtils.toString(p)),
        conclusion: FormulaUtils.toString(conclusion)
      },
      validation: {
        overallValid: systemRValidation.isValid
      },
      errors: [] as string[],
      warnings: [] as string[],
      // Technical details removed - agent only needs to know valid/invalid
    };

    // Add errors for System R violations
    if (!systemRValidation.isValid) {
      analysis.errors.push("SYSTEM R VIOLATION: Argument fails ternary relation requirements");
      systemRValidation.violatedConstraints.forEach(constraint => {
        analysis.errors.push(constraint);
      });
      analysis.warnings.push("System R requires every premise to establish a ternary relation with the conclusion through shared atomic formulas");
    }

    return analysis;
  }

  private checkExactSyntacticSharing(premises: LogicFormula[], conclusion: LogicFormula): boolean {
    // Variable Sharing Principle (binary constraint):
    // EVERY premise must share at least one atomic formula with the conclusion
    // If ANY premise lacks sharing, the entire argument is invalid in relevance logic
    
    for (const premise of premises) {
      const hasSharing = FormulaUtils.hasExactAtomicSharing(premise, conclusion);
      if (!hasSharing) {
        return false; // Invalid: this premise is irrelevant to the conclusion
      }
    }
    
    return true; // Valid: all premises satisfy the variable sharing requirement
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
        };
      }),
      overallSharing: premises.some(premise => FormulaUtils.hasExactAtomicSharing(premise, conclusion))
    };

    return analysis;
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
    
    const hasAnyAtomicSharing = premiseAtoms.some(pAtom => 
      conclusionAtoms.some(cAtom => FormulaUtils.atomicFormulasIdentical(pAtom, cAtom))
    );
    
    if (!hasAnyAtomicSharing) {
      issues.push("No exact atomic formula sharing between premises and conclusion - System R violation");
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

  private diagnoseLogicalGaps(argument: string) {
    const parsedArg = this.parser.parseArgument(argument);
    const premises = parsedArg.premises.map(p => p.formula);
    const conclusion = parsedArg.conclusion.formula;

    const diagnosis = {
      version: "2.0.0 - SYSTEM R GAP DIAGNOSTIC TOOL",
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
    
    const unsharedAtoms = conclusionAtoms.filter(cAtom => 
      !premiseAtoms.some(pAtom => FormulaUtils.atomicFormulasIdentical(cAtom, pAtom))
    );

    const sharedPredicates = new Set<string>();
    const unsharedPredicates = new Set<string>();
    
    conclusionAtoms.forEach(cAtom => {
      const hasExactSharing = premiseAtoms.some(pAtom => 
        FormulaUtils.atomicFormulasIdentical(pAtom, cAtom)
      );
      
      if (hasExactSharing) {
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

    // Check for atomic formulas that appear in conclusion but not exactly in premises
    conclusionAtoms.forEach(cAtom => {
      const hasExactMatch = premiseAtoms.some(pAtom => 
        FormulaUtils.atomicFormulasIdentical(pAtom, cAtom)
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
      bridgeCount: bridges.length,
      criticalityLevel: bridges.some(b => b.type === "MISSING_ATOMIC_FORMULA") ? "HIGH" : 
                       bridges.length > 0 ? "MEDIUM" : "LOW"
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


  private generateGapRepairRecommendations(premises: LogicFormula[], conclusion: LogicFormula): string[] {
    const recommendations: string[] = [];
    
    const hasSharing = premises.some(p => FormulaUtils.hasExactAtomicSharing(p, conclusion));
    
    if (!hasSharing) {
      recommendations.push("CRITICAL: Add premises that share exact atomic formulas with the conclusion");
      recommendations.push("System R requires ternary relations - premises must connect to conclusion through shared content");
    }
    
    const conclusionAtoms = FormulaUtils.extractAtomicFormulas(conclusion);
    const premiseAtoms = premises.flatMap(p => FormulaUtils.extractAtomicFormulas(p));
    
    conclusionAtoms.forEach(cAtom => {
      const hasMatch = premiseAtoms.some(pAtom => 
        FormulaUtils.atomicFormulasIdentical(pAtom, cAtom)
      );
      
      if (!hasMatch) {
        recommendations.push(`Add premise containing exactly: ${FormulaUtils.toString(cAtom)}`);
      }
    });
    
    recommendations.push("All reasoning must be purely syntactic - no domain-specific rules allowed in System R");
    recommendations.push("Ensure exact variable identity between premises and conclusion");
    
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

  private generateStructuralNextSteps(structuralIssues: string[], structuredAnalysis: any): string[] {
    const steps = ["⚠️ STRUCTURAL ISSUES DETECTED - Fix before validation:"];
    
    if (structuralIssues.length > 0) {
      structuralIssues.forEach((issue, i) => {
        steps.push(`${i + 1}. ${issue}`);
      });
    }
    
    // Check for specific sharing issues
    const sharingDetails = structuredAnalysis.relevancePreCheck?.sharingDetails;
    if (sharingDetails) {
      const premisesWithoutSharing = sharingDetails.premiseAnalysis?.filter((p: any) => !p.hasExactSharing) || [];
      
      if (premisesWithoutSharing.length > 0) {
        steps.push("CRITICAL: These premises have no atomic sharing with conclusion:");
        premisesWithoutSharing.forEach((premise: any) => {
          steps.push(`  - Premise ${premise.premiseIndex + 1}: "${premise.premise}"`);
          steps.push(`    MISSING: Atomic formulas that connect to conclusion`);
        });
        steps.push("REQUIRED FIX: Revise premises to include atomic formulas that appear in your conclusion");
      }
    }
    
    steps.push("NEXT: After fixing these issues, run validate_argument or rlmcp_reason");
    return steps;
  }

  private generateSpecificNextSteps(gapAnalysis: any, structured: any): string[] {
    const steps = ["❌ STOP: Your argument has been REJECTED as logically invalid"];
    
    if (gapAnalysis) {
      // Add specific steps based on the actual gaps found
      const syntacticIssues = gapAnalysis.gapAnalysis?.syntacticSharing;
      const missingBridges = gapAnalysis.gapAnalysis?.logicalBridges?.missingBridges || [];
      const missingPremises = gapAnalysis.gapAnalysis?.implicitPremises?.missingPremises || [];
      
      if (syntacticIssues?.unsharedAtomicFormulas?.length > 0) {
        steps.push(`CRITICAL ISSUE: Your conclusion contains atomic formulas [${syntacticIssues.unsharedAtomicFormulas.join(', ')}] that don't appear in any premise`);
        steps.push("REQUIRED FIX: Add premises containing these exact atomic formulas OR change your conclusion to use only shared formulas");
      }
      
      if (missingBridges.length > 0) {
        steps.push("MISSING LOGICAL BRIDGES:");
        missingBridges.forEach((bridge: any, i: number) => {
          steps.push(`${i + 1}. ${bridge.description}`);
          if (bridge.suggestedPremise) {
            steps.push(`   SOLUTION: Add premise: "${bridge.suggestedPremise}"`);
          }
        });
      }
      
      if (missingPremises.length > 0) {
        steps.push("MISSING REQUIRED PREMISES:");
        missingPremises.forEach((premise: any, i: number) => {
          steps.push(`${i + 1}. Add: "${premise.premise}" (${premise.justification})`);
        });
      }
      
      if (steps.length === 1) { // Only the stop message was added
        steps.push("GENERAL ISSUE: No syntactic sharing between premises and conclusion");
        steps.push("REQUIRED FIX: Ensure your premises contain the same atomic formulas that appear in your conclusion");
      }
    } else {
      steps.push("REQUIRED ACTION: Use diagnose_gaps tool to identify specific logical issues");
    }
    
    steps.push("THEN: Re-run rlmcp_reason with your revised argument");
    steps.push("If struggling with these requirements, use the 'rlmcp_help' tool for detailed guidance");
    return steps;
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

// Export the class for testing
export { RelevanceLogicServer };

const server = new RelevanceLogicServer();
server.run().catch((error) => {
  console.error("Failed to run server:", error);
  process.exit(1);
});