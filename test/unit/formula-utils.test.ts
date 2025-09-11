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

  describe('validateSystemR', () => {
    test('validates single premise with exact sharing', () => {
      const premise = FormulaBuilder.atomic('mortal', [{ type: 'constant', name: 'socrates' }]);
      const conclusion = FormulaBuilder.atomic('mortal', [{ type: 'constant', name: 'socrates' }]);
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(true);
      expect(validation.ternaryRelations).toHaveLength(1);
    });

    test('REJECTS premise without exact sharing', () => {
      const premise = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'y' }]);
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('Premise 1 has no ternary relation to conclusion - violates System R');
    });

    test('requires ALL premises to share with conclusion', () => {
      const premise1 = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      const premise2 = FormulaBuilder.atomic('Q', [{ type: 'constant', name: 'b' }]); // No sharing
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      
      const validation = FormulaUtils.validateSystemR([premise1, premise2], conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('Premise 2 has no ternary relation to conclusion - violates System R');
    });

    test('REJECTS classical paradoxes - ex falso quodlibet', () => {
      const falseStatement = FormulaBuilder.atomic('false_premise', []);
      const arbitrary = FormulaBuilder.atomic('arbitrary_conclusion', []);
      
      const validation = FormulaUtils.validateSystemR([falseStatement], arbitrary);
      
      expect(validation.isValid).toBe(false);
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
      expect(validation.violatedConstraints).toContain('Premise 1 has incompatible quantifier variable binding with conclusion - violates System R');
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

    test('validateSystemR checks distribution compliance', () => {
      // Create a premise that violates distribution laws
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const ry = FormulaBuilder.atomic('R', [{ type: 'variable', name: 'y' }]);
      const sz = FormulaBuilder.atomic('S', [{ type: 'variable', name: 'z' }]);
      const irrelevantDisj = FormulaBuilder.compound('or', [ry, sz]);
      const premise = FormulaBuilder.compound('and', [px, irrelevantDisj]);
      const conclusion = px;
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('Distribution laws violated - does not comply with System R distribution axioms');
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
      
      expect(FormulaUtils.validateTensorDecomposition(tensor)).toBe(false);
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

    test('checkLinearResourceUsage validates unique resource consumption', () => {
      // Each resource used exactly once
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qy = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'y' }]);
      const premises = [px, qy];
      
      expect(FormulaUtils.checkLinearResourceUsage(premises)).toBe(true);
    });

    test('REJECTS linear resource usage with duplicate resources', () => {
      // Same resource used twice
      const px1 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const px2 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const premises = [px1, px2];
      
      expect(FormulaUtils.checkLinearResourceUsage(premises)).toBe(false);
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
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('Premise 1 violates multiplicative logic constraints - does not comply with System R');
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