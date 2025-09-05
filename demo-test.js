#!/usr/bin/env node

import { spawn } from 'child_process';

async function demo() {
  console.log('🚀 Relevance Logic MCP Server Demo\n');
  console.log('This demonstrates how the server prevents spurious logical inferences\n');
  
  const tests = [
    {
      name: "✅ VALID RELEVANT REASONING",
      description: "Shows proper logical connection",
      premises: ["Birds have wings", "Things with wings can fly"],
      conclusion: "Birds can fly"
    },
    {
      name: "❌ CLASSICAL PARADOX (Rejected by Relevance Logic)", 
      description: "Classical logic allows this, relevance logic rejects it",
      premises: ["The moon is made of cheese"],
      conclusion: "Either it is raining or it is not raining"
    },
    {
      name: "❌ TOPIC DRIFT (No Shared Variables)",
      description: "Premises and conclusion are logically unconnected", 
      premises: ["Cats are furry", "Furry animals are warm"],
      conclusion: "The stock market will rise"
    },
    {
      name: "✅ PROPER CONDITIONAL REASONING",
      description: "Shows relevant implication working correctly",
      statement: "If students study hard then students get good grades"
    }
  ];

  for (const test of tests) {
    console.log(`\n${test.name}`);
    console.log(`${test.description}\n`);
    
    if (test.premises) {
      await testRelevance(test.premises, test.conclusion);
    } else if (test.statement) {
      await testParsing(test.statement);
    }
    
    console.log('─'.repeat(60));
  }
  
  console.log('\n🎯 Summary: The server successfully identifies and prevents logically irrelevant inferences!');
}

async function testRelevance(premises, conclusion) {
  console.log(`Premises: ${premises.map(p => `"${p}"`).join(', ')}`);
  console.log(`Conclusion: "${conclusion}"`);
  
  const result = await callTool("check_relevance", { premises, conclusion });
  
  if (result.hasRelevance) {
    console.log(`✅ RELEVANT (score: ${result.overallRelevance.toFixed(3)})`);
    console.log('   The premises share logical variables with the conclusion');
  } else {
    console.log(`❌ NOT RELEVANT (score: ${result.overallRelevance.toFixed(3)})`);
    console.log('   No shared logical variables - inference blocked!');
  }
}

async function testParsing(statement) {
  console.log(`Statement: "${statement}"`);
  
  const result = await callTool("explain_formula", { statement });
  console.log(`Symbolic: ${result.symbolic}`);
  console.log(`Explanation: ${result.explanation}`);
}

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
      resolve({});
    });

    const messages = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize", 
        params: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          clientInfo: { name: "demo", version: "1.0.0" }
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

demo().catch(console.error);