/**
 * INTEGRATION TESTS - System R End-to-End
 * Tests combined functionality without server dependencies
 */

import { FormulaUtils } from '../../src/logic/formula';
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
});