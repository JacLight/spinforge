#!/usr/bin/env node

console.log('Debug test starting...');

function testFunction() {
  const message = 'Set a breakpoint on this line';
  console.log(message);
  
  for (let i = 0; i < 5; i++) {
    console.log(`Iteration ${i}`);
  }
  
  return 'Debug test completed';
}

const result = testFunction();
console.log(result);