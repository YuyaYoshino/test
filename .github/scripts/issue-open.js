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

async function createOrUpdateFileWithDifferentMessages(labelName, QAID) {
  const { data: issue } = await octokit.issues.get({
    owner,
    repo,
    issue_number,
  });
  const path = `${topFolder}/${labelName}/${QAID}/${readmeFileName}`;
  const content = Buffer.from(issue.body).toString("base64");
  const branch = "main";

  try {
    // 指定したパスのファイル内容を取得しようとする
    await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    // ファイルが存在する場合、更新用のメッセージを設定
    const updateMessage = `Update ${labelName}-folder and modify ${readmeFileName}`;

    // ファイルを更新する
    const updateResponse = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: updateMessage,
      content,
      branch,
    });

    console.log("File updated:", updateResponse.data.commit.html_url);
  } catch (error) {
    if (error.status === 404) {
      // ファイルが存在しない場合、新規作成用のメッセージを設定
      const createMessage = `Create ${labelName}-folder and add ${readmeFileName}`;

      // ファイルを新規作成する
      const createResponse = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: createMessage,
        content,
        branch,
      });

      console.log("File created:", createResponse.data.commit.html_url);
    } else {
      console.error("Error accessing file:", error);
    }
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
function insertCommentAfterURLSection(issueBody, comment) {
  const urlSectionTitle = "【確認先URL】";
  const sections = issueBody.split("\n");
  let updatedSections = [];
  let foundURLSection = false;

  for (const section of sections) {
    updatedSections.push(section);
    if (foundURLSection) {
      updatedSections.push(comment);
      foundURLSection = false;
    }
    if (section.startsWith(urlSectionTitle)) {
      foundURLSection = true;
    }
  }

  return updatedSections.join("\n");
}
async function checkPathExists(path) {
  try {
    await octokit.repos.getContent({
      owner,
      repo,
      path,
    });
    console.log("Path exists!");
  } catch (error) {
    if (error.status === 404) {
      console.log("Path does not exist.");
    } else {
      console.error("An error occurred:", error);
    }
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

    // console.log(issue.body);
    // console.log(additionalComment);
    // const updatedBody = insertCommentAfterURLSection(
    //   issue.body,
    //   additionalComment
    // );
    // console.log(updatedBody);

    // Issueを更新
    await octokit.issues.update({
      owner,
      repo,
      issue_number,
      body: `${issue.body}\n${additionalComment}`,
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
  const issueLabels = issue.labels.map((label) => label.name);
  const hasLabel = issueLabels.some((label) => label === systemLabel);

  const labelCount = issueLabels.filter((label) =>
    Object.keys(labels).includes(label)
  ).length;

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

  if (eventType === "opened") {
    // 作成されたが、ラベルが付いていなかったもしくは、2個以上ついていた。
    if (labelCount !== 1) {
      // ラベル付与
      console.log(
        "Triggers that do not need to be executed because they were not labeled"
      );
      await addLavel();
    }
  } else if (eventType === "labeled") {
    if (userAddLabel === "github-actions[bot]") {
      // ラベル追加がbotだった場合
      console.log("Processing unnecessary bot add label trigger");
      return;
    } else if (addLabelName === systemLabel) {
      // ユーザーがシステム用のラベルを付与した場合
      await removeLabel();
      console.log("Processing unnecessary user add label trigger");
      return;
    } else if (!Object.keys(labels).includes(addLabelName)) {
      // 会社名ラベル以外のラベル付与だった場合
      console.log("Processing-free label assignment trigger");
      return;
    } else if (labelCount === 1) {
      // 会社名ラベルが付与されて、かつラベル数が1個だった場合
      const QAID = `[${labelPrefix}Q${issue_number}] ${issue.title}`;
      const folderURL = `https://github.com/${owner}/${repo}/tree/main/${topFolder}/${foundLabelKey}/${QAID}`;
      const markDownComment = `[${messages.fileManagementTargetURLTitle}](<${folderURL}>)`;
      // ファイル管理先URLをissueに追記
      await addCommentToIssue(markDownComment);
      // フォルダ作成またはアップデート
      await createOrUpdateFileWithDifferentMessages(foundLabelKey, QAID);
      // // ラベル外す
      if (Object.keys(labels).includes(systemLabel)) {
        await removeLabel();
      }
      return;
    } else {
      console.log(
        "Triggers that do not need to be executed due to multiple labels"
      );
      return;
    }
  }
}

run();
