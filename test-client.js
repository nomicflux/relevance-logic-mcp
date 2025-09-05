#!/usr/bin/env node

import { spawn } from 'child_process';

class MCPClient {
  constructor() {
    this.messageId = 1;
  }

  async testServer() {
    console.log('🧪 Testing Relevance Logic MCP Server\n');
    
    // Test cases
    const tests = [
      {
        name: "Parse Statement",
        tool: "parse_statement",
        args: { statement: "All birds can fly" }
      },
      {
        name: "Valid Argument",
        tool: "validate_argument", 
        args: {
          argument: `All mammals need oxygen
Whales are mammals
Therefore, whales need oxygen`
        }
      },
      {
        name: "Relevance Violation", 
        tool: "validate_argument",
        args: {
          argument: `The moon is made of cheese
Therefore, either it is raining or it is not raining`
        }
      },
      {
        name: "Check Relevance",
        tool: "check_relevance",
        args: {
          premises: ["Dogs are animals", "Animals need food"],
          conclusion: "Dogs need food"
        }
      }
    ];

    for (const test of tests) {
      console.log(`\n=== ${test.name} ===`);
      await this.runTest(test.tool, test.args);
    }
  }

  async runTest(toolName, args) {
    const server = spawn('node', ['build/index.js'], { 
      stdio: ['pipe', 'pipe', 'pipe'] 
    });

    return new Promise((resolve, reject) => {
      let response = '';
      
      server.stdout.on('data', (data) => {
        response += data.toString();
      });

      server.stderr.on('data', (data) => {
        // Server logs go to stderr, we can ignore them for now
      });

      server.on('close', (code) => {
        try {
          const lines = response.trim().split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.result && parsed.result.content) {
                const content = JSON.parse(parsed.result.content[0].text);
                console.log(JSON.stringify(content, null, 2));
                break;
              }
            } catch (e) {
              // Skip non-JSON lines
            }
          }
        } catch (error) {
          console.error('Error parsing response:', error);
        }
        resolve();
      });

      // Initialize MCP session
      const initMessage = {
        jsonrpc: "2.0",
        id: this.messageId++,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          clientInfo: { name: "test-client", version: "1.0.0" }
        }
      };

      server.stdin.write(JSON.stringify(initMessage) + '\n');

      // List tools
      const listMessage = {
        jsonrpc: "2.0", 
        id: this.messageId++,
        method: "tools/list"
      };

      server.stdin.write(JSON.stringify(listMessage) + '\n');

      // Call the tool
      const toolMessage = {
        jsonrpc: "2.0",
        id: this.messageId++, 
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args
        }
      };

      server.stdin.write(JSON.stringify(toolMessage) + '\n');
      server.stdin.end();
    });
  }
}

const client = new MCPClient();
client.testServer().catch(console.error);