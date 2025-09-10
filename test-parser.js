import { NaturalLanguageParser } from './build/parser/nlp-parser.js';

const parser = new NaturalLanguageParser();

console.log('Supported patterns:');
parser.getSupportedPatterns().forEach((pattern, i) => {
  console.log(`${i}: ${pattern}`);
});
console.log('\n');

// Test the problematic formal logical input from user
const testInput = `Premise 1: Correct(relevance_system) ∧ PartOf(sharing_detection, relevance_system)
Premise 2: PartOf(sharing_detection, relevance_system) → Essential(sharing_detection)
Conclusion: Essential(sharing_detection)`;

console.log('Testing formal logical input:');
console.log(testInput);
console.log('\n=== PARSING RESULT ===');

try {
  const result = parser.parseArgument(testInput);
  console.log('Premises found:', result.premises.length);
  result.premises.forEach((premise, i) => {
    console.log(`Premise ${i + 1}:`, premise.originalText);
    console.log('  Formula type:', premise.formula?.type);
    console.log('  Formula:', JSON.stringify(premise.formula, null, 2));
  });
  
  console.log('Conclusion:', result.conclusion.originalText);
  console.log('  Conclusion Formula:', JSON.stringify(result.conclusion.formula, null, 2));
} catch (error) {
  console.error('Parsing failed:', error.message);
}

// Test a simpler case
console.log('\n\n=== TESTING SIMPLER CASE ===');
const simpleTest = 'P(x) ∧ Q(y)';
try {
  const simpleResult = parser.parse(simpleTest);
  console.log('Simple test:', simpleTest);
  console.log('Result:', JSON.stringify(simpleResult, null, 2));
} catch (error) {
  console.error('Simple test failed:', error.message);
  console.error('Stack:', error.stack);
}