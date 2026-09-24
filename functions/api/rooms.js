export async function onRequestGet(context) {
  const token = context.env.GITHUB_TOKEN;
  const username = "My-Memory-2008"; // Your username
  const repo = "Saveetha-RoomFree-Checker"; // Your repo name

  // Fetch the raw file directly from GitHub API
  const url = `https://api.github.com/repos/${username}/${repo}/contents/rooms.json`;
  
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "User-Agent": "Saveetha-RoomFree-Checker-App",
      "Accept": "application/vnd.github+json"
    }
  });

  if (!response.ok) {
    return new Response("Failed to fetch rooms data", { status: 500 });
  }

  const data = await response.json();
  
  // GitHub API returns the file content as Base64, so we decode it
  const decodedContent = atob(data.content);

  return new Response(decodedContent, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate" // Prevents browser caching!
    }
  });
}
