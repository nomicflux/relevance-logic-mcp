#!/usr/bin/env node

import { spawn } from 'child_process';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function callTool(toolName, args) {
  const server = spawn('node', ['build/index.js'], { 
    stdio: ['pipe', 'pipe', 'pipe'] 
  });

  return new Promise((resolve) => {
    let response = '';
    
    server.stdout.on('data', (data) => {
      response += data.toString();
    });

    server.on('close', () => {
      const lines = response.trim().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.result && parsed.result.content) {
            const content = JSON.parse(parsed.result.content[0].text);
            resolve(content);
            return;
          }
        } catch (e) {
          // Skip non-JSON lines
        }
      }
      resolve(null);
    });

    const messages = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize", 
        params: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          clientInfo: { name: "interactive", version: "1.0.0" }
        }
      },
      {
        jsonrpc: "2.0",
        id: 2, 
        method: "tools/call",
        params: { name: toolName, arguments: args }
      }
    ];

    messages.forEach(msg => {
      server.stdin.write(JSON.stringify(msg) + '\n');
    });
    server.stdin.end();
  });
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('🧠 Interactive Relevance Logic MCP Server Test');
  console.log('═══════════════════════════════════════════════\n');
  
  while (true) {
    console.log('\nAvailable commands:');
    console.log('1. parse <statement> - Parse natural language to logic');
    console.log('2. check <premise1>|<premise2>|... -> <conclusion> - Check relevance');
    console.log('3. explain <statement> - Explain logical formula');
    console.log('4. validate <argument> - Validate full argument');
    console.log('5. quit - Exit\n');
    
    const input = await question('Enter command: ');
    
    if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'q') {
      break;
    }
    
    try {
      if (input.startsWith('parse ')) {
        const statement = input.slice(6);
        console.log('\n📝 Parsing statement...');
        const result = await callTool('parse_statement', { statement });
        if (result) {
          console.log(`Original: "${result.original}"`);
          console.log(`Symbolic: ${result.symbolic}`);
          console.log(`Variables: [${result.variables.join(', ')}]`);
          console.log(`Predicates: [${result.predicates.join(', ')}]`);
          console.log(`Confidence: ${result.confidence}`);
        }
        
      } else if (input.includes(' -> ')) {
        const [premisePart, conclusion] = input.split(' -> ');
        const premises = premisePart.replace(/^\w+\s+/, '').split('|').map(s => s.trim());
        console.log('\n🔍 Checking relevance...');
        const result = await callTool('check_relevance', { premises, conclusion });
        if (result) {
          console.log(`Conclusion: ${result.conclusion}`);
          console.log(`Overall Relevance: ${result.overallRelevance.toFixed(3)}`);
          console.log(`Has Relevance: ${result.hasRelevance ? '✅' : '❌'}`);
          result.details.forEach((detail, idx) => {
            console.log(`  Premise ${idx + 1}: ${detail.premise}`);
            console.log(`    Shared variables: [${detail.sharedVariables.join(', ')}]`);
            console.log(`    Relevance strength: ${detail.relevanceStrength.toFixed(3)}`);
          });
        }
        
      } else if (input.startsWith('explain ')) {
        const statement = input.slice(8);
        console.log('\n💡 Explaining formula...');
        const result = await callTool('explain_formula', { statement });
        if (result) {
          console.log(`Statement: "${result.original}"`);
          console.log(`Symbolic: ${result.symbolic}`);
          console.log(`Explanation: ${result.explanation}`);
          console.log(`Complexity: ${result.complexity}`);
          console.log(`Free Variables: [${result.freeVariables.join(', ')}]`);
        }
        
      } else if (input.startsWith('validate ')) {
        const argument = input.slice(9).replace(/\|/g, '\n');
        console.log('\n⚖️ Validating argument...');
        const result = await callTool('validate_argument', { argument });
        if (result) {
          console.log(`Valid: ${result.isValid ? '✅' : '❌'}`);
          console.log(`Relevant: ${result.hasRelevance ? '✅' : '❌'}`);
          console.log(`Relevance Score: ${result.relevanceScore.toFixed(3)}`);
          if (result.errors.length > 0) {
            console.log(`Errors: ${result.errors.join(', ')}`);
          }
          console.log(`Premises: ${result.premises.join(', ')}`);
          console.log(`Conclusion: ${result.conclusion}`);
        }
        
      } else {
        console.log('❌ Invalid command. Try again.');
      }
      
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
  
  console.log('\n👋 Goodbye!');
  rl.close();
}

console.log('\nExample usage:');
console.log('parse All birds can fly');
console.log('check Dogs are loyal|Loyal animals make good pets -> Dogs make good pets');
console.log('explain If it rains then plants grow');
console.log('validate All mammals breathe air|Whales are mammals|Therefore, whales breathe air');

main().catch(console.error);