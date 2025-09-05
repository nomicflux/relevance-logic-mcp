#!/usr/bin/env node

import { spawn } from 'child_process';

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
        } catch (e) {}
      }
      resolve(null);
    });

    const messages = [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, clientInfo: { name: "test", version: "1.0.0" }}},
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: toolName, arguments: args }}
    ];

    messages.forEach(msg => server.stdin.write(JSON.stringify(msg) + '\n'));
    server.stdin.end();
  });
}

async function testArguments() {
  console.log('🔍 Testing Invalid vs Valid Bird Arguments\n');
  
  // Test 1: Invalid argument (missing premise)
  console.log('❌ INVALID ARGUMENT (Missing Premise):');
  console.log('Premise: "All birds fly"');  
  console.log('Conclusion: "Sparrows fly"');
  console.log('Missing: "Sparrows are birds"\n');
  
  const invalid = await callTool('validate_argument', {
    argument: `All birds fly
Therefore, sparrows fly`
  });
  
  console.log('Result:', {
    valid: invalid.isValid,
    relevant: invalid.hasRelevance,
    score: invalid.relevanceScore,
    errors: invalid.errors
  });
  
  console.log('\n' + '─'.repeat(50) + '\n');
  
  // Test 2: Valid argument (complete premises)
  console.log('✅ VALID ARGUMENT (Complete Premises):');
  console.log('Premise 1: "All birds fly"');
  console.log('Premise 2: "Sparrows are birds"');
  console.log('Conclusion: "Sparrows fly"\n');
  
  const valid = await callTool('validate_argument', {
    argument: `All birds fly
Sparrows are birds  
Therefore, sparrows fly`
  });
  
  console.log('Result:', {
    valid: valid.isValid,
    relevant: valid.hasRelevance, 
    score: valid.relevanceScore,
    errors: valid.errors
  });
  
  console.log('\n' + '─'.repeat(50) + '\n');
  
  // Test 3: Check relevance directly
  console.log('🔍 RELEVANCE CHECK:');
  const relevance = await callTool('check_relevance', {
    premises: ["All birds fly"],
    conclusion: "Sparrows fly"
  });
  
  console.log('Premises: ["All birds fly"]');
  console.log('Conclusion: "Sparrows fly"');
  console.log('Has Relevance:', relevance.hasRelevance);
  console.log('Relevance Score:', relevance.overallRelevance);
  console.log('Details:', relevance.details.map(d => ({
    premise: d.premise,
    sharedVars: d.sharedVariables,
    strength: d.relevanceStrength
  })));
}

testArguments().catch(console.error);