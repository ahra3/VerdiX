package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/segmentio/kafka-go"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	clients   = make(map[*websocket.Conn]bool)
	broadcast = make(chan []byte)
)

func main() {
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Error loading .env file")
	}
	fmt.Println("Starting Golang Sequence Aggregator...")

	http.HandleFunc("/ws", handleConnections)
	go handleMessages()
	go func() {
		fmt.Println(" WebSocket Server listening on :8080")
		err := http.ListenAndServe(":8080", nil)
		if err != nil {
			fmt.Println(" WebSocket server crashed:", err)
		}
	}()

	taxonomyPath := `root_cause_taxonomy.json`
	taxonomyBytes, err := os.ReadFile(taxonomyPath)
	taxonomyString := ""

	if err != nil {
		fmt.Printf(" Warning: Could not load taxonomy from %s\n", taxonomyPath)
	} else {
		var fullTaxonomy map[string]interface{}
		if err := json.Unmarshal(taxonomyBytes, &fullTaxonomy); err == nil {
			if failureModes, ok := fullTaxonomy["failure_modes"]; ok {
				extractedBytes, _ := json.MarshalIndent(failureModes, "", "  ")
				taxonomyString = string(extractedBytes)
				fmt.Println(" Loaded HDFS Failure Taxonomy successfully! (Extracted failure_modes only)")
			} else {
				taxonomyString = string(taxonomyBytes)
			}
		} else {
			taxonomyString = string(taxonomyBytes)
		}
	}
	kafkaBroker := os.Getenv("KAFKA_BROKER")
	if kafkaBroker == "" {
		kafkaBroker = "localhost:9092"
	}

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:   []string{kafkaBroker},
		Topic:     "hdfs_raw_logs",
		Partition: 0,
		MinBytes:  10e3,
		MaxBytes:  10e6,
	})
	reader.SetOffset(kafka.LastOffset)

	defer reader.Close()

	blockState := make(map[string][]string)
	alertedBlocks := make(map[string]bool)
	blockRegex := regexp.MustCompile(`blk_[-0-9]+`)

	fmt.Println("Listening for logs on Kafka...")

		idleTimeout := 10 * time.Second

	for {
		ctx, cancel := context.WithTimeout(context.Background(), idleTimeout)
		msg, err := reader.ReadMessage(ctx)
		cancel()

		if err != nil {
			// If it's a timeout (no messages for 10s), reset state for next run
			if ctx.Err() == context.DeadlineExceeded {
				if len(blockState) > 0 {
					fmt.Printf("\n No messages for %v. Resetting state for next run (%d blocks cleared).\n", idleTimeout, len(blockState))
					blockState = make(map[string][]string)
					alertedBlocks = make(map[string]bool)
				}
				continue
			}
			fmt.Printf("Error reading message: %v\n", err)
			continue
		}

		logLine := string(msg.Value)

		match := blockRegex.FindString(logLine)
		if match == "" {
			continue
		}
		blockID := match

		broadcast <- []byte("LOG:" + logLine)
		
		blockState[blockID] = append(blockState[blockID], logLine)

		if strings.Contains(logLine, "Exception") || strings.Contains(logLine, "Failed") {
			if !alertedBlocks[blockID] {
				fmt.Printf("\n ANOMALY DETECTED on %s!\n", blockID)
				diagnoseWithLLM(blockID, blockState[blockID], taxonomyString)
				alertedBlocks[blockID] = true
			}
		}
	}

}

func diagnoseWithLLM(blockID string, history []string, taxonomy string) {
	maxHistory := 40
	if len(history) > maxHistory {
		history = history[len(history)-maxHistory:]
	}

	apiKey := os.Getenv("LLM_TOKEN")
	if apiKey == "" {
		fmt.Println("LLM_TOKEN not found in .env ")
	}
	url := "https://models.inference.ai.azure.com/chat/completions"

	promptText := fmt.Sprintf(`You are an autonomous HDFS diagnostic agent. 
		You MUST categorize the failure using ONLY one of the failure modes defined in this official taxonomy:
		=== OFFICIAL HDFS FAILURE TAXONOMY ===
		%s
		======================================
		Analyze this broken block sequence:
		%s
		You MUST use this exact output format:
		**PREMISE**: [Summary of events]
		**OBSERVATION**: [What went wrong]
		**DEDUCTION**: [Identify the specific taxonomy failure mode and root cause]
		**ACTION**: [JSON object containing bash commands for remediation]`, taxonomy, strings.Join(history, "\n"))

	payload := map[string]interface{}{
		"model": "gpt-4o-mini",
		"messages": []map[string]interface{}{
			{
				"role":    "system",
				"content": "You are a highly capable diagnostic AIOps agent.",
			},
			{
				"role":    "user",
				"content": promptText,
			},
		},
		"temperature": 0.1,
	}
	jsonData, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println(" Error contacting LLM:", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result map[string]interface{}
	json.Unmarshal(body, &result)

	if errorObj, hasError := result["error"]; hasError {
		fmt.Printf(" API Error:\n%v\n", errorObj)
		broadcast <- []byte("API_ERROR: LLM API returned an error: " + string(body))
		return
	}

	choices, ok := result["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		fmt.Printf(" Unexpected API Response:\n%s\n", string(body))
		broadcast <- []byte("API_ERROR: Empty or unexpected response from AI Model.")
		return
	}

	firstChoice := choices[0].(map[string]interface{})
	message := firstChoice["message"].(map[string]interface{})
	text := message["content"].(string)

	text = regexp.MustCompile(`(?s)<think>.*?</think>\s*`).ReplaceAllString(text, "")

	fmt.Printf(" Diagnosis Received for %s:\n%s\n", blockID, text)
	fmt.Println(strings.Repeat("-", 50))

	broadcast <- []byte(text)
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println(" WebSocket Upgrade Error:", err)
		return
	}
	defer ws.Close()

	clients[ws] = true
	fmt.Println(" New Dashboard connected via WebSocket!")

	for {
		_, _, err := ws.ReadMessage()
		if err != nil {
			delete(clients, ws)
			break
		}
	}
}

func handleMessages() {
	for {
		msg := <-broadcast
		for client := range clients {
			err := client.WriteMessage(websocket.TextMessage, msg)
			if err != nil {
				client.Close()
				delete(clients, client)
			}
		}
	}
}
