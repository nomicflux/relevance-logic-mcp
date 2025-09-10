import { LogicFormula, LogicSystem, FrameConditions, RelevanceModel } from '../types.js';
import { FormulaUtils } from './formula.js';

export interface SystemAxioms {
  selfImplication: boolean;      // A → A (all systems)
  distribution: boolean;         // A ∧ (B ∨ C) → (A ∧ B) ∨ (A ∧ C) (R only)
  contraction: boolean;          // A → A ∧ A (T and above)
  basicRelevance: boolean;       // Variable sharing required (all)
  entailmentAxioms: boolean;     // E-specific axioms (E and R)
}

export interface InferenceRule {
  name: string;
  description: string;
  apply: (premises: LogicFormula[], system: LogicSystem) => LogicFormula[];
  isValidIn: (system: LogicSystem) => boolean;
  requiresRelevance: boolean;
}

export abstract class RelevanceLogicSystem {
  protected system: LogicSystem;
  protected axioms: SystemAxioms;
  protected frameConditions: FrameConditions;

  constructor(system: LogicSystem) {
    this.system = system;
    this.axioms = this.getSystemAxioms();
    this.frameConditions = this.getFrameConditions();
  }

  abstract getSystemAxioms(): SystemAxioms;
  abstract getFrameConditions(): FrameConditions;
  abstract isTheoremValid(formula: LogicFormula): boolean;
  abstract validateInference(premises: LogicFormula[], conclusion: LogicFormula): boolean;

  // Common method for exact variable sharing check
  protected hasExactSharing(premises: LogicFormula[], conclusion: LogicFormula): boolean {
    // Must have exact atomic formula sharing, not just variable names
    const conclusionAtoms = this.extractAtomicFormulas(conclusion);
    
    for (const premise of premises) {
      const premiseAtoms = this.extractAtomicFormulas(premise);
      
      // Check if any atomic formulas are syntactically identical
      for (const premiseAtom of premiseAtoms) {
        for (const conclusionAtom of conclusionAtoms) {
          if (this.atomicFormulasIdentical(premiseAtom, conclusionAtom)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  private extractAtomicFormulas(formula: LogicFormula): LogicFormula[] {
    if (formula.type === 'atomic') {
      return [formula];
    }
    
    const atoms: LogicFormula[] = [];
    if (formula.subformulas) {
      for (const sub of formula.subformulas) {
        atoms.push(...this.extractAtomicFormulas(sub));
      }
    }
    return atoms;
  }

  private atomicFormulasIdentical(atom1: LogicFormula, atom2: LogicFormula): boolean {
    if (atom1.type !== 'atomic' || atom2.type !== 'atomic') return false;
    if (atom1.predicate !== atom2.predicate) return false;
    
    // Check term structure identity
    if (!atom1.terms || !atom2.terms) return atom1.terms === atom2.terms;
    if (atom1.terms.length !== atom2.terms.length) return false;
    
    for (let i = 0; i < atom1.terms.length; i++) {
      if (atom1.terms[i].name !== atom2.terms[i].name || 
          atom1.terms[i].type !== atom2.terms[i].type) {
        return false;
      }
    }
    
    return true;
  }
}

// System B: Basic relevance logic (weakest)
export class SystemB extends RelevanceLogicSystem {
  constructor() {
    super('relevance_B');
  }

  getSystemAxioms(): SystemAxioms {
    return {
      selfImplication: true,      // A → A
      distribution: false,        // Not valid in B
      contraction: false,         // Not in basic system
      basicRelevance: true,       // Variable sharing required
      entailmentAxioms: false     // Not in B
    };
  }

  getFrameConditions(): FrameConditions {
    return {
      minimal: true,              // Only basic sharing requirements
      basicRelevance: true,
      contraction: false,
      reflexivity: false,
      commutativity: false,
      associativity: false,
      distributivity: false
    };
  }

  isTheoremValid(formula: LogicFormula): boolean {
    // Only self-implication A → A is valid in System B
    if (formula.type === 'compound' && formula.operator === 'implies' && 
        formula.subformulas && formula.subformulas.length === 2) {
      return FormulaUtils.toString(formula.subformulas[0]) === 
             FormulaUtils.toString(formula.subformulas[1]);
    }
    return false;
  }

  validateInference(premises: LogicFormula[], conclusion: LogicFormula): boolean {
    // System B: Only allows inferences with exact sharing
    return this.hasExactSharing(premises, conclusion);
  }
}

// System T: Ticketing logic (+ contraction)
export class SystemT extends RelevanceLogicSystem {
  constructor() {
    super('relevance_T');
  }

  getSystemAxioms(): SystemAxioms {
    return {
      selfImplication: true,      // A → A
      distribution: false,        // Not valid in T
      contraction: true,          // A → A ∧ A
      basicRelevance: true,       // Variable sharing required
      entailmentAxioms: false     // Not in T
    };
  }

  getFrameConditions(): FrameConditions {
    return {
      minimal: false,
      basicRelevance: true,
      contraction: true,          // Supports contraction
      reflexivity: true,          // Required for contraction
      commutativity: false,
      associativity: false,
      distributivity: false
    };
  }

  isTheoremValid(formula: LogicFormula): boolean {
    // System T theorems: A → A, A → A ∧ A
    if (this.isSystemBTheorem(formula)) return true;
    
    // Contraction: A → A ∧ A
    if (formula.type === 'compound' && formula.operator === 'implies' && 
        formula.subformulas && formula.subformulas.length === 2) {
      const antecedent = formula.subformulas[0];
      const consequent = formula.subformulas[1];
      
      if (consequent.type === 'compound' && consequent.operator === 'and' &&
          consequent.subformulas && consequent.subformulas.length === 2) {
        const left = consequent.subformulas[0];
        const right = consequent.subformulas[1];
        return FormulaUtils.toString(antecedent) === FormulaUtils.toString(left) &&
               FormulaUtils.toString(antecedent) === FormulaUtils.toString(right);
      }
    }
    return false;
  }

  validateInference(premises: LogicFormula[], conclusion: LogicFormula): boolean {
    if (!this.hasExactSharing(premises, conclusion)) return false;
    
    // System T allows contraction: can use premises multiple times
    return true; // Basic validation - more complex rules would go here
  }

  private isSystemBTheorem(formula: LogicFormula): boolean {
    const systemB = new SystemB();
    return systemB.isTheoremValid(formula);
  }
}

// System E: Entailment logic (+ entailment axioms)
export class SystemE extends RelevanceLogicSystem {
  constructor() {
    super('relevance_E');
  }

  getSystemAxioms(): SystemAxioms {
    return {
      selfImplication: true,      // A → A
      distribution: false,        // Not valid in E (key difference from R)
      contraction: true,          // A → A ∧ A
      basicRelevance: true,       // Variable sharing required
      entailmentAxioms: true      // E-specific entailment axioms
    };
  }

  getFrameConditions(): FrameConditions {
    return {
      minimal: false,
      basicRelevance: true,
      contraction: true,
      reflexivity: true,
      commutativity: true,        // E has commutativity
      associativity: true,        // E has associativity
      distributivity: false       // Key: NO distribution (differs from R)
    };
  }

  isTheoremValid(formula: LogicFormula): boolean {
    // System E includes all System T theorems
    if (this.isSystemTTheorem(formula)) return true;
    
    // Additional E-specific theorems would go here
    // (without distribution law)
    return false;
  }

  validateInference(premises: LogicFormula[], conclusion: LogicFormula): boolean {
    if (!this.hasExactSharing(premises, conclusion)) return false;
    
    // System E validation logic (stronger than T, weaker than R)
    return true; 
  }

  private isSystemTTheorem(formula: LogicFormula): boolean {
    const systemT = new SystemT();
    return systemT.isTheoremValid(formula);
  }
}

// System R: Relevant implication (strongest, + distribution)
export class SystemR extends RelevanceLogicSystem {
  constructor() {
    super('relevance_R');
  }

  getSystemAxioms(): SystemAxioms {
    return {
      selfImplication: true,      // A → A
      distribution: true,         // A ∧ (B ∨ C) → (A ∧ B) ∨ (A ∧ C)
      contraction: true,          // A → A ∧ A
      basicRelevance: true,       // Variable sharing required
      entailmentAxioms: true      // All E axioms plus more
    };
  }

  getFrameConditions(): FrameConditions {
    return {
      minimal: false,
      basicRelevance: true,
      contraction: true,
      reflexivity: true,
      commutativity: true,
      associativity: true,
      distributivity: true        // Key: HAS distribution (strongest system)
    };
  }

  isTheoremValid(formula: LogicFormula): boolean {
    // System R includes all System E theorems
    if (this.isSystemETheorem(formula)) return true;
    
    // Distribution law: A ∧ (B ∨ C) → (A ∧ B) ∨ (A ∧ C)
    if (this.isDistributionTheorem(formula)) return true;
    
    return false;
  }

  validateInference(premises: LogicFormula[], conclusion: LogicFormula): boolean {
    if (!this.hasExactSharing(premises, conclusion)) return false;
    
    // System R: Strongest relevance logic system
    // Allows all valid relevance logic inferences
    return true;
  }

  private isSystemETheorem(formula: LogicFormula): boolean {
    const systemE = new SystemE();
    return systemE.isTheoremValid(formula);
  }

  private isDistributionTheorem(formula: LogicFormula): boolean {
    // Check if formula matches distribution pattern
    // A ∧ (B ∨ C) → (A ∧ B) ∨ (A ∧ C)
    if (formula.type === 'compound' && formula.operator === 'implies' && 
        formula.subformulas && formula.subformulas.length === 2) {
      
      const antecedent = formula.subformulas[0];
      const consequent = formula.subformulas[1];
      
      // Complex pattern matching for distribution would go here
      // This is a simplified check
      return false; // Placeholder
    }
    return false;
  }
}

// Factory for creating appropriate system
export class RelevanceSystemFactory {
  static createSystem(systemType: LogicSystem): RelevanceLogicSystem {
    switch (systemType) {
      case 'relevance_B':
        return new SystemB();
      case 'relevance_T':
        return new SystemT();
      case 'relevance_E':
        return new SystemE();
      case 'relevance_R':
        return new SystemR();
      default:
        throw new Error(`Unknown relevance logic system: ${systemType}`);
    }
  }

  static getSystemHierarchy(): LogicSystem[] {
    // From weakest to strongest
    return ['relevance_B', 'relevance_T', 'relevance_E', 'relevance_R'];
  }

  static isSystemStronger(system1: LogicSystem, system2: LogicSystem): boolean {
    const hierarchy = this.getSystemHierarchy();
    const index1 = hierarchy.indexOf(system1);
    const index2 = hierarchy.indexOf(system2);
    return index1 > index2;
  }
}