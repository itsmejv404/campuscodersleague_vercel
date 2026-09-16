"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Search,
  RefreshCw,
  ArrowLeft,
  X,
  Filter,
  Users,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
} from "lucide-react";

interface ParticipantRecord {
  id: string;
  studentId: string;
  name: string;
  email: string;
  gender: string;
  phone: string;
  year: string;
  category: "CS" | "NonCS";
  team?: { id: string; name: string } | null;
}

interface RowError {
  rowNumber: number;
  data: Record<string, unknown>;
  errors: string[];
}

interface UploadPreview {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  invalidRows: RowError[];
}

export default function AdminParticipantsPage() {
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");

  // Notification message
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [committing, setCommitting] = useState(false);

  // Add Participant Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [addForm, setAddForm] = useState({
    studentId: "",
    name: "",
    email: "",
    gender: "Male",
    phone: "",
    year: "II Year",
    category: "CS" as "CS" | "NonCS",
  });

  // Edit Participant Modal State
  const [editingParticipant, setEditingParticipant] = useState<ParticipantRecord | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    studentId: "",
    name: "",
    email: "",
    gender: "",
    phone: "",
    year: "",
    category: "CS" as "CS" | "NonCS",
  });

  // Delete Participant Modal State
  const [deletingParticipant, setDeletingParticipant] = useState<ParticipantRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load participants list
  const fetchParticipants = async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (teamFilter === "HAS_TEAM") params.set("hasTeam", "true");
      if (teamFilter === "NO_TEAM") params.set("hasTeam", "false");

      const res = await fetch(`/api/admin/participants?${params.toString()}`);
      const data = await res.json();
      if (data.participants) {
        setParticipants(data.participants);
        setTotalCount(data.totalCount);
      }
    } catch {
      console.error("Failed to load participants");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
  }, [searchQuery, categoryFilter, teamFilter]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreview(null);
      setFeedback(null);
      // Auto analyze preview
      handleAnalyze(file);
    }
  };

  // Analyze file preview before commit
  const handleAnalyze = async (file: File) => {
    setUploading(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/admin/participants/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to parse file." });
      } else {
        setPreview(data);
      }
    } catch {
      setFeedback({ type: "error", text: "Network error during file parsing." });
    } finally {
      setUploading(false);
    }
  };

  // Commit valid rows to DB
  const handleCommitUpsert = async () => {
    if (!selectedFile) return;
    setCommitting(true);
    setFeedback(null);

    try {
      const fd = new FormData();
      fd.append("file", selectedFile);

      const res = await fetch("/api/admin/participants/upload?commit=true", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to commit upload." });
      } else {
        setFeedback({
          type: "success",
          text: `Successfully imported / updated ${data.upsertedCount} participants!`,
        });
        setPreview(null);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchParticipants();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error while saving participants." });
    } finally {
      setCommitting(false);
    }
  };

  // Add single participant handler
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.studentId || !addForm.name || !addForm.email) {
      setFeedback({ type: "error", text: "Please fill in all required fields (Student ID, Name, Email)." });
      return;
    }

    setAddingParticipant(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/admin/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to add participant." });
      } else {
        setFeedback({ type: "success", text: `Participant "${addForm.name}" created successfully!` });
        setShowAddModal(false);
        setAddForm({
          studentId: "",
          name: "",
          email: "",
          gender: "Male",
          phone: "",
          year: "II Year",
          category: "CS",
        });
        fetchParticipants();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error while adding participant." });
    } finally {
      setAddingParticipant(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (p: ParticipantRecord) => {
    setEditingParticipant(p);
    setEditForm({
      studentId: p.studentId,
      name: p.name,
      email: p.email,
      gender: p.gender || "Unspecified",
      phone: p.phone || "N/A",
      year: p.year || "II Year",
      category: p.category,
    });
  };

  // Save Edit participant
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParticipant) return;

    setSavingEdit(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/participants/${editingParticipant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to update participant." });
      } else {
        setFeedback({ type: "success", text: `Participant "${editForm.name}" updated successfully!` });
        setEditingParticipant(null);
        fetchParticipants();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error while updating participant." });
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete participant
  const handleDelete = async () => {
    if (!deletingParticipant) return;

    setDeleting(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/participants/${deletingParticipant.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to delete participant." });
      } else {
        setFeedback({ type: "success", text: data.message || "Participant deleted successfully." });
        setDeletingParticipant(null);
        fetchParticipants();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error while deleting participant." });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8 py-6">
      {/* Navigation */}
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center text-xs font-medium text-gray-500 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Admin Hub
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Participant Registry & Management
            </h1>
            <p className="text-xs text-gray-500">
              Add new participants, edit details, remove entries, or batch import rosters via Excel (.xlsx) / CSV.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchParticipants}
            className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingList ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Participant
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-lg border flex items-center justify-between text-xs sm:text-sm ${
            feedback.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-medium underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Zone Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-gray-900 mb-1">Batch Spreadsheet Import</h2>
        <p className="text-xs text-gray-500 mb-4">
          Required columns: <code>StudentID</code>, <code>Name</code>, <code>Email</code>,{" "}
          <code>Gender</code>, <code>Phone</code>, <code>Year</code>, <code>Category</code> (CS or NonCS).
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileChange}
            className="hidden"
            id="spreadsheet-file"
          />
          <label
            htmlFor="spreadsheet-file"
            className="cursor-pointer inline-flex items-center px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition"
          >
            <UploadCloud className="w-4 h-4 mr-2 text-gray-500" />
            {selectedFile ? selectedFile.name : "Choose .xlsx or .csv File"}
          </label>

          {selectedFile && (
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear file
            </button>
          )}

          {uploading && (
            <span className="text-xs text-gray-500 flex items-center">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Analyzing file...
            </span>
          )}
        </div>

        {/* Preview Summary */}
        {preview && (
          <div className="mt-6 border-t border-gray-100 pt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3 text-xs">
                <span className="font-semibold text-gray-700">Total Rows: {preview.totalRows}</span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                  Valid: {preview.validCount}
                </span>
                {preview.invalidCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold">
                    Errors: {preview.invalidCount}
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={committing || preview.validCount === 0}
                onClick={handleCommitUpsert}
                className="inline-flex items-center px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {committing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Committing to Database...
                  </>
                ) : (
                  `Commit Upsert (${preview.validCount} rows)`
                )}
              </button>
            </div>

            {/* Validation Errors Table if any */}
            {preview.invalidRows.length > 0 && (
              <div className="mt-4 border border-red-200 rounded-lg overflow-hidden bg-red-50/20">
                <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 text-xs font-bold text-red-800">
                  Validation Warnings / Errors ({preview.invalidRows.length} rows will be skipped):
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-red-100 text-xs">
                  {preview.invalidRows.map((err, i) => (
                    <div key={i} className="p-2.5 flex items-start justify-between">
                      <div>
                        <span className="font-semibold text-gray-900 mr-2">
                          Row {err.rowNumber}:
                        </span>
                        <span className="text-gray-600">
                          {String(err.data.name || err.data.Name || "Unnamed")} (
                          {String(err.data.email || err.data.Email || "No email")})
                        </span>
                      </div>
                      <span className="text-red-600 font-medium">{err.errors.join(", ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Participant List Table Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-gray-900">Current Participants ({totalCount})</h2>
            <p className="text-xs text-gray-500">
              Filter by department category or team status. Perform individual edits and deletions directly.
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, ID, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="ALL">All Categories</option>
              <option value="CS">CS Only</option>
              <option value="NonCS">Core Only</option>
            </select>

            {/* Team Filter */}
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="ALL">All Teams</option>
              <option value="HAS_TEAM">In a Team</option>
              <option value="NO_TEAM">Unassigned</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-3">Student ID</th>
                <th className="px-3.5 py-3">Name</th>
                <th className="px-3.5 py-3">Email</th>
                <th className="px-3.5 py-3">Category</th>
                <th className="px-3.5 py-3">Year</th>
                <th className="px-3.5 py-3">Phone</th>
                <th className="px-3.5 py-3">Team Status</th>
                <th className="px-3.5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
              {loadingList ? (
                <tr>
                  <td colSpan={8} className="px-3.5 py-8 text-center text-gray-400">
                    <RefreshCw className="w-4 h-4 mx-auto animate-spin mb-1 text-gray-300" />
                    Loading participants...
                  </td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3.5 py-8 text-center text-gray-400">
                    No participants matching current filters.
                  </td>
                </tr>
              ) : (
                participants.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/75 transition">
                    <td className="px-3.5 py-3 font-mono font-medium text-gray-900">
                      {p.studentId}
                    </td>
                    <td className="px-3.5 py-3 font-semibold text-gray-900">{p.name}</td>
                    <td className="px-3.5 py-3 text-gray-500">{p.email}</td>
                    <td className="px-3.5 py-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          p.category === "CS"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {p.category === "CS" ? "CS" : "Core"}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">{p.year}</td>
                    <td className="px-3.5 py-3">{p.phone}</td>
                    <td className="px-3.5 py-3">
                      {p.team ? (
                        <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {p.team.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                          title="Edit participant"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingParticipant(p)}
                          className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title="Delete participant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Participant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Add New Participant</h3>
                <p className="text-xs text-gray-500">
                  Register an individual participant manually into the registry.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Student ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. CCLCSE101"
                  value={addForm.studentId}
                  onChange={(e) => setAddForm({ ...addForm, studentId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. 2k24cse001@kiot.ac.in"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Department Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={addForm.category}
                    onChange={(e) =>
                      setAddForm({ ...addForm, category: e.target.value as "CS" | "NonCS" })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="CS">CS (Computer Science)</option>
                    <option value="NonCS">NonCS (Core Engineering)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Gender</label>
                  <select
                    value={addForm.gender}
                    onChange={(e) => setAddForm({ ...addForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other / Unspecified</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Year / Class</label>
                  <input
                    type="text"
                    placeholder="e.g. II Year"
                    value={addForm.year}
                    onChange={(e) => setAddForm({ ...addForm, year: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingParticipant}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs disabled:opacity-50 transition"
                >
                  {addingParticipant ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Create Participant"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Participant Modal */}
      {editingParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Edit Participant</h3>
                <p className="text-xs text-gray-500">
                  Update personal details or category for {editingParticipant.studentId}.
                </p>
              </div>
              <button
                onClick={() => setEditingParticipant(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Student ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.studentId}
                  onChange={(e) => setEditForm({ ...editForm, studentId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Department Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm({ ...editForm, category: e.target.value as "CS" | "NonCS" })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="CS">CS (Computer Science)</option>
                    <option value="NonCS">NonCS (Core Engineering)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Gender</label>
                  <input
                    type="text"
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Year / Class</label>
                  <input
                    type="text"
                    value={editForm.year}
                    onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingParticipant(null)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs disabled:opacity-50 transition"
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-gray-900">Delete Participant</h3>
              </div>
              <button
                onClick={() => setDeletingParticipant(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to permanently delete participant{" "}
              <strong>&quot;{deletingParticipant.name}&quot;</strong> (ID: {deletingParticipant.studentId})?
            </p>

            {deletingParticipant.team && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                ⚠️ This participant is currently part of team{" "}
                <strong>&quot;{deletingParticipant.team.name}&quot;</strong>. Deleting them will remove them from the team.
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingParticipant(null)}
                className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Confirm Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
