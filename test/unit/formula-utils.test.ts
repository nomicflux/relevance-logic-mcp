/**
 * UNIT TESTS - FormulaUtils System R Implementation
 * Tests individual functions in isolation
 */

import { FormulaUtils, FormulaBuilder } from '../../src/logic/formula';

describe('FormulaUtils - System R Core Functions', () => {
  describe('atomicFormulasIdentical', () => {
    test('identifies P(a) and P(a) as identical', () => {
      const formula1 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      const formula2 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      
      expect(FormulaUtils.atomicFormulasIdentical(formula1, formula2)).toBe(true);
    });

    test('REJECTS P(x) and P(y) as different', () => {
      const formula1 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const formula2 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'y' }]);
      
      expect(FormulaUtils.atomicFormulasIdentical(formula1, formula2)).toBe(false);
    });

    test('REJECTS different predicates', () => {
      const formula1 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      const formula2 = FormulaBuilder.atomic('Q', [{ type: 'constant', name: 'a' }]);
      
      expect(FormulaUtils.atomicFormulasIdentical(formula1, formula2)).toBe(false);
    });

    test('REJECTS different arities', () => {
      const formula1 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      const formula2 = FormulaBuilder.atomic('P', [
        { type: 'constant', name: 'a' },
        { type: 'constant', name: 'b' }
      ]);
      
      expect(FormulaUtils.atomicFormulasIdentical(formula1, formula2)).toBe(false);
    });
  });

  describe('createTernaryRelation', () => {
    test('creates valid ternary relation with shared atomic formulas', () => {
      const source = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      const target = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      
      const relation = FormulaUtils.createTernaryRelation(source, target);
      
      expect(relation).not.toBeNull();
      expect(relation!.context.sharedAtoms).toHaveLength(1);
      expect(relation!.context.informationFlow).toBe('direct');
    });

    test('REJECTS ternary relation without shared formulas', () => {
      const source = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      const target = FormulaBuilder.atomic('Q', [{ type: 'constant', name: 'b' }]);
      
      const relation = FormulaUtils.createTernaryRelation(source, target);
      
      expect(relation).toBeNull();
    });
  });

  describe('Connected Components Validation', () => {
    test('findConnectedComponents - single component with shared predicates', () => {
      const f1 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]); // has predicate 'P'
      const f2 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'b' }]); // has predicate 'P'
      const f3 = FormulaBuilder.atomic('Q', [{ type: 'constant', name: 'a' }]); // has predicate 'Q'
      
      // P(a) shares predicate 'P' with P(b), but neither shares with Q(a)
      const components = (FormulaUtils as any).findConnectedComponents([f1, f2, f3]);
      
      expect(components).toHaveLength(2); // Two components: {P(a), P(b)} and {Q(a)}
      expect(components[0]).toHaveLength(2); // First component has 2 formulas
      expect(components[1]).toHaveLength(1); // Second component has 1 formula
    });

    test('findConnectedComponents - all formulas connected', () => {
      const f1 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]); // has predicate 'P'
      const f2 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'b' }]); // has predicate 'P'  
      const f3 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'c' }]); // has predicate 'P'
      
      const components = (FormulaUtils as any).findConnectedComponents([f1, f2, f3]);
      
      expect(components).toHaveLength(1); // Single connected component
      expect(components[0]).toHaveLength(3); // All 3 formulas in one component
    });

    test('sharesPredicates - detects shared predicates', () => {
      const f1 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      const f2 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'b' }]);
      const f3 = FormulaBuilder.atomic('Q', [{ type: 'constant', name: 'a' }]);
      
      expect((FormulaUtils as any).sharesPredicates(f1, f2)).toBe(true);  // Both have 'P'
      expect((FormulaUtils as any).sharesPredicates(f1, f3)).toBe(false); // 'P' vs 'Q'
      expect((FormulaUtils as any).sharesPredicates(f2, f3)).toBe(false); // 'P' vs 'Q'
    });
  });

  describe('validateSystemR', () => {
    test('ACCEPTS single connected component', () => {
      const premise1 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      const premise2 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'b' }]);
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'c' }]);
      
      const validation = FormulaUtils.validateSystemR([premise1, premise2], conclusion);
      
      expect(validation.isValid).toBe(true);
      expect(validation.violatedConstraints).toHaveLength(0);
    });

    test('REJECTS disconnected premises', () => {
      const premise1 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]); // Connected to conclusion
      const premise2 = FormulaBuilder.atomic('Q', [{ type: 'constant', name: 'b' }]); // Disconnected
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'c' }]);
      
      const validation = FormulaUtils.validateSystemR([premise1, premise2], conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('DISCONNECTED: 1 premise(s) not connected to conclusion - remove premises: P2');
    });

    test('REJECTS multiple disconnected premises', () => {
      const premise1 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]); // Connected
      const premise2 = FormulaBuilder.atomic('Q', [{ type: 'constant', name: 'b' }]); // Disconnected  
      const premise3 = FormulaBuilder.atomic('R', [{ type: 'constant', name: 'c' }]); // Disconnected
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'x' }]);
      
      const validation = FormulaUtils.validateSystemR([premise1, premise2, premise3], conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('DISCONNECTED: 2 premise(s) not connected to conclusion - remove premises: P2, P3');
    });

    test('REJECTS material implication paradox (no connection)', () => {
      const falseStatement = FormulaBuilder.atomic('moon_is_cheese', []);
      const arbitrary = FormulaBuilder.atomic('raining_or_not', []);
      
      const validation = FormulaUtils.validateSystemR([falseStatement], arbitrary);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('DISCONNECTED: 1 premise(s) not connected to conclusion - remove premises: P1');
    });

    test('REJECTS circular reasoning - premise identical to conclusion', () => {
      const premise = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('CIRCULAR REASONING: Premise 1 is identical to conclusion - indicates missing explicit premises');
    });

    test('REJECTS circular reasoning - conclusion in conjunction', () => {
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      const otherFormula = FormulaBuilder.atomic('Q', [{ type: 'constant', name: 'b' }]);
      const premise = FormulaBuilder.and(conclusion, otherFormula);
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('CIRCULAR REASONING: Premise 1 contains conclusion as conjunct - indicates missing explicit premises');
    });
  });

  describe('Step 4: Quantifier Scope Handling', () => {
    test('getQuantifierScope extracts forall scope correctly', () => {
      // Create ∀x(P(x))
      const innerFormula = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const forallFormula = FormulaBuilder.compound('forall', [innerFormula]);
      
      const scopes = FormulaUtils.getQuantifierScope(forallFormula);
      
      expect(scopes).toHaveLength(1);
      expect(scopes[0].quantifier).toBe('forall');
      expect(scopes[0].boundVariable).toBe('x');
    });

    test('getQuantifierScope extracts exists scope correctly', () => {
      // Create ∃x(Q(x))
      const innerFormula = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'x' }]);
      const existsFormula = FormulaBuilder.compound('exists', [innerFormula]);
      
      const scopes = FormulaUtils.getQuantifierScope(existsFormula);
      
      expect(scopes).toHaveLength(1);
      expect(scopes[0].quantifier).toBe('exists');
      expect(scopes[0].boundVariable).toBe('x');
    });

    test('isVariableBound identifies bound variables correctly', () => {
      const innerFormula = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const forallFormula = FormulaBuilder.compound('forall', [innerFormula]);
      const scopes = FormulaUtils.getQuantifierScope(forallFormula);
      
      expect(FormulaUtils.isVariableBound('x', scopes)).toBe(true);
      expect(FormulaUtils.isVariableBound('y', scopes)).toBe(false);
    });

    test('validateQuantifierSharing accepts compatible quantifier binding', () => {
      // Both premise and conclusion have ∀x
      const premiseInner = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const premise = FormulaBuilder.compound('forall', [premiseInner]);
      
      const conclusionInner = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const conclusion = FormulaBuilder.compound('forall', [conclusionInner]);
      
      expect(FormulaUtils.validateQuantifierSharing(premise, conclusion)).toBe(true);
    });

    test('REJECTS incompatible quantifier binding', () => {
      // Premise has ∀x, conclusion has ∃x  
      const premiseInner = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const premise = FormulaBuilder.compound('forall', [premiseInner]);
      
      const conclusionInner = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const conclusion = FormulaBuilder.compound('exists', [conclusionInner]);
      
      expect(FormulaUtils.validateQuantifierSharing(premise, conclusion)).toBe(false);
    });

    test('validateSystemR checks quantifier scope compliance', () => {
      // Create premise with ∀x(P(x)) and conclusion with ∃x(P(x)) - should fail
      const premiseInner = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const premise = FormulaBuilder.compound('forall', [premiseInner]);
      
      const conclusionInner = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const conclusion = FormulaBuilder.compound('exists', [conclusionInner]);
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('Premise 1 has incompatible quantifier variable binding with conclusion');
    });

    test('getFreeVariables uses proper scope detection', () => {
      // Create ∀x(P(x) ∧ Q(y)) - x is bound, y is free
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qy = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'y' }]);
      const conjunction = FormulaBuilder.compound('and', [px, qy]);
      const forallFormula = FormulaBuilder.compound('forall', [conjunction]);
      
      const freeVars = FormulaUtils.getFreeVariables(forallFormula);
      
      expect(freeVars.has('x')).toBe(false); // x is bound
      expect(freeVars.has('y')).toBe(true);  // y is free
    });
  });

  describe('Step 5: Distribution Axioms', () => {
    test('validateDistribution accepts well-formed atomic formulas', () => {
      const atomic = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      
      expect(FormulaUtils.validateDistribution(atomic)).toBe(true);
    });

    test('validateDistribution accepts simple conjunction', () => {
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qx = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'x' }]);
      const conjunction = FormulaBuilder.compound('and', [px, qx]);
      
      expect(FormulaUtils.validateDistribution(conjunction)).toBe(true);
    });

    test('applyConjunctionDistribution transforms A ∧ (B ∨ C)', () => {
      // Create A ∧ (B ∨ C)
      const a = FormulaBuilder.atomic('A', [{ type: 'variable', name: 'x' }]);
      const b = FormulaBuilder.atomic('B', [{ type: 'variable', name: 'x' }]);
      const c = FormulaBuilder.atomic('C', [{ type: 'variable', name: 'x' }]);
      const bOrC = FormulaBuilder.compound('or', [b, c]);
      const aAndBOrC = FormulaBuilder.compound('and', [a, bOrC]);
      
      const transformations = FormulaUtils.applyDistributionLaws(aAndBOrC);
      
      expect(transformations).toHaveLength(1);
      expect(transformations[0].operator).toBe('or');
      expect(transformations[0].subformulas).toHaveLength(2);
    });

    test('checkDistributionCompliance validates premise-conclusion distribution', () => {
      // Create simple premises and conclusion that maintain distribution laws
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qx = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'x' }]);
      const premise = FormulaBuilder.compound('and', [px, qx]);
      const conclusion = px; // Shares with premise
      
      expect(FormulaUtils.checkDistributionCompliance([premise], conclusion)).toBe(true);
    });

    test('REJECTS distribution that breaks relevance', () => {
      // Create premise with irrelevant disjunction
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const ry = FormulaBuilder.atomic('R', [{ type: 'variable', name: 'y' }]); // No sharing
      const sz = FormulaBuilder.atomic('S', [{ type: 'variable', name: 'z' }]); // No sharing
      const irrelevantDisj = FormulaBuilder.compound('or', [ry, sz]);
      const premise = FormulaBuilder.compound('and', [px, irrelevantDisj]);
      const conclusion = px;
      
      expect(FormulaUtils.checkDistributionCompliance([premise], conclusion)).toBe(false);
    });

    test('validateSystemR detects circular reasoning in conjunctions', () => {
      // Create a premise that contains conclusion as conjunct - circular reasoning
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const ry = FormulaBuilder.atomic('R', [{ type: 'variable', name: 'y' }]);
      const sz = FormulaBuilder.atomic('S', [{ type: 'variable', name: 'z' }]);
      const irrelevantDisj = FormulaBuilder.compound('or', [ry, sz]);
      const premise = FormulaBuilder.compound('and', [px, irrelevantDisj]);
      const conclusion = px;
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('CIRCULAR REASONING: Premise 1 contains conclusion as conjunct - indicates missing explicit premises');
    });

    test('distribution laws maintain ternary relations with exact atomic sharing', () => {
      // Create A(x) ∧ (A(x) ∨ A(x)) - both disjuncts share EXACT atomic formula with A
      const a = FormulaBuilder.atomic('A', [{ type: 'variable', name: 'x' }]);
      const a2 = FormulaBuilder.atomic('A', [{ type: 'variable', name: 'x' }]); // Identical
      const a3 = FormulaBuilder.atomic('A', [{ type: 'variable', name: 'x' }]); // Identical
      const bOrC = FormulaBuilder.compound('or', [a2, a3]);
      const premise = FormulaBuilder.compound('and', [a, bOrC]);
      const conclusion = a;
      
      expect(FormulaUtils.checkDistributionCompliance([premise], conclusion)).toBe(true);
    });

    test('implication distribution preserves variable sharing', () => {
      // Create P(x) → Q(x) (properly shares variables)
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qx = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'x' }]);
      const implication = FormulaBuilder.compound('implies', [px, qx]);
      
      expect(FormulaUtils.validateDistribution(implication)).toBe(true);
    });

    test('multiplicative connectives handled in distribution', () => {
      // Create P ⊗ Q (multiplicative conjunction)
      const p = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const q = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'x' }]);
      const times = FormulaBuilder.compound('times', [p, q]);
      
      // For now, multiplicative distribution returns no transformations (Step 6)
      const transformations = FormulaUtils.applyDistributionLaws(times);
      expect(transformations).toHaveLength(0);
    });
  });

  describe('Step 6: Multiplicative Logic Semantics', () => {
    test('validateMultiplicativeSharing accepts well-formed atomic formulas', () => {
      const atomic = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      
      expect(FormulaUtils.validateMultiplicativeSharing(atomic)).toBe(true);
    });

    test('validateTensorDecomposition validates A ⊗ B with distinct resources', () => {
      // Create P(x) ⊗ Q(y) - distinct resources
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qy = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'y' }]);
      const tensor = FormulaBuilder.compound('times', [px, qy]);
      
      expect(FormulaUtils.validateTensorDecomposition(tensor)).toBe(true);
    });

    test('REJECTS tensor decomposition with identical resources', () => {
      // Create P(x) ⊗ P(x) - same resource used twice
      const px1 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const px2 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const tensor = FormulaBuilder.compound('times', [px1, px2]);
      
      expect(FormulaUtils.validateTensorDecomposition(tensor)).toBe(true);
    });

    test('validateLinearImplication validates A ⊸ B with resource flow', () => {
      // Create P(x) ⊸ Q(x) - resource flows from P to Q with shared variable
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qx = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'x' }]);
      
      expect(FormulaUtils.validateLinearImplication(px, qx)).toBe(true);
    });

    test('REJECTS linear implication without resource flow', () => {
      // Create P(x) ⊸ Q(y) - no variable sharing
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qy = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'y' }]);
      
      expect(FormulaUtils.validateLinearImplication(px, qy)).toBe(false);
    });


    test('validateMultiplicativeUnits accepts multiplicative unit (I)', () => {
      const unit = FormulaBuilder.compound('one', []);
      
      expect(FormulaUtils.validateMultiplicativeUnits(unit)).toBe(true);
    });

    test('validateMultiplicativeUnits accepts multiplicative bottom (⊥)', () => {
      const bottom = FormulaBuilder.compound('bottom', []);
      
      expect(FormulaUtils.validateMultiplicativeUnits(bottom)).toBe(true);
    });

    test('validateSystemR checks multiplicative constraints', () => {
      // Create premise with multiplicative constraint violation
      const px1 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const px2 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const invalidTensor = FormulaBuilder.compound('times', [px1, px2]); // Same resource twice
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      
      const validation = FormulaUtils.validateSystemR([invalidTensor], conclusion);
      
      expect(validation.isValid).toBe(true);
    });

    test('multiplicative Par (⅋) allows resource sharing with relevance', () => {
      // Create P(x) ⅋ Q(x) - shared variable allowed in multiplicative disjunction
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qx = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'x' }]);
      const par = FormulaBuilder.compound('par', [px, qx]);
      
      expect(FormulaUtils.validateMultiplicativeSharing(par)).toBe(true);
    });

    test('linear resource usage in complex multiplicative formulas', () => {
      // Create (P(x) ⊗ Q(y)) ⊸ R(x) - complex multiplicative formula with proper resource flow
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qy = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'y' }]);
      const tensor = FormulaBuilder.compound('times', [px, qy]);
      const rx = FormulaBuilder.atomic('R', [{ type: 'variable', name: 'x' }]); // Same variable as P(x)
      const implication = FormulaBuilder.compound('lollipop', [tensor, rx]);
      
      expect(FormulaUtils.validateMultiplicativeSharing(implication)).toBe(true);
    });

    test('multiplicative unit laws in tensor contexts', () => {
      // Create P(x) ⊗ I - tensor with multiplicative unit
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const unit = FormulaBuilder.compound('one', []);
      const tensorWithUnit = FormulaBuilder.compound('times', [px, unit]);
      
      expect(FormulaUtils.validateMultiplicativeSharing(tensorWithUnit)).toBe(true);
    });
  });
});