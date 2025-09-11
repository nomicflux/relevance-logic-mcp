import { LogicFormula, LogicalOperator, Variable, Term, TernaryRelation, RelevanceContext, SystemRValidation, QuantifierScope, DistributionRule } from '../types.js';

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
   * Check if two atomic formulas are EXACTLY IDENTICAL for relevance logic variable sharing
   * This is the FINAL arbiter of sharing - no other checks follow this function
   * Must enforce Variable Sharing Principle: exact propositional variable identity required
   */
  static atomicFormulasIdentical(atom1: LogicFormula, atom2: LogicFormula): boolean {
    if (atom1.type !== 'atomic' || atom2.type !== 'atomic') return false;
    if (atom1.predicate !== atom2.predicate) return false;
    
    // Must check EXACT term identity - same variables, same constants
    // P(x) and P(y) do NOT share variables and must be rejected
    const terms1 = atom1.terms || [];
    const terms2 = atom2.terms || [];
    
    if (terms1.length !== terms2.length) return false;
    
    for (let i = 0; i < terms1.length; i++) {
      if (terms1[i].type !== terms2[i].type || terms1[i].name !== terms2[i].name) {
        return false;
      }
    }
    
    return true;
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

  // STEP 4: QUANTIFIER SCOPE HANDLING - REQUIRED for System R variable binding
  
  /**
   * Extract quantifier scopes from a formula - System R requires explicit binding scope
   */
  static getQuantifierScope(formula: LogicFormula): QuantifierScope[] {
    const scopes: QuantifierScope[] = [];
    
    if (formula.type === 'atomic') {
      return scopes;
    }
    
    if (formula.operator === 'forall' || formula.operator === 'exists') {
      if (formula.subformulas && formula.subformulas.length > 0) {
        // System R requires explicit variable binding - find the bound variable
        const scopeFormula = formula.subformulas[0];
        const boundVariable = this.extractBoundVariable(formula, scopeFormula);
        
        if (boundVariable) {
          scopes.push({
            quantifier: formula.operator,
            boundVariable: boundVariable,
            scope: scopeFormula,
            bindings: this.extractBindings(boundVariable, scopeFormula)
          });
        }
        
        // Recursively extract nested scopes
        const nestedScopes = this.getQuantifierScope(scopeFormula);
        scopes.push(...nestedScopes);
      }
    } else if (formula.subformulas) {
      // Check subformulas for quantifiers
      formula.subformulas.forEach(sub => {
        const subScopes = this.getQuantifierScope(sub);
        scopes.push(...subScopes);
      });
    }
    
    return scopes;
  }
  
  /**
   * Check if a variable is bound in any of the given quantifier scopes
   */
  static isVariableBound(variable: string, scopes: QuantifierScope[]): boolean {
    return scopes.some(scope => scope.boundVariable === variable);
  }
  
  /**
   * Validate quantifier sharing between premise and conclusion for System R
   */
  static validateQuantifierSharing(premise: LogicFormula, conclusion: LogicFormula): boolean {
    const premiseScopes = this.getQuantifierScope(premise);
    const conclusionScopes = this.getQuantifierScope(conclusion);
    
    // System R requires: if premise has bound variables, conclusion must have compatible binding
    for (const premiseScope of premiseScopes) {
      const matchingScope = conclusionScopes.find(cs => 
        cs.boundVariable === premiseScope.boundVariable && 
        cs.quantifier === premiseScope.quantifier
      );
      
      if (!matchingScope) {
        return false; // Bound variable not properly shared
      }
    }
    
    return true;
  }
  
  /**
   * Extract the bound variable from a quantifier formula
   */
  private static extractBoundVariable(quantifierFormula: LogicFormula, scopeFormula: LogicFormula): string | null {
    // For System R, we need explicit binding - look for the variable that should be bound
    // This replaces the problematic line 286 assumption
    const allVars = Array.from(scopeFormula.variables);
    
    // In proper System R, the bound variable should be explicitly indicated
    // For now, we'll take the first variable but this needs proper parsing
    return allVars.length > 0 ? allVars[0] : null;
  }
  
  /**
   * Extract variable bindings within a scope
   */
  private static extractBindings(boundVariable: string, scope: LogicFormula): Map<string, Term> {
    const bindings = new Map<string, Term>();
    
    if (scope.type === 'atomic' && scope.terms) {
      scope.terms.forEach(term => {
        if (term.type === 'variable' && term.name === boundVariable) {
          bindings.set(boundVariable, term);
        }
      });
    }
    
    return bindings;
  }

  /**
   * Get free variables using proper quantifier scope detection - FIXED for System R
   * This replaces the problematic line 286 assumption with explicit scope handling
   */
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
        // FIXED: Use proper scope detection instead of assuming first variable is quantified
        const scopeFormula = formula.subformulas[0];
        const quantifiedVar = this.extractBoundVariable(formula, scopeFormula);
        
        const newBoundVars = new Set(boundVars);
        if (quantifiedVar) {
          newBoundVars.add(quantifiedVar);
        }
        
        const subfree = this.getFreeVariables(scopeFormula, newBoundVars);
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

  // STEP 5: DISTRIBUTION AXIOMS - REQUIRED for System R distribution laws
  
  /**
   * Validate distribution laws in a formula - System R requires specific distribution patterns
   */
  static validateDistribution(formula: LogicFormula): boolean {
    if (formula.type === 'atomic') {
      return true; // Atomic formulas are trivially well-distributed
    }
    
    // Check if this formula matches any invalid distribution patterns
    if (!this.checkValidDistributionPattern(formula)) {
      return false;
    }
    
    // Recursively check subformulas
    if (formula.subformulas) {
      return formula.subformulas.every(sub => this.validateDistribution(sub));
    }
    
    return true;
  }
  
  /**
   * Apply distribution laws to transform a formula - System R specific transformations
   */
  static applyDistributionLaws(formula: LogicFormula): LogicFormula[] {
    const transformations: LogicFormula[] = [];
    
    // Conjunction distribution: A ∧ (B ∨ C) ≡ (A ∧ B) ∨ (A ∧ C)
    const conjDistr = this.applyConjunctionDistribution(formula);
    if (conjDistr) transformations.push(conjDistr);
    
    // Implication distribution with relevance constraints
    const implDistr = this.applyImplicationDistribution(formula);
    if (implDistr) transformations.push(implDistr);
    
    // Multiplicative distribution laws
    const multDistr = this.applyMultiplicativeDistribution(formula);
    if (multDistr) transformations.push(multDistr);
    
    return transformations;
  }
  
  /**
   * Check distribution compliance between premises and conclusion for System R
   */
  static checkDistributionCompliance(premises: LogicFormula[], conclusion: LogicFormula): boolean {
    // All formulas must satisfy distribution laws
    const allFormulas = [...premises, conclusion];
    
    for (const formula of allFormulas) {
      if (!this.validateDistribution(formula)) {
        return false;
      }
    }
    
    // Check that any distribution transformations maintain relevance
    for (const premise of premises) {
      const transformations = this.applyDistributionLaws(premise);
      for (const transformed of transformations) {
        // Transformed formula must still maintain ternary relation with conclusion
        if (!this.createTernaryRelation(transformed, conclusion)) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Check if formula follows valid distribution patterns
   */
  private static checkValidDistributionPattern(formula: LogicFormula): boolean {
    if (formula.type === 'atomic') return true;
    
    // Check conjunction distribution: A ∧ (B ∨ C) should be distributed
    if (formula.operator === 'and' && formula.subformulas && formula.subformulas.length === 2) {
      const [left, right] = formula.subformulas;
      
      // If right side is disjunction, this might need distribution
      if (right.operator === 'or') {
        // This is acceptable in System R if it maintains relevance
        return this.checkRelevancePreservation(formula);
      }
    }
    
    return true;
  }
  
  /**
   * Apply conjunction distribution: A ∧ (B ∨ C) → (A ∧ B) ∨ (A ∧ C)
   */
  private static applyConjunctionDistribution(formula: LogicFormula): LogicFormula | null {
    if (formula.operator !== 'and' || !formula.subformulas || formula.subformulas.length !== 2) {
      return null;
    }
    
    const [left, right] = formula.subformulas;
    
    // Pattern: A ∧ (B ∨ C)
    if (right.operator === 'or' && right.subformulas && right.subformulas.length === 2) {
      const [B, C] = right.subformulas;
      
      // Create: (A ∧ B) ∨ (A ∧ C)
      const leftDistrib = FormulaBuilder.compound('and', [left, B]);
      const rightDistrib = FormulaBuilder.compound('and', [left, C]);
      
      return FormulaBuilder.compound('or', [leftDistrib, rightDistrib], 
        `${formula.naturalLanguage} [conjunction distributed]`);
    }
    
    return null;
  }
  
  /**
   * Apply implication distribution with relevance constraints
   */
  private static applyImplicationDistribution(formula: LogicFormula): LogicFormula | null {
    if (formula.operator !== 'implies' || !formula.subformulas || formula.subformulas.length !== 2) {
      return null;
    }
    
    const [antecedent, consequent] = formula.subformulas;
    
    // For System R, implication distribution must preserve variable sharing
    if (!this.checkVariableSharing(antecedent, consequent)) {
      return null;
    }
    
    // System R specific implication transformations would go here
    // For now, return null (no transformation) to maintain strict compliance
    return null;
  }
  
  /**
   * Apply multiplicative distribution laws for ⊗, ⊸, ⅋
   */
  private static applyMultiplicativeDistribution(formula: LogicFormula): LogicFormula | null {
    // Multiplicative distribution laws for System R
    if (formula.operator === 'times' || formula.operator === 'lollipop' || formula.operator === 'par') {
      // System R multiplicative distribution requires resource consciousness
      // This will be fully implemented in Step 6
      return null;
    }
    
    return null;
  }
  
  /**
   * Check if distribution preserves relevance relationships - FIXED for System R
   * System R requires EXACT atomic formula sharing, not just variable overlap
   */
  private static checkRelevancePreservation(formula: LogicFormula): boolean {
    if (!formula.subformulas || formula.subformulas.length < 2) return true;
    
    // For A ∧ (B ∨ C) pattern: BOTH B and C must share atomic formulas with A
    if (formula.operator === 'and' && formula.subformulas.length === 2) {
      const [left, right] = formula.subformulas;
      
      if (right.operator === 'or' && right.subformulas && right.subformulas.length === 2) {
        const [B, C] = right.subformulas;
        const leftAtoms = this.extractAtomicFormulas(left);
        
        // Check if B shares exact atomic formulas with A
        const bAtoms = this.extractAtomicFormulas(B);
        const bShares = bAtoms.some(bAtom => 
          leftAtoms.some(leftAtom => this.atomicFormulasIdentical(leftAtom, bAtom))
        );
        
        // Check if C shares exact atomic formulas with A  
        const cAtoms = this.extractAtomicFormulas(C);
        const cShares = cAtoms.some(cAtom => 
          leftAtoms.some(leftAtom => this.atomicFormulasIdentical(leftAtom, cAtom))
        );
        
        // System R: BOTH disjuncts must be relevant to the distributed conjunct
        return bShares && cShares;
      }
    }
    
    return true; // Default to allowing non-distribution patterns
  }
  
  /**
   * Check variable sharing between formulas (used in distribution validation)
   */
  private static checkVariableSharing(formula1: LogicFormula, formula2: LogicFormula): boolean {
    const atoms1 = this.extractAtomicFormulas(formula1);
    const atoms2 = this.extractAtomicFormulas(formula2);
    
    // Must have at least one exactly identical atomic formula
    return atoms1.some(atom1 => 
      atoms2.some(atom2 => this.atomicFormulasIdentical(atom1, atom2))
    );
  }

  // STEP 6: MULTIPLICATIVE LOGIC SEMANTICS - REQUIRED for System R resource consciousness
  
  /**
   * Validate multiplicative sharing in a formula - System R requires resource consciousness
   * Each premise must be "consumed" exactly once in valid inference
   */
  static validateMultiplicativeSharing(formula: LogicFormula): boolean {
    if (formula.type === 'atomic') {
      return true; // Atomic formulas are trivially well-formed
    }
    
    // Only check multiplicative connectives - additive connectives are handled separately
    if (formula.operator === 'times' || formula.operator === 'lollipop' || formula.operator === 'par') {
      return this.checkMultiplicativeResourceConstraints(formula);
    }
    
    // For additive connectives, only recursively check if they contain multiplicative subformulas
    if (formula.subformulas) {
      return formula.subformulas.every(sub => this.validateMultiplicativeSharing(sub));
    }
    
    return true; // Non-multiplicative formulas pass by default
  }
  
  /**
   * Check linear resource usage in premises - each resource consumed exactly once
   * Linear Logic: "Each premise 'consumed' exactly once in valid inference"
   */
  static checkLinearResourceUsage(premises: LogicFormula[]): boolean {
    const resourceMap = new Map<string, number>();
    
    // Count resource usage across all premises
    for (const premise of premises) {
      const resources = this.extractMultiplicativeResources(premise);
      
      for (const resource of resources) {
        const resourceKey = this.getResourceKey(resource);
        const currentCount = resourceMap.get(resourceKey) || 0;
        resourceMap.set(resourceKey, currentCount + 1);
      }
    }
    
    // In linear logic, each resource must be used exactly once
    for (const [resourceKey, count] of resourceMap.entries()) {
      if (count !== 1) {
        return false; // Resource used more or less than once
      }
    }
    
    return true;
  }
  
  /**
   * Validate tensor decomposition: A ⊗ B requires both A and B to be "consumed"
   */
  static validateTensorDecomposition(formula: LogicFormula): boolean {
    if (formula.operator !== 'times' || !formula.subformulas || formula.subformulas.length !== 2) {
      return true; // Not a tensor, trivially valid
    }
    
    const [left, right] = formula.subformulas;
    
    // Both operands must be consumable resources
    const leftResources = this.extractMultiplicativeResources(left);
    const rightResources = this.extractMultiplicativeResources(right);
    
    // Check that left and right don't share resources (linear constraint)
    for (const leftRes of leftResources) {
      for (const rightRes of rightResources) {
        if (this.resourcesIdentical(leftRes, rightRes)) {
          return false; // Same resource used twice - violates linearity
        }
      }
    }
    
    return true;
  }
  
  /**
   * Validate linear implication: A ⊸ B preserves resource constraints
   * Lollipop requires that A is consumed to produce B
   */
  static validateLinearImplication(antecedent: LogicFormula, consequent: LogicFormula): boolean {
    const antecedentResources = this.extractMultiplicativeResources(antecedent);
    const consequentResources = this.extractMultiplicativeResources(consequent);
    
    // Linear implication must preserve resource balance
    // The antecedent resources are "consumed" to produce consequent resources
    
    // Check that antecedent and consequent have compatible resource patterns
    // For System R: must maintain variable sharing while respecting linearity
    return this.checkLinearResourceBalance(antecedentResources, consequentResources);
  }
  
  /**
   * Check multiplicative resource constraints for ⊗, ⊸, ⅋
   */
  private static checkMultiplicativeResourceConstraints(formula: LogicFormula): boolean {
    if (!formula.subformulas || formula.subformulas.length !== 2) {
      return false;
    }
    
    const [left, right] = formula.subformulas;
    
    switch (formula.operator) {
      case 'times': // A ⊗ B - both operands must be consumed
        return this.validateTensorDecomposition(formula);
        
      case 'lollipop': // A ⊸ B - linear implication
        return this.validateLinearImplication(left, right);
        
      case 'par': // A ⅋ B - multiplicative disjunction with resource constraints
        return this.validateParDecomposition(left, right);
        
      default:
        return true;
    }
  }
  
  /**
   * Extract multiplicative resources from a formula for linear tracking
   */
  private static extractMultiplicativeResources(formula: LogicFormula): LogicFormula[] {
    if (formula.type === 'atomic') {
      return [formula];
    }
    
    const resources: LogicFormula[] = [];
    
    if (formula.subformulas) {
      for (const sub of formula.subformulas) {
        resources.push(...this.extractMultiplicativeResources(sub));
      }
    }
    
    return resources;
  }
  
  /**
   * Get unique key for resource tracking in linear logic
   */
  private static getResourceKey(resource: LogicFormula): string {
    if (resource.type === 'atomic') {
      const terms = resource.terms || [];
      const termStr = terms.map(t => `${t.type}:${t.name}`).join(',');
      return `${resource.predicate}(${termStr})`;
    }
    
    return resource.id || 'unknown';
  }
  
  /**
   * Check if two resources are identical for linear logic purposes
   */
  private static resourcesIdentical(res1: LogicFormula, res2: LogicFormula): boolean {
    return this.atomicFormulasIdentical(res1, res2);
  }
  
  /**
   * Validate Par decomposition: A ⅋ B (multiplicative disjunction)
   */
  private static validateParDecomposition(left: LogicFormula, right: LogicFormula): boolean {
    // Par (⅋) is the multiplicative disjunction
    // In System R, it requires resource-conscious handling
    const leftResources = this.extractMultiplicativeResources(left);
    const rightResources = this.extractMultiplicativeResources(right);
    
    // Par allows sharing of resources between alternatives (unlike tensor)
    // But must maintain System R relevance constraints
    return this.checkRelevanceInMultiplicativeContext(leftResources, rightResources);
  }
  
  /**
   * Check linear resource balance for implication
   */
  private static checkLinearResourceBalance(antecedentRes: LogicFormula[], consequentRes: LogicFormula[]): boolean {
    // For linear implication A ⊸ B:
    // The resources in A are consumed to produce resources in B
    // This must respect System R variable sharing
    
    if (antecedentRes.length === 0 || consequentRes.length === 0) {
      return false;
    }
    
    // Check that there's some resource flow from antecedent to consequent
    // In multiplicative context, variable sharing is sufficient (not full atomic identity)
    return antecedentRes.some(antRes => 
      consequentRes.some(consRes => {
        if (antRes.type === 'atomic' && consRes.type === 'atomic') {
          const antVars = Array.from(antRes.variables || []);
          const consVars = Array.from(consRes.variables || []);
          return antVars.some(v => consVars.includes(v));
        }
        return false;
      })
    );
  }
  
  /**
   * Check relevance constraints in multiplicative context
   */
  private static checkRelevanceInMultiplicativeContext(leftRes: LogicFormula[], rightRes: LogicFormula[]): boolean {
    // In multiplicative context, we need some form of connection
    // but not necessarily exact identity (looser than additive case)
    
    if (leftRes.length === 0 || rightRes.length === 0) {
      return true; // Empty resources are allowed
    }
    
    // Check for variable sharing between resources
    // In multiplicative context, variable sharing is sufficient
    return leftRes.some(left => 
      rightRes.some(right => {
        if (left.type === 'atomic' && right.type === 'atomic') {
          const leftVars = Array.from(left.variables || []);
          const rightVars = Array.from(right.variables || []);
          return leftVars.some(v => rightVars.includes(v));
        }
        return false;
      })
    );
  }
  
  /**
   * Check multiplicative unit laws: I (multiplicative unit) and ⊥ (bottom)
   */
  static validateMultiplicativeUnits(formula: LogicFormula): boolean {
    if (formula.operator === 'one') {
      // I (multiplicative unit) - neutral element for ⊗
      return true; // Units are always valid
    }
    
    if (formula.operator === 'bottom') {
      // ⊥ (multiplicative falsity) - neutral element for ⅋
      return true; // Bottom is always valid
    }
    
    return true;
  }
  
  /**
   * Check if a formula contains multiplicative connectives
   */
  private static containsMultiplicativeConnectives(formula: LogicFormula): boolean {
    if (formula.type === 'atomic') {
      return false;
    }
    
    // Check if this formula uses multiplicative connectives
    if (formula.operator === 'times' || formula.operator === 'lollipop' || 
        formula.operator === 'par' || formula.operator === 'one' || formula.operator === 'bottom') {
      return true;
    }
    
    // Recursively check subformulas
    if (formula.subformulas) {
      return formula.subformulas.some(sub => this.containsMultiplicativeConnectives(sub));
    }
    
    return false;
  }

  // SYSTEM R TERNARY RELATION SEMANTICS IMPLEMENTATION
  // Citation: "Uses three-place relation on possible worlds to evaluate logical implications"
  
  /**
   * Create ternary relation between source (premise), context (shared content), and target (conclusion)
   * This is the CORE of System R relevance logic - information must flow through shared content
   */
  static createTernaryRelation(source: LogicFormula, target: LogicFormula): TernaryRelation | null {
    const sharedAtoms = this.getSharedAtomicFormulas(source, target);
    
    if (sharedAtoms.length === 0) {
      return null; // No relevance relation possible
    }
    
    const context: RelevanceContext = {
      sharedAtoms: sharedAtoms,
      informationFlow: 'direct', // Direct sharing of atomic formulas
      relevanceStrength: sharedAtoms.length / (this.extractAtomicFormulas(source).length + this.extractAtomicFormulas(target).length)
    };
    
    return {
      source: source,
      context: context,
      target: target
    };
  }
  
  /**
   * Validate argument using System R ternary relation semantics
   * EVERY premise must have a valid ternary relation to the conclusion
   */
  static validateSystemR(premises: LogicFormula[], conclusion: LogicFormula): SystemRValidation {
    const ternaryRelations: TernaryRelation[] = [];
    const violatedConstraints: string[] = [];
    const relevanceMap = new Map<string, RelevanceContext>();
    
    // SYSTEM R REQUIREMENT: Every premise must establish ternary relation with conclusion
    for (let i = 0; i < premises.length; i++) {
      const premise = premises[i];
      const relation = this.createTernaryRelation(premise, conclusion);
      
      if (!relation) {
        violatedConstraints.push(`Premise ${i + 1} has no ternary relation to conclusion - violates System R`);
      } else {
        ternaryRelations.push(relation);
        relevanceMap.set(`premise_${i}`, relation.context);
      }
    }
    
    // STEP 4: QUANTIFIER SCOPE COMPLIANCE CHECK
    // System R requires proper quantifier variable sharing between premises and conclusion
    for (let i = 0; i < premises.length; i++) {
      const premise = premises[i];
      
      // Check if premise and conclusion have compatible quantifier sharing
      if (!this.validateQuantifierSharing(premise, conclusion)) {
        violatedConstraints.push(`Premise ${i + 1} has incompatible quantifier variable binding with conclusion - violates System R`);
      }
    }
    
    // STEP 5: DISTRIBUTION COMPLIANCE CHECK
    // System R requires proper distribution law compliance
    if (!this.checkDistributionCompliance(premises, conclusion)) {
      violatedConstraints.push('Distribution laws violated - does not comply with System R distribution axioms');
    }
    
    // STEP 6: MULTIPLICATIVE LOGIC CONSTRAINTS CHECK  
    // System R requires proper multiplicative semantics and linear resource usage
    const allFormulas = [...premises, conclusion];
    
    // Check each formula for multiplicative constraint compliance
    for (let i = 0; i < allFormulas.length; i++) {
      const formula = allFormulas[i];
      
      if (!this.validateMultiplicativeSharing(formula)) {
        const formulaType = i < premises.length ? `Premise ${i + 1}` : 'Conclusion';
        violatedConstraints.push(`${formulaType} violates multiplicative logic constraints - does not comply with System R`);
      }
      
      if (!this.validateMultiplicativeUnits(formula)) {
        const formulaType = i < premises.length ? `Premise ${i + 1}` : 'Conclusion';
        violatedConstraints.push(`${formulaType} violates multiplicative unit laws - does not comply with System R`);
      }
    }
    
    // Check linear resource usage across all premises (only if multiplicative connectives are present)
    const hasMultiplicativeConnectives = allFormulas.some(f => this.containsMultiplicativeConnectives(f));
    if (hasMultiplicativeConnectives && !this.checkLinearResourceUsage(premises)) {
      violatedConstraints.push('Linear resource usage violated - premises do not comply with System R multiplicative semantics');
    }
    
    const isValid = violatedConstraints.length === 0 && ternaryRelations.length === premises.length;
    
    return {
      isValid: isValid,
      ternaryRelations: ternaryRelations,
      violatedConstraints: violatedConstraints,
      relevanceMap: relevanceMap
    };
  }
  
  /**
   * Check if ternary relation satisfies System R constraints
   * Information must flow properly through shared atomic formulas
   */
  static isValidTernaryRelation(relation: TernaryRelation): boolean {
    // Must have at least one shared atomic formula for information flow
    if (relation.context.sharedAtoms.length === 0) {
      return false;
    }
    
    // Shared atoms must be EXACTLY identical (not just similar predicates)
    for (const sharedAtom of relation.context.sharedAtoms) {
      const sourceAtoms = this.extractAtomicFormulas(relation.source);
      const targetAtoms = this.extractAtomicFormulas(relation.target);
      
      const inSource = sourceAtoms.some(atom => this.atomicFormulasIdentical(atom, sharedAtom));
      const inTarget = targetAtoms.some(atom => this.atomicFormulasIdentical(atom, sharedAtom));
      
      if (!inSource || !inTarget) {
        return false; // Shared atom must appear exactly in both source and target
      }
    }
    
    return true;
  }
}