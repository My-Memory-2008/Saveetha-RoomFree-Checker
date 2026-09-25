const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Get environment variables from GitHub Actions
const TARGET_DATE = process.env.TARGET_DATE; // e.g., "2026-09-25"
const TARGET_TIME_RANGE = process.env.TARGET_TIME; // e.g., "13:00 - 16:00"

console.log(`🚀 Starting Future Session Scan for Date: ${TARGET_DATE} | Time Range: ${TARGET_TIME_RANGE}`);

// 🔄 CHANGED: Read from rooms.json instead of a missing room-links.txt
const registryPath = path.join(__dirname, '../rooms.json');
let roomLinks = [];
let database = {};

try {
    const rawData = fs.readFileSync(registryPath, 'utf8');
    database = JSON.parse(rawData);
    // Extract all valid links from the existing rooms.json database
    roomLinks = Object.values(database).map(room => room.link).filter(link => link);
    console.log(`✅ Loaded ${roomLinks.length} room links from rooms.json...`);
} catch (error) {
    console.error("❌ Failed to read rooms.json.");
    console.error("💡 Fix: Make sure your Live Scan workflow has run at least once and committed 'rooms.json' to the repository.");
    process.exit(1);
}

// Results storage
const futureRoomsData = {};

(async () => {
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for GitHub Actions
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    
    let processedCount = 0;
    
    // Ensure screenshot directory exists
    const screenshotDir = path.join(__dirname, '../room-images');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }

    for (const link of roomLinks) {
        processedCount++;
        const roomData = Object.values(database).find(r => r.link === link);
        const roomNumber = roomData ? roomData.roomNumber : `Room ${processedCount}`;
        
        console.log(`\n[${processedCount}/${roomLinks.length}] Processing: ${roomNumber}`);
        
        try {
            const page = await context.newPage();
            
            // 🎯 YOUR TRICK: Append ?scope=future to directly access future sessions
            const futureUrl = `${link}?scope=future`;
            
            await page.goto(futureUrl, { 
                waitUntil: 'domcontentloaded', // Faster and more reliable than 'networkidle'
                timeout: 15000 
            });
            
            // Wait a moment for the future sessions UI to render
            await page.waitForTimeout(1500);
            
            // Take screenshot for debugging/AI (optional but recommended)
            const screenshotPath = path.join(screenshotDir, `future-${roomNumber}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: false });
            
            // Extract visible text content for analysis
            const pageContent = await page.evaluate(() => {
                return document.body.innerText;
            });
            
            // Simple text-based analysis for the target date
            const dateStr = TARGET_DATE; // e.g., "2026-09-25"
            const hasDate = pageContent.includes(dateStr) || pageContent.includes(dateStr.replace(/-/g, '/'));
            
            let status = "FREE";
            let upcomingTimings = `No sessions scheduled for ${TARGET_DATE} during ${TARGET_TIME_RANGE}`;
            
            if (hasDate) {
                // Try to extract the specific time slot mentioned near the date
                const lines = pageContent.split('\n');
                let foundSession = false;
                let sessionText = "";
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].toLowerCase();
                    if (line.includes(dateStr.toLowerCase()) || line.includes(dateStr.replace(/-/g, '/').toLowerCase())) {
                        // Check if this line or nearby lines contain time info
                        const contextLines = lines.slice(Math.max(0, i - 2), i + 3).join(' ');
                        if (contextLines.includes('am') || contextLines.includes('pm') || /\d{1,2}:\d{2}/.test(contextLines)) {
                            foundSession = true;
                            sessionText = contextLines.trim().replace(/\s+/g, ' ').substring(0, 120);
                            break;
                        }
                    }
                }
                
                if (foundSession) {
                    status = "OCCUPIED";
                    upcomingTimings = `Session found: ${sessionText}`;
                } else {
                    upcomingTimings = `Date found, but no specific time slot detected in text.`;
                }
            }
            
            // Store result
            futureRoomsData[`room-${roomNumber}`] = {
                roomNumber: roomNumber,
                currentStatus: status,
                upcomingTimings: upcomingTimings,
                link: link,
                scannedAt: new Date().toISOString(),
                targetDate: TARGET_DATE,
                targetTimeRange: TARGET_TIME_RANGE
            };
            
            console.log(`   → Status: ${status}`);
            
            await page.close();
            
        } catch (error) {
            console.error(`   ✗ Error processing ${roomNumber}:`, error.message);
            
            futureRoomsData[`room-${roomNumber}`] = {
                roomNumber: roomNumber,
                currentStatus: "UNKNOWN",
                upcomingTimings: `Error scanning: ${error.message}`,
                link: link,
                scannedAt: new Date().toISOString()
            };
        }
    }
    
    await browser.close();
    
    // Save results to JSON
    const outputPath = path.join(__dirname, '../future_rooms.json');
    fs.writeFileSync(outputPath, JSON.stringify(futureRoomsData, null, 2));
    
    const freeCount = Object.values(futureRoomsData).filter(r => r.currentStatus === 'FREE').length;
    console.log(`\n✅ Future rooms analysis complete! Results saved to: ${outputPath}`);
    console.log(`📊 Total rooms scanned: ${processedCount}`);
    console.log(`📊 Free rooms: ${freeCount}`);
})();
