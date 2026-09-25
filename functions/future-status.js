export async function onRequestGet(context) {
  try {
    const token = context.env.GITHUB_TOKEN;
    const username = "My-Memory-2008"; 
    const repo = "Saveetha-RoomFree-Checker";
    const workflow = "predict-future.yml";

    const headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };

    // 1. Get the latest workflow run
    const runsRes = await fetch(`https://api.github.com/repos/${username}/${repo}/actions/workflows/${workflow}/runs?per_page=1`, { headers });
    if (!runsRes.ok) throw new Error("Failed to fetch runs");
    const runsData = await runsRes.json();
    const latestRun = runsData.workflow_runs[0];

    if (!latestRun) {
      return new Response(JSON.stringify({ status: 'idle', progress: 0, step: 'No runs found' }), { headers: { "Content-Type": "application/json" } });
    }

    // If finished, return 100%
    if (latestRun.status === 'completed') {
      return new Response(JSON.stringify({
        status: 'completed',
        conclusion: latestRun.conclusion,
        progress: 100,
        step: 'Workflow finished'
      }), { headers: { "Content-Type": "application/json" } });
    }

    // 2. Get the jobs and steps for the in_progress run
    const jobsRes = await fetch(latestRun.jobs_url, { headers });
    if (!jobsRes.ok) throw new Error("Failed to fetch jobs");
    const jobsData = await jobsRes.json();
    const job = jobsData.jobs[0];

    // Handle queued state (waiting for runner)
    if (!job || job.status === 'queued') {
      return new Response(JSON.stringify({ status: 'queued', progress: 5, step: 'Waiting for GitHub Runner...', isLongStep: false }), { headers: { "Content-Type": "application/json" } });
    }

    // 3. Calculate progress based on completed steps
    const totalSteps = job.steps.length;
    let completedSteps = 0;
    let currentStepName = 'Initializing...';
    let isLongStep = false;

    for (let i = 0; i < totalSteps; i++) {
      const step = job.steps[i];
      if (step.status === 'completed') {
        completedSteps++;
      } else if (step.status === 'in_progress') {
        currentStepName = step.name;
        // Detect the long Node.js AI scanning step
        if (step.name.toLowerCase().includes('playwright') || step.name.toLowerCase().includes('node')) {
          isLongStep = true;
        }
        break;
      }
    }

    // Calculate base progress (max 85% to leave room for the long AI step and final commit)
    let progress = Math.floor((completedSteps / totalSteps) * 85);

    return new Response(JSON.stringify({
      status: latestRun.status,
      conclusion: latestRun.conclusion,
      progress: progress,
      step: currentStepName,
      isLongStep: isLongStep // Tells frontend to animate smoothly during the AI phase
    }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, status: 'error', progress: 0, step: 'Polling error' }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
