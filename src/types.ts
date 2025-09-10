export type LogicalOperator = 
  // Additive connectives
  | 'and'               // ∧ (additive conjunction)
  | 'or'                // ∨ (additive disjunction)
  | 'implies'           // → (relevant implication)
  | 'not'               // ¬ (relevant negation)
  | 'biconditional'     // ↔ (biconditional)
  // Multiplicative connectives (ESSENTIAL for relevance logic)
  | 'times'             // ⊗ (multiplicative conjunction/tensor)
  | 'par'               // ⅋ (multiplicative disjunction)
  | 'lollipop'          // ⊸ (multiplicative implication/linear implication)
  // Units
  | 'one'               // I (multiplicative unit)
  | 'bottom'            // ⊥ (multiplicative falsity)  
  | 'top'               // ⊤ (additive truth)
  | 'zero'              // 0 (additive falsity)
  // Quantifiers
  | 'forall'            // ∀ (universal quantification)
  | 'exists';           // ∃ (existential quantification)

export type LogicSystem = 
  | 'classical'
  // Relevance logic systems (hierarchical)
  | 'relevance_B'       // Basic relevance logic (weakest)
  | 'relevance_T'       // Ticketing logic (+ contraction)  
  | 'relevance_E'       // Entailment logic (+ entailment axioms)
  | 'relevance_R';      // Relevant implication (strongest, + distribution)

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
  confidence?: number;
}

export interface Argument {
  premises: LogicFormula[];
  conclusion: LogicFormula;
  context?: string;
  domain?: string;
}

export interface ValidationResult {
  isValid: boolean;
  hasRelevance: boolean;
  errors: string[];
  warnings: string[];
  relevanceScore: number;
}

export interface ParsedStatement {
  originalText: string;
  formula: LogicFormula;
  assumptions: LogicFormula[];
  ambiguities: string[];
  confidence: number;
}