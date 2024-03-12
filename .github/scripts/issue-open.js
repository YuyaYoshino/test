const issue_number = process.argv[2];
const eventType = process.argv[3];
const config = require("../config.json");

const { Octokit } = require("@octokit/rest");
const fetch = require("node-fetch");

const owner = config.owner;
const repo = config.repo;
const labels = config.labels;
const readmeFileName = config.readmeFileName;

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  request: {
    fetch: fetch,
  },
});

async function createFileInNewFolder(labelName, QAID, issueBody) {
  const path = `${labelName}/${QAID}/${readmeFileName}`; // 新しいフォルダとファイルのパス
  const message = `Create ${labelName}-folder and add ${readmeFileName}`; // コミットメッセージ
  const content = Buffer.from(issueBody).toString("base64"); // ファイルの内容
  const branch = "main"; // ブランチ名

  try {
    // ファイルを作成する
    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content,
      branch,
    });

    console.log("File created:", response.data.commit.html_url);
  } catch (error) {
    console.error("Error creating file:", error);
  }
}

async function run() {
  const { data: issue } = await octokit.issues.get({
    owner,
    repo,
    state: "open",
    issue_number,
  });

  const issueLabels = issue.labels.map((label) => label.name);

  let foundLabelKey = null;
  let labelPrefix = issueLabels.find((label) => {
    if (labels[label]) {
      foundLabelKey = label; // 見つかったラベルのキーを格納
      return true;
    }
    return false;
  })
    ? labels[foundLabelKey]
    : null;

  if (labelPrefix) {
    const QAID = `[${labelPrefix}Q${issueId}] ${issue.title}`;
    await createFileInNewFolder(foundLabelKey, QAID, issue.body);
    // addAラベルが付いていれば外す。
    try {
      await octokit.issues.removeLabel({
        owner,
        repo,
        issue_number,
        name: "未設定項目あり",
      });
      console.log(`Label "未設定項目あり" removed from issue #${issueId}`);
    } catch (error) {
      console.error("Error removing label:", error);
    }
  } else {
    // addAラベル付与
    try {
      await octokit.issues.addLabels({
        owner,
        repo,
        issue_number,
        labels: ["未設定項目あり"],
      });
      console.log(`Label "未設定項目あり" added to issue #${issueId}`);
    } catch (error) {
      console.error("Error adding label:", error);
    }
  }
}

run();
