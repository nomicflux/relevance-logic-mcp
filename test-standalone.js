// Simple test to verify standalone rlmcp_reason functionality
const test_data = {
  without_evidence: {
    name: "rlmcp_reason",
    arguments: {
      task: "All mammals are warm-blooded. Dolphins are mammals. Therefore dolphins are warm-blooded."
    }
  },
  with_evidence: {
    name: "rlmcp_reason", 
    arguments: {
      task: "All mammals are warm-blooded. Dolphins are mammals. Therefore dolphins are warm-blooded using evidence."
    }
  }
};

console.log("Test data prepared:");
console.log("1. Without evidence:", JSON.stringify(test_data.without_evidence, null, 2));
console.log("2. With evidence:", JSON.stringify(test_data.with_evidence, null, 2));