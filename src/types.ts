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
}

export interface ParsedStatement {
  originalText: string;
  formula: LogicFormula;
  assumptions: LogicFormula[];
  ambiguities: string[];
  confidence: number;
}

// System R Ternary Relation Semantics - REQUIRED for proper relevance logic
export interface TernaryRelation {
  source: LogicFormula;      // Information source (premise)
  context: RelevanceContext; // Relevance mediator (shared content)
  target: LogicFormula;      // Information target (conclusion)
}

export interface RelevanceContext {
  sharedAtoms: LogicFormula[];              // Exact atomic formulas that establish relevance
  informationFlow: 'direct' | 'mediated';  // How information flows between source and target
  relevanceStrength: number;                // 0-1 measure of connection strength
}

export interface SystemRValidation {
  isValid: boolean;
  ternaryRelations: TernaryRelation[];
  violatedConstraints: string[];
  relevanceMap: Map<string, RelevanceContext>;
}