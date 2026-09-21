// scripts/analyze-single.js
const fs = require('fs');
const path = require('path');

async function checkAllSchedules() {
    const jsonPath = path.join(__dirname, '../rooms.json');
    const imgDir = path.join(__dirname, '../room-images');
    let db = {};

    // Auto-create folder if it's completely missing on the machine runner
    if (!fs.existsSync(imgDir)) {
        console.log("Directory 'room-images' was missing. Creating folder...");
        fs.mkdirSync(imgDir);
    }

    const files = fs.readdirSync(imgDir);
    
    // Fix: Simple, clean check for image extensions without any regex bugs
    const targetImages = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.jpg' || ext === '.jpeg' || ext === '.png';
    });

    console.log(`Discovered ${targetImages.length} room schedule files to scan...`);

    if (targetImages.length === 0) {
        console.log("⚠️ No images found! Double check that you uploaded image files inside your 'room-images/' folder on GitHub.");
    }

    for (let file of targetImages) {
        const roomNumber = path.parse(file).name; 
        const imagePath = path.join(imgDir, file);
        const base64Data = fs.readFileSync(imagePath, { encoding: 'base64' });

        console.log(`Sending Room ${roomNumber} timetable image to Qwen via Ollama...`);

        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'qwen2.5:3b', 
                    prompt: `Analyze this image containing a room timeline schedule layout sheet. Check if there are any classes or meetings happening right now. Output strictly raw valid JSON text matching this schema format, with no markdown tags or backticks: {"roomNumber": "${roomNumber}", "currentStatus": "Free" or "Occupied", "upcomingTimings": "Clean single sentence detailing upcoming classes today"}`,
                    images: [base64Data],
                    stream: false
                })
            });

            const result = await response.json();
            const parsedAI = JSON.parse(result.response.trim());
            db[roomNumber] = parsedAI;

        } catch (err) {
            console.error(`Failed parsing room ${roomNumber}:`, err);
            db[roomNumber] = { roomNumber: roomNumber, currentStatus: "Free", upcomingTimings: "Unparsable file formatting." };
        }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
    console.log("Database file compilation complete!");
}

checkAllSchedules();
