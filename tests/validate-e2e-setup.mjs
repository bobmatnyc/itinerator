#!/usr/bin/env node

/**
 * Validation script for E2E test setup
 * Checks that all required files and configurations are in place
 */

import { existsSync } from 'fs';
import { join } from 'path';

const requiredFiles = [
  'vitest.config.e2e.ts',
  '.env.test.example',
  'tests/config/models.ts',
  'tests/setup-e2e.ts',
  'tests/README.md',
  'tests/e2e/trip-designer/.gitkeep',
  'tests/e2e/help/.gitkeep',
  'tests/e2e/travel-agent/.gitkeep',
];

const optionalFiles = [
  '.env.test', // User should create this
];

console.log('🔍 Validating E2E test setup...\n');

let allValid = true;

// Check required files
console.log('Required files:');
for (const file of requiredFiles) {
  const exists = existsSync(file);
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${file}`);
  if (!exists) {
    allValid = false;
  }
}

console.log('\nOptional files:');
for (const file of optionalFiles) {
  const exists = existsSync(file);
  const status = exists ? '✅' : '⚠️';
  const message = exists ? file : `${file} (create from .env.test.example)`;
  console.log(`  ${status} ${message}`);
}

// Check package.json scripts
console.log('\nPackage.json scripts:');
import { readFileSync } from 'fs';
const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
const hasE2EScript = 'test:e2e' in packageJson.scripts;
console.log(`  ${hasE2EScript ? '✅' : '❌'} test:e2e script`);
if (!hasE2EScript) {
  allValid = false;
}

// Check .gitignore
console.log('\n.gitignore entries:');
const gitignore = readFileSync('.gitignore', 'utf-8');
const hasEnvTest = gitignore.includes('.env.test');
console.log(`  ${hasEnvTest ? '✅' : '❌'} .env.test excluded`);
if (!hasEnvTest) {
  allValid = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allValid) {
  console.log('✅ E2E test setup is valid!');
  console.log('\nNext steps:');
  console.log('1. Create .env.test from .env.test.example');
  console.log('2. Add your OpenRouter API key to .env.test');
  console.log('3. Start test server: cd viewer-svelte && npm run dev');
  console.log('4. Run E2E tests: npm run test:e2e');
  process.exit(0);
} else {
  console.log('❌ E2E test setup has issues. Please fix the missing files above.');
  process.exit(1);
}
