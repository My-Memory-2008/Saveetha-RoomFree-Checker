export async function onRequest(context) {
    if (context.request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 });
    }

    try {
        const { roomNumber } = await context.request.json();
        const token = context.env.GITHUB_PAT_TOKEN; 

        // ⚠️ ENTIRELY VERIFY AND RE-ENTER YOUR RAW DETAILS IN ALL THREE METRICS BELOW
        const GITHUB_OWNER = "My-Memory-2008";
        const GITHUB_REPO = "Saveetha-RoomFree-Checker";
        const WORKFLOW_NAME = "process-rooms.yml";

        const url = `https://github.com/{GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_NAME}/dispatches`;

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

        // GitHub workflow dispatches return 204 status on a successful launch trigger
        if (ghResponse.status === 204 || ghResponse.ok) {
            return new Response(JSON.stringify({ success: true }), { 
                headers: { "Content-Type": "application/json" } 
            });
        } else {
            const errLog = await ghResponse.text();
            return new Response(JSON.stringify({ error: errLog || "GitHub API authorization or layout configuration fault." }), { 
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
