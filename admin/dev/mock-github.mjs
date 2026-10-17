// A stand-in for the GitHub API for local testing. It serves and writes files in a
// local folder (the site repo) instead of pushing to GitHub, so `jekyll serve` shows
// edits immediately and nothing leaves your machine.
//
//   node dev/mock-github.mjs <site folder> [port]
//
// Implements only the endpoints the admin uses.

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";

const root = resolve(process.argv[2] || "..");
const port = Number(process.argv[3] || 8788);

let head = randomBytes(20).toString("hex");
const blobs = new Map(); // sha -> Buffer
const trees = new Map(); // sha -> [{ path, sha }]
const commits = new Map(); // sha -> { tree, parent, message, author }

const blobSha = (buffer) =>
  createHash("sha1").update(`blob ${buffer.length}\0`).update(buffer).digest("hex");

function safePath(path) {
  const full = resolve(root, decodeURIComponent(path));
  if (!full.startsWith(root + "/")) throw Object.assign(new Error("bad path"), { status: 400 });
  return full;
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
}

createServer(async (req, res) => {
  try {
    if (!req.headers.authorization) return send(res, 401, { message: "Requires authentication" });
    const url = new URL(req.url, "http://localhost");
    const match = url.pathname.match(/^\/repos\/[^/]+\/[^/]+\/(.*)$/);
    if (!match) return send(res, 404, { message: "Not Found" });
    const route = match[1];

    // Read a file or list a folder.
    if (req.method === "GET" && route.startsWith("contents/")) {
      const relative = route.slice("contents/".length);
      const full = safePath(relative);
      if (!existsSync(full)) return send(res, 404, { message: "Not Found" });
      if (statSync(full).isDirectory()) {
        return send(res, 200, readdirSync(full).filter((n) => !n.startsWith(".")).map((name) => {
          const isDir = statSync(join(full, name)).isDirectory();
          return {
            name,
            path: `${decodeURIComponent(relative)}/${name}`,
            type: isDir ? "dir" : "file",
            sha: isDir ? "" : blobSha(readFileSync(join(full, name))),
          };
        }));
      }
      const buffer = readFileSync(full);
      if ((req.headers.accept || "").includes("raw")) return send(res, 200, buffer, "application/octet-stream");
      return send(res, 200, { type: "file", encoding: "base64", content: buffer.toString("base64"), sha: blobSha(buffer) });
    }

    if (req.method === "GET" && route.startsWith("git/ref/heads/")) return send(res, 200, { object: { sha: head } });
    if (req.method === "GET" && route.startsWith("git/commits/")) return send(res, 200, { tree: { sha: `tree-${route.split("/").pop()}` } });

    const body = await readBody(req);

    if (req.method === "POST" && route === "git/blobs") {
      const buffer = Buffer.from(body.content, body.encoding === "base64" ? "base64" : "utf8");
      const sha = blobSha(buffer);
      blobs.set(sha, buffer);
      return send(res, 201, { sha });
    }
    if (req.method === "POST" && route === "git/trees") {
      const sha = randomBytes(20).toString("hex");
      trees.set(sha, body.tree);
      return send(res, 201, { sha });
    }
    if (req.method === "POST" && route === "git/commits") {
      const sha = randomBytes(20).toString("hex");
      commits.set(sha, { tree: body.tree, parent: body.parents[0], message: body.message, author: body.author });
      return send(res, 201, { sha });
    }

    // Moving the branch applies the commit's changes to the folder.
    if (req.method === "PATCH" && route.startsWith("git/refs/heads/")) {
      const commit = commits.get(body.sha);
      if (!commit || commit.parent !== head) return send(res, 422, { message: "Update is not a fast forward" });
      for (const entry of trees.get(commit.tree)) {
        const full = safePath(entry.path);
        if (entry.sha === null) {
          rmSync(full, { force: true });
        } else {
          mkdirSync(dirname(full), { recursive: true });
          writeFileSync(full, blobs.get(entry.sha));
        }
      }
      head = body.sha;
      console.log(`commit by ${commit.author?.name}: ${commit.message}`);
      return send(res, 200, { object: { sha: head } });
    }

    send(res, 404, { message: "Not Found" });
  } catch (error) {
    send(res, error.status || 500, { message: error.message });
  }
}).listen(port, () => console.log(`Mock GitHub on http://localhost:${port}, writing to ${root}`));
