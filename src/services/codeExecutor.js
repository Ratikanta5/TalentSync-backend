const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const EXECUTION_TIMEOUT = Number(process.env.CODE_EXECUTOR_TIMEOUT_MS) || 15000;
const MIN_EXECUTION_TIMEOUT = 1000;
const MAX_EXECUTION_TIMEOUT = 120000;
const DOCKER_MEMORY_LIMIT = process.env.CODE_EXECUTOR_MEMORY || '256m';
const DOCKER_CPU_LIMIT = process.env.CODE_EXECUTOR_CPUS || '1';

const LANGUAGE_CONFIG = {
  javascript: {
    image: 'node:20-alpine',
    fileName: 'main.js',
    command: ['node', 'main.js'],
    defaultTimeLimit: 10000,
    minTimeLimit: 5000,
  },
  python: {
    image: 'python:3.11-alpine',
    fileName: 'main.py',
    command: ['python', 'main.py'],
    defaultTimeLimit: 10000,
    minTimeLimit: 5000,
  },
  java: {
    image: 'eclipse-temurin:17-jdk',
    fileName: 'Main.java',
    command: ['sh', '-lc', 'javac Main.java && java Main'],
    defaultTimeLimit: 60000,
    minTimeLimit: 30000,
  },
  cpp: {
    image: 'gcc:13',
    fileName: 'main.cpp',
    command: ['sh', '-lc', 'g++ -std=c++17 -O2 -o main main.cpp && ./main'],
    defaultTimeLimit: 20000,
    minTimeLimit: 15000,
  },
};

const spawnAsync = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timeoutId = setTimeout(() => {
      if (!finished) {
        child.kill();
      }
    }, options.timeout || EXECUTION_TIMEOUT);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timeoutId);
      finished = true;

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(stderr || `Process exited with code ${code}`);
      error.code = code;
      error.signal = signal;
      error.killed = signal != null;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });

    if (options.input) {
      child.stdin.write(options.input);
    }
    child.stdin.end();
  });

const normalizeTimeLimit = (
  timeLimit,
  fallbackTimeLimit = EXECUTION_TIMEOUT,
  minimumTimeLimit = MIN_EXECUTION_TIMEOUT
) => {
  const parsed = Number(timeLimit);

  if (!Number.isFinite(parsed)) {
    return Math.max(
      minimumTimeLimit,
      Math.min(MAX_EXECUTION_TIMEOUT, fallbackTimeLimit)
    );
  }

  return Math.max(minimumTimeLimit, Math.min(MAX_EXECUTION_TIMEOUT, parsed));
};

const resolveJavaExecutionConfig = (code) => {
  const publicClassMatch = code.match(/\bpublic\s+class\s+([A-Za-z_]\w*)\b/);
  const mainClassMatch = code.match(
    /\bclass\s+([A-Za-z_]\w*)\b[\s\S]*?\bpublic\s+static\s+void\s+main\s*\(\s*String(?:\[\]|\s*\[\s*\])\s+\w+\s*\)/
  );
  const fallbackClassMatch = code.match(/\bclass\s+([A-Za-z_]\w*)\b/);

  const className =
    publicClassMatch?.[1] || mainClassMatch?.[1] || fallbackClassMatch?.[1] || 'Main';

  return {
    fileName: `${className}.java`,
    command: ['sh', '-lc', `javac ${className}.java && java ${className}`],
    defaultTimeLimit: LANGUAGE_CONFIG.java.defaultTimeLimit,
    minTimeLimit: LANGUAGE_CONFIG.java.minTimeLimit,
    image: LANGUAGE_CONFIG.java.image,
  };
};

class CodeExecutor {
  async executeCode(code, language, input = '', timeLimit = EXECUTION_TIMEOUT) {
    const normalizedLanguage =
      language === 'python3'
        ? 'python'
        : language === 'c++'
        ? 'cpp'
        : language;
    const baseConfig = LANGUAGE_CONFIG[normalizedLanguage];
    const config =
      normalizedLanguage === 'java'
        ? resolveJavaExecutionConfig(code)
        : baseConfig;

    if (!config || !baseConfig) {
      return {
        success: false,
        status: 'execution-error',
        error: `Unsupported language: ${language}`,
        executionTime: 0,
      };
    }

    const validation = this.validateCode(code);
    if (!validation.valid) {
      return {
        success: false,
        status: 'execution-error',
        error: validation.error,
        executionTime: 0,
      };
    }

    const startedAt = Date.now();
    const effectiveTimeLimit = normalizeTimeLimit(
      timeLimit,
      config.defaultTimeLimit || EXECUTION_TIMEOUT,
      config.minTimeLimit || MIN_EXECUTION_TIMEOUT
    );
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'interview-code-'));

    try {
      const filePath = path.join(tempDir, config.fileName);
      await fs.writeFile(filePath, code, 'utf8');

      const result = await spawnAsync(
        'docker',
        [
          'run',
          '--rm',
          '-i',
          '--network',
          'none',
          '--memory',
          DOCKER_MEMORY_LIMIT,
          '--cpus',
          DOCKER_CPU_LIMIT,
          '-v',
          `${path.resolve(tempDir)}:/workspace`,
          '-w',
          '/workspace',
          config.image,
          ...config.command,
        ],
        {
          timeout: effectiveTimeLimit,
          input,
        }
      );

      return {
        success: true,
        status: 'executed',
        output: result.stdout || '',
        executionTime: Date.now() - startedAt,
        memory: 0,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: false,
          status: 'execution-error',
          error: 'Docker is not installed or not available on the server',
          executionTime: Date.now() - startedAt,
        };
      }

      if (error.killed || error.signal === 'SIGTERM') {
        return {
          success: false,
          status: 'time-limit',
          error: 'Execution exceeded time limit',
          output: [error.stdout, error.stderr].filter(Boolean).join('\n'),
          details: error.stderr || '',
          executionTime: effectiveTimeLimit,
        };
      }

      return {
        success: false,
        status: error.stderr ? 'runtime-error' : 'execution-error',
        output: error.stdout || '',
        error: error.stderr || error.message || 'Execution failed',
        executionTime: Date.now() - startedAt,
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  validateCode(code) {
    if (!code || code.trim().length === 0) {
      return { valid: false, error: 'Code cannot be empty' };
    }

    if (code.length > 50000) {
      return { valid: false, error: 'Code is too large (max 50KB)' };
    }

    return { valid: true };
  }

  async healthCheck() {
    try {
      const result = await spawnAsync(
        'docker',
        ['run', '--rm', 'node:20-alpine', 'node', '-e', 'console.log("ok")'],
        { timeout: 8000 }
      );

      return result.stdout.includes('ok');
    } catch {
      return false;
    }
  }
}

module.exports = new CodeExecutor();
