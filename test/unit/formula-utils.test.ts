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
});