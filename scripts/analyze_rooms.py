import os
import json
import glob
import re
from PIL import Image
import torch
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

def check_all_schedules():
    json_path = os.path.join(os.path.dirname(__file__), '../rooms.json')
    img_dir = os.path.join(os.path.dirname(__file__), '../room-images')
    db = {}

    if os.path.exists(json_path):
        try:
            with open(json_path, 'r') as f:
                db = json.load(f)
        except:
            pass

    # Find all images inside the directory
    extensions = ('*.png', '*.jpg', '*.jpeg', '*.PNG', '*.JPG', '*.JPEG')
    target_images = []
    for ext in extensions:
        target_images.extend(glob.glob(os.path.join(img_dir, ext)))

    print(f"Discovered {len(target_images)} room schedule files to scan...")
    if not target_images:
        print("No images found to process.")
        return

    # Load the highly optimized Qwen 2.5 VL 3B model directly into system CPU RAM
    print("Loading Qwen2.5-VL-3B-Instruct model (running on CPU)...")
    model_id = "Qwen/Qwen2.5-VL-3B-Instruct"
    
    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        model_id, 
        torch_dtype=torch.float32, 
        device_map="cpu"
    )
    processor = AutoProcessor.from_pretrained(model_id)

    for img_path in target_images:
        room_number = os.path.splitext(os.path.basename(img_path))[0]
        print(f"Analyzing [Room {room_number}] schedule image...")

        try:
            image = Image.open(img_path).convert("RGB")
            
            prompt = (
                "Analyze this room timetable sheet image. Check if there are any classes or meetings happening right now. "
                "Output strictly a raw valid JSON object matching this format, with no markdown tags or backticks: "
                f'{{"roomNumber": "{room_number}", "currentStatus": "Free" or "Occupied", "upcomingTimings": "Clean text details of upcoming events"}}'
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
            image_inputs, video_inputs = processor.image_processor(images=image, videos=None, return_tensors="pt"), None
            
            inputs = processor(
                text=[text],
                images=image,
                padding=True,
                return_tensors="pt"
            )

            # Generate response from model
            with torch.no_grad():
                generated_ids = model.generate(**inputs, max_new_tokens=200)
                generated_ids_trimmed = [out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)]
                output_text = processor.batch_decode(generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False)[0]

            # Strip out markdown backticks if model generated code wrappers
            clean_text = output_text.strip()
            if "```" in clean_text:
                clean_text = re.sub(r'```json\s*|```', '', clean_text).strip()

            parsed_json = json.loads(clean_text)
            db[room_number] = parsed_json
            print(f"Successfully processed Room {room_number} -> {parsed_json['currentStatus']}")

        except Exception as e:
            print(f"Failed parsing room {room_number}: {str(e)}")
            db[room_number] = {
                "roomNumber": room_number,
                "currentStatus": "Free",
                "upcomingTimings": "Schedule structure unparsable from CPU runner."
            }

    with open(json_path, 'w') as f:
        json.dump(db, f, indent=2)
    print("Database processing completed successfully!")

if __name__ == "__main__":
    check_all_schedules()
