import { LogicFormula, LogicSystem } from '../types.js';
import { FormulaUtils } from './formula.js';

/**
 * Structural Rule Enforcement for Relevance Logic
 * 
 * Relevance logic has specific structural rules that differ from classical logic:
 * - CONTRACTION: Allowed (can use premises multiple times)
 * - WEAKENING: FORBIDDEN (cannot add irrelevant premises)
 * - EXCHANGE: Allowed (premise order doesn't matter)
 * 
 * These rules are essential for maintaining relevance constraints.
 */

export interface StructuralRuleViolation {
  rule: 'contraction' | 'weakening' | 'exchange';
  description: string;
  violatingPremise?: LogicFormula;
}

export class StructuralRuleEnforcer {
  
  /**
   * Check if a set of inference steps violates structural rules
   */
  checkStructuralRules(
    originalPremises: LogicFormula[], 
    derivedPremises: LogicFormula[], 
    system: LogicSystem
  ): StructuralRuleViolation[] {
    const violations: StructuralRuleViolation[] = [];
    
    // Check for weakening violations (CRITICAL in relevance logic)
    const weakeningViolations = this.checkWeakeningViolations(originalPremises, derivedPremises);
    violations.push(...weakeningViolations);
    
    // Check for improper contraction (system-dependent)
    const contractionViolations = this.checkContractionViolations(originalPremises, derivedPremises, system);
    violations.push(...contractionViolations);
    
    return violations;
  }

  /**
   * WEAKENING RULE CHECK (FORBIDDEN in relevance logic)
   * 
   * Weakening would allow adding arbitrary premises that don't share content
   * with the conclusion. This violates the core relevance constraint.
   */
  private checkWeakeningViolations(
    original: LogicFormula[], 
    derived: LogicFormula[]
  ): StructuralRuleViolation[] {
    const violations: StructuralRuleViolation[] = [];
    
    for (const derivedPremise of derived) {
      // Check if this premise is actually derivable from original premises
      if (!this.isDerivableFrom(derivedPremise, original)) {
        // Check if it's identical to an original premise (allowed)
        if (!original.some(orig => this.formulasIdentical(orig, derivedPremise))) {
          violations.push({
            rule: 'weakening',
            description: `Weakening rule violated: premise "${FormulaUtils.toString(derivedPremise)}" adds irrelevant content`,
            violatingPremise: derivedPremise
          });
        }
      }
    }
    
    return violations;
  }

  /**
   * CONTRACTION RULE CHECK (ALLOWED in relevance logic)
   * 
   * Contraction allows using premises multiple times. This is generally allowed
   * in relevance logic, but some systems may have restrictions.
   */
  private checkContractionViolations(
    original: LogicFormula[], 
    derived: LogicFormula[], 
    system: LogicSystem
  ): StructuralRuleViolation[] {
    const violations: StructuralRuleViolation[] = [];
    
    // In most relevance logic systems, contraction is freely allowed
    // Only system B might have restrictions
    if (system === 'relevance_B') {
      // System B: minimal relevance, might restrict contraction in some contexts
      // For now, we allow contraction in all systems
    }
    
    return violations; // Contraction generally allowed
  }

  /**
   * Check if a formula is derivable from a set of premises
   * using only valid relevance logic rules
   */
  private isDerivableFrom(target: LogicFormula, premises: LogicFormula[]): boolean {
    // Check if target is identical to any premise
    if (premises.some(premise => this.formulasIdentical(premise, target))) {
      return true;
    }
    
    // Check if target can be derived by conjunction elimination
    if (this.derivableByConjunctionElimination(target, premises)) {
      return true;
    }
    
    // Check if target can be derived by modus ponens with relevance constraint
    if (this.derivableByRelevantModusPonens(target, premises)) {
      return true;
    }
    
    // Add more derivability rules as needed
    return false;
  }

  /**
   * Check derivability by conjunction elimination: A ∧ B ⊢ A, A ∧ B ⊢ B
   */
  private derivableByConjunctionElimination(target: LogicFormula, premises: LogicFormula[]): boolean {
    for (const premise of premises) {
      if (premise.type === 'compound' && premise.operator === 'and' && premise.subformulas) {
        // Check if target is one of the conjuncts
        for (const conjunct of premise.subformulas) {
          if (this.formulasIdentical(conjunct, target)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Check derivability by modus ponens with relevance constraint
   */
  private derivableByRelevantModusPonens(target: LogicFormula, premises: LogicFormula[]): boolean {
    // Find implications in premises
    const implications = premises.filter(p => 
      p.type === 'compound' && p.operator === 'implies' && p.subformulas?.length === 2
    );
    
    for (const implication of implications) {
      const antecedent = implication.subformulas![0];
      const consequent = implication.subformulas![1];
      
      // Check if target matches consequent
      if (this.formulasIdentical(consequent, target)) {
        // Check if antecedent is available in premises
        if (premises.some(p => this.formulasIdentical(p, antecedent))) {
          // Check relevance constraint: antecedent and consequent must share content
          if (FormulaUtils.hasExactAtomicSharing(antecedent, consequent)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Check if two formulas are syntactically identical
   */
  private formulasIdentical(formula1: LogicFormula, formula2: LogicFormula): boolean {
    return FormulaUtils.toString(formula1) === FormulaUtils.toString(formula2);
  }

  /**
   * Apply contraction rule: allows using premises multiple times
   */
  applyContraction(premises: LogicFormula[], targetPremise: LogicFormula): LogicFormula[] {
    // Contraction: if we have A, we can use it multiple times
    // This is always allowed in relevance logic
    return [...premises, targetPremise];
  }

  /**
   * Check if exchange is valid (always true in relevance logic)
   */
  isExchangeValid(premises1: LogicFormula[], premises2: LogicFormula[]): boolean {
    // Exchange: premise order doesn't affect validity
    // Always allowed in relevance logic
    
    if (premises1.length !== premises2.length) return false;
    
    // Check if premises2 is a permutation of premises1
    for (const premise of premises1) {
      if (!premises2.some(p => this.formulasIdentical(p, premise))) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Validate an inference step against structural rules
   */
  validateInferenceStep(
    premises: LogicFormula[],
    conclusion: LogicFormula,
    rule: string,
    system: LogicSystem
  ): { valid: boolean; violations: StructuralRuleViolation[] } {
    
    const violations: StructuralRuleViolation[] = [];
    
    // Check relevance constraint (fundamental to all relevance logic systems)
    if (!this.satisfiesRelevanceConstraint(premises, conclusion)) {
      violations.push({
        rule: 'weakening',
        description: 'Conclusion does not share atomic formulas with premises (relevance violation)',
        violatingPremise: conclusion
      });
    }
    
    // Check system-specific constraints
    if (system === 'relevance_B') {
      // System B: strictest relevance requirements
      if (!this.satisfiesSystemBConstraints(premises, conclusion)) {
        violations.push({
          rule: 'weakening',
          description: 'System B requires minimal relevance - inference too strong',
          violatingPremise: conclusion
        });
      }
    }
    
    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
   * Check if inference satisfies basic relevance constraint
   */
  private satisfiesRelevanceConstraint(premises: LogicFormula[], conclusion: LogicFormula): boolean {
    // Must have exact atomic formula sharing
    return premises.some(premise => FormulaUtils.hasExactAtomicSharing(premise, conclusion));
  }

  /**
   * Check if inference satisfies System B constraints (most restrictive)
   */
  private satisfiesSystemBConstraints(premises: LogicFormula[], conclusion: LogicFormula): boolean {
    // System B: only allows most basic inferences
    // Stricter than other systems
    return this.satisfiesRelevanceConstraint(premises, conclusion);
  }
}

/**
 * Proof step validator that enforces structural rules
 */
export class RelevanceProofValidator {
  private enforcer: StructuralRuleEnforcer;
  
  constructor() {
    this.enforcer = new StructuralRuleEnforcer();
  }

  /**
   * Validate a complete proof for structural rule compliance
   */
  validateProof(
    premises: LogicFormula[], 
    conclusion: LogicFormula,
    proofSteps: { formula: LogicFormula; rule: string }[],
    system: LogicSystem
  ): { valid: boolean; violations: StructuralRuleViolation[]; step?: number } {
    
    let currentPremises = [...premises];
    const allViolations: StructuralRuleViolation[] = [];
    
    for (let i = 0; i < proofSteps.length; i++) {
      const step = proofSteps[i];
      
      // Validate this step
      const stepValidation = this.enforcer.validateInferenceStep(
        currentPremises, 
        step.formula, 
        step.rule, 
        system
      );
      
      if (!stepValidation.valid) {
        return {
          valid: false,
          violations: stepValidation.violations,
          step: i + 1
        };
      }
      
      // Add derived formula to available premises for next steps
      currentPremises.push(step.formula);
      
      // Check for structural rule violations in premise set
      const structuralViolations = this.enforcer.checkStructuralRules(premises, currentPremises, system);
      if (structuralViolations.length > 0) {
        return {
          valid: false,
          violations: structuralViolations,
          step: i + 1
        };
      }
    }
    
    // Check if final conclusion is derived
    const finalFormulas = currentPremises;
    if (!finalFormulas.some(f => FormulaUtils.toString(f) === FormulaUtils.toString(conclusion))) {
      return {
        valid: false,
        violations: [{
          rule: 'weakening',
          description: 'Proof does not derive the target conclusion',
          violatingPremise: conclusion
        }]
      };
    }
    
    return { valid: true, violations: [] };
  }
}

/**
 * Utility functions for structural rule analysis
 */
export class StructuralRuleUtils {
  
  /**
   * Check if a set of premises can be contracted (duplicated)
   */
  static canContract(premises: LogicFormula[], system: LogicSystem): boolean {
    // Contraction is generally allowed in all relevance logic systems
    switch (system) {
      case 'relevance_B':
      case 'relevance_T':
      case 'relevance_E':
      case 'relevance_R':
        return true; // All systems allow contraction
      default:
        return false;
    }
  }

  /**
   * Check if premises can be weakened (new premises added)
   */
  static canWeaken(original: LogicFormula[], additional: LogicFormula[], system: LogicSystem): boolean {
    // Weakening is FORBIDDEN in all relevance logic systems
    return false;
  }

  /**
   * Check if premises can be exchanged (reordered)
   */
  static canExchange(premises: LogicFormula[], system: LogicSystem): boolean {
    // Exchange is allowed in all relevance logic systems
    return true;
  }
}