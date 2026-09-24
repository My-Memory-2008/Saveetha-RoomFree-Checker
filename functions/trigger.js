export async function onRequestPost(context) {
  try {
    const { GITHUB_USERNAME, REPO_NAME, WORKFLOW_FILE } = await context.request.json();

    // Get the token from your Pages environment variables
    const token = context.env.GITHUB_TOKEN;

    if (!token) {
      return new Response("Missing GITHUB_TOKEN secret", { status: 500 });
    }

    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "Saveetha-RoomFree-Checker-App" // ✅ THIS IS THE FIX!
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
