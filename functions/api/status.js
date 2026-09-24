export async function onRequestGet(context) {
  const token = context.env.GITHUB_TOKEN;
  const username = "My-Memory-2008"; 
  const repo = "Saveetha-RoomFree-Checker";             
  const workflow = "process-rooms.yml";       

  const headers = {
    "Authorization": `Bearer ${token}`,
    "User-Agent": "Saveetha-RoomFree-Checker",
    "Accept": "application/vnd.github+json"
  };

  try {
    // 1. Get the latest workflow run
    const runsRes = await fetch(`https://api.github.com/repos/${username}/${repo}/actions/workflows/${workflow}/runs?per_page=1`, { headers });
    const runsData = await runsRes.json();
    const latestRun = runsData.workflow_runs[0];

    if (!latestRun) {
      return new Response(JSON.stringify({ status: 'none', progress: 0, step: 'Waiting to start...' }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 2. Get the specific jobs and steps for this run
    const jobsRes = await fetch(`${latestRun.jobs_url}?per_page=100`, { headers });
    const jobsData = await jobsRes.json();

    let totalSteps = 0;
    let completedSteps = 0;
    let currentStepName = "Initializing...";

    // Calculate real progress based on completed steps
    jobsData.jobs.forEach(job => {
      job.steps.forEach(step => {
        totalSteps++;
        if (step.status === 'completed') {
          completedSteps++;
        } else if (step.status === 'in_progress') {
          currentStepName = step.name;
        }
      });
    });

    // Calculate percentage (cap at 90% because Cloudflare still needs to rebuild after GitHub finishes)
    let realProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 90) : 5;

    return new Response(JSON.stringify({
      runStatus: latestRun.status, // 'queued', 'in_progress', 'completed'
      conclusion: latestRun.conclusion, // 'success', 'failure', or null
      progress: realProgress,
      currentStep: currentStepName
    }), { 
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
