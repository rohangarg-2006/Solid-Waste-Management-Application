from PIL import Image
import torch
from torchvision import transforms, models
import torch.nn as nn
import sys
import os

# Ensure the paths are absolute or relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.pth")

# Load model
model = models.resnet18(pretrained=False)
model.fc = nn.Linear(model.fc.in_features, 2)
model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device('cpu')))
model.eval()

classes = ["Clean", "Dirty"]

transform = transforms.Compose([
    transforms.Resize((224,224)),
    transforms.ToTensor()
])

def predict(img_path):
    img = Image.open(img_path).convert("RGB")
    img = transform(img).unsqueeze(0)

    with torch.no_grad():
        output = model(img)
        _, pred = torch.max(output, 1)

    return classes[pred.item()]

if __name__ == "__main__":
    if len(sys.argv) > 1:
        img_path = sys.argv[1]
        try:
            prediction = predict(img_path)
            print(prediction)
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
    else:
        print("Error: No image path provided")
        sys.exit(1)
