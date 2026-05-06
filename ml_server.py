import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import random

app = Flask(__name__)
CORS(app)  # Enable CORS for React Native

# --- 1. Synthetic Data Generation ---
print("Generating synthetic dataset for training...")
np.random.seed(42)
num_samples = 5000

data = []
for _ in range(num_samples):
    distance = round(random.uniform(1.0, 50.0), 2)
    hour = random.randint(0, 23)
    weather = random.choice(['Clear', 'Rain', 'Storm', 'Fog'])
    demand = random.choice(['Low', 'Normal', 'High', 'Surge'])
    
    # Base calculation logic (similar to real world)
    BASE_FARE = 50
    PER_KM_RATE = 15
    PER_MINUTE_RATE = 2
    
    base_price = BASE_FARE + (distance * PER_KM_RATE) + (distance * 3 * PER_MINUTE_RATE)
    price = base_price
    
    if (8 <= hour <= 10) or (17 <= hour <= 20):
        price *= 1.4
    elif hour >= 23 or hour <= 4:
        price *= 1.25
        
    if weather == 'Rain':
        price *= 1.3
    elif weather == 'Storm':
        price *= 1.8
    elif weather == 'Fog':
        price *= 1.2
        
    if demand == 'Low':
        price *= 0.85
    elif demand == 'High':
        price *= 1.2
    elif demand == 'Surge':
        price *= 1.6
        
    noise = (random.random() * 0.08) - 0.04
    final_price = max(50, price * (1 + noise))
    
    data.append([distance, hour, weather, demand, final_price])

df = pd.DataFrame(data, columns=['distanceKm', 'timeOfDayHour', 'weather', 'demandLevel', 'price'])

# --- 2. Model Training ---
print("Training the Random Forest model...")
# Encoding categorical features
weather_mapping = {'Clear': 0, 'Rain': 1, 'Storm': 2, 'Fog': 3}
demand_mapping = {'Low': 0, 'Normal': 1, 'High': 2, 'Surge': 3}

X = df[['distanceKm', 'timeOfDayHour', 'weather', 'demandLevel']].copy()
X['weather'] = X['weather'].map(weather_mapping)
X['demandLevel'] = X['demandLevel'].map(demand_mapping)
y = df['price']

model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X, y)
print("Model trained successfully!")

# --- 3. Flask Endpoints ---
@app.route('/predict', methods=['POST'])
def predict():
    try:
        req_data = request.json
        dist = req_data.get('distanceKm', 0)
        hour = req_data.get('timeOfDayHour', 12)
        weather = req_data.get('weather', 'Clear')
        demand = req_data.get('demandLevel', 'Normal')
        
        # Prepare input
        input_data = pd.DataFrame([{
            'distanceKm': dist,
            'timeOfDayHour': hour,
            'weather': weather_mapping.get(weather, 0),
            'demandLevel': demand_mapping.get(demand, 1)
        }])
        
        predicted_price = model.predict(input_data)[0]
        
        # Calculate a base price to return alongside prediction
        BASE_FARE = 50
        PER_KM_RATE = 15
        PER_MINUTE_RATE = 2
        base_price = BASE_FARE + (dist * PER_KM_RATE) + (dist * 3 * PER_MINUTE_RATE)
        
        # Construct explanation based on features
        explanation = f"Base rate for {dist:.1f}km. "
        adjustments = []
        if (8 <= hour <= 10) or (17 <= hour <= 20):
            adjustments.append('Rush Hour')
        if weather != 'Clear':
            adjustments.append(f'{weather} weather')
        if demand != 'Normal':
            adjustments.append(f'{demand} Demand')
            
        if adjustments:
            explanation += "AI adjusted for: " + ", ".join(adjustments) + "."
        else:
            explanation += "Standard conditions applied."
        
        return jsonify({
            'success': True,
            'price': max(50, round(predicted_price)),
            'basePrice': round(base_price),
            'explanation': explanation
        })
    except Exception as e:
        print(f"Error predicting price: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    # Run the server on port 5000
    app.run(host='0.0.0.0', port=5000)
