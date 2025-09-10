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

export interface ProofStep {
  stepNumber: number;
  formula: LogicFormula;
  rule: string;
  justification: number[];
  explanation: string;
}

export interface Proof {
  steps: ProofStep[];
  isValid: boolean;
  system: LogicSystem;
  premises: LogicFormula[];
  conclusion: LogicFormula;
}

export interface ValidationResult {
  isValid: boolean;
  hasRelevance: boolean;
  proof?: Proof;
  counterexample?: Model;
  errors: string[];
  warnings: string[];
  relevanceScore: number;
}

export interface World {
  id: string;
  assignments: Map<string, boolean>;
}

export interface TernaryRelation {
  x: World;
  y: World;
  z: World;
  relation: boolean;
}

export interface TernaryAccessibilityRelation {
  relates: (a: World, b: World, c: World) => boolean;
}

// Frame conditions for different relevance logic systems
export interface FrameConditions {
  // System R conditions (strongest)
  reflexivity?: boolean;          // Identity conditions
  commutativity?: boolean;        // R(a,b,c) iff R(b,a,c)
  associativity?: boolean;        // Complex associativity for composition
  distributivity?: boolean;       // Supports distribution law
  
  // System E conditions
  basicRelevance: boolean;        // Minimal relevance constraints
  
  // System T conditions
  contraction: boolean;           // Supports contraction rule
  
  // System B conditions  
  minimal: boolean;               // Only basic sharing requirements
}

export interface RelevanceModel {
  worlds: Set<World>;
  ternaryRelation: TernaryAccessibilityRelation;
  negationConjugation: (w: World) => World;  // * operation for negation
  distinguishedPoint: World;                 // 0 point (actual world)
  frameConditions: FrameConditions;          // System-specific constraints
  description: string;
}

// Legacy interface for compatibility
export interface Model {
  worlds: World[];
  relations: TernaryRelation[];
  interpretation: Map<string, boolean>;
  description: string;
}

export interface ParsedStatement {
  originalText: string;
  formula: LogicFormula;
  assumptions: LogicFormula[];
  ambiguities: string[];
  confidence: number;
}