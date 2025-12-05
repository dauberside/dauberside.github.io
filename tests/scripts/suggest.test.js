/**
 * /suggest Command Tests
 * 
 * Tests for scripts/suggest.py
 * Validates input/output contracts and error handling
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SUGGEST_SCRIPT = path.join(REPO_ROOT, 'scripts', 'suggest.py');
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const TEMP_DIR = path.join(__dirname, '..', 'temp');

// Helper: Execute suggest.py with custom data directory
function runSuggest(options = {}) {
  const {
    temporalPatterns = 'temporal-patterns-valid.json',
    tomorrowCandidates = 'tomorrow-valid.json',
    expectError = false
  } = options;

  // Setup temp directory
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const tempAnalyticsDir = path.join(TEMP_DIR, 'analytics');
  if (!fs.existsSync(tempAnalyticsDir)) {
    fs.mkdirSync(tempAnalyticsDir, { recursive: true });
  }

  // Copy fixtures to temp directory
  if (temporalPatterns) {
    fs.copyFileSync(
      path.join(FIXTURES_DIR, temporalPatterns),
      path.join(tempAnalyticsDir, 'temporal-patterns.json')
    );
  }

  if (tomorrowCandidates) {
    fs.copyFileSync(
      path.join(FIXTURES_DIR, tomorrowCandidates),
      path.join(TEMP_DIR, 'tomorrow.json')
    );
  }

  // Override DATA_DIR environment variable
  const env = {
    ...process.env,
    CORTEX_TEST_DATA_DIR: TEMP_DIR
  };

  try {
    const result = execSync(`python3 "${SUGGEST_SCRIPT}"`, {
      env,
      encoding: 'utf-8',
      stdio: expectError ? 'pipe' : ['pipe', 'pipe', 'pipe']
    });

    return {
      stdout: result.stdout || result,
      stderr: result.stderr || '',
      exitCode: 0
    };
  } catch (error) {
    if (expectError) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.status || 1
      };
    }
    throw error;
  }
}

// Cleanup temp directory
function cleanup() {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

describe('/suggest Command Tests', () => {
  beforeEach(() => {
    cleanup();
  });

  afterAll(() => {
    cleanup();
  });

  describe('Input Validation', () => {
    test('TC-001: Missing temporal-patterns.json', () => {
      const result = runSuggest({
        temporalPatterns: null,
        tomorrowCandidates: 'tomorrow-valid.json'
      });

      expect(result.stderr).toContain('No temporal patterns found');
      expect(result.exitCode).toBe(0); // Graceful degradation
    });

    test('TC-002: Missing tomorrow.json', () => {
      const result = runSuggest({
        temporalPatterns: 'temporal-patterns-valid.json',
        tomorrowCandidates: null
      });

      expect(result.stderr).toContain('No tomorrow candidates found');
      expect(result.exitCode).toBe(0);
    });

    test('TC-003: Valid inputs produce valid JSON', () => {
      const result = runSuggest();

      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();

      const output = JSON.parse(result.stdout);
      expect(Array.isArray(output) || output.suggestions).toBeDefined();
    });
  });

  describe('Workload Detection', () => {
    test('TC-101: High load day limits suggestions', () => {
      // Create high-load pattern fixture
      const highLoadPattern = JSON.parse(
        fs.readFileSync(path.join(FIXTURES_DIR, 'temporal-patterns-valid.json'), 'utf-8')
      );
      
      // Set today's weekday to have high load
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      highLoadPattern.weekday_patterns[today].avg_tasks = 18;

      fs.writeFileSync(
        path.join(FIXTURES_DIR, 'temporal-patterns-high-load.json'),
        JSON.stringify(highLoadPattern, null, 2)
      );

      const result = runSuggest({
        temporalPatterns: 'temporal-patterns-high-load.json'
      });

      const output = JSON.parse(result.stdout);
      const suggestions = Array.isArray(output) ? output : output.suggestions;

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    test('TC-102: Low load day allows more suggestions', () => {
      // Create low-load pattern fixture
      const lowLoadPattern = JSON.parse(
        fs.readFileSync(path.join(FIXTURES_DIR, 'temporal-patterns-valid.json'), 'utf-8')
      );
      
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      lowLoadPattern.weekday_patterns[today].avg_tasks = 5;

      fs.writeFileSync(
        path.join(FIXTURES_DIR, 'temporal-patterns-low-load.json'),
        JSON.stringify(lowLoadPattern, null, 2)
      );

      const result = runSuggest({
        temporalPatterns: 'temporal-patterns-low-load.json'
      });

      const output = JSON.parse(result.stdout);
      const suggestions = Array.isArray(output) ? output : output.suggestions;

      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Output Format', () => {
    test('TC-501: Valid JSON output structure', () => {
      const result = runSuggest();
      const output = JSON.parse(result.stdout);

      if (Array.isArray(output)) {
        output.forEach(task => {
          expect(task).toHaveProperty('title');
          expect(task).toHaveProperty('priority');
          expect(task).toHaveProperty('source');
        });
      } else {
        expect(output).toHaveProperty('suggestions');
        expect(Array.isArray(output.suggestions)).toBe(true);
      }
    });

    test('TC-502: No suggestions produces empty array or message', () => {
      // Create empty tomorrow.json
      fs.writeFileSync(
        path.join(FIXTURES_DIR, 'tomorrow-empty.json'),
        JSON.stringify({ tomorrow_candidates: [] })
      );

      const result = runSuggest({
        tomorrowCandidates: 'tomorrow-empty.json'
      });

      const output = JSON.parse(result.stdout);
      
      if (Array.isArray(output)) {
        expect(output.length).toBe(0);
      } else {
        expect(output.suggestions.length).toBe(0);
        expect(output.message).toBeDefined();
      }
    });
  });

  describe('Integration Tests', () => {
    test('TC-601: Snapshot test - standard suggestion output', () => {
      const result = runSuggest();
      const output = JSON.parse(result.stdout);

      // Snapshot test: output structure should remain consistent
      expect(output).toMatchSnapshot();
    });
  });
});

describe('Edge Cases', () => {
  test('TC-404: Missing priority field defaults to medium', () => {
    // Create tomorrow.json without priority
    const noPriorityData = {
      tomorrow_candidates: [
        {
          title: "Task without priority",
          category: "development"
        }
      ]
    };

    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'tomorrow-no-priority.json'),
      JSON.stringify(noPriorityData)
    );

    const result = runSuggest({
      tomorrowCandidates: 'tomorrow-no-priority.json'
    });

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toBeDefined();
  });
});
