/**
 * UNIT TESTS - FormulaUtils Implementation
 * Tests individual functions in isolation
 */

import { FormulaUtils, FormulaBuilder } from '../../src/logic/formula';

describe('FormulaUtils - Core Functions', () => {
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

  describe('validate', () => {
    test('ACCEPTS single connected component', () => {
      const premises = [FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }])];
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'b' }]);

      const result = FormulaUtils.validate(premises, conclusion);

      expect(result.isValid).toBe(true);
      expect(result.violatedConstraints).toHaveLength(0);
    });

    test('REJECTS disconnected premises', () => {
      const premises = [FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }])];
      const conclusion = FormulaBuilder.atomic('Q', [{ type: 'constant', name: 'b' }]);

      const result = FormulaUtils.validate(premises, conclusion);

      expect(result.isValid).toBe(false);
      expect(result.violatedConstraints[0]).toContain('DISCONNECTED');
    });

    test('REJECTS multiple disconnected premises', () => {
      const premises = [
        FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]),
        FormulaBuilder.atomic('Q', [{ type: 'constant', name: 'b' }])
      ];
      const conclusion = FormulaBuilder.atomic('R', [{ type: 'constant', name: 'c' }]);

      const result = FormulaUtils.validate(premises, conclusion);

      expect(result.isValid).toBe(false);
      expect(result.violatedConstraints[0]).toContain('DISCONNECTED');
    });

    test('REJECTS material implication paradox (no connection)', () => {
      const premises = [FormulaBuilder.atomic('P', [])];
      const conclusion = FormulaBuilder.atomic('Q', []);

      const result = FormulaUtils.validate(premises, conclusion);

      expect(result.isValid).toBe(false);
    });

    test('REJECTS circular reasoning - premise identical to conclusion', () => {
      const premise = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);

      const result = FormulaUtils.validate([premise], conclusion);

      expect(result.isValid).toBe(false);
      expect(result.violatedConstraints[0]).toContain('CIRCULAR REASONING');
    });

    test('REJECTS circular reasoning - conclusion in conjunction', () => {
      const conclusion = FormulaBuilder.atomic('Q', [{ type: 'constant', name: 'b' }]);
      const premise = FormulaBuilder.and(
        FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]),
        conclusion
      );

      const result = FormulaUtils.validate([premise], conclusion);

      expect(result.isValid).toBe(false);
      expect(result.violatedConstraints[0]).toContain('CIRCULAR REASONING');
    });
  });

  // Keep all the other non-atomic-sharing tests...
  describe('Step 4: Quantifier Scope Handling', () => {
    test('getQuantifierScope extracts forall scope correctly', () => {
      const innerFormula = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const quantifiedFormula = FormulaBuilder.forall('x', innerFormula);

      const scopes = FormulaUtils.getQuantifierScope(quantifiedFormula);

      expect(scopes).toHaveLength(1);
      expect(scopes[0].quantifier).toBe('forall');
      expect(scopes[0].boundVariable).toBe('x');
    });

    test('getQuantifierScope extracts exists scope correctly', () => {
      const innerFormula = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const quantifiedFormula = FormulaBuilder.exists('x', innerFormula);

      const scopes = FormulaUtils.getQuantifierScope(quantifiedFormula);

      expect(scopes).toHaveLength(1);
      expect(scopes[0].quantifier).toBe('exists');
      expect(scopes[0].boundVariable).toBe('x');
    });

    test('isVariableBound identifies bound variables correctly', () => {
      const innerFormula = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const quantifiedFormula = FormulaBuilder.forall('x', innerFormula);
      const scopes = FormulaUtils.getQuantifierScope(quantifiedFormula);

      expect(FormulaUtils.isVariableBound('x', scopes)).toBe(true);
      expect(FormulaUtils.isVariableBound('y', scopes)).toBe(false);
    });

    test('validateQuantifierSharing accepts compatible quantifier binding', () => {
      const premise = FormulaBuilder.forall('x', FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]));
      const conclusion = FormulaBuilder.forall('x', FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'x' }]));

      const result = FormulaUtils.validateQuantifierSharing(premise, conclusion);
      expect(result).toBe(true);
    });

    test('REJECTS incompatible quantifier binding', () => {
      const premise = FormulaBuilder.forall('x', FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]));
      const conclusion = FormulaBuilder.exists('x', FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'x' }]));

      const result = FormulaUtils.validateQuantifierSharing(premise, conclusion);
      expect(result).toBe(false);
    });

    test('validate checks quantifier scope compliance', () => {
      const premises = [FormulaBuilder.forall('x', FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]))];
      const conclusion = FormulaBuilder.exists('x', FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]));

      const result = FormulaUtils.validate(premises, conclusion);

      expect(result.isValid).toBe(false);
    });

    test('getFreeVariables uses proper scope detection', () => {
      const formula = FormulaBuilder.forall('x', FormulaBuilder.atomic('P', [
        { type: 'variable', name: 'x' },
        { type: 'variable', name: 'y' }
      ]));

      const freeVars = FormulaUtils.getFreeVariables(formula);

      expect(freeVars.has('x')).toBe(false); // x is bound
      expect(freeVars.has('y')).toBe(true);  // y is free
    });
  });

  describe('Step 5: Distribution Axioms', () => {
    test('validateDistribution accepts well-formed atomic formulas', () => {
      const formula = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);

      const result = FormulaUtils.validateDistribution(formula);
      expect(result).toBe(true);
    });

    test('validateDistribution accepts simple conjunction', () => {
      const left = FormulaBuilder.atomic('P', [{ type: 'constant', name: 'a' }]);
      const right = FormulaBuilder.atomic('Q', [{ type: 'constant', name: 'b' }]);
      const formula = FormulaBuilder.and(left, right);

      const result = FormulaUtils.validateDistribution(formula);
      expect(result).toBe(true);
    });

    test('applyConjunctionDistribution transforms A ∧ (B ∨ C)', () => {
      const A = FormulaBuilder.atomic('A', []);
      const B = FormulaBuilder.atomic('B', []);
      const C = FormulaBuilder.atomic('C', []);
      const disjunction = FormulaBuilder.or(B, C);
      const conjunction = FormulaBuilder.and(A, disjunction);

      const transformations = FormulaUtils.applyDistributionLaws(conjunction);

      expect(transformations.length).toBeGreaterThan(0);
    });

    test('checkDistributionCompliance validates premise-conclusion distribution', () => {
      const premises = [FormulaBuilder.atomic('P', [])];
      const conclusion = FormulaBuilder.atomic('P', []);

      const result = FormulaUtils.checkDistributionCompliance(premises, conclusion);
      expect(result).toBe(true);
    });


    test('validate detects circular reasoning in conjunctions', () => {
      const conclusion = FormulaBuilder.atomic('Q', []);
      const premise = FormulaBuilder.and(
        FormulaBuilder.atomic('P', []),
        conclusion
      );

      const result = FormulaUtils.validate([premise], conclusion);

      expect(result.isValid).toBe(false);
      expect(result.violatedConstraints[0]).toContain('CIRCULAR REASONING');
    });

    test('distribution laws maintain relations with exact atomic sharing', () => {
      const premises = [FormulaBuilder.atomic('P', [])];
      const conclusion = FormulaBuilder.atomic('P', []);

      const result = FormulaUtils.checkDistributionCompliance(premises, conclusion);
      expect(result).toBe(true);
    });


  });
});