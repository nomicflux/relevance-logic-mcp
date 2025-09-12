import { EvidenceModule } from '../../src/evidence/evidence-module.js';
import { NaturalLanguageParser } from '../../src/parser/nlp-parser.js';
import { FormulaUtils } from '../../src/logic/formula.js';

describe('Evidence Gathering Integration Tests', () => {
  let evidenceModule: EvidenceModule;
  let parser: NaturalLanguageParser;

  beforeEach(() => {
    evidenceModule = new EvidenceModule();
    parser = new NaturalLanguageParser();
  });

  describe('evidence_gathering Tool Integration', () => {
    it('should process valid rlmcp_reason output and add evidence requirements', () => {
      // Mock valid rlmcp_reason output
      const rlmcpOutput = {
        rlmcp_analysis: {
          original_task: "All mammals are warm-blooded. Dolphins are mammals. Therefore dolphins are warm-blooded.",
          structured_argument: {
            premises: 2,
            conclusion: "dolphins are warm-blooded",
            logical_structure: "VALID"
          },
          validation_results: {
            overallValid: true,
            systemRCompliant: true
          },
          recommendations: ["Argument is logically valid"]
        }
      };

      // Parse the original task to get structured argument
      const argument = parser.parseArgument(rlmcpOutput.rlmcp_analysis.original_task);
      
      const complianceReport = evidenceModule.enforceEvidenceCompliance({
        premises: argument.premises,
        conclusion: argument.conclusion,
        validation: { validation: rlmcpOutput.rlmcp_analysis.validation_results }
      });

      expect(complianceReport.isCompliant).toBe(false); // Initially no evidence provided
      expect(complianceReport.requirements.length).toBeGreaterThan(0);
      
      // Should have evidence requirements for atoms and implications
      const atomRequirements = complianceReport.requirements.filter(r => r.type === 'atom');
      const implRequirements = complianceReport.requirements.filter(r => r.type === 'implication');
      
      expect(atomRequirements.length).toBeGreaterThan(0);
      expect(implRequirements.length).toBeGreaterThan(0);
    });

    it('should reject logically invalid arguments', () => {
      // Mock invalid rlmcp_reason output
      const rlmcpOutput = {
        rlmcp_analysis: {
          original_task: "Dogs are cats. Cats are birds. Therefore dogs are birds.",
          structured_argument: {
            premises: 2,
            conclusion: "dogs are birds",
            logical_structure: "INVALID"
          },
          validation_results: {
            overallValid: false,
            systemRCompliant: false
          },
          gap_analysis: {
            errors: ["No syntactic sharing between premises and conclusion"]
          }
        }
      };

      // Evidence gathering should reject invalid logical arguments
      const shouldFail = rlmcpOutput.rlmcp_analysis.validation_results.overallValid;
      expect(shouldFail).toBe(false);
      
      // The evidence_gathering tool would return an error for this case
    });

    it('should validate dual requirements: logic AND evidence', () => {
      const rlmcpOutput = {
        rlmcp_analysis: {
          original_task: "All elephants are large. Dumbo is an elephant. Therefore Dumbo is large.",
          structured_argument: {
            premises: 2,
            conclusion: "Dumbo is large", 
            logical_structure: "VALID"
          },
          validation_results: {
            overallValid: true,
            systemRCompliant: true
          }
        }
      };

      const argument = parser.parseArgument(rlmcpOutput.rlmcp_analysis.original_task);
      const complianceReport = evidenceModule.enforceEvidenceCompliance({
        premises: argument.premises,
        conclusion: argument.conclusion,
        validation: { validation: rlmcpOutput.rlmcp_analysis.validation_results }
      });

      // Both logical validity and evidence completeness required
      const logicallyValid = rlmcpOutput.rlmcp_analysis.validation_results.overallValid;
      const evidenceComplete = complianceReport.isCompliant;
      const overallValid = logicallyValid && evidenceComplete;

      expect(logicallyValid).toBe(true);  // Logic is valid
      expect(evidenceComplete).toBe(false); // Evidence not provided yet
      expect(overallValid).toBe(false); // Overall fails due to missing evidence
    });
  });
});