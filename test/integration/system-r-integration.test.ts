/**
 * INTEGRATION TESTS - System R End-to-End
 * Tests combined functionality without server dependencies
 */

import { FormulaUtils, FormulaBuilder } from '../../src/logic/formula';
import { NaturalLanguageParser } from '../../src/parser/nlp-parser';

describe('System R Integration Tests', () => {
  let parser: NaturalLanguageParser;

  beforeEach(() => {
    parser = new NaturalLanguageParser();
  });

  describe('End-to-End Argument Validation', () => {
    test('validates proper logical connection', () => {
      const argument = `
        Premise 1: Essential(sharing_detection)
        Conclusion: Essential(sharing_detection)
      `;
      
      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;
      
      const validation = FormulaUtils.validateSystemR(premises, conclusion);
      
      expect(validation.isValid).toBe(true);
    });

    test('rejects irrelevant premises (Dog/Cat case)', () => {
      const argument = `
        Premise 1: Dog(fido)
        Premise 2: Cat(whiskers)  
        Premise 3: Essential(sharing_detection)
        Conclusion: Essential(sharing_detection)
      `;
      
      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;
      
      const validation = FormulaUtils.validateSystemR(premises, conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('Premise 1 has no ternary relation to conclusion - violates System R');
      expect(validation.violatedConstraints).toContain('Premise 2 has no ternary relation to conclusion - violates System R');
    });

    test('REJECTS complex formal logical input without exact sharing', () => {
      // This should FAIL in System R because:
      // Premise 1: P(x) ∧ Q(x) - contains Q(x)
      // Premise 2: Q(x) → R(x) - contains Q(x) and R(x)
      // Conclusion: R(x) - contains R(x)
      // But P(x) from premise 1 does NOT appear in conclusion
      // So premise 1 violates variable sharing principle
      const argument = `
        Premise 1: P(x) ∧ Q(x)
        Premise 2: Q(x) → R(x)  
        Conclusion: R(x)
      `;
      
      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;
      
      const validation = FormulaUtils.validateSystemR(premises, conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints.length).toBeGreaterThan(0);
    });

    test('REJECTS material implication paradox', () => {
      const argument = `
        Premise 1: moon_is_cheese
        Conclusion: raining_or_not
      `;
      
      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;
      
      const validation = FormulaUtils.validateSystemR(premises, conclusion);
      
      expect(validation.isValid).toBe(false);
    });
  });

  describe('System R Classical Paradox Prevention', () => {
    test('REJECTS weather premise as irrelevant', () => {
      const argument = `
        Premise 1: Weather(sunny)
        Premise 2: Essential(sharing_detection)
        Conclusion: Essential(sharing_detection)
      `;
      
      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;
      
      const validation = FormulaUtils.validateSystemR(premises, conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('Premise 1 has no ternary relation to conclusion - violates System R');
    });

    test('REJECTS multiple premises where not all share with conclusion', () => {
      // This should FAIL in System R because:
      // Premise 1: P(a) - does NOT appear in conclusion Q(a)
      // Premise 2: P(a) → Q(a) - contains both P(a) and Q(a)
      // Conclusion: Q(a)
      // System R requires ALL premises to share with conclusion
      // Premise 1 does not share atomic formula with conclusion
      const argument = `
        Premise 1: P(a)
        Premise 2: P(a) → Q(a)
        Conclusion: Q(a)
      `;
      
      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;
      
      const validation = FormulaUtils.validateSystemR(premises, conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('Premise 1 has no ternary relation to conclusion - violates System R');
    });
  });

  describe('Step 4: Quantifier Scope Integration Tests', () => {
    test('REJECTS quantified formulas with incompatible binding', () => {
      const argument = `
        Premise 1: ∀x(P(x))
        Conclusion: ∃x(P(x))
      `;
      
      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;
      
      const validation = FormulaUtils.validateSystemR(premises, conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('Premise 1 has incompatible quantifier variable binding with conclusion - violates System R');
    });

    test('accepts quantified formulas with compatible binding', () => {
      const argument = `
        Premise 1: ∀x(mortal(x))
        Conclusion: ∀x(mortal(x))
      `;
      
      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;
      
      const validation = FormulaUtils.validateSystemR(premises, conclusion);
      
      expect(validation.isValid).toBe(true);
    });

    test('REJECTS mixed quantifier types in complex formulas', () => {
      const argument = `
        Premise 1: ∀x(P(x) → Q(x))
        Conclusion: ∃x(P(x) → Q(x))
      `;
      
      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;
      
      const validation = FormulaUtils.validateSystemR(premises, conclusion);
      
      expect(validation.isValid).toBe(false);
    });
  });

  describe('Step 5: Distribution Axioms Integration Tests', () => {
    test('accepts proper conjunction distribution with exact atomic sharing', () => {
      // Build formulas directly to avoid parser issues with nested parentheses
      const essential = FormulaBuilder.atomic('Essential', [{ type: 'variable', name: 'x' }]);
      const essential2 = FormulaBuilder.atomic('Essential', [{ type: 'variable', name: 'x' }]);
      const essential3 = FormulaBuilder.atomic('Essential', [{ type: 'variable', name: 'x' }]);
      
      const disjunction = FormulaBuilder.compound('or', [essential2, essential3]);
      const premise = FormulaBuilder.compound('and', [essential, disjunction]);
      const conclusion = FormulaBuilder.atomic('Essential', [{ type: 'variable', name: 'x' }]);
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(true);
    });

    test('REJECTS distribution that breaks relevance principle', () => {
      const argument = `
        Premise 1: Essential(x) ∧ (Irrelevant(y) ∨ Unrelated(z))
        Conclusion: Essential(x)
      `;
      
      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;
      
      const validation = FormulaUtils.validateSystemR(premises, conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('Distribution laws violated - does not comply with System R distribution axioms');
    });

    test('validates distribution laws in complex formulas with atomic sharing', () => {
      // Build formulas directly to ensure proper atomic formula sharing
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const px2 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const px3 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      
      const disjunction = FormulaBuilder.compound('or', [px2, px3]);
      const premise = FormulaBuilder.compound('and', [px, disjunction]);
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(true);
    });

    test('REJECTS invalid distribution patterns', () => {
      const argument = `
        Premise 1: Dog(fido) ∧ (Cat(whiskers) ∨ Bird(tweety))
        Conclusion: Dog(fido)
      `;
      
      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;
      
      const validation = FormulaUtils.validateSystemR(premises, conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('Distribution laws violated - does not comply with System R distribution axioms');
    });
  });

  describe('Step 6: Multiplicative Logic Integration Tests', () => {
    test('accepts valid multiplicative tensor with distinct resources', () => {
      // Build P(x) ⊗ Q(y) - distinct resources, valid tensor
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qy = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'y' }]);
      const premise = FormulaBuilder.compound('times', [px, qy]);
      const conclusion = px; // Shares with premise
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(true);
    });

    test('REJECTS multiplicative tensor with duplicate resources', () => {
      // Build P(x) ⊗ P(x) - same resource used twice
      const px1 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const px2 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const premise = FormulaBuilder.compound('times', [px1, px2]);
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('Premise 1 violates multiplicative logic constraints - does not comply with System R');
    });

    test('validates linear implication with proper resource flow', () => {
      // Build P(x) ⊸ Q(x) - linear implication with variable sharing
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qx = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'x' }]);
      const premise = FormulaBuilder.compound('lollipop', [px, qx]);
      const conclusion = qx; // Shares with consequent
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(true);
    });

    test('REJECTS linear resource usage violation in multiplicative context', () => {
      // Use same multiplicative resource P(x) ⊗ I in multiple premises
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const unit = FormulaBuilder.compound('one', []);
      const multiplicativePremise1 = FormulaBuilder.compound('times', [px, unit]);
      
      const px2 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const unit2 = FormulaBuilder.compound('one', []);
      const multiplicativePremise2 = FormulaBuilder.compound('times', [px2, unit2]);
      
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      
      const validation = FormulaUtils.validateSystemR([multiplicativePremise1, multiplicativePremise2], conclusion);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('Linear resource usage violated - premises do not comply with System R multiplicative semantics');
    });

    test('validates multiplicative units in complex contexts', () => {
      // Build P(x) ⊗ I (tensor with multiplicative unit)
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const unit = FormulaBuilder.compound('one', []);
      const premise = FormulaBuilder.compound('times', [px, unit]);
      const conclusion = px;
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(true);
    });

    test('validates multiplicative Par with relevance constraints', () => {
      // Build P(x) ⅋ Q(x) - multiplicative disjunction with shared variable
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qx = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'x' }]);
      const premise = FormulaBuilder.compound('par', [px, qx]);
      const conclusion = px;
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(true);
    });

    test('validates complex multiplicative formula structure', () => {
      // Build (P(x) ⊗ Q(y)) ⊸ R(x) - complex multiplicative with proper flow
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qy = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'y' }]);
      const tensor = FormulaBuilder.compound('times', [px, qy]);
      const rx = FormulaBuilder.atomic('R', [{ type: 'variable', name: 'x' }]);
      const premise = FormulaBuilder.compound('lollipop', [tensor, rx]);
      const conclusion = rx;
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(true);
    });
  });
});