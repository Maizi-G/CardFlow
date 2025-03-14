export default (app) => {
  app.on("issues.opened", async (context) => {
    const issue = context.payload.issue;
    // 检查 issue 是否带有 "new card" 标签
    const labels = issue.labels.map((label) =>
      typeof label === "string" ? label : label.name
    );
    if (!labels.includes("new card")) {
      return;
    }

    console.log("Issue body:", issue.body);
    const body = issue.body;

    // 使用改进后的正则表达式匹配 Markdown 格式的内容：
    // 匹配 "### 名称" 后面的内容，直到遇到下一个 "###" 或文本结束
    const cardNameMatch = body.match(/###\s*名称\s*\n+([\s\S]*?)(?=\n###|$)/);
    const cardImageMatch = body.match(/###\s*卡面链接\s*\n+([\s\S]*?)(?=\n###|$)/);
    const applyLinkMatch = body.match(/###\s*申请链接\s*\n+([\s\S]*?)(?=\n###|$)/);

    if (!cardNameMatch || !cardImageMatch || !applyLinkMatch) {
      const comment = context.issue({
        body: "无法解析卡片信息，请检查提交的格式是否正确。",
      });
      await context.octokit.issues.createComment(comment);
      return;
    }

    // 输出捕获的内容便于调试
    console.log("card_name match:", cardNameMatch[1]);
    console.log("card_image match:", cardImageMatch[1]);
    console.log("apply_link match:", applyLinkMatch[1]);

    const card_name = cardNameMatch[1].trim();
    const card_image = cardImageMatch[1].trim();
    const apply_link = applyLinkMatch[1].trim();

    // 获取仓库信息
    const { owner, repo } = context.repo();
    const branchName = `add-card-${issue.number}`;

    // 取得默认分支信息
    const repoData = await context.octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.data.default_branch;

    // 获取默认分支最新 commit 的 sha
    const refData = await context.octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });
    const sha = refData.data.object.sha;

    // 基于默认分支创建新分支
    await context.octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha,
    });

    // 尝试获取仓库根目录下的 card.json 文件
    let fileContent = [];
    let fileSha;
    try {
      const fileResponse = await context.octokit.repos.getContent({
        owner,
        repo,
        path: "card.json",
        ref: defaultBranch,
      });
      const contentBuffer = Buffer.from(fileResponse.data.content, "base64");
      const contentStr = contentBuffer.toString("utf8");
      fileContent = JSON.parse(contentStr);
      if (!Array.isArray(fileContent)) {
        fileContent = [];
      }
      fileSha = fileResponse.data.sha;
    } catch (error) {
      // 文件不存在时，初始化为空数组
      fileContent = [];
    }

    // 根据已有内容计算新的 id
    let nextId = 1;
    if (fileContent.length > 0) {
      const ids = fileContent.map((card) => card.id);
      nextId = Math.max(...ids) + 1;
    }

    // 组装新的卡片对象
    const newCard = {
      id: nextId,
      card_name,
      card_image,
      apply_link,
    };

    // 将新卡片追加到数组中
    fileContent.push(newCard);
    const newFileContentStr = JSON.stringify(fileContent, null, 2);

    // 在新分支上创建或更新 card.json 文件
    await context.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: "card.json",
      message: `Add new card from issue #${issue.number}`,
      content: Buffer.from(newFileContentStr).toString("base64"),
      branch: branchName,
      sha: fileSha, // 若 fileSha 为 undefined，则认为文件不存在
    });

    // 创建 PR，并在 PR 描述中关联 issue
    const prResponse = await context.octokit.pulls.create({
      owner,
      repo,
      title: `Add new card: ${card_name}`,
      head: branchName,
      base: defaultBranch,
      body: `This PR adds a new card from issue #${issue.number}.\n\n本 PR 需要合作者审核通过后才能合并。\n\nCloses #${issue.number}`,
    });

    const prUrl = prResponse.data.html_url;
    const issueComment = context.issue({
      body: `已创建 PR：${prUrl}，请合作者审批后合并。`,
    });
    await context.octokit.issues.createComment(issueComment);
  });

  // PR 合并后自动关闭关联的 issue
  app.on("pull_request.closed", async (context) => {
    const pr = context.payload.pull_request;
    if (!pr.merged) return;

    const body = pr.body;
    const issueNumberMatch = body.match(/Closes #(\d+)/i);
    if (issueNumberMatch) {
      const issueNumber = parseInt(issueNumberMatch[1], 10);
      await context.octokit.issues.update(
        context.repo({
          issue_number: issueNumber,
          state: "closed",
        })
      );
    }
  });
};