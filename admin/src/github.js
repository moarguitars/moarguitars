// Minimal GitHub client: read files, and write several files as one commit.

export function github(env) {
  const base = env.GITHUB_API || "https://api.github.com";
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "master";

  async function call(method, path, body, accept = "application/vnd.github+json") {
    const response = await fetch(`${base}/repos/${repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: accept,
        "User-Agent": "moar-admin",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body && { "Content-Type": "application/json" }),
      },
      body: body && JSON.stringify(body),
    });
    if (!response.ok) {
      const error = new Error(`GitHub ${method} ${path} failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return response;
  }

  const contentsPath = (path) => `/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${branch}`;

  return {
    /** Files in a folder: [{ name, path, sha }] */
    async list(dir) {
      const items = await (await call("GET", contentsPath(dir))).json();
      return items.filter((item) => item.type === "file");
    },

    /** A text file's contents and blob sha, or null if it doesn't exist. */
    async read(path) {
      try {
        const file = await (await call("GET", contentsPath(path))).json();
        const bytes = Uint8Array.from(atob(file.content.replace(/\n/g, "")), (c) => c.charCodeAt(0));
        return { text: new TextDecoder().decode(bytes), sha: file.sha };
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    },

    /** The latest commits on the branch, newest first: [{ sha, message, date }] */
    async commits(limit = 8) {
      const list = await (await call("GET", `/commits?sha=${branch}&per_page=${limit}`)).json();
      return list.map((c) => ({ sha: c.sha, message: c.commit.message, date: c.commit.committer?.date || c.commit.author?.date }));
    },

    /** A file's raw bytes as a Response (used for image previews). */
    raw(path) {
      return call("GET", contentsPath(path), undefined, "application/vnd.github.raw");
    },

    /**
     * Commit changes on top of the branch head.
     * files: [{ path, text } | { path, base64 } | { path, delete: true }]
     */
    async commit({ message, author, files }) {
      const head = (await (await call("GET", `/git/ref/heads/${branch}`)).json()).object.sha;
      const baseTree = (await (await call("GET", `/git/commits/${head}`)).json()).tree.sha;

      const tree = await Promise.all(
        files.map(async (file) => {
          if (file.delete) return { path: file.path, mode: "100644", type: "blob", sha: null };
          const blob = await (
            await call("POST", "/git/blobs", file.base64 !== undefined
              ? { content: file.base64, encoding: "base64" }
              : { content: file.text, encoding: "utf-8" })
          ).json();
          return { path: file.path, mode: "100644", type: "blob", sha: blob.sha };
        }),
      );

      const newTree = await (await call("POST", "/git/trees", { base_tree: baseTree, tree })).json();
      const commit = await (
        await call("POST", "/git/commits", { message, tree: newTree.sha, parents: [head], author })
      ).json();

      try {
        await call("PATCH", `/git/refs/heads/${branch}`, { sha: commit.sha, force: false });
      } catch (error) {
        // The branch moved while we were committing: someone else saved at the same moment.
        if (error.status === 422) throw Object.assign(new Error("Someone else saved at the same time. Please try again."), { status: 409 });
        throw error;
      }
      return commit.sha;
    },
  };
}
