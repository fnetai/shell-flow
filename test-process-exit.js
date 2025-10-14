// Test process.exit() behavior
console.log('Before process.exit(1)');
process.exit(1);
console.log('After process.exit(1) - THIS SHOULD NOT PRINT');

