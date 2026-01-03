/**
 * Verification Test for Traveler Persona Agent
 * Quick smoke test to verify the agent framework is working
 *
 * Usage:
 *   npx tsx tests/e2e/verify-persona-agent.ts
 *
 * @module tests/e2e/verify-persona-agent
 */

import { PERSONAS } from './traveler-persona-agent.js';
import type { TravelerPersona } from './traveler-persona-agent.js';

/**
 * Verify persona definitions are valid
 */
function verifyPersonaDefinitions(): boolean {
  console.log('🔍 Verifying Persona Definitions...\n');

  let allValid = true;

  for (const persona of PERSONAS) {
    const issues: string[] = [];

    // Check required fields
    if (!persona.id) issues.push('Missing id');
    if (!persona.name) issues.push('Missing name');
    if (!persona.type) issues.push('Missing type');
    if (!persona.travelers || persona.travelers.length === 0) {
      issues.push('Missing travelers');
    }

    // Check preferences
    if (!persona.preferences) {
      issues.push('Missing preferences');
    } else {
      if (!persona.preferences.budget) issues.push('Missing budget');
      if (!persona.preferences.pace) issues.push('Missing pace');
      if (!persona.preferences.accommodation) issues.push('Missing accommodation');
      if (!persona.preferences.interests || persona.preferences.interests.length === 0) {
        issues.push('Missing interests');
      }
    }

    // Check trip request
    if (!persona.tripRequest) {
      issues.push('Missing tripRequest');
    } else {
      if (!persona.tripRequest.origin) issues.push('Missing origin');
      if (!persona.tripRequest.duration) issues.push('Missing duration');
    }

    // Check expectations
    if (!persona.expectations) {
      issues.push('Missing expectations');
    } else {
      if (typeof persona.expectations.minSegments !== 'number') {
        issues.push('Missing minSegments');
      }
      if (!persona.expectations.expectedSegmentTypes ||
          persona.expectations.expectedSegmentTypes.length === 0) {
        issues.push('Missing expectedSegmentTypes');
      }
    }

    // Report results
    if (issues.length > 0) {
      console.log(`❌ ${persona.name || persona.id}`);
      issues.forEach(issue => console.log(`   - ${issue}`));
      allValid = false;
    } else {
      console.log(`✅ ${persona.name} (${persona.id})`);
    }
  }

  console.log();
  return allValid;
}

/**
 * Verify environment setup
 */
function verifyEnvironment(): boolean {
  console.log('🔍 Verifying Environment...\n');

  let allValid = true;

  // Check OPENROUTER_API_KEY
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.log('❌ OPENROUTER_API_KEY not set');
    console.log('   Set with: export OPENROUTER_API_KEY="sk-or-v1-..."'); // pragma: allowlist secret
    allValid = false;
  } else if (apiKey.trim() === '') {
    console.log('❌ OPENROUTER_API_KEY is empty');
    allValid = false;
  } else {
    console.log('✅ OPENROUTER_API_KEY is set');
  }

  // Check Node version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (majorVersion < 20) {
    console.log(`❌ Node.js version ${nodeVersion} (requires >=20.0.0)`);
    allValid = false;
  } else {
    console.log(`✅ Node.js ${nodeVersion}`);
  }

  console.log();
  return allValid;
}

/**
 * Verify API server is accessible
 */
async function verifyAPIServer(): Promise<boolean> {
  console.log('🔍 Verifying API Server...\n');

  const apiUrl = process.env.VITE_API_URL || 'http://localhost:5176';
  const healthUrl = `${apiUrl}/api/v1/health`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      console.log(`✅ API server is running at ${apiUrl}`);
      const data = await response.json();
      console.log(`   Status: ${data.status || 'healthy'}`);
      console.log();
      return true;
    } else {
      console.log(`❌ API server returned ${response.status}`);
      console.log();
      return false;
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`❌ API server timeout at ${apiUrl}`);
    } else {
      console.log(`❌ Cannot connect to API server at ${apiUrl}`);
    }
    console.log('   Start server with: cd viewer-svelte && npm run dev');
    console.log();
    return false;
  }
}

/**
 * Verify results directory exists
 */
async function verifyResultsDirectory(): Promise<boolean> {
  console.log('🔍 Verifying Results Directory...\n');

  try {
    const { access, mkdir } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const resultsDir = `${__dirname}/results`;

    try {
      await access(resultsDir);
      console.log(`✅ Results directory exists: ${resultsDir}`);
    } catch {
      console.log(`⚠️  Results directory doesn't exist, creating...`);
      await mkdir(resultsDir, { recursive: true });
      console.log(`✅ Created: ${resultsDir}`);
    }

    console.log();
    return true;
  } catch (error) {
    console.log(`❌ Failed to verify/create results directory`);
    console.log(`   Error: ${error}`);
    console.log();
    return false;
  }
}

/**
 * Print summary and next steps
 */
function printSummary(results: {
  personas: boolean;
  environment: boolean;
  apiServer: boolean;
  resultsDir: boolean;
}): void {
  console.log('=' .repeat(80));
  console.log('📊 Verification Summary\n');

  const checks = [
    { name: 'Persona Definitions', passed: results.personas },
    { name: 'Environment Setup', passed: results.environment },
    { name: 'API Server', passed: results.apiServer },
    { name: 'Results Directory', passed: results.resultsDir }
  ];

  checks.forEach(check => {
    const icon = check.passed ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
  });

  const allPassed = Object.values(results).every(r => r);

  console.log();
  if (allPassed) {
    console.log('🎉 All checks passed! You\'re ready to run persona tests.\n');
    console.log('Next steps:');
    console.log('  1. Run a single persona:');
    console.log('     npx tsx tests/e2e/traveler-persona-agent.ts --persona romantic-couple\n');
    console.log('  2. Run full suite:');
    console.log('     npm run test:persona\n');
    console.log('  3. See examples:');
    console.log('     npx tsx tests/e2e/example-persona-test.ts\n');
  } else {
    console.log('⚠️  Some checks failed. Please fix the issues above before running tests.\n');

    if (!results.environment) {
      console.log('Fix environment:');
      console.log('  export OPENROUTER_API_KEY="sk-or-v1-..."\n'); // pragma: allowlist secret
    }

    if (!results.apiServer) {
      console.log('Start API server:');
      console.log('  cd viewer-svelte && npm run dev\n');
    }

    if (!results.personas) {
      console.log('Check persona definitions in:');
      console.log('  tests/e2e/traveler-persona-agent.ts\n');
    }
  }

  console.log('=' .repeat(80));
}

/**
 * Main verification function
 */
async function main() {
  console.log('\n🧪 Traveler Persona Agent - Verification\n');
  console.log('=' .repeat(80));
  console.log();

  const results = {
    personas: verifyPersonaDefinitions(),
    environment: verifyEnvironment(),
    apiServer: await verifyAPIServer(),
    resultsDir: await verifyResultsDirectory()
  };

  printSummary(results);

  // Exit with error code if any checks failed
  const allPassed = Object.values(results).every(r => r);
  process.exit(allPassed ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export {
  verifyPersonaDefinitions,
  verifyEnvironment,
  verifyAPIServer,
  verifyResultsDirectory
};
