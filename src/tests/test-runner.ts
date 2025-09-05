import { NaturalLanguageParser } from '../parser/nlp-parser.js';
import { RelevanceLogicProofEngine } from '../logic/proof-engine.js';
import { CounterexampleGenerator } from '../logic/counterexample.js';
import { FormulaUtils } from '../logic/formula.js';
import { testCases, reasoningChains, parseTestCases, TestCase } from './test-cases.js';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  expected: any;
  actual: any;
}

export class TestRunner {
  private parser: NaturalLanguageParser;
  private proofEngine: RelevanceLogicProofEngine;
  private counterexampleGenerator: CounterexampleGenerator;

  constructor() {
    this.parser = new NaturalLanguageParser();
    this.proofEngine = new RelevanceLogicProofEngine();
    this.counterexampleGenerator = new CounterexampleGenerator();
  }

  runAllTests(): TestResult[] {
    const results: TestResult[] = [];
    
    console.log('Running Argument Validation Tests...');
    results.push(...this.runArgumentTests());
    
    console.log('Running Reasoning Chain Tests...');
    results.push(...this.runReasoningChainTests());
    
    console.log('Running Parser Tests...');
    results.push(...this.runParserTests());
    
    return results;
  }

  runArgumentTests(): TestResult[] {
    const results: TestResult[] = [];
    
    for (const testCase of testCases) {
      try {
        const result = this.runArgumentTest(testCase);
        results.push(result);
      } catch (error) {
        results.push({
          name: testCase.name,
          passed: false,
          details: `Test failed with error: ${error}`,
          expected: { valid: testCase.expectedValid, relevant: testCase.expectedRelevant },
          actual: { error: error?.toString() }
        });
      }
    }
    
    return results;
  }

  private runArgumentTest(testCase: TestCase): TestResult {
    const parsedArg = this.parser.parseArgument(testCase.argument);
    const premises = parsedArg.premises.map(p => p.formula);
    const conclusion = parsedArg.conclusion.formula;
    
    const validation = this.proofEngine.validateArgument(
      { premises, conclusion }, 
      testCase.system
    );
    
    const validityMatches = validation.isValid === testCase.expectedValid;
    const relevanceMatches = validation.hasRelevance === testCase.expectedRelevant;
    
    const passed = validityMatches && relevanceMatches;
    
    let details = `${testCase.description}\n`;
    details += `Premises: ${premises.map(p => FormulaUtils.toString(p)).join(', ')}\n`;
    details += `Conclusion: ${FormulaUtils.toString(conclusion)}\n`;
    details += `Relevance Score: ${validation.relevanceScore.toFixed(3)}\n`;
    
    if (!validityMatches) {
      details += `❌ Validity mismatch: expected ${testCase.expectedValid}, got ${validation.isValid}\n`;
    }
    
    if (!relevanceMatches) {
      details += `❌ Relevance mismatch: expected ${testCase.expectedRelevant}, got ${validation.hasRelevance}\n`;
    }
    
    if (validation.errors.length > 0) {
      details += `Errors: ${validation.errors.join(', ')}\n`;
    }
    
    // Try to generate counterexample for invalid arguments
    if (!validation.isValid) {
      const counterexample = this.counterexampleGenerator.generateCounterexample({ premises, conclusion });
      if (counterexample) {
        details += `Counterexample found with ${counterexample.worlds.length} worlds\n`;
      }
    }
    
    return {
      name: testCase.name,
      passed,
      details,
      expected: { valid: testCase.expectedValid, relevant: testCase.expectedRelevant },
      actual: { valid: validation.isValid, relevant: validation.hasRelevance, score: validation.relevanceScore }
    };
  }

  runReasoningChainTests(): TestResult[] {
    const results: TestResult[] = [];
    
    for (const chainTest of reasoningChains) {
      try {
        const result = this.runReasoningChainTest(chainTest);
        results.push(result);
      } catch (error) {
        results.push({
          name: chainTest.name,
          passed: false,
          details: `Chain test failed with error: ${error}`,
          expected: { valid: chainTest.expectedValid },
          actual: { error: error?.toString() }
        });
      }
    }
    
    return results;
  }

  private runReasoningChainTest(chainTest: any): TestResult {
    const analyses: any[] = [];
    
    for (let i = 1; i < chainTest.steps.length; i++) {
      const premises = chainTest.steps.slice(0, i).map((s: string) => this.parser.parse(s).formula);
      const conclusion = this.parser.parse(chainTest.steps[i]).formula;
      
      const validation = this.proofEngine.validateArgument(
        { premises, conclusion }, 
        chainTest.system
      );
      
      analyses.push({
        step: i,
        statement: chainTest.steps[i],
        isValid: validation.isValid,
        hasRelevance: validation.hasRelevance,
        relevanceScore: validation.relevanceScore
      });
    }
    
    const overallValid = analyses.every(a => a.isValid);
    const passed = overallValid === chainTest.expectedValid;
    
    let details = `${chainTest.description}\n`;
    details += `Steps: ${chainTest.steps.join(' → ')}\n`;
    details += `Individual step validities: ${analyses.map(a => a.isValid).join(', ')}\n`;
    details += `Overall valid: ${overallValid}\n`;
    
    if (!passed) {
      details += `❌ Expected overall validity: ${chainTest.expectedValid}, got: ${overallValid}\n`;
    }
    
    return {
      name: chainTest.name,
      passed,
      details,
      expected: { valid: chainTest.expectedValid },
      actual: { valid: overallValid, analyses }
    };
  }

  runParserTests(): TestResult[] {
    const results: TestResult[] = [];
    
    for (const parseTest of parseTestCases) {
      try {
        const result = this.runParserTest(parseTest);
        results.push(result);
      } catch (error) {
        results.push({
          name: `Parse: ${parseTest.statement}`,
          passed: false,
          details: `Parser test failed with error: ${error}`,
          expected: parseTest,
          actual: { error: error?.toString() }
        });
      }
    }
    
    return results;
  }

  private runParserTest(parseTest: any): TestResult {
    const parsed = this.parser.parse(parseTest.statement);
    const symbolic = FormulaUtils.toString(parsed.formula);
    const variables = Array.from(parsed.formula.variables);
    const predicates = Array.from(parsed.formula.predicates);
    
    // Check if parsing was successful (confidence > 0.5)
    const parseSuccessful = parsed.confidence > 0.5;
    
    // For now, we'll focus on whether parsing succeeded and captured the right elements
    const variablesMatch = this.arraysEqual(variables.sort(), parseTest.expectedVariables.sort());
    const predicatesMatch = this.arraysEqual(predicates.sort(), parseTest.expectedPredicates.sort());
    
    const passed = parseSuccessful && variablesMatch && predicatesMatch;
    
    let details = `Statement: "${parseTest.statement}"\n`;
    details += `Parsed: ${symbolic}\n`;
    details += `Confidence: ${parsed.confidence.toFixed(3)}\n`;
    details += `Variables: [${variables.join(', ')}]\n`;
    details += `Predicates: [${predicates.join(', ')}]\n`;
    
    if (!parseSuccessful) {
      details += `❌ Low parsing confidence: ${parsed.confidence}\n`;
    }
    
    if (!variablesMatch) {
      details += `❌ Variables mismatch: expected [${parseTest.expectedVariables.join(', ')}], got [${variables.join(', ')}]\n`;
    }
    
    if (!predicatesMatch) {
      details += `❌ Predicates mismatch: expected [${parseTest.expectedPredicates.join(', ')}], got [${predicates.join(', ')}]\n`;
    }
    
    if (parsed.ambiguities.length > 0) {
      details += `Ambiguities: ${parsed.ambiguities.join(', ')}\n`;
    }
    
    return {
      name: `Parse: ${parseTest.statement}`,
      passed,
      details,
      expected: parseTest,
      actual: { symbolic, variables, predicates, confidence: parsed.confidence }
    };
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  generateTestReport(results: TestResult[]): string {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    let report = `\n=== TEST REPORT ===\n`;
    report += `Total Tests: ${totalTests}\n`;
    report += `Passed: ${passedTests}\n`;
    report += `Failed: ${failedTests}\n`;
    report += `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;
    
    // Group by test status
    const passed = results.filter(r => r.passed);
    const failed = results.filter(r => !r.passed);
    
    if (passed.length > 0) {
      report += `✅ PASSED TESTS (${passed.length}):\n`;
      passed.forEach(test => {
        report += `  • ${test.name}\n`;
      });
      report += `\n`;
    }
    
    if (failed.length > 0) {
      report += `❌ FAILED TESTS (${failed.length}):\n`;
      failed.forEach(test => {
        report += `  • ${test.name}\n`;
        report += `    ${test.details.split('\n')[0]}\n`;
      });
      report += `\n`;
    }
    
    // Category breakdown
    const categories = new Map<string, { passed: number, total: number }>();
    results.forEach(result => {
      const category = this.getTestCategory(result.name);
      if (!categories.has(category)) {
        categories.set(category, { passed: 0, total: 0 });
      }
      const cat = categories.get(category)!;
      cat.total++;
      if (result.passed) cat.passed++;
    });
    
    report += `📊 RESULTS BY CATEGORY:\n`;
    categories.forEach((stats, category) => {
      const rate = ((stats.passed / stats.total) * 100).toFixed(1);
      report += `  ${category}: ${stats.passed}/${stats.total} (${rate}%)\n`;
    });
    
    return report;
  }

  private getTestCategory(testName: string): string {
    if (testName.startsWith('Parse:')) return 'Parser Tests';
    if (testName.includes('Chain')) return 'Reasoning Chains';
    return 'Argument Validation';
  }
}

// Export for use as a tool or direct execution
export function runTests(): string {
  const runner = new TestRunner();
  const results = runner.runAllTests();
  return runner.generateTestReport(results);
}