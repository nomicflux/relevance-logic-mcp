import { LogicFormula, LogicalOperator, Variable, Term } from '../types.js';

export class FormulaBuilder {
  private static idCounter = 0;

  static generateId(): string {
    return `formula_${++this.idCounter}`;
  }

  static atomic(
    predicate: string, 
    terms: Term[] = [], 
    naturalLanguage: string = ''
  ): LogicFormula {
    const variables = new Set<string>();
    const predicates = new Set([predicate]);
    
    terms.forEach(term => {
      if (term.type === 'variable') {
        variables.add(term.name);
      }
    });

    return {
      id: this.generateId(),
      type: 'atomic',
      predicate,
      terms,
      variables,
      predicates,
      naturalLanguage
    };
  }

  static compound(
    operator: LogicalOperator,
    subformulas: LogicFormula[],
    naturalLanguage: string = ''
  ): LogicFormula {
    const variables = new Set<string>();
    const predicates = new Set<string>();

    subformulas.forEach(sub => {
      if (sub.variables) {
        sub.variables.forEach(v => variables.add(v));
      }
      if (sub.predicates) {
        sub.predicates.forEach(p => predicates.add(p));
      }
    });

    return {
      id: this.generateId(),
      type: 'compound',
      operator,
      subformulas,
      variables,
      predicates,
      naturalLanguage
    };
  }

  static and(left: LogicFormula, right: LogicFormula, naturalLanguage?: string): LogicFormula {
    return this.compound('and', [left, right], naturalLanguage);
  }

  static or(left: LogicFormula, right: LogicFormula, naturalLanguage?: string): LogicFormula {
    return this.compound('or', [left, right], naturalLanguage);
  }

  static not(formula: LogicFormula, naturalLanguage?: string): LogicFormula {
    return this.compound('not', [formula], naturalLanguage);
  }

  static implies(antecedent: LogicFormula, consequent: LogicFormula, naturalLanguage?: string): LogicFormula {
    return this.compound('implies', [antecedent, consequent], naturalLanguage);
  }

  static relevantImplies(antecedent: LogicFormula, consequent: LogicFormula, naturalLanguage?: string): LogicFormula {
    return this.compound('implies', [antecedent, consequent], naturalLanguage);
  }

  // Multiplicative connectives (ESSENTIAL for relevance logic)
  static times(left: LogicFormula, right: LogicFormula, naturalLanguage?: string): LogicFormula {
    return this.compound('times', [left, right], naturalLanguage);
  }

  static lollipop(antecedent: LogicFormula, consequent: LogicFormula, naturalLanguage?: string): LogicFormula {
    return this.compound('lollipop', [antecedent, consequent], naturalLanguage);
  }

  static par(left: LogicFormula, right: LogicFormula, naturalLanguage?: string): LogicFormula {
    return this.compound('par', [left, right], naturalLanguage);
  }

  // Units
  static one(naturalLanguage?: string): LogicFormula {
    return {
      id: this.generateId(),
      type: 'atomic',
      predicate: 'I',
      variables: new Set(),
      predicates: new Set(['I']),
      naturalLanguage: naturalLanguage || 'multiplicative unit (I)'
    };
  }

  static bottom(naturalLanguage?: string): LogicFormula {
    return {
      id: this.generateId(),
      type: 'atomic', 
      predicate: '⊥',
      variables: new Set(),
      predicates: new Set(['⊥']),
      naturalLanguage: naturalLanguage || 'multiplicative falsity (⊥)'
    };
  }

  static forall(variable: string, formula: LogicFormula, naturalLanguage?: string): LogicFormula {
    const result = this.compound('forall', [formula], naturalLanguage);
    result.variables.add(variable);
    return result;
  }

  static exists(variable: string, formula: LogicFormula, naturalLanguage?: string): LogicFormula {
    const result = this.compound('exists', [formula], naturalLanguage);
    result.variables.add(variable);
    return result;
  }
}

export class FormulaUtils {
  // DEPRECATED: Use hasExactAtomicSharing instead
  static hasSharedVariables(formula1: LogicFormula, formula2: LogicFormula): boolean {
    return this.hasExactAtomicSharing(formula1, formula2);
  }

  // DEPRECATED: Use getSharedAtomicFormulas instead  
  static getSharedVariables(formula1: LogicFormula, formula2: LogicFormula): Set<string> {
    const shared = new Set<string>();
    for (const variable of formula1.variables) {
      if (formula2.variables.has(variable)) {
        shared.add(variable);
      }
    }
    return shared;
  }

  /**
   * EXACT SYNTACTIC SHARING: Check if two formulas share identical atomic formulas
   * This is the CORRECT relevance logic requirement, not just variable name similarity
   */
  static hasExactAtomicSharing(formula1: LogicFormula, formula2: LogicFormula): boolean {
    const atoms1 = this.extractAtomicFormulas(formula1);
    const atoms2 = this.extractAtomicFormulas(formula2);
    
    for (const atom1 of atoms1) {
      for (const atom2 of atoms2) {
        if (this.atomicFormulasIdentical(atom1, atom2)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Extract all atomic formulas from a complex formula
   */
  static extractAtomicFormulas(formula: LogicFormula): LogicFormula[] {
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

  /**
   * Check if two atomic formulas have syntactic sharing in relevance logic
   * In relevance logic, predicate sharing with same arity constitutes valid sharing
   */
  static atomicFormulasIdentical(atom1: LogicFormula, atom2: LogicFormula): boolean {
    if (atom1.type !== 'atomic' || atom2.type !== 'atomic') return false;
    if (atom1.predicate !== atom2.predicate) return false;
    
    // Check arity matches - same predicate with same number of arguments
    const arity1 = atom1.terms?.length || 0;
    const arity2 = atom2.terms?.length || 0;
    
    return arity1 === arity2;
  }

  /**
   * Get all atomic formulas that are shared between two complex formulas
   */
  static getSharedAtomicFormulas(formula1: LogicFormula, formula2: LogicFormula): LogicFormula[] {
    const atoms1 = this.extractAtomicFormulas(formula1);
    const atoms2 = this.extractAtomicFormulas(formula2);
    const shared: LogicFormula[] = [];
    
    for (const atom1 of atoms1) {
      for (const atom2 of atoms2) {
        if (this.atomicFormulasIdentical(atom1, atom2)) {
          shared.push(atom1);
          break; // Don't add duplicates
        }
      }
    }
    return shared;
  }

  static toString(formula: LogicFormula): string {
    switch (formula.type) {
      case 'atomic':
        if (formula.terms && formula.terms.length > 0) {
          const termStrs = formula.terms.map(t => t.name).join(', ');
          return `${formula.predicate}(${termStrs})`;
        }
        return formula.predicate || 'P';

      case 'compound':
        if (!formula.operator || !formula.subformulas) return 'INVALID';
        
        const [first, second] = formula.subformulas;
        
        switch (formula.operator) {
          case 'not':
            return `¬${this.toString(first)}`;
          case 'and':
            return `(${this.toString(first)} ∧ ${this.toString(second)})`;
          case 'or':
            return `(${this.toString(first)} ∨ ${this.toString(second)})`;
          case 'implies':
            return `(${this.toString(first)} → ${this.toString(second)})`;
          case 'biconditional':
            return `(${this.toString(first)} ↔ ${this.toString(second)})`;
          // Multiplicative connectives
          case 'times':
            return `(${this.toString(first)} ⊗ ${this.toString(second)})`;
          case 'lollipop':
            return `(${this.toString(first)} ⊸ ${this.toString(second)})`;
          case 'par':
            return `(${this.toString(first)} ⅋ ${this.toString(second)})`;
          case 'forall':
            const forallVar = Array.from(first.variables)[0] || 'x';
            return `∀${forallVar}(${this.toString(first)})`;
          case 'exists':
            const existsVar = Array.from(first.variables)[0] || 'x';
            return `∃${existsVar}(${this.toString(first)})`;
          default:
            return 'UNKNOWN';
        }

      default:
        return 'INVALID';
    }
  }

  static complexity(formula: LogicFormula): number {
    if (formula.type === 'atomic') {
      return 1;
    }
    
    if (formula.subformulas) {
      return 1 + formula.subformulas.reduce((sum, sub) => sum + this.complexity(sub), 0);
    }
    
    return 1;
  }

  static getFreeVariables(formula: LogicFormula, boundVars: Set<string> = new Set()): Set<string> {
    const freeVars = new Set<string>();
    
    if (formula.type === 'atomic') {
      formula.variables.forEach(v => {
        if (!boundVars.has(v)) {
          freeVars.add(v);
        }
      });
      return freeVars;
    }
    
    if (formula.operator === 'forall' || formula.operator === 'exists') {
      if (formula.subformulas && formula.subformulas.length > 0) {
        const quantifiedVar = Array.from(formula.subformulas[0].variables)[0];
        const newBoundVars = new Set(boundVars);
        if (quantifiedVar) newBoundVars.add(quantifiedVar);
        
        const subfree = this.getFreeVariables(formula.subformulas[0], newBoundVars);
        subfree.forEach(v => freeVars.add(v));
      }
    } else if (formula.subformulas) {
      formula.subformulas.forEach(sub => {
        const subfree = this.getFreeVariables(sub, boundVars);
        subfree.forEach(v => freeVars.add(v));
      });
    }
    
    return freeVars;
  }
}