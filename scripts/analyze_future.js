const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Get environment variables from GitHub Actions
const TARGET_DATE = process.env.TARGET_DATE; // e.g., "2026-09-25"
const TARGET_TIME_RANGE = process.env.TARGET_TIME; // e.g., "13:00 - 16:00"

console.log(`🚀 Starting AI Vision Scan for Date: ${TARGET_DATE} | Time Range: ${TARGET_TIME_RANGE}`);

// 🔄 CHANGED: Read links directly from links.txt at the root of the repo
const linksPath = path.join(__dirname, '../links.txt');
let roomLinks = [];

try {
    const rawData = fs.readFileSync(linksPath, 'utf8');
    // Split by new line, trim whitespace, and ignore empty lines or comments
    roomLinks = rawData.split('\n')
                       .map(line => line.trim())
                       .filter(line => line.length > 0 && !line.startsWith('#'));
                       
    console.log(`✅ Loaded ${roomLinks.length} room links from links.txt...`);
} catch (error) {
    console.error(" Failed to read links.txt. Make sure it exists at the root of your GitHub repository.");
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
        let roomNumber = `Location-${processedCount}`; // Fallback name

        console.log(`\n[${processedCount}/${roomLinks.length}] Processing URL...`);
        
        try {
            const page = await context.newPage();
            const futureUrl = `${link}?scope=future`;
            
            await page.goto(futureUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 15000 
            });
            
            // Wait for UI to render
            await page.waitForTimeout(1500);
            
            // 🎯 SCRAPE ROOM NUMBER FROM THE PAGE DOM
            try {
                const scrapedNumber = await page.evaluate(() => {
                    // Look for the large room number text (e.g., "5683" from your screenshot)
                    const elements = Array.from(document.querySelectorAll('h1, h2, h3, div, span'));
                    for (let el of elements) {
                        const text = el.innerText.trim();
                        // Match 3 to 4 digit numbers that are likely room numbers
                        if (/^\d{3,4}$/.test(text)) {
                            return text;
                        }
                    }
                    return null;
                });
                
                if (scrapedNumber) {
                    roomNumber = scrapedNumber;
                } else {
                    // Fallback: Extract ID from URL (e.g., /locations/154/ -> 154)
                    const urlMatch = link.match(/locations\/(\d+)\//);
                    if (urlMatch) roomNumber = `Loc-${urlMatch[1]}`;
                }
            } catch (e) {
                console.log(`   ⚠️ Could not scrape room number, using fallback.`);
            }

            // Skip invalid room 503 (if it somehow gets scraped)
            if (roomNumber === "503") {
                console.log(`   → Skipping invalid room: ${roomNumber}`);
                await page.close();
                continue; 
            }

            console.log(`   → Identified Room: ${roomNumber}`);

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
                    model: 'moondream', // Ensure this matches the model you pulled in your workflow
                    prompt: `Look at this university classroom schedule screenshot.
The Room Number is: ${roomNumber}
Target Date to check: ${TARGET_DATE}
Target Time Window: ${TARGET_TIME_RANGE}

Analyze the image and determine:
Is there ANY class, lecture, or exam scheduled exactly on the Target Date during the Target Time Window?

You MUST reply ONLY with a valid JSON object (no markdown, no backticks, no extra text) in this exact format:
{"has_class": true or false, "details": "Brief summary of the schedule for that date, including times if visible"}`,
                    images: [base64Image],
                    stream: false
                })
            });

            if (!ollamaResponse.ok) {
                throw new Error(`Ollama API failed with status ${ollamaResponse.status}`);
            }

            const aiData = await ollamaResponse.json();
            let aiText = aiData.response;
            
            // 4. PARSE AI RESPONSE
            aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
            const jsonMatch = aiText.match(/\{[\s\S]*?\}/);
            
            let parsedAI = { has_class: false, details: "AI parsing failed" };
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
                roomNumber: roomNumber,
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
            console.error(`   ✗ Error processing link:`, error.message);
            futureRoomsData[`room-unknown-${processedCount}`] = {
                roomNumber: `Error-Room-${processedCount}`,
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
