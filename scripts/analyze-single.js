const fs = require('fs');
const path = require('path');

async function processImagePayload() {
    const targetRoom = process.env.TARGET_ROOM;
    if (!targetRoom) {
        console.error("Missing TARGET_ROOM env variable.");
        process.exit(1);
    }

    const jsonPath = path.join(__dirname, '../rooms.json');
    let db = {};
    if (fs.existsSync(jsonPath)) {
        try { db = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch(e){}
    }

    // Match any image format in folder
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    let localFileMatch = null;
    for(let ext of validExtensions) {
        let checkPath = path.join(__dirname, `../room-images/${targetRoom}${ext}`);
        if (fs.existsSync(checkPath)) { localFileMatch = checkPath; break; }
    }

    if(!localFileMatch) {
        console.error(`Image snapshot asset not found for room file designation: ${targetRoom}`);
        process.exit(1);
    }

    const imgBase64 = fs.readFileSync(localFileMatch, { encoding: 'base64' });

    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen2.5:3b',
                prompt: `Analyze this image containing a room timeline event sheet layout. Output strictly raw valid parsed text matching this schema block syntax without markdown wrappers, backticks, or comments: {"roomNumber": "${targetRoom}", "currentStatus": "Free" or "Occupied", "upcomingTimings": "Brief clean extraction text listing immediate upcoming schedules items here"}`,
                images: [imgBase64],
                stream: false
            })
        });

        const outputData = await response.json();
        console.log("Raw Model Output:", outputData.response);
        
        const cleanJSONString = outputData.response.trim();
        const parsedAI = JSON.parse(cleanJSONString);

        db[targetRoom] = parsedAI;
        fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
        console.log(`Successfully mapped local db updates for room number: ${targetRoom}`);

    } catch(err) {
        console.error("Critical Runtime Automation Parse Failure:", err);
        process.exit(1);
    }
}
processImagePayload();
