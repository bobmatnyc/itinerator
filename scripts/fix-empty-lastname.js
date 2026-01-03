#!/usr/bin/env node
/**
 * Migration script to fix travelers with empty lastName fields
 * Replaces empty lastName ("") with "Traveler" to satisfy schema validation
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = './data/itineraries';

async function fixItinerary(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const data = JSON.parse(content);

    let modified = false;

    // Fix travelers with empty lastName
    if (data.travelers && Array.isArray(data.travelers)) {
      for (const traveler of data.travelers) {
        if (traveler.lastName === '' || traveler.lastName === null || traveler.lastName === undefined) {
          console.log(`Fixing traveler in ${filePath}: ${traveler.firstName} (empty lastName)`);
          traveler.lastName = 'Traveler';
          modified = true;
        }
      }
    }

    // Write back if modified
    if (modified) {
      await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      return { modified: true, file: filePath };
    }

    return { modified: false, file: filePath };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { modified: false, file: filePath, error: error.message };
  }
}

async function main() {
  console.log('🔍 Scanning itineraries for empty lastName fields...\n');

  const files = await readdir(DATA_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  const results = [];
  for (const file of jsonFiles) {
    const result = await fixItinerary(join(DATA_DIR, file));
    results.push(result);
  }

  const modified = results.filter(r => r.modified);
  const errors = results.filter(r => r.error);

  console.log('\n✅ Migration complete!');
  console.log(`   Modified: ${modified.length} files`);
  console.log(`   Unchanged: ${results.length - modified.length - errors.length} files`);
  if (errors.length > 0) {
    console.log(`   Errors: ${errors.length} files`);
  }

  if (modified.length > 0) {
    console.log('\n📝 Modified files:');
    modified.forEach(r => console.log(`   - ${r.file}`));
  }
}

main().catch(console.error);
