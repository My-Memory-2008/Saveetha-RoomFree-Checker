export async function onRequestPost(context) {
  try {
    const { GITHUB_USERNAME, REPO_NAME, WORKFLOW_FILE } = await context.request.json();
    const token = context.env.GITHUB_TOKEN;

    if (!token) {
      return new Response("ERROR: GITHUB_TOKEN is not set in Cloudflare Pages environment variables.", { status: 500 });
    }

    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

    console.log("Triggering fast workflow:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token.trim()}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "Saveetha-RoomFree-Checker-App"
      },
      body: JSON.stringify({ ref: "main" })
    });

    if (response.status === 204) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    } else {
      const errorText = await response.text();
      console.error("GitHub API Error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `GitHub API Error: ${response.status}`, details: errorText }), { 
        status: response.status,
        headers: { "Content-Type": "application/json" } 
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
