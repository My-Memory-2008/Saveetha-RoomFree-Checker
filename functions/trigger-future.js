// functions/trigger-future.js
export async function onRequest(context) {
    // Only allow POST requests for maximum infrastructure security
    if (context.request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), { 
            status: 405,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        // Securely fetch your locked API token from Cloudflare's hidden variables vault
        const token = context.env.GITHUB_PAT_TOKEN;

        // Parse the dynamic form parameters passed by the front-end user selection
        const body = await context.request.json();
        const GITHUB_OWNER = body.GITHUB_USERNAME || "My-Memory-2008";
        const GITHUB_REPO = body.REPO_NAME || "Saveetha-RoomFree-Checker";
        const WORKFLOW_NAME = body.WORKFLOW_FILE || "predict-future.yml";
        
        // Extract the nested calendar inputs from the request body
        const inputs = body.inputs || {};

        if (!inputs.target_date || !inputs.target_time) {
            return new Response(JSON.stringify({ error: "Missing required calendar input parameters." }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const url = `https://github.com/{GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_NAME}/dispatches`;

        // Safely forward the request to GitHub with token masking active
        const githubResponse = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/vnd.github+json",
                "Authorization": `Bearer ${token}`,
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "CloudflarePagesFutureProxy",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                ref: "main", // Targets your primary code branch pool
                inputs: {
                    target_date: String(inputs.target_date),
                    target_time: String(inputs.target_time)
                }
            })
        });

        // GitHub dispatches return a 204 No Content status code upon a successful launch trigger
        if (githubResponse.status === 204 || githubResponse.ok) {
            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json" }
            });
        } else {
            const errorText = await githubResponse.text();
            return new Response(JSON.stringify({ error: `GitHub API tracking fault: ${errorText}` }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
