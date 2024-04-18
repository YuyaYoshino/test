const issue_number = process.argv[2];
const eventType = process.argv[3];
const userAddLabel = process.argv[4];
const addLabelName = process.argv[5];
const config = require("../config.json");

const { Octokit } = require("@octokit/rest");
const { graphql } = require("@octokit/graphql");
const fetch = require("node-fetch");

const owner = config.owner;
const repo = config.repo;
const projectId = config.projectId;
const fieldId = config.fieldId;
const labels = config.labels;
const projectLabels = config.projectLabels;
const topFolder = config.topFolder;
const fiscalYearFolder = config.fiscalYearFolder;
const readmeFileName = config.readmeFileName;
const systemLabel = config.systemLabel;
const messages = config.messages;

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  request: {
    fetch: fetch,
  },
});
const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.CUSTOM_GITHUB_TOKEN}`,
  },
  request: { fetch },
});

async function updateProjectV2ItemField(labelName) {
  var mutation = `
  mutation {
    updateProjectV2ItemFieldValue(input:{
      itemId:"I_kwDOLdXQFc6FE1Sj",
      projectId:"PVT_kwHOCPc4N84Af0hw",
      fieldId:"PVTFSV_lQHOCPc4N84Af0hwzgOF9n_OCiXaKQ",
      value:{singleSelectOptionId:"a127aedd"}
    }){
      projectV2Item{
        id
        __typename
      }
    }
  }
  
  `;
  // mutation = `
  // query getNumberFields($ownerName: String!, $projectName: String!, $issueNumber: Int!) {
  //   repository(owner: $ownerName, name: $projectName) {
  //     issue(number: $issueNumber) {
  //       id
  //       projectItems(first: 10) {
  //         nodes {
  //           id
  //           fieldValues(first: 10) {
  //             nodes {
  //               ... on ProjectV2ItemFieldNumberValue {
  //                 id
  //                 number
  //               }
  //             }
  //           }
  //         }
  //       }
  //     }
  //   }
  // }
  // `;

  const variables = {
    // ownerName: owner,
    // projectName: repo,
    // issueNumber: Number(issue_number),
    issueId: Number(issue_number),
    column: labelName,
    fieldId: `I_kwDOLdXQFc6FE1Sj`,
    projectId: Number(projectId),
  };

  try {
    console.log(mutation);
    console.log(variables);
    const response = await graphqlWithAuth(mutation); //, variables);
    console.log(JSON.stringify(response, null, "\t"));
    console.log(JSON.stringify(response, null, 2));
    console.log("Project V2 Item Field Value updated:", response);
  } catch (error) {
    console.error("Error updating Project V2 Item Field Value:", error);
  }
}
async function createOrUpdateFileWithDifferentMessages(labelName, QAID) {
  const { data: issue } = await octokit.issues.get({
    owner,
    repo,
    issue_number,
  });
  const path = `${topFolder}/${fiscalYearFolder}/${labelName}/${QAID}/${readmeFileName}`;
  const content = Buffer.from(issue.body).toString("base64");
  const branch = "main";

  try {
    // 指定したパスのファイル内容を取得しようとする
    const { data: getContentData } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    // ファイルが存在する場合、更新用のメッセージとSHAを設定
    const sha = getContentData.sha;
    const updateMessage = `Update ${labelName}-folder and modify ${readmeFileName} #${issue_number}`;

    // ファイルを更新する
    const updateResponse = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: updateMessage,
      content,
      branch,
      sha, // 更新するファイルの現在のSHAを指定
    });

    console.log("File updated:", updateResponse.data.commit.html_url);
  } catch (error) {
    if (error.status === 404) {
      // ファイルが存在しない場合、新規作成用のメッセージを設定
      const createMessage = `Create ${labelName}-folder and add ${readmeFileName} #${issue_number}`;

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
async function countFolders(path) {
  let folderCount = 0;
  try {
    // 指定したパスのコンテンツを取得
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    // フォルダのみをフィルタリング
    folderCount = data.filter((item) => item.type === "dir").length;
    console.log(`Number of folders in '${path}': ${folderCount}`);
    // console.log(JSON.stringify(data, null, "\t"));
  } catch (error) {
    console.error(`No folders in path: ${path}`);
  }
  return folderCount;
}
async function issueIdByFolderExistsConfirmation(path) {
  let result = undefined;
  try {
    // 指定したパスのコンテンツを取得
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    // フォルダのみをフィルタリング
    result = data.find((item) => item.name.includes(`#${issue_number}`));
    // console.log(JSON.stringify(data,null,'\t'));
  } catch (error) {
    console.error(`No folders in path: ${path}`);
  }

  if (result) {
    console.log(`Folder with issueID: ${result.path}`);
    result = result.name;
  } else {
    console.error(`There was no folder for issueID: ${path}`);
  }
  return result;
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
      const folderCount = await countFolders(
        `${topFolder}/${fiscalYearFolder}/${foundLabelKey}`
      );
      const issueIDFolderName = await issueIdByFolderExistsConfirmation(
        `${topFolder}/${fiscalYearFolder}/${foundLabelKey}`
      );
      const paddedFolderCount = String(folderCount + 1).padStart(2, "0");
      const QAID = issueIDFolderName
        ? issueIDFolderName
        : `[${labelPrefix}${paddedFolderCount}#${issue_number}] ${issue.title}`;
      const folderURL = `https://github.com/${owner}/${repo}/tree/main/${topFolder}/${fiscalYearFolder}/${foundLabelKey}/${encodeURIComponent(
        QAID
      )}`;
      const markDownComment = `【関連資料】\n[${messages.fileManagementTargetURLTitle}](<${folderURL}>)`;
      // ファイル管理先URLをissueに追記
      await addCommentToIssue(markDownComment);
      // フォルダ作成またはアップデート
      await createOrUpdateFileWithDifferentMessages(foundLabelKey, QAID);
      // ProjectsのprojectLabelsフィールドを設定
      await updateProjectV2ItemField(projectLabels[foundLabelKey]);
      // // ラベル外す
      if (hasLabel) {
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
