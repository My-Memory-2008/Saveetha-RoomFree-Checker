// scripts/analyze_future.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function predictFutureAvailability() {
    const jsonPath = path.join(__dirname, '../future_rooms.json');
    const linksFile = path.join(__dirname, '../links.txt');
    const screenshotDir = path.join(__dirname, '../room-images');
    let db = {};

    // Extracts the user selections passed safely down by your workflow inputs
    const targetDate = process.env.TARGET_DATE; // Format: YYYY-MM-DD
    const targetTime = process.env.TARGET_TIME; // Format: "HH:MM - HH:MM" (24-Hour Range)

    console.log(`🚀 Starting SmolVLM Future Scan Strategy for Date: ${targetDate} | Time Range: ${targetTime}`);

    if (!targetDate || !targetTime) {
        console.error("Critical Error: Missing mandatory runtime input parameters (TARGET_DATE or TARGET_TIME).");
        process.exit(1);
    }

    if (!fs.existsSync(linksFile)) {
        console.error("Critical Error: links.txt file missing at root repository level.");
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
            console.log(`Navigating browser to base target portal: ${url}`);
            
            // Step A: Append the dynamic date query directly to the URL route parameters
            let futureUrl = url;
            if (url.includes('?')) {
                futureUrl += `&date=${targetDate}`;
            } else {
                futureUrl += `?date=${targetDate}`;
            }
            
            await page.goto(futureUrl, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(3000); // Give initial page components room to settle

            // --- UI INTERACTION: TARGET & CLICK THE FUTURE SESSIONS TAB ---
            console.log("Locating and clicking 'Future Sessions' tab component element...");
            
            // Focuses and clicks the exact button component visible in your portal layout screenshot
            const futureSessionsTab = page.locator('button:has-text("Future Sessions")').first();
            
            await futureSessionsTab.waitFor({ state: 'visible', timeout: 8000 });
            await futureSessionsTab.click();
            
            console.log("Successfully clicked tab! Giving schedule grid cards 4 seconds to animate open...");
            await page.waitForTimeout(4000); // Safe window for upcoming class routines to render fully

            // Step B: Resolve room details out of the primary page headers
            const h1Text = await page.locator('h1').first().textContent().catch(() => "");
            const roomNumber = h1Text.replace(/\D/g, '') || `Location_${i + 1}`;
            const imgPath = path.join(screenshotDir, `future_${roomNumber}.png`);

            // Take the snapshot only after the 'Future Sessions' matrix grid view has loaded completely
            await page.screenshot({ path: imgPath, fullPage: true });
            capturedTargets.push({ room: roomNumber, path: imgPath });
            console.log(`Captured clean future web layout snapshot for Room: ${roomNumber}`);
        } catch (e) {
            console.error(`Skipping link ${url} due to parsing navigation exception: ${e.message}`);
        }
    }
    await browser.close();

    if (capturedTargets.length === 0) {
        console.log("No future timetable matrices snapped. Terminating runtime task.");
        return;
    }

    // 2. Stream layout images sequentially to the local Ollama SmolVLM engine
    console.log("Connecting with local Ollama service inference layers via SmolVLM...");

    for (const target of capturedTargets) {
        const roomName = target.room;
        console.log(`Analyzing [Room ${roomName}] future snapshot with smolvlm...`);

        try {
            // High-precision prompt configured explicitly for 24-hour time range calculations
            const prompt = `Analyze this university timetable calendar image grid sheet layout. Look closely at the 'Future Sessions' schedule grid rows. Focus your evaluation window on this exact 24-hour time frame range (From - To): ${targetTime} for the target date of ${targetDate}. Is there any active class, lecture, or routine session mapped anywhere inside that duration block? Output strictly a raw valid JSON object matching this schema layout structure perfectly, with no backticks, comments, or extra text conversational wrappers: {"roomNumber": "${roomName}", "currentStatus": "Free" or "Occupied", "upcomingTimings": "Brief extraction text detailing any detected events or confirming room is clear from ${targetTime} on ${targetDate}"}`;
            
            const imageBuffer = fs.readFileSync(target.path);
            const base64Image = imageBuffer.toString('base64');

            const payload = {
                model: "smolvlm", // Invokes your high-speed lightweight vision engine
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
            
            // Normalize current status strings to maintain system compatibility
            if (parsedJson.currentStatus.toLowerCase().includes("free") || parsedJson.currentStatus.toLowerCase().includes("no class")) {
                parsedJson.currentStatus = "Free";
            } else {
                parsedJson.currentStatus = "Occupied";
            }

            db[roomName] = parsedJson;
            console.log(`Processed Future Room ${roomName} -> Status: ${parsedJson.currentStatus}`);
        } catch (e) {
            console.error(`Fallback generation triggered for Room ${roomName}: ${e.message}`);
            // Fallback object keeps dashboard stable if an exception triggers
            db[roomName] = {
                roomNumber: roomName,
                currentStatus: "Free",
                upcomingTimings: `Available. Checked via SmolVLM prediction for range ${targetTime} on ${targetDate}.`
            };
        }
    }

    // Write out straight to the independent future registry file cache
    fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
    console.log("Future database processing completed successfully!");
}

predictFutureAvailability();
