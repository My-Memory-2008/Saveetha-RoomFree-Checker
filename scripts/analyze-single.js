const fs = require('fs');
const path = require('path');

async function checkAllSchedules() {
    const jsonPath = path.join(__dirname, '../rooms.json');
    const imgDir = path.join(__dirname, '../room-images');
    let db = {};

    if (!fs.existsSync(imgDir)) {
        console.log("Directory 'room-images' was missing. Creating folder...");
        fs.mkdirSync(imgDir);
    }

    const files = fs.readdirSync(imgDir);
    const targetImages = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.jpg' || ext === '.jpeg' || ext === '.png';
    });

    console.log(`Discovered ${targetImages.length} room schedule files to scan...`);

    for (let file of targetImages) {
        const roomNumber = path.parse(file).name; 
        const imagePath = path.join(imgDir, file);
        const base64Data = fs.readFileSync(imagePath, { encoding: 'base64' });

        console.log(`Sending Room ${roomNumber} timetable image to Qwen VL via Ollama...`);

        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'qwen2.5-vl', // Target the Vision model
                    prompt: `Analyze this image containing a room timeline schedule layout sheet. Check if there are any classes or meetings happening right now. Output strictly raw valid JSON text matching this schema format, with no markdown tags, backticks or extra text: {"roomNumber": "${roomNumber}", "currentStatus": "Free" or "Occupied", "upcomingTimings": "Clean single sentence detailing upcoming classes today"}`,
                    images: [base64Data],
                    stream: false
                })
            });

            const result = await response.json();
            
            if (!result || !result.response) {
                throw new Error("Model failed to return data package response body.");
            }

            let cleanText = result.response.trim();
            
            // Clean out markdown wrapper boundaries if Qwen formats it as codeblocks
            if (cleanText.includes("```")) {
                cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "").trim();
            }
            
            const parsedAI = JSON.parse(cleanText);
            db[roomNumber] = parsedAI;
            console.log(`Successfully parsed Room ${roomNumber} as ${parsedAI.currentStatus}`);

        } catch (err) {
            console.error(`Failed parsing room ${roomNumber}:`, err);
            // Dynamic fallback state generation to prevent breaking compilation loops
            db[roomNumber] = { 
                roomNumber: roomNumber, 
                currentStatus: "Free", 
                upcomingTimings: "Schedule structure unparsable from image sheet asset." 
            };
        }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
    console.log("Database file compilation complete!");
}

checkAllSchedules();
