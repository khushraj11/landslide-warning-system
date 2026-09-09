"""
Trains a Random Forest classifier to predict landslide risk category
from rainfall, soil moisture, slope angle, and historical landslide data.
Saves the trained model + label encoder to disk for use in the dashboard.
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
import joblib

FEATURE_COLS = ["rainfall_mm", "soil_moisture_pct", "slope_angle_deg", "historical_landslides"]
TARGET_COL = "risk_label"

def train():
    print("Loading data...")
    df = pd.read_csv("data/landslide_training_data.csv")

    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    label_order = ["Low", "Moderate", "High", "Severe"]
    label_to_int = {label: i for i, label in enumerate(label_order)}
    y_encoded = y.map(label_to_int).values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )

    print(f"Training on {len(X_train)} samples, testing on {len(X_test)} samples...")

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=16,
        min_samples_split=2,
        random_state=42
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)

    print(f"\nModel Accuracy: {accuracy:.2%}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, labels=list(range(4)), target_names=label_order))

    print("\nFeature Importance:")
    for feat, importance in sorted(zip(FEATURE_COLS, model.feature_importances_), key=lambda x: -x[1]):
        print(f"  {feat}: {importance:.3f}")

    joblib.dump(model, "models/landslide_risk_model.pkl")
    joblib.dump(label_order, "models/label_order.pkl")
    print("\nModel saved -> models/landslide_risk_model.pkl")
    print("Label order saved -> models/label_order.pkl")

if __name__ == "__main__":
    train()
