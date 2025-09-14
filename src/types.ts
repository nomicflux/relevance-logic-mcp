export type LogicalOperator = 
  // Additive connectives
  | 'and'               // ∧ (additive conjunction)
  | 'or'                // ∨ (additive disjunction)
  | 'implies'           // → (relevant implication)
  | 'not'               // ¬ (relevant negation)
  | 'biconditional'     // ↔ (biconditional)
  // Units
  | 'top'               // ⊤ (additive truth)
  | 'zero'              // 0 (additive falsity)
  // Quantifiers
  | 'forall'            // ∀ (universal quantification)
  | 'exists';           // ∃ (existential quantification)


export interface Variable {
  name: string;
  type: 'propositional' | 'individual' | 'predicate';
}

export interface Term {
  type: 'variable' | 'constant' | 'function';
  name: string;
  args?: Term[];
}

export interface LogicFormula {
  id: string;
  type: 'atomic' | 'compound';
  operator?: LogicalOperator;
  predicate?: string;
  terms?: Term[];
  subformulas?: LogicFormula[];
  variables: Set<string>;
  predicates: Set<string>;
  naturalLanguage: string;
}

export interface Argument {
  premises: LogicFormula[];
  conclusion: LogicFormula;
  context?: string;
  domain?: string;
}

export interface ParsedStatement {
  originalText: string;
  formula: LogicFormula;
  assumptions: LogicFormula[];
  ambiguities: string[];
  confidence: number;
}

// Validation Semantics

export interface RelevanceContext {
  sharedAtoms: LogicFormula[];              // Exact atomic formulas that establish relevance
  informationFlow: 'direct' | 'mediated';  // How information flows between source and target
  relevanceStrength: number;                // 0-1 measure of connection strength
}

export interface ValidationResult {
  isValid: boolean;
  violatedConstraints: string[];
}

// Step 4: Quantifier Scope Handling
export interface QuantifierScope {
  quantifier: 'forall' | 'exists';
  boundVariable: string;
  scope: LogicFormula;
  bindings: Map<string, Term>;
}

// Step 5: Distribution Axioms
export interface DistributionRule {
  pattern: LogicFormula;
  distributed: LogicFormula;
  conditions: string[];
}