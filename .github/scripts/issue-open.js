const issue_number = process.argv[2];
const eventType = process.argv[3];
const userAddLabel = process.argv[4];
const addLabelName = process.argv[5];
const config = require("../config.json");

const { Octokit } = require("@octokit/rest");
const fetch = require("node-fetch");

const owner = config.owner;
const repo = config.repo;
const labels = config.labels;
const topFolder = config.topFolder;
const readmeFileName = config.readmeFileName;
const systemLabel = config.systemLabel;
const messages = config.messages;

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  request: {
    fetch: fetch,
  },
});

async function createFileInNewFolder(labelName, QAID, issueBody) {
  const path = `${topFolder}/${labelName}/${QAID}/${readmeFileName}`; // 新しいフォルダとファイルのパス
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
async function removeLabel() {
  try {
    await octokit.issues.removeLabel({
      owner,
      repo,
      issue_number,
      name: systemLabel,
    });
    console.log(`Label "${systemLabel}" removed from issue #${issue_number}`);
  } catch (error) {
    console.error("Error removing label:", error);
  }
}
async function addLavel() {
  try {
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number,
      labels: [systemLabel],
    });
    console.log(`Label "${systemLabel}" added to issue #${issue_number}`);
  } catch (error) {
    console.error("Error adding label:", error);
  }
}
async function addCommentToIssue(additionalComment) {
  try {
    // Issueの現在の内容を取得
    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number,
    });

    // Issueの本文にコメントを追記
    const updatedBody = issue.body.replace(
      /(【確認先URL】\n.+\n)/,
      `$1${additionalComment}\n`
    );

    // Issueを更新
    await octokit.issues.update({
      owner,
      repo,
      issue_number,
      body: updatedBody,
    });

    console.log(`Issue #${issue_number} has been updated.`);
  } catch (error) {
    console.error(`Error updating issue #${issue_number}:`, error);
  }
}
async function run() {
  const { data: issue } = await octokit.issues.get({
    owner,
    repo,
    state: "open",
    issue_number,
  });
  const hasLabel = issue.labels.some((label) => label.name === systemLabel);
  if (eventType === "labeled") {
    if (!hasLabel) {
      console.log("Processing-free label assignment trigger");
      return;
    } else if (userAddLabel === "github-actions[bot]") {
      console.log("Processing unnecessary bot add label trigger");
      return;
    } else if (addLabelName === systemLabel) {
      await removeLabel();
      console.log("Processing unnecessary user add label trigger");
      return;
    }
  }

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
    const QAID = `[${labelPrefix}Q${issue_number}] ${issue.title}`;
    const folderURL = `https://github.com/${owner}/${repo}/tree/main/${topFolder}/${foundLabelKey}/${QAID}`;
    const markDownComment = `[${messages.fileManagementTargetURLTitle}](<${folderURL}>)`;
    // ファイル管理先URLをissueに追記
    await addCommentToIssue(markDownComment);
    // フォルダ作成
    await createFileInNewFolder(foundLabelKey, QAID, issue.body);
    // ラベル外す
    if (eventType !== "opened") {
      await removeLabel();
    }
  } else {
    // ラベル付与
    await addLavel();
  }
}

run();
