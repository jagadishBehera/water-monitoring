// filepath: esp32_gsm_sensor.ino
// Ready-to-upload ESP32 GSM code for Airtel SIM
// Uses TinyGSM library - Dynamic JWT authentication

#include <TinyGsmClient.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>

// ==================== CONFIGURATION ====================
#define TINYGSM_RX_PIN 16
#define TINYGSM_TX_PIN 17
#define TINYGSM_BAUD 9600
#define MODEM_RST 4
#define MODEM_PWRKEY 5

// Your backend server URL
const char* SERVER_URL = "http://<YOUR-SERVER-IP>:3000/api";

// Device credentials - REPLACE THESE
const char* DEVICE_EMAIL = "testuser_1776939082150@example.com";
const char* DEVICE_PASSWORD = "TestUser@1234";
const char* TANK_ID = "TANK-4A8CF77E";
const char* DEVICE_ID = "ESP32_GSM_001";

// ==================== GLOBAL VARIABLES ====================
TinyGsm modem(Serial1);
TinyGsmClient client(modem);
HTTPClient http;

String jwtToken = "";
unsigned long lastSendTime = 0;
unsigned long lastLoginTime = 0;
const unsigned long SEND_INTERVAL = 30000; // 30 seconds
const unsigned long TOKEN_REFRESH_INTERVAL = 3600000; // 1 hour

bool gsmConnected = false;
bool loggedIn = false;
int reconnectAttempts = 0;
const int MAX_RECONNECT_ATTEMPTS = 10;

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  Serial1.begin(TINYGSM_BAUD, SERIAL_8N1, TINYGSM_RX_PIN, TINYGSM_TX_PIN);
  
  pinMode(MODEM_PWRKEY, OUTPUT);
  pinMode(MODEM_RST, OUTPUT);
  
  digitalWrite(MODEM_PWRKEY, LOW);
  digitalWrite(MODEM_RST, LOW);
  
  Serial.println("=== ESP32 GSM Sensor Sender ===");
  Serial.println("Initializing...");
  
  initModem();
}

// ==================== MAIN LOOP ====================
void loop() {
  if (!gsmConnected) {
    Serial.println("GSM not connected. Attempting reconnect...");
    if (connectGSM()) {
      gsmConnected = true;
      reconnectAttempts = 0;
      Serial.println("GSM reconnected successfully!");
      
      // Login after GSM connects
      if (!loggedIn || jwtToken == "") {
        loginAndGetToken();
      }
    } else {
      reconnectAttempts++;
      Serial.print("Reconnect attempt ");
      Serial.print(reconnectAttempts);
      Serial.println("/10");
      delay(5000);
    }
  }
  
  // Refresh token every hour
  if (loggedIn && millis() - lastLoginTime > TOKEN_REFRESH_INTERVAL) {
    Serial.println("Token expired. Re-logging...");
    loginAndGetToken();
  }
  
  // Send data every 30 seconds
  if (millis() - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = millis();
    if (loggedIn && jwtToken != "") {
      sendSensorData();
    } else {
      Serial.println("Not logged in. Attempting login...");
      loginAndGetToken();
    }
  }
  
  delay(1000);
}

// ==================== MODEM FUNCTIONS ====================
void initModem() {
  Serial.println("Powering on modem...");
  digitalWrite(MODEM_PWRKEY, HIGH);
  delay(1000);
  digitalWrite(MODEM_PWRKEY, LOW);
  
  Serial.println("Waiting for modem to respond...");
  int attempts = 0;
  while (attempts < 30) {
    Serial1.println("AT");
    String response = waitForResponse(2000);
    if (response.indexOf("OK") != -1) {
      Serial.println("Modem responded!");
      break;
    }
    attempts++;
    delay(1000);
  }
  
  Serial.println("Checking SIM card...");
  Serial1.println("AT+CPIN?");
  waitForResponse(3000);
  
  Serial.println("Getting signal quality...");
  Serial1.println("AT+CSQ");
  waitForResponse(2000);
}

bool connectGSM() {
  Serial.println("Connecting to GSM network...");
  
  Serial1.println("AT+CGATT=1");
  waitForResponse(5000);
  
  Serial1.println("AT+CGDCONT=1,\"IP\",\"airtelgprs.com\"");
  waitForResponse(3000);
  
  Serial1.println("AT+CGACT=1,1");
  waitForResponse(10000);
  
  Serial1.println("AT+CGREG?");
  String regResponse = waitForResponse(3000);
  
  if (regResponse.indexOf(",1") != -1 || regResponse.indexOf(",5") != -1) {
    Serial.println("Registered on network!");
    return true;
  }
  
  Serial.println("Network registration failed. Retrying...");
  return false;
}

String waitForResponse(unsigned long timeout) {
  unsigned long start = millis();
  String response = "";
  
  while (millis() - start < timeout) {
    while (Serial1.available()) {
      char c = Serial1.read();
      response += c;
    }
  }
  
  Serial.println("Modem Response: " + response);
  return response;
}

// ==================== LOGIN FUNCTION ====================
bool loginAndGetToken() {
  if (!gsmConnected) {
    Serial.println("Cannot login: GSM not connected");
    return false;
  }
  
  Serial.println("=== Logging in to get JWT ===");
  
  StaticJsonDocument<256> loginDoc;
  loginDoc["email"] = DEVICE_EMAIL;
  loginDoc["password"] = DEVICE_PASSWORD;
  
  String loginJson;
  serializeJson(loginDoc, loginJson);
  
  Serial.println("Login JSON: " + loginJson);
  
  String loginUrl = String(SERVER_URL) + "/auth/login";
  
  http.begin(client, loginUrl);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(loginJson);
  
  Serial.print("Login HTTP Response: ");
  Serial.println(httpCode);
  
  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("Login Response: " + response);
    
    // Parse JWT from response
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      jwtToken = doc["token"].as<String>();
      lastLoginTime = millis();
      loggedIn = true;
      
      Serial.println("✓ Login successful!");
      Serial.println("JWT Token: " + jwtToken.substring(0, 50) + "...");
      
      http.end();
      return true;
    }
  }
  
  Serial.println("✗ Login failed!");
  loggedIn = false;
  http.end();
  return false;
}

// ==================== SEND DATA FUNCTION ====================
void sendSensorData() {
  if (!gsmConnected) {
    Serial.println("Cannot send: GSM not connected");
    return;
  }
  
  if (!loggedIn || jwtToken == "") {
    Serial.println("Cannot send: Not logged in");
    return;
  }
  
  // Simulated sensor values - REPLACE with actual sensor readings
  float flowRate = 12.5;  // Replace with: yourFlowSensor.read()
  float totalizer = 1234.56;  // Replace with: yourTotalizer.read()
  
  Serial.println("=== Sending Sensor Data ===");
  Serial.print("Flow Rate: ");
  Serial.println(flowRate);
  Serial.print("Totalizer: ");
  Serial.println(totalizer);
  
  // Create JSON payload matching backend exactly
  StaticJsonDocument<512> doc;
  doc["tankId"] = TANK_ID;
  doc["deviceId"] = DEVICE_ID;
  doc["flowRate"] = flowRate;
  doc["totalizer"] = totalizer;
  doc["source"] = "esp32-gsm";
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  Serial.println("JSON Payload: " + jsonBody);
  
  // Send HTTP POST to /sensor/ingest
  String ingestUrl = String(SERVER_URL) + "/sensor/ingest";
  
  http.begin(client, ingestUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + jwtToken);
  
  int httpResponseCode = http.POST(jsonBody);
  
  Serial.print("HTTP Response Code: ");
  Serial.println(httpResponseCode);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("Server Response: " + response);
    
    if (httpResponseCode == 201 || httpResponseCode == 200) {
      Serial.println("✓ Data sent successfully!");
    } else if (httpResponseCode == 401) {
      Serial.println("✗ Token expired! Re-logging...");
      loggedIn = false;
      jwtToken = "";
      loginAndGetToken();
    } else {
      Serial.println("✗ Server returned error");
    }
  } else {
    Serial.print("✗ HTTP Error: ");
    Serial.println(http.errorToString(httpResponseCode));
    
    // Check if connection lost
    if (httpResponseCode == -1) {
      Serial.println("Connection lost! Marking GSM as disconnected.");
      gsmConnected = false;
    }
  }
  
  http.end();
}