package handler

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"

	"github.com/benedoc-inc/pdfer"
	"github.com/benedoc-inc/pdfer/types"
)

type ParseResponse struct {
	Schema  *types.FormSchema `json:"schema"`
	Values  map[string]string `json:"values"`
	PDFData string            `json:"pdf_data"`
}

type ExportRequest struct {
	PDFData  string            `json:"pdf_data"`
	Values   map[string]string `json:"values"`
	Password string            `json:"password,omitempty"`
}

func Parse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "failed to parse multipart form", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("pdf")
	if err != nil {
		http.Error(w, "missing 'pdf' field", http.StatusBadRequest)
		return
	}
	defer file.Close()

	pdfBytes, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "failed to read file", http.StatusInternalServerError)
		return
	}

	var password []byte
	if p := r.FormValue("password"); p != "" {
		password = []byte(p)
	}

	form, err := pdfer.ExtractForm(pdfBytes, password, false)
	if err != nil {
		http.Error(w, "failed to parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	schema := form.Schema()
	rawValues := form.GetValues()

	nameToID := make(map[string]string, len(schema.Questions))
	for _, q := range schema.Questions {
		nameToID[q.Name] = q.ID
	}

	values := make(map[string]string, len(rawValues))
	for name, val := range rawValues {
		id, ok := nameToID[name]
		if !ok {
			continue
		}
		switch v := val.(type) {
		case string:
			values[id] = v
		case bool:
			if v {
				values[id] = "1"
			} else {
				values[id] = "0"
			}
		}
	}

	resp := ParseResponse{
		Schema:  schema,
		Values:  values,
		PDFData: base64.StdEncoding.EncodeToString(pdfBytes),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp) //nolint:errcheck
}

func Export(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ExportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	pdfBytes, err := base64.StdEncoding.DecodeString(req.PDFData)
	if err != nil {
		http.Error(w, "invalid pdf_data encoding", http.StatusBadRequest)
		return
	}

	var password []byte
	if req.Password != "" {
		password = []byte(req.Password)
	}

	form, err := pdfer.ExtractForm(pdfBytes, password, false)
	if err != nil {
		http.Error(w, "failed to parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	schema := form.Schema()

	idToName := make(map[string]string, len(schema.Questions))
	for _, q := range schema.Questions {
		idToName[q.ID] = q.Name
	}

	formData := make(types.FormData, len(req.Values))
	for id, val := range req.Values {
		if name, ok := idToName[id]; ok {
			formData[name] = val
		}
	}

	filledPDF, err := form.Fill(pdfBytes, formData, password, false)
	if err != nil {
		http.Error(w, "failed to fill form: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="filled_form.pdf"`)
	w.Write(filledPDF) //nolint:errcheck
}
