#!/usr/bin/env node

import { spawn } from 'child_process';

async function testTool(toolName, args) {
  console.log(`\n=== Testing ${toolName} ===`);
  console.log('Input:', JSON.stringify(args, null, 2));
  
  const server = spawn('node', ['build/index.js'], { 
    stdio: ['pipe', 'pipe', 'pipe'] 
  });

  return new Promise((resolve) => {
    let response = '';
    
    server.stdout.on('data', (data) => {
      response += data.toString();
    });

    server.on('close', () => {
      try {
        const lines = response.trim().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.result && parsed.result.content) {
              const content = JSON.parse(parsed.result.content[0].text);
              console.log('Output:', JSON.stringify(content, null, 2));
              break;
            }
          } catch (e) {
            // Skip non-JSON lines
          }
        }
      } catch (error) {
        console.error('Error:', error.message);
      }
      resolve();
    });

    // MCP Protocol messages
    const messages = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          clientInfo: { name: "test", version: "1.0.0" }
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

async function runTests() {
  console.log('🧪 Testing Relevance Logic MCP Server\n');
  
  // Test 1: Simple parsing
  await testTool("parse_statement", {
    statement: "Dogs are animals"
  });

  // Test 2: Simple relevance check  
  await testTool("check_relevance", {
    premises: ["Dogs are loyal", "Loyal creatures make good pets"],
    conclusion: "Dogs make good pets"
  });

  // Test 3: Clear relevance violation
  await testTool("check_relevance", {
    premises: ["The moon is bright"],
    conclusion: "Mathematics is useful"
  });

  // Test 4: Formula explanation
  await testTool("explain_formula", {
    statement: "If it rains then plants grow"
  });

  console.log('\n✅ Tests completed!');
}

runTests().catch(console.error);