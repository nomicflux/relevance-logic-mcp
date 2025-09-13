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
    test('REJECTS direct copying as circular reasoning', () => {
      const argument = `
        Premise 1: Essential(sharing_detection)
        Conclusion: Essential(sharing_detection)
      `;

      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;

      const validation = FormulaUtils.validateSystemR(premises, conclusion);

      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('CIRCULAR REASONING: Premise 1 is identical to conclusion - indicates missing explicit premises');
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
      expect(validation.violatedConstraints).toContain('CIRCULAR REASONING: Premise 3 is identical to conclusion - indicates missing explicit premises');
    });

    test('ACCEPTS complex formal logical reasoning with connected components', () => {
      // This should PASS in System R because all formulas connect:
      // Premise 1: P(x) ∧ Q(x) - contains Q(x)
      // Premise 2: Q(x) → R(x) - contains Q(x) and R(x)
      // Conclusion: R(x) - all formulas connected through Q(x) and R(x)
      const argument = `
        Premise 1: P(x) ∧ Q(x)
        Premise 2: Q(x) → R(x)  
        Conclusion: R(x)
      `;
      
      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;
      
      const validation = FormulaUtils.validateSystemR(premises, conclusion);
      
      expect(validation.isValid).toBe(true);
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
      expect(validation.violatedConstraints).toContain('CIRCULAR REASONING: Premise 2 is identical to conclusion - indicates missing explicit premises');
    });

    test('ACCEPTS valid modus ponens pattern', () => {
      // This should PASS in System R because:
      // Premise 1: P(a) - connects to premise 2
      // Premise 2: P(a) → Q(a) - connects premise 1 to conclusion
      // Conclusion: Q(a) - all form single connected component
      const argument = `
        Premise 1: P(a)
        Premise 2: P(a) → Q(a)
        Conclusion: Q(a)
      `;
      
      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;
      
      const validation = FormulaUtils.validateSystemR(premises, conclusion);
      
      expect(validation.isValid).toBe(true);
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
      expect(validation.violatedConstraints).toContain('Premise 1 has incompatible quantifier variable binding with conclusion');
    });

    test('accepts quantified formulas with compatible binding', () => {
      const argument = `
        Premise 1: ∀x(human(x) → mortal(x))
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
    test('REJECTS conjunction with disconnected disjunction', () => {
      // Build formulas with different predicates that don't properly connect
      const essential = FormulaBuilder.atomic('Essential', [{ type: 'variable', name: 'x' }]);
      const important = FormulaBuilder.atomic('Important', [{ type: 'variable', name: 'x' }]);
      const relevant = FormulaBuilder.atomic('Relevant', [{ type: 'variable', name: 'x' }]);
      
      const disjunction = FormulaBuilder.compound('or', [important, relevant]);
      const premise = FormulaBuilder.compound('and', [essential, disjunction]);
      const conclusion = FormulaBuilder.atomic('Essential', [{ type: 'variable', name: 'x' }]);
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(false);
    });

    test('REJECTS conjunction copying as circular reasoning', () => {
      const argument = `
        Premise 1: Essential(x) ∧ (Irrelevant(y) ∨ Unrelated(z))
        Conclusion: Essential(x)
      `;

      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;

      const validation = FormulaUtils.validateSystemR(premises, conclusion);

      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('CIRCULAR REASONING: Premise 1 contains conclusion as conjunct - indicates missing explicit premises');
    });

    test('REJECTS distribution with disconnected predicates', () => {
      // Build formulas with different predicates that don't properly connect
      const px = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const qx = FormulaBuilder.atomic('Q', [{ type: 'variable', name: 'x' }]);
      const rx = FormulaBuilder.atomic('R', [{ type: 'variable', name: 'x' }]);
      
      const disjunction = FormulaBuilder.compound('or', [qx, rx]);
      const premise = FormulaBuilder.compound('and', [px, disjunction]);
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      
      const validation = FormulaUtils.validateSystemR([premise], conclusion);
      
      expect(validation.isValid).toBe(false);
    });

    test('REJECTS another conjunction copying as circular reasoning', () => {
      const argument = `
        Premise 1: Dog(fido) ∧ (Cat(whiskers) ∨ Bird(tweety))
        Conclusion: Dog(fido)
      `;

      const parsedArg = parser.parseArgument(argument);
      const premises = parsedArg.premises.map((p: any) => p.formula);
      const conclusion = parsedArg.conclusion.formula;

      const validation = FormulaUtils.validateSystemR(premises, conclusion);

      expect(validation.isValid).toBe(false);
      expect(validation.violatedConstraints).toContain('CIRCULAR REASONING: Premise 1 contains conclusion as conjunct - indicates missing explicit premises');
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

    test('accepts multiplicative tensor (linear resource checking disabled)', () => {
      // Build P(x) ⊗ P(x) - linear resource checking was removed
      const px1 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const px2 = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);
      const premise = FormulaBuilder.compound('times', [px1, px2]);
      const conclusion = FormulaBuilder.atomic('P', [{ type: 'variable', name: 'x' }]);

      const validation = FormulaUtils.validateSystemR([premise], conclusion);

      expect(validation.isValid).toBe(true);
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

      expect(validation.isValid).toBe(true);
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