export async function onRequestGet(context) {
  const token = context.env.GITHUB_TOKEN;
  const username = "My-Memory-2008"; 
  const repo = "Saveetha-RoomFree-Checker";             
  const workflow = "fast-live-scan.yml"; // 🎯 Points to the fast workflow

  const headers = {
    "Authorization": `Bearer ${token}`,
    "User-Agent": "Saveetha-RoomFree-Checker",
    "Accept": "application/vnd.github+json"
  };

  try {
    const runsRes = await fetch(`https://api.github.com/repos/${username}/${repo}/actions/workflows/${workflow}/runs?per_page=1`, { headers });
    const runsData = await runsRes.json();
    const latestRun = runsData.workflow_runs[0];

    if (!latestRun) {
      return new Response(JSON.stringify({ runStatus: 'none', progress: 0, currentStep: 'Waiting to start...' }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }

    const jobsRes = await fetch(`${latestRun.jobs_url}?per_page=100`, { headers });
    const jobsData = await jobsRes.json();

    let totalSteps = 0;
    let completedSteps = 0;
    let currentStepName = "Initializing...";

    jobsData.jobs.forEach(job => {
      job.steps.forEach(step => {
        totalSteps++;
        if (step.status === 'completed') completedSteps++;
        else if (step.status === 'in_progress') currentStepName = step.name;
      });
    });

    let realProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 90) : 5;

    return new Response(JSON.stringify({
      runStatus: latestRun.status,
      conclusion: latestRun.conclusion,
      progress: realProgress,
      currentStep: currentStepName
    }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
