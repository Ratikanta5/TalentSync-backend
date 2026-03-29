/**
 * Code Executor Module
 * Integrates with Piston API for code execution and test case validation
 */

const axios = require('axios');

const PISTON_API = process.env.PISTON_API_URL || 'https://emkc.org/api/v2/piston';

class CodeExecutor {
  constructor() {
    this.supportedLanguages = {
      javascript: { language: 'javascript', version: '*' },
      python: { language: 'python3', version: '*' },
      java: { language: 'java', version: '*' },
      cpp: { language: 'cpp', version: '*' }
    };
  }

  /**
   * Execute code against a single test case
   * @param {String} code - User code
   * @param {String} language - Programming language
   * @param {String} input - Test input
   * @param {Number} timeLimit - Time limit in milliseconds (default: 5000)
   * @returns {Object} Execution result
   */
  async executeCode(code, language, input, timeLimit = 5000) {
    try {
      const languageKey = language === 'python' ? 'python' : language;
      
      if (!this.supportedLanguages[languageKey]) {
        throw new Error(`Unsupported language: ${language}`);
      }

      const languageConfig = this.supportedLanguages[languageKey];

      const payload = {
        language: languageConfig.language,
        version: languageConfig.version,
        files: [
          {
            name: this._getFileName(language),
            content: code
          }
        ],
        stdin: input || ''
      };

      const startTime = Date.now();
      
      // Set timeout for API call
      const response = await Promise.race([
        axios.post(`${PISTON_API}/execute`, payload, {
          timeout: timeLimit + 2000 // Add buffer
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Execution timeout')),
            timeLimit + 2000
          )
        )
      ]);

      const executionTime = Date.now() - startTime;

      if (response.status !== 200) {
        throw new Error('Execution API error');
      }

      const result = response.data;

      // Check for compilation errors (for compiled languages)
      if (result.compile && result.compile.stderr) {
        return {
          success: false,
          status: 'compilation-error',
          output: result.compile.stdout || '',
          error: result.compile.stderr,
          executionTime
        };
      }

      // Check for runtime errors
      if (result.run && result.run.stderr) {
        return {
          success: false,
          status: 'runtime-error',
          output: result.run.stdout || '',
          error: result.run.stderr,
          executionTime
        };
      }

      // Check for timeout
      if (executionTime > timeLimit) {
        return {
          success: false,
          status: 'time-limit',
          error: 'Execution exceeded time limit',
          output: result.run?.stdout || '',
          executionTime
        };
      }

      return {
        success: true,
        status: 'executed',
        output: result.run?.stdout || '',
        executionTime,
        memory: 0 // Piston API doesn't provide memory info
      };
    } catch (error) {
      if (error.message === 'Execution timeout') {
        return {
          success: false,
          status: 'time-limit',
          error: 'Execution exceeded time limit',
          executionTime: timeLimit
        };
      }

      return {
        success: false,
        status: 'execution-error',
        error: error.message,
        executionTime: 0
      };
    }
  }

  /**
   * Test code against multiple test cases
   * @param {String} code - User code
   * @param {String} language - Programming language
   * @param {Array} testCases - Array of { input, expectedOutput, _id }
   * @param {Number} timeLimit - Time limit per test in milliseconds
   * @returns {Object} Test results
   */
  async testCode(code, language, testCases, timeLimit = 5000) {
    const results = {
      totalTests: testCases.length,
      passedTests: 0,
      failedTests: 0,
      executionTime: 0,
      memory: 0,
      compilationError: null,
      runtimeError: null,
      timeLimitExceeded: false,
      details: []
    };

    // Validate code first
    const validation = this.validateCode(code, language);
    if (!validation.valid) {
      results.compilationError = validation.error;
      return results;
    }

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const execution = await this.executeCode(code, language, testCase.input, timeLimit);

      const testResult = {
        testCaseId: testCase._id,
        index: i,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput?.trim() || '',
        actualOutput: execution.output?.trim() || '',
        executionTime: execution.executionTime,
        status: execution.status,
        error: execution.error || null,
        passed: false
      };

      results.executionTime += execution.executionTime;

      // Handle compilation and runtime errors
      if (execution.status === 'compilation-error' || execution.status === 'compilation_error') {
        results.compilationError = execution.error;
        testResult.passed = false;
        results.failedTests++;
      } else if (execution.status === 'runtime-error' || execution.status === 'runtime_error') {
        results.runtimeError = execution.error;
        testResult.passed = false;
        results.failedTests++;
      } else if (execution.status === 'time-limit' || execution.status === 'time_limit') {
        results.timeLimitExceeded = true;
        testResult.passed = false;
        results.failedTests++;
      } else if (execution.success) {
        // Compare output
        const passed = testResult.actualOutput === testResult.expectedOutput;
        testResult.passed = passed;
        if (passed) {
          results.passedTests++;
        } else {
          results.failedTests++;
        }
      } else {
        testResult.passed = false;
        results.failedTests++;
      }

      results.details.push(testResult);
    }

    return results;
  }

  /**
   * Validate code
   * @param {String} code - User code
   * @param {String} language - Programming language
   * @returns {Object} Validation result
   */
  validateCode(code, language) {
    if (!code || code.trim().length === 0) {
      return { valid: false, error: 'Code cannot be empty' };
    }

    if (code.length > 50000) {
      return { valid: false, error: 'Code is too large (max 50KB)' };
    }

    return { valid: true };
  }

  /**
   * Get filename based on language
   * @private
   */
  _getFileName(language) {
    const fileNames = {
      javascript: 'solution.js',
      python: 'solution.py',
      java: 'Solution.java',
      cpp: 'solution.cpp'
    };
    return fileNames[language] || 'solution.txt';
  }

  /**
   * Compare actual output with expected output
   * @private
   * Handles variations in whitespace and line breaks
   */
  _compareOutput(actual, expected) {
    if (!actual && !expected) return true;
    if (!actual || !expected) return false;

    // Normalize whitespace
    const actualNormalized = actual
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    const expectedNormalized = expected
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    return actualNormalized === expectedNormalized;
  }

  /**
   * Get supported languages
   * @returns {Array} List of supported languages
   */
  getSupportedLanguages() {
    return Object.keys(this.supportedLanguages);
  }

  /**
   * Health check - verify Piston API is accessible
   * @returns {Boolean} API availability
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${PISTON_API}/runtimes`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

module.exports = new CodeExecutor();
