#!/usr/bin/env node
/**
 * Task Entry Validator
 * 
 * Validates task-entry.json files against the schema.
 * 
 * Usage:
 *   node scripts/validate-task-entry.mjs <file-or-directory>
 * 
 * Examples:
 *   node scripts/validate-task-entry.mjs cortex/state/task-entry-2025-12-05.json
 *   node scripts/validate-task-entry.mjs cortex/state/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load schema
const schemaPath = path.resolve(__dirname, '../cortex/schema/task-entry.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

/**
 * Validate a task entry against the schema
 */
function validateTaskEntry(data, filePath) {
  const errors = [];

  // Required fields
  if (!data.date) {
    errors.push('Missing required field: date');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push(`Invalid date format: ${data.date} (expected YYYY-MM-DD)`);
  }

  if (!Array.isArray(data.tasks)) {
    errors.push('Missing or invalid required field: tasks (must be array)');
  } else {
    data.tasks.forEach((task, idx) => {
      const taskErrors = validateTask(task, `tasks[${idx}]`);
      errors.push(...taskErrors);
    });
  }

  // Optional arrays
  if (data.completed && !Array.isArray(data.completed)) {
    errors.push('Invalid field: completed (must be array)');
  } else if (Array.isArray(data.completed)) {
    data.completed.forEach((task, idx) => {
      const taskErrors = validateTask(task, `completed[${idx}]`);
      errors.push(...taskErrors);
    });
  }

  if (data.carryover && !Array.isArray(data.carryover)) {
    errors.push('Invalid field: carryover (must be array)');
  } else if (Array.isArray(data.carryover)) {
    data.carryover.forEach((task, idx) => {
      const taskErrors = validateTask(task, `carryover[${idx}]`);
      errors.push(...taskErrors);
    });
  }

  if (data.tomorrow_candidates && !Array.isArray(data.tomorrow_candidates)) {
    errors.push('Invalid field: tomorrow_candidates (must be array)');
  } else if (Array.isArray(data.tomorrow_candidates)) {
    data.tomorrow_candidates.forEach((candidate, idx) => {
      if (typeof candidate !== 'string') {
        errors.push(`tomorrow_candidates[${idx}]: Must be string`);
      }
    });
  }

  // Optional string
  if (data.reflection && typeof data.reflection !== 'string') {
    errors.push('Invalid field: reflection (must be string)');
  }

  // Optional metadata
  if (data.metadata && typeof data.metadata !== 'object') {
    errors.push('Invalid field: metadata (must be object)');
  }

  return errors;
}

/**
 * Validate a single task object
 */
function validateTask(task, prefix) {
  const errors = [];

  // Required fields
  if (!task.content) {
    errors.push(`${prefix}.content: Required field missing`);
  } else if (typeof task.content !== 'string' || task.content.length === 0) {
    errors.push(`${prefix}.content: Must be non-empty string`);
  }

  if (!task.status) {
    errors.push(`${prefix}.status: Required field missing`);
  } else if (!['pending', 'completed', 'blocked', 'waiting', 'cancelled'].includes(task.status)) {
    errors.push(`${prefix}.status: Invalid enum value "${task.status}"`);
  }

  // Optional fields
  if (task.tags) {
    if (!Array.isArray(task.tags)) {
      errors.push(`${prefix}.tags: Must be array`);
    } else {
      const validTags = ['urgent', 'blocked', 'waiting', 'deepwork', 'review', 'milestone', 'done'];
      task.tags.forEach((tag, idx) => {
        if (!validTags.includes(tag)) {
          errors.push(`${prefix}.tags[${idx}]: Invalid tag "${tag}"`);
        }
      });
    }
  }

  if (task.emoji) {
    const validEmojis = ['⚡', '🚧', '⏳', '🎯', '👁️', '🎉', ''];
    if (!validEmojis.includes(task.emoji)) {
      errors.push(`${prefix}.emoji: Invalid emoji "${task.emoji}"`);
    }
  }

  if (task.category && typeof task.category !== 'string') {
    errors.push(`${prefix}.category: Must be string`);
  }

  if (task.estimate !== undefined) {
    if (typeof task.estimate !== 'number' || task.estimate < 0) {
      errors.push(`${prefix}.estimate: Must be non-negative number`);
    }
  }

  if (task.completed_at && typeof task.completed_at !== 'string') {
    errors.push(`${prefix}.completed_at: Must be ISO 8601 string`);
  }

  if (task.created_at && typeof task.created_at !== 'string') {
    errors.push(`${prefix}.created_at: Must be ISO 8601 string`);
  }

  return errors;
}

/**
 * Validate a single file
 */
function validateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const errors = validateTaskEntry(data, filePath);

    if (errors.length === 0) {
      console.log(`✅ ${filePath}: Valid`);
      return true;
    } else {
      console.log(`❌ ${filePath}: Invalid`);
      errors.forEach(err => console.log(`  - ${err}`));
      return false;
    }
  } catch (err) {
    console.log(`❌ ${filePath}: Error - ${err.message}`);
    return false;
  }
}

/**
 * Validate all JSON files in a directory
 */
function validateDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  if (jsonFiles.length === 0) {
    console.log(`No JSON files found in ${dirPath}`);
    return true;
  }

  let allValid = true;
  for (const file of jsonFiles) {
    const filePath = path.join(dirPath, file);
    const isValid = validateFile(filePath);
    if (!isValid) {
      allValid = false;
    }
  }

  return allValid;
}

/**
 * Main
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node scripts/validate-task-entry.mjs <file-or-directory>');
    process.exit(1);
  }

  const target = args[0];
  const targetPath = path.resolve(target);

  if (!fs.existsSync(targetPath)) {
    console.error(`Error: ${targetPath} does not exist`);
    process.exit(1);
  }

  const stat = fs.statSync(targetPath);
  let isValid;

  if (stat.isDirectory()) {
    console.log(`Validating directory: ${targetPath}\n`);
    isValid = validateDirectory(targetPath);
  } else {
    isValid = validateFile(targetPath);
  }

  if (isValid) {
    console.log('\n✅ All validations passed');
    process.exit(0);
  } else {
    console.log('\n❌ Validation failed');
    process.exit(1);
  }
}

main();
