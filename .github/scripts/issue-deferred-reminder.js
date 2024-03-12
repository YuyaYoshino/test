const config = require("../config.json");
const { Octokit } = require("@octokit/rest");
const fetch = require("node-fetch");

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  request: {
    fetch: fetch,
  },
});
async function run() {
  const owner = config.owner;
  const repo = config.repo;
  const deferredMillisecond = config.deferredMillisecond;
  const messages = config.messages;

  const { data: issues } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: "open",
  });

  for (const issue of issues) {
    const lastUpdated = new Date(issue.updated_at);
    const deferredTime = new Date(new Date().getTime() - deferredMillisecond);
    if (lastUpdated < oneHourAgo) {
      const creator = issue.user.login; // Issue作成者
      let bodyMessage = `${messages.deferredRemind}@${creator}`;

      // アサインされているユーザーがいる場合は、それらのユーザーにもメンションを追加
      if (issue.assignees.length > 0) {
        const assignees = issue.assignees
          .map((assignee) => `@${assignee.login}`)
          .join(" ");
        bodyMessage += `\n${messages.asignUser}${assignees}`;
      } else {
        bodyMessage += `\n${messages.asignUserNotIn}`;
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
