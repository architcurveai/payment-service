#!/usr/bin/env node

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('🚀 Starting Payment Service Test Suite...\n');

// Start the server
console.log('📡 Starting server...');
const server = spawn('node', ['src/app.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'test' }
});

let serverOutput = '';
server.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  console.log('SERVER:', output.trim());
});

server.stderr.on('data', (data) => {
  console.log('SERVER ERROR:', data.toString().trim());
});

// Wait for server to start
await setTimeout(3000);

console.log('\n🧪 Running basic functionality tests...\n');

// Run the test script
const testProcess = spawn('node', ['tmp_rovodev_test_basic.js'], {
  stdio: 'inherit'
});

testProcess.on('close', (code) => {
  console.log(`\n✅ Tests completed with exit code: ${code}`);
  
  // Kill the server
  server.kill('SIGTERM');
  
  console.log('\n📋 Test Summary:');
  console.log('- Server started successfully:', serverOutput.includes('Payment service running') ? '✅' : '❌');
  console.log('- Basic tests executed:', code === 0 ? '✅' : '❌');
  
  process.exit(code);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping tests...');
  server.kill('SIGTERM');
  process.exit(0);
});