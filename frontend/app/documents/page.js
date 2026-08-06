"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  LinearProgress,
} from "@mui/material";
import { CloudUpload, Archive } from "@mui/icons-material";
import Layout from "../../components/Layout";
import { documentApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function DocumentsPage() {
  const { hasRole } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadDocs = async () => {
    try {
      const res = await documentApi.list();
      setDocs(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await documentApi.upload(formData);
      setMessage(res.data.message);
      e.target.value = "";
      await loadDocs();
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleArchive = async (id) => {
    try {
      await documentApi.archive(id);
      await loadDocs();
    } catch (err) {
      setError(err.response?.data?.detail || "Archive failed");
    }
  };

  return (
    <Layout>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Document Management
          </Typography>
          <Typography color="text.secondary">
            Upload Work Instructions, manage revisions, and archive obsolete versions.
          </Typography>
        </Box>
        {hasRole("admin") && (
          <Button variant="contained" component="label" startIcon={<CloudUpload />} disabled={uploading}>
            {uploading ? <CircularProgress size={24} /> : "Upload Document"}
            <input type="file" hidden accept=".docx,.doc" onChange={handleUpload} />
          </Button>
        )}
      </Box>

      {uploading && <LinearProgress sx={{ mb: 2 }} />}
      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>WI Number</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Revision</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Status</TableCell>
                {hasRole("admin") && <TableCell>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {docs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{doc.wi_number}</TableCell>
                  <TableCell>{doc.title}</TableCell>
                  <TableCell>{doc.revision}</TableCell>
                  <TableCell>{doc.department}</TableCell>
                  <TableCell>
                    <Chip
                      label={doc.is_archived ? "Archived" : doc.is_latest ? "Latest" : "Revoked"}
                      color={doc.is_archived ? "default" : "success"}
                      size="small"
                    />
                  </TableCell>
                  {hasRole("admin") && (
                    <TableCell>
                      {!doc.is_archived && (
                        <Button size="small" startIcon={<Archive />} onClick={() => handleArchive(doc.id)}>
                          Archive
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Layout>
  );
}
