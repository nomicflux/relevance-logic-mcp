import { LogicFormula } from '../types.js';
import { FormulaUtils } from '../logic/formula.js';
import {
  Evidence,
  EvidenceValidation,
  ValidationResult,
  ComplianceReport,
  EvidenceRequirement
} from './types.js';

export class EvidenceModule {
  
  /**
   * Prompt AI to provide evidence for each atom and validate completeness
   */
  requireAtomEvidence(atom: LogicFormula): EvidenceRequirement {
    const atomString = FormulaUtils.toString(atom);
    
    return {
      type: 'atom',
      target: atomString,
      description: `Evidence required for atomic formula: ${atomString}`,
      provided: false
    };
  }

  /**
   * Prompt AI to provide evidence for each implication and validate completeness
   */
  requireImplicationEvidence(premise: LogicFormula, conclusion: LogicFormula): EvidenceRequirement {
    const premiseString = FormulaUtils.toString(premise);
    const conclusionString = FormulaUtils.toString(conclusion);
    const implicationString = `${premiseString} → ${conclusionString}`;
    
    return {
      type: 'implication',
      target: implicationString,
      description: `Evidence required for implication: ${implicationString}`,
      provided: false
    };
  }

  /**
   * Validate that evidence has all required components (summary, strength, citation)
   */
  validateEvidence(evidence: Evidence): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required components
    if (!evidence.summary || evidence.summary.trim().length === 0) {
      errors.push("Evidence missing required 'summary' component");
    }

    if (evidence.strength === undefined || evidence.strength === null) {
      errors.push("Evidence missing required 'strength' component");
    } else if (evidence.strength < 0 || evidence.strength > 1) {
      errors.push("Evidence 'strength' must be between 0 and 1");
    }

    if (!evidence.citation || evidence.citation.trim().length === 0) {
      errors.push("Evidence missing required 'citation' component");
    }

    // Warnings for quality
    if (evidence.strength < 0.3) {
      warnings.push("Evidence strength is very low (<0.3) - consider stronger evidence");
    }

    if (evidence.summary.length < 10) {
      warnings.push("Evidence summary is very brief - consider more detailed explanation");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check complete argument has evidence for all atoms and implications
   */
  enforceEvidenceCompliance(structuredArgument: any): ComplianceReport {
    const requirements: EvidenceRequirement[] = [];
    const missingEvidence: string[] = [];
    const invalidEvidence: string[] = [];

    // Extract all atoms from premises and conclusion
    const allFormulas = [
      ...structuredArgument.premises.map((p: any) => p.formula),
      structuredArgument.conclusion.formula
    ];

    // Require evidence for all unique atoms
    const uniqueAtoms = new Set<string>();
    allFormulas.forEach((formula: LogicFormula) => {
      const atoms = FormulaUtils.extractAtomicFormulas(formula);
      atoms.forEach(atom => {
        const atomString = FormulaUtils.toString(atom);
        if (!uniqueAtoms.has(atomString)) {
          uniqueAtoms.add(atomString);
          const requirement = this.requireAtomEvidence(atom);
          requirements.push(requirement);
          missingEvidence.push(`Atom: ${atomString}`);
        }
      });
    });

    // Require evidence for all implications (premise → conclusion pairs)
    structuredArgument.premises.forEach((premise: any) => {
      const requirement = this.requireImplicationEvidence(
        premise.formula,
        structuredArgument.conclusion.formula
      );
      requirements.push(requirement);
      missingEvidence.push(`Implication: ${requirement.target}`);
    });

    return {
      isCompliant: false, // Will be true only when AI provides all evidence
      missingEvidence,
      invalidEvidence,
      requirements
    };
  }

  /**
   * Record and validate AI-provided evidence for a specific requirement
   */
  recordEvidence(requirementIndex: number, evidence: Evidence, requirements: EvidenceRequirement[]): ValidationResult {
    if (requirementIndex < 0 || requirementIndex >= requirements.length) {
      return {
        isValid: false,
        errors: ["Invalid requirement index"],
        warnings: []
      };
    }

    const validation = this.validateEvidence(evidence);
    
    if (validation.isValid) {
      requirements[requirementIndex].evidence = evidence;
      requirements[requirementIndex].provided = true;
    }

    return validation;
  }

  /**
   * Check if all evidence requirements have been satisfied
   */
  checkComplianceStatus(requirements: EvidenceRequirement[]): boolean {
    return requirements.every(req => req.provided && req.evidence);
  }

  /**
   * Generate summary of evidence compliance status
   */
  generateComplianceSummary(requirements: EvidenceRequirement[]): {
    totalRequired: number;
    totalProvided: number;
    atomsRequired: number;
    atomsProvided: number;
    implicationsRequired: number;
    implicationsProvided: number;
  } {
    const atoms = requirements.filter(r => r.type === 'atom');
    const implications = requirements.filter(r => r.type === 'implication');
    
    return {
      totalRequired: requirements.length,
      totalProvided: requirements.filter(r => r.provided).length,
      atomsRequired: atoms.length,
      atomsProvided: atoms.filter(r => r.provided).length,
      implicationsRequired: implications.length,
      implicationsProvided: implications.filter(r => r.provided).length
    };
  }
}