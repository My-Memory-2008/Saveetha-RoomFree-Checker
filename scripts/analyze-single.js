const fs = require('fs');
const path = require('path');

async function processAllImageSchedules() {
    const jsonPath = path.join(__dirname, '../rooms.json');
    const imagesDir = path.join(__dirname, '../room-images');
    
    let db = {};
    
    if (!fs.existsSync(imagesDir)) {
        console.error("Directory room-images/ does not exist.");
        process.exit(1);
    }

    const files = fs.readdirSync(imagesDir);
    const imageExtensions = ['.jpg', '.jpeg', '.png'];
    const targetImages = files.filter(f => imageExtensions.includes(path.extname(f).toLowerCase()));

    console.log(`Discovered ${targetImages.length} schedule images to process...`);

    for (let file of targetImages) {
        const roomName = path.parse(file).name; // Extracts '101' out of '101.jpg'
        const fullImagePath = path.join(imagesDir, file);
        const imgBase64 = fs.readFileSync(fullImagePath, { encoding: 'base64' });

        console.log(`Processing [Room ${roomName}] snapshot with Qwen AI...`);

        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'qwen2.5:3b', // Make sure to append proper VL models matching your local setup configs
                    prompt: `Analyze this room timetable sheet layout. Determine if there is a class or meeting happening right now based on the calendar rules. Output strictly a raw valid JSON object without code blocks, markdown text elements, or wrappers matching exactly this layout format: {"roomNumber": "${roomName}", "currentStatus": "Free" or "Occupied", "upcomingTimings": "List detailed classes schedules and times explicitly extracted here."}`,
                    images: [imgBase64],
                    stream: false
                })
            });

            const rawResponse = await response.json();
            const cleanText = rawResponse.response.trim();
            
            // Map parsed structural details back inside database lists
            const parsedData = JSON.parse(cleanText);
            db[roomName] = parsedData;

        } catch (error) {
            console.error(`Exception encountered while evaluating room asset file [${file}]:`, error);
            // Dynamic fallback state generation to keep application resilient
            db[roomName] = {
                roomNumber: roomName,
                currentStatus: "Free",
                upcomingTimings: "No class routines or occupancy schedules parsed from the image file."
            };
        }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
    console.log("Global rooms database rewrite successfully completed!");
}

processAllImageSchedules();
