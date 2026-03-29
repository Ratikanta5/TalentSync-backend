const PracticeProblem = require('../database/models/PracticeProblem');
const ProblemSubmission = require('../database/models/ProblemSubmission');
const { executeCode } = require('../services/codeExecutor');

// ================== GET ALL PROBLEMS WITH FILTERS ==================
exports.getProblems = async (req, res) => {
  try {
    const userId = req.user._id;
    const { difficulty, company, role, category, search, sortBy = 'difficulty', page = 1, limit = 20 } = req.query;

    // Build filter query
    let filter = { isPublished: true };

    if (difficulty) {
      filter.difficulty = difficulty;
    }

    if (company) {
      filter.companies = { $in: [company] };
    }

    if (role) {
      filter.rolesRequired = { $in: [role] };
    }

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [search] } }
      ];
    }

    // Sort options - Only date-based sorting
    let sortOption = {};
    switch (sortBy) {
      case 'newest':  // Newest first (DESC)
        sortOption = { createdAt: -1 };
        break;
      case 'oldest':  // Oldest first (ASC)
        sortOption = { createdAt: 1 };
        break;
      default:
        sortOption = { createdAt: -1 };  // Default to newest
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Get total count
    const total = await PracticeProblem.countDocuments(filter);

    // Get problems
    const problems = await PracticeProblem.find(filter)
      .select('title slug difficulty category companies rolesRequired stats')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    // Get user's progress for each problem
    const problemsWithProgress = await Promise.all(
      problems.map(async (problem) => {
        const userSubmission = await ProblemSubmission.findOne({
          user: userId,
          problem: problem._id,
          status: 'accepted'
        });

        return {
          ...problem.toObject(),
          solved: !!userSubmission,
          attempted: await ProblemSubmission.exists({ user: userId, problem: problem._id })
        };
      })
    );

    res.status(200).json({
      success: true,
      data: problemsWithProgress,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get problems error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch problems',
      error: error.message
    });
  }
};

// ================== GET SINGLE PROBLEM ==================
exports.getProblemById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const problem = await PracticeProblem.findById(id).select('-testCases.isHidden');

    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found'
      });
    }

    // Get user's submission statistics
    const userStats = await ProblemSubmission.aggregate([
      { $match: { user: userId, problem: problem._id } },
      {
        $group: {
          _id: null,
          totalAttempts: { $sum: 1 },
          acceptedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get user's best/last submission
    const lastSubmission = await ProblemSubmission.findOne({
      user: userId,
      problem: problem._id
    }).sort({ submittedAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        problem: problem.toObject(),
        userStats: userStats[0] || { totalAttempts: 0, acceptedCount: 0 },
        lastSubmission: lastSubmission ? {
          status: lastSubmission.status,
          language: lastSubmission.language,
          code: lastSubmission.code,
          submittedAt: lastSubmission.submittedAt
        } : null
      }
    });
  } catch (error) {
    console.error('Get problem error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch problem',
      error: error.message
    });
  }
};

// ================== SUBMIT CODE ==================
exports.submitCode = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({
        success: false,
        message: 'Code and language are required'
      });
    }

    const problem = await PracticeProblem.findById(id);

    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found'
      });
    }

    // Create submission record
    const submission = new ProblemSubmission({
      user: userId,
      problem: id,
      code,
      language,
      status: 'running'
    });

    // Execute code
    const executionResult = await executeCode({
      code,
      language,
      testCases: problem.testCases.map(tc => ({
        _id: tc._id,
        input: tc.input,
        expectedOutput: tc.expectedOutput
      })),
      timeLimit: problem.timeLimit,
      memoryLimit: problem.memoryLimit
    });

    // Process results
    const passedTests = executionResult.testResults.filter(r => r.passed).length;
    const totalTests = executionResult.testResults.length;

    let status = 'wrong-answer';
    if (executionResult.compilationError) {
      status = 'compilation-error';
    } else if (executionResult.runtimeError) {
      status = 'runtime-error';
    } else if (executionResult.timeLimitExceeded) {
      status = 'time-limit';
    } else if (passedTests === totalTests) {
      status = 'accepted';
    }

    // Update submission
    submission.status = status;
    submission.testResults = executionResult.testResults;
    submission.totalTestCases = totalTests;
    submission.passedTestCases = passedTests;
    submission.failedTestCases = totalTests - passedTests;
    submission.executionTime = executionResult.executionTime;
    submission.memory = executionResult.memory;
    submission.compilationError = executionResult.compilationError;
    submission.runtimeError = executionResult.runtimeError;
    submission.completedAt = new Date();

    await submission.save();

    // Update problem statistics
    await PracticeProblem.findByIdAndUpdate(
      id,
      {
        $inc: {
          'stats.totalAttempts': 1,
          'stats.totalSubmissions': 1,
          ...(status === 'accepted' && { 'stats.acceptedCount': 1 })
        }
      }
    );

    res.status(200).json({
      success: true,
      message: status === 'accepted' ? 'Problem solved successfully!' : 'Submission processed',
      data: {
        submissionId: submission._id,
        status: submission.status,
        testResults: submission.testResults,
        passedTests: submission.passedTestCases,
        totalTests: submission.totalTestCases,
        executionTime: submission.executionTime,
        memory: submission.memory,
        compilationError: submission.compilationError,
        runtimeError: submission.runtimeError
      }
    });
  } catch (error) {
    console.error('Submit code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit code',
      error: error.message
    });
  }
};

// ================== GET SUBMISSION HISTORY ==================
exports.getSubmissionHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const total = await ProblemSubmission.countDocuments({
      user: userId,
      problem: id
    });

    const submissions = await ProblemSubmission.find({
      user: userId,
      problem: id
    })
      .select('status language executionTime memory passedTestCases totalTestCases submittedAt')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: submissions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get submission history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submission history',
      error: error.message
    });
  }
};

// ================== GET USER STATS ==================
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { company, role } = req.query;

    let filter = { user: userId };

    if (company) {
      filter = {
        ...filter,
        problem: {
          $in: await PracticeProblem.find({
            companies: { $in: [company] }
          }).select('_id')
        }
      };
    }

    if (role) {
      filter = {
        ...filter,
        problem: {
          $in: await PracticeProblem.find({
            rolesRequired: { $in: [role] }
          }).select('_id')
        }
      };
    }

    const stats = await ProblemSubmission.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAttempts: { $sum: 1 },
          acceptedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
          },
          averageRuntime: { $avg: '$executionTime' },
          averageMemory: { $avg: '$memory' }
        }
      }
    ]);

    const uniqueProblems = await ProblemSubmission.distinct('problem', {
      user: userId,
      status: 'accepted'
    });

    res.status(200).json({
      success: true,
      data: {
        stats: stats[0] || {
          totalAttempts: 0,
          acceptedCount: 0,
          averageRuntime: 0,
          averageMemory: 0
        },
        problemsSolved: uniqueProblems.length
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user stats',
      error: error.message
    });
  }
};

// ================== GET AVAILABLE FILTERS ==================
// Fetch all unique companies and roles from published problems (from actual interviews)
exports.getAvailableFilters = async (req, res) => {
  try {
    const problems = await PracticeProblem.find({ isPublished: true });

    // Extract unique companies from problems
    const companies = [
      ...new Set(problems.flatMap(p => p.companies || []))
    ].filter(Boolean).sort();

    // Extract unique roles from problems (from actual interviews)
    const roles = [
      ...new Set(problems.flatMap(p => p.rolesRequired || []))
    ].filter(Boolean).sort();

    res.status(200).json({
      success: true,
      data: {
        companies,
        roles
      }
    });
  } catch (error) {
    console.error('Get available filters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available filters',
      error: error.message
    });
  }
};

// ================== GET SUBMISSION DETAILS ==================
exports.getSubmissionDetails = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user._id;

    const submission = await ProblemSubmission.findById(submissionId)
      .populate('problem', 'title difficulty category testCases');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    if (submission.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    res.status(200).json({
      success: true,
      data: submission
    });
  } catch (error) {
    console.error('Get submission details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submission details',
      error: error.message
    });
  }
};

// ================== CREATE PROBLEM FROM INTERVIEW ==================
// Called when an interviewer saves a question asked during an interview as practice material
exports.createProblemFromInterview = async (req, res) => {
  try {
    const {
      title,
      description,
      problemStatement,
      difficulty,
      category,
      tags,
      constraints,
      examples,
      hints,
      starterCode,
      testCases,
      timeLimit,
      memoryLimit,
      sourceInterviewId,
      sourceCompany,
      sourceRole
    } = req.body;

    // Validate required fields
    if (!title || !description || !problemStatement || !sourceCompany || !sourceRole) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, problemStatement, sourceCompany, sourceRole'
      });
    }

    // Create slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    // Create new practice problem
    const newProblem = new PracticeProblem({
      title,
      slug,
      description,
      difficulty: difficulty || 'medium',
      category: category || 'general',
      tags: tags || [],
      companies: [sourceCompany],  // Add source company as a company that asked this
      rolesRequired: [sourceRole],  // Add source role
      problemStatement,
      constraints: constraints || [],
      examples: examples || [],
      hints: hints || [],
      starterCode: starterCode || {
        javascript: '// Write your solution here\n',
        python: '# Write your solution here\n',
        java: 'public class Solution {\n    // Write your solution here\n}\n',
        cpp: '// Write your solution here\n'
      },
      testCases: testCases || [],
      timeLimit: timeLimit || 5000,
      memoryLimit: memoryLimit || 256,
      isPublished: true,  // Automatically publish problems from interviews
      sourceInterview: sourceInterviewId,
      sourceCompany,
      sourceRole,
      askedByInterviewer: req.user.name || req.user._id,
      createdBy: req.user._id
    });

    const savedProblem = await newProblem.save();

    res.status(201).json({
      success: true,
      message: 'Practice problem created from interview question',
      data: savedProblem
    });
  } catch (error) {
    console.error('Create problem from interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create practice problem from interview',
      error: error.message
    });
  }
};

// ================== GET PROBLEMS BY COMPANY & ROLE ==================
// Get practice problems from interviews for a specific company and role (for candidate preparation)
exports.getProblemsByCompanyAndRole = async (req, res) => {
  try {
    const { company, role } = req.query;

    if (!company || !role) {
      return res.status(400).json({
        success: false,
        message: 'Company and role are required'
      });
    }

    const problems = await PracticeProblem.find({
      isPublished: true,
      sourceCompany: company,
      sourceRole: role
    })
      .select('title difficulty category companies rolesRequired stats createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      company,
      role,
      totalProblems: problems.length,
      data: problems
    });
  } catch (error) {
    console.error('Get problems by company and role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch problems by company and role',
      error: error.message
    });
  }
};
