export type LogicalOperator = 
  | 'and' 
  | 'or' 
  | 'not' 
  | 'implies' 
  | 'relevant_implies' 
  | 'biconditional'
  | 'forall' 
  | 'exists';

export type LogicSystem = 'classical' | 'relevance_R' | 'relevance_E' | 'relevance_S';

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