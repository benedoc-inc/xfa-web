package handler

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/benedoc-inc/pdfer"
	"github.com/benedoc-inc/pdfer/forms/xfa"
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

	// Accept both multipart (with file attachments) and JSON (legacy).
	contentType := r.Header.Get("Content-Type")
	var pdfData string
	var values map[string]string
	var password string
	var attachments []pdfer.FileAttachment

	if strings.HasPrefix(contentType, "multipart/") {
		if err := r.ParseMultipartForm(64 << 20); err != nil {
			http.Error(w, "failed to parse multipart form", http.StatusBadRequest)
			return
		}
		pdfData = r.FormValue("pdf_data")
		password = r.FormValue("password")
		valuesJSON := r.FormValue("values")
		if valuesJSON != "" {
			if err := json.Unmarshal([]byte(valuesJSON), &values); err != nil {
				http.Error(w, "invalid values JSON", http.StatusBadRequest)
				return
			}
		}
		// Collect file attachments from any multipart file fields.
		if r.MultipartForm != nil {
			for fieldName, fhs := range r.MultipartForm.File {
				for _, fh := range fhs {
					f, err := fh.Open()
					if err != nil {
						continue
					}
					data, err := io.ReadAll(f)
					f.Close()
					if err != nil {
						continue
					}
					mimeType := fh.Header.Get("Content-Type")
					if mimeType == "" {
						mimeType = "application/octet-stream"
					}
					name := fh.Filename
					if name == "" {
						name = fieldName
					}
					attachments = append(attachments, pdfer.FileAttachment{
						Name:     name,
						Data:     data,
						MimeType: mimeType,
					})
				}
			}
		}
	} else {
		var req ExportRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		pdfData = req.PDFData
		values = req.Values
		password = req.Password
	}

	pdfBytes, err := base64.StdEncoding.DecodeString(pdfData)
	if err != nil {
		http.Error(w, "invalid pdf_data encoding", http.StatusBadRequest)
		return
	}

	var passwordBytes []byte
	if password != "" {
		passwordBytes = []byte(password)
	}

	form, err := pdfer.ExtractForm(pdfBytes, passwordBytes, false)
	if err != nil {
		http.Error(w, "failed to parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	schema := form.Schema()

	idToName := make(map[string]string, len(schema.Questions))
	for _, q := range schema.Questions {
		idToName[q.ID] = q.Name
	}

	formData := make(types.FormData, len(values))
	for id, val := range values {
		if name, ok := idToName[id]; ok {
			formData[name] = val
		}
	}

	filledPDF, err := form.Fill(pdfBytes, formData, passwordBytes, false)
	if err != nil {
		http.Error(w, "failed to fill form: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if len(attachments) > 0 {
		filledPDF, err = pdfer.EmbedAttachments(filledPDF, attachments)
		if err != nil {
			http.Error(w, "failed to embed attachments: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="filled_form.pdf"`)
	w.Write(filledPDF) //nolint:errcheck
}

// ExportXML extracts the XFA datasets XML from the original PDF, updates it
// with the current form values, and returns the XML file for download.
// Request: JSON body {pdf_data, values, password}.
func ExportXML(w http.ResponseWriter, r *http.Request) {
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

	// Extract XFA datasets stream.
	rawStream, _, err := xfa.FindXFADatasetsStream(pdfBytes, nil, false)
	if err != nil {
		http.Error(w, "failed to extract XFA datasets: "+err.Error(), http.StatusInternalServerError)
		return
	}
	xmlBytes, _, err := xfa.DecompressStream(rawStream)
	if err != nil {
		xmlBytes = rawStream
	}

	// Build name-keyed form data from the ID-keyed request values.
	var passwordBytes []byte
	if req.Password != "" {
		passwordBytes = []byte(req.Password)
	}
	form, err := pdfer.ExtractForm(pdfBytes, passwordBytes, false)
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

	updatedXML, err := xfa.UpdateXFAValues(string(xmlBytes), formData, false)
	if err != nil {
		http.Error(w, "failed to update XML: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="estar_data.xml"`)
	w.Write([]byte(updatedXML)) //nolint:errcheck
}
