const { Octokit } = require("@octokit/rest");
const fetch = require('node-fetch');

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  request: {
    fetch: fetch
  }
});

async function run() {
  const owner = 'YuyaYoshino';
  const repo = 'test';
  const { data: issues } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: 'open',
  });

  for (const issue of issues) {
    const lastUpdated = new Date(issue.updated_at);
    const oneHourAgo = new Date(new Date().getTime() - 60 * 60 * 1000);
    if (lastUpdated < oneHourAgo) {
      const creator = issue.user.login; // Issue作成者
      let bodyMessage = `このIssueは1時間以上更新されていません。@${creator}`;

      // アサインされているユーザーがいる場合は、それらのユーザーにもメンションを追加
      if (issue.assignees.length > 0) {
        const assignees = issue.assignees.map(assignee => `@${assignee.login}`).join(' ');
        bodyMessage += ` アサインされているユーザー: ${assignees}`;
      } else {
        // アサインがない場合
        bodyMessage += ` アサインがされていません。`;
      }

      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issue.number,
        body: bodyMessage,
      });
    }
  }
}

run();
