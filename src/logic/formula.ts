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
      sub.variables.forEach(v => variables.add(v));
      sub.predicates.forEach(p => predicates.add(p));
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
    return this.compound('relevant_implies', [antecedent, consequent], naturalLanguage);
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
  static hasSharedVariables(formula1: LogicFormula, formula2: LogicFormula): boolean {
    for (const variable of formula1.variables) {
      if (formula2.variables.has(variable)) {
        return true;
      }
    }
    return false;
  }

  static getSharedVariables(formula1: LogicFormula, formula2: LogicFormula): Set<string> {
    const shared = new Set<string>();
    for (const variable of formula1.variables) {
      if (formula2.variables.has(variable)) {
        shared.add(variable);
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
          case 'relevant_implies':
            return `(${this.toString(first)} →ᵣ ${this.toString(second)})`;
          case 'biconditional':
            return `(${this.toString(first)} ↔ ${this.toString(second)})`;
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