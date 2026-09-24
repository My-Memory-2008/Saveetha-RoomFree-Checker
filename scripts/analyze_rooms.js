// import os
// import json
// import re
// import time
// from PIL import Image
// import torch
// from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

// # Try importing Playwright browser utilities
// try:
//     from playwright.sync_api import sync_playwright
// except ImportError:
//     print("Playwright components missing. Ensure setup commands are executing properly.")

// def capture_and_analyze_web_schedules():
//     json_path = os.path.join(os.path.dirname(__file__), '../rooms.json')
//     links_file = os.path.join(os.path.dirname(__file__), '../links.txt')
//     screenshot_dir = os.path.join(os.path.dirname(__file__), '../room-images')
//     db = {}

//     if not os.path.exists(links_file):
//         print("⚠️ Error: links.txt file not found at repository root. Please create it.")
//         return

//     if not os.path.exists(screenshot_dir):
//         os.makedirs(screenshot_dir)

//     # Read links out of text file layout
//     with open(links_file, 'r') as f:
//         urls = [line.strip() for line in f if line.strip() and line.strip().startswith('http')]

//     print(f"Loaded {len(urls)} live website schedule links from text registry...")
//     if not urls:
//         return

//     # 1. Open Headless Browsers via Playwright to generate clean snapshots
//     print("Launching Playwright automated browser...")
//     captured_targets = []
    
//     with sync_playwright() as p:
//         # Launch headless browser compatible with standard Linux runners
//         browser = p.chromium.launch(headless=True)
//         page = browser.new_page(viewport={"width": 1280, "height": 800})
        
//         for idx, url in enumerate(urls):
//             try:
//                 print(f"Navigating browser automation straight to: {url}")
//                 page.goto(url, wait_until="networkidle", timeout=30000)
//                 time.sleep(3) # Safe breathing room for dynamic scripts or login fields to clear
                
//                 # Derive clean room names directly from URL text structures or numerical positions
//                 room_id = re.sub(r'[^a-zA-Z0-9]', '_', url.split('/')[-1]) or f"Room_{idx+1}"
//                 img_path = os.path.join(screenshot_dir, f"{room_id}.png")
                
//                 # Take a full page snapshot of the live schedule layout
//                 page.screenshot(path=img_path, full_page=True)
//                 captured_targets.append({"room": room_id, "path": img_path})
//                 print(f"Captured clean web layout image wrapper for: {room_id}")
//             except Exception as e:
//                 print(f"Skipping link {url} due to loading timeout failure: {str(e)}")
        
//         browser.close()

//     if not captured_targets:
//         print("No screenshots generated successfully. Stopping pipeline task.")
//         return

//     # 2. Feed Web Screenshots Straight to the Core Qwen Vision Model
//     print("Loading Qwen2.5-VL-3B-Instruct model (running on CPU optimization layers)...")
//     model_id = "Qwen/Qwen2.5-VL-3B-Instruct"
    
//     model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
//         model_id, 
//         torch_dtype=torch.float32, 
//         device_map="cpu"
//     )
//     processor = AutoProcessor.from_pretrained(model_id)

//     for target in captured_targets:
//         room_name = target["room"]
//         print(f"Analyzing [Room {room_name}] captured webpage screenshot with Qwen VL...")

//         try:
//             image = Image.open(target["path"]).convert("RGB")
            
//             prompt = (
//                 "Analyze this screenshot of a live website timetable class schedule grid page. "
//                 "Look closely at the current time columns and rows. Is there an active class or group happening right now? "
//                 "Output strictly a raw valid JSON object matching this schema layout format, with no markdown tags or backticks: "
//                 f'{{"roomNumber": "{room_name}", "currentStatus": "Free" or "Occupied", "upcomingTimings": "List detailed class rows and times explicitly here"}}'
//             )

//             messages = [
//                 {
//                     "role": "user",
//                     "content": [
//                         {"type": "image", "image": image},
//                         {"type": "text", "text": prompt}
//                     ]
//                 }
//             ]

//             text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
//             inputs = processor(text=[text], images=image, padding=True, return_tensors="pt")

//             with torch.no_grad():
//                 generated_ids = model.generate(**inputs, max_new_tokens=250)
//                 generated_ids_trimmed = [out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)]
//                 output_text = processor.batch_decode(generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False)[0]

//             clean_text = output_text.strip()
//             if "```" in clean_text:
//                 clean_text = re.sub(r'```json\s*|```', '', clean_text).strip()

//             parsed_json = json.loads(clean_text)
//             db[room_name] = parsed_json
//             print(f"Successfully processed Live Room {room_name} -> {parsed_json['currentStatus']}")

//         except Exception as e:
//             print(f"Failed processing room template {room_name}: {str(e)}")
//             db[room_name] = {
//                 "roomNumber": room_name,
//                 "currentStatus": "Free",
//                 "upcomingTimings": "Web routing portal layout shifted or model returned unexpected code tags."
//             }

//     with open(json_path, 'w') as f:
//         json.dump(db, f, indent=2)
//     print("Database processing completed successfully!")

// if __name__ == "__main__":
//     capture_and_analyze_web_schedules()











// // scripts/analyze_rooms.js
// const fs = require('fs');
// const path = require('path');
// const { chromium } = require('playwright');

// async function captureAndAnalyzeSchedules() {
//     const jsonPath = path.join(__dirname, '../rooms.json');
//     const linksFile = path.join(__dirname, '../links.txt');
//     const screenshotDir = path.join(__dirname, '../room-images');
//     let db = {};

//     if (!fs.existsSync(linksFile)) {
//         console.error("Critical Error: links.txt file missing at root repository level.");
//         return;
//     }

//     if (!fs.existsSync(screenshotDir)) {
//         fs.mkdirSync(screenshotDir, { recursive: true });
//     }

//     const urls = fs.readFileSync(linksFile, 'utf-8')
//         .split('\n')
//         .map(line => line.trim())
//         .filter(line => line.startsWith('http'));

//     console.log(`Loaded ${urls.length} live website links from text registry...`);
//     if (urls.length === 0) return;

//     // 1. Capture Web Timetables Headlessly via Playwright
//     console.log("Launching Playwright browser layout tracking...");
//     const browser = await chromium.launch({ headless: true });
//     const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
//     const page = await context.newPage();
//     const capturedTargets = [];

//     for (let i = 0; i < urls.length; i++) {
//         const url = urls[i];
//         try {
//             console.log(`Navigating browser to: ${url}`);
//             await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            
//             // Give 5 full seconds for the Saveetha portal and current sessions tab to fully load
//             await page.waitForTimeout(5000); 

//             // Extract the room number from the <h1> heading cleanly
//             const h1Text = await page.locator('h1').first().textContent().catch(() => "");
//             const roomNumber = h1Text.replace(/\D/g, '') || `Location_${i + 1}`;
//             const imgPath = path.join(screenshotDir, `${roomNumber}.png`);

//             // Take a clear snapshot of the webpage canvas
//             await page.screenshot({ path: imgPath, fullPage: true });
//             capturedTargets.push({ room: roomNumber, path: imgPath });
//             console.log(`Captured clean web layout snapshot for Room: ${roomNumber}`);
//         } catch (e) {
//             console.error(`Skipping link ${url} due to loading fault: ${e.message}`);
//         }
//     }
//     await browser.close();

//     if (capturedTargets.length === 0) {
//         console.log("No screenshots generated successfully. Stopping execution.");
//         return;
//     }

//     // 2. Derive Current Indian Standard Time (IST)
//     const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };
//     const formattedTimeString = new Date().toLocaleTimeString('en-US', options) + " (Indian Standard Time)";

//     // 3. Send images to the local Ollama Qwen-VL model instance
//     console.log("Connecting with local Ollama service inference layers...");

//     for (const target of capturedTargets) {
//         const roomName = target.room;
//         console.log(`Analyzing [Room ${roomName}] snapshot with qwen2.5-vl...`);

//         try {
//             // Explicitly instructing the vision model to look for the "No Sessions Found" text block
//             const prompt = `Analyze this university timetable sheet image layout. Check the 'Current Sessions' tab carefully. If it displays 'No Sessions Found' or says there are no sessions available, it means the room is completely empty and available. The current time is ${formattedTimeString}. Output strictly a raw valid JSON object matching this schema format exactly, with no backticks, no extra text, and no markdown wrappers: {"roomNumber": "${roomName}", "currentStatus": "Free", "upcomingTimings": "Verified empty at ${formattedTimeString}"}`;
            
//             const imageBuffer = fs.readFileSync(target.path);
//             const base64Image = imageBuffer.toString('base64');

//             const payload = {
//                 model: "qwen2.5vl", 
//                 prompt: prompt,
//                 images: [base64Image],
//                 stream: false
//             };

//             const response = await fetch('http://localhost:11434/api/generate', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(payload)
//             });

//             if (!response.ok) {
//                 throw new Error(`Ollama server responded with status code ${response.status}`);
//             }

//             const result = await response.json();
            
//             if (!result || !result.response) {
//                 throw new Error("Ollama returned an empty response field data object.");
//             }

//             let cleanText = result.response.toString().trim();

//             // Stripping any code block formatting code wrapper if Qwen adds them by mistake
//             if (cleanText.includes("```")) {
//                 cleanText = cleanText.replace(/```json\s*|```/g, '').trim();
//             }

//             const parsedJson = JSON.parse(cleanText);
            
//             // Force status cleanup to align with our website filtering variables
//             if (parsedJson.currentStatus.toLowerCase().includes("free") || parsedJson.currentStatus.toLowerCase().includes("no session")) {
//                 parsedJson.currentStatus = "Free";
//             } else {
//                 parsedJson.currentStatus = "Occupied";
//             }

//             db[roomName] = parsedJson;
//             console.log(`Processed Room ${roomName} -> Status: ${parsedJson.currentStatus}`);
//         } catch (e) {
//             console.error(`Fallback generation triggered for Room ${roomName}: ${e.message}`);
//             // Resilient fallback output so your page doesn't go blank if an inference timeout happens
//             db[roomName] = {
//                 roomNumber: roomName,
//                 currentStatus: "Free",
//                 upcomingTimings: `No active classes detected. Checked via live automation at ${formattedTimeString}.`
//             };
//         }
//     }

//     fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
//     console.log("Database processing completed successfully!");
// }

// captureAndAnalyzeSchedules();












// // scripts/analyze_rooms.js
// const fs = require('fs');
// const path = require('path');
// const { chromium } = require('playwright');

// async function captureAndAnalyzeSchedules() {
//     const jsonPath = path.join(__dirname, '../rooms.json');
//     const linksFile = path.join(__dirname, '../links.txt');
//     const screenshotDir = path.join(__dirname, '../room-images');
//     let db = {};

//     if (!fs.existsSync(linksFile)) {
//         console.error("Critical Error: links.txt file missing at root repository level.");
//         return;
//     }

//     if (!fs.existsSync(screenshotDir)) {
//         fs.mkdirSync(screenshotDir, { recursive: true });
//     }

//     const urls = fs.readFileSync(linksFile, 'utf-8')
//         .split('\n')
//         .map(line => line.trim())
//         .filter(line => line.startsWith('http'));

//     console.log(`Loaded ${urls.length} live website links from text registry...`);
//     if (urls.length === 0) return;

//     // 1. Capture Web Timetables Headlessly via Playwright
//     console.log("Launching Playwright browser layout tracking...");
//     const browser = await chromium.launch({ headless: true });
//     const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
//     const page = await context.newPage();
//     const capturedTargets = [];

//     for (let i = 0; i < urls.length; i++) {
//         const url = urls[i];
//         try {
//             console.log(`Navigating browser to: ${url}`);
//             await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            
//             // Give 3 seconds for the portal to load (reduced from 5s to save time)
//             await page.waitForTimeout(3000); 

//             const h1Text = await page.locator('h1').first().textContent().catch(() => "");
//             const roomNumber = h1Text.replace(/\D/g, '') || `Location_${i + 1}`;
//             const imgPath = path.join(screenshotDir, `${roomNumber}.png`);

//             await page.screenshot({ path: imgPath, fullPage: true });
//             capturedTargets.push({ room: roomNumber, path: imgPath });
//             console.log(`Captured clean web layout snapshot for Room: ${roomNumber}`);
//         } catch (e) {
//             console.error(`Skipping link ${url} due to loading fault: ${e.message}`);
//         }
//     }
//     await browser.close();

//     if (capturedTargets.length === 0) {
//         console.log("No screenshots generated successfully. Stopping execution.");
//         return;
//     }

//     // 2. Derive Current Indian Standard Time (IST)
//     const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };
//     const formattedTimeString = new Date().toLocaleTimeString('en-US', options) + " (Indian Standard Time)";

//     // 3. Send images to the local Ollama SmolVLM-256M model instance
//     console.log("Connecting with local Ollama service inference layers...");

//     for (const target of capturedTargets) {
//         const roomName = target.room;
//         console.log(`Analyzing [Room ${roomName}] snapshot with SmolVLM-256M...`);

//         try {
//             const prompt = `Analyze this university timetable sheet image layout. Check the 'Current Sessions' tab carefully. If it displays 'No Sessions Found' or says there are no sessions available, it means the room is completely empty and available. The current time is ${formattedTimeString}. Output strictly a raw valid JSON object matching this schema format exactly, with no backticks, no extra text, and no markdown wrappers: {"roomNumber": "${roomName}", "currentStatus": "Free", "upcomingTimings": "Verified empty at ${formattedTimeString}"}`;
            
//             const imageBuffer = fs.readFileSync(target.path);
//             const base64Image = imageBuffer.toString('base64');

//             const payload = {
//                 // ✅ FIXED: Using the GGUF-converted SmolVLM 256M model
//                 model: "hf.co/pierretokns/SmolVLM-256M-Instruct-GGUF", 
//                 prompt: prompt,
//                 images: [base64Image],
//                 stream: false
//             };

//             const response = await fetch('http://localhost:11434/api/generate', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(payload)
//             });

//             if (!response.ok) {
//                 throw new Error(`Ollama server responded with status code ${response.status}`);
//             }

//             const result = await response.json();
            
//             if (!result || !result.response) {
//                 throw new Error("Ollama returned an empty response field data object.");
//             }

//             let cleanText = result.response.toString().trim();

//             if (cleanText.includes("```")) {
//                 cleanText = cleanText.replace(/```json\s*|```/g, '').trim();
//             }

//             const parsedJson = JSON.parse(cleanText);
            
//             if (parsedJson.currentStatus.toLowerCase().includes("free") || parsedJson.currentStatus.toLowerCase().includes("no session")) {
//                 parsedJson.currentStatus = "Free";
//             } else {
//                 parsedJson.currentStatus = "Occupied";
//             }

//             db[roomName] = parsedJson;
//             console.log(`Processed Room ${roomName} -> Status: ${parsedJson.currentStatus}`);
//         } catch (e) {
//             console.error(`Fallback generation triggered for Room ${roomName}: ${e.message}`);
//             db[roomName] = {
//                 roomNumber: roomName,
//                 currentStatus: "Free",
//                 upcomingTimings: `No active classes detected. Checked via live automation at ${formattedTimeString}.`
//             };
//         }
//     }

//     fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
//     console.log("Database processing completed successfully!");
// }

// captureAndAnalyzeSchedules();
















// // scripts/analyze_rooms.js
// const fs = require('fs');
// const path = require('path');
// const { chromium } = require('playwright');

// // ✅ OPTIMIZATION 1: Concurrency Helper to run multiple tasks at once
// async function mapWithConcurrency(items, concurrencyLimit, asyncFn) {
//     const results = [];
//     const executing = new Set();
//     for (const item of items) {
//         const promise = asyncFn(item).then(result => {
//             executing.delete(promise);
//             return result;
//         }).catch(err => {
//             executing.delete(promise);
//             console.error(`Error processing item:`, err.message);
//             return null;
//         });
//         results.push(promise);
//         executing.add(promise);
//         if (executing.size >= concurrencyLimit) {
//             await Promise.race(executing);
//         }
//     }
//     return Promise.all(results);
// }

// async function captureAndAnalyzeSchedules() {
//     const jsonPath = path.join(__dirname, '../rooms.json');
//     const linksFile = path.join(__dirname, '../links.txt');
//     const screenshotDir = path.join(__dirname, '../room-images');
//     let db = {};

//     if (!fs.existsSync(linksFile)) {
//         console.error("Critical Error: links.txt file missing.");
//         return;
//     }

//     if (!fs.existsSync(screenshotDir)) {
//         fs.mkdirSync(screenshotDir, { recursive: true });
//     }

//     const urls = fs.readFileSync(linksFile, 'utf-8')
//         .split('\n')
//         .map(line => line.trim())
//         .filter(line => line.startsWith('http'));

//     console.log(`Loaded ${urls.length} live website links...`);
//     if (urls.length === 0) return;

//     console.log("Launching Playwright for parallel screenshot capture...");
//     const browser = await chromium.launch({ headless: true });
//     const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

//     // ✅ OPTIMIZATION 2: Parallelize Screenshot Capture (3 tabs at a time)
//     const captureResults = await mapWithConcurrency(urls, 3, async (url, index) => {
//         const page = await context.newPage();
//         try {
//             await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
//             await page.waitForSelector('h1', { timeout: 3000 }).catch(() => {});
            
//             const h1Text = await page.locator('h1').first().textContent().catch(() => "") || "";
//             const roomNumber = h1Text.replace(/\D/g, '') || `Location_${index + 1}`;
//             const imgPath = path.join(screenshotDir, `${roomNumber}.png`);

//             await page.screenshot({ path: imgPath, fullPage: true });
//             console.log(`✅ Captured: Room ${roomNumber}`);
//             return { room: roomNumber, path: imgPath };
//         } catch (e) {
//             console.error(`❌ Failed ${url}: ${e.message}`);
//             return null;
//         } finally {
//             await page.close();
//         }
//     });

//     await browser.close();
    
//     const validTargets = captureResults.filter(t => t !== null);
//     if (validTargets.length === 0) {
//         console.log("No screenshots generated. Stopping.");
//         return;
//     }

//     const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };
//     const formattedTimeString = new Date().toLocaleTimeString('en-US', options) + " IST";

//     console.log(`Starting parallel Ollama inference on ${validTargets.length} images...`);

//     // ✅ OPTIMIZATION 3: Parallelize Ollama Inference (4 images at a time)
//     const analysisResults = await mapWithConcurrency(validTargets, 4, async (target) => {
//         const roomName = target.room;
//         try {
//             // ✅ FIX: Ask a simple YES/NO question instead of demanding JSON. 
//             // 256M models are much better at simple classification than writing code/JSON.
//             const prompt = `Look at this university timetable screenshot. Is the room currently empty with no active sessions? Reply with ONLY the word YES or NO.`;
            
//             const imageBuffer = fs.readFileSync(target.path);
//             const base64Image = imageBuffer.toString('base64');

//             const payload = {
//                 model: "hf.co/pierretokns/SmolVLM-256M-Instruct-GGUF",
//                 prompt: prompt,
//                 images: [base64Image],
//                 stream: false,
//                 options: {
//                     temperature: 0.1,
//                     num_predict: 10 // We only need 1 word, so cap it at 10 tokens
//                 }
//             };

//             const response = await fetch('http://localhost:11434/api/generate', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(payload)
//             });

//             if (!response.ok) throw new Error(`Ollama status ${response.status}`);
//             const result = await response.json();
            
//             let cleanText = result.response.toString().trim().toUpperCase();
//             console.log(`Raw model response for Room ${roomName}: "${cleanText}"`);

//             // ✅ Let JavaScript build the JSON based on the simple YES/NO answer
//             const isFree = cleanText.includes("YES") && !cleanText.includes("NO");
            
//             const parsedJson = {
//                 roomNumber: roomName,
//                 currentStatus: isFree ? "Free" : "Occupied",
//                 upcomingTimings: isFree ? `Verified empty at ${formattedTimeString}` : `Active session detected at ${formattedTimeString}`
//             };
            
//             console.log(`✅ Analyzed: Room ${roomName} -> ${parsedJson.currentStatus}`);
//             return { roomName, data: parsedJson };
//         } catch (e) {
//             console.error(`❌ Fallback for Room ${roomName}: ${e.message}`);
//             return { 
//                 roomName, 
//                 data: {
//                     roomNumber: roomName,
//                     currentStatus: "Free",
//                     upcomingTimings: `Automation fallback at ${formattedTimeString}.`
//                 }
//             };
//         }
//     });

//     // Compile final database
//     analysisResults.forEach(res => {
//         if (res) db[res.roomName] = res.data;
//     });

//     fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
//     console.log("🚀 Database processing completed successfully!");
// }

// captureAndAnalyzeSchedules();



















// // scripts/analyze_rooms.js
// const fs = require('fs');
// const path = require('path');
// const { chromium } = require('playwright');
// const sharp = require('sharp'); // ✅ NEW: Ultra-fast image resizing

// // ✅ OPTIMIZATION 1: Concurrency Helper
// async function mapWithConcurrency(items, concurrencyLimit, asyncFn) {
//     const results = [];
//     const executing = new Set();
//     for (const item of items) {
//         const promise = asyncFn(item).then(result => {
//             executing.delete(promise);
//             return result;
//         }).catch(err => {
//             executing.delete(promise);
//             console.error(`Error processing item:`, err.message);
//             return null;
//         });
//         results.push(promise);
//         executing.add(promise);
//         if (executing.size >= concurrencyLimit) {
//             await Promise.race(executing);
//         }
//     }
//     return Promise.all(results);
// }

// async function captureAndAnalyzeSchedules() {
//     const jsonPath = path.join(__dirname, '../rooms.json');
//     const linksFile = path.join(__dirname, '../links.txt');
//     const screenshotDir = path.join(__dirname, '../room-images');
//     let db = {};

//     if (!fs.existsSync(linksFile)) {
//         console.error("Critical Error: links.txt file missing.");
//         return;
//     }

//     if (!fs.existsSync(screenshotDir)) {
//         fs.mkdirSync(screenshotDir, { recursive: true });
//     }

//     const urls = fs.readFileSync(linksFile, 'utf-8')
//         .split('\n')
//         .map(line => line.trim())
//         .filter(line => line.startsWith('http'));

//     console.log(`Loaded ${urls.length} live website links...`);
//     if (urls.length === 0) return;

//     console.log("Launching Playwright for parallel screenshot capture...");
//     const browser = await chromium.launch({ headless: true });
//     const context = await browser.newContext({ viewport: { width: 1024, height: 768 } }); // ✅ Smaller viewport = smaller images

//     // ✅ OPTIMIZATION 2: Parallelize Screenshot Capture (3 tabs at a time)
//     const captureResults = await mapWithConcurrency(urls, 3, async (url, index) => {
//         const page = await context.newPage();
//         try {
//             await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
//             await page.waitForSelector('h1', { timeout: 3000 }).catch(() => {});
            
//             const h1Text = await page.locator('h1').first().textContent().catch(() => "") || "";
//             const roomNumber = h1Text.replace(/\D/g, '') || `Location_${index + 1}`;
//             const imgPath = path.join(screenshotDir, `${roomNumber}.png`);

//             // ✅ FIX: Capture ONLY the viewport, not the massive full page!
//             await page.screenshot({ path: imgPath, fullPage: false }); 
//             console.log(`✅ Captured: Room ${roomNumber}`);
//             return { room: roomNumber, path: imgPath };
//         } catch (e) {
//             console.error(`❌ Failed ${url}: ${e.message}`);
//             return null;
//         } finally {
//             await page.close();
//         }
//     });

//     await browser.close();
    
//     const validTargets = captureResults.filter(t => t !== null);
//     if (validTargets.length === 0) {
//         console.log("No screenshots generated. Stopping.");
//         return;
//     }

//     const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };
//     const formattedTimeString = new Date().toLocaleTimeString('en-US', options) + " IST";

//     console.log(`Starting parallel Ollama inference on ${validTargets.length} images...`);

//     // ✅ OPTIMIZATION 3: Concurrency set to 2 (GitHub Actions only has 2 CPU cores!)
//     const analysisResults = await mapWithConcurrency(validTargets, 2, async (target) => {
//         const roomName = target.room;
//         try {
//             const prompt = `Look at this university timetable screenshot. Is the room currently empty with no active sessions? Reply with ONLY the word YES or NO.`;
            
//             let imageBuffer = fs.readFileSync(target.path);
            
//             // ✅ CRITICAL SPEED FIX: Resize image to max 1024x1024 before sending to AI.
//             // This reduces the pixel count the AI has to process by up to 80%!
//             imageBuffer = await sharp(imageBuffer).resize(1024, 1024, { fit: 'inside' }).toBuffer();
//             const base64Image = imageBuffer.toString('base64');

//             const payload = {
//                 model: "hf.co/pierretokns/SmolVLM-256M-Instruct-GGUF",
//                 prompt: prompt,
//                 images: [base64Image],
//                 stream: false,
//                 options: {
//                     temperature: 0.1,
//                     num_predict: 10,
//                     num_ctx: 512 // ✅ Limits AI memory window for massive CPU speedup
//                 }
//             };

//             const response = await fetch('http://localhost:11434/api/generate', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(payload)
//             });

//             if (!response.ok) throw new Error(`Ollama status ${response.status}`);
//             const result = await response.json();
            
//             let cleanText = result.response.toString().trim().toUpperCase();
//             const isFree = cleanText.includes("YES") && !cleanText.includes("NO");
            
//             const parsedJson = {
//                 roomNumber: roomName,
//                 currentStatus: isFree ? "Free" : "Occupied",
//                 upcomingTimings: isFree ? `Verified empty at ${formattedTimeString}` : `Active session detected at ${formattedTimeString}`
//             };
            
//             console.log(`✅ Analyzed: Room ${roomName} -> ${parsedJson.currentStatus}`);
//             return { roomName, data: parsedJson };
//         } catch (e) {
//             console.error(` Fallback for Room ${roomName}: ${e.message}`);
//             return { 
//                 roomName, 
//                 data: {
//                     roomNumber: roomName,
//                     currentStatus: "Free",
//                     upcomingTimings: `Automation fallback at ${formattedTimeString}.`
//                 }
//             };
//         }
//     });

//     analysisResults.forEach(res => {
//         if (res) db[res.roomName] = res.data;
//     });

//     fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
//     console.log(" Database processing completed successfully!");
// }

// captureAndAnalyzeSchedules();

















// scripts/analyze_rooms.js (PURE PLAYWRIGHT - NO AI)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function scrapeRoomSchedules() {
    const jsonPath = path.join(__dirname, '../rooms.json');
    const linksFile = path.join(__dirname, '../links.txt');
    let db = {};

    if (!fs.existsSync(linksFile)) {
        console.error("Critical Error: links.txt file missing.");
        return;
    }

    const urls = fs.readFileSync(linksFile, 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('http'));

    console.log(`⚡ Loaded ${urls.length} links for instant scraping...`);
    if (urls.length === 0) return;

    // Launch browser with optimized flags for GitHub Actions
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

    // ✅ Process 5 rooms at the same time (Safe for GitHub Actions 2-core CPU)
    const concurrencyLimit = 5;
    const executing = new Set();
    const results = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const index = i;

        const promise = (async () => {
            const page = await context.newPage();
            try {
                // Wait for the page to load and the "Current Sessions" tab to appear
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                await page.waitForSelector('text=Current Sessions', { timeout: 5000 }).catch(() => {});

                // Extract Room Number (Looks for the big number like 5453 in h1 or h2)
                let roomNumber = `Loc_${index + 1}`;
                try {
                    const headingText = await page.locator('h1, h2').first().textContent();
                    const match = headingText.match(/\d+/);
                    if (match) roomNumber = match[0];
                } catch (e) {
                    // Fallback if heading isn't found
                }

                // ✅ THE CHECK: Look for the exact text from your screenshot
                const pageText = await page.locator('body').innerText();
                const isFree = pageText.includes("No Sessions Found");

                console.log(`✅ Room ${roomNumber}: ${isFree ? 'FREE' : 'OCCUPIED'}`);

                return {
                    roomNumber,
                    link: url, // ✅ Saves the URL to the database
                    currentStatus: isFree ? "Free" : "Occupied",
                    upcomingTimings: isFree ? `Verified empty at ${timeStr}` : `Active session at ${timeStr}`
                };
            } catch (e) {
                console.error(`❌ Failed ${url}: ${e.message}`);
                return null;
            } finally {
                await page.close();
            }
        })();

        results.push(promise);
        executing.add(promise);

        // Control concurrency
        if (executing.size >= concurrencyLimit) {
            await Promise.race(executing);
        }
    }

    const finalResults = await Promise.all(results);
    await browser.close();

    // Build the final JSON database
    finalResults.forEach(res => {
        if (res) db[res.roomNumber] = res;
    });

    fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
    console.log(`🚀 Finished scraping ${finalResults.filter(r => r).length} rooms instantly!`);
}

scrapeRoomSchedules();
