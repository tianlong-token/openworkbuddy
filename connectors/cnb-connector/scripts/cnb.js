#!/usr/bin/env node

/**
 * CNB Skill - 腾讯CNB代码平台集成工具
 *
 * 核心功能：
 * 1. 通过 get_token.sh 脚本获取 Token（安全方式）
 * 2. 自动从git获取repo信息
 * 3. Issues和Pull Requests查询
 * 4. 动态功能生成（基于swagger.json）
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://api.cnb.woa.com';

/**
 * 主类：CNB Skill
 */
class CNBSkill {
  constructor() {
    this.apiKey = null;
    this.repo = null;
  }

  /**
   * 🚨 安全检查：禁止在命令行中输入API Key
   */
  checkDangerousArgs(args) {
    const dangerousPatterns = [
      '--token', '--api-key', '--key',
      'token=', 'apikey=', 'key='
    ];

    for (const arg of args) {
      for (const pattern of dangerousPatterns) {
        if (arg.toLowerCase().includes(pattern)) {
          console.error('\n🚨 安全警告：禁止在命令行中直接输入API Key！\n');
          console.error('原因：在对话中输入API Key会直接泄漏给大模型\n');
          console.error('Token 会通过 get_token.sh 脚本自动获取，无需手动配置。\n');
          process.exit(1);
        }
      }
    }
  }

  /**
   * 获取API Key（通过 get_token.sh 脚本）
   */
  async getApiKey() {
    const getTokenScript = path.join(__dirname, 'get_token.sh');
    
    if (!existsSync(getTokenScript)) {
      console.error(`❌ 找不到 get_token.sh 脚本: ${getTokenScript}`);
      process.exit(1);
    }

    try {
      // 调用 get_token.sh 脚本获取 token（安静模式，隐藏日志）
      const token = execSync(`"${getTokenScript}" cnb -q`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      if (!token) {
        return null;
      }

      return token;
    } catch (error) {
      // 获取 token 失败
      return null;
    }
  }

  /**
   * 从git remote origin自动获取repo名称
   * @param {string} cwd - 工作目录（可选，默认为进程当前目录）
   */
  getCurrentRepo(cwd = process.cwd()) {
    try {
      const originUrl = execSync('git remote get-url origin', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
        cwd: cwd
      }).trim();

      if (!originUrl.includes('cnb.woa.com')) {
        return null;
      }

      // 移除.git后缀
      let url = originUrl.endsWith('.git') ? originUrl.slice(0, -4) : originUrl;

      // 提取group/project
      if (url.includes('cnb.woa.com/')) {
        return url.split('cnb.woa.com/')[1];
      } else if (url.includes('cnb.woa.com:')) {
        return url.split('cnb.woa.com:')[1];
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 确保环境已正确配置
   * @param {string} cwd - 工作目录（可选）
   */
  async ensureSetup(cwd) {
    this.apiKey = await this.getApiKey();
    if (!this.apiKey) {
      console.error('❌ 获取 CNB Token 失败\n');
      console.error('请检查网络连接或授权状态。\n');
      console.error('Token 通过 get_token.sh 脚本自动获取。');
      process.exit(1);
    }

    this.repo = this.getCurrentRepo(cwd);
    return { apiKey: this.apiKey, repo: this.repo };
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
CNB Skill - 腾讯CNB代码平台交互工具

用法:
  cnb <command> [options]

配置命令:
  config show             显示当前配置
  config repo             显示当前仓库信息

功能命令:
  issues [options]        查询Issues
  prs [options]           查询Pull Requests
  create-pr [options]     创建Pull Request
  create-issue [options]  创建Issue
  update-issue [options]  更新Issue
  comment-pr [options]    评论Pull Request
  comment-issue [options] 评论Issue
  upload-img [options]    上传图片到仓库
  generate <feature>      动态生成新功能（分析swagger.json）

通用选项:
  --repo <owner/project>  指定仓库（如: genie/genie）
  --cwd <path>            指定工作目录（用于自动检测repo）

Issues选项:
  --state <open|closed>   筛选状态
  --labels <label1,label2> 筛选标签
  --assignees <name>      筛选负责人
  --priority <P0|P1|P2>   筛选优先级
  --number <id>           获取指定issue详情
  --json                  JSON格式输出

PRs选项:
  --state <open|closed|all> 筛选状态
  --labels <label1,label2>  筛选标签
  --reviewers <name>        筛选审核人
  --assignees <name>        筛选负责人
  --number <id>             获取指定PR详情
  --json                    JSON格式输出

创建PR选项:
  --title <标题>            PR标题（必需）
  --head <分支>             源分支（必需）
  --base <分支>             目标分支（必需）
  --body <描述>             PR描述（可选）
  --head-repo <仓库>        源仓库，跨仓库PR时使用（可选）
  --json                    JSON格式输出

评论PR选项:
  --number <PR编号>         PR编号（必需）
  --body <评论内容>         评论内容（必需）
  --json                    JSON格式输出

创建Issue选项:
  --title <标题>            Issue标题（必需）
  --body <描述>             Issue描述（可选）
  --labels <标签>           标签（逗号分隔，可选）
  --assignees <负责人>     负责人（逗号分隔，可选）
  --priority <优先级>       优先级（P0/P1/P2/P3，可选）
  --json                    JSON格式输出

更新Issue选项:
  --number <Issue编号>      Issue编号（必需）
  --title <标题>            Issue标题（可选）
  --body <描述>             Issue描述（可选）
  --state <状态>            状态：open/closed（可选）
  --state-reason <原因>     状态原因：completed/not_planned/reopened（可选）
  --priority <优先级>       优先级：P0/P1/P2/P3（可选）
  --json                    JSON格式输出

评论Issue选项:
  --number <Issue编号>      Issue编号（必需）
  --body <评论内容>         评论内容（必需）
  --json                    JSON格式输出

上传图片选项:
  --file <文件路径>         图片文件路径（必需）
  --json                    JSON格式输出

示例:
  # 方式1：在CNB仓库目录中查询（自动检测repo）
  cd /path/to/cnb/repo
  cnb issues --state open

  # 方式2：使用 --repo 参数指定仓库
  cnb issues --repo genie/genie --number 13904

  # 方式3：使用 --cwd 参数指定工作目录
  cnb issues --cwd /path/to/cnb/repo --state open

  # 查询PRs
  cnb prs --repo genie/genie --state all

  # 创建PR
  cnb create-pr --repo genie/genie --title "新功能：添加XX" --head feature-branch --base main --body "这是一个新功能的描述"

  # 创建Issue
  cnb create-issue --repo genie/genie --title "Bug: 功能异常" --body "详细描述问题" --labels bug,P0 --assignees 张三

  # 更新Issue
  cnb update-issue --repo genie/genie --number 456 --state closed --state-reason completed
  cnb update-issue --repo genie/genie --number 789 --title "新标题" --body "更新的描述" --priority P1

  # 评论PR
  cnb comment-pr --repo genie/genie --number 123 --body "看起来不错，LGTM!"

  # 评论Issue
  cnb comment-issue --repo genie/genie --number 456 --body "问题分析和解决方案"

  # 上传图片
  cnb upload-img --repo genie/genie --file ./screenshot.png

  # 生成新功能（如commits查询）
  cnb generate commits

安全说明:
  ✅ Token 通过 get_token.sh 脚本自动获取，无需手动配置
  🚨 切勿在对话中直接输入 Token！
    `);
  }

  /**
   * 处理配置命令
   */
  async handleConfig(args) {
    const subCommand = args[0] || 'show';

    switch (subCommand) {
      case 'show': {
        const apiKey = await this.getApiKey();
        const repo = this.getCurrentRepo();

        console.log('当前配置:');
        console.log(`  Token: ${apiKey ? '✅ 已获取' : '❌ 获取失败'}`);
        if (apiKey) {
          console.log(`    来源: get_token.sh 脚本`);
          console.log(`    值: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)} (部分显示)`);
        }
        console.log(`  当前Repo: ${repo || '❌ 未检测到CNB仓库'}\n`);
        break;
      }

      case 'repo': {
        const repo = this.getCurrentRepo();
        if (repo) {
          console.log(`当前仓库: ${repo}`);
          try {
            const originUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
            console.log(`Git remote origin: ${originUrl}`);
          } catch (error) {
            // ignore
          }
        } else {
          console.log('❌ 未检测到CNB仓库');
          console.log('请在CNB仓库目录中运行此命令');
        }
        break;
      }

      default:
        console.error(`❌ 未知的配置命令: ${subCommand}`);
        console.error('可用命令: show, repo');
        process.exit(1);
    }
  }

  /**
   * 处理issues命令
   */
  async handleIssues(args) {
    // 先解析参数，获取 --repo 和 --cwd
    const params = this.parseArgs(args);

    // 使用指定的 cwd 或当前目录
    const { apiKey, repo: autoRepo } = await this.ensureSetup(params.cwd);

    // 优先使用 --repo 参数，否则使用自动检测的 repo
    const repo = params.repo || autoRepo;

    if (!repo) {
      console.error('❌ 未检测到repo\n');
      console.error('请使用以下方式之一指定repo:\n');
      console.error('方式1：使用 --repo 参数');
      console.error('  ./cnb.js issues --repo owner/project --number 123\n');
      console.error('方式2：使用 --cwd 参数指定仓库目录');
      console.error('  ./cnb.js issues --cwd /path/to/repo --number 123\n');
      console.error('方式3：在CNB仓库目录中运行');
      console.error('  cd /path/to/repo && cnb issues --number 123');
      process.exit(1);
    }
    const url = `${BASE_URL}/${repo}/-/issues${params.number ? `/${params.number}` : ''}`;

    try {
      console.log(`📋 查询仓库: ${repo}\n`);

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        params: params.number ? {} : {
          page: params.page || 1,
          page_size: params.pageSize || 30,
          state: params.state,
          labels: params.labels,
          assignees: params.assignees,
          priority: params.priority,
          keyword: params.keyword
        }
      });

      if (params.json) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        if (params.number) {
          this.formatIssue(response.data, true);
        } else {
          const issues = response.data;
          if (!issues || issues.length === 0) {
            console.log('未找到符合条件的issues');
          } else {
            console.log(`找到 ${issues.length} 个issues:\n`);
            issues.forEach(issue => {
              this.formatIssue(issue);
              console.log('-'.repeat(80));
            });
          }
        }
      }
    } catch (error) {
      console.error(`❌ 请求失败: ${error.message}`);
      if (error.response) {
        console.error(`状态码: ${error.response.status}`);
        console.error(`响应: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      process.exit(1);
    }
  }

  /**
   * 处理prs命令
   */
  async handlePRs(args) {
    // 先解析参数，获取 --repo 和 --cwd
    const params = this.parseArgs(args);

    // 使用指定的 cwd 或当前目录
    const { apiKey, repo: autoRepo } = await this.ensureSetup(params.cwd);

    // 优先使用 --repo 参数，否则使用自动检测的 repo
    const repo = params.repo || autoRepo;

    if (!repo) {
      console.error('❌ 未检测到repo\n');
      console.error('请使用以下方式之一指定repo:\n');
      console.error('方式1：使用 --repo 参数');
      console.error('  ./cnb.js prs --repo owner/project --number 456\n');
      console.error('方式2：使用 --cwd 参数指定仓库目录');
      console.error('  ./cnb.js prs --cwd /path/to/repo --number 456\n');
      console.error('方式3：在CNB仓库目录中运行');
      console.error('  cd /path/to/repo && cnb prs --number 456');
      process.exit(1);
    }
    const url = `${BASE_URL}/${repo}/-/pulls${params.number ? `/${params.number}` : ''}`;

    try {
      console.log(`🔀 查询仓库: ${repo}\n`);

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        params: params.number ? {} : {
          page: params.page || 1,
          page_size: params.pageSize || 30,
          state: params.state || 'open',
          labels: params.labels,
          reviewers: params.reviewers,
          assignees: params.assignees,
          authors: params.authors
        }
      });

      if (params.json) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        if (params.number) {
          this.formatPR(response.data, true);
        } else {
          const prs = response.data;
          if (!prs || prs.length === 0) {
            console.log('未找到符合条件的PRs');
          } else {
            console.log(`找到 ${prs.length} 个PRs:\n`);
            prs.forEach(pr => {
              this.formatPR(pr);
              console.log('-'.repeat(80));
            });
          }
        }
      }
    } catch (error) {
      console.error(`❌ 请求失败: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * 处理创建Issue命令
   */
  async handleCreateIssue(args) {
    const params = this.parseArgs(args);
    const { apiKey, repo: autoRepo } = await this.ensureSetup(params.cwd);
    const repo = params.repo || autoRepo;

    if (!repo) {
      console.error('❌ 未检测到repo\n');
      console.error('请使用 --repo 参数指定仓库');
      process.exit(1);
    }

    // 验证必需参数
    if (!params.title) {
      console.error('❌ 缺少必需参数\n');
      console.error('必需参数:');
      console.error('  --title <标题>        Issue标题');
      console.error('\n可选参数:');
      console.error('  --body <描述>         Issue描述');
      console.error('  --labels <标签>      标签（逗号分隔）');
      console.error('  --assignees <负责人>  负责人（逗号分隔）');
      console.error('  --priority <优先级>  优先级（P0/P1/P2/P3）');
      console.error('\n示例:');
      console.error('  cnb create-issue --repo genie/genie --title "Bug: 功能异常" --body "详细描述问题" --labels bug,P0 --assignees 张三');
      process.exit(1);
    }

    const url = `${BASE_URL}/${repo}/-/issues`;
    const data = {
      title: params.title,
      body: params.body || ''
    };

    // 添加可选参数
    if (params.labels) {
      data.labels = params.labels.split(',').map(label => label.trim());
    }

    if (params.assignees) {
      data.assignees = params.assignees.split(',').map(assignee => assignee.trim());
    }

    if (params.priority) {
      data.priority = params.priority;
    }

    try {
      console.log(`🐛 创建Issue: ${repo}\n`);
      console.log(`标题: ${params.title}`);
      if (params.body) console.log(`描述: ${params.body}`);
      if (params.labels) console.log(`标签: ${params.labels}`);
      if (params.assignees) console.log(`负责人: ${params.assignees}`);
      if (params.priority) console.log(`优先级: ${params.priority}`);
      console.log('');

      const response = await axios.post(url, data, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (params.json) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        console.log('✅ Issue创建成功!\n');
        const issue = response.data;
        console.log(`Issue #${issue.number}: ${issue.title}`);
        console.log(`URL: ${issue.url}`);
        console.log(`作者: ${issue.author?.name || 'N/A'}`);
        console.log(`状态: ${issue.state}`);

        if (issue.labels && issue.labels.length > 0) {
          console.log(`标签: ${issue.labels.map(label => label.name || label).join(', ')}`);
        }

        if (issue.assignees && issue.assignees.length > 0) {
          console.log(`负责人: ${issue.assignees.map(assignee => assignee.name || assignee).join(', ')}`);
        }
      }
    } catch (error) {
      console.error(`❌ 创建Issue失败: ${error.message}`);
      if (error.response) {
        console.error(`状态码: ${error.response.status}`);
        console.error(`响应: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      process.exit(1);
    }
  }

  /**
   * 处理更新Issue命令
   */
  async handleUpdateIssue(args) {
    const params = this.parseArgs(args);
    const { apiKey, repo: autoRepo } = await this.ensureSetup(params.cwd);
    const repo = params.repo || autoRepo;

    if (!repo) {
      console.error('❌ 未检测到repo\n');
      console.error('请使用 --repo 参数指定仓库');
      process.exit(1);
    }

    // 验证必需参数
    if (!params.number) {
      console.error('❌ 缺少必需参数\n');
      console.error('必需参数:');
      console.error('  --number <Issue编号>    Issue编号');
      console.error('\n可选参数:');
      console.error('  --title <标题>          Issue标题');
      console.error('  --body <描述>           Issue描述');
      console.error('  --state <状态>          状态（open/closed）');
      console.error('  --state-reason <原因>   状态原因（completed/not_planned/reopened）');
      console.error('  --priority <优先级>     优先级（P0/P1/P2/P3）');
      console.error('\n示例:');
      console.error('  cnb update-issue --repo genie/genie --number 456 --state closed --state-reason completed');
      console.error('  cnb update-issue --repo genie/genie --number 789 --title "新标题" --priority P1');
      process.exit(1);
    }

    const url = `${BASE_URL}/${repo}/-/issues/${params.number}`;
    const data = {};

    // 添加可选参数（只添加用户提供的参数）
    if (params.title !== undefined) {
      data.title = params.title;
    }

    if (params.body !== undefined) {
      data.body = params.body;
    }

    if (params.state !== undefined) {
      data.state = params.state;
    }

    if (params.stateReason !== undefined) {
      data.state_reason = params.stateReason;
    }

    if (params.priority !== undefined) {
      data.priority = params.priority;
    }

    // 检查是否至少有一个字段要更新
    if (Object.keys(data).length === 0) {
      console.error('❌ 没有提供要更新的字段\n');
      console.error('请至少提供一个要更新的字段: --title, --body, --state, --state-reason, --priority');
      process.exit(1);
    }

    try {
      console.log(`🔄 更新Issue #${params.number}: ${repo}\n`);

      if (params.title) console.log(`标题: ${params.title}`);
      if (params.body) console.log(`描述: ${params.body}`);
      if (params.state) console.log(`状态: ${params.state}`);
      if (params.stateReason) console.log(`状态原因: ${params.stateReason}`);
      if (params.priority) console.log(`优先级: ${params.priority}`);
      console.log('');

      const response = await axios.patch(url, data, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (params.json) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        console.log('✅ Issue更新成功!\n');
        const issue = response.data;
        console.log(`Issue #${issue.number}: ${issue.title}`);
        console.log(`URL: ${issue.url}`);
        console.log(`状态: ${issue.state}`);

        if (issue.state_reason) {
          console.log(`状态原因: ${issue.state_reason}`);
        }

        if (issue.priority) {
          console.log(`优先级: ${issue.priority}`);
        }

        if (issue.labels && issue.labels.length > 0) {
          console.log(`标签: ${issue.labels.map(label => label.name || label).join(', ')}`);
        }

        if (issue.assignees && issue.assignees.length > 0) {
          console.log(`负责人: ${issue.assignees.map(assignee => assignee.name || assignee).join(', ')}`);
        }

        console.log(`更新时间: ${issue.updated_at}`);
      }
    } catch (error) {
      console.error(`❌ 更新Issue失败: ${error.message}`);
      if (error.response) {
        console.error(`状态码: ${error.response.status}`);
        console.error(`响应: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      process.exit(1);
    }
  }

  /**
   * 处理创建PR命令
   */
  async handleCreatePR(args) {
    const params = this.parseArgs(args);
    const { apiKey, repo: autoRepo } = await this.ensureSetup(params.cwd);
    const repo = params.repo || autoRepo;

    if (!repo) {
      console.error('❌ 未检测到repo\n');
      console.error('请使用 --repo 参数指定仓库');
      process.exit(1);
    }

    // 验证必需参数
    if (!params.title || !params.head || !params.base) {
      console.error('❌ 缺少必需参数\n');
      console.error('必需参数:');
      console.error('  --title <标题>        PR标题');
      console.error('  --head <分支>         源分支');
      console.error('  --base <分支>         目标分支');
      console.error('\n可选参数:');
      console.error('  --body <描述>         PR描述');
      console.error('  --head-repo <仓库>    源仓库（跨仓库PR）');
      console.error('\n示例:');
      console.error('  cnb create-pr --repo genie/genie --title "新功能" --head feature-branch --base main --body "这是一个新功能"');
      process.exit(1);
    }

    const url = `${BASE_URL}/${repo}/-/pulls`;
    const data = {
      title: params.title,
      head: params.head,
      base: params.base,
      body: params.body || '',
    };

    if (params.headRepo) {
      data.head_repo = params.headRepo;
    }

    try {
      console.log(`🔀 创建PR: ${repo}\n`);
      console.log(`  标题: ${data.title}`);
      console.log(`  分支: ${data.head} → ${data.base}`);
      if (data.head_repo) {
        console.log(`  源仓库: ${data.head_repo}`);
      }
      console.log('');

      const response = await axios.post(url, data, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (params.json) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        console.log('✅ PR创建成功!\n');
        this.formatPR(response.data, true, repo);
      }
    } catch (error) {
      console.error(`❌ 创建PR失败: ${error.message}`);
      if (error.response) {
        console.error(`状态码: ${error.response.status}`);
        console.error(`响应: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      process.exit(1);
    }
  }

  /**
   * 处理评论PR命令
   */
  async handleCommentPR(args) {
    const params = this.parseArgs(args);
    const { apiKey, repo: autoRepo } = await this.ensureSetup(params.cwd);
    const repo = params.repo || autoRepo;

    if (!repo) {
      console.error('❌ 未检测到repo\n');
      console.error('请使用 --repo 参数指定仓库');
      process.exit(1);
    }

    // 验证必需参数
    if (!params.number || !params.body) {
      console.error('❌ 缺少必需参数\n');
      console.error('必需参数:');
      console.error('  --number <PR编号>     PR编号');
      console.error('  --body <评论内容>     评论内容');
      console.error('\n示例:');
      console.error('  cnb comment-pr --repo genie/genie --number 123 --body "看起来不错!"');
      process.exit(1);
    }

    const url = `${BASE_URL}/${repo}/-/pulls/${params.number}/comments`;
    const data = {
      body: params.body
    };

    try {
      console.log(`💬 评论PR #${params.number}: ${repo}\n`);

      const response = await axios.post(url, data, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (params.json) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        console.log('✅ 评论发布成功!\n');
        const comment = response.data;
        console.log(`作者: ${comment.author?.name || 'N/A'}`);
        console.log(`时间: ${comment.created_at}`);
        console.log(`\n内容:\n${comment.body}`);
        if (comment.url) {
          console.log(`\nURL: ${comment.url}`);
        }
      }
    } catch (error) {
      console.error(`❌ 评论PR失败: ${error.message}`);
      if (error.response) {
        console.error(`状态码: ${error.response.status}`);
        console.error(`响应: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      process.exit(1);
    }
  }

  /**
   * 处理评论Issue命令
   */
  async handleCommentIssue(args) {
    const params = this.parseArgs(args);
    const { apiKey, repo: autoRepo } = await this.ensureSetup(params.cwd);
    const repo = params.repo || autoRepo;

    if (!repo) {
      console.error('❌ 未检测到repo\n');
      console.error('请使用 --repo 参数指定仓库');
      process.exit(1);
    }

    // 验证必需参数
    if (!params.number || !params.body) {
      console.error('❌ 缺少必需参数\n');
      console.error('必需参数:');
      console.error('  --number <Issue编号>     Issue编号');
      console.error('  --body <评论内容>     评论内容');
      console.error('\n示例:');
      console.error('  cnb comment-issue --repo genie/genie --number 14825 --body "问题分析和解决方案"');
      process.exit(1);
    }

    const url = `${BASE_URL}/${repo}/-/issues/${params.number}/comments`;
    const data = {
      body: params.body
    };

    try {
      console.log(`💬 评论Issue #${params.number}: ${repo}\n`);

      const response = await axios.post(url, data, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (params.json) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        console.log('✅ 评论发布成功!\n');
        const comment = response.data;
        console.log(`作者: ${comment.author?.name || 'N/A'}`);
        console.log(`时间: ${comment.created_at}`);
        console.log(`\n内容:\n${comment.body}`);
        if (comment.url) {
          console.log(`\nURL: ${comment.url}`);
        }
      }
    } catch (error) {
      console.error(`❌ 评论Issue失败: ${error.message}`);
      if (error.response) {
        console.error(`状态码: ${error.response.status}`);
        console.error(`响应: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      process.exit(1);
    }
  }

  /**
   * 格式化Issue输出
   */
  formatIssue(issue, detail = false) {
    console.log(`Issue #${issue.number}: ${issue.title}`);
    console.log(`  状态: ${issue.state}`);
    console.log(`  作者: ${issue.author?.name || 'N/A'}`);

    const assignees = issue.assignees || [];
    if (assignees.length > 0) {
      console.log(`  负责人: ${assignees.map(a => a.name).join(', ')}`);
    } else {
      console.log(`  负责人: 未分配`);
    }

    const labels = issue.labels || [];
    if (labels.length > 0) {
      console.log(`  标签: ${labels.map(l => l.name).join(', ')}`);
    }

    if (issue.priority) {
      console.log(`  优先级: ${issue.priority}`);
    }

    console.log(`  创建时间: ${issue.created_at}`);
    console.log(`  更新时间: ${issue.updated_at}`);

    if (detail && issue.description) {
      console.log(`\n描述:\n${issue.description}`);
    }

    if (detail && issue.url) {
      console.log(`\nURL: ${issue.url}`);
    }
  }

  /**
   * 格式化PR输出
   */
  formatPR(pr, detail = false, repo = null) {
    console.log(`PR #${pr.number}: ${pr.title}`);
    console.log(`  状态: ${pr.state}`);
    console.log(`  作者: ${pr.author?.name || 'N/A'}`);
    console.log(`  分支: ${pr.head_ref} → ${pr.base_ref}`);

    const reviewers = pr.reviewers || [];
    if (reviewers.length > 0) {
      console.log(`  审核人: ${reviewers.map(r => r.name).join(', ')}`);
    } else {
      console.log(`  审核人: 未指定`);
    }

    const assignees = pr.assignees || [];
    if (assignees.length > 0) {
      console.log(`  负责人: ${assignees.map(a => a.name).join(', ')}`);
    }

    const labels = pr.labels || [];
    if (labels.length > 0) {
      console.log(`  标签: ${labels.map(l => l.name).join(', ')}`);
    }

    console.log(`  创建时间: ${pr.created_at}`);
    console.log(`  更新时间: ${pr.updated_at}`);

    if (pr.merged) {
      console.log(`  ✅ 已合并`);
      console.log(`  合并时间: ${pr.merged_at}`);
    }

    if (detail && pr.description) {
      console.log(`\n描述:\n${pr.description}`);
    }

    // 始终输出标准化的 PR 链接
    const repoToUse = repo || this.repo;
    if (pr.number && repoToUse) {
      console.log(`\nPR 链接: https://cnb.woa.com/${repoToUse}/-/pulls/${pr.number}`);
    } else if (detail && pr.url) {
      console.log(`\nURL: ${pr.url}`);
    }
  }

  /**
   * 解析命令行参数
   */
  parseArgs(args) {
    const params = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const value = args[i + 1];

        switch (key) {
          case 'state':
          case 'labels':
          case 'assignees':
          case 'reviewers':
          case 'authors':
          case 'priority':
          case 'keyword':
          case 'cwd':
          case 'repo':
          case 'title':
          case 'head':
          case 'base':
          case 'body':
          case 'file':
            params[key] = value;
            i++;
            break;
          case 'head-repo':
            params.headRepo = value;
            i++;
            break;
          case 'state-reason':
            params.stateReason = value;
            i++;
            break;
          case 'number':
            params.number = parseInt(value);
            i++;
            break;
          case 'page':
            params.page = parseInt(value);
            i++;
            break;
          case 'page-size':
            params.pageSize = parseInt(value);
            i++;
            break;
          case 'json':
            params.json = true;
            break;
        }
      }
    }

    return params;
  }

  /**
   * 处理上传图片命令
   */
  async handleUploadImg(args) {
    const params = this.parseArgs(args);
    const { apiKey, repo: autoRepo } = await this.ensureSetup(params.cwd);
    const repo = params.repo || autoRepo;

    if (!repo) {
      console.error('❌ 未检测到repo\n');
      console.error('请使用 --repo 参数指定仓库');
      process.exit(1);
    }

    // 验证必需参数
    if (!params.file) {
      console.error('❌ 缺少必需参数\n');
      console.error('必需参数:');
      console.error('  --file <文件路径>       图片文件路径');
      console.error('\n示例:');
      console.error('  cnb upload-img --repo genie/genie --file ./screenshot.png');
      process.exit(1);
    }

    // 检查文件是否存在
    const filePath = path.resolve(params.file);
    if (!existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${filePath}`);
      process.exit(1);
    }

    // 获取文件信息
    const fileStats = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    const fileSize = fileStats.size;

    try {
      console.log(`🖼️  上传图片: ${fileName}\n`);
      console.log(`  仓库: ${repo}`);
      console.log(`  文件: ${filePath}`);
      console.log(`  大小: ${fileSize} bytes\n`);

      // 步骤1: 获取上传URL
      console.log('📤 步骤1: 获取上传URL...');
      const uploadUrl = `${BASE_URL}/${repo}/-/upload/imgs`;
      const uploadReqResponse = await axios.post(uploadUrl, {
        name: fileName,
        size: fileSize
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const { upload_url, token, assets } = uploadReqResponse.data;

      if (!upload_url) {
        console.error('❌ 获取上传URL失败: 响应中没有 upload_url');
        console.error(JSON.stringify(uploadReqResponse.data, null, 2));
        process.exit(1);
      }

      console.log('✅ 获取上传URL成功\n');

      // 步骤2: PUT上传文件
      console.log('📤 步骤2: 上传文件...');
      const fileContent = await fs.readFile(filePath);

      await axios.put(upload_url, fileContent, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileSize
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      console.log('✅ 文件上传成功!\n');

      // 输出结果
      if (params.json) {
        console.log(JSON.stringify({
          success: true,
          assets: assets,
          path: assets?.path,
          url: assets?.path ? `https://cnb.woa.com${assets.path}` : null
        }, null, 2));
      } else {
        console.log('📋 上传结果:');
        console.log(`  文件名: ${assets?.name || fileName}`);
        console.log(`  路径: ${assets?.path || 'N/A'}`);
        if (assets?.path) {
          console.log(`  URL: https://cnb.woa.com${assets.path}`);
        }
        console.log(`  大小: ${assets?.size || fileSize} bytes`);
        console.log(`  类型: ${assets?.content_type || 'N/A'}`);
      }

    } catch (error) {
      console.error(`❌ 上传图片失败: ${error.message}`);
      if (error.response) {
        console.error(`状态码: ${error.response.status}`);
        console.error(`响应: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      process.exit(1);
    }
  }

  /**
   * 处理generate命令
   */
  async handleGenerate(args) {
    if (args.length === 0) {
      console.error('❌ 请指定要生成的功能');
      console.error('用法: cnb generate <feature>');
      console.error('示例: cnb generate commits');
      process.exit(1);
    }

    const feature = args[0];
    console.log(`🔧 开始生成功能: ${feature}\n`);
    console.log('⚠️ 此功能需要让Claude Agent来实现');
    console.log(`请告诉Claude: 请分析swagger.json，为'${feature}'功能生成代码`);
  }
}

/**
 * 主函数
 */
async function main() {
  const skill = new CNBSkill();
  const args = process.argv.slice(2);

  // 安全检查
  skill.checkDangerousArgs(args);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    skill.showHelp();
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'config':
        await skill.handleConfig(commandArgs);
        break;
      case 'issues':
        await skill.handleIssues(commandArgs);
        break;
      case 'prs':
        await skill.handlePRs(commandArgs);
        break;
      case 'create-pr':
        await skill.handleCreatePR(commandArgs);
        break;
      case 'create-issue':
        await skill.handleCreateIssue(commandArgs);
        break;
      case 'update-issue':
        await skill.handleUpdateIssue(commandArgs);
        break;
      case 'comment-pr':
        await skill.handleCommentPR(commandArgs);
        break;
      case 'comment-issue':
        await skill.handleCommentIssue(commandArgs);
        break;
      case 'upload-img':
        await skill.handleUploadImg(commandArgs);
        break;
      case 'generate':
        await skill.handleGenerate(commandArgs);
        break;
      default:
        console.error(`❌ 未知命令: ${command}\n`);
        skill.showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

main();
