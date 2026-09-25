// functions/future-status.js
export async function onRequestGet(context) {
  try {
    const token = context.env.GITHUB_TOKEN;
    const username = "My-Memory-2008"; 
    const repo = "Saveetha-RoomFree-Checker";
    const workflow = "predict-future.yml";

    const url = `https://api.github.com/repos/${username}/${repo}/actions/workflows/${workflow}/runs?per_page=1`;

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    if (response.ok) {
      const data = await response.json();
      const latestRun = data.workflow_runs[0];

      if (latestRun) {
        return new Response(JSON.stringify({
          status: latestRun.status,       // "queued", "in_progress", "completed"
          conclusion: latestRun.conclusion // "success", "failure", null
        }), { headers: { "Content-Type": "application/json" } });
      }
    }
    return new Response(JSON.stringify({ error: "Failed to fetch status" }), { status: 500, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
