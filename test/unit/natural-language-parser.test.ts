/**
 * UNIT TESTS - NaturalLanguageParser
 * Tests parser functionality in isolation
 */

import { NaturalLanguageParser } from '../../src/parser/nlp-parser';

describe('NaturalLanguageParser - Unit Tests', () => {
  let parser: NaturalLanguageParser;

  beforeEach(() => {
    parser = new NaturalLanguageParser();
  });

  describe('parse - Single Statements', () => {
    test('parses simple formal conjunction P(x) ∧ Q(y)', () => {
      const result = parser.parse('P(x) ∧ Q(y)');
      
      expect(result.formula.type).toBe('compound');
      expect(result.formula.operator).toBe('and');
      expect(result.formula.subformulas).toHaveLength(2);
    });

    test('parses formal implication P(x) → Q(y)', () => {
      const result = parser.parse('P(x) → Q(y)');
      
      expect(result.formula.type).toBe('compound');
      expect(result.formula.operator).toBe('implies');
    });

    test('parses atomic predicate P(a)', () => {
      const result = parser.parse('P(a)');

      expect(result.formula.type).toBe('atomic');
      expect(result.formula.predicate).toBe('P');
      expect(result.formula.terms).toHaveLength(1);
      expect(result.formula.terms![0].name).toBe('a');
    });

    test('parses because statement: "P because Q" → Q implies P', () => {
      const result = parser.parse('it rains because clouds are heavy');

      expect(result.formula.type).toBe('compound');
      expect(result.formula.operator).toBe('implies');
      expect(result.formula.subformulas).toHaveLength(2);

      // Antecedent should be "clouds are heavy"
      const antecedent = result.formula.subformulas![0];
      expect(antecedent.naturalLanguage).toContain('clouds are heavy');
    });

    test('parses nested if-then with conjunction: "if a and b then c"', () => {
      const result = parser.parse('if step1 and step2 then step3');

      expect(result.formula.type).toBe('compound');
      expect(result.formula.operator).toBe('implies');
      expect(result.formula.subformulas).toHaveLength(2);

      // Antecedent should be conjunction "step1 and step2"
      const antecedent = result.formula.subformulas![0];
      expect(antecedent.type).toBe('compound');
      expect(antecedent.operator).toBe('and');
      expect(antecedent.subformulas).toHaveLength(2);

      // Consequent should be "step3"
      const consequent = result.formula.subformulas![1];
      expect(consequent.type).toBe('atomic');
    });

    test('parses nested if-then with disjunction: "if a or b then c"', () => {
      const result = parser.parse('if task1 or task2 then task3');

      expect(result.formula.type).toBe('compound');
      expect(result.formula.operator).toBe('implies');
      expect(result.formula.subformulas).toHaveLength(2);

      // Antecedent should be disjunction "task1 or task2"
      const antecedent = result.formula.subformulas![0];
      expect(antecedent.type).toBe('compound');
      expect(antecedent.operator).toBe('or');
      expect(antecedent.subformulas).toHaveLength(2);

      // Consequent should be "task3"
      const consequent = result.formula.subformulas![1];
      expect(consequent.type).toBe('atomic');
    });

    test('parses enables statement: "A enables B" → A implies B', () => {
      const result = parser.parse('step1 enables step2');

      expect(result.formula.type).toBe('compound');
      expect(result.formula.operator).toBe('implies');
      expect(result.formula.subformulas).toHaveLength(2);
    });

    test('parses necessary statement: "A is necessary for B" → A implies B', () => {
      const result = parser.parse('authentication is necessary for access');

      expect(result.formula.type).toBe('compound');
      expect(result.formula.operator).toBe('implies');
      expect(result.formula.subformulas).toHaveLength(2);
    });

    test('parses once-then statement: "Once A, then B" → A implies B', () => {
      const result = parser.parse('once setup complete, then testing begins');

      expect(result.formula.type).toBe('compound');
      expect(result.formula.operator).toBe('implies');
      expect(result.formula.subformulas).toHaveLength(2);

      // Consequent should be "testing begins"
      const consequent = result.formula.subformulas![1];
      expect(consequent.naturalLanguage).toContain('testing begins');
    });

    test('parses because of statement: "P because of Q" → Q implies P', () => {
      const result = parser.parse('the plant grows because of sunlight');

      expect(result.formula.type).toBe('compound');
      expect(result.formula.operator).toBe('implies');
      expect(result.formula.subformulas).toHaveLength(2);

      // Antecedent should be "sunlight"
      const antecedent = result.formula.subformulas![0];
      expect(antecedent.naturalLanguage).toContain('sunlight');

      // Consequent should be "the plant grows"
      const consequent = result.formula.subformulas![1];
      expect(consequent.naturalLanguage).toContain('the plant grows');
    });
  });

  describe('parseArgument - Full Arguments', () => {
    test('parses structured argument format', () => {
      const argument = `
        Premise 1: P(a)
        Premise 2: Q(b)
        Conclusion: R(c)
      `;
      
      const result = parser.parseArgument(argument);
      
      expect(result.premises).toHaveLength(2);
      expect(result.conclusion).toBeDefined();
    });

    test('handles natural language with conclusion markers', () => {
      const argument = `
        Dogs are animals.
        Fido is a dog.
        Therefore, Fido is an animal.
      `;
      
      const result = parser.parseArgument(argument);
      
      expect(result.premises).toHaveLength(2);
      expect(result.conclusion.originalText.toLowerCase()).toContain('fido');
    });
  });
});