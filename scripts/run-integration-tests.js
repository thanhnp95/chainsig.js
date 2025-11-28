#!/usr/bin/env node

/**
 * Integration Test Runner for chainsig.js
 * 
 * This script replaces the previous shell script with a cross-platform Node.js version.
 * It sets up the necessary environment variables and runs the integration tests.
 */

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const params = {};
let testType = 'solana'; // Default test type

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--help') {
    showHelp();
    process.exit(0);
  } else if (arg === '--near-account' && i + 1 < args.length) {
    params.NEAR_ACCOUNT_ID = args[++i];
  } else if (arg === '--near-key' && i + 1 < args.length) {
    params.NEAR_PRIVATE_KEY = args[++i];
  } else if (arg === '--solana-address' && i + 1 < args.length) {
    params.SOLANA_TEST_ADDRESS = args[++i];
  } else if (arg === '--solana-recipient' && i + 1 < args.length) {
    params.SOLANA_RECIPIENT_ADDRESS = args[++i];
  } else if (arg === '--mpc-contract' && i + 1 < args.length) {
    params.MPC_CONTRACT_ID = args[++i];
  } else if (arg === '--evm-rpc' && i + 1 < args.length) {
    params.EVM_RPC_URL = args[++i];
  } else if (arg === '--type' && i + 1 < args.length) {
    testType = args[++i].toLowerCase();
    if (!['solana', 'evm', 'bitcoin', 'cosmos', 'decred', 'all'].includes(testType)) {
      console.error(`Unknown test type: ${testType}`);
      showHelp();
      process.exit(1);
    }
  } else {
    console.error(`Unknown option: ${arg}`);
    showHelp();
    process.exit(1);
  }
}

// Set default values
params.NEAR_ACCOUNT_ID = params.NEAR_ACCOUNT_ID || 'gregx.testnet';
params.MPC_CONTRACT_ID = params.MPC_CONTRACT_ID || 'v1.signer-prod.testnet';
params.INTEGRATION_TEST = 'true';

// Log configuration
console.log('=== Integration Test Configuration ===');
console.log(`Test Type: ${testType}`);
console.log(`NEAR Account ID: ${params.NEAR_ACCOUNT_ID}`);
console.log(`MPC Contract ID: ${params.MPC_CONTRACT_ID}`);

if (params.NEAR_PRIVATE_KEY) {
  console.log(`NEAR Private Key: ${params.NEAR_PRIVATE_KEY.substring(0, 5)}... (${params.NEAR_PRIVATE_KEY.length} chars)`);
} else {
  console.log('NEAR Private Key: Not specified');
}

if (testType === 'solana' || testType === 'all') {
  console.log(`Solana Test Address: ${params.SOLANA_TEST_ADDRESS || 'Not specified'}`);
  console.log(`Solana Recipient Address: ${params.SOLANA_RECIPIENT_ADDRESS || 'Not specified'}`);
}

if (testType === 'evm' || testType === 'all') {
  console.log(`EVM RPC URL: ${params.EVM_RPC_URL || 'Using default (http://127.0.0.1:8545)'}`);
}

console.log('==================================');

// Run the tests
const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
const logFile = `integration_test_log_${testType}_${timestamp}.txt`;

console.log(`Running ${testType} integration tests... (logging to ${logFile})`);

// Set up environment for Jest
const env = {
  ...process.env,
  ...params,
  NODE_OPTIONS: '--experimental-vm-modules --no-warnings'
};

// Determine the test pattern based on the test type
let testPattern;
if (testType === 'all') {
  testPattern = '__tests__/*/Integration.test.ts';
} else {
  testPattern = `__tests__/${testType}/Integration.test.ts`;
}

// Run the tests using Jest
const result = spawnSync(
  'npx', 
  ['jest', '-c', 'jest.config.ts', testPattern, '--verbose'],
  {
    stdio: 'inherit',
    env,
    shell: true
  }
);

if (result.error) {
  console.error('Error running tests:', result.error);
  process.exit(1);
}

console.log(`\nIntegration tests completed. Log saved to ${logFile}`);
process.exit(result.status);

function showHelp() {
  console.log('Integration Test Runner for chainsig.js');
  console.log('');
  console.log('Usage: node scripts/run-integration-tests.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --type TYPE                 Specify test type: solana, evm, bitcoin, cosmos, decred or all (default: solana)');
  console.log('  --near-account ACCOUNT_ID   Specify NEAR account ID (default: gregx.testnet)');
  console.log('  --near-key PRIVATE_KEY      Specify NEAR private key');
  console.log('  --mpc-contract CONTRACT_ID  Specify MPC contract ID (default: v1.signer-prod.testnet)');
  console.log('  --solana-address ADDRESS    Specify Solana test address');
  console.log('  --solana-recipient ADDRESS  Specify Solana recipient address');
  console.log('  --evm-rpc URL               Specify EVM RPC URL (default: http://127.0.0.1:8545)');
  console.log('  --help                      Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/run-integration-tests.js --type evm --evm-rpc https://rpc.sepolia.org');
  console.log('  node scripts/run-integration-tests.js --near-account myaccount.testnet --near-key ed25519:...');
} 