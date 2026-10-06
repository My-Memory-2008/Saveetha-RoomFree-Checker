// scripts/analyze_rooms_fast.js (TEXT-BASED AI - BLAZING FAST)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function scrapeRoomSchedulesFast() {
    const jsonPath = path.join(__dirname, '../rooms_fast.json');
    const linksFile = path.join(__dirname, '../links.txt');
    
    if (!fs.existsSync(linksFile)) {
        console.error("❌ Critical Error: links.txt file is missing.");
        return;
    }

    const urls = fs.readFileSync(linksFile, 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('http'));

    console.log(`⚡ Loaded ${urls.length} links for FAST text-based AI scraping...`);
    if (urls.length === 0) return;

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const timeStr = new Date().toLocaleTimeString('en-US', { 
        timeZone: 'Asia/Kolkata', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
    }) + " IST";

    // 🚀 INCREASED CONCYRENCY: Text processing is lightweight, so we can do 5 at once!
    const concurrencyLimit = 5; 
    const results = [];

    for (let i = 0; i < urls.length; i += concurrencyLimit) {
        const batch = urls.slice(i, i + concurrencyLimit);
        console.log(`\n🔄 Processing batch (Rooms ${i + 1} to ${Math.min(i + concurrencyLimit, urls.length)})...`);
        
        const batchPromises = batch.map((url, idx) => {
            const actualIndex = i + idx;
            return (async () => {
                const page = await context.newPage();
                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    
                    try {
                        await page.locator('text=Current Sessions').click({ timeout: 3000 }).catch(() => {});
                    } catch(e) {}
                    
                    await page.waitForTimeout(1000);

                    let roomNumber = `Loc_${actualIndex + 1}`;
                    try {
                        const headingText = await page.locator('h1, h2, h3').first().textContent();
                        const match = headingText ? headingText.match(/\d+/) : null;
                        if (match) roomNumber = match[0];
                    } catch (e) {}

                    //  EXTRACT TEXT INSTEAD OF SCREENSHOT
                    const pageText = await page.evaluate(() => document.body.innerText);

                    console.log(`🤖 Analyzing Room ${roomNumber} text with Moondream...`);
                    const ollamaResponse = await fetch('http://127.0.0.1:11434/api/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'moondream',
                            prompt: `You are a university schedule analyzer. Read the following text extracted from a room booking page.
Determine if there is an ACTIVE class or session happening right now.
Reply ONLY with a valid JSON object (no markdown, no backticks):
{"is_occupied": true or false, "details": "If occupied, state the class name/time. If completely free, state exactly 'No Session Found'."}

TEXT TO ANALYZE:
${pageText.substring(0, 2000)}`, // Limit text to 2000 chars to speed up AI
                            stream: false
                        })
                    });

                    if (!ollamaResponse.ok) {
                        throw new Error(`Ollama API failed with status ${ollamaResponse.status}`);
                    }

                    const aiData = await ollamaResponse.json();
                    let aiText = aiData.response.replace(/```json/g, '').replace(/```/g, '').trim();
                    const jsonMatch = aiText.match(/\{[\s\S]*?\}/);
                    
                    let parsedAI = { is_occupied: false, details: "No Session Found" };
                    if (jsonMatch) {
                        try { parsedAI = JSON.parse(jsonMatch[0]); } catch(e) {}
                    }

                    // 🛡️ SAFEGUARD: Force FREE if AI says "no session"
                    if (parsedAI.details && parsedAI.details.toLowerCase().includes("no session")) {
                        parsedAI.is_occupied = false;
                    }

                    const isFree = !parsedAI.is_occupied;
                    console.log(`✅ Room ${roomNumber}: ${isFree ? 'FREE' : 'OCCUPIED'} (${parsedAI.details})`);

                    return {
                        roomNumber,
                        link: url,
                        currentStatus: isFree ? "Free" : "Occupied",
                        upcomingTimings: isFree ? "No Session Found" : `${parsedAI.details} at ${timeStr}`
                    };

                } catch (e) {
                    console.error(` Failed ${url}: ${e.message}`);
                    return null;
                } finally {
                    await page.close();
                }
            })();
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }

    await browser.close();

    const db = {};
    results.forEach(res => {
        if (res) db[res.roomNumber] = res;
    });

    fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
    console.log(`\n🚀 Finished FAST AI scraping ${results.filter(r => r).length} rooms successfully!`);
}

scrapeRoomSchedulesFast();
