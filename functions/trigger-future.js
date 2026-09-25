export async function onRequestPost(context) {
  try {
    const { GITHUB_USERNAME, REPO_NAME, WORKFLOW_FILE, inputs } = await context.request.json();
    
    const response = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${context.env.GITHUB_TOKEN}`, // Securely injected by Cloudflare
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: 'main', // Change to 'master' if your default branch is master
        inputs: inputs
      })
    });

    if (response.ok) {
      return new Response(JSON.stringify({ success: true, message: "Workflow triggered" }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: "Failed to trigger", details: errorText }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
