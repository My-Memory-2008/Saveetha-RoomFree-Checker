import os
import json
import re
import time
from PIL import Image
import torch
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

# Try importing Playwright browser utilities
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright components missing. Ensure setup commands are executing properly.")

def capture_and_analyze_web_schedules():
    json_path = os.path.join(os.path.dirname(__file__), '../rooms.json')
    links_file = os.path.join(os.path.dirname(__file__), '../links.txt')
    screenshot_dir = os.path.join(os.path.dirname(__file__), '../room-images')
    db = {}

    if not os.path.exists(links_file):
        print("⚠️ Error: links.txt file not found at repository root. Please create it.")
        return

    if not os.path.exists(screenshot_dir):
        os.makedirs(screenshot_dir)

    # Read links out of text file layout
    with open(links_file, 'r') as f:
        urls = [line.strip() for line in f if line.strip() and line.strip().startswith('http')]

    print(f"Loaded {len(urls)} live website schedule links from text registry...")
    if not urls:
        return

    # 1. Open Headless Browsers via Playwright to generate clean snapshots
    print("Launching Playwright automated browser...")
    captured_targets = []
    
    with sync_playwright() as p:
        # Launch headless browser compatible with standard Linux runners
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        
        for idx, url in enumerate(urls):
            try:
                print(f"Navigating browser automation straight to: {url}")
                page.goto(url, wait_until="networkidle", timeout=30000)
                time.sleep(3) # Safe breathing room for dynamic scripts or login fields to clear
                
                # Derive clean room names directly from URL text structures or numerical positions
                room_id = re.sub(r'[^a-zA-Z0-9]', '_', url.split('/')[-1]) or f"Room_{idx+1}"
                img_path = os.path.join(screenshot_dir, f"{room_id}.png")
                
                # Take a full page snapshot of the live schedule layout
                page.screenshot(path=img_path, full_page=True)
                captured_targets.append({"room": room_id, "path": img_path})
                print(f"Captured clean web layout image wrapper for: {room_id}")
            except Exception as e:
                print(f"Skipping link {url} due to loading timeout failure: {str(e)}")
        
        browser.close()

    if not captured_targets:
        print("No screenshots generated successfully. Stopping pipeline task.")
        return

    # 2. Feed Web Screenshots Straight to the Core Qwen Vision Model
    print("Loading Qwen2.5-VL-3B-Instruct model (running on CPU optimization layers)...")
    model_id = "Qwen/Qwen2.5-VL-3B-Instruct"
    
    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        model_id, 
        torch_dtype=torch.float32, 
        device_map="cpu"
    )
    processor = AutoProcessor.from_pretrained(model_id)

    for target in captured_targets:
        room_name = target["room"]
        print(f"Analyzing [Room {room_name}] captured webpage screenshot with Qwen VL...")

        try:
            image = Image.open(target["path"]).convert("RGB")
            
            prompt = (
                "Analyze this screenshot of a live website timetable class schedule grid page. "
                "Look closely at the current time columns and rows. Is there an active class or group happening right now? "
                "Output strictly a raw valid JSON object matching this schema layout format, with no markdown tags or backticks: "
                f'{{"roomNumber": "{room_name}", "currentStatus": "Free" or "Occupied", "upcomingTimings": "List detailed class rows and times explicitly here"}}'
            )

            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "image": image},
                        {"type": "text", "text": prompt}
                    ]
                }
            ]

            text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
            inputs = processor(text=[text], images=image, padding=True, return_tensors="pt")

            with torch.no_grad():
                generated_ids = model.generate(**inputs, max_new_tokens=250)
                generated_ids_trimmed = [out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)]
                output_text = processor.batch_decode(generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False)[0]

            clean_text = output_text.strip()
            if "```" in clean_text:
                clean_text = re.sub(r'```json\s*|```', '', clean_text).strip()

            parsed_json = json.loads(clean_text)
            db[room_name] = parsed_json
            print(f"Successfully processed Live Room {room_name} -> {parsed_json['currentStatus']}")

        except Exception as e:
            print(f"Failed processing room template {room_name}: {str(e)}")
            db[room_name] = {
                "roomNumber": room_name,
                "currentStatus": "Free",
                "upcomingTimings": "Web routing portal layout shifted or model returned unexpected code tags."
            }

    with open(json_path, 'w') as f:
        json.dump(db, f, indent=2)
    print("Database processing completed successfully!")

if __name__ == "__main__":
    capture_and_analyze_web_schedules()
