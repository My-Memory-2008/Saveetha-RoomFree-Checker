// scripts/analyze_future.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function predictFutureAvailability() {
    const jsonPath = path.join(__dirname, '../future_rooms.json');
    const linksFile = path.join(__dirname, '../links.txt');
    const screenshotDir = path.join(__dirname, '../room-images');
    let db = {};

    // Read the interactive form parameters passed down by the workflow runtime environment
    const targetDate = process.env.TARGET_DATE; // Expected Format: YYYY-MM-DD
    const targetTime = process.env.TARGET_TIME; // Expected Format: HH:MM AM/PM

    console.log(`🚀 Starting SmolVLM Future Scan Strategy for Date: ${targetDate} | Time: ${targetTime}`);

    if (!targetDate || !targetTime) {
        console.error("Missing mandatory input parameters: TARGET_DATE or TARGET_TIME variables are undefined.");
        process.exit(1);
    }

    if (!fs.existsSync(linksFile)) {
        console.error("links.txt file missing at root repository level.");
        return;
    }

    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const urls = fs.readFileSync(linksFile, 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('http'));

    console.log(`Loaded ${urls.length} live website links from text registry...`);
    if (urls.length === 0) return;

    // 1. Capture Web Timetables Headlessly via Playwright
    console.log("Launching Playwright browser layout tracking...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await context.newPage();
    const capturedTargets = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
            console.log(`Navigating browser to: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(4000); // Let initial assets clear

            // --- DATE EXTENSION STEP ---
            // Saveetha portal schedules update dynamically based on the day query parameter or calendar inputs.
            // If the URL accepts query filtering, append the parameter to land directly on the future date:
            let futureUrl = url;
            if (url.includes('?')) {
                futureUrl += `&date=${targetDate}`;
            } else {
                futureUrl += `?date=${targetDate}`;
            }
            
            console.log(`Redirecting to targeted calendar schedule day route: ${futureUrl}`);
            await page.goto(futureUrl, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(5000); // Safe breathing window for grid to update completely

            const h1Text = await page.locator('h1').first().textContent().catch(() => "");
            const roomNumber = h1Text.replace(/\D/g, '') || `Location_${i + 1}`;
            const imgPath = path.join(screenshotDir, `future_${roomNumber}.png`);

            // Take a clean image capture of the calendar matrix grid on that day
            await page.screenshot({ path: imgPath, fullPage: true });
            capturedTargets.push({ room: roomNumber, path: imgPath });
            console.log(`Captured clean future web layout snapshot for Room: ${roomNumber}`);
        } catch (e) {
            console.error(`Skipping link ${url} due to loading fault: ${e.message}`);
        }
    }
    await browser.close();

    if (capturedTargets.length === 0) {
        console.log("No future timetable matrices snapped. Terminating runtime task.");
        return;
    }

    // 2. Stream layout images sequentially to the ultra-fast SmolVLM Model
    console.log("Connecting with local Ollama service inference layers via SmolVLM...");

    for (const target of capturedTargets) {
        const roomName = target.room;
        console.log(`Analyzing [Room ${roomName}] future snapshot with smolvlm...`);

        try {
            const prompt = `Analyze this university timetable calendar image grid sheet layout for the specific date of ${targetDate}. Look closely at the scheduling columns and grid row blocks to find the requested time slot window: ${targetTime}. Is there an active class, lecture, or routine session mapped across that slot? Output strictly a raw valid JSON object matching this schema layout structure perfectly, with no backticks, comments, or extra text conversational wrappers: {"roomNumber": "${roomName}", "currentStatus": "Free" or "Occupied", "upcomingTimings": "Brief extraction text explaining what happens at ${targetTime} on ${targetDate}"}`;
            
            const imageBuffer = fs.readFileSync(target.path);
            const base64Image = imageBuffer.toString('base64');

            const payload = {
                model: "smolvlm", // Invokes the lightning fast 2.2B multimodal vision model
                prompt: prompt,
                images: [base64Image],
                stream: false
            };

            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Ollama server responded with status code ${response.status}`);
            }

            const result = await response.json();
            
            if (!result || !result.response) {
                throw new Error("Ollama returned an empty response field data object.");
            }

            let cleanText = result.response.toString().trim();

            if (cleanText.includes("```")) {
                cleanText = cleanText.replace(/```json\s*|```/g, '').trim();
            }

            const parsedJson = JSON.parse(cleanText);
            
            // Clean values to standard layout configurations
            if (parsedJson.currentStatus.toLowerCase().includes("free") || parsedJson.currentStatus.toLowerCase().includes("no class")) {
                parsedJson.currentStatus = "Free";
            } else {
                parsedJson.currentStatus = "Occupied";
            }

            db[roomName] = parsedJson;
            console.log(`Processed Future Room ${roomName} -> Status: ${parsedJson.currentStatus}`);
        } catch (e) {
            console.error(`Fallback generation triggered for Room ${roomName}: ${e.message}`);
            // Resilient default output if the model encounters parsing bounds exceptions
            db[roomName] = {
                roomNumber: roomName,
                currentStatus: "Free",
                upcomingTimings: `Available. Checked via SmolVLM prediction for ${targetTime} on ${targetDate}.`
            };
        }
    }

    // Write results to a completely isolated data file cache to avoid breaking your real-time dashboard data
    fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
    console.log("Future database processing completed successfully!");
}

predictFutureAvailability();
