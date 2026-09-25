const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Get environment variables from GitHub Actions
const TARGET_DATE = process.env.TARGET_DATE; // e.g., "2026-09-25"
const TARGET_TIME_RANGE = process.env.TARGET_TIME; // e.g., "13:00 - 16:00"

console.log(`🚀 Starting Future Session Scan for Date: ${TARGET_DATE} | Time Range: ${TARGET_TIME_RANGE}`);

// Parse time range
const [startTime, endTime] = TARGET_TIME_RANGE.split('-').map(t => t.trim());

// Load the registry of room links
const registryPath = path.join(__dirname, '../room-links.txt');
const roomLinks = fs.readFileSync(registryPath, 'utf8').split('\n').filter(line => line.trim());

console.log(`Loaded ${roomLinks.length} room links from registry...`);

// Results storage
const futureRoomsData = {};

(async () => {
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    
    let processedCount = 0;
    
    for (const link of roomLinks) {
        processedCount++;
        console.log(`\n[${processedCount}/${roomLinks.length}] Processing: ${link.substring(0, 80)}...`);
        
        try {
            const page = await context.newPage();
            
            // 🎯 KEY CHANGE: Append ?scope=future to directly access future sessions
            const futureUrl = `${link}?scope=future`;
            console.log(`   → Navigating to future sessions: ${futureUrl.substring(0, 100)}...`);
            
            await page.goto(futureUrl, { 
                waitUntil: 'networkidle',
                timeout: 15000 
            });
            
            // Wait for future sessions to load
            await page.waitForSelector('button:has-text("Future Sessions")', { 
                state: 'attached',
                timeout: 5000 
            }).catch(() => {
                console.log('   ⚠️ Future Sessions tab not found, but continuing...');
            });
            
            // Small delay to ensure content is loaded
            await page.waitForTimeout(2000);
            
            // Take screenshot for AI analysis
            const screenshotPath = path.join(__dirname, '../room-images', `future-${processedCount}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: false });
            console.log(`   ✓ Screenshot saved: ${screenshotPath}`);
            
            // Extract visible text content for analysis
            const pageContent = await page.evaluate(() => {
                return document.body.innerText;
            });
            
            // Extract room number from URL or page
            const roomNumber = extractRoomNumber(link, pageContent);
            
            // Check if there are any sessions for the target date
            const hasSessions = pageContent.toLowerCase().includes(TARGET_DATE.toLowerCase().replace(/-/g, '')) || 
                               pageContent.toLowerCase().includes('future') ||
                               pageContent.toLowerCase().includes('upcoming');
            
            // Check if the time range appears in the content
            const hasTimeSlot = pageContent.includes(startTime) || pageContent.includes(endTime);
            
            // Determine if room is FREE or OCCUPIED
            // If no sessions found for the target date/time, it's FREE
            let status = "FREE";
            let upcomingTimings = `No sessions scheduled for ${TARGET_DATE} during ${TARGET_TIME_RANGE}`;
            
            if (hasSessions && hasTimeSlot) {
                status = "OCCUPIED";
                upcomingTimings = `Has sessions on ${TARGET_DATE} around ${TARGET_TIME_RANGE}`;
            } else if (hasSessions) {
                // Extract actual session info if available
                const sessionInfo = extractSessionInfo(pageContent, TARGET_DATE);
                if (sessionInfo) {
                    upcomingTimings = sessionInfo;
                    // Check if it conflicts with our target time
                    if (timeSlotsConflict(sessionInfo, startTime, endTime)) {
                        status = "OCCUPIED";
                    }
                }
            }
            
            // Store result
            futureRoomsData[`room-${processedCount}`] = {
                roomNumber: roomNumber || `Room ${processedCount}`,
                currentStatus: status,
                upcomingTimings: upcomingTimings,
                link: link,
                scannedAt: new Date().toISOString(),
                targetDate: TARGET_DATE,
                targetTimeRange: TARGET_TIME_RANGE
            };
            
            console.log(`   → Status: ${status} | ${upcomingTimings.substring(0, 60)}...`);
            
            await page.close();
            
        } catch (error) {
            console.error(`   ✗ Error processing ${link}:`, error.message);
            
            // Still record the room even if there was an error
            futureRoomsData[`room-${processedCount}`] = {
                roomNumber: `Room ${processedCount}`,
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
    console.log(`\n✅ Future rooms analysis complete! Results saved to: ${outputPath}`);
    console.log(`📊 Total rooms scanned: ${processedCount}`);
    console.log(`📊 Free rooms: ${Object.values(futureRoomsData).filter(r => r.currentStatus === 'FREE').length}`);
    console.log(`📊 Occupied rooms: ${Object.values(futureRoomsData).filter(r => r.currentStatus === 'OCCUPIED').length}`);
    
})();

// Helper function to extract room number
function extractRoomNumber(url, content) {
    // Try to extract from URL pattern
    const urlMatch = url.match(/locations\/(\d+)/);
    if (urlMatch) return `Location ${urlMatch[1]}`;
    
    // Try to extract from page content
    const contentMatch = content.match(/Room\s*(\d+)/i);
    if (contentMatch) return `Room ${contentMatch[1]}`;
    
    return null;
}

// Helper function to extract session information
function extractSessionInfo(content, targetDate) {
    // Look for date patterns and session info
    const datePattern = new RegExp(`${targetDate.replace(/-/g, '\\s*[-/]?\\s*')}[^\\n]*`, 'i');
    const match = content.match(datePattern);
    
    if (match) {
        // Extract time if present
        const timeMatch = match[0].match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[-–]\s*\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
        if (timeMatch) {
            return `${targetDate} | ${timeMatch[1]}`;
        }
        return `${targetDate} | Session scheduled`;
    }
    
    return null;
}

// Helper function to check if time slots conflict
function timeSlotsConflict(sessionInfo, targetStart, targetEnd) {
    // Simple string-based check - can be enhanced with proper time parsing
    const sessionLower = sessionInfo.toLowerCase();
    const targetStartHour = parseInt(targetStart.split(':')[0]);
    const targetEndHour = parseInt(targetEnd.split(':')[0]);
    
    // Check if any hour digits in the session info overlap with target range
    const hoursInSession = sessionLower.match(/(\d{1,2})(?::\d{2})?\s*(?:AM|PM)?/gi);
    if (hoursInSession) {
        for (const hour of hoursInSession) {
            const sessionHour = parseInt(hour);
            if (sessionHour >= targetStartHour && sessionHour <= targetEndHour) {
                return true;
            }
        }
    }
    
    return false;
}
