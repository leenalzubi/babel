/** Full URL for GitHub Models chat completions (REST). */
export const GITHUB_MODELS_CHAT_URL =
  'https://models.github.ai/inference/chat/completions'

/** GitHub Models text embeddings (REST). */
export const GITHUB_MODELS_EMBEDDINGS_URL =
  'https://models.github.ai/inference/embeddings'

/** Per GitHub Models quickstart; avoids version mismatch with some inference routes. */
export const GITHUB_MODELS_API_VERSION = '2022-11-28'

/**
 * Headers GitHub recommends for Models inference (plus any extras, e.g. Content-Type).
 * @param {Record<string, string>} [extra]
 */
export function githubModelsFetchHeaders(extra = {}) {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_MODELS_API_VERSION,
    ...extra,
  }
}
