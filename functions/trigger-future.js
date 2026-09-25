export async function onRequestPost(context) {
  try {
    // Destructure inputs specifically for the future workflow
    const { GITHUB_USERNAME, REPO_NAME, WORKFLOW_FILE, inputs } = await context.request.json();

    // Get the token from your Pages environment variables
    const token = context.env.GITHUB_TOKEN;

    // Debug: Check if token exists
    if (!token) {
      return new Response("ERROR: GITHUB_TOKEN is not set in Cloudflare Pages environment variables.", { 
        status: 500 
      });
    }

    // Debug: Check token format
    if (!token.startsWith("ghp_") && !token.startsWith("github_pat_")) {
      return new Response(`ERROR: Token format is invalid. Starts with: '${token.substring(0, 10)}...'`, { 
        status: 500 
      });
    }

    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

    console.log("Triggering future workflow:", url, "with inputs:", inputs);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token.trim()}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "Saveetha-RoomFree-Checker-App"
      },
      body: JSON.stringify({ 
        ref: "main", // Change to "master" if your default branch is master
        inputs: inputs // <-- CRITICAL: Passes target_date and target_time to GitHub
      })
    });

    if (response.status === 204) {
      return new Response(JSON.stringify({ success: true, message: "Future workflow triggered successfully" }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `GitHub API Error: ${response.status}`, details: errorText }), { 
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: `Server error: ${error.message}` }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
