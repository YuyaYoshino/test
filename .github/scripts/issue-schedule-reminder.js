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
  const messages = config.messages;
  const { data: issues } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: "open",
  });

  issues.forEach(async (issue) => {
    // 初期リマインダーメッセージの設定
    const creatorMention = `@${issue.user.login}`;
    let reminderMessage = `${messages.scheduleRemind}${creatorMention}`;

    // アサインされているユーザーがいればメンションを追加
    if (issue.assignees.length) {
      const assigneeMentions = issue.assignees
        .map((assignee) => `@${assignee.login}`)
        .join(" ");
      reminderMessage += `\n${messages.asignUser}${assigneeMentions}`;
    } else {
      reminderMessage += `\n${messages.asignUserNotIn}`;
    }
    if (issue.body !== null) {
      // 問い合わせ日時からリマインドが必要か判断
      const isReminderNeeded = issue.body
        .split("\n")
        .some((line, index, lines) => {
          return (
            line.includes("【問い合わせ日時】") &&
            new Date(lines[index + 1].trim()).setHours(0, 0, 0, 0) ===
              new Date().setHours(0, 0, 0, 0)
          );
        });

      // リマインドが必要な場合、コメントを作成
      if (isReminderNeeded) {
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: issue.number,
          body: reminderMessage,
        });
      }
    }
  });
}

run();
