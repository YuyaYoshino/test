const { Octokit } = require("@octokit/rest");
const fetch = require('node-fetch');

const octokit = new Octokit({
  auth: process.env.MY_PERSONAL_TOKEN,
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

  const oneHourAgo = new Date(new Date().getTime() - 60*1000);

  for (const issue of issues) {
    const lastUpdated = new Date(issue.updated_at);
    if (lastUpdated < oneHourAgo) {
      const assignees = issue.assignees.map(assignee => `@${assignee.login}`).join(' ');
      if (assignees.length > 0) {
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: issue.number,
          body: `このIssueは1時間以上更新されていません: ${assignees}`,
        });
      }
    }
  }
}

run();
