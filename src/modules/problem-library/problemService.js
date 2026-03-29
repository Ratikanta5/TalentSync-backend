const Problem = require('../../database/models/Problem');
const ProblemSubmission = require('../../database/models/ProblemSubmission');
const ProblemTag = require('../../database/models/ProblemTag');

class ProblemService {
  /**
   * Create a new problem (automatically saved after interview)
   * @param {Object} data - Problem data
   * @returns {Promise<Object>} Created problem
   */
  async createProblem(data) {
    try {
      const problem = new Problem({
        slug: this.generateSlug(data.title),
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        company: data.companyId,
        companyName: data.companyName,
        testCases: data.testCases,
        exampleTestCases: data.exampleTestCases,
        starterCode: data.starterCode,
        solutionCode: data.solutionCode,
        constraints: data.constraints,
        hints: data.hints,
        tags: data.tags || [],
        topics: data.topics || [],
        createdBy: data.createdBy,
        isPublished: data.isPublished || false
      });

      await problem.save();

      // Update company statistics
      await this.updateCompanyStats(data.companyId);

      return problem;
    } catch (error) {
      throw new Error(`Failed to create problem: ${error.message}`);
    }
  }

  /**
   * Get all problems with filtering and pagination
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} Problems matching filters
   */
  async getProblems(filters = {}) {
    try {
      const query = { isPublished: true };

      if (filters.difficulty) query.difficulty = filters.difficulty;
      if (filters.company) query.company = filters.company;
      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      }
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const problems = await Problem.find(query)
        .populate('company', 'name logo')
        .populate('tags', 'name color')
        .populate('createdBy', 'name avatar')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 20)
        .skip(filters.skip || 0);

      const total = await Problem.countDocuments(query);

      return {
        problems,
        total,
        page: Math.floor((filters.skip || 0) / (filters.limit || 20)) + 1
      };
    } catch (error) {
      throw new Error(`Failed to fetch problems: ${error.message}`);
    }
  }

  /**
   * Get problem by ID or slug
   * @param {string} identifier - Problem ID or slug
   * @returns {Promise<Object>} Problem data
   */
  async getProblemById(identifier) {
    try {
      let query = {};

      // Try to find by ID first
      if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
        query._id = identifier;
      } else {
        query.slug = identifier;
      }

      const problem = await Problem.findOne(query)
        .populate('company', 'name logo')
        .populate('tags', 'name color')
        .populate('createdBy', 'name avatar');

      if (!problem) throw new Error('Problem not found');

      // Increment view count
      problem.stats.viewCount++;
      await problem.save();

      return problem;
    } catch (error) {
      throw new Error(`Failed to fetch problem: ${error.message}`);
    }
  }

  /**
   * Get problems by company
   * @param {string} companyId - Company ID
   * @returns {Promise<Array>} Company's problems
   */
  async getProblemsByCompany(companyId, filters = {}) {
    try {
      const query = { company: companyId, isPublished: true };

      if (filters.difficulty) query.difficulty = filters.difficulty;

      const problems = await Problem.find(query)
        .populate('tags', 'name color')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 20)
        .skip(filters.skip || 0);

      const total = await Problem.countDocuments(query);

      return { problems, total };
    } catch (error) {
      throw new Error(`Failed to fetch company problems: ${error.message}`);
    }
  }

  /**
   * Record user submission for a problem
   * @param {string} userId - User ID
   * @param {string} problemId - Problem ID
   * @param {Object} submissionData - Code and test results
   * @returns {Promise<Object>} Submission result
   */
  async submitProblem(userId, problemId, submissionData) {
    try {
      const problem = await Problem.findById(problemId);
      if (!problem) throw new Error('Problem not found');

      const submission = new ProblemSubmission({
        user: userId,
        problem: problemId,
        code: submissionData.code,
        language: submissionData.language,
        status: submissionData.status,
        testResults: submissionData.testResults,
        executionTime: submissionData.executionTime,
        memory: submissionData.memory
      });

      await submission.save();

      // Update problem statistics
      problem.stats.submissionCount++;
      if (submissionData.status === 'accepted') {
        problem.stats.acceptedCount++;
        problem.stats.acceptanceRate = Math.round((problem.stats.acceptedCount / problem.stats.submissionCount) * 100);
      }
      await problem.save();

      // Update user statistics
      await this.updateUserStats(userId, submissionData.status === 'accepted');

      return submission;
    } catch (error) {
      throw new Error(`Failed to submit problem: ${error.message}`);
    }
  }

  /**
   * Get user's problem submissions
   * @param {string} userId - User ID
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} User's submissions
   */
  async getUserSubmissions(userId, filters = {}) {
    try {
      const query = { user: userId };

      if (filters.status) query.status = filters.status;
      if (filters.problemId) query.problem = filters.problemId;

      const submissions = await ProblemSubmission.find(query)
        .populate('problem', 'title difficulty company')
        .sort({ submittedAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0);

      const stats = await this.getUserProblemStats(userId);

      return {
        submissions,
        stats
      };
    } catch (error) {
      throw new Error(`Failed to fetch submissions: ${error.message}`);
    }
  }

  /**
   * Get user's problem solving statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User statistics
   */
  async getUserProblemStats(userId) {
    try {
      const totalAttempts = await ProblemSubmission.countDocuments({ user: userId });
      const acceptedCount = await ProblemSubmission.countDocuments({ user: userId, status: 'accepted' });

      const difficultyStats = await ProblemSubmission.aggregate([
        { $match: { user: require('mongoose').Types.ObjectId(userId), status: 'accepted' } },
        {
          $lookup: {
            from: 'problems',
            localField: 'problem',
            foreignField: '_id',
            as: 'problemData'
          }
        },
        { $unwind: '$problemData' },
        {
          $group: {
            _id: '$problemData.difficulty',
            count: { $sum: 1 }
          }
        }
      ]);

      return {
        totalAttempts,
        acceptedCount,
        acceptanceRate: totalAttempts > 0 ? Math.round((acceptedCount / totalAttempts) * 100) : 0,
        byDifficulty: difficultyStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      };
    } catch (error) {
      throw new Error(`Failed to fetch stats: ${error.message}`);
    }
  }

  /**
   * Helper: Generate slug from title
   * @param {string} title - Problem title
   * @returns {string} URL-friendly slug
   */
  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-')
      .substring(0, 100);
  }

  /**
   * Helper: Update company statistics
   * @param {string} companyId - Company ID
   */
  async updateCompanyStats(companyId) {
    try {
      const Company = require('../models/Company');
      const problemCount = await Problem.countDocuments({ company: companyId });
      await Company.updateOne({ _id: companyId }, { 'stats.problemsCreated': problemCount });
    } catch (error) {
      console.error('Error updating company stats:', error);
    }
  }

  /**
   * Helper: Update user problem-solving statistics
   * @param {string} userId - User ID
   * @param {boolean} accepted - Was problem accepted
   */
  async updateUserStats(userId, accepted) {
    try {
      const User = require('../../database/models/User');
      const stats = await this.getUserProblemStats(userId);

      await User.updateOne(
        { _id: userId },
        {
          'stats.problemsSolved': stats.acceptedCount,
          'stats.acceptanceRate': stats.acceptanceRate
        }
      );
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }
}

module.exports = ProblemService;
