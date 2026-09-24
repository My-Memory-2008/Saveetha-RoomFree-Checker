export async function onRequestPost(context) {
  try {
    const { GITHUB_USERNAME, REPO_NAME, WORKFLOW_FILE } = await context.request.json();

    // Get the token from your Pages environment variables
    const token = context.env.GITHUB_TOKEN;

    // Debug: Check if token exists
    if (!token) {
      return new Response("ERROR: GITHUB_TOKEN is not set in Cloudflare Pages environment variables. Please add it in Settings → Environment Variables.", { 
        status: 500 
      });
    }

    // Debug: Check token format (don't expose the full token)
    if (!token.startsWith("ghp_") && !token.startsWith("github_pat_")) {
      return new Response(`ERROR: Token format is invalid. It should start with 'ghp_' or 'github_pat_'. Your token starts with: '${token.substring(0, 10)}...'`, { 
        status: 500 
      });
    }

    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

    console.log("Triggering workflow:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token.trim()}`, // .trim() removes any accidental spaces
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "Saveetha-RoomFree-Checker-App"
      },
      body: JSON.stringify({ ref: "main" })
    });

    if (response.status === 204) {
      return new Response("Workflow triggered successfully", { status: 200 });
    } else {
      const errorText = await response.text();
      return new Response(`GitHub API Error: ${response.status} - ${errorText}`, { 
        status: response.status 
      });
    }
  } catch (error) {
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
}
