package main

import (
	"log"
	"net/http"
	"os"

	"github.com/benedoc-inc/xfa-web/internal/handler"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/parse", handler.Parse)
	mux.HandleFunc("/api/export", handler.Export)
	mux.HandleFunc("/api/export-xml", handler.ExportXML)
	mux.Handle("/", http.FileServer(http.Dir("web/dist")))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("xfa-web listening on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, corsMiddleware(mux)))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
