import test from "node:test";
import assert from "node:assert/strict";
import {
  getInstagramFeed,
  FALLBACK_INSTAGRAM_POSTS,
  INSTAGRAM_PROFILE_URL,
  INSTAGRAM_HANDLE,
} from "../lib/instagram";

test("Instagram feed returns fallback posts when no token is present", async () => {
  const originalToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  delete process.env.INSTAGRAM_ACCESS_TOKEN;

  try {
    const result = await getInstagramFeed(6);

    assert.equal(result.isLive, false);
    assert.equal(result.posts.length, 6);
    assert.equal(result.posts[0].permalink, INSTAGRAM_PROFILE_URL);
    assert.ok(result.posts[0].media_url.length > 0);
    assert.ok(result.posts[0].caption && result.posts[0].caption.length > 0);
    assert.equal(INSTAGRAM_HANDLE, "@imports_alvess");
  } finally {
    if (originalToken !== undefined) {
      process.env.INSTAGRAM_ACCESS_TOKEN = originalToken;
    }
  }
});

test("Instagram feed limits number of fallback posts", async () => {
  const originalToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  delete process.env.INSTAGRAM_ACCESS_TOKEN;

  try {
    const result = await getInstagramFeed(3);
    assert.equal(result.posts.length, 3);
  } finally {
    if (originalToken !== undefined) {
      process.env.INSTAGRAM_ACCESS_TOKEN = originalToken;
    }
  }
});
