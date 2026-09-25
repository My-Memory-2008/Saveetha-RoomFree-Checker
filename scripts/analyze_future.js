const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Get environment variables from GitHub Actions
const TARGET_DATE = process.env.TARGET_DATE; // e.g., "2026-09-25"
const TARGET_TIME_RANGE = process.env.TARGET_TIME; // e.g., "13:00 - 16:00"

console.log(` Starting AI Vision Scan for Date: ${TARGET_DATE} | Time Range: ${TARGET_TIME_RANGE}`);

// Read from rooms.json
const registryPath = path.join(__dirname, '../rooms.json');
let roomLinks = [];
let database = {};

try {
    const rawData = fs.readFileSync(registryPath, 'utf8');
    database = JSON.parse(rawData);
    roomLinks = Object.values(database).map(room => room.link).filter(link => link);
    console.log(`✅ Loaded ${roomLinks.length} room links from rooms.json...`);
} catch (error) {
    console.error("❌ Failed to read rooms.json. Make sure the Live Scan has run at least once.");
    process.exit(1);
}

const futureRoomsData = {};

(async () => {
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    
    const screenshotDir = path.join(__dirname, '../room-images');
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

    let processedCount = 0;
    
    for (const link of roomLinks) {
        processedCount++;
        const roomData = Object.values(database).find(r => r.link === link);
        const roomNumber = roomData ? roomData.roomNumber : `Room ${processedCount}`;
        
        // Skip invalid room 503
        if (roomNumber === "503") {
            console.log(`   → Skipping invalid room: ${roomNumber}`);
            continue; 
        }

        console.log(`\n[${processedCount}/${roomLinks.length}] Processing: ${roomNumber}`);
        
        try {
            const page = await context.newPage();
            const futureUrl = `${link}?scope=future`;
            
            await page.goto(futureUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 15000 
            });
            
            // Wait for UI to render
            await page.waitForTimeout(1500);
            
            // 1. TAKE SCREENSHOT
            const screenshotPath = path.join(screenshotDir, `future-${roomNumber}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: false });
            
            // 2. CONVERT TO BASE64 FOR OLLAMA
            const base64Image = fs.readFileSync(screenshotPath, { encoding: 'base64' });
            
            // 3. SEND TO OLLAMA (Moondream) FOR VISION ANALYSIS
            console.log(`   🤖 Sending screenshot to Moondream AI...`);
            
            const ollamaResponse = await fetch('http://127.0.0.1:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'moondream',
                    prompt: `Look at this university classroom schedule screenshot.
Target Date to check: ${TARGET_DATE}
Target Time Window: ${TARGET_TIME_RANGE}

Analyze the image and extract:
1. The Room Number.
2. Is there ANY class, lecture, or exam scheduled exactly on the Target Date during the Target Time Window?

You MUST reply ONLY with a valid JSON object (no markdown, no backticks, no extra text) in this exact format:
{"room": "Room Number", "has_class": true or false, "details": "Brief summary of the schedule for that date"}`,
                    images: [base64Image],
                    stream: false
                })
            });

            if (!ollamaResponse.ok) {
                throw new Error(`Ollama API failed with status ${ollamaResponse.status}`);
            }

            const aiData = await ollamaResponse.json();
            let aiText = aiData.response;
            
            // 4. PARSE AI RESPONSE (Handle potential markdown formatting from AI)
            aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
            const jsonMatch = aiText.match(/\{[\s\S]*?\}/);
            
            let parsedAI = { room: roomNumber, has_class: false, details: "AI parsing failed" };
            if (jsonMatch) {
                try { 
                    parsedAI = JSON.parse(jsonMatch[0]); 
                } catch(e) { 
                    console.log(`   ⚠️ AI JSON parse error for ${roomNumber}`);
                }
            }

            // 5. DETERMINE STATUS
            const status = parsedAI.has_class ? "OCCUPIED" : "FREE";
            const upcomingTimings = parsedAI.details || (parsedAI.has_class ? "Class scheduled during target window." : "No classes found for target window.");

            futureRoomsData[`room-${roomNumber}`] = {
                roomNumber: parsedAI.room || roomNumber,
                currentStatus: status,
                upcomingTimings: upcomingTimings,
                link: link,
                scannedAt: new Date().toISOString(),
                targetDate: TARGET_DATE,
                targetTimeRange: TARGET_TIME_RANGE
            };
            
            console.log(`   → AI Verdict: ${status} | ${upcomingTimings.substring(0, 50)}...`);
            
            await page.close();
            
        } catch (error) {
            console.error(`   ✗ Error processing ${roomNumber}:`, error.message);
            futureRoomsData[`room-${roomNumber}`] = {
                roomNumber: roomNumber,
                currentStatus: "UNKNOWN",
                upcomingTimings: `Error: ${error.message}`,
                link: link,
                scannedAt: new Date().toISOString()
            };
        }
    }
    
    await browser.close();
    
    // Save final JSON
    const outputPath = path.join(__dirname, '../future_rooms.json');
    fs.writeFileSync(outputPath, JSON.stringify(futureRoomsData, null, 2));
    
    const freeCount = Object.values(futureRoomsData).filter(r => r.currentStatus === 'FREE').length;
    console.log(`\n✅ AI Vision analysis complete! Results saved to: ${outputPath}`);
    console.log(`📊 Total rooms scanned: ${processedCount}`);
    console.log(`📊 Free rooms: ${freeCount}`);
})();
