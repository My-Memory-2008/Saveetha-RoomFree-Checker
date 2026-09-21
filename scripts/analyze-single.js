const fs = require('fs');
const path = require('path');

async function checkAllSchedules() {
    const jsonPath = path.join(__dirname, '../rooms.json');
    const imgDir = path.join(__dirname, '../room-images');
    let db = {};

    if (!fs.existsSync(imgDir)) {
        console.error("Missing room-images/ folder path profile.");
        process.exit(1);
    }

    // Fixed regex: correctly matches files ending in .jpg, .jpeg, or .png
    const files = fs.readdirSync(imgDir).filter(f => /\.(jpg|jpeg|png)\$/i.test(f));
    console.log(`Discovered ${files.length} room schedule files to scan...`);

    for (let file of files) {
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
