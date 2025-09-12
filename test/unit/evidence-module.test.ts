import { EvidenceModule } from '../../src/evidence/evidence-module.js';
import { FormulaBuilder } from '../../src/logic/formula.js';
import { Evidence, EvidenceRequirement } from '../../src/evidence/types.js';

describe('EvidenceModule', () => {
  let evidenceModule: EvidenceModule;

  beforeEach(() => {
    evidenceModule = new EvidenceModule();
  });

  describe('requireAtomEvidence', () => {
    it('should create evidence requirement for atomic formula', () => {
      const atom = FormulaBuilder.atomic('test_predicate', [
        { type: 'variable', name: 'x' }
      ]);

      const requirement = evidenceModule.requireAtomEvidence(atom);

      expect(requirement.type).toBe('atom');
      expect(requirement.target).toContain('test_predicate');
      expect(requirement.provided).toBe(false);
      expect(requirement.description).toContain('Evidence required for atomic formula');
    });

    it('should handle atomic formula with constants', () => {
      const atom = FormulaBuilder.atomic('larger', [
        { type: 'constant', name: 'elephant' },
        { type: 'constant', name: 'mouse' }
      ]);

      const requirement = evidenceModule.requireAtomEvidence(atom);

      expect(requirement.type).toBe('atom');
      expect(requirement.target).toContain('larger');
      expect(requirement.target).toContain('elephant');
      expect(requirement.target).toContain('mouse');
    });
  });

  describe('requireImplicationEvidence', () => {
    it('should create evidence requirement for implication', () => {
      const premise = FormulaBuilder.atomic('mammal', [
        { type: 'variable', name: 'x' }
      ]);
      const conclusion = FormulaBuilder.atomic('warm_blooded', [
        { type: 'variable', name: 'x' }
      ]);

      const requirement = evidenceModule.requireImplicationEvidence(premise, conclusion);

      expect(requirement.type).toBe('implication');
      expect(requirement.target).toContain('mammal');
      expect(requirement.target).toContain('warm_blooded');
      expect(requirement.target).toContain('→');
      expect(requirement.provided).toBe(false);
    });
  });

  describe('validateEvidence', () => {
    it('should validate complete evidence', () => {
      const evidence: Evidence = {
        summary: 'Test evidence summary',
        strength: 0.8,
        citation: 'Test citation source'
      };

      const result = evidenceModule.validateEvidence(evidence);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject evidence missing summary', () => {
      const evidence: Evidence = {
        summary: '',
        strength: 0.8,
        citation: 'Test citation'
      };

      const result = evidenceModule.validateEvidence(evidence);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Evidence missing required 'summary' component");
    });

    it('should reject evidence missing strength', () => {
      const evidence: Evidence = {
        summary: 'Test summary',
        strength: null as any,
        citation: 'Test citation'
      };

      const result = evidenceModule.validateEvidence(evidence);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Evidence missing required 'strength' component");
    });

    it('should reject evidence missing citation', () => {
      const evidence: Evidence = {
        summary: 'Test summary',
        strength: 0.8,
        citation: ''
      };

      const result = evidenceModule.validateEvidence(evidence);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Evidence missing required 'citation' component");
    });

    it('should reject evidence with invalid strength range', () => {
      const evidence: Evidence = {
        summary: 'Test summary',
        strength: 1.5,
        citation: 'Test citation'
      };

      const result = evidenceModule.validateEvidence(evidence);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Evidence 'strength' must be between 0 and 1");
    });

    it('should warn about very low strength', () => {
      const evidence: Evidence = {
        summary: 'Test summary',
        strength: 0.2,
        citation: 'Test citation'
      };

      const result = evidenceModule.validateEvidence(evidence);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("Evidence strength is very low (<0.3) - consider stronger evidence");
    });

    it('should warn about very brief summary', () => {
      const evidence: Evidence = {
        summary: 'Brief',
        strength: 0.8,
        citation: 'Test citation'
      };

      const result = evidenceModule.validateEvidence(evidence);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("Evidence summary is very brief - consider more detailed explanation");
    });
  });

  describe('enforceEvidenceCompliance', () => {
    it('should identify evidence requirements for simple argument', () => {
      const premise1 = {
        formula: FormulaBuilder.atomic('mammal', [{ type: 'variable', name: 'x' }])
      };
      const conclusion = {
        formula: FormulaBuilder.atomic('warm_blooded', [{ type: 'variable', name: 'x' }])
      };

      const structuredArgument = {
        premises: [premise1],
        conclusion: conclusion
      };

      const report = evidenceModule.enforceEvidenceCompliance(structuredArgument);

      expect(report.isCompliant).toBe(false);
      expect(report.requirements.length).toBeGreaterThan(0);
      
      // Should have atom requirements
      const atomRequirements = report.requirements.filter(r => r.type === 'atom');
      expect(atomRequirements.length).toBe(2); // mammal(x) and warm_blooded(x)
      
      // Should have implication requirement
      const implicationRequirements = report.requirements.filter(r => r.type === 'implication');
      expect(implicationRequirements.length).toBe(1); // mammal(x) → warm_blooded(x)
    });

    it('should handle multiple premises with shared atoms', () => {
      const premise1 = {
        formula: FormulaBuilder.atomic('mammal', [{ type: 'variable', name: 'x' }])
      };
      const premise2 = {
        formula: FormulaBuilder.atomic('large', [{ type: 'variable', name: 'x' }])
      };
      const conclusion = {
        formula: FormulaBuilder.atomic('mammal', [{ type: 'variable', name: 'x' }]) // Same as premise1
      };

      const structuredArgument = {
        premises: [premise1, premise2],
        conclusion: conclusion
      };

      const report = evidenceModule.enforceEvidenceCompliance(structuredArgument);

      // Should deduplicate identical atoms
      const atomRequirements = report.requirements.filter(r => r.type === 'atom');
      const mammalRequirements = atomRequirements.filter(r => r.target.includes('mammal'));
      expect(mammalRequirements.length).toBe(1); // Should not duplicate mammal(x)
    });
  });

  describe('recordEvidence', () => {
    it('should record valid evidence for requirement', () => {
      const requirements: EvidenceRequirement[] = [{
        type: 'atom',
        target: 'test_atom',
        description: 'Test requirement',
        provided: false
      }];

      const evidence: Evidence = {
        summary: 'Valid test evidence',
        strength: 0.9,
        citation: 'Test source'
      };

      const result = evidenceModule.recordEvidence(0, evidence, requirements);

      expect(result.isValid).toBe(true);
      expect(requirements[0].provided).toBe(true);
      expect(requirements[0].evidence).toEqual(evidence);
    });

    it('should reject invalid requirement index', () => {
      const requirements: EvidenceRequirement[] = [];
      const evidence: Evidence = {
        summary: 'Test',
        strength: 0.5,
        citation: 'Test'
      };

      const result = evidenceModule.recordEvidence(0, evidence, requirements);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid requirement index");
    });

    it('should not record invalid evidence', () => {
      const requirements: EvidenceRequirement[] = [{
        type: 'atom',
        target: 'test_atom',
        description: 'Test requirement',
        provided: false
      }];

      const invalidEvidence: Evidence = {
        summary: '', // Invalid - empty
        strength: 0.9,
        citation: 'Test source'
      };

      const result = evidenceModule.recordEvidence(0, invalidEvidence, requirements);

      expect(result.isValid).toBe(false);
      expect(requirements[0].provided).toBe(false);
      expect(requirements[0].evidence).toBeUndefined();
    });
  });

  describe('checkComplianceStatus', () => {
    it('should return true when all requirements satisfied', () => {
      const requirements: EvidenceRequirement[] = [
        {
          type: 'atom',
          target: 'atom1',
          description: 'Test',
          provided: true,
          evidence: { summary: 'Test', strength: 0.8, citation: 'Test' }
        },
        {
          type: 'implication',
          target: 'impl1',
          description: 'Test',
          provided: true,
          evidence: { summary: 'Test', strength: 0.7, citation: 'Test' }
        }
      ];

      const isCompliant = evidenceModule.checkComplianceStatus(requirements);
      expect(isCompliant).toBe(true);
    });

    it('should return false when requirements not satisfied', () => {
      const requirements: EvidenceRequirement[] = [
        {
          type: 'atom',
          target: 'atom1',
          description: 'Test',
          provided: true,
          evidence: { summary: 'Test', strength: 0.8, citation: 'Test' }
        },
        {
          type: 'implication',
          target: 'impl1',
          description: 'Test',
          provided: false // Not provided
        }
      ];

      const isCompliant = evidenceModule.checkComplianceStatus(requirements);
      expect(isCompliant).toBe(false);
    });
  });

  describe('generateComplianceSummary', () => {
    it('should generate correct summary statistics', () => {
      const requirements: EvidenceRequirement[] = [
        {
          type: 'atom',
          target: 'atom1',
          description: 'Test',
          provided: true,
          evidence: { summary: 'Test', strength: 0.8, citation: 'Test' }
        },
        {
          type: 'atom',
          target: 'atom2',
          description: 'Test',
          provided: false
        },
        {
          type: 'implication',
          target: 'impl1',
          description: 'Test',
          provided: true,
          evidence: { summary: 'Test', strength: 0.7, citation: 'Test' }
        }
      ];

      const summary = evidenceModule.generateComplianceSummary(requirements);

      expect(summary.totalRequired).toBe(3);
      expect(summary.totalProvided).toBe(2);
      expect(summary.atomsRequired).toBe(2);
      expect(summary.atomsProvided).toBe(1);
      expect(summary.implicationsRequired).toBe(1);
      expect(summary.implicationsProvided).toBe(1);
    });
  });
});