export async function onRequest(context) {
    if (context.request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 });
    }

    try {
        const { roomNumber } = await context.request.json();
        const token = context.env.GITHUB_PAT_TOKEN; // Pulls securely from config settings vault

        // ⚠️ RENAME TO MATCH YOUR GITHUB TARGET SPECIFICS EXACTLY
        const GITHUB_OWNER = "YOUR_GITHUB_USERNAME";
        const GITHUB_REPO = "YOUR_REPO_NAME";
        const WORKFLOW_NAME = "process-rooms.yml";

        const url = `https://github.com{GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_NAME}/dispatches`;

        const ghResponse = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/vnd.github+json",
                "Authorization": `Bearer ${token}`,
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "CloudflarePagesProxy"
            },
            body: JSON.stringify({
                ref: "main",
                inputs: { room_id: String(roomNumber) }
            })
        });

        if (ghResponse.ok) {
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } else {
            const errLog = await ghResponse.text();
            return new Response(JSON.stringify({ error: errLog }), { status: 500 });
        }
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
